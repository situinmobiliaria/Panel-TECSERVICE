// ═══════════════════════════════════════════════════════════════
// hoja_visitas.js — Visitas Ejecutivos
// Depende de: datos.js (APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let _chVisMes=null,_chVisTipo=null,_chVisAnual=null,_chVisTopEg=null,_chVisTopCr=null;
let visFiltEje='ambos';
let visCliEje='ambos';
let _chVisCliBar=null,_chVisCliMensual=null;
let _chVisBusca=null;

function initVisitas(){
  const v=APP_DATA.visitas;
  // Ejecutivos derivados dinámicamente de los datos
  const _ejes=Object.keys(v.resumen||{});
  const _ejeA=_ejes[0]||'';const _ejeB=_ejes[1]||'';
  const _rngLbl='Ene-'+MES_CORTE_NOMBRE;
  ['vis-eg-26-lbl','vis-cr-26-lbl'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=ANO_ACTUAL+' ('+_rngLbl+')';});
  ['vis-eg-25-lbl','vis-cr-25-lbl'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=(ANO_ACTUAL-1)+' ('+_rngLbl+')';});
  const _tit=document.getElementById('vis-anual-tit');if(_tit)_tit.textContent='Total Visitas '+(ANO_ACTUAL-1)+' vs '+ANO_ACTUAL+' ('+_rngLbl+')';
  const _climes=document.getElementById('vis-cli-mes-lbl');if(_climes)_climes.textContent='📅 Visitas Mensuales '+ANO_ACTUAL+' · '+_rngLbl;

  const re=v.resumen[_ejeA]||{};
  document.getElementById('vis-eg-tot').textContent=re.total||0;
  document.getElementById('vis-eg-26').textContent=re.tot_2026_ytd||0;
  document.getElementById('vis-eg-25').textContent=re.tot_2025_ytd_mismo||0;
  document.getElementById('vis-eg-cli').textContent=re.clientes_unicos_2026||0;
  const varEg=(re.tot_2025_ytd_mismo||0)>0?(((re.tot_2026_ytd||0)-(re.tot_2025_ytd_mismo||0))/(re.tot_2025_ytd_mismo||0)*100):0;
  document.getElementById('vis-eg-comp').innerHTML=`Productividad Ene-${MES_CORTE_NOMBRE}: <strong>${re.tot_2026_ytd||0}</strong> visitas en ${ANO_ACTUAL} vs <strong>${re.tot_2025_ytd_mismo||0}</strong> en ${ANO_ACTUAL-1} · <strong style="color:${varEg>=0?'#7DC9D6':'#FFC000'}">${varEg>=0?'+':''}${varEg.toFixed(0)}%</strong>`;

  const rc=v.resumen[_ejeB]||{};
  document.getElementById('vis-cr-tot').textContent=rc.total||0;
  document.getElementById('vis-cr-26').textContent=rc.tot_2026_ytd||0;
  document.getElementById('vis-cr-25').textContent=rc.tot_2025_ytd_mismo||0;
  document.getElementById('vis-cr-cli').textContent=rc.clientes_unicos_2026||0;
  const varCr=(rc.tot_2025_ytd_mismo||0)>0?(((rc.tot_2026_ytd||0)-(rc.tot_2025_ytd_mismo||0))/(rc.tot_2025_ytd_mismo||0)*100):0;
  document.getElementById('vis-cr-comp').innerHTML=`Productividad Ene-${MES_CORTE_NOMBRE}: <strong>${rc.tot_2026_ytd||0}</strong> visitas en ${ANO_ACTUAL} vs <strong>${rc.tot_2025_ytd_mismo||0}</strong> en ${ANO_ACTUAL-1} · <strong style="color:${varCr>=0?'#7DC9D6':'#FFC000'}">${varCr>=0?'+':''}${varCr.toFixed(0)}%</strong>`;

  const mesesVis=MESES_ABR.slice(0,MES_CORTE);
  const egVisitas=((v.mensual[_ejeA]||{})['2026']||[]).slice(0,MES_CORTE);
  const crVisitas=((v.mensual[_ejeB]||{})['2026']||[]).slice(0,MES_CORTE);
  const egCliU=re.clientes_unicos_2026||1,crCliU=rc.clientes_unicos_2026||1;
  const egCob=egVisitas.map(n=>parseFloat((n/egCliU*100).toFixed(1)));
  const crCob=crVisitas.map(n=>parseFloat((n/crCliU*100).toFixed(1)));
  const ctxVM=document.getElementById('cVisExecMes');
  if(ctxVM){
    if(_chVisMes){_chVisMes.destroy();}
    const cb=document.getElementById('vis-exec-mes-cb');
    ctxVM.width=cb?Math.max(400,cb.clientWidth-32):800;ctxVM.height=260;
    _chVisMes=safeChart(ctxVM.getContext('2d'),{
      type:'bar',
      data:{labels:mesesVis,datasets:[
        {label:'Eglys – Visitas',data:egVisitas,backgroundColor:'rgba(122,31,170,.75)',borderRadius:5,yAxisID:'y',order:2},
        {label:'Cristián – Visitas',data:crVisitas,backgroundColor:'rgba(0,63,127,.75)',borderRadius:5,yAxisID:'y',order:2},
        {label:'Eglys – Cobertura %',data:egCob,type:'line',borderColor:'#9B59B6',backgroundColor:'rgba(155,89,182,.1)',pointBackgroundColor:'#9B59B6',tension:.3,pointRadius:5,borderWidth:2.5,yAxisID:'y1',order:1},
        {label:'Cristián – Cobertura %',data:crCob,type:'line',borderColor:'#5BAEDC',backgroundColor:'rgba(91,174,220,.1)',pointBackgroundColor:'#5BAEDC',tension:.3,pointRadius:5,borderWidth:2.5,yAxisID:'y1',order:1}
      ]},
      options:{responsive:false,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}},tooltip:{mode:'index',callbacks:{label:ctx=>{if(ctx.dataset.yAxisID==='y1')return' '+ctx.dataset.label+': '+ctx.parsed.y+'%';return' '+ctx.dataset.label+': '+ctx.parsed.y+' visitas';}}}},scales:{x:{grid:{display:false}},y:{type:'linear',position:'left',beginAtZero:true,title:{display:true,text:'N° Visitas',font:{size:9},color:'#6B7BA8'},grid:{color:'#E2E6F0'},ticks:{stepSize:5}},y1:{type:'linear',position:'right',beginAtZero:true,max:100,title:{display:true,text:'Cobertura %',font:{size:9},color:'#6B7BA8'},grid:{drawOnChartArea:false},ticks:{callback:v=>v+'%'}}}}
    });
  }

  const _EJEC_PALETTE=['#7A1FAA','#003F7F','#28D2C3','#FFC000'];
  const tEg=v.tipo[_ejeA]||{},tCr=v.tipo[_ejeB]||{};
  const tipos=[...new Set([...Object.keys(tEg),...Object.keys(tCr)])];
  const ctxT=document.getElementById('cVisTipo');
  if(ctxT){
    if(_chVisTipo){_chVisTipo.destroy();}
    _chVisTipo=safeChart(ctxT.getContext('2d'),{
      type:'bar',
      data:{labels:tipos,datasets:[
        {label:_ejeA.split(' ')[0],data:tipos.map(t=>tEg[t]||0),backgroundColor:_EJEC_PALETTE[0],borderRadius:5},
        {label:_ejeB.split(' ')[0],data:tipos.map(t=>tCr[t]||0),backgroundColor:_EJEC_PALETTE[1],borderRadius:5}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#E2E6F0'}}}}
    });
  }

  const ctxA=document.getElementById('cVisAnual');
  if(ctxA){
    if(_chVisAnual){_chVisAnual.destroy();}
    _chVisAnual=safeChart(ctxA.getContext('2d'),{
      type:'bar',
      data:{labels:_ejes.map(e=>e.split(' ')[0]),datasets:[
        {label:(ANO_ACTUAL-1)+' (Ene-'+MES_CORTE_NOMBRE+')',data:_ejes.map(e=>(v.resumen[e]||{}).tot_2025_ytd_mismo||0),backgroundColor:'#B8C1D8',borderRadius:5},
        {label:ANO_ACTUAL+' (Ene-'+MES_CORTE_NOMBRE+')',data:_ejes.map(e=>(v.resumen[e]||{}).tot_2026_ytd||0),backgroundColor:'#FFC000',borderRadius:5}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,grid:{color:'#E2E6F0'}}}}
    });
  }

  function topChart(canvasId,persona,color){
    const ctx=document.getElementById(canvasId);if(!ctx)return null;
    const top=(v.top[persona]||[]).slice(0,12);
    return safeChart(ctx.getContext('2d'),{
      type:'bar',
      data:{labels:top.map(t=>t.cliente.length>32?t.cliente.slice(0,30)+'…':t.cliente),datasets:[{label:'Visitas',data:top.map(t=>t.n),backgroundColor:color,borderRadius:4}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'}},y:{grid:{display:false},ticks:{font:{size:9}}}}}
    });
  }
  if(_chVisTopEg){_chVisTopEg.destroy();}
  _chVisTopEg=topChart('cVisTopEg',_ejeA,_EJEC_PALETTE[0]);
  if(_chVisTopCr){_chVisTopCr.destroy();}
  _chVisTopCr=topChart('cVisTopCr',_ejeB,_EJEC_PALETTE[1]);

  renderVisClienteChart('');
  renderVisTabla();
  vxInit();

  document.querySelectorAll('#vis-filt-eje .btn').forEach(b=>{
    b.addEventListener('click',()=>{document.querySelectorAll('#vis-filt-eje .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');visFiltEje=b.dataset.vfe;renderVisTabla();});
  });
}

function renderVisCliMensual(ejeKey,clienteLabel){
  const v=APP_DATA.visitas;
  const meses=MESES_ABR.slice(0,MES_CORTE);
  let datasets=[];
  if(!ejeKey||ejeKey==='ambos'){
    datasets=[{label:'Eglys',data:v.mensual['Eglys Ramirez']['2026'].slice(0,MES_CORTE),backgroundColor:'#9B59B6',borderRadius:4},{label:'Cristián',data:v.mensual['Cristian Perez']['2026'].slice(0,MES_CORTE),backgroundColor:'#003F7F',borderRadius:4}];
  } else {
    const col=ejeKey==='Eglys Ramirez'?'#9B59B6':'#003F7F';
    const lbl=ejeKey==='Eglys Ramirez'?'Eglys':'Cristián';
    datasets=[{label:lbl,data:v.mensual[ejeKey]['2026'].slice(0,MES_CORTE),backgroundColor:col,borderRadius:4}];
  }
  const titleEl=document.getElementById('vis-cli-mes-title');
  if(titleEl){if(clienteLabel)titleEl.textContent='Ejecutivo de "'+clienteLabel.slice(0,28)+'"';else titleEl.textContent=ejeKey&&ejeKey!=='ambos'?(ejeKey==='Eglys Ramirez'?'Solo Eglys Ramírez':'Solo Cristián Pérez'):'Ambos ejecutivos';}
  const ctx=document.getElementById('cVisCliMensual');
  if(!ctx)return;
  if(_chVisCliMensual)_chVisCliMensual.destroy();
  ctx.width=ctx.parentElement?ctx.parentElement.clientWidth-32:700;ctx.height=150;
  _chVisCliMensual=safeChart(ctx.getContext('2d'),{
    type:'bar',data:{labels:meses,datasets},
    options:{responsive:false,maintainAspectRatio:false,plugins:{legend:{display:datasets.length>1,position:'top',labels:{boxWidth:9,font:{size:9},padding:6}},tooltip:{callbacks:{label:c=>' '+c.parsed.y+' visitas'}}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{stepSize:5,font:{size:9}}}}}
  });
}

function renderVisClienteChart(busqueda){
  const v=APP_DATA.visitas;
  busqueda=(busqueda||'').toLowerCase().trim();
  const mapa={};
  ['Eglys Ramirez','Cristian Perez'].forEach(eje=>{
    if(visCliEje!=='ambos'&&visCliEje!==eje)return;
    (v.top[eje]||[]).forEach(t=>{
      const k=t.cliente;
      if(!mapa[k])mapa[k]={cliente:k,n:0,ejes:[]};
      mapa[k].n+=t.n;
      if(!mapa[k].ejes.includes(eje))mapa[k].ejes.push(eje);
    });
  });
  let arr=Object.values(mapa).filter(x=>!busqueda||x.cliente.toLowerCase().includes(busqueda));
  arr.sort((a,b)=>b.n-a.n);
  const top=arr.slice(0,10);
  const totV=top.reduce((s,x)=>s+x.n,0);
  const kTot=document.getElementById('vis-cli-tot');if(kTot)kTot.textContent=totV;
  const kCount=document.getElementById('vis-cli-count');if(kCount)kCount.textContent=top.length;
  const ejeTxt=document.getElementById('vis-cli-eje-txt');if(ejeTxt)ejeTxt.textContent=visCliEje==='ambos'?'Ambos':visCliEje==='Eglys Ramirez'?'Eglys Ramírez':'Cristián Pérez';
  ['vis-cli-btn-ambos','vis-cli-btn-eg','vis-cli-btn-cr'].forEach(id=>{const b=document.getElementById(id);if(b)b.classList.remove('on');});
  const actBtn=visCliEje==='ambos'?'vis-cli-btn-ambos':visCliEje==='Eglys Ramirez'?'vis-cli-btn-eg':'vis-cli-btn-cr';
  const ab=document.getElementById(actBtn);if(ab)ab.classList.add('on');
  const nota=document.getElementById('vis-cli-nota');if(nota)nota.textContent=(busqueda?'Filtro: "'+busqueda+'" · ':'')+top.length+' cliente(s) mostrado(s) · Total '+totV+' visitas · Fuente: histórico 2025-2026';
  const colors=top.map(x=>{if(x.ejes.length===2)return'#8B5CF6';if(x.ejes[0]==='Eglys Ramirez')return'#7A1FAA';return'#003F7F';});
  const ctx=document.getElementById('cVisCliBar');if(!ctx)return;
  if(_chVisCliBar)_chVisCliBar.destroy();
  _chVisCliBar=safeChart(ctx.getContext('2d'),{
    type:'bar',
    data:{labels:top.map(x=>x.cliente.length>40?x.cliente.slice(0,38)+'…':x.cliente),datasets:[{label:'Visitas totales',data:top.map(x=>x.n),backgroundColor:colors,borderRadius:5}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.parsed.x+' visitas'}}},scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{stepSize:1}},y:{grid:{display:false},ticks:{font:{size:10}}}}}
  });
  let ejeParaMensual=visCliEje==='ambos'?null:visCliEje,cliLabel=null;
  if(busqueda&&top.length>0){
    const primerCliente=top[0].cliente;
    for(const eje of['Eglys Ramirez','Cristian Perez']){if((APP_DATA.visitas.top[eje]||[]).some(t=>t.cliente===primerCliente)){ejeParaMensual=eje;break;}}
    cliLabel=primerCliente;
  }
  renderVisCliMensual(ejeParaMensual,cliLabel);
}

function renderVisTabla(){
  const v=APP_DATA.visitas;
  const tb=document.getElementById('tb-vis');if(!tb)return;
  let combinado=[];
  if(visFiltEje==='ambos'||visFiltEje==='Eglys Ramirez')v.top['Eglys Ramirez'].forEach(t=>combinado.push({...t,eje:'Eglys Ramírez'}));
  if(visFiltEje==='ambos'||visFiltEje==='Cristian Perez')v.top['Cristian Perez'].forEach(t=>combinado.push({...t,eje:'Cristián Pérez'}));
  combinado.sort((a,b)=>b.n-a.n);
  tb.innerHTML=combinado.map((t,i)=>`<tr>
    <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
    <td><strong>${t.cliente}</strong></td>
    <td><span class="pill ${t.eje==='Eglys Ramírez'?'pmo':'pb'}" style="${t.eje==='Eglys Ramírez'?'background:#E2D1F3;color:#7A1FAA':''}">${t.eje}</span></td>
    <td style="text-align:center;font-family:'Roboto Mono',monospace;font-weight:700;font-size:.85rem">${t.n}</td>
  </tr>`).join('');
}

