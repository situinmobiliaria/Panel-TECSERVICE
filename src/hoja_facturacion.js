// ═══════════════════════════════════════════════════════════════
// hoja_facturacion.js — Facturación a la Fecha
// Depende de: datos.js (FAC_DATA, APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

// ─── HELPERS LOCALES ──────────────────────────────────────────
function ytdSum(arr12,hastaMes){let s=0;for(let i=0;i<hastaMes;i++)s+=arr12[i]||0;return s;}
function clpFmt(v){return Math.round(v).toLocaleString('es-CL');}
function fmtMM2(v){return 'MM$'+(v/1e6).toFixed(1).replace('.',',');}
function fmtMMint2(v){return 'MM$'+Math.round(v/1e6).toLocaleString('es-CL');}

// ─── ACTUALIZAR TAG Y FECHA ───────────────────────────────────
(function actualizarFechaTag(){
  const hd=document.getElementById('hd-date');
  if(hd)hd.textContent='📅 '+MES_CORTE_NOMBRE+' '+ANO_ACTUAL+' · A la fecha';
  const tag=document.getElementById('rs-tag');
  if(tag)tag.innerHTML='Facturación real del área a <strong>'+MES_CORTE_NOMBRE+' '+ANO_ACTUAL+'</strong> · '+APP_DATA.panel.length+' clientes con contrato · Datos hasta '+MES_CORTE_NOMBRE;
  ['rs-corte','rs-corte2','rs-corte3','pf-corte'].forEach(id=>{
    const e=document.getElementById(id);if(e)e.textContent=MES_CORTE_NOMBRE.toLowerCase();
  });
})();

// ─── STATE VARS ───────────────────────────────────────────────
let fcCoordF='todas',fcTipoF='todos',fcSrch='',fcSF='fac_total',fcSA=false;
let fcYrF='2026';
let fcChartAno=null,fcChartMix=null,fcChartTop=null,fcChartTopCorr=null;
let fcChartLineSingle=null,fcChartLineTop5=null;
let fcChartTipoN=null,fcChartTipoMonto=null,fcChartTipoCR=null;
let fcIncluirRecientes=false;
const FC_PPTO_TOTAL=TOTAL_PRESUP;
const FC_PPTO_CONTRATOS=PPTO_CONTRATOS;

// ─── HELPERS YEAR FILTER ─────────────────────────────────────
function fcYrTotal(d){
  if(fcYrF==='todos')return(d.fac_2024||0)+(d.fac_2025||0)+(d.fac_2026||0);
  if(fcYrF==='2024')return d.fac_2024||0;
  if(fcYrF==='2025')return d.fac_2025||0;
  if(fcYrF==='2026')return d.fac_2026||0;
  return 0;
}
function fcYrContr(d){
  if(fcYrF==='2026'){
    const k=(d.cliente||'').trim().toUpperCase().replace(/\s+/g,' ');
    const p=APP_DATA.panel.find(x=>(x.cliente||'').trim().toUpperCase().replace(/\s+/g,' ')===k);
    return p?(p.presup_contr_ytd||0):0;
  }
  if(fcYrF==='todos'){
    return(d.contr_2024_real||0)+(d.contr_2025_real||0)+(window.fcYrContrYTD2026?window.fcYrContrYTD2026(d):0);
  }
  if(fcYrF==='2024')return d.contr_2024_real||0;
  if(fcYrF==='2025')return d.contr_2025_real||0;
  return 0;
}
function fcYrCorr(d){return fcYrTotal(d)-fcYrContr(d);}
function fcYrLabel(){
  if(fcYrF==='todos')return'2024 - 2026';
  if(fcYrF==='2026')return'2026 a la fecha (Ene-'+MES_CORTE_NOMBRE+')';
  return fcYrF+' real (Ene-'+MES_CORTE_NOMBRE+')';
}

// ─── INIT ─────────────────────────────────────────────────────
function initFacturacion(){
  const coords=[...new Set(FAC_DATA.map(d=>d.coord))].sort();
  const filtCoord=document.getElementById('fc-filt-coord');
  if(filtCoord){
    coords.forEach(c=>{
      const b=document.createElement('button');
      b.className='btn';b.dataset.fcc=c;b.textContent=c.split(' ')[0];
      filtCoord.appendChild(b);
    });
    filtCoord.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      filtCoord.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');fcCoordF=b.dataset.fcc;renderFacturacion();
    }));
  }
  document.querySelectorAll('#fc-filt-tipo .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#fc-filt-tipo .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');fcTipoF=b.dataset.fct;renderFacturacion();
  }));
  const _fcs=document.getElementById('fc-srch');
  if(_fcs)_fcs.addEventListener('input',e=>{fcSrch=e.target.value.toLowerCase();renderFacturacion();});
  document.querySelectorAll('#fc-yr .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#fc-yr .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');fcYrF=b.dataset.yr;
    fcRefreshAll();
  }));
  document.querySelectorAll('#fc-yr .btn').forEach(b=>b.classList.toggle('on',b.dataset.yr===fcYrF));
  const sel=document.getElementById('fc-cli-sel');
  const sortedCli=[...FAC_DATA].sort((a,b)=>b.fac_total-a.fac_total);
  sortedCli.forEach(d=>{
    const opt=document.createElement('option');
    opt.value=d.cliente;
    opt.textContent=d.cliente.length>50?d.cliente.slice(0,49)+'…':d.cliente;
    sel.appendChild(opt);
  });
  sel.addEventListener('change',()=>renderFcLineSingle(sel.value));
  renderFacturacion();
  renderFcCharts();
  renderFcLineSingle(sortedCli[0].cliente);
  renderFcLineTop5();
  renderFcTipoCliente();
  renderFcAlertas();
  renderFcVsPpto();
}

