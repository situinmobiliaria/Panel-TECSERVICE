// ═══════════════════════════════════════════════════════════════
// hoja_panelfact.js — Panel Facturación Cliente (Real vs Presupuesto)
// Depende de: datos.js (APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let pfTipo='todos';
let pfContr='todos';
let pfSrch='';
let _pfSortCol='real_ytd',_pfSortAsc=false;
function pfSortCol(col){_pfSortAsc=(_pfSortCol===col)?!_pfSortAsc:false;_pfSortCol=col;renderPanelFact();}
let _chPfBar=null,_chPfDist=null;

function pfDataFiltrada(){
  return APP_DATA.panel.filter(p=>{
    if(pfTipo!=='todos'&&p.tipo_cli!==pfTipo)return false;
    if(pfContr==='con'&&!p.tiene_contrato)return false;
    if(pfContr==='sin'&&p.tiene_contrato)return false;
    if(pfSrch&&!p.cliente.toLowerCase().includes(pfSrch.toLowerCase()))return false;
    return true;
  });
}

function renderPanelFact(){
  const data=pfDataFiltrada();
  const realPanel=data.reduce((s,p)=>s+(p.real_ytd||0),0);
  const presup=data.reduce((s,p)=>s+(p.presup_contr_ytd||0),0);
  const presupAnio=data.reduce((s,p)=>s+(p.presup_contr_anio||0),0);
  // Total facturado: usar Analisis Facturación como fuente master
  const _afPF=APP_DATA.analisis_fac||{};
  const real=_afPF.ts_ingresos>0?_afPF.ts_ingresos:realPanel;
  // Ppto a la fecha: suma real Ene–MES_CORTE de GD-PPTO (indexado a Facturación a la Fecha)
  const _pmPF=_afPF.ppto_mensual||[];
  const pptoAreaFecha=_pmPF.some(v=>v>0)
    ? _pmPF.slice(0,MES_CORTE).reduce((s,v)=>s+v,0)
    : TOTAL_PRESUP*MES_CORTE/12;
  const cump=pptoAreaFecha>0?real/pptoAreaFecha*100:0;

  document.getElementById('pf-k-clientes').textContent=data.length;
  document.getElementById('pf-k-real').textContent=fmtMM(real);
  document.getElementById('pf-k-presup').textContent=fmtMM(pptoAreaFecha);
  const cumpE=document.getElementById('pf-k-cump');
  cumpE.textContent=cump.toFixed(1).replace('.',',')+'%';
  cumpE.style.color=cump>=100?'#28d2c3':cump>=90?'#7DC9D6':cump>=70?'#FFC000':'#FF9966';
  document.getElementById('pf-k-anual').textContent=fmtMM(TOTAL_PRESUP);

  const tipoLbl=pfTipo==='todos'?'Todos los clientes':pfTipo;
  document.getElementById('pf-info').textContent=tipoLbl+' · Real Servicio Técnico vs Ppto Contratos · Corte '+MES_CORTE_NOMBRE+' '+ANO_ACTUAL;
  document.getElementById('pf-strip-info').textContent=data.length+' clientes · '+(presup>0?cump.toFixed(0)+'% cumplim.':'sin ppto');

  const top15=[...data].filter(p=>(p.presup_contr_ytd||0)>0||(p.real_ytd||0)>0)
    .sort((a,b)=>((b.presup_contr_ytd||0)+(b.real_ytd||0))-((a.presup_contr_ytd||0)+(a.real_ytd||0)))
    .slice(0,15);
  const labels15=top15.map(p=>p.cliente.length>30?p.cliente.slice(0,28)+'…':p.cliente);
  const realData15=top15.map(p=>(p.real_ytd||0)/1e6);
  const pres15=top15.map(p=>(p.presup_contr_ytd||0)/1e6);
  const ctxB=document.getElementById('cPfBar');
  if(ctxB){
    if(_chPfBar){_chPfBar.destroy();}
    _chPfBar=safeChart(ctxB.getContext('2d'),{
      type:'bar',
      data:{labels:labels15,datasets:[{label:'Real Servicio Técnico YTD',data:realData15,backgroundColor:C.te},{label:'Ppto Contratos YTD',data:pres15,backgroundColor:'#FFC000'}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${fN1(c.raw)}`}}},scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{callback:v=>'MM$'+fN0(v)}},y:{grid:{display:false},ticks:{font:{size:9}}}}}
    });
  }

  const buckets={'0-25%':0,'25-50%':0,'50-75%':0,'75-100%':0,'>100%':0,'Sin ppto':0};
  data.forEach(p=>{
    if((p.presup_contr_ytd||0)<=0){buckets['Sin ppto']++;return;}
    const pct=(p.real_ytd||0)/p.presup_contr_ytd*100;
    if(pct<25)buckets['0-25%']++;
    else if(pct<50)buckets['25-50%']++;
    else if(pct<75)buckets['50-75%']++;
    else if(pct<=100)buckets['75-100%']++;
    else buckets['>100%']++;
  });
  const ctxD=document.getElementById('cPfDist');
  if(ctxD){
    if(_chPfDist){_chPfDist.destroy();}
    _chPfDist=safeChart(ctxD.getContext('2d'),{
      type:'bar',
      data:{labels:Object.keys(buckets),datasets:[{label:'N° clientes',data:Object.values(buckets),backgroundColor:['#FF6B6B','#FF9966','#FFC000','#7DC9D6',C.te,C.mut],borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw} clientes`}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{stepSize:5}}}}
    });
  }

  const tb=document.getElementById('tb-pf');
  if(tb){
    const _PROG_ORD={BASIC:0,ADVANCED:1,PROFESIONAL:2,INTEGRAL:3};
    const progByClient={};
    DATA.forEach(d=>{const k=_progKey(d.programa||'');if(!k)return;const prev=progByClient[d.cliente];if(!prev||(_PROG_ORD[k]||0)>(_PROG_ORD[prev]||0))progByClient[d.cliente]=k;});
    const sorted=[...data].sort((a,b)=>{
      let va,vb;
      if(_pfSortCol==='pct'){va=(a.presup_contr_ytd||0)>0?(a.real_ytd||0)/a.presup_contr_ytd:0;vb=(b.presup_contr_ytd||0)>0?(b.real_ytd||0)/b.presup_contr_ytd:0;}
      else if(_pfSortCol==='cliente'){va=(a.cliente||'').toLowerCase();vb=(b.cliente||'').toLowerCase();return _pfSortAsc?va.localeCompare(vb,'es'):vb.localeCompare(va,'es');}
      else{va=a[_pfSortCol]||0;vb=b[_pfSortCol]||0;}
      return _pfSortAsc?va-vb:vb-va;
    });
    document.querySelectorAll('.ppto-detail-table th[data-pf]').forEach(th=>{th.classList.remove('th-asc','th-desc');if(th.dataset.pf===_pfSortCol)th.classList.add(_pfSortAsc?'th-asc':'th-desc');});
    tb.innerHTML=sorted.map((p,i)=>{
      const pct=(p.presup_contr_ytd||0)>0?(p.real_ytd||0)/p.presup_contr_ytd*100:0;
      const cls=pct>=90?'pg':pct>=70?'py':pct>=40?'por':pct>0?'pd':'pgr';
      const tipoBg=p.tipo_cli==='Público'?'pb':p.tipo_cli==='Privado'?'por':'pgr';
      const cumpTxt=(p.presup_contr_ytd||0)>0?pct.toFixed(0)+'%':'Sin ppto';
      return`<tr>
        <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.cliente}"><strong>${p.cliente}</strong></td>
        <td style="font-size:.62rem;color:var(--mut)">${p.coord||'—'}</td>
        <td><span class="pill ${tipoBg}">${p.tipo_cli==='Público'?'PÚB':p.tipo_cli==='Privado'?'PRIV':'N/D'}</span></td>
        <td style="text-align:center"><span class="pill ${p.tiene_contrato?'pg':'pgr'}" style="font-size:.55rem">${p.tiene_contrato?'CON':'SIN'}</span></td>
        <td class="num" style="text-align:right">${fmtMM(p.real_ytd||0)}</td>
        <td class="num" style="text-align:right;color:var(--mut)">${fmtMM(p.presup_contr_ytd||0)}</td>
        <td style="text-align:right"><span class="pill ${cls}">${cumpTxt}</span></td>
        <td class="num" style="text-align:right;font-size:.62rem;color:var(--mut)">${fmtMM(p.presup_contr_anio||0)}</td>
        <td style="text-align:center">${_progBadge(progByClient[p.cliente]||'')}</td>
      </tr>`;
    }).join('');
  }
  const ft=document.getElementById('pf-ft');
  if(ft)ft.textContent=data.length+' clientes mostrados · Real Serv. Téc.: '+fmtMM(real)+' · Ppto Contratos YTD: '+fmtMM(presup)+' · Cumplim. '+cump.toFixed(1).replace('.',',')+'%';
}

function initPanelFact(){
  document.querySelectorAll('#pf-tipo .btn').forEach(b=>{
    b.addEventListener('click',()=>{document.querySelectorAll('#pf-tipo .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');pfTipo=b.dataset.pft;renderPanelFact();});
  });
  document.querySelectorAll('#pf-contr .btn').forEach(b=>{
    b.addEventListener('click',()=>{document.querySelectorAll('#pf-contr .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');pfContr=b.dataset.pfc;renderPanelFact();});
  });
  const s=document.getElementById('pf-srch');
  if(s)s.addEventListener('input',e=>{pfSrch=e.target.value;renderPanelFact();});
  renderPanelFact();
}