function renderVisBuscaCliente(busqueda){
  busqueda=(busqueda||'').toLowerCase().trim();
  const canvas=document.getElementById('cVisBuscaCliente');
  const empty=document.getElementById('vis-bc-empty');
  if(!canvas)return;
  if(!busqueda){
    canvas.style.display='none';
    if(empty){empty.style.display='block';empty.innerHTML='Ingresa el nombre de un cliente para ver<br>las visitas realizadas mes a mes en 2025–2026';}
    if(_chVisBusca){_chVisBusca.destroy();_chVisBusca=null;}
    return;
  }
  const v=APP_DATA.visitas;
  const cli_mes=v.cli_mensual||{};
  const EJEC=[['Eglys Ramirez','eg','#7A1FAA','Eglys Ramírez'],['Cristian Perez','cr','#003F7F','Cristián Pérez']];

  // Buscar clientes que coincidan (usando cli_mensual para tener todos, no solo top 10)
  const clientesEncontrados=new Set();
  EJEC.forEach(([eje])=>{
    Object.keys(cli_mes[eje]||{}).forEach(cli=>{
      if(cli.toLowerCase().includes(busqueda)) clientesEncontrados.add(cli);
    });
    // también buscar en top si cli_mensual no existe
    (v.top[eje]||[]).forEach(t=>{if(t.cliente.toLowerCase().includes(busqueda))clientesEncontrados.add(t.cliente);});
  });
  const arr=[...clientesEncontrados].sort();

  if(arr.length===0){
    canvas.style.display='none';
    if(empty){empty.style.display='block';empty.innerHTML='Sin resultados para "<strong>'+busqueda+'</strong>"';}
    if(_chVisBusca){_chVisBusca.destroy();_chVisBusca=null;}
    return;
  }

  canvas.style.display='block';
  if(empty)empty.style.display='none';

  // Si hay exactamente 1 cliente (búsqueda específica): gráfico mensual
  if(arr.length===1){
    const cli=arr[0];
    const ANOS=[String(ANO_ACTUAL-1),String(ANO_ACTUAL)];
    const MESES_LABELS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    // Determinar rango de meses con alguna visita (cualquier ejecutivo)
    let primerMes=null,ultimoMes=null;
    EJEC.forEach(([eje])=>{
      ANOS.forEach(ano=>{
        const datos=(cli_mes[eje]&&cli_mes[eje][cli]&&cli_mes[eje][cli][ano])||[];
        datos.forEach((n,m)=>{
          if(n>0){
            const idx=parseInt(ano)*12+m;
            if(primerMes===null||idx<primerMes)primerMes=idx;
            if(ultimoMes===null||idx>ultimoMes)ultimoMes=idx;
          }
        });
      });
    });

    if(primerMes===null){
      // Sin datos mensuales → mostrar total
      primerMes=(ANO_ACTUAL-1)*12;ultimoMes=ANO_ACTUAL*12+11;
    }

    // Construir labels y datasets
    const labels=[];
    const dataEg=[],dataCr=[];
    for(let idx=primerMes;idx<=ultimoMes;idx++){
      const ano=Math.floor(idx/12),mes=idx%12;
      labels.push(MESES_LABELS[mes]+" '"+(String(ano).slice(2)));
      const mesEg=(cli_mes['Eglys Ramirez']&&cli_mes['Eglys Ramirez'][cli]&&cli_mes['Eglys Ramirez'][cli][String(ano)])||[];
      const mesCr=(cli_mes['Cristian Perez']&&cli_mes['Cristian Perez'][cli]&&cli_mes['Cristian Perez'][cli][String(ano)])||[];
      dataEg.push(mesEg[mes]||0);
      dataCr.push(mesCr[mes]||0);
    }
    const totalVisitas=dataEg.reduce((s,v)=>s+v,0)+dataCr.reduce((s,v)=>s+v,0);
    const nota=document.getElementById('vis-bc-nota');
    if(nota)nota.textContent=cli+' · '+totalVisitas+' visitas totales · '+labels.length+' meses con registro';
    canvas.height=260;
    canvas.width=canvas.parentElement?canvas.parentElement.clientWidth||700:700;
    if(_chVisBusca)_chVisBusca.destroy();
    _chVisBusca=safeChart(canvas.getContext('2d'),{
      type:'bar',
      data:{labels,datasets:[
        {label:'Eglys Ramírez',data:dataEg,backgroundColor:'#7A1FAA',borderRadius:4,stack:'s'},
        {label:'Cristián Pérez',data:dataCr,backgroundColor:'#003F7F',borderRadius:4,stack:'s'}
      ]},
      options:{responsive:false,maintainAspectRatio:false,
        plugins:{legend:{position:'top',labels:{boxWidth:9,font:{size:10},padding:6}},
          tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+c.parsed.y+' visitas',
            footer:items=>' Total mes: '+items.reduce((s,i)=>s+i.parsed.y,0)}}},
        scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:9}}},
          y:{stacked:true,beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{stepSize:1,font:{size:9}}}}}
    });
  } else {
    // Múltiples clientes: mostrar totales por cliente (barra horizontal)
    const mapa={};
    EJEC.forEach(([eje,k])=>{
      arr.slice(0,12).forEach(cli=>{
        const datos=cli_mes[eje]&&cli_mes[eje][cli];
        if(!mapa[cli])mapa[cli]={eg:0,cr:0};
        if(datos){Object.values(datos).forEach(mArr=>mArr.forEach((n,m)=>{mapa[cli][k]+=n;}));}
        else{(v.top[eje]||[]).filter(t=>t.cliente===cli).forEach(t=>mapa[cli][k]+=t.n);}
      });
    });
    const arrT=arr.slice(0,12).map(cli=>({cliente:cli,...mapa[cli],total:(mapa[cli]||{eg:0,cr:0}).eg+(mapa[cli]||{eg:0,cr:0}).cr})).sort((a,b)=>b.total-a.total);
    const nota=document.getElementById('vis-bc-nota');
    if(nota)nota.textContent=arrT.length+' cliente(s) · Total '+arrT.reduce((s,x)=>s+x.total,0)+' visitas · Afina la búsqueda para ver detalle mensual';
    canvas.height=Math.max(200,arrT.length*38+60);
    canvas.width=canvas.parentElement?canvas.parentElement.clientWidth||700:700;
    if(_chVisBusca)_chVisBusca.destroy();
    _chVisBusca=safeChart(canvas.getContext('2d'),{
      type:'bar',
      data:{labels:arrT.map(x=>x.cliente.length>40?x.cliente.slice(0,38)+'…':x.cliente),
        datasets:[{label:'Eglys Ramírez',data:arrT.map(x=>x.eg),backgroundColor:'#7A1FAA',borderRadius:4},
                  {label:'Cristián Pérez',data:arrT.map(x=>x.cr),backgroundColor:'#003F7F',borderRadius:4}]},
      options:{indexAxis:'y',responsive:false,maintainAspectRatio:false,
        plugins:{legend:{position:'top',labels:{boxWidth:9,font:{size:10},padding:6}},
          tooltip:{callbacks:{label:c=>' '+c.dataset.label+': '+c.parsed.x+' visitas'}}},
        scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{stepSize:1,font:{size:9}}},
          y:{grid:{display:false},ticks:{font:{size:9}}}}}
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// COBERTURA COMERCIAL — filtros, mapa, regiones y evolución
//
// Todo lo de esta sección sale de APP_DATA.visitas.det, una fila por
// (ejecutivo, cliente, tipo de actividad, año, mes). Tenerlo al detalle es lo
// que permite que los filtros se crucen entre sí: con los totales ya agregados
// sólo se podía filtrar por una dimensión a la vez.
//
// La hoja VISITAS no dice dónde queda el cliente ni cuánto factura. La región
// y las coordenadas se cruzan con «Mapa Clientes Actuales», con BASE INSTALADA
// y con la ubicación que ya resolvió el Plan RM; la facturación, con el panel
// de facturación. El calce de nombres es el mismo del resto del panel: exacto
// y, si no hay, una única coincidencia parcial —con dos candidatos no se
// asigna ninguno, para no atribuirle las visitas al hospital equivocado.
// ═══════════════════════════════════════════════════════════════
const VX = {
  COL: { 'Eglys Ramirez': '#7A1FAA', 'Cristian Perez': '#003F7F', ambos: '#28D2C3' },
  NOM: { 'Eglys Ramirez': 'Eglys Ramírez', 'Cristian Perez': 'Cristián Pérez' },
  f: { eje: 'todos', tipo: 'todos', per: String(typeof ANO_ACTUAL !== 'undefined' ? ANO_ACTUAL : 2026), reg: 'todas', q: '' },
  sel: null,          // cliente seleccionado en el mapa o la tabla
  sort: 'v',          // columna de orden de la tabla de clientes
  asc: false,
  base: null,         // índice cliente → región, coordenadas, facturación
  sinVisita: [],      // clientes del panel de facturación sin ninguna visita
  facPanel: 0, contrPanel: 0,
  map: null, lyr: null, marks: {},
  chReg: null, chEvo: null, chCli: null, chDisp: null,
};

const vxNorm = s => s ? String(s).trim().toUpperCase().replace(/\s+/g, ' ')
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
const vxEsc  = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const vxMM   = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const vxN1   = v => (v || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const vxN0   = v => Math.round(v || 0).toLocaleString('es-CL');

// Las fuentes escriben algunas regiones distinto —«Magallanes» y «Magallanes y
// la Antártica Chilena» son la misma—: sin unificarlas salen dos filas.
const VX_REG = [['ARICA', 'Arica y Parinacota'], ['TARAPACA', 'Tarapacá'], ['ANTOFAGASTA', 'Antofagasta'],
  ['ATACAMA', 'Atacama'], ['COQUIMBO', 'Coquimbo'], ['VALPARAISO', 'Valparaíso'], ['METROPOLITANA', 'Metropolitana'],
  ['HIGGINS', "O'Higgins"], ['MAULE', 'Maule'], ['NUBLE', 'Ñuble'], ['BIO', 'Bío Bío'], ['ARAUCANIA', 'Araucanía'],
  ['LOS RIOS', 'Los Ríos'], ['LOS LAGOS', 'Los Lagos'], ['AYSEN', 'Aysén'], ['MAGALLANES', 'Magallanes']];
function vxRegNom(r) {
  const k = vxNorm(r);
  if (!k) return 'Sin región';
  const h = VX_REG.find(x => k.indexOf(x[0]) >= 0);
  return h ? h[1] : r;
}
// Orden geográfico, de norte a sur: una tabla de regiones ordenada así se lee
// como el mapa. «Sin región» va al final porque no es un lugar.
function vxRegOrden(r) {
  const i = VX_REG.findIndex(x => x[1] === r);
  return i < 0 ? 99 : i;
}

// ── CRUCE DE NOMBRES ─────────────────────────────────────────
// Las cuatro fuentes escriben al mismo cliente de formas distintas: «Hospital
// Base Osorno» y «Hospital Base de Osorno», «Municipalidad de Independencia» e
// «I.Municipalidad de Independencia». El cruce compara las palabras del nombre
// y no el texto: se sacan tildes, puntuación, conectores y la razón social
// (SpA, Ltda, S.A.), y se comparan los conjuntos de palabras que quedan.
//
// El tipo de institución NO se saca: «Municipalidad de Puerto Montt» y
// «Hospital de Puerto Montt» son clientes distintos, y una regla que sólo
// mirara la ciudad los fundiría. Por lo mismo no se aceptan coincidencias
// parciales sueltas —«Hospital San José» calza con cuatro hospitales— y un
// nombre que calce con dos candidatos no se asigna a ninguno.
const VX_RAZON = new Set(['SPA', 'LTDA', 'LIMITADA', 'EIRL', 'CIA', 'COMPANIA', 'SA', 'SAC',
  'DR', 'DRA', 'DOCTOR', 'DOCTORA', 'ILUSTRE', 'ILUSTRA']);
const VX_CONECT = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'AL', 'EN']);

function vxClave(nombre) {
  const t = vxNorm(nombre).replace(/[^A-Z0-9Ñ ]+/g, ' ').split(/\s+/)
    .filter(w => w.length > 1 && !VX_CONECT.has(w) && !VX_RAZON.has(w));
  return t.length ? Array.from(new Set(t)).sort().join(' ') : vxNorm(nombre);
}

// Equivalencias revisadas a mano, para lo que ninguna regla puede saber: la
// misma institución escrita con otro nombre en otra hoja (24-09-2026).
const VX_ALIAS = {
  'SERVICIO DE SALUD ORIENTE HOSPITAL DEL SALVADOR': 'HOSPITAL DEL SALVADOR',
  'CLINICA INDISA': 'INSTITUTO DE DIAGNOSTICO S.A. / CLINICA INDISA',
  'CENTRO OFTAMOLOGICO LASER CEOLA ANTOFAGASTA S.A.': 'CENTRO OFTALMOLOGICO LASER CEOLA ANTOFAGASTA',
  'HOSPITAL REGIONAL DE COPIAPO': 'HOSPITAL DE COPIAPO',
  'S. SALUD METROPOLITANO SUR ORIENTE': 'SERVICIO DE SALUD METROPOLITANO SUR ORIENTE',
  'CENTRAL ODONTOLOGICA FACH': 'CENTRAL ODONTOLOGICA DE LA FUERZA AEREA',
};
function vxAlias(nombre) {
  const k = vxNorm(nombre);
  return VX_ALIAS[k] ? vxClave(VX_ALIAS[k]) : vxClave(nombre);
}

// Ciudades que aparecen en el nombre del cliente y dicen en qué región está.
// Es el último recurso, cuando el cliente no está en ninguna otra fuente.
const VX_CIUDAD = [
  ['ARICA', 'Arica y Parinacota'], ['IQUIQUE', 'Tarapacá'], ['ALTO HOSPICIO', 'Tarapacá'],
  ['ANTOFAGASTA', 'Antofagasta'], ['CALAMA', 'Antofagasta'], ['TOCOPILLA', 'Antofagasta'],
  ['COPIAPO', 'Atacama'], ['VALLENAR', 'Atacama'], ['CHANARAL', 'Atacama'],
  ['SERENA', 'Coquimbo'], ['COQUIMBO', 'Coquimbo'], ['OVALLE', 'Coquimbo'], ['ILLAPEL', 'Coquimbo'],
  ['VALPARAISO', 'Valparaíso'], ['VINA DEL MAR', 'Valparaíso'], ['QUILLOTA', 'Valparaíso'],
  ['SAN ANTONIO', 'Valparaíso'], ['QUILPUE', 'Valparaíso'], ['LOS ANDES', 'Valparaíso'],
  ['RANCAGUA', "O'Higgins"], ['SAN FERNANDO', "O'Higgins"], ['SANTA CRUZ', "O'Higgins"],
  ['TALCA', 'Maule'], ['CURICO', 'Maule'], ['LINARES', 'Maule'], ['PARRAL', 'Maule'], ['CAUQUENES', 'Maule'],
  ['CHILLAN', 'Ñuble'], ['CONCEPCION', 'Bío Bío'], ['TALCAHUANO', 'Bío Bío'], ['LOS ANGELES', 'Bío Bío'],
  ['CORONEL', 'Bío Bío'], ['LOTA', 'Bío Bío'], ['CANETE', 'Bío Bío'],
  ['TEMUCO', 'Araucanía'], ['VILLARRICA', 'Araucanía'], ['ANGOL', 'Araucanía'], ['LONCOCHE', 'Araucanía'],
  ['VALDIVIA', 'Los Ríos'], ['OSORNO', 'Los Lagos'], ['PUERTO MONTT', 'Los Lagos'],
  ['CASTRO', 'Los Lagos'], ['ANCUD', 'Los Lagos'], ['QUELLON', 'Los Lagos'], ['CHILOE', 'Los Lagos'],
  ['COYHAIQUE', 'Aysén'], ['AYSEN', 'Aysén'], ['PUNTA ARENAS', 'Magallanes'], ['MAGALLANES', 'Magallanes'],
  // Nombres propios que ubican igual de bien que una ciudad.
  ['ARAUCANIA', 'Araucanía'], ['MAKEWE', 'Araucanía'], ['METROPOLITANO', 'Metropolitana'],
  ['METROPOLITANA', 'Metropolitana'], ['ZONA NAVAL', 'Valparaíso'], ['LAUTARO NAVARRO', 'Magallanes'],
];
function vxRegionPorNombre(nombre) {
  const k = ' ' + vxNorm(nombre) + ' ';
  const h = VX_CIUDAD.find(x => k.indexOf(' ' + x[0] + ' ') >= 0 || k.indexOf(' ' + x[0] + '-') >= 0);
  return h ? h[1] : null;
}

// Índice de una fuente por nombre exacto y por clave de palabras. Una clave
// que apunta a dos registros distintos queda marcada como ambigua y no se usa.
function vxIndice(lista, nombreDe) {
  const exacto = {}, porClave = {};
  (lista || []).forEach(o => {
    const n0 = nombreDe(o);
    if (!n0) return;
    const k = vxNorm(n0);
    if (exacto[k] === undefined) exacto[k] = o;
    (porClave[vxClave(n0)] || (porClave[vxClave(n0)] = [])).push(o);
  });
  const clave = {};
  Object.keys(porClave).forEach(c => { if (porClave[c].length === 1) clave[c] = porClave[c][0]; });
  return { exacto: exacto, clave: clave };
}
function vxBuscar(idx, nombre) {
  if (!idx) return null;
  const k = vxNorm(nombre);
  if (idx.exacto && idx.exacto[k]) return idx.exacto[k];
  const c = vxAlias(nombre);
  if (idx.clave && idx.clave[c]) return idx.clave[c];
  return null;
}

