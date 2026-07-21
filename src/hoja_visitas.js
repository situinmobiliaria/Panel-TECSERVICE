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