function fcRefreshAll(){
  const infoMap={'todos':'Visualizando todos los años (2024 - 2026)','2024':'Visualizando solo el año 2024','2025':'Visualizando solo el año 2025','2026':'Visualizando solo el año 2026 (a la fecha)'};
  const elInfo=document.getElementById('fc-yr-info');
  if(elInfo)elInfo.textContent=infoMap[fcYrF]||'';
  renderFacturacion();
  renderFcCharts();
  const sel=document.getElementById('fc-cli-sel');
  if(sel&&sel.value)renderFcLineSingle(sel.value);
  renderFcLineTop5();
  renderFcTipoCliente();
  renderFcAlertas();
  renderFcVsPpto();
}

function fcFilter(){
  return FAC_DATA.filter(d=>{
    if(fcCoordF!=='todas'&&d.coord!==fcCoordF)return false;
    if(fcTipoF==='con'&&fcYrTotal(d)<=0)return false;
    if(fcTipoF==='corr'&&fcYrCorr(d)<=0)return false;
    if(fcSrch&&!d.cliente.toLowerCase().includes(fcSrch)&&!d.coord.toLowerCase().includes(fcSrch))return false;
    return true;
  });
}

function fcSort(f){fcSA=fcSF===f?!fcSA:false;fcSF=f;renderFacturacion();}

function renderFacturacion(){
  const data=fcFilter();
  const isAll=fcYrF==='todos';
  const sf=fcSF;
  data.sort((a,b)=>{
    let av,bv;
    if(sf==='cliente'||sf==='coord'){av=a[sf]||'';bv=b[sf]||'';return fcSA?av.localeCompare(bv):bv.localeCompare(av);}
    else if(sf==='pct_corr'){const at=fcYrTotal(a),bt=fcYrTotal(b);av=at>0?fcYrCorr(a)/at:0;bv=bt>0?fcYrCorr(b)/bt:0;}
    else if(sf==='n'){av=FAC_DATA.indexOf(a);bv=FAC_DATA.indexOf(b);}
    else if(sf==='fac_total'){av=fcYrTotal(a);bv=fcYrTotal(b);}
    else if(sf==='fac_contratos'){av=fcYrContr(a);bv=fcYrContr(b);}
    else if(sf==='fac_correctiva'){av=fcYrCorr(a);bv=fcYrCorr(b);}
    else{av=a[sf]||0;bv=b[sf]||0;}
    return fcSA?av-bv:bv-av;
  });

  // Totales directamente desde mensual.facturado (BBDD crudo, solo Facturas ST/REAS/Traz)
  const _mf=APP_DATA.mensual&&APP_DATA.mensual.facturado||{};
  const _sumMf=(yr)=>(_mf[String(yr)]||[]).slice(0,MES_CORTE).reduce((s,v)=>s+v,0);
  const t24=_sumMf(2024);
  const t25=_sumMf(2025);
  const t26=data.reduce((s,d)=>s+d.fac_2026,0);
  const _af=APP_DATA.analisis_fac||{};
  const t26Master=fcYrF==='2026'&&_af.ts_ingresos>0 ? _af.ts_ingresos : t26;
  const tot=fcYrF==='2026'?t26Master:fcYrF==='2024'?t24:fcYrF==='2025'?t25:(t24+t25+t26Master);
  // Contratos: para 2024/2025 usa Vendedor ST* desde BBDD; para 2026 usa presup_contr_ytd
  const _vc24=APP_DATA.ytd_contr_2024||0;
  const _vc25=APP_DATA.ytd_contr_2025||0;
  const _vc26=data.reduce((s,d)=>s+fcYrContr(d),0);
  const tcontr=fcYrF==='2024'?_vc24:fcYrF==='2025'?_vc25:fcYrF==='2026'?_vc26:(_vc24+_vc25+_vc26);
  const tcorr=Math.max(0, tot-tcontr);

  document.getElementById('fc-clientes-badge').textContent=data.length+' clientes';
  const kTotal=document.getElementById('fc-k-total');
  if(isAll){kTotal.textContent=mm(tot);kTotal.parentNode.querySelector('.ppto-kl').textContent='Facturación Total';}
  else{kTotal.textContent=mm(tot);kTotal.parentNode.querySelector('.ppto-kl').textContent='Facturación '+fcYrF;}

  document.getElementById('fc-k-2024').textContent=mm(t24);
  document.getElementById('fc-k-2025').textContent=mm(t25);
  document.getElementById('fc-k-2026').textContent=mm(t26Master);
  ['2024','2025','2026'].forEach(yr=>{
    const el=document.getElementById('fc-k-'+yr).parentNode;
    el.style.opacity=(isAll||fcYrF===yr)?'1':'0.35';
  });

  document.getElementById('fc-k-contr').textContent=mm(tcontr);
  document.getElementById('fc-k-corr').textContent=mm(tcorr);

  const sumCC=tcontr+tcorr;
  const pctC=sumCC>0?(tcontr/sumCC*100):0;
  const pctR=sumCC>0?(tcorr/sumCC*100):0;
  document.getElementById('fc-bar-contr').style.width=pctC.toFixed(1)+'%';
  document.getElementById('fc-bar-contr').textContent=pctC>10?pctC.toFixed(1)+'%':'';
  document.getElementById('fc-bar-corr').style.width=pctR.toFixed(1)+'%';
  document.getElementById('fc-bar-corr').textContent=pctR>10?pctR.toFixed(1)+'%':'';
  document.getElementById('fc-mix-pct').textContent=pctC.toFixed(1)+'% / '+pctR.toFixed(1)+'%';

  const con_fac=data.filter(d=>fcYrTotal(d)>0).length;
  const con_corr=data.filter(d=>fcYrCorr(d)>0).length;
  const periodo=isAll?'período 2024-2026':'año '+fcYrF;
  document.getElementById('fc-nota').innerHTML='<strong>'+data.length+'</strong> clientes en '+periodo+' · <strong>'+con_fac+'</strong> con facturación registrada · <strong>'+con_corr+'</strong> con servicios correctivos · Promedio: '+mm(data.length>0?tot/data.length:0)+' por cliente';

  const tb=document.getElementById('tb-fc');
  if(!tb)return;
  const hl=(yr)=>fcYrF===yr?'background:rgba(40,210,195,.08);':'';
  tb.innerHTML=data.map((d,i)=>{
    const ttot=fcYrTotal(d),tcon=fcYrContr(d),tcor=fcYrCorr(d);
    const pctCorr=ttot>0?(tcor/ttot*100):0;
    const cBadge=pctCorr>=70?'pd':pctCorr>=40?'py':pctCorr>0?'pb':'pgr';
    return`<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
      <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.cliente}"><strong>${shortN(d.cliente)}</strong></td>
      <td style="font-size:.65rem;color:var(--mut)">${shortC(d.coord)}</td>
      <td class="num" style="text-align:right;${hl('2024')}">${mm(d.fac_2024)}</td>
      <td class="num" style="text-align:right;${hl('2025')}">${mm(d.fac_2025)}</td>
      <td class="num" style="text-align:right;${hl('2026')}">${mm(d.fac_2026)}</td>
      <td class="num" style="text-align:right;color:var(--az1);font-weight:700">${mm(ttot)}</td>
      <td class="num" style="text-align:right;color:#007A72">${mm(tcon)}</td>
      <td class="num" style="text-align:right;color:var(--or)">${mm(tcor)}</td>
      <td style="text-align:right"><span class="pill ${cBadge}">${pctCorr.toFixed(0)}%</span></td>
    </tr>`;
  }).join('');

  document.getElementById('fc-ft').textContent=data.length+' clientes mostrados · '+periodo;
  document.getElementById('fc-ftr').textContent='Total: '+mm(tot);
  renderFcCoord(data);
}