// ── Índice de clientes: región, ubicación, facturación, contrato ──
// Deja además el rastro del cruce (c.src) para poder auditarlo desde la hoja:
// de dónde salió la región y con qué cuentas de facturación quedó asociado.
function vxBase() {
  if (VX.base) return VX.base;
  const det = (APP_DATA.visitas || {}).det || { clientes: [] };
  const idxMapa = vxIndice(window.MAPA_DATA || [], m => m.n);
  const idxBI   = vxIndice(((APP_DATA.base_instalada || {}).clientes) || [], c => c.nombre);
  const idxPlan = vxIndice((((APP_DATA.plan_rm || {}).clientes) || [])
    .filter(u => u.lat != null && u.prec !== 'Aproximada (centro de la región)'), u => u.n);

  VX.base = det.clientes.map(nombre => {
    const m = vxBuscar(idxMapa, nombre), b = vxBuscar(idxBI, nombre), pl = vxBuscar(idxPlan, nombre);
    let region = 'Sin región', src = '';
    if (m && m.region && m.region !== 'Sin región') { region = m.region; src = 'Mapa Clientes'; }
    else if (b && b.region && b.region !== 'Sin región') { region = b.region; src = 'Base Instalada'; }
    else if (pl && pl.r) { region = pl.r; src = 'Plan RM'; }
    else {
      const rn = vxRegionPorNombre(nombre);
      if (rn) { region = rn; src = 'ciudad en el nombre'; }
    }
    return { n: nombre, region: vxRegNom(region), regSrc: src,
      lat: (m && m.lat != null) ? m.lat : (pl ? pl.lat : null),
      lon: (m && m.lon != null) ? m.lon : (pl ? pl.lon : null),
      geoSrc: (m && m.lat != null) ? 'Mapa Clientes' : (pl ? 'Plan RM' : ''),
      comuna: (m && m.comuna) || (pl && pl.com) || '',
      fac: 0, contr: 0, noContr: 0, cuentas: [],
      cc: !!(m && m.cc), bi: b ? (b.total || 0) : 0, sat: m ? m.sat : null };
  });

  // ── Reparto de la facturación ──
  // El cruce se hace desde el panel de facturación hacia los clientes visitados
  // y no al revés: así cada peso cae en un solo lado —visitado o no visitado— y
  // las dos partes suman exactamente el total del año.
  const idxVis = vxIndice(VX.base, c => c.n);
  VX.sinVisita = [];
  VX.facPanel = 0; VX.contrPanel = 0; VX.facFuera = 0;
  const panel = (APP_DATA.panel_fact && APP_DATA.panel_fact.length) ? APP_DATA.panel_fact : (APP_DATA.panel || []);
  panel.forEach(p => {
    const fac = (p.real_ytd_fac !== undefined) ? (p.real_ytd_fac || 0) : (p.real_ytd || 0);
    const contr = Math.min(p.presup_contr_ytd || 0, fac);
    VX.facPanel += fac; VX.contrPanel += contr;
    const c = vxBuscar(idxVis, p.cliente);
    if (c) {
      c.fac += fac; c.contr += contr; c.noContr = c.fac - c.contr;
      c.cc = c.cc || !!p.tiene_contrato;
      c.cuentas.push(p.cliente);
    } else {
      // Sin visita. El total incluye los saldos negativos —notas de crédito de
      // clientes que no se visitaron— para que el cuadre cierre; la tabla lista
      // sólo a los que facturan.
      VX.facFuera += fac;
      if (fac > 0) {
        const m = vxBuscar(idxMapa, p.cliente), b = vxBuscar(idxBI, p.cliente);
        let reg = (m && m.region) || (b && b.region) || vxRegionPorNombre(p.cliente) || 'Sin región';
        VX.sinVisita.push({ n: p.cliente, fac: fac, contr: contr, cc: !!p.tiene_contrato,
          region: vxRegNom(reg), bi: b ? (b.total || 0) : (m ? (m.bi || 0) : 0) });
      }
    }
  });
  VX.sinVisita.sort((a, b) => b.fac - a.fac);
  return VX.base;
}

// ── Agregación con los filtros activos ──
// per: '2026' y '2025' son Ene–mes de corte del año respectivo; 'todo' suma
// todos los meses cargados de los dos años.
function vxAgg() {
  const det = (APP_DATA.visitas || {}).det;
  const base = vxBase();
  if (!det || !det.filas) return { cli: [], meses: {}, regs: [], tot: 0, tot25: 0, tipos: {}, ejes: {} };
  const q = vxNorm(VX.f.q);
  const porCli = {};
  const mesAct = new Array(12).fill(0), mesAnt = new Array(12).fill(0);
  const tipos = {}, ejes = {};
  let tot = 0, tot25 = 0;

  det.filas.forEach(f => {
    const eje = det.ejecutivos[f[0]], tipo = det.tipos[f[2]], ano = f[3], mes = f[4], n = f[5];
    const c = base[f[1]];
    if (!c) return;
    if (VX.f.eje !== 'todos' && eje !== VX.f.eje) return;
    if (VX.f.tipo !== 'todos' && tipo !== VX.f.tipo) return;
    if (VX.f.reg !== 'todas' && c.region !== VX.f.reg) return;
    if (q && vxNorm(c.n).indexOf(q) < 0) return;

    const esAct = ano === ANO_ACTUAL && mes <= MES_CORTE;
    const esAnt = ano === ANO_ACTUAL - 1 && mes <= MES_CORTE;
    const cuenta = VX.f.per === 'todo' ? true : (VX.f.per === String(ANO_ACTUAL) ? esAct : esAnt);
    if (esAct) mesAct[mes - 1] += n;
    if (esAnt) mesAnt[mes - 1] += n;
    if (esAct) tot += n;
    if (esAnt) tot25 += n;
    if (!cuenta) return;

    const d = porCli[c.n] || (porCli[c.n] = { c: c, v: 0, eje: {}, tipo: {}, ult: null, meses: new Array(12).fill(0) });
    d.v += n;
    d.eje[eje] = (d.eje[eje] || 0) + n;
    d.tipo[tipo] = (d.tipo[tipo] || 0) + n;
    if (ano === ANO_ACTUAL) d.meses[mes - 1] += n;
    const idx = ano * 12 + mes;
    if (d.ult == null || idx > d.ult) d.ult = idx;
    tipos[tipo] = (tipos[tipo] || 0) + n;
    ejes[eje] = (ejes[eje] || 0) + n;
  });

  const cli = Object.values(porCli).map(d => {
    const es = Object.keys(d.eje).filter(e => d.eje[e] > 0);
    d.dueno = es.length > 1 ? 'ambos' : (es[0] || 'ambos');
    return d;
  });

  const regMap = {};
  cli.forEach(d => {
    const r = regMap[d.c.region] || (regMap[d.c.region] = { region: d.c.region, v: 0, cli: 0, fac: 0, eje: {}, conContrato: 0 });
    r.v += d.v; r.cli++; r.fac += d.c.fac;
    if (d.c.cc) r.conContrato++;
    Object.keys(d.eje).forEach(e => { r.eje[e] = (r.eje[e] || 0) + d.eje[e]; });
  });
  const regs = Object.values(regMap).sort((a, b) => b.v - a.v);
  return { cli: cli, mesAct: mesAct, mesAnt: mesAnt, regs: regs, tot: tot, tot25: tot25, tipos: tipos, ejes: ejes };
}

// ── Filtros ──
function vxChip(cont, opts, activo, fn) {
  const box = document.getElementById(cont);
  if (!box) return;
  box.innerHTML = opts.map(o =>
    '<button class="btn' + (o.k === activo ? ' on' : '') + '" onclick="' + fn + '(' +
    JSON.stringify(o.k).replace(/"/g, '&quot;') + ')" style="font-size:.57rem;padding:.16rem .5rem' +
    (o.col ? ';border-left:2px solid ' + o.col : '') + '">' + vxEsc(o.t) + '</button>').join('');
}
function vxPintaFiltros() {
  const det = (APP_DATA.visitas || {}).det || { ejecutivos: [], tipos: [] };
  vxChip('vx-f-eje', [{ k: 'todos', t: 'Ambos' }].concat(det.ejecutivos.map(e =>
    ({ k: e, t: VX.NOM[e] || e, col: VX.COL[e] }))), VX.f.eje, 'vxSetEje');
  vxChip('vx-f-tipo', [{ k: 'todos', t: 'Todas' }].concat(det.tipos.map(t => ({ k: t, t: t }))), VX.f.tipo, 'vxSetTipo');
  vxChip('vx-f-per', [{ k: String(ANO_ACTUAL), t: ANO_ACTUAL + ' · Ene–' + MES_CORTE_NOMBRE },
    { k: String(ANO_ACTUAL - 1), t: (ANO_ACTUAL - 1) + ' · Ene–' + MES_CORTE_NOMBRE },
    { k: 'todo', t: 'Todo el histórico' }], VX.f.per, 'vxSetPer');
  const sel = document.getElementById('vx-f-reg');
  if (sel) {
    const regs = [...new Set(vxBase().map(c => c.region))].sort((a, b) => vxRegOrden(a) - vxRegOrden(b));
    sel.innerHTML = ['<option value="todas">Todas las regiones</option>']
      .concat(regs.map(r => '<option value="' + vxEsc(r) + '"' + (VX.f.reg === r ? ' selected' : '') + '>' + vxEsc(r) + '</option>')).join('');
  }
  const q = document.getElementById('vx-f-q');
  if (q && q.value !== VX.f.q) q.value = VX.f.q;
}
function vxSetEje(v)  { VX.f.eje = v;  VX.sel = null; vxRender(); }
function vxSetTipo(v) { VX.f.tipo = v; VX.sel = null; vxRender(); }
function vxSetPer(v)  { VX.f.per = v;  VX.sel = null; vxRender(); }
function vxSetReg(v)  { VX.f.reg = v;  VX.sel = null; vxRender(true); }
function vxSetQ(v)    { VX.f.q = v;    VX.sel = null; vxRender(true); }
function vxReset()    { VX.f = { eje: 'todos', tipo: 'todos', per: String(ANO_ACTUAL), reg: 'todas', q: '' }; VX.sel = null; vxRender(true); }
function vxSort(col)  { if (VX.sort === col) VX.asc = !VX.asc; else { VX.sort = col; VX.asc = col === 'n'; } vxTablaCli(vxAgg()); }

// Selección: la comparten el mapa y la tabla.
function vxSel(nombre) {
  VX.sel = (VX.sel === nombre) ? null : nombre;
  const A = vxAgg();
  vxTablaCli(A);
  vxDetalleCli(A);
  if (VX.sel && VX.marks[VX.sel]) {
    const m = VX.marks[VX.sel];
    VX.map.setView(m.getLatLng(), Math.max(VX.map.getZoom(), 9), { animate: true });
    m.openTooltip();
  }
  const fila = document.getElementById('vx-row-' + vxNorm(nombre).replace(/[^A-Z0-9]/g, ''));
  if (fila && fila.scrollIntoView) fila.scrollIntoView({ block: 'nearest' });
}

// ── KPIs ──
function vxKpis(A) {
  const box = document.getElementById('vx-kpi');
  if (!box) return;
  const nCli = A.cli.length;
  const fac = A.cli.reduce((s, d) => s + d.c.fac, 0);
  vxBase();
  const facPanel = VX.facPanel || 0;
  const regs = A.regs.filter(r => r.region !== 'Sin región').length;
  const sinGeo = A.cli.filter(d => d.c.lat == null).length;
  const totPer = A.cli.reduce((s, d) => s + d.v, 0);
  const varPct = (VX.f.per === String(ANO_ACTUAL) && A.tot25) ? (A.tot - A.tot25) / A.tot25 * 100 : null;
  const conContr = A.cli.filter(d => d.c.cc).length;
  const k = (col, val, lbl, sub) =>
    '<div class="kpi" style="--kc:' + col + '"><div class="kpi-lbl">' + lbl + '</div>' +
    '<div class="kpi-val">' + val + '</div><div class="kpi-sub">' + sub + '</div></div>';
  box.innerHTML =
    k('var(--az1)', vxN0(totPer), 'Visitas', VX.f.per === 'todo' ? 'todo el histórico cargado'
      : (varPct == null ? 'Ene–' + MES_CORTE_NOMBRE + ' ' + VX.f.per
        : 'Ene–' + MES_CORTE_NOMBRE + ' · ' + (varPct >= 0 ? '+' : '') + varPct.toFixed(0) + '% vs ' + (ANO_ACTUAL - 1))) +
    k('#7A1FAA', vxN0(nCli), 'Clientes visitados',
      sinGeo ? sinGeo + ' sin ubicación en el mapa' : 'todos ubicados en el mapa') +
    k('var(--teal)', regs, 'Regiones cubiertas',
      A.regs.length ? 'lidera ' + vxEsc(A.regs[0].region) + ' con ' + vxN0(A.regs[0].v) : '—') +
    k('var(--or)', vxN1(nCli ? totPer / nCli : 0), 'Visitas por cliente',
      conContr + ' de ' + nCli + ' con contrato vigente') +
    k('var(--am)', vxMM(fac), 'Facturación visitada',
      facPanel ? (fac / facPanel * 100).toFixed(0) + '% de los ' + vxMM(facPanel) + ' del año' : '—');
  const res = document.getElementById('vx-f-res');
  if (res) {
    const partes = [];
    if (VX.f.eje !== 'todos') partes.push(VX.NOM[VX.f.eje] || VX.f.eje);
    if (VX.f.tipo !== 'todos') partes.push(VX.f.tipo);
    if (VX.f.reg !== 'todas') partes.push(VX.f.reg);
    if (VX.f.q) partes.push('«' + VX.f.q + '»');
    res.innerHTML = '<strong>' + vxN0(totPer) + '</strong> visitas · <strong>' + nCli + '</strong> clientes' +
      (partes.length ? ' · filtros: ' + vxEsc(partes.join(' · ')) : ' · sin filtros');
  }
}

// ── Mapa ──
function vxMapa(A, recentrar) {
  if (!window.L) return;
  const cont = document.getElementById('vxMapa');
  if (!cont) return;
  if (!VX.map) {
    VX.map = L.map('vxMapa', { zoomControl: true, scrollWheelZoom: false }).setView([-35.5, -70.8], 4);
    if (window.mapaTiles) mapaTiles(VX.map);
  }
  if (!VX.lyr) VX.lyr = L.layerGroup().addTo(VX.map);
  VX.lyr.clearLayers();
  VX.marks = {};

  const pts = A.cli.filter(d => d.c.lat != null && d.c.lon != null);
  const maxV = Math.max.apply(null, pts.map(d => d.v).concat([1]));
  pts.forEach(d => {
    const col = VX.COL[d.dueno] || VX.COL.ambos;
    const activo = VX.sel === d.c.n;
    const mk = L.circleMarker([d.c.lat, d.c.lon], {
      radius: Math.max(5, Math.sqrt(d.v / maxV) * 19) + (activo ? 4 : 0),
      fillColor: col, color: activo ? '#111827' : col,
      weight: activo ? 3 : 1.5, opacity: 1, fillOpacity: activo ? .92 : .62,
    });
    const ejeTxt = Object.keys(d.eje).map(e => (VX.NOM[e] || e) + ': ' + d.eje[e]).join(' · ');
    const tipoTxt = Object.keys(d.tipo).map(t => t + ': ' + d.tipo[t]).join(' · ');
    mk.bindTooltip(
      '<div style="font-family:Roboto,sans-serif;min-width:205px">' +
      '<div style="font-weight:900;font-size:.75rem;color:' + col + ';border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:4px">' +
      vxEsc(d.c.n) + '</div>' +
      '<div style="font-size:.7rem"><strong>' + d.v + '</strong> visitas</div>' +
      '<div style="font-size:.63rem;color:#555">' + vxEsc(ejeTxt) + '</div>' +
      '<div style="font-size:.63rem;color:#555">' + vxEsc(tipoTxt) + '</div>' +
      '<div style="font-size:.63rem;color:#555">' + vxEsc(d.c.region) + (d.c.comuna ? ' · ' + vxEsc(d.c.comuna) : '') + '</div>' +
      '<div style="font-size:.63rem;color:#555">Facturación ' + ANO_ACTUAL + ': <strong>' + vxMM(d.c.fac) + '</strong>' +
      (d.c.cc ? ' · con contrato' : '') + '</div>' +
      (d.c.bi ? '<div style="font-size:.63rem;color:#555">' + d.c.bi + ' equipos instalados</div>' : '') +
      '<div style="font-size:.58rem;color:#888;margin-top:3px">clic para fijarlo en la tabla</div></div>',
      { sticky: true, direction: 'top', opacity: .97 });
    mk.on('click', () => vxSel(d.c.n));
    mk.addTo(VX.lyr);
    VX.marks[d.c.n] = mk;
  });

  if (recentrar && pts.length) {
    try { VX.map.fitBounds(L.latLngBounds(pts.map(d => [d.c.lat, d.c.lon])).pad(.15)); } catch (e) {}
  }
  const sinGeo = A.cli.length - pts.length;
  const lbl = document.getElementById('vx-map-lbl');
  if (lbl) lbl.textContent = pts.length + ' clientes en el mapa' + (sinGeo ? ' · ' + sinGeo + ' sin ubicación' : '');
  const leg = document.getElementById('vx-map-leg');
  if (leg) {
    const cuenta = k => A.cli.filter(d => d.dueno === k).length;
    const item = (col, txt, n) => '<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.57rem;margin-right:1rem">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';opacity:.7;border:1.5px solid ' + col + '"></span>' +
      txt + ' <strong>' + n + '</strong></span>';
    leg.innerHTML = item(VX.COL['Eglys Ramirez'], 'Solo Eglys', cuenta('Eglys Ramirez')) +
      item(VX.COL['Cristian Perez'], 'Solo Cristián', cuenta('Cristian Perez')) +
      item(VX.COL.ambos, 'Ambos', cuenta('ambos')) +
      '<span style="font-size:.57rem;color:var(--mut)">· el tamaño es el número de visitas · clic en una burbuja para verla en la tabla</span>';
  }
  setTimeout(() => { if (VX.map) VX.map.invalidateSize(); }, 60);
}
function vxFit() {
  const A = vxAgg();
  const pts = A.cli.filter(d => d.c.lat != null);
  if (VX.map && pts.length) { try { VX.map.fitBounds(L.latLngBounds(pts.map(d => [d.c.lat, d.c.lon])).pad(.15)); } catch (e) {} }
}
window._visMapRefresh = function () {
  if (VX.map) VX.map.invalidateSize();
  if (VP_MAP) { VP_MAP.invalidateSize(); vpProgramadas(); }   // se recentra ya con la hoja visible
};

// ── Tabla de clientes, enlazada con el mapa ──
function vxTablaCli(A) {
  const box = document.getElementById('vx-cli-tabla');
  if (!box) return;
  const SEP = 'border-right:1px solid var(--brd)';
  const th = (t, col, al) => '<th onclick="vxSort(' + JSON.stringify(col).replace(/"/g, '&quot;') + ')" ' +
    'style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.3rem .45rem;cursor:pointer;' +
    'font-size:.54rem;text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t +
    (VX.sort === col ? (VX.asc ? ' ▲' : ' ▼') : '') + '</th>';
  const val = d => VX.sort === 'n' ? d.c.n : VX.sort === 'reg' ? d.c.region
    : VX.sort === 'fac' ? d.c.fac : VX.sort === 'ult' ? (d.ult || 0) : d.v;
  const arr = A.cli.slice().sort((a, b) => {
    const x = val(a), y = val(b);
    const c = (typeof x === 'string') ? String(x).localeCompare(String(y), 'es') : (x - y);
    return (VX.asc ? c : -c) || b.v - a.v;
  });
  const mesTxt = idx => { if (!idx) return '—'; const a = Math.floor((idx - 1) / 12), m = (idx - 1) % 12;
    return MESES_ABR[m] + " '" + String(a).slice(2); };
  const filas = arr.map((d, i) => {
    const act = VX.sel === d.c.n;
    const col = VX.COL[d.dueno] || VX.COL.ambos;
    return '<tr id="vx-row-' + vxNorm(d.c.n).replace(/[^A-Z0-9]/g, '') + '" onclick="vxSel(' +
      JSON.stringify(d.c.n).replace(/"/g, '&quot;') + ')" style="cursor:pointer;background:' +
      (act ? 'rgba(255,192,0,.18)' : (i % 2 ? 'var(--bg)' : 'var(--bg2)')) + ';border-left:3px solid ' + col + '">' +
      '<td style="padding:.24rem .45rem;font-size:.6rem;font-weight:600;max-width:190px;overflow:hidden;' +
        'text-overflow:ellipsis;white-space:nowrap;' + SEP + '" title="' + vxEsc(d.c.n) + '">' + vxEsc(d.c.n) + '</td>' +
      '<td style="padding:.24rem .45rem;font-size:.56rem;color:var(--mut);white-space:nowrap;' + SEP + '">' + vxEsc(d.c.region) + '</td>' +
      '<td style="padding:.24rem .45rem;text-align:right;font-size:.62rem;font-weight:700;' +
        'font-variant-numeric:tabular-nums;color:' + col + ';' + SEP + '">' + d.v + '</td>' +
      '<td style="padding:.24rem .45rem;text-align:right;font-size:.56rem;color:var(--mut);white-space:nowrap;' + SEP + '">' + mesTxt(d.ult) + '</td>' +
      '<td style="padding:.24rem .45rem;text-align:right;font-size:.6rem;font-variant-numeric:tabular-nums;color:var(--am);' + SEP + '">' +
        (d.c.fac ? vxMM(d.c.fac) : '—') + '</td>' +
      '<td style="padding:.24rem .45rem;text-align:center;font-size:.55rem">' +
        (d.c.cc ? '<span class="badge bok">Sí</span>' : '<span style="color:var(--mut)">—</span>') + '</td></tr>';
  }).join('');
  const totV = arr.reduce((s, d) => s + d.v, 0), totF = arr.reduce((s, d) => s + d.c.fac, 0);
  box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:520px"><thead><tr>' +
    th('CLIENTE', 'n', 'left') + th('REGIÓN', 'reg', 'left') + th('VISITAS', 'v', 'right') +
    th('ÚLTIMA', 'ult', 'right') + th('FACT. ' + ANO_ACTUAL, 'fac', 'right') +
    '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.3rem .45rem;font-size:.54rem">CONTR.</th>' +
    '</tr></thead><tbody>' + (filas || '<tr><td colspan="6" style="padding:1rem;text-align:center;color:var(--mut);font-style:italic">Sin visitas para los filtros elegidos</td></tr>') +
    '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
    '<td colspan="2" style="padding:.28rem .45rem;font-size:.58rem;' + SEP + '">' + arr.length + ' clientes</td>' +
    '<td style="padding:.28rem .45rem;text-align:right;font-size:.62rem;' + SEP + '">' + totV + '</td>' +
    '<td style="' + SEP + '"></td>' +
    '<td style="padding:.28rem .45rem;text-align:right;font-size:.6rem;color:#FFC000;' + SEP + '">' + vxMM(totF) + '</td>' +
    '<td></td></tr></tfoot></table>';
  const lbl = document.getElementById('vx-cli-lbl');
  if (lbl) lbl.textContent = arr.length + ' clientes · clic para fijar uno en el mapa';
}

// ── Ficha del cliente seleccionado ──
function vxDetalleCli(A) {
  const box = document.getElementById('vx-cli-det');
  if (!box) return;
  if (!VX.sel) {
    if (VX.chCli) { VX.chCli.destroy(); VX.chCli = null; }
    box.innerHTML = '<div style="font-size:.58rem;color:var(--mut);text-align:center;padding:.6rem;' +
      'border:1px dashed var(--brd);border-radius:5px">Elige un cliente en el mapa o en la tabla para ver su ficha</div>';
    return;
  }
  const d = A.cli.find(x => x.c.n === VX.sel);
  if (!d) { VX.sel = null; return vxDetalleCli(A); }
  const dato = (l, v2, col) => '<div style="display:flex;justify-content:space-between;gap:.5rem;font-size:.6rem;padding:.12rem 0">' +
    '<span style="color:var(--mut)">' + l + '</span><strong style="color:' + (col || 'var(--txt)') + '">' + v2 + '</strong></div>';
  box.innerHTML =
    '<div style="border:1px solid var(--brd);border-radius:6px;padding:.55rem .7rem;background:var(--bg2)">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.35rem">' +
      '<strong style="font-size:.72rem;color:var(--az1)">' + vxEsc(d.c.n) + '</strong>' +
      '<button class="btn" onclick="vxSel(' + JSON.stringify(d.c.n).replace(/"/g, '&quot;') + ')" style="font-size:.53rem;padding:.1rem .4rem">Quitar</button>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 .9rem">' +
      dato('Visitas', d.v, VX.COL[d.dueno]) +
      dato('Región', vxEsc(d.c.region) + (d.c.comuna ? ' · ' + vxEsc(d.c.comuna) : '')) +
      dato('Ejecutivos', vxEsc(Object.keys(d.eje).map(e => (VX.NOM[e] || e).split(' ')[0] + ' ' + d.eje[e]).join(' · '))) +
      dato('Actividades', vxEsc(Object.keys(d.tipo).map(t => t + ' ' + d.tipo[t]).join(' · '))) +
      dato('Facturación ' + ANO_ACTUAL, vxMM(d.c.fac), 'var(--am)') +
      dato('De contratos', d.c.fac ? vxMM(d.c.contr) : '—', 'var(--teal)') +
      dato('Equipos instalados', d.c.bi || '—') +
      dato('Contrato vigente', d.c.cc ? 'Sí' : 'No', d.c.cc ? 'var(--gn)' : 'var(--mut)') +
    '</div>' +
    '<div style="position:relative;height:96px;margin-top:.4rem"><canvas id="cVxCli"></canvas></div></div>';
  const ctx = document.getElementById('cVxCli');
  if (ctx && typeof safeChart === 'function') {
    if (VX.chCli) VX.chCli.destroy();
    VX.chCli = safeChart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: MESES_ABR.slice(0, MES_CORTE),
        datasets: [{ label: 'Visitas ' + ANO_ACTUAL, data: d.meses.slice(0, MES_CORTE),
          backgroundColor: VX.COL[d.dueno] || VX.COL.ambos, borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + c.parsed.y + ' visitas' } } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 8 } } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 8 } }, grid: { color: '#E2E6F0' } } } },
    });
  }
}

// ── Visitas por región ──
function vxRegion(A) {
  const ctx = document.getElementById('cVxReg');
  const regs = A.regs.slice();
  if (ctx && typeof safeChart === 'function') {
    if (VX.chReg) VX.chReg.destroy();
    const top = regs.slice(0, 12);
    const det = (APP_DATA.visitas || {}).det || { ejecutivos: [] };
    const ds = VX.f.eje === 'todos'
      ? det.ejecutivos.map(e => ({ label: VX.NOM[e] || e, data: top.map(r => r.eje[e] || 0),
          backgroundColor: VX.COL[e], borderRadius: 4, stack: 'r' }))
      : [{ label: VX.NOM[VX.f.eje] || VX.f.eje, data: top.map(r => r.v), backgroundColor: VX.COL[VX.f.eje], borderRadius: 4 }];
    VX.chReg = safeChart(ctx.getContext('2d'), {
      type: 'bar', data: { labels: top.map(r => r.region), datasets: ds },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        onClick: (evt, els) => { if (els && els.length) vxSetReg(top[els[0].index].region); },
        plugins: { legend: { display: ds.length > 1, position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + c.parsed.x + ' visitas' } } },
        scales: { x: { stacked: ds.length > 1, beginAtZero: true, grid: { color: '#E2E6F0' } },
          y: { stacked: ds.length > 1, grid: { display: false }, ticks: { font: { size: 9 } } } } },
    });
  }

  const box = document.getElementById('vx-reg-tabla');
  if (box) {
    const SEP = 'border-right:1px solid var(--brd)';
    const th = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.3rem .45rem;' +
      'font-size:.54rem;text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
    const totV = regs.reduce((s, r) => s + r.v, 0), totF = regs.reduce((s, r) => s + r.fac, 0);
    const maxV = Math.max.apply(null, regs.map(r => r.v).concat([1]));
    const td = (v2, extra) => '<td style="padding:.22rem .45rem;text-align:right;font-size:.6rem;' +
      'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v2 + '</td>';
    const filas = regs.map((r, i) => {
      const act = VX.f.reg === r.region;
      return '<tr onclick="vxSetReg(' + JSON.stringify(act ? 'todas' : r.region).replace(/"/g, '&quot;') + ')" ' +
        'style="cursor:pointer;background:' + (act ? 'rgba(255,192,0,.18)' : (i % 2 ? 'var(--bg)' : 'var(--bg2)')) + '">' +
        '<td style="padding:.22rem .45rem;font-size:.61rem;font-weight:600;white-space:nowrap;' + SEP + '">' + vxEsc(r.region) + '</td>' +
        td(r.v, 'font-weight:700;color:var(--az1);') +
        '<td style="padding:.22rem .45rem;' + SEP + '"><div style="height:5px;background:var(--gy);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + (r.v / maxV * 100) + '%;background:var(--az2)"></div></div></td>' +
        td((r.v / (totV || 1) * 100).toFixed(1) + '%', 'color:var(--mut);') +
        td(r.cli, 'color:var(--mut);') + td(vxN1(r.cli ? r.v / r.cli : 0)) +
        td(r.conContrato, 'color:var(--teal);') +
        td(r.fac ? vxMM(r.fac) : '—', 'color:var(--am);font-weight:700;') +
        td(totF ? (r.fac / totF * 100).toFixed(1) + '%' : '—', 'color:var(--mut);') + '</tr>';
    }).join('');
    const tdF = (v2, col) => '<td style="padding:.28rem .45rem;text-align:right;font-size:.6rem;' +
      'font-variant-numeric:tabular-nums;color:' + (col || '#fff') + ';' + SEP + '">' + v2 + '</td>';
    box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:560px"><thead><tr>' +
      th('REGIÓN', 'left') + th('VISITAS', 'right') + th('', 'left') + th('%', 'right') + th('CLIENTES', 'right') +
      th('VIS./CLI.', 'right') + th('CON CONTR.', 'right') + th('FACT. ' + ANO_ACTUAL, 'right') + th('% FACT.', 'right') +
      '</tr></thead><tbody>' + (filas || '<tr><td colspan="9" style="padding:.8rem;text-align:center;color:var(--mut);font-style:italic">Sin datos</td></tr>') +
      '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.28rem .45rem;font-size:.6rem;' + SEP + '">TOTAL · ' + regs.length + '</td>' +
      tdF(totV) + '<td style="' + SEP + '"></td>' + tdF('100%') +
      tdF(regs.reduce((s, r) => s + r.cli, 0)) +
      tdF(vxN1(regs.reduce((s, r) => s + r.cli, 0) ? totV / regs.reduce((s, r) => s + r.cli, 0) : 0)) +
      tdF(regs.reduce((s, r) => s + r.conContrato, 0), '#7FE8DF') + tdF(vxMM(totF), '#FFC000') + tdF('100%') +
      '</tr></tfoot></table>';
    const lbl = document.getElementById('vx-reg-lbl');
    if (lbl) lbl.textContent = regs.length + ' regiones · ' + vxN0(totV) + ' visitas' +
      (VX.f.reg !== 'todas' ? ' · filtrado en ' + VX.f.reg : '');
  }
}

// ── Evolución mensual ──
function vxEvolucion(A) {
  const meses = MESES_ABR.slice(0, MES_CORTE);
  const act = A.mesAct.slice(0, MES_CORTE), ant = A.mesAnt.slice(0, MES_CORTE);
  let a1 = 0, a2 = 0;
  const acAct = act.map(x => (a1 += x)), acAnt = ant.map(x => (a2 += x));
  const ctx = document.getElementById('cVxEvo');
  if (ctx && typeof safeChart === 'function') {
    if (VX.chEvo) VX.chEvo.destroy();
    VX.chEvo = safeChart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: meses, datasets: [
        { label: 'Visitas ' + ANO_ACTUAL, data: act, backgroundColor: 'rgba(0,45,115,.8)', borderRadius: 4, order: 3 },
        { label: 'Visitas ' + (ANO_ACTUAL - 1), data: ant, backgroundColor: 'rgba(184,193,216,.85)', borderRadius: 4, order: 3 },
        { label: 'Acumulado ' + ANO_ACTUAL, data: acAct, type: 'line', borderColor: '#FFC000',
          backgroundColor: 'rgba(255,192,0,.12)', pointRadius: 3, borderWidth: 2.5, tension: .3, yAxisID: 'y1', order: 1 },
        { label: 'Acumulado ' + (ANO_ACTUAL - 1), data: acAnt, type: 'line', borderColor: '#8A93AB',
          borderDash: [5, 4], pointRadius: 0, borderWidth: 2, tension: .3, yAxisID: 'y1', order: 2 },
      ] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
        scales: { x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: '#E2E6F0' }, title: { display: true, text: 'Visitas del mes', font: { size: 9 }, color: '#6B7BA8' } },
          y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Acumulado', font: { size: 9 }, color: '#6B7BA8' } } } },
    });
  }
  const box = document.getElementById('vx-evo-tabla');
  if (box) {
    const SEP = 'border-right:1px solid var(--brd)';
    const th = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.28rem .45rem;' +
      'font-size:.54rem;text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
    const td = (v2, extra) => '<td style="padding:.22rem .45rem;text-align:right;font-size:.6rem;' +
      'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v2 + '</td>';
    const filas = meses.map((m, i) => {
      const vr = ant[i] ? (act[i] - ant[i]) / ant[i] * 100 : null;
      return '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="padding:.22rem .45rem;font-size:.61rem;font-weight:600;' + SEP + '">' + m + '</td>' +
        td(act[i] || '—', 'font-weight:700;') + td(ant[i] || '—', 'color:var(--mut);') +
        td(vr == null ? 's/d' : (vr >= 0 ? '+' : '') + vr.toFixed(0) + '%',
           'font-weight:700;color:' + (vr == null ? 'var(--mut)' : vr >= 0 ? 'var(--gn)' : 'var(--rd)') + ';') +
        td(acAct[i], 'color:var(--am);font-weight:700;') + td(acAnt[i] || '—', 'color:var(--mut);') + '</tr>';
    }).join('');
    const t1 = act.reduce((s, x) => s + x, 0), t2 = ant.reduce((s, x) => s + x, 0);
    const vrT = t2 ? (t1 - t2) / t2 * 100 : null;
    const tdF = (v2, col) => '<td style="padding:.28rem .45rem;text-align:right;font-size:.6rem;' +
      'font-variant-numeric:tabular-nums;color:' + (col || '#fff') + ';' + SEP + '">' + v2 + '</td>';
    box.innerHTML = '<div style="overflow-x:auto;max-height:300px;overflow-y:auto">' +
      '<table style="width:100%;border-collapse:collapse;min-width:520px"><thead><tr>' +
      th('MES', 'left') + th(ANO_ACTUAL, 'right') + th(ANO_ACTUAL - 1, 'right') + th('VAR.', 'right') +
      th('ACUM. ' + ANO_ACTUAL, 'right') + th('ACUM. ' + (ANO_ACTUAL - 1), 'right') +
      '</tr></thead><tbody>' + filas + '</tbody><tfoot>' +
      '<tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.28rem .45rem;font-size:.6rem;' + SEP + '">Ene–' + MES_CORTE_NOMBRE + '</td>' +
      tdF(t1) + tdF(t2, '#B8C1D8') +
      tdF(vrT == null ? 's/d' : (vrT >= 0 ? '+' : '') + vrT.toFixed(0) + '%', vrT == null ? '#B8C1D8' : vrT >= 0 ? '#7FE8B0' : '#FFB3B3') +
      tdF(t1, '#FFC000') + tdF(t2, '#B8C1D8') + '</tr></tfoot></table></div>' +
      '<p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.5">Las dos columnas comparan los ' +
      'mismos meses de cada año y respetan los filtros de ejecutivo, actividad, región y cliente; el filtro de ' +
      'período no las afecta, porque la gracia de esta tabla es justamente comparar los dos años.</p>';
    const lbl = document.getElementById('vx-evo-lbl');
    if (lbl) lbl.textContent = t1 + ' visitas en ' + ANO_ACTUAL + ' vs ' + t2 + ' en ' + (ANO_ACTUAL - 1) +
      (vrT == null ? '' : ' · ' + (vrT >= 0 ? '+' : '') + vrT.toFixed(0) + '%');
  }
}