function renderFcCoord(data){
  const grid=document.getElementById('fc-coord-grid');
  const groups={};
  data.forEach(d=>{
    if(!groups[d.coord])groups[d.coord]={n:0,total:0,contr:0,corr:0};
    groups[d.coord].n+=1;
    groups[d.coord].total+=fcYrTotal(d);
    groups[d.coord].contr+=fcYrContr(d);
    groups[d.coord].corr+=fcYrCorr(d);
  });
  const arr=Object.entries(groups).map(([k,v])=>({coord:k,...v})).sort((a,b)=>b.total-a.total);
  const totGlobal=arr.reduce((s,d)=>s+d.total,0);
  const colors=[C.az2,C.te,C.am,C.gn,C.or,C.rd,'#8B5CF6'];
  grid.innerHTML=arr.map((g,i)=>{
    const pctTot=totGlobal>0?(g.total/totGlobal*100):0;
    const pctCorr=g.total>0?(g.corr/g.total*100):0;
    const color=colors[i%colors.length];
    return`<div class="ppto-coord-card">
      <div class="ppto-coord-head" style="background:${color}">
        <span>${g.coord.split(' ').slice(0,2).join(' ')}</span>
        <span style="font-family:'Roboto Mono',monospace;font-size:.65rem">${g.n}</span>
      </div>
      <div class="ppto-coord-body">
        <div class="ppto-coord-row"><span>Total</span><strong>${mm(g.total)}</strong></div>
        <div class="ppto-coord-row"><span>Contratos</span><strong style="color:#007A72">${mm(g.contr)}</strong></div>
        <div class="ppto-coord-row"><span>Otras Fact.</span><strong style="color:var(--or)">${mm(g.corr)}</strong></div>
        <div class="ppto-cbar"><div class="ppto-cbar-fill" style="width:${pctTot}%;background:${color}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:.58rem;color:var(--mut)">
          <span>${pctTot.toFixed(1)}% del total</span>
          <span>${pctCorr.toFixed(0)}% correc.</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function _mfYtd(yr){const a=(APP_DATA.mensual&&APP_DATA.mensual.facturado&&APP_DATA.mensual.facturado[String(yr)])||[];return a.slice(0,MES_CORTE).reduce((s,v)=>s+v,0);}

function renderFcCharts(){
  const isAll=fcYrF==='todos';
  const _af2=APP_DATA.analisis_fac||{};
  const t24=_mfYtd(2024);
  const t25=_mfYtd(2025);
  const t26Raw=FAC_DATA.reduce((s,d)=>s+d.fac_2026,0);
  const t26=_af2.ts_ingresos>0?_af2.ts_ingresos:t26Raw;

  const baseCol=['#A8DADC','#FFD966','#FFC000'],baseBor=['#7DC9D6','#E5BD52','#D4A300'];
  const grayCol='#D5D9E0',grayBor='#B5BDC9';
  let bgCols=baseCol.slice(),boCols=baseBor.slice();
  if(!isAll){const idx={'2024':0,'2025':1,'2026':2}[fcYrF];bgCols=[0,1,2].map(i=>i===idx?baseCol[i]:grayCol);boCols=[0,1,2].map(i=>i===idx?baseBor[i]:grayBor);}
  if(fcChartAno)fcChartAno.destroy();
  fcChartAno=new Chart(document.getElementById('cFcAno'),{
    type:'bar',
    data:{labels:['2024','2025','2026 (a la fecha)'],datasets:[{label:'Facturación',data:[t24/1e6,t25/1e6,t26/1e6],backgroundColor:bgCols,borderColor:boCols,borderWidth:1.5,borderRadius:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'MM$'+c.parsed.y.toFixed(1)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'MM$'+v}}}}
  });

  // Donut: contratos usando Vendedor "ST*" para 2024/2025, presup_contr_ytd para 2026
  const _contr2024=APP_DATA.ytd_contr_2024||0;
  const _contr2025=APP_DATA.ytd_contr_2025||0;
  const _contr2026=FAC_DATA.reduce((s,d)=>s+fcYrContr(d),0);
  const tcontr=fcYrF==='2024'?_contr2024:fcYrF==='2025'?_contr2025:fcYrF==='2026'?_contr2026:(_contr2024+_contr2025+_contr2026);
  const tcorr=Math.max(0, (isAll?(t24+t25+t26):fcYrF==='2026'?t26:fcYrF==='2025'?t25:t24) - tcontr);
  const totMix=tcontr+tcorr;
  document.getElementById('fc-donut-n').textContent=mm(totMix);
  document.getElementById('fc-leg-c').textContent=mm(tcontr)+' ('+(totMix>0?(tcontr/totMix*100).toFixed(1):0)+'%)';
  document.getElementById('fc-leg-r').textContent=mm(tcorr)+' ('+(totMix>0?(tcorr/totMix*100).toFixed(1):0)+'%)';
  if(fcChartMix)fcChartMix.destroy();
  fcChartMix=new Chart(document.getElementById('cFcMix'),{
    type:'doughnut',
    data:{labels:['F. Contratos','Otras Facturaciones'],datasets:[{data:[tcontr,tcorr],backgroundColor:[C.te,C.or],borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+': '+mm(c.parsed)}}}}
  });

  const top10=[...FAC_DATA].sort((a,b)=>fcYrTotal(b)-fcYrTotal(a)).slice(0,10);
  if(fcChartTop)fcChartTop.destroy();
  fcChartTop=new Chart(document.getElementById('cFcTop'),{
    type:'bar',
    data:{labels:top10.map(d=>shortN(d.cliente).slice(0,28)),datasets:[{label:'Contratos',data:top10.map(d=>fcYrContr(d)/1e6),backgroundColor:C.te,stack:'s'},{label:'Otras Facturaciones',data:top10.map(d=>fcYrCorr(d)/1e6),backgroundColor:C.or,stack:'s'}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10}},tooltip:{callbacks:{label:c=>c.dataset.label+': MM$'+c.parsed.x.toFixed(1)}}},scales:{x:{stacked:true,ticks:{callback:v=>'MM$'+v}},y:{stacked:true,ticks:{font:{size:9}}}}}
  });

  const top10Corr=[...FAC_DATA].filter(d=>fcYrCorr(d)>0).sort((a,b)=>fcYrCorr(b)-fcYrCorr(a)).slice(0,10);
  if(fcChartTopCorr)fcChartTopCorr.destroy();
  fcChartTopCorr=new Chart(document.getElementById('cFcTopCorr'),{
    type:'bar',
    data:{labels:top10Corr.map(d=>shortN(d.cliente).slice(0,28)),datasets:[{label:'Otras Facturaciones',data:top10Corr.map(d=>fcYrCorr(d)/1e6),backgroundColor:C.or,borderColor:'#8b3a00',borderWidth:1,borderRadius:4}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'MM$'+c.parsed.x.toFixed(1)}}},scales:{x:{ticks:{callback:v=>'MM$'+v}},y:{ticks:{font:{size:9}}}}}
  });
}

function renderFcLineSingle(cliente){
  const d=FAC_DATA.find(x=>x.cliente===cliente);
  if(!d)return;
  const v24=d.fac_2024,v25=d.fac_2025,v26=d.fac_2026;
  document.getElementById('fc-cli-2024').textContent=mm(v24);
  document.getElementById('fc-cli-2025').textContent=mm(v25);
  document.getElementById('fc-cli-2026').textContent=mm(v26);
  let varTxt='—',varColor=C.mut;
  if(v25>0){const pct=((v26-v25)/v25*100);varTxt=(pct>=0?'+':'')+pct.toFixed(1)+'%';varColor=pct>=0?C.gn:C.rd;}
  else if(v26>0){varTxt='nuevo';varColor=C.te;}
  const elV=document.getElementById('fc-cli-var');elV.textContent=varTxt;elV.style.color=varColor;
  if(fcChartLineSingle)fcChartLineSingle.destroy();
  fcChartLineSingle=new Chart(document.getElementById('cFcLineSingle'),{
    type:'line',
    data:{labels:['2024','2025','2026 (a la fecha)'],datasets:[{label:d.cliente,data:[v24/1e6,v25/1e6,v26/1e6],borderColor:C.te,backgroundColor:'rgba(40,210,195,0.18)',borderWidth:3,fill:true,tension:0.3,pointBackgroundColor:C.az1,pointBorderColor:'#fff',pointBorderWidth:2,pointRadius:6,pointHoverRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:()=>d.cliente,label:c=>c.label+': MM$'+c.parsed.y.toFixed(1)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'MM$'+v}}}}
  });
}

function renderFcLineTop5(){
  const top5=[...FAC_DATA].sort((a,b)=>b.fac_total-a.fac_total).slice(0,5);
  const palette=[C.te,C.am,C.az2,C.or,C.gn];
  const datasets=top5.map((d,i)=>({label:shortN(d.cliente).slice(0,30),data:[d.fac_2024/1e6,d.fac_2025/1e6,d.fac_2026/1e6],borderColor:palette[i],backgroundColor:palette[i]+'22',borderWidth:2.5,tension:0.3,fill:false,pointBackgroundColor:palette[i],pointBorderColor:'#fff',pointBorderWidth:1.5,pointRadius:5,pointHoverRadius:7}));
  if(fcChartLineTop5)fcChartLineTop5.destroy();
  fcChartLineTop5=new Chart(document.getElementById('cFcLineTop5'),{
    type:'line',data:{labels:['2024','2025','2026'],datasets:datasets},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:9},boxWidth:10,padding:6}},tooltip:{callbacks:{label:c=>c.dataset.label+': MM$'+c.parsed.y.toFixed(1)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>'MM$'+v}}}}
  });
}

function renderFcTipoCliente(){
  const grupos={};
  FAC_DATA.forEach(d=>{
    const t=d.tipo_cli||'N/D';
    if(!grupos[t])grupos[t]={n:0,total:0,contr:0,corr:0};
    grupos[t].n++;grupos[t].total+=fcYrTotal(d);grupos[t].contr+=fcYrContr(d);grupos[t].corr+=fcYrCorr(d);
  });
  const pub=grupos['Público']||{n:0,total:0,contr:0,corr:0};
  const pri=grupos['Privado']||{n:0,total:0,contr:0,corr:0};
  const totalN=pub.n+pri.n;
  // Escalar al total real del año seleccionado (mensual.facturado)
  const _af2T=APP_DATA.analisis_fac||{};
  const _master=fcYrF==='2026'?(_af2T.ts_ingresos||0):fcYrF==='2024'?_mfYtd(2024):fcYrF==='2025'?_mfYtd(2025):(_mfYtd(2024)+_mfYtd(2025)+(_af2T.ts_ingresos||0));
  const totalFacPanel=pub.total+pri.total;
  const _scale=totalFacPanel>0&&_master>0?_master/totalFacPanel:1;
  const pubMonto=pub.total*_scale, priMonto=pri.total*_scale;
  const totalMonto=pubMonto+priMonto;
  document.getElementById('fc-tipo-n').textContent=totalN;
  document.getElementById('fc-tipo-n-pub').textContent=pub.n+' ('+(totalN>0?(pub.n/totalN*100).toFixed(0):0)+'%)';
  document.getElementById('fc-tipo-n-pri').textContent=pri.n+' ('+(totalN>0?(pri.n/totalN*100).toFixed(0):0)+'%)';
  if(fcChartTipoN)fcChartTipoN.destroy();
  fcChartTipoN=new Chart(document.getElementById('cFcTipoN'),{type:'doughnut',data:{labels:['Público','Privado'],datasets:[{data:[pub.n,pri.n],backgroundColor:[C.az2,C.am],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+' clientes'}}}}});
  document.getElementById('fc-tipo-monto').textContent=mm(totalMonto);
  document.getElementById('fc-tipo-m-pub').textContent=mm(pubMonto)+' ('+(totalMonto>0?(pubMonto/totalMonto*100).toFixed(0):0)+'%)';
  document.getElementById('fc-tipo-m-pri').textContent=mm(priMonto)+' ('+(totalMonto>0?(priMonto/totalMonto*100).toFixed(0):0)+'%)';
  if(fcChartTipoMonto)fcChartTipoMonto.destroy();
  fcChartTipoMonto=new Chart(document.getElementById('cFcTipoMonto'),{type:'doughnut',data:{labels:['Público','Privado'],datasets:[{data:[pubMonto,priMonto],backgroundColor:[C.az2,C.am],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+': '+mm(c.parsed)}}}}});
  if(fcChartTipoCR)fcChartTipoCR.destroy();
  fcChartTipoCR=new Chart(document.getElementById('cFcTipoCR'),{type:'bar',data:{labels:['Público','Privado'],datasets:[{label:'Contratos',data:[pub.contr/1e6,pri.contr/1e6],backgroundColor:C.te,stack:'s',borderRadius:4},{label:'Otras Facturaciones',data:[pub.corr/1e6,pri.corr/1e6],backgroundColor:C.or,stack:'s',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:12,padding:8}},tooltip:{callbacks:{label:c=>c.dataset.label+': MM$'+c.parsed.x.toFixed(1)}}},scales:{x:{stacked:true,ticks:{callback:v=>'MM$'+v}},y:{stacked:true}}}});
}

function renderFcAlertas(){
  const HOY=new Date().toISOString().slice(0,10);
  const DIAS_MIN=60;
  const sin2026=FAC_DATA.filter(d=>{
    if(!d.fin_contrato||d.fin_contrato<HOY)return false;
    if(d.fac_2026!==0)return false;
    if(!fcIncluirRecientes&&d.dias_inicio!==null&&d.dias_inicio<=DIAS_MIN)return false;
    return true;
  }).sort((a,b)=>(b.fac_2024+b.fac_2025)-(a.fac_2024+a.fac_2025));
  const totalConRecientes=FAC_DATA.filter(d=>d.fin_contrato&&d.fin_contrato>=HOY&&d.fac_2026===0).length;
  const recientesCount=FAC_DATA.filter(d=>d.fin_contrato&&d.fin_contrato>=HOY&&d.fac_2026===0&&d.dias_inicio!==null&&d.dias_inicio<=DIAS_MIN).length;
  const badge=fcIncluirRecientes?(totalConRecientes+' clientes'):(sin2026.length+' clientes · '+recientesCount+' recientes ocultos');
  document.getElementById('fc-alert-n-sin').textContent=badge;
  const tbSin=document.getElementById('tb-alert-sin');
  tbSin.innerHTML=sin2026.map((d,i)=>{
    const total25=d.fac_2025,totalHist=d.fac_2024+d.fac_2025;
    let riesgo,cls;
    if(d.dias_inicio!==null&&d.dias_inicio<=DIAS_MIN){riesgo='RECIENTE';cls='pte';}
    else if(total25>=20000000||totalHist>=30000000){riesgo='ALTO';cls='pd';}
    else if(total25>=5000000||totalHist>=10000000){riesgo='MEDIO';cls='py';}
    else if(totalHist>0){riesgo='BAJO';cls='pb';}
    else{riesgo='S/HIST';cls='pgr';}
    const tipoBadgeAlrt=d.tipo_cli==='Público'?'<span class="pill pb">PÚB</span>':d.tipo_cli==='Privado'?'<span class="pill por">PRIV</span>':'<span class="pill pgr">N/D</span>';
    return`<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.cliente}"><strong>${shortN(d.cliente)}</strong></td>
      <td>${tipoBadgeAlrt}</td>
      <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${d.inicio_fmt}</td>
      <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${d.fin_fmt}</td>
      <td class="num" style="text-align:right">${mm(d.fac_2024)}</td>
      <td class="num" style="text-align:right;color:${total25>0?'var(--rd)':'var(--mut)'};font-weight:${total25>0?700:400}">${mm(d.fac_2025)}</td>
      <td style="text-align:right"><span class="pill ${cls}">${riesgo}</span></td>
    </tr>`;
  }).join('');
  if(sin2026.length===0){tbSin.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--mut);font-style:italic">Sin alertas 🎉</td></tr>';}

  const FACTOR_ANUAL=12/MES_CORTE;
  const caidas=FAC_DATA.filter(d=>d.fac_2025>1000000&&d.fac_2026>0).map(d=>{const proy=d.fac_2026*FACTOR_ANUAL;const varPct=((proy-d.fac_2025)/d.fac_2025)*100;return{...d,proy_2026:proy,var_pct:varPct};}).filter(d=>d.var_pct<-50).sort((a,b)=>a.var_pct-b.var_pct);
  document.getElementById('fc-alert-n-caida').textContent=caidas.length+' clientes';
  const tbCaida=document.getElementById('tb-alert-caida');
  tbCaida.innerHTML=caidas.map((d,i)=>{
    const cls=d.var_pct<=-80?'pd':d.var_pct<=-65?'py':'pb';
    const tipoBadgeAlrt2=d.tipo_cli==='Público'?'<span class="pill pb">PÚB</span>':d.tipo_cli==='Privado'?'<span class="pill por">PRIV</span>':'<span class="pill pgr">N/D</span>';
    return`<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
      <td style="max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.cliente}"><strong>${shortN(d.cliente)}</strong></td>
      <td>${tipoBadgeAlrt2}</td>
      <td class="num" style="text-align:right">${mm(d.fac_2025)}</td>
      <td class="num" style="text-align:right;color:var(--or)">${mm(d.proy_2026)}</td>
      <td style="text-align:right"><span class="pill ${cls}">${d.var_pct.toFixed(0)}%</span></td>
    </tr>`;
  }).join('');
  if(caidas.length===0){tbCaida.innerHTML='<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--mut);font-style:italic">Sin alertas 🎉</td></tr>';}

  const cb=document.getElementById('fc-alert-recientes');
  if(cb&&!cb._wired){cb._wired=true;cb.addEventListener('change',e=>{fcIncluirRecientes=e.target.checked;renderFcAlertas();});}
}

function renderFcVsPpto(){
  const isAll=fcYrF==='todos';
  const _afV=APP_DATA.analisis_fac||{};
  const t24v=_mfYtd(2024);
  const t25v=_mfYtd(2025);
  const t26v=_afV.ts_ingresos>0?_afV.ts_ingresos:FAC_DATA.reduce((s,d)=>s+d.fac_2026,0);
  const totFact=isAll?(t24v+t25v+t26v):fcYrF==='2026'?t26v:fcYrF==='2025'?t25v:t24v;
  const _vc24=APP_DATA.ytd_contr_2024||0,_vc25=APP_DATA.ytd_contr_2025||0;
  const _vc26=FAC_DATA.reduce((s,d)=>s+fcYrContr(d),0);
  const totContr=fcYrF==='2024'?_vc24:fcYrF==='2025'?_vc25:fcYrF==='2026'?_vc26:(_vc24+_vc25+_vc26);
  const factor=isAll?3:1;
  const pptoTot=FC_PPTO_TOTAL*factor,pptoCon=FC_PPTO_CONTRATOS*factor;
  const periodLabel=isAll?'Acumulado 2024-2026':'Año '+fcYrF;
  document.getElementById('fc-vsp-tot-period').textContent=periodLabel;
  document.getElementById('fc-vsp-con-period').textContent=periodLabel;
  const tag=document.getElementById('fc-vsp-tag');
  if(tag)tag.textContent='Comparativo facturación real vs presupuesto · '+periodLabel+(isAll?' · 3 años de ppto':'');

  const pctTot=pptoTot>0?(totFact/pptoTot*100):0,gapTot=pptoTot-totFact;
  document.getElementById('fc-vsp-tot-fact').textContent=mm(totFact);
  document.getElementById('fc-vsp-tot-ppto').textContent=mm(pptoTot);
  const elPctT=document.getElementById('fc-vsp-tot-pct');elPctT.textContent=pctTot.toFixed(1)+'%';elPctT.style.color=pctTot>=90?'#7DC9D6':pctTot>=70?'#FFC000':pctTot>=40?'#FF9966':'#FF6B6B';
  const barT=document.getElementById('fc-vsp-tot-bar'),wTot=Math.min(pctTot,100);barT.style.width=wTot.toFixed(1)+'%';barT.textContent=wTot>10?pctTot.toFixed(1)+'%':'';
  document.getElementById('fc-vsp-tot-gap').textContent=gapTot>0?'Falta '+mm(gapTot):'Superado +'+mm(-gapTot);

  // ── Ppto acumulado a la fecha (real de GD-PPTO) ──────────────────────────────
  // MES_CORTE = último mes con datos de facturación (puede ser menor al mes calendario)
  // MES_PPTO  = mes calendario actual → siempre acumula el ppto correcto
  const _pmFc = APP_DATA.analisis_fac && APP_DATA.analisis_fac.ppto_mensual;
  const _usePMFc = _pmFc && _pmFc.some(v=>v>0);
  const MES_PPTO = Math.min(new Date().getMonth() + 1, 12);
  const MES_PPTO_NOMBRE = MESES_FULL[MES_PPTO - 1];
  const _pptoYTDTotal = (fcYrF==='2026' && _usePMFc)
    ? _pmFc.slice(0, MES_PPTO).reduce((s,v)=>s+v, 0)
    : pptoTot * (fcYrF==='todos' ? (24+MES_PPTO)/36 : fcYrF==='2026' ? MES_PPTO/12 : 1);
  // Ppto contratos a la fecha = 50% del ppto total a la fecha
  const _pptoYTDContr = _pptoYTDTotal / 2;

  const pptoFecha=_pptoYTDTotal,pctTotFecha=pptoFecha>0?(totFact/pptoFecha*100):0,gapFecha=pptoFecha-totFact;
  const barT2=document.getElementById('fc-vsp-tot-bar2'),wTotF=Math.min(pctTotFecha,100);barT2.style.width=wTotF.toFixed(1)+'%';barT2.textContent=wTotF>10?pctTotFecha.toFixed(1)+'%':'';
  const gap2El=document.getElementById('fc-vsp-tot-gap2');gap2El.textContent=gapFecha>0?'Falta '+mm(gapFecha):'Adelanto +'+mm(-gapFecha);gap2El.style.color=gapFecha<=0?'#28d2c3':'#FFC000';
  const periodoDesc=fcYrF==='2026'?'Ppto acum. Ene–'+MES_PPTO_NOMBRE:fcYrF==='todos'?(24+MES_PPTO)+' de 36 meses':'12 de 12 meses';
  document.getElementById('fc-vsp-tot-bar2-info').textContent='Meta a la fecha ('+periodoDesc+'): '+mm(pptoFecha);
  let notaT;
  if(isAll){notaT='Facturación 2024-2026: <strong style="color:#FFC000">'+mm(totFact)+'</strong> de presupuesto acumulado <strong>'+mm(pptoTot)+'</strong> (3 años × ppto anual). Cumplimiento <strong>'+pctTot.toFixed(1)+'%</strong>.';}
  else if(fcYrF==='2026'){const adelanto=totFact-pptoFecha;notaT='Ppto acumulado Ene–'+MES_PPTO_NOMBRE+' '+ANO_ACTUAL+' (GD-PPTO): '+mm(pptoFecha)+'. Real: <strong style="color:#FFC000">'+mm(totFact)+'</strong>. '+(adelanto>=0?'<strong style="color:var(--teal)">Adelanto de '+mm(adelanto)+'</strong>':'<strong style="color:var(--rd)">Atraso de '+mm(-adelanto)+'</strong>')+'.';}
  else{notaT='Año '+fcYrF+' completo. Facturado: <strong style="color:#FFC000">'+mm(totFact)+'</strong> de meta anual <strong>'+mm(pptoTot)+'</strong>. Cumplimiento <strong>'+pctTot.toFixed(1)+'%</strong>.';}
  document.getElementById('fc-vsp-tot-nota').innerHTML=notaT;

  const pctCon=pptoCon>0?(totContr/pptoCon*100):0,gapCon=pptoCon-totContr;
  document.getElementById('fc-vsp-con-fact').textContent=mm(totContr);document.getElementById('fc-vsp-con-ppto').textContent=mm(pptoCon);
  const elPctC=document.getElementById('fc-vsp-con-pct');elPctC.textContent=pctCon.toFixed(1)+'%';elPctC.style.color=pctCon>=90?'#7DC9D6':pctCon>=70?'#FFC000':pctCon>=40?'#FF9966':'#FF6B6B';
  const barC=document.getElementById('fc-vsp-con-bar'),wCon=Math.min(pctCon,100);barC.style.width=wCon.toFixed(1)+'%';barC.textContent=wCon>10?pctCon.toFixed(1)+'%':'';
  document.getElementById('fc-vsp-con-gap').textContent=gapCon>0?'Falta '+mm(gapCon):'Superado +'+mm(-gapCon);
  const pptoConFecha=_pptoYTDContr,pctConFecha=pptoConFecha>0?(totContr/pptoConFecha*100):0,gapConFecha=pptoConFecha-totContr;
  const barC2=document.getElementById('fc-vsp-con-bar2'),wConF=Math.min(pctConFecha,100);barC2.style.width=wConF.toFixed(1)+'%';barC2.textContent=wConF>10?pctConFecha.toFixed(1)+'%':'';
  const gapC2El=document.getElementById('fc-vsp-con-gap2');gapC2El.textContent=gapConFecha>0?'Falta '+mm(gapConFecha):'Adelanto +'+mm(-gapConFecha);gapC2El.style.color=gapConFecha<=0?'#28d2c3':'#FFC000';
  document.getElementById('fc-vsp-con-bar2-info').textContent='Meta contratos ('+periodoDesc+', 50% ppto): '+mm(pptoConFecha);
  let notaC;
  if(isAll){notaC='F. Contratos 2024-2026: <strong style="color:#FFC000">'+mm(totContr)+'</strong> de presupuesto contratos acumulado <strong>'+mm(pptoCon)+'</strong>. Cumplimiento <strong>'+pctCon.toFixed(1)+'%</strong>.';}
  else if(fcYrF==='2026'){const adelanto=totContr-pptoConFecha;notaC='Ppto contratos Ene–'+MES_PPTO_NOMBRE+' (50% de '+mm(pptoFecha)+'): <strong>'+mm(pptoConFecha)+'</strong>. Real: <strong style="color:#FFC000">'+mm(totContr)+'</strong>. '+(adelanto>=0?'<strong style="color:var(--teal)">Adelanto de '+mm(adelanto)+'</strong>':'<strong style="color:var(--rd)">Atraso de '+mm(-adelanto)+'</strong>')+'.';}
  else{notaC='Año '+fcYrF+' completo. F. Contratos: <strong style="color:#FFC000">'+mm(totContr)+'</strong> de meta anual contratos <strong>'+mm(pptoCon)+'</strong>. Cumplimiento <strong>'+pctCon.toFixed(1)+'%</strong>.';}
  document.getElementById('fc-vsp-con-nota').innerHTML=notaC;
}

// ─── GRÁFICOS FACTURACIÓN ANUAL Y MENSUAL ─────────────────────
let _chFcAnual=null,_chFcMensual=null;
function renderFcGraficos(){
  if(typeof Chart==='undefined')return;
  const m=APP_DATA.mensual;
  // Usar datos filtrados (catálogos ST/Trazabilidad/REAS), incluye provisiones
  const mf=m.facturado||m.total;
  const totYr=año=>( mf[String(año)]||[] ).slice(0,MES_CORTE).reduce((s,v)=>s+v,0);
  const totFull=año=>( mf[String(año)]||[] ).reduce((s,v)=>s+v,0);
  let labels,ytdData,fullData;
  if(fcYrF==='todos'){labels=['2024','2025','2026'];ytdData=[totYr(2024),totYr(2025),totYr(2026)];fullData=[totFull(2024)-totYr(2024),totFull(2025)-totYr(2025),0];}
  else{labels=[fcYrF];ytdData=[totYr(parseInt(fcYrF))];fullData=[Math.max(0,totFull(parseInt(fcYrF))-totYr(parseInt(fcYrF)))];}
  const ctxA=document.getElementById('cFcAnual');
  if(ctxA){
    if(_chFcAnual){_chFcAnual.destroy();}
    _chFcAnual=new Chart(ctxA.getContext('2d'),{type:'bar',data:{labels:labels,datasets:[{label:'Ene-'+MES_CORTE_NOMBRE+' (YTD)',data:ytdData.map(v=>v/1e6),backgroundColor:C.te,borderRadius:4,stack:'s'},{label:'Resto año',data:fullData.map(v=>v/1e6),backgroundColor:'rgba(184,191,203,.6)',borderRadius:4,stack:'s'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${c.raw.toFixed(1)}`}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{callback:v=>'MM$'+v}}}}});
  }
  const tit=document.getElementById('fc-anual-tit');if(tit)tit.textContent=fcYrF==='todos'?'Comparativo 2024-2026 (YTD '+MES_CORTE_NOMBRE+')':'Año '+fcYrF;
  const nota=document.getElementById('fc-anual-nota');if(nota){const tots=labels.map((l,i)=>`${l}: YTD MM$${(ytdData[i]/1e6).toFixed(0)}`).join(' · ');const pnota=APP_DATA.periodo_nota||('Ene–'+MES_CORTE_NOMBRE+' '+ANO_ACTUAL);nota.textContent=pnota+' · '+tots+' · Catálogos: ST / REAS / Trazabilidad · Incluye provisiones';}
  let datasetsMes;
  if(fcYrF==='todos'){datasetsMes=[{label:'2024',data:(mf['2024']||[]).map(v=>v/1e6),backgroundColor:'rgba(0,45,115,.6)',borderRadius:3},{label:'2025',data:(mf['2025']||[]).map(v=>v/1e6),backgroundColor:'rgba(255,192,0,.7)',borderRadius:3},{label:'2026',data:(mf['2026']||[]).map(v=>v/1e6),backgroundColor:'rgba(40,210,195,.85)',borderRadius:3}];}
  else{const arr=mf[fcYrF]||[];datasetsMes=[{label:'Real '+fcYrF,data:arr.map(v=>v/1e6),backgroundColor:C.te,borderRadius:3}];if(fcYrF==='2026'){const _pm=APP_DATA.analisis_fac&&APP_DATA.analisis_fac.ppto_mensual&&APP_DATA.analisis_fac.ppto_mensual.some(v=>v>0)?APP_DATA.analisis_fac.ppto_mensual.map(v=>v/2/1e6):m.presup_contr.map(v=>v/1e6);datasetsMes.push({label:'Ppto contratos',data:_pm,type:'line',borderColor:C.te,backgroundColor:'rgba(40,210,195,.1)',borderWidth:2.5,tension:0.3,pointRadius:4,pointBackgroundColor:C.te,fill:false});}}
  const ctxM=document.getElementById('cFcMensual');
  if(ctxM){
    if(_chFcMensual){_chFcMensual.destroy();}
    _chFcMensual=new Chart(ctxM.getContext('2d'),{type:'bar',data:{labels:MESES_ABR,datasets:datasetsMes},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${c.raw.toFixed(1)}`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{callback:v=>'MM$'+v}}}}});
  }
  const titM=document.getElementById('fc-mensual-tit');if(titM)titM.textContent=fcYrF==='todos'?'Comparativo mensual 2024-2026':'Año '+fcYrF+(fcYrF==='2026'?' (vs ppto)':'');
  const notaM=document.getElementById('fc-mensual-nota');
  if(notaM){if(fcYrF==='todos'){notaM.textContent='Facturación Servicio Técnico mes a mes · incluye provisiones · meses sin valor 2026 = pendientes';}else if(fcYrF==='2026'){notaM.textContent='Comparativo facturación real vs presupuesto contratos (línea naranja) · incluye provisiones';}else{notaM.textContent='Facturación Servicio Técnico del año '+fcYrF+' por mes · incluye provisiones';}}
}

// ─── FC-YR HOOK ───────────────────────────────────────────────
(function(){
  const grp=document.getElementById('fc-yr');
  if(grp){grp.addEventListener('click',e=>{setTimeout(()=>{const info=document.getElementById('fc-yr-info');if(info){info.textContent=fcYrF==='todos'?'Visualizando 2024 - 2026 acumulado':'Visualizando '+fcYrLabel();}renderFcGraficos();},50);});}
})();