// ── Cuadre de la facturación ──
// Lo que factura la cartera se reparte en tres: los clientes visitados en el
// período, los que sólo tienen visitas fuera de él y los que no registran
// ninguna. La suma es la facturación del año, así que la tabla de arriba se
// puede leer contra el total del panel sin dudar de si falta alguien.
function vxCuadre(A) {
  const el = document.getElementById('vx-cli-cuadre');
  if (!el) return;
  vxBase();
  const facVis = A.cli.reduce((s, d) => s + d.c.fac, 0);
  const facOtro = VX.facPanel - facVis - VX.facFuera;
  if (VX.f.reg !== 'todas' || VX.f.q) {
    el.innerHTML = 'Facturación de los clientes listados: <strong>' + vxMM(facVis) + '</strong>. El cuadre contra ' +
      'el total del año se muestra sin filtro de región ni búsqueda.';
    return;
  }
  el.innerHTML = 'Cuadre: <strong>' + vxMM(facVis) + '</strong> de los clientes visitados' +
    (Math.abs(facOtro) > 5e4 ? ' + <strong>' + vxMM(facOtro) + '</strong> de los visitados sólo fuera del período' : '') +
    ' + <strong>' + vxMM(VX.facFuera) + '</strong> de ' + (VX.sinVisita || []).length + ' clientes sin ninguna visita' +
    ' = <strong>' + vxMM(VX.facPanel) + '</strong>, la facturación del año del panel.';
}

// ── Productividad por ejecutivo ──
function vxProd(A) {
  const box = document.getElementById('vx-prod-tabla');
  if (!box) return;
  const det = (APP_DATA.visitas || {}).det || { ejecutivos: [] };
  const meses = VX.f.per === 'todo' ? 12 + MES_CORTE : MES_CORTE;
  const filas = det.ejecutivos.map(e => {
    const suyos = A.cli.filter(d => (d.eje[e] || 0) > 0);
    const v = suyos.reduce((s, d) => s + d.eje[e], 0);
    const reg = new Set(suyos.map(d => d.c.region));
    const fac = suyos.reduce((s, d) => s + d.c.fac, 0);
    const solos = suyos.filter(d => d.dueno === e).length;
    const conContr = suyos.filter(d => d.c.cc).length;
    const reuniones = suyos.reduce((s, d) => s + Object.keys(d.tipo)
      .filter(t => vxNorm(t).indexOf('REUNION') >= 0).reduce((x, t) => x + d.tipo[t], 0), 0);
    return { e: e, v: v, cli: suyos.length, solos: solos, reg: reg.size, fac: fac,
             conContr: conContr, reuniones: reuniones };
  }).filter(r => r.v > 0);

  const SEP = 'border-right:1px solid var(--brd)';
  const fila = (lbl, val, ayuda) => '<tr><td style="padding:.24rem .5rem;font-size:.6rem;color:var(--mut);' + SEP + '" ' +
    (ayuda ? 'title="' + vxEsc(ayuda) + '"' : '') + '>' + lbl + '</td>' + val + '</tr>';
  const celda = (v2, col) => '<td style="padding:.24rem .5rem;text-align:right;font-size:.63rem;font-weight:700;' +
    'font-variant-numeric:tabular-nums;color:' + (col || 'var(--txt)') + ';' + SEP + '">' + v2 + '</td>';
  const th = t => '<th style="background:var(--az1);color:#fff;padding:.3rem .5rem;font-size:.55rem;text-align:right;' +
    'border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
  box.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
    '<th style="background:var(--az1);color:#fff;padding:.3rem .5rem;font-size:.55rem;text-align:left;' + SEP + '">INDICADOR</th>' +
    filas.map(r => th((VX.NOM[r.e] || r.e).toUpperCase())).join('') + '</tr></thead><tbody>' +
    fila('Visitas', filas.map(r => celda(vxN0(r.v), VX.COL[r.e])).join('')) +
    fila('Clientes atendidos', filas.map(r => celda(r.cli)).join('')) +
    fila('Clientes exclusivos', filas.map(r => celda(r.solos)).join(''), 'Clientes que en este período visitó sólo este ejecutivo') +
    fila('Regiones', filas.map(r => celda(r.reg)).join('')) +
    fila('Visitas por cliente', filas.map(r => celda(vxN1(r.cli ? r.v / r.cli : 0))).join('')) +
    fila('Visitas por mes', filas.map(r => celda(vxN1(r.v / meses))).join(''), 'Sobre los meses del período elegido') +
    fila('Reuniones', filas.map(r => celda(r.reuniones + ' · ' + (r.v ? Math.round(r.reuniones / r.v * 100) : 0) + '%')).join('')) +
    fila('Clientes con contrato', filas.map(r => celda(r.conContr + ' · ' + (r.cli ? Math.round(r.conContr / r.cli * 100) : 0) + '%')).join('')) +
    fila('Facturación de sus clientes', filas.map(r => celda(vxMM(r.fac), 'var(--am)')).join('')) +
    '</tbody></table>';
  const lbl = document.getElementById('vx-prod-lbl');
  if (lbl) lbl.textContent = VX.f.per === 'todo' ? 'todo el histórico' : 'Ene–' + MES_CORTE_NOMBRE + ' ' + VX.f.per;
}

// ── Dispersión visitas vs facturación ──
// Las medianas se dibujan como plugin: Chart.js no trae anotaciones y cargar
// otra librería por dos líneas no se justifica.
const vxGuias = {
  id: 'vxGuias',
  beforeDatasetsDraw(ch, args, opt) {
    if (!opt || !isFinite(opt.mx) || !isFinite(opt.my)) return;
    const { ctx, chartArea: a, scales } = ch;
    const px = scales.x.getPixelForValue(opt.mx), py = scales.y.getPixelForValue(opt.my);
    ctx.save();
    ctx.fillStyle = 'rgba(212,96,0,.06)';
    ctx.fillRect(a.left, a.top, px - a.left, py - a.top);
    ctx.strokeStyle = 'rgba(107,123,168,.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom);
    ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#A34515'; ctx.font = '600 10px Roboto, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Factura mucho · pocas visitas', a.left + 8, a.top + 14);
    ctx.restore();
  },
};

function vxDispersion(A) {
  const ctx = document.getElementById('cVxDisp');
  if (!ctx || typeof safeChart !== 'function') return;
  if (VX.chDisp) VX.chDisp.destroy();
  const pts = A.cli.filter(d => d.c.fac > 0).map(d => ({
    x: d.v, y: +(d.c.fac / 1e6).toFixed(2), n: d.c.n, reg: d.c.region, cc: d.c.cc, dueno: d.dueno }));
  const med = arr => { if (!arr.length) return 0; const o = arr.slice().sort((a, b) => a - b), m = o.length >> 1;
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
  VX.chDisp = safeChart(ctx.getContext('2d'), {
    type: 'scatter',
    data: { datasets: [{ label: 'Clientes', data: pts,
      backgroundColor: pts.map(p => (VX.COL[p.dueno] || VX.COL.ambos) + 'B3'),
      borderColor: '#fff', borderWidth: 1.5, pointRadius: 6, pointHoverRadius: 9 }] },
    options: { responsive: true, maintainAspectRatio: false,
      onClick: (evt, els) => { if (els && els.length) vxSel(pts[els[0].index].n); },
      plugins: { legend: { display: false },
        vxGuias: { mx: med(pts.map(p => p.x)), my: med(pts.map(p => p.y)) },
        tooltip: { callbacks: { title: c => c[0].raw.n,
          label: c => [c.raw.reg, c.raw.x + ' visitas', 'Facturación: MM$' + vxN1(c.raw.y),
            c.raw.cc ? 'Con contrato vigente' : 'Sin contrato'] } } },
      scales: { x: { beginAtZero: true, grid: { color: '#E2E6F0' }, ticks: { stepSize: 1, font: { size: 9 } },
          title: { display: true, text: 'Visitas del período', font: { size: 9 }, color: '#6B7BA8' } },
        y: { beginAtZero: true, grid: { color: '#E2E6F0' }, ticks: { font: { size: 9 } },
          title: { display: true, text: 'Facturación del año (MM$)', font: { size: 9 }, color: '#6B7BA8' } } } },
    plugins: [vxGuias],
  });
  const lbl = document.getElementById('vx-disp-lbl');
  if (lbl) lbl.textContent = pts.length + ' clientes con facturación · ' +
    (A.cli.length - pts.length) + ' visitados sin facturación cruzada';
}

// ── Orquestación ──
function vxRender(recentrar) {
  const A = vxAgg();
  vxPintaFiltros();
  vxKpis(A);
  vxMapa(A, recentrar);
  vxTablaCli(A);
  vxDetalleCli(A);
  vxRegion(A);
  vxEvolucion(A);
  vxProd(A);
  vxDispersion(A);
  vxCuadre(A);
}

function vxInit() {
  vpProgramadas();   // la tarjeta de arriba no depende de los filtros ni del plan
  if (!((APP_DATA.visitas || {}).det || {}).filas) return;
  vxRender(true);
  vpRender();
}

// ═══════════════════════════════════════════════════════════════
// FOCO PLAN RM Y VALPARAÍSO
//
// El mismo análisis de visitas, pero sólo sobre los clientes de la hoja
// Plan RM y Valparaíso (APP_DATA.plan_rm.clientes): cuántos se han visitado,
// de qué grupo y región son, si los visitó el ejecutivo al que les toca por
// comuna y cuánto potencial ST queda sin visitar.
//
// Tiene filtros propios: los de Cobertura Comercial miran toda la cartera y
// mezclarlos obligaría a desarmar uno para mirar el otro.
//
// El cruce de nombres es el mismo de arriba (vxIndice / vxBuscar), desde cada
// cliente del plan hacia los clientes de VISITAS. Dos cuentas del plan pueden
// calzar con el mismo cliente visitado —la misma institución con dos cuentas—;
// en los totales esas visitas se cuentan una sola vez.
// ═══════════════════════════════════════════════════════════════
const VP = {
  f: { per: String(typeof ANO_ACTUAL !== 'undefined' ? ANO_ACTUAL : 2026), eje: 'todos', reg: 'todas', g: 'todos',
       est: 'todos', q: '' },
  sort: 'g', asc: true,
  cruce: null,        // por cliente del plan: índice del cliente en visitas.det, o -1
  detPlan: null,      // por cliente de visitas.det: índices de clientes del plan
  chEvo: null,
};
const VP_GCOL = { 1: '#002D73', 2: '#B86E00', 3: '#2E7D4F' };   // los de la hoja Plan RM
const VP_GNOM = { 1: 'Grupo 1 · Top potencial ST', 2: 'Grupo 2 · Top camas', 3: 'Grupo 3 · Clientes retail' };

// Nombres del plan (BASE INSTALADA) que VISITAS escribe de otra forma y que la
// regla de palabras no alcanza a juntar. Revisados a mano (30-09-2026).
const VP_ALIAS = {
  'CENTRAL ODONTOLOGICA PRIMERA ZONA NAVAL VINA': 'CENTRAL ODONTOLOGICA PRIMERA ZONA NAVAL',
  'CENTRO OFTALMOLOGICO DR EDGARDO CARRENO SPA': 'CENTRO OFTALMOLOGICO DR. E. CARRENO SPA',
  'DIRECCION AERONAUTICA CIVIL': 'DIRECCION GENERAL DE AERONAUTICA CIVIL',
  'INSTITUTO NACIONAL DE GERIATRIA': 'INSTITUTO NACIONAL DE GERIATRIA PRESIDENTE EDO FREI MONTALVA',
  'UNIVERSIDAD SAN SEBASTIAN SEDE BELLAVISTA': 'UNIVERSIDAD SAN SEBASTIAN',
  'CLINICA MEDS LA DEHESA SPA': 'CLINICA MEDS LTDA',
  'CLINICA UNIVERSIDAD DE DESARROLLO': 'UNIVERSIDAD DEL DESARROLLO',
  // Excluidos del plan por contrato, escritos distinto en VISITAS.
  'POSTA CENTRAL': 'HOSPITAL DE URGENCIA ASISTENCIA PUBLICA DR. ALEJANDRO DEL RIO',
  // Escritos distinto en VISITAS que en Base Instalada (revisado el 16-10-2026).
  'CLINICA ESTETICA ESTORIL': 'CLINICA ESTORIL',
  'CORPORACION DE SALUD PDI O CORPSALUD': 'CORPORACION DE SALUD PDI',
};
// Cliente de VISITAS que calza con dos cuentas posibles —DIPRECA, del plan, y
// HOSPITAL DIPRECA, con contrato—. Sin confirmar va a «Otras regiones», junto
// con los que no tienen región (criterio acordado, 30-09-2026).
const VP_DUDA = { 'DIPRECA FONDO HOSPITAL': 1 };
// Región de clientes de VISITAS que ninguna fuente ubica, o que el mapa ubica
// mal (Redsalud Elqui es de La Serena). Revisado a mano (30-09-2026).
const VP_REG = {
  'CLINICA VESPUCIO SPA': 'Metropolitana', 'CENTRAL ODONTOLOGICA FACH': 'Metropolitana',
  'FUNDACION COANIQUEM': 'Metropolitana', 'REDSALUD ELQUI': 'Coquimbo',
  'INMOBILIARIA AS EL MAULE SPA': 'Maule', 'CIRUGIA DIGESTIVA AUSTRAL SPA': 'Magallanes',
  'HOSPITAL DE PUERTO NATALES': 'Magallanes', 'HOSPITAL PUERTO OCTAY': 'Los Lagos',
};

function vpPlan() { return (APP_DATA.plan_rm && APP_DATA.plan_rm.clientes) ? APP_DATA.plan_rm : null; }

function vpCruce() {
  if (VP.cruce) return;
  const P = vpPlan(), det = (APP_DATA.visitas || {}).det;
  const idx = vxIndice(det.clientes.map((n, i) => ({ n: n, i: i })), o => o.n);
  VP.detPlan = det.clientes.map(() => []);
  VP.cruce = P.clientes.map((u, j) => {
    let h = vxBuscar(idx, u.n);
    if (!h && VP_ALIAS[vxNorm(u.n)]) h = vxBuscar(idx, VP_ALIAS[vxNorm(u.n)]);
    if (!h) return -1;
    VP.detPlan[h.i].push(j);
    return h.i;
  });
  // Destino de cada cliente de VISITAS, para la tabla «A dónde van las
  // visitas»: del plan, excluido por contrato, o fuera del plan según región.
  const excl = new Set();
  (P.excluidos || []).forEach(e => {
    let h = vxBuscar(idx, e.n);
    if (!h && VP_ALIAS[vxNorm(e.n)]) h = vxBuscar(idx, VP_ALIAS[vxNorm(e.n)]);
    if (h) excl.add(h.i);
  });
  const REGS = P.regiones || ['Metropolitana', 'Valparaíso'];
  const base = vxBase();
  VP.destino = det.clientes.map((n, i) => {
    if (VP_DUDA[vxNorm(n)]) return 'otras';
    if (VP.detPlan[i].length) return 'g' + Math.min.apply(null, VP.detPlan[i].map(j => P.clientes[j].g));
    if (excl.has(i)) return 'contrato';
    const reg = VP_REG[vxNorm(n)] || (base[i] && base[i].region) || 'Sin región';
    return REGS.indexOf(reg) >= 0 ? 'sinpot' : 'otras';
  });
}

// El plan escribe «Eglys Ramírez» y VISITAS «Eglys Ramirez».
const vpEjeDet = nom => {
  const det = (APP_DATA.visitas || {}).det || { ejecutivos: [] };
  return det.ejecutivos.find(e => vxNorm(e) === vxNorm(nom)) || nom;
};

function vpAgg() {
  const P = vpPlan(), det = APP_DATA.visitas.det, base = vxBase();
  vpCruce();
  const REGS = P.regiones || ['Metropolitana', 'Valparaíso'];
  const pasa = u => (VP.f.reg === 'todas' || u.r === VP.f.reg) && (VP.f.g === 'todos' || String(u.g) === VP.f.g);
  const cli = P.clientes.map((u, j) => ({ u: u, j: j, v: 0, eje: {}, ult: null, v25: 0, v26: 0 }));
  const mesAct = new Array(12).fill(0), mesAnt = new Array(12).fill(0);
  const mesEje = {};
  det.ejecutivos.forEach(e => { mesEje[e] = new Array(12).fill(0); });
  let tot = 0, totAct = 0, totAnt = 0, totZona = 0;

  det.filas.forEach(f => {
    const eje = det.ejecutivos[f[0]], ano = f[3], mes = f[4], n = f[5];
    if (VP.f.eje !== 'todos' && eje !== VP.f.eje) return;
    const esAct = ano === ANO_ACTUAL && mes <= MES_CORTE;
    const esAnt = ano === ANO_ACTUAL - 1 && mes <= MES_CORTE;
    const cuenta = VP.f.per === 'todo' ? true : (VP.f.per === String(ANO_ACTUAL) ? esAct : esAnt);
    // Visitas del período en las dos regiones del plan, sean o no del plan:
    // dicen qué parte del trabajo en la zona se va a la cartera del plan.
    const c = base[f[1]];
    if (cuenta && c && REGS.indexOf(c.region) >= 0 && (VP.f.reg === 'todas' || c.region === VP.f.reg)) totZona += n;

    const js = (VP.detPlan[f[1]] || []).filter(j => pasa(P.clientes[j]));
    if (!js.length) return;
    if (esAct) { mesAct[mes - 1] += n; mesEje[eje][mes - 1] += n; totAct += n; }
    if (esAnt) { mesAnt[mes - 1] += n; totAnt += n; }
    if (cuenta) tot += n;
    js.forEach(j => {
      const d = cli[j];
      if (esAct) d.v26 += n;
      if (esAnt) d.v25 += n;
      if (!cuenta) return;
      d.v += n;
      d.eje[eje] = (d.eje[eje] || 0) + n;
      const idx = ano * 12 + mes;
      if (d.ult == null || idx > d.ult) d.ult = idx;
    });
  });
  // Si el cliente de visitas se contó dentro de la zona pero su región salió
  // de otra fuente, la parte del plan podría superar a la zona: se acota.
  totZona = Math.max(totZona, tot);
  return { cli: cli.filter(d => pasa(d.u)), tot: tot, totAct: totAct, totAnt: totAnt, totZona: totZona,
           mesAct: mesAct, mesAnt: mesAnt, mesEje: mesEje, REGS: REGS };
}

// ── Filtros ──
function vpBotones(id, opts, activo, fn) {
  const b = document.getElementById(id);
  if (!b) return;
  b.innerHTML = opts.map(o => '<button class="btn' + (String(o.k) === String(activo) ? ' on' : '') + '" onclick="' + fn + '(' +
    JSON.stringify(o.k).replace(/"/g, '&quot;') + ')" style="font-size:.57rem;padding:.16rem .5rem' +
    (o.col ? ';border-left:2px solid ' + o.col : '') + '">' + vxEsc(o.t) + '</button>').join('');
}
function vpPintaFiltros(A) {
  const det = APP_DATA.visitas.det;
  vpBotones('vp-f-per', [{ k: String(ANO_ACTUAL), t: ANO_ACTUAL + ' · Ene–' + MES_CORTE_NOMBRE },
    { k: String(ANO_ACTUAL - 1), t: (ANO_ACTUAL - 1) + ' · Ene–' + MES_CORTE_NOMBRE },
    { k: 'todo', t: 'Todo el histórico' }], VP.f.per, 'vpSet.bind(null,\'per\')');
  vpBotones('vp-f-eje', [{ k: 'todos', t: 'Ambos' }].concat(det.ejecutivos.map(e =>
    ({ k: e, t: VX.NOM[e] || e, col: VX.COL[e] }))), VP.f.eje, 'vpSet.bind(null,\'eje\')');
  vpBotones('vp-f-reg', [{ k: 'todas', t: 'Ambas' }].concat(A.REGS.map(r =>
    ({ k: r, t: r === 'Metropolitana' ? 'RM' : r }))), VP.f.reg, 'vpSet.bind(null,\'reg\')');
  vpBotones('vp-f-g', [{ k: 'todos', t: 'Todos' }, { k: '1', t: 'Grupo 1', col: VP_GCOL[1] },
    { k: '2', t: 'Grupo 2', col: VP_GCOL[2] }, { k: '3', t: 'Grupo 3', col: VP_GCOL[3] }], VP.f.g, 'vpSet.bind(null,\'g\')');
}
function vpSet(campo, v) { VP.f[campo] = v; vpRender(); }
function vpSetQ(v) { VP.f.q = v; vpTabla(vpAgg()); }
function vpSetEst(v) { VP.f.est = v; vpTabla(vpAgg()); }
function vpSort(col) { if (VP.sort === col) VP.asc = !VP.asc; else { VP.sort = col; VP.asc = col === 'n' || col === 'g'; } vpTabla(vpAgg()); }

// ── KPIs ──
function vpKpis(A) {
  const box = document.getElementById('vp-kpi');
  if (!box) return;
  const P = vpPlan();
  const n = A.cli.length, vis = A.cli.filter(d => d.v > 0);
  const pot = A.cli.reduce((s, d) => s + (d.u.pot || 0), 0), potVis = vis.reduce((s, d) => s + (d.u.pot || 0), 0);
  // «Por su responsable»: la visita la hizo el ejecutivo que tiene al cliente
  // por comuna en el plan.
  const porResp = vis.filter(d => (d.eje[vpEjeDet(d.u.resp)] || 0) > 0).length;
  const varPct = (VP.f.per === String(ANO_ACTUAL) && A.totAnt) ? (A.totAct - A.totAnt) / A.totAnt * 100 : null;
  const k = (col, val, lbl, sub) => '<div class="kpi" style="--kc:' + col + '"><div class="kpi-lbl">' + lbl + '</div>' +
    '<div class="kpi-val">' + val + '</div><div class="kpi-sub">' + sub + '</div></div>';
  box.innerHTML =
    k('var(--az3)', vxN0(n), 'Clientes del plan',
      A.REGS.map(r => vxN0(A.cli.filter(d => d.u.r === r).length) + (r === 'Metropolitana' ? ' RM' : ' Valparaíso')).join(' · ')) +
    k('#7A1FAA', vxN0(vis.length), 'Clientes visitados',
      (n ? (vis.length / n * 100).toFixed(0) : 0) + '% de cobertura · ' + vxN0(n - vis.length) + ' sin visita') +
    k('var(--az1)', vxN0(A.tot), 'Visitas a clientes del plan',
      (A.totZona ? (A.tot / A.totZona * 100).toFixed(0) + '% de las ' + vxN0(A.totZona) + ' visitas en la zona' : 'sin visitas en la zona') +
      (varPct == null ? '' : ' · ' + (varPct >= 0 ? '+' : '') + varPct.toFixed(0) + '% vs ' + (ANO_ACTUAL - 1))) +
    k('var(--am)', vxMM(potVis), 'Potencial ST visitado',
      (pot ? (potVis / pot * 100).toFixed(0) : 0) + '% de ' + vxMM(pot) + ' · quedan ' + vxMM(pot - potVis)) +
    k('var(--teal)', vxN0(porResp), 'Visitados por su responsable',
      'de ' + vis.length + ' visitados · el resto lo visitó el otro ejecutivo');

  const res = document.getElementById('vp-f-res');
  if (res) res.innerHTML = '<strong>' + vxN0(A.tot) + '</strong> visitas · <strong>' + vis.length + '</strong> de <strong>' +
    n + '</strong> clientes del plan visitados';

  // Agenda del plan: arranca en P.inicio. Las visitas registradas antes de esa
  // fecha son la línea base; cuando la hoja VISITAS traiga meses dentro de la
  // agenda, se mide cuántos clientes agendados ya se visitaron.
  const nota = document.getElementById('vp-agenda');
  if (nota) {
    const AG = P.agenda || [];
    const corte = ANO_ACTUAL * 12 + MES_CORTE;
    const mesDe = iso => { const p = String(iso).split('-'); return (+p[0]) * 12 + (+p[1]); };
    const venc = AG.filter(a => mesDe(a.f) <= corte && A.cli.some(d => d.j === a.c));
    const ini = AG.length ? AG[0].f.split('-').reverse().join('/') : '—';
    if (!venc.length) {
      nota.innerHTML = 'La agenda del plan parte el <strong>' + ini + '</strong> y la hoja VISITAS llega hasta <strong>' +
        MES_CORTE_NOMBRE + ' ' + ANO_ACTUAL + '</strong>: todo lo de esta sección es la <strong>línea base</strong> antes ' +
        'del plan. Cuando se carguen visitas desde esa fecha, aquí se mide el cumplimiento de la agenda.';
    } else {
      const cumple = venc.filter(a => {
        const d = A.cli.find(x => x.j === a.c);
        return d && d.ult != null && d.ult >= mesDe(a.f);
      }).length;
      nota.innerHTML = 'Cumplimiento de la agenda al corte (' + MES_CORTE_NOMBRE + ' ' + ANO_ACTUAL + '): <strong>' + cumple +
        '</strong> de <strong>' + venc.length + '</strong> visitas agendadas tienen una visita registrada ese mes o después (' +
        (cumple / venc.length * 100).toFixed(0) + '%). VISITAS viene por mes, así que se mide por mes y no por día.';
    }
  }
}

// ── Visitas programadas: las de la hoja VISITAS con fecha futura, a 15 días desde hoy ──
// El extractor separa de los conteos las filas de VISITAS con fecha posterior a su
// corrida y las deja en APP_DATA.visitas.programadas. Región, comuna, potencial y
// grupo se buscan por el nombre del cliente: primero en el plan RM/Valparaíso y,
// si no está, en Base Instalada y Mapa Clientes.
let VP_PROG_ORD = { col: null, asc: true };   // sin columna: el orden de la hoja
function vpProgOrden(col) {
  // Fecha parte ascendente y Potencial ST descendente; un segundo clic invierte.
  if (VP_PROG_ORD.col === col) VP_PROG_ORD.asc = !VP_PROG_ORD.asc;
  else VP_PROG_ORD = { col: col, asc: col !== 'pot' };
  vpProgramadas();
}
const VP_TARIFA_BI = { esterilizacion: 2043239, endoscopia: 898585, dental: 612671 };   // = _BI_TARIFA
let VP_PROG_IDX = null;
// Comunas que no están en el plan ni en Mapa Clientes y se buscaron en internet (clave: nombre normalizado).
// Superintendencia de Salud, registro de prestadores: Clínica Vespucio, Serafín Zamora 190.
const VP_COMUNA_WEB = {
  'CLINICA VESPUCIO SPA': 'La Florida',
  'CORPORACION MUNICIPAL DESARROLLO CERRO NAVIA': 'Cerro Navia',
  'ILUSTRE MUNICIPALIDAD DE CERRO NAVIA': 'Cerro Navia',
};
// Región de clientes que no están en ninguna hoja del Excel (clave: nombre normalizado). La comuna
// sale de VP_COMUNA_WEB, así que acá sólo van los que ahí tienen su comuna.
const VP_REGION_MANUAL = {
  'CORPORACION MUNICIPAL DESARROLLO CERRO NAVIA': 'Metropolitana',
  'ILUSTRE MUNICIPALIDAD DE CERRO NAVIA': 'Metropolitana',
};

function vpProgDatosCliente(nombre) {
  if (!VP_PROG_IDX) {
    const P = vpPlan();
    VP_PROG_IDX = {
      plan: vxIndice(P ? P.clientes : [], u => u.n),
      excl: vxIndice(P ? (P.excluidos || []) : [], e => e.n),   // clientes con contrato Activado, fuera del plan
      bi: vxIndice(((APP_DATA.base_instalada || {}).clientes) || [], c => c.nombre),
      mapa: vxIndice(window.MAPA_DATA || [], m => m.n),
    };
  }
  const ix = VP_PROG_IDX;
  const alias = VP_ALIAS[vxNorm(nombre)];
  const u = vxBuscar(ix.plan, nombre) || (alias ? vxBuscar(ix.plan, alias) : null);
  const b = vxBuscar(ix.bi, nombre), m = vxBuscar(ix.mapa, nombre);
  const ex = u ? null : (vxBuscar(ix.excl, nombre) || (alias ? vxBuscar(ix.excl, alias) : null));
  const contrato = !u && !!(ex || (b && b.cv));
  let region = '', com = '', pot = null, g = null;
  if (u) { region = u.r; com = u.com || ''; pot = u.pot || 0; g = u.g; }
  if (!region && ex && ex.r) region = ex.r;
  if (!u && b) {
    pot = b.cv ? 0 : Object.keys(VP_TARIFA_BI).reduce((t, k) => t + (b[k] || 0) * VP_TARIFA_BI[k], 0);
  }
  if (!region && m && m.region && m.region !== 'Sin región') region = m.region;
  if (!region && b && b.region && b.region !== 'Sin región') region = b.region;
  if (!region) region = vxRegionPorNombre(nombre) || '';
  if (!region) region = VP_REGION_MANUAL[vxNorm(nombre)] || '';
  // Comuna: plan > Mapa Clientes > búsqueda en internet.
  if (!com && m && m.comuna) com = m.comuna;
  if (!com) com = VP_COMUNA_WEB[vxNorm(nombre)] || '';
  if (contrato) pot = 0;
  return { region: region ? vxRegNom(region) : 'Sin región', com: com, pot: pot, g: g, contrato: contrato };
}

// ── Ubicación de cada visita programada ──
// Orden: plan RM/Valparaíso > Cartera ST (coordenadas por dirección o establecimiento) > Mapa Clientes >
// centro de la comuna (promedio de los clientes con ubicación en esa comuna) > centro de la región.
const VP_UBIC_PRECISA = { 'Dirección del cliente': 1, 'Establecimiento DEIS': 1, 'Base Mapa': 1, 'Mapa Clientes': 1 };
function vpProgGeo(nombre, d) {
  const ix = VP_PROG_IDX;
  if (!ix.car) {
    ix.car = vxIndice(((APP_DATA.cartera_st || {}).clientes) || [], c => c.n);
    const acc = {};
    const suma = (com, lat, lon, prec) => {
      if (!com || lat == null || prec === 'Aproximada (centro de la región)') return;
      const k = vxNorm(com), a = acc[k] || (acc[k] = { la: 0, lo: 0, n: 0 });
      a.la += lat; a.lo += lon; a.n++;
    };
    (((APP_DATA.cartera_st || {}).clientes) || []).forEach(c => suma(c.com, c.lat, c.lon, c.prec));
    ((vpPlan() || {}).clientes || []).forEach(c => suma(c.com, c.lat, c.lon, c.prec));
    ix.com = {};
    Object.keys(acc).forEach(k => { ix.com[k] = { lat: acc[k].la / acc[k].n, lon: acc[k].lo / acc[k].n }; });
  }
  const alias = VP_ALIAS[vxNorm(nombre)];
  const u = vxBuscar(ix.plan, nombre) || (alias ? vxBuscar(ix.plan, alias) : null);
  const c = vxBuscar(ix.car, nombre) || (alias ? vxBuscar(ix.car, alias) : null);
  const m = vxBuscar(ix.mapa, nombre);
  const de = o => ({ lat: o.lat, lon: o.lon, prec: o.prec || '', dir: o.dir || '' });
  let g = null;
  if (u && u.lat != null) g = de(u);
  if (!g && c && c.lat != null) g = de(c);
  if (g && !g.dir && c && c.dir) g.dir = c.dir;
  if (!g && m && m.lat != null) g = { lat: m.lat, lon: m.lon, prec: 'Mapa Clientes', dir: '' };
  if (g && g.prec === 'Aproximada (centro de la región)') g = null;     // peor que el centro de la comuna, si se conoce
  if (!g && d.com && ix.com[vxNorm(d.com)]) g = { lat: ix.com[vxNorm(d.com)].lat, lon: ix.com[vxNorm(d.com)].lon, prec: 'Centro de la comuna', dir: '' };
  if (!g && typeof _BI_GEO !== 'undefined' && _BI_GEO[d.region]) g = { lat: _BI_GEO[d.region].lat, lon: _BI_GEO[d.region].lon, prec: 'Centro de la región', dir: '' };
  if (g) g.aprox = !VP_UBIC_PRECISA[g.prec];
  return g;
}

// ── Estado de los filtros de la tarjeta ──
const VP_PF = { eje: 'todas', fecha: 'todos', sem: 'todo' };    // responsable y día elegido en el mapa
let VP_MAP = null, VP_CLUS = null, VP_CHART = null, VP_MARCAS = [];

// Ventana móvil: de hoy a hoy + 15 días. La usan la tabla, el gráfico y el mapa. El selector de
// semana la recorta a la semana actual (hoy hasta el domingo) o a la próxima (lunes a domingo).
function vpProgVentana() {
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const fin = new Date(hoy); fin.setDate(fin.getDate() + 15);
  const lun = new Date(hoy); lun.setDate(lun.getDate() - ((lun.getDay() + 6) % 7));     // lunes de esta semana
  const sem = (n) => { const a = new Date(lun), b = new Date(lun); a.setDate(a.getDate() + 7 * n); b.setDate(b.getDate() + 7 * n + 6); return [iso(a), iso(b)]; };
  let r0 = iso(hoy), r1 = iso(fin);
  if (VP_PF.sem === 'actual') r1 = sem(0)[1] < r1 ? sem(0)[1] : r1;
  if (VP_PF.sem === 'prox') { r0 = sem(1)[0]; r1 = sem(1)[1] < r1 ? sem(1)[1] : r1; }
  const fechas = [];
  for (let d = new Date(hoy); d <= fin; d.setDate(d.getDate() + 1)) { const f = iso(d); if (f >= r0 && f <= r1) fechas.push(f); }
  return { d0: r0, d1: r1, fechas: fechas, base0: iso(hoy), base1: iso(fin) };
}
function vpProgSem(k) { VP_PF.sem = k; VP_PF.fecha = 'todos'; vpProgramadas(); }
// Única fuente de la tarjeta: las visitas de la ventana, con el filtro de responsable.
function vpProgLista() {
  const PR = (APP_DATA.visitas || {}).programadas || [], W = vpProgVentana();
  return PR.filter(v => v.f >= W.d0 && v.f <= W.d1 && (VP_PF.eje === 'todas' || v.e === VP_PF.eje))
    .map(v => ({ v: v, d: vpProgDatosCliente(v.c) }));
}
function vpProgEje(e) { VP_PF.eje = e; vpProgramadas(); }
function vpProgFecha(f) {
  VP_PF.fecha = (!f || f === 'todos' || f === VP_PF.fecha) ? 'todos' : f;
  vpProgramadas();
}
const vpFmtF = s => s.split('-').reverse().join('/');
const vpDiaCorto = s => { const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '') + ' ' + s.slice(8) + '/' + s.slice(5, 7); };
const vpDiaLargo = s => { const d = new Date(s + 'T12:00:00'); return d.toLocaleDateString('es-CL', { weekday: 'long' }) + ' ' + vpFmtF(s); };

// ── Gráfico: visitas por día y responsable ──
function vpProgGrafico(lst, W) {
  const cv = document.getElementById('vp-prog-chart');
  if (!cv || !window.Chart) return;
  const ejes = Object.keys(VX.NOM).filter(e => VP_PF.eje === 'todas' || e === VP_PF.eje);
  const sel = VP_PF.fecha;
  const ds = ejes.map(e => ({
    label: VX.NOM[e], data: W.fechas.map(f => lst.filter(x => x.v.e === e && x.v.f === f).length),
    backgroundColor: VX.COL[e], borderRadius: 3,
    borderColor: W.fechas.map(f => f === sel ? '#FFC000' : VX.COL[e]),     // el día elegido en el mapa lleva borde dorado
    borderWidth: W.fechas.map(f => f === sel ? 3 : 0),
  }));
  if (VP_CHART) { VP_CHART.destroy(); VP_CHART = null; }
  VP_CHART = new Chart(cv.getContext('2d'), {
    type: 'bar',
    data: { labels: W.fechas.map(vpDiaCorto), datasets: ds },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: true },
      categoryPercentage: .7, barPercentage: .7,
      // Un clic en cualquier parte de la columna del día (aunque esa barra sea 0) elige ese día.
      onClick: (ev, els, ch) => {
        const col = ch.getElementsAtEventForMode(ev, 'index', { intersect: false }, true);
        if (col.length) vpProgFecha(W.fechas[col[0].index]);
      },
      onHover: (ev, els) => { ev.native.target.style.cursor = 'pointer'; },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: { callbacks: {
          title: c => vpDiaLargo(W.fechas[c[0].dataIndex]),
          label: c => c.dataset.label + ': ' + c.raw + (c.raw === 1 ? ' visita' : ' visitas'),
          footer: c => {
            const t = c.reduce((s, x) => s + x.raw, 0);
            return c.length > 1 ? 'Total: ' + t + (t === 1 ? ' visita' : ' visitas') : '';
          },
        } },
      },
      // Barras apiladas: cada día es una sola columna con las visitas de los dos ejecutivos.
      scales: {
        x: { stacked: true, grid: { color: '#E2E6F0' }, ticks: { font: { size: 9 }, maxRotation: 60, minRotation: 0 } },
        y: { stacked: true, beginAtZero: true, suggestedMax: 3, grid: { color: '#E2E6F0' }, ticks: { precision: 0, stepSize: 1, font: { size: 9 } },
             title: { display: true, text: 'Visitas programadas', font: { size: 9 }, color: '#6B7BA8' } },
      },
    },
  });
}

// ── Mapa: un pin por visita, con agrupación al alejar y despliegue al acercar ──
function vpPin(col) {
  return L.divIcon({
    className: 'vp-pin', iconSize: [26, 34], iconAnchor: [13, 33], popupAnchor: [0, -30],
    html: '<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"><path d="M13 1C6.4 1 1.5 6 1.5 12.4 1.5 21 13 33 13 33S24.5 21 24.5 12.4C24.5 6 19.6 1 13 1z" ' +
      'fill="' + col + '" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>',
  });
}
function vpProgMapa(lst) {
  const cont = document.getElementById('vp-prog-mapa');
  if (!cont || !window.L) return;
  if (!VP_MAP) {
    VP_MAP = L.map('vp-prog-mapa', { zoomControl: true, scrollWheelZoom: false }).setView([-33.9, -71.0], 8);
    if (window.mapaTiles) mapaTiles(VP_MAP);
    VP_CLUS = L.markerClusterGroup ? L.markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 38 })
                                   : L.layerGroup();
    VP_CLUS.addTo(VP_MAP);
  }
  VP_CLUS.clearLayers();
  VP_MARCAS = [];
  let sinUbic = 0;
  const nom = e => VX.NOM[e] || e;
  lst.forEach(x => {
    const g = vpProgGeo(x.v.c, x.d);
    if (!g) { sinUbic++; return; }
    const html = '<div style="font-size:.7rem;line-height:1.55;min-width:210px">' +
      '<div style="font-weight:700;color:#002D73;margin-bottom:.2rem">' + vxEsc(x.v.c) + '</div>' +
      '<div><strong>Fecha:</strong> ' + vpDiaLargo(x.v.f) + '</div>' +
      '<div><strong>Responsable:</strong> <span style="color:' + (VX.COL[x.v.e] || 'inherit') + ';font-weight:600">' + vxEsc(nom(x.v.e)) + '</span></div>' +
      '<div><strong>Comuna:</strong> ' + vxEsc(x.d.com || '—') + '</div>' +
      '<div><strong>Región:</strong> ' + vxEsc(x.d.region) + '</div>' +
      (g.dir ? '<div><strong>Dirección:</strong> ' + vxEsc(g.dir) + '</div>' : '') +
      (x.v.t ? '<div><strong>Actividad:</strong> ' + vxEsc(x.v.t) + '</div>' : '') +
      (g.aprox ? '<div style="color:var(--mut);font-size:.6rem;margin-top:.2rem">Ubicación aproximada (' + vxEsc(g.prec.toLowerCase()) + ')</div>' : '') +
      '</div>';
    const mk = L.marker([g.lat, g.lon], { icon: vpPin(VX.COL[x.v.e] || '#003F7F'), title: x.v.c }).bindPopup(html);
    mk._vpF = x.v.f;
    VP_MARCAS.push(mk);
    if (VP_PF.fecha === 'todos' || VP_PF.fecha === x.v.f) VP_CLUS.addLayer(mk);
  });
  const nota = document.getElementById('vp-prog-mapa-nota');
  const vis = VP_MARCAS.filter(m => VP_PF.fecha === 'todos' || m._vpF === VP_PF.fecha).length;
  if (nota) nota.innerHTML = '<strong>' + vis + '</strong> ' + (vis === 1 ? 'visita' : 'visitas') + ' en el mapa' +
    (VP_PF.fecha === 'todos' ? '' : ' · ' + vpDiaLargo(VP_PF.fecha)) +
    (sinUbic ? ' · <span style="color:var(--rd)">' + sinUbic + ' sin ubicación conocida</span>' : '');
  const vistos = VP_MARCAS.filter(m => VP_PF.fecha === 'todos' || m._vpF === VP_PF.fecha);
  if (vistos.length) {
    try { VP_MAP.fitBounds(L.latLngBounds(vistos.map(m => m.getLatLng())).pad(.2), { maxZoom: 13 }); } catch (e) {}
  }
  setTimeout(() => { if (VP_MAP) VP_MAP.invalidateSize(); }, 60);
}

// Revisión: por día, filas de la tabla = puntos del gráfico = pins del mapa.
window.vpProgValida = function () {
  const W = vpProgVentana(), out = [];
  const guarda = VP_PF.fecha;
  VP_PF.fecha = 'todos'; vpProgramadas();
  W.fechas.forEach(f => {
    const tabla = document.querySelectorAll('#vp-prog-tabla tbody tr[data-f="' + f + '"]').length;
    const idx = W.fechas.indexOf(f);
    const graf = VP_CHART ? VP_CHART.data.datasets.reduce((s, d) => s + d.data[idx], 0) : null;
    const mapa = VP_MARCAS.filter(m => m._vpF === f).length;
    out.push({ f: f, tabla: tabla, grafico: graf, mapa: mapa, ok: tabla === graf && graf === mapa });
  });
  VP_PF.fecha = guarda; vpProgramadas();
  return out;
};

function vpProgramadas() {
  const tab = document.getElementById('vp-prog-tabla');
  if (!tab) return;
  const W = vpProgVentana(), d0 = W.d0, d1 = W.d1, fmt = vpFmtF;
  const PR = (APP_DATA.visitas || {}).programadas || [];
  const lst = vpProgLista();

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const porHoja = (x, y) => cmp(x.v.f, y.v.f) || cmp(x.v.e, y.v.e) || cmp(x.v.c, y.v.c);
  const sg = VP_PROG_ORD.asc ? 1 : -1;
  const ORD = {
    fecha: (x, y) => sg * cmp(x.v.f, y.v.f) || porHoja(x, y),
    pot: (x, y) => sg * ((x.d.pot || 0) - (y.d.pot || 0)) || porHoja(x, y),
  };
  lst.sort(ORD[VP_PROG_ORD.col] || ((x, y) => cmp(x.d.region, y.d.region) || porHoja(x, y)));

  vpBotones('vp-prog-sem', [{ k: 'todo', t: 'Próximos 15 días' }, { k: 'actual', t: 'Semana actual' }, { k: 'prox', t: 'Próxima semana' }], VP_PF.sem, 'vpProgSem');
  // Filtro de responsable (afecta tabla, gráfico y mapa)
  vpBotones('vp-prog-eje', [{ k: 'todas', t: 'Todas' }].concat(Object.keys(VX.NOM).map(e =>
    ({ k: e, t: VX.NOM[e].split(' ')[0], col: VX.COL[e] }))), VP_PF.eje, 'vpProgEje');

  const lbl = document.getElementById('vp-prog-lbl'), res = document.getElementById('vp-prog-res');
  if (lbl) lbl.innerHTML = fmt(d0) + ' al ' + fmt(d1) + ' · <strong>' + lst.length + '</strong> visitas · potencial ST <strong>' +
    vxMM(lst.reduce((t, x) => t + (x.d.pot || 0), 0)) + '</strong>';

  // Selector de día del mapa: todos los días de la ventana, con su cantidad de visitas
  const sel = document.getElementById('vp-prog-fecha');
  if (sel) {
    sel.innerHTML = '<option value="todos">Todos los días (' + lst.length + ')</option>' + W.fechas.map(f =>
      '<option value="' + f + '">' + vpDiaCorto(f) + ' (' + lst.filter(x => x.v.f === f).length + ')</option>').join('');
    sel.value = VP_PF.fecha;
  }
  const viz = document.getElementById('vp-prog-viz');
  if (viz) viz.style.display = PR.some(v => v.f >= W.base0 && v.f <= W.base1) ? '' : 'none';

  if (!lst.length) {
    if (res) res.innerHTML = '';
    tab.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--mut);font-size:.65rem;line-height:1.6">No hay visitas programadas entre ' +
      fmt(d0) + ' y ' + fmt(d1) + (VP_PF.eje === 'todas' ? '' : ' para ' + VX.NOM[VP_PF.eje]) + '.<br>Se leen de la hoja VISITAS: filas con <strong>fecha posterior a la del último procesamiento</strong>' +
      (PR.length ? ' (hay ' + PR.length + ' más adelante, entre ' + fmt(PR[0].f) + ' y ' + fmt(PR[PR.length - 1].f) + ')' : '') + '.</div>';
    vpProgGrafico(lst, W); vpProgMapa(lst);
    return;
  }
  const ejes = Array.from(new Set(lst.map(x => x.v.e))), regs = Array.from(new Set(lst.map(x => x.d.region)));
  const nom = e => VX.NOM[e] || e;
  const cnt = (r, e) => lst.filter(x => (r == null || x.d.region === r) && (e == null || x.v.e === e)).length;
  const chip = (t, n, col) => '<span style="display:inline-block;margin:0 .3rem .25rem 0;padding:.2rem .55rem;border-radius:12px;font-size:.6rem;' +
    'background:var(--bg2);border-left:3px solid ' + (col || 'var(--az2)') + '">' + vxEsc(t) + ' <strong>' + n + '</strong></span>';
  if (res) res.innerHTML = regs.map(r => chip(r, cnt(r, null), '#003F7F')).join('') + '<br>' +
    regs.map(r => ejes.map(e => cnt(r, e) ? chip((r === 'Metropolitana' ? 'RM' : r) + ' · ' + nom(e).split(' ')[0], cnt(r, e), VX.COL[e]) : '').join('')).join('');
  const th = (t, al, col) => {
    const act = col && VP_PROG_ORD.col === col;
    const flecha = col ? ' <span style="font-size:.5rem;opacity:' + (act ? 1 : .55) + '">' + (act ? (VP_PROG_ORD.asc ? '▲' : '▼') : '⇅') + '</span>' : '';
    return '<th style="position:sticky;top:0;background:var(--az1);color:#fff;padding:.3rem .45rem;font-size:.54rem;text-align:' +
      (al || 'left') + ';white-space:nowrap' + (col ? ';cursor:pointer;user-select:none' : '') + '"' +
      (col ? ' onclick="vpProgOrden(&quot;' + col + '&quot;)" title="Ordenar por ' + t.toLowerCase() + '"' : '') + '>' + t + flecha + '</th>';
  };
  const td = (v, ex) => '<td style="padding:.24rem .45rem;font-size:.6rem;border-bottom:1px solid var(--brd);' + (ex || '') + '">' + v + '</td>';
  const CONTR = '<span style="color:var(--teal);font-weight:700;font-size:.55rem">CLIENTE CON CONTRATO</span>';
  let h = '<table style="width:100%;border-collapse:collapse"><thead><tr>' + th('Cliente') + th('Ejecutivo') + th('Región') +
    th('Comuna') + th('Fecha', 'left', 'fecha') + th('Actividad') + th('Grupo', 'center') + th('Potencial ST', 'right', 'pot') + '</tr></thead><tbody>';
  lst.forEach(x => {
    const g = x.d.g, activa = VP_PF.fecha === x.v.f;
    // Clic en una fila: el mapa muestra sólo las visitas de ese día (otro clic en el mismo día vuelve a todos).
    h += '<tr data-f="' + x.v.f + '" onclick="vpProgFecha(\'' + x.v.f + '\')" title="Clic para ver en el mapa las visitas del ' + fmt(x.v.f) + '" ' +
      'style="cursor:pointer;' + (activa ? 'background:rgba(255,192,0,.22)' : '') + '">' +
      td('<strong>' + vxEsc(x.v.c) + '</strong>') +
      td('<span style="color:' + (VX.COL[x.v.e] || 'inherit') + ';font-weight:600">' + vxEsc(nom(x.v.e)) + '</span>') +
      td(vxEsc(x.d.region)) + td(vxEsc(x.d.com || '—')) + td(fmt(x.v.f), 'white-space:nowrap' + (activa ? ';font-weight:700' : '')) +
      td(vxEsc(x.v.t || x.v.a || '—')) +
      td(x.d.contrato ? CONTR : g ? '<span style="color:' + (VP_GCOL[g] || 'inherit') + ';font-weight:700">G' + g + '</span>' : '<span style="color:var(--mut)">—</span>', 'text-align:center;white-space:nowrap') +
      td(x.d.contrato ? CONTR : x.d.pot == null ? '<span style="color:var(--mut)">—</span>' : vxMM(x.d.pot), 'text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap') + '</tr>';
  });
  tab.innerHTML = h + '</tbody></table>';
  vpProgGrafico(lst, W);
  vpProgMapa(lst);
}

// ── Cobertura por grupo y región ──
function vpGrupos(A) {
  const box = document.getElementById('vp-grp-tabla');
  if (!box) return;
  const SEP = 'border-right:1px solid var(--brd)';
  const th = (t, al) => '<th style="position:sticky;top:0;background:var(--az1);color:#fff;padding:.3rem .45rem;font-size:.54rem;' +
    'text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
  const td = (v, extra) => '<td style="padding:.24rem .45rem;text-align:right;font-size:.6rem;font-variant-numeric:tabular-nums;' +
    (extra || '') + SEP + '">' + v + '</td>';
  const fila = (lbl, ds, col, fuerte) => {
    const n = ds.length, vis = ds.filter(d => d.v > 0), v = vis.reduce((s, d) => s + d.v, 0);
    const pot = ds.reduce((s, d) => s + (d.u.pot || 0), 0), pv = vis.reduce((s, d) => s + (d.u.pot || 0), 0);
    const pc = n ? vis.length / n * 100 : 0;
    return '<tr style="' + (fuerte ? 'background:var(--bg2);font-weight:700;' : '') + 'border-left:3px solid ' + col + '">' +
      '<td style="padding:.24rem .45rem;font-size:.6rem;white-space:nowrap;' + (fuerte ? 'font-weight:800;color:' + col + ';' : '') + SEP + '">' + lbl + '</td>' +
      td(n) + td(vis.length, 'font-weight:700;color:' + col + ';') +
      '<td style="padding:.24rem .45rem;min-width:120px;' + SEP + '"><div style="display:flex;align-items:center;gap:.35rem">' +
        '<div style="flex:1;height:6px;background:var(--gy);border-radius:3px;overflow:hidden"><div style="height:100%;width:' +
        pc + '%;background:' + col + '"></div></div><span style="font-size:.58rem;font-weight:700;min-width:2.3rem;text-align:right">' +
        pc.toFixed(0) + '%</span></div></td>' +
      td(v || '—') + td(vis.length ? vxN1(v / vis.length) : '—', 'color:var(--mut);') +
      td(pot ? vxMM(pot) : '—', 'color:var(--mut);') + td(pv ? vxMM(pv) : '—', 'color:var(--am);font-weight:700;') +
      td(pot ? (pv / pot * 100).toFixed(0) + '%' : '—') + '</tr>';
  };
  let filas = '';
  [1, 2, 3].forEach(g => {
    const dg = A.cli.filter(d => d.u.g === g);
    if (!dg.length) return;
    filas += fila(VP_GNOM[g], dg, VP_GCOL[g], true);
    A.REGS.forEach(r => {
      const dr = dg.filter(d => d.u.r === r);
      if (dr.length) filas += fila('&nbsp;&nbsp;' + (r === 'Metropolitana' ? 'Región Metropolitana' : 'Región de ' + r), dr, VP_GCOL[g]);
    });
  });
  box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:760px"><thead><tr>' +
    th('GRUPO / REGIÓN', 'left') + th('CLIENTES', 'right') + th('VISITADOS', 'right') + th('COBERTURA', 'left') +
    th('VISITAS', 'right') + th('VIS./VISITADO', 'right') + th('POT. ST', 'right') + th('POT. VISITADO', 'right') +
    th('% POT.', 'right') + '</tr></thead><tbody>' + filas + '</tbody><tfoot>' +
    fila('TOTAL', A.cli, 'var(--az3)', true).replace('<tr style="', '<tr style="border-top:2px solid var(--az3);') +
    '</tfoot></table>';
}

// ── Cobertura por ejecutivo responsable ──
// No usa el filtro de ejecutivo: la tabla ya está partida por ejecutivo y lo
// que muestra es justamente quién visitó la cartera de quién.
function vpResponsables(A0) {
  const box = document.getElementById('vp-eje-tabla');
  if (!box) return;
  const P = vpPlan();
  const guard = VP.f.eje; VP.f.eje = 'todos';
  const A = guard === 'todos' ? A0 : vpAgg();
  VP.f.eje = guard;
  const SEP = 'border-right:1px solid var(--brd)';
  const ejes = P.ejecutivos || [];
  const filas = ejes.map(e => {
    const ed = vpEjeDet(e);
    const suyos = A.cli.filter(d => d.u.resp === e);
    const porEl = suyos.filter(d => (d.eje[ed] || 0) > 0).length;
    const soloOtro = suyos.filter(d => d.v > 0 && !(d.eje[ed] > 0)).length;
    const sin = suyos.filter(d => !d.v).length;
    const vPropia = suyos.reduce((s, d) => s + (d.eje[ed] || 0), 0);
    const vAjena = A.cli.filter(d => d.u.resp !== e).reduce((s, d) => s + (d.eje[ed] || 0), 0);
    const potSin = suyos.filter(d => !d.v).reduce((s, d) => s + (d.u.pot || 0), 0);
    return { e: e, col: VX.COL[ed] || '#003F7F', n: suyos.length, porEl: porEl, soloOtro: soloOtro, sin: sin,
             vPropia: vPropia, vAjena: vAjena, potSin: potSin };
  });
  const th = t => '<th style="background:var(--az1);color:#fff;padding:.3rem .5rem;font-size:.55rem;text-align:right;' +
    'border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
  const fila = (lbl, fn, ayuda) => '<tr><td style="padding:.24rem .5rem;font-size:.6rem;color:var(--mut);' + SEP + '"' +
    (ayuda ? ' title="' + vxEsc(ayuda) + '"' : '') + '>' + lbl + '</td>' + filas.map(r =>
      '<td style="padding:.24rem .5rem;text-align:right;font-size:.63rem;font-weight:700;font-variant-numeric:tabular-nums;' + SEP + '">' +
      fn(r) + '</td>').join('') + '</tr>';
  const pct = (a, b) => b ? ' · ' + Math.round(a / b * 100) + '%' : '';
  box.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
    '<th style="background:var(--az1);color:#fff;padding:.3rem .5rem;font-size:.55rem;text-align:left;' + SEP + '">SU CARTERA EN EL PLAN</th>' +
    filas.map(r => th(vxEsc(r.e).toUpperCase())).join('') + '</tr></thead><tbody>' +
    fila('Clientes asignados', r => '<span style="color:' + r.col + '">' + r.n + '</span>', 'Por comuna, según la hoja Plan RM') +
    fila('Visitados por él/ella', r => r.porEl + pct(r.porEl, r.n)) +
    fila('Visitados sólo por el otro', r => r.soloOtro + pct(r.soloOtro, r.n), 'Clientes de su cartera que en el período visitó únicamente el otro ejecutivo') +
    fila('Sin ninguna visita', r => '<span style="color:var(--rd)">' + r.sin + pct(r.sin, r.n) + '</span>') +
    fila('Potencial ST sin visitar', r => '<span style="color:var(--am)">' + vxMM(r.potSin) + '</span>') +
    fila('Visitas a su cartera', r => r.vPropia) +
    fila('Visitas a la cartera del otro', r => r.vAjena, 'Visitas a clientes del plan que por comuna le tocan al otro ejecutivo') +
    '</tbody></table>';
}

// ── Evolución mensual ──
function vpEvolucion(A) {
  const ctx = document.getElementById('cVpEvo');
  if (!ctx || typeof safeChart !== 'function') return;
  if (VP.chEvo) VP.chEvo.destroy();
  const meses = MESES_ABR.slice(0, MES_CORTE);
  const det = APP_DATA.visitas.det;
  const ds = det.ejecutivos.filter(e => A.mesEje[e].some(x => x > 0)).map(e => ({
    label: (VX.NOM[e] || e) + ' ' + ANO_ACTUAL, data: A.mesEje[e].slice(0, MES_CORTE),
    backgroundColor: VX.COL[e], borderRadius: 4, stack: 'a', order: 2 }));
  ds.push({ label: 'Total ' + (ANO_ACTUAL - 1), data: A.mesAnt.slice(0, MES_CORTE), type: 'line', borderColor: '#8A93AB',
    backgroundColor: 'rgba(138,147,171,.12)', borderDash: [5, 4], pointRadius: 3, borderWidth: 2, tension: .3, order: 1 });
  VP.chEvo = safeChart(ctx.getContext('2d'), {
    type: 'bar', data: { labels: meses, datasets: ds },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
        tooltip: { mode: 'index', callbacks: { label: c => ' ' + c.dataset.label + ': ' + c.parsed.y + ' visitas' } } },
      scales: { x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { color: '#E2E6F0' }, ticks: { stepSize: 1 } } } },
  });
  const lbl = document.getElementById('vp-evo-lbl');
  const vr = A.totAnt ? (A.totAct - A.totAnt) / A.totAnt * 100 : null;
  if (lbl) lbl.textContent = A.totAct + ' visitas en ' + ANO_ACTUAL + ' vs ' + A.totAnt + ' en ' + (ANO_ACTUAL - 1) +
    ' (Ene–' + MES_CORTE_NOMBRE + ')' + (vr == null ? '' : ' · ' + (vr >= 0 ? '+' : '') + vr.toFixed(0) + '%');
}

// ── Tabla de clientes del plan ──
function vpTabla(A) {
  const box = document.getElementById('vp-cli-tabla');
  if (!box) return;
  const P = vpPlan();
  vpBotones('vp-f-est', [{ k: 'todos', t: 'Todos' }, { k: 'si', t: 'Visitados' }, { k: 'no', t: 'Sin visita' }],
    VP.f.est, 'vpSetEst');
  const q = vxNorm(VP.f.q);
  const lista = A.cli.filter(d => (VP.f.est === 'todos' || (VP.f.est === 'si' ? d.v > 0 : !d.v)) &&
    (!q || vxNorm(d.u.n + ' ' + (d.u.com || '')).indexOf(q) >= 0));
  const val = d => VP.sort === 'n' ? d.u.n : VP.sort === 'v' ? d.v : VP.sort === 'pot' ? (d.u.pot || 0)
    : VP.sort === 'cam' ? (d.u.cam || 0) : VP.sort === 'ult' ? (d.ult || 0) : d.u.g * 1e4 + (d.u.rk || 0);
  lista.sort((a, b) => {
    const x = val(a), y = val(b);
    const c = typeof x === 'string' ? x.localeCompare(y, 'es') : x - y;
    return (VP.asc ? c : -c) || a.u.g - b.u.g || (a.u.rk || 0) - (b.u.rk || 0);
  });
  const ejes = P.ejecutivos || [];
  const SEP = 'border-right:1px solid var(--brd)';
  const th = (t, col, al) => '<th' + (col ? ' onclick="vpSort(\'' + col + '\')"' : '') + ' style="position:sticky;top:0;z-index:2;' +
    'background:var(--az1);color:#fff;padding:.3rem .45rem;font-size:.54rem;text-align:' + al + ';white-space:nowrap;' +
    (col ? 'cursor:pointer;' : '') + 'border-right:1px solid rgba(255,255,255,.18)">' + t +
    (col && VP.sort === col ? (VP.asc ? ' ▲' : ' ▼') : '') + '</th>';
  const td = (v, extra) => '<td style="padding:.24rem .45rem;font-size:.6rem;' + (extra || '') + SEP + '">' + v + '</td>';
  const num = (v, extra) => td(v, 'text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;' + (extra || ''));
  const mesTxt = idx => { if (!idx) return '—'; const a = Math.floor((idx - 1) / 12), m = (idx - 1) % 12;
    return MESES_ABR[m] + " '" + String(a).slice(2); };
  const fCorta = iso => iso ? iso.split('-').reverse().slice(0, 2).join('/') : '—';
  const filas = lista.map((d, i) => {
    const u = d.u, col = VP_GCOL[u.g];
    const ed = vpEjeDet(u.resp);
    const otro = d.v > 0 && !(d.eje[ed] > 0);
    return '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + ';border-left:3px solid ' + col + '">' +
      td('<span style="color:#fff;background:' + col + ';border-radius:3px;padding:.02rem .3rem;font-weight:700;font-size:.55rem">G' +
        u.g + '</span> <span style="color:var(--mut);font-size:.55rem">#' + u.rk + '</span>', 'white-space:nowrap;') +
      td('<div style="font-weight:700;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' +
        vxEsc(u.n) + '">' + vxEsc(u.n) + '</div><div style="font-size:.53rem;color:var(--mut)">' +
        vxEsc(u.com || 'comuna sin dato') + ' · ' + (u.r === 'Metropolitana' ? 'RM' : vxEsc(u.r)) + '</div>') +
      td('<span style="font-weight:700;color:' + (VX.COL[ed] || 'var(--txt)') + '">' + vxEsc(String(u.resp || '').split(' ')[0]) + '</span>', 'white-space:nowrap;') +
      num(u.pot ? vxMM(u.pot) : '—', 'color:var(--am);') +
      num(u.camF === 'Sin internación' ? '—' : vxN0(u.cam) + (u.camF === 'Estimado' ? '*' : ''), 'color:var(--mut);') +
      num(d.v ? '<strong>' + d.v + '</strong>' : '<span style="color:var(--rd)">0</span>') +
      ejes.map(e => num(d.eje[vpEjeDet(e)] || '—', 'color:' + (VX.COL[vpEjeDet(e)] || 'var(--txt)') + ';')).join('') +
      num(mesTxt(d.ult), 'color:var(--mut);') +
      num(d.v25 + ' → ' + d.v26, 'color:var(--mut);font-size:.56rem;') +
      num(u.g === 1 ? '<span style="color:' + col + '">cartera propia</span>' : fCorta(u.v1), 'color:var(--mut);') +
      td(otro ? '<span style="color:var(--or);font-size:.55rem;font-weight:700">lo visitó el otro</span>' : '', 'white-space:nowrap;') +
      '</tr>';
  }).join('');
  const nCol = 10 + ejes.length;
  box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:1100px"><thead><tr>' +
    th('GRUPO', 'g', 'left') + th('CLIENTE', 'n', 'left') + th('RESPONSABLE', '', 'left') + th('POT. ST', 'pot', 'right') +
    th('CAMAS', 'cam', 'right') + th('VISITAS', 'v', 'right') +
    ejes.map(e => th(vxEsc(String(e).split(' ')[0]).toUpperCase(), '', 'right')).join('') +
    th('ÚLTIMA', 'ult', 'right') + th((ANO_ACTUAL - 1) + ' → ' + ANO_ACTUAL, '', 'right') + th('1ª EN AGENDA', '', 'right') + th('', '', 'left') +
    '</tr></thead><tbody>' + (filas || '<tr><td colspan="' + nCol + '" style="padding:1rem;text-align:center;color:var(--mut);' +
    'font-style:italic">Sin clientes para los filtros elegidos</td></tr>') + '</tbody></table>';
  const lbl = document.getElementById('vp-cli-lbl');
  if (lbl) lbl.textContent = lista.length + ' clientes · ' + lista.filter(d => d.v > 0).length + ' visitados';
}

// ── A dónde van las visitas ──
// Todas las visitas del período —no sólo las del plan— repartidas por destino y
// por tipo de actividad. Explica por qué la cobertura del plan es la que es.
// Respeta el período y el ejecutivo; no la región ni el grupo, que son
// atributos de los clientes del plan y no aplican al resto.
function vpDestinos() {
  const box = document.getElementById('vp-dest-tabla');
  if (!box) return;
  vpCruce();
  const det = APP_DATA.visitas.det;
  const CATS = [
    ['g1', VP_GNOM[1], VP_GCOL[1], true], ['g2', VP_GNOM[2], VP_GCOL[2], true], ['g3', VP_GNOM[3], VP_GCOL[3], true],
    ['contrato', 'RM y Valparaíso · con contrato Activado (fuera del plan)', '#0A7D74'],
    ['sinpot', 'RM y Valparaíso · sin Potencial ST (no están en el plan)', '#6B7BA8'],
    ['otras', 'Otras regiones', '#8A93AB'],
  ];
  const agg = {};
  CATS.forEach(c => { agg[c[0]] = { cli: new Set(), v: 0, tipo: {}, eje: {}, top: {} }; });
  det.filas.forEach(f => {
    const eje = det.ejecutivos[f[0]], ano = f[3], mes = f[4], n = f[5];
    if (VP.f.eje !== 'todos' && eje !== VP.f.eje) return;
    const esAct = ano === ANO_ACTUAL && mes <= MES_CORTE, esAnt = ano === ANO_ACTUAL - 1 && mes <= MES_CORTE;
    if (!(VP.f.per === 'todo' || (VP.f.per === String(ANO_ACTUAL) ? esAct : esAnt))) return;
    const a = agg[VP.destino[f[1]]];
    const t = det.tipos[f[2]];
    a.cli.add(f[1]); a.v += n;
    a.tipo[t] = (a.tipo[t] || 0) + n;
    a.eje[eje] = (a.eje[eje] || 0) + n;
    a.top[f[1]] = (a.top[f[1]] || 0) + n;
  });
  const tot = CATS.reduce((s, c) => s + agg[c[0]].v, 0);
  const nCli = CATS.reduce((s, c) => s + agg[c[0]].cli.size, 0);
  const SEP = 'border-right:1px solid var(--brd)';
  const th = (t, al) => '<th style="position:sticky;top:0;background:var(--az1);color:#fff;padding:.3rem .45rem;font-size:.54rem;' +
    'text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
  const td = (v, extra) => '<td style="padding:.24rem .45rem;text-align:right;font-size:.6rem;font-variant-numeric:tabular-nums;' +
    (extra || '') + SEP + '">' + v + '</td>';
  const maxV = Math.max.apply(null, CATS.map(c => agg[c[0]].v).concat([1]));
  const fila = (lbl, a, col, estilo) => {
    const top = Object.keys(a.top).sort((x, y) => a.top[y] - a.top[x]).slice(0, 3)
      .map(i => vxEsc(det.clientes[i]) + ' (' + a.top[i] + ')').join(' · ');
    return '<tr style="border-left:3px solid ' + col + ';' + (estilo || '') + '">' +
      '<td style="padding:.24rem .45rem;font-size:.6rem;white-space:nowrap;' + SEP + '">' + lbl + '</td>' +
      td(a.cli.size) + td('<strong>' + a.v + '</strong>') +
      '<td style="padding:.24rem .45rem;min-width:110px;' + SEP + '"><div style="display:flex;align-items:center;gap:.35rem">' +
        '<div style="flex:1;height:6px;background:var(--gy);border-radius:3px;overflow:hidden"><div style="height:100%;width:' +
        (a.v / maxV * 100) + '%;background:' + col + '"></div></div><span style="font-size:.58rem;font-weight:700;min-width:2.3rem;' +
        'text-align:right">' + (tot ? (a.v / tot * 100).toFixed(0) : 0) + '%</span></div></td>' +
      det.tipos.map(t => td(a.tipo[t] || '—', 'color:var(--mut);')).join('') +
      det.ejecutivos.map(e => td(a.eje[e] || '—', 'color:' + (VX.COL[e] || 'var(--txt)') + ';')).join('') +
      '<td style="padding:.24rem .45rem;font-size:.55rem;color:var(--mut);max-width:360px;overflow:hidden;text-overflow:ellipsis;' +
        'white-space:nowrap" title="' + top.replace(/"/g, '&quot;') + '">' + (top || '—') + '</td></tr>';
  };
  const suma = keys => {
    const r = { cli: new Set(), v: 0, tipo: {}, eje: {}, top: {} };
    keys.forEach(k => { const a = agg[k]; a.cli.forEach(i => r.cli.add(i)); r.v += a.v;
      Object.keys(a.tipo).forEach(t => { r.tipo[t] = (r.tipo[t] || 0) + a.tipo[t]; });
      Object.keys(a.eje).forEach(e => { r.eje[e] = (r.eje[e] || 0) + a.eje[e]; });
      Object.keys(a.top).forEach(i => { r.top[i] = (r.top[i] || 0) + a.top[i]; }); });
    return r;
  };
  let filas = fila('<strong>Clientes del plan</strong>', suma(['g1', 'g2', 'g3']), 'var(--az3)', 'background:var(--bg2);font-weight:700;');
  CATS.forEach(c => {
    filas += fila((c[3] ? '&nbsp;&nbsp;' : '') + c[1], agg[c[0]], c[2]);
  });
  const total = suma(CATS.map(c => c[0]));
  box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:1100px"><thead><tr>' +
    th('DESTINO DE LAS VISITAS', 'left') + th('CLIENTES', 'right') + th('VISITAS', 'right') + th('% VISITAS', 'left') +
    det.tipos.map(t => th(vxEsc(t).toUpperCase(), 'right')).join('') +
    det.ejecutivos.map(e => th(vxEsc((VX.NOM[e] || e).split(' ')[0]).toUpperCase(), 'right')).join('') +
    th('CLIENTES CON MÁS VISITAS', 'left') + '</tr></thead><tbody>' + filas + '</tbody><tfoot>' +
    fila('<strong>TOTAL</strong>', total, 'var(--az3)', 'border-top:2px solid var(--az3);font-weight:700;') + '</tfoot></table>';
  const lbl = document.getElementById('vp-dest-lbl');
  if (lbl) lbl.textContent = vxN0(tot) + ' visitas a ' + nCli + ' clientes · ' +
    (VP.f.per === 'todo' ? 'todo el histórico' : 'Ene–' + MES_CORTE_NOMBRE + ' ' + VP.f.per) +
    (VP.f.eje === 'todos' ? '' : ' · ' + (VX.NOM[VP.f.eje] || VP.f.eje));
}

function vpRender() {
  const P = vpPlan(), sec = document.getElementById('vp-sec');
  if (!P || !((APP_DATA.visitas || {}).det || {}).filas) { if (sec) sec.style.display = 'none'; return; }
  const A = vpAgg();
  vpPintaFiltros(A);
  vpKpis(A);
  vpGrupos(A);
  vpResponsables(A);
  vpEvolucion(A);
  vpTabla(A);
  vpDestinos();
}
