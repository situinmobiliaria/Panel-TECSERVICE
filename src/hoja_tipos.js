// ═══════════════════════════════════════════════════════════════
// hoja_tipos.js — Tipos de Contrato + Análisis de Cartera
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════

// ─── TIPOS DE CONTRATO ────────────────────────────────────────
function initTipos(){
  const com=DATA.filter(d=>d.tipo==='Comercial').sort((a,b)=>b.val-a.val);
  const gar=DATA.filter(d=>d.tipo==='Garantia').sort((a,b)=>b.val-a.val||b.tpo_activo-a.tpo_activo);
  const totalComVal=com.reduce((s,d)=>s+d.val,0);
  const totalGarVal=gar.reduce((s,d)=>s+d.val,0);
  const totalGarN=gar.length;

  // ─── KPIs dinámicos desde DATA ───────────────────────────────
  const comCli=new Set(com.map(d=>d.cliente)).size;
  const garCli=new Set(gar.map(d=>d.cliente)).size;
  const garPctProm=gar.length>0?Math.round(gar.reduce((s,d)=>s+d.pct_consumido,0)/gar.length):0;
  // Contratos facturado: misma fuente que hoja Facturación (suma presup_contr_ytd del panel)
  const facContrYTD=APP_DATA.panel.reduce((s,p)=>s+(p.presup_contr_ytd||0),0);
  const facTotalYTD=(APP_DATA.analisis_fac&&APP_DATA.analisis_fac.ts_ingresos>0)
    ? APP_DATA.analisis_fac.ts_ingresos
    : APP_DATA.panel.reduce((s,p)=>s+(p.real_ytd||0),0);
  const pctContr=facTotalYTD>0?(facContrYTD/facTotalYTD*100).toFixed(1):0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('tc-kpi-com-n',com.length);
  set('tc-kpi-com-sub',comCli+' clientes · '+mm(totalComVal)+' anual');
  set('tc-kpi-fac-val',mm(facContrYTD));
  set('tc-kpi-fac-sub',pctContr+'% facturación área · Ene–'+MES_CORTE_NOMBRE+' '+ANO_ACTUAL);
  set('tc-kpi-gar-n',gar.length);
  set('tc-kpi-gar-sub',garCli+' clientes · '+mm(totalGarVal)+' cartera');
  set('tc-kpi-gar-pct',garPctProm+'%');
  const btns=document.querySelectorAll('#view-tipos .tabs .tab-btn');
  if(btns[0])btns[0].textContent='Tipo Comercial ('+com.length+')';
  if(btns[1])btns[1].textContent='Tipo Garantía ('+gar.length+')';
  set('tc-foot-com-txt',com.length+' contratos tipo Comercial · '+comCli+' clientes únicos');
  set('tc-foot-com-val',mm(totalComVal)+' cartera anual');
  set('tc-foot-gar-txt',gar.length+' contratos tipo Garantía · '+garCli+' clientes únicos');
  const tfc=document.getElementById('tfoot-tc-com');
  if(tfc)tfc.innerHTML='<td class="flab" colspan="11" style="background:var(--az3);color:rgba(255,255,255,.7);padding:.5rem .7rem;font-size:.64rem">'+com.length+' contratos Comerciales · '+comCli+' clientes únicos · '+mm(totalComVal)+' cartera anual</td>';
  const tfg=document.getElementById('tfoot-tc-gar');
  if(tfg)tfg.innerHTML='<td class="flab" colspan="11" style="background:var(--az3);color:rgba(255,255,255,.7);padding:.5rem .7rem;font-size:.64rem">'+gar.length+' contratos Garantía · '+garCli+' clientes únicos · '+mm(totalGarVal)+' cartera valorizada</td>';
  const fgv=document.getElementById('tc-foot-gar-val');
  if(fgv)fgv.textContent=mm(totalGarVal)+' cartera garantías';

  document.getElementById('tb-tc-com').innerHTML=com.map(d=>`<tr>
    <td class="num">${d.n}</td>
    <td style="font-size:.67rem">${shortN(d.cliente)}</td>
    <td style="font-size:.63rem;color:var(--mut)">${shortC(d.coord)}</td>
    <td style="font-size:.67rem">${d.inicio_fmt}</td><td style="font-size:.67rem">${d.fin_fmt}</td>
    <td class="num" style="color:${d.val>0?'var(--az2)':'var(--mut)'}">${d.val>0?mm(d.val):'—'}</td>
    <td class="num" style="color:var(--mut)">${pctOf(d.val,totalComVal)}</td>
    <td style="min-width:80px">${pbarHTML(d.pct_consumido,urgC(d.dias_vence))}<span style="font-size:.6rem;color:var(--mut)">${isNaN(d.pct_consumido)?0:d.pct_consumido}%</span></td>
    <td>${urgP(d.dias_vence)}</td>
    <td style="text-align:center">${_progBadge(d.programa||'')}</td>
    <td>${nueBadge(d.es_nuevo)}</td>
  </tr>`).join('');

  document.getElementById('tb-tc-gar').innerHTML=gar.map(d=>`<tr>
    <td class="num">${d.n}</td>
    <td style="font-size:.67rem">${shortN(d.cliente)}</td>
    <td style="font-size:.63rem;color:var(--mut)">${shortC(d.coord)}</td>
    <td style="font-size:.67rem">${d.inicio_fmt}</td><td style="font-size:.67rem">${d.fin_fmt}</td>
    <td class="num" style="color:${d.val>0?'var(--az2)':'var(--mut)'}">${d.val>0?mm(d.val):'—'}</td>
    <td class="num" style="color:var(--mut)">${totalGarVal>0?pctOf(d.val,totalGarVal):'—'}</td>
    <td style="min-width:80px">${pbarHTML(d.pct_consumido,C.te)}<span style="font-size:.6rem;color:var(--mut)">${isNaN(d.pct_consumido)?0:d.pct_consumido}%</span></td>
    <td>${urgP(d.dias_vence)}</td>
    <td style="text-align:center">${_progBadge(d.programa||'')}</td>
    <td>${nueBadge(d.es_nuevo)}</td>
  </tr>`).join('');

  document.getElementById('s-tc-com').oninput=e=>filterT('tb-tc-com',e.target.value);
  document.getElementById('s-tc-gar').oninput=e=>filterT('tb-tc-gar',e.target.value);

  const _COORD_PALETTE=[C.az3,C.az2,'#4A6CC0','#6A8CDF','#8AAEF0','#28D2C3','#FFC000'];
  const coords=[...new Set(DATA.filter(d=>d.coord&&d.coord!=='Sin asignar').map(d=>d.coord))].sort();
  const labels=coords.map(c=>c.split(' ')[0]);
  new Chart(document.getElementById('cTcCoord').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[{label:'MM$ cartera',
      data:coords.map(c=>DATA.filter(d=>d.tipo==='Comercial'&&d.coord===c).reduce((s,d)=>s+d.val,0)/1e6),
      backgroundColor:coords.map((_,i)=>_COORD_PALETTE[i%_COORD_PALETTE.length]),borderRadius:5,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` MM$${c.raw.toFixed(1)}`}}},
      scales:{y:{grid:{color:'#E2E6F0'},ticks:{callback:v=>'MM$'+v}},x:{grid:{display:false}}}}
  });
  new Chart(document.getElementById('cTcStack').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'Comercial',data:coords.map(c=>DATA.filter(d=>d.tipo==='Comercial'&&d.coord===c).length),backgroundColor:C.az2,stack:'s',borderRadius:3},
      {label:'Garantía',data:coords.map(c=>DATA.filter(d=>d.tipo==='Garantia'&&d.coord===c).length),backgroundColor:C.te,stack:'s',borderRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}},
      scales:{y:{stacked:true,grid:{color:'#E2E6F0'}},x:{stacked:true,grid:{display:false}}}}
  });
  initRelacion();
}

// ─── ANÁLISIS DE CARTERA ──────────────────────────────────────
let relFilter='todos',relFiltroFecha=9999,chartRel=null,chartRelCoord=null;
function initRelacion(){
  document.querySelectorAll('#rel-filt .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#rel-filt .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');relFilter=b.dataset.rf;renderRelTabla();
  }));
  document.querySelectorAll('#rel-filt-fecha .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#rel-filt-fecha .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');relFiltroFecha=parseInt(b.dataset.rd);renderRelTabla();
  }));
  renderRelCharts();
  renderRelTabla();
}
const _normCli=s=>s?s.trim().toUpperCase().replace(/\s+/g,' '):'';

function renderRelCharts(){
  const grupos={Nuevo:0,Renovado:0,Perdido:0};
  FAC_DATA.forEach(d=>{if(grupos[d.estado_relacion]!==undefined)grupos[d.estado_relacion]++;});
  PERDIDOS_VG.forEach(d=>{grupos.Perdido++;});
  const totalCli=grupos.Nuevo+grupos.Renovado+grupos.Perdido;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('rel-k-nuevo',grupos.Nuevo);
  set('rel-k-reno',grupos.Renovado);
  set('rel-k-perd',grupos.Perdido);
  const ret=grupos.Renovado+grupos.Perdido>0?(grupos.Renovado/(grupos.Renovado+grupos.Perdido)*100).toFixed(1)+'%':'—';
  set('rel-k-ret',ret);
  set('rel-chart-total',totalCli);
  set('rel-donut-n',totalCli);
  const pct=(n)=>totalCli>0?(n/totalCli*100).toFixed(1)+'%':'—';
  set('rel-leg-nuevo',grupos.Nuevo+' ('+pct(grupos.Nuevo)+')');
  set('rel-leg-reno',grupos.Renovado+' ('+pct(grupos.Renovado)+')');
  set('rel-leg-perd',grupos.Perdido+' ('+pct(grupos.Perdido)+')');
  if(chartRel)chartRel.destroy();
  chartRel=new Chart(document.getElementById('cRel'),{
    type:'doughnut',
    data:{labels:['Nuevos','Renovados','Perdidos'],
      datasets:[{data:[grupos.Nuevo,grupos.Renovado,grupos.Perdido],
        backgroundColor:['#28d2c3','#FFC000','#FF6B6B'],borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+' clientes'}}}}
  });
  const coords={};
  FAC_DATA.forEach(d=>{
    if(!coords[d.coord])coords[d.coord]={Nuevo:0,Renovado:0,Perdido:0};
    if(coords[d.coord][d.estado_relacion]!==undefined)coords[d.coord][d.estado_relacion]++;
  });
  PERDIDOS_VG.forEach(d=>{
    const c=d.coord||'Sin asignar';
    if(!coords[c])coords[c]={Nuevo:0,Renovado:0,Perdido:0};
    coords[c].Perdido++;
  });
  const arr=Object.entries(coords).sort((a,b)=>(b[1].Nuevo+b[1].Renovado+b[1].Perdido)-(a[1].Nuevo+a[1].Renovado+a[1].Perdido));
  if(chartRelCoord)chartRelCoord.destroy();
  chartRelCoord=new Chart(document.getElementById('cRelCoord'),{
    type:'bar',
    data:{labels:arr.map(([k])=>k.split(' ').slice(0,2).join(' ')),
      datasets:[
        {label:'Nuevos',data:arr.map(([,v])=>v.Nuevo),backgroundColor:'#28d2c3',stack:'s'},
        {label:'Renovados',data:arr.map(([,v])=>v.Renovado),backgroundColor:'#FFC000',stack:'s'},
        {label:'Perdidos',data:arr.map(([,v])=>v.Perdido),backgroundColor:'#FF6B6B',stack:'s'}
      ]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:12,padding:8}},
        tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.x+' clientes'}}},
      scales:{x:{stacked:true,beginAtZero:true,ticks:{stepSize:1}},
        y:{stacked:true,ticks:{font:{size:10}}}}}
  });
}
function renderRelTabla(){
  const diasCliMap={};
  NC_DATA.forEach(d=>{
    const k=_normCli(d.cliente);
    const dias=d.dias_inicio_cli>=0?d.dias_inicio_cli:99999;
    if(diasCliMap[k]===undefined||dias<diasCliMap[k]) diasCliMap[k]=dias;
  });
  const carteraPorCli={};
  NC_DATA.forEach(d=>{
    if(d.tipo==='Comercial'){
      const dias=d.dias_inicio_cli>=0?d.dias_inicio_cli:99999;
      if(relFiltroFecha===9999||(dias>=0&&dias<=relFiltroFecha)){
        const k=_normCli(d.cliente);
        carteraPorCli[k]=(carteraPorCli[k]||0)+d.val;
      }
    }
  });
  const ESTADOS_REL=['Nuevo','Renovado','Perdido'];
  const facRows=FAC_DATA.filter(d=>{
    if(!ESTADOS_REL.includes(d.estado_relacion)) return false;
    const okEstado=relFilter==='todos'||d.estado_relacion===relFilter;
    if(!okEstado) return false;
    if(relFiltroFecha===9999) return true;
    if(d.estado_relacion==='Nuevo'){
      const dias=diasCliMap[_normCli(d.cliente)];
      return dias!==undefined&&dias<=relFiltroFecha;
    }
    return true;
  });
  const perdRows=(relFilter==='todos'||relFilter==='Perdido')?PERDIDOS_VG:[];
  const data=[...facRows,...perdRows].sort((a,b)=>b.fac_total-a.fac_total);
  const totalBase=FAC_DATA.filter(d=>ESTADOS_REL.includes(d.estado_relacion)&&(relFilter==='todos'||d.estado_relacion===relFilter)).length+
    (relFilter==='todos'||relFilter==='Perdido'?PERDIDOS_VG.length:0);
  const tb=document.getElementById('tb-rel');
  tb.innerHTML=data.map((d,i)=>{
    const estCol={Nuevo:'#28d2c3',Renovado:'#FFC000',Perdido:'#FF6B6B'}[d.estado_relacion]||'#999';
    const estIco={Nuevo:'🆕',Renovado:'🔄',Perdido:'📉'}[d.estado_relacion]||'';
    const cartera=carteraPorCli[_normCli(d.cliente)]||0;
    return `<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
      <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.cliente}"><strong>${shortN(d.cliente)}</strong></td>
      <td style="font-size:.65rem;color:var(--mut)">${shortC(d.coord)}</td>
      <td><span style="background:${estCol};color:#fff;padding:.18rem .45rem;border-radius:4px;font-size:.6rem;font-weight:700">${estIco} ${d.estado_relacion}</span></td>
      <td class="num" style="text-align:right;font-weight:700">${mm(d.fac_total)}</td>
      <td class="num" style="text-align:right;color:var(--am)">${mm(d.fac_2026)}</td>
      <td class="num" style="text-align:right;color:var(--az2)">${cartera>0?mm(cartera):'—'}</td>
      <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${d.inicio_fmt||'—'}</td>
      <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${d.fin_fmt||'—'}</td>
    </tr>`;
  }).join('');
  const totalFac=data.reduce((s,d)=>s+(d.fac_total||0),0);
  const total2026=data.reduce((s,d)=>s+(d.fac_2026||0),0);
  // Cartera = todos NC_DATA del período (coincide con hoja Nuevos Clientes)
  const totalCartera=relFiltroFecha<9999
    ? NC_DATA.filter(d=>d.tipo==='Comercial'&&d.dias_inicio_cli>=0&&d.dias_inicio_cli<=relFiltroFecha).reduce((s,d)=>s+d.val,0)
    : data.reduce((s,d)=>s+(carteraPorCli[_normCli(d.cliente)]||0),0);
  document.getElementById('tf-rel').innerHTML=`<tr style="background:var(--gy);font-weight:900;border-top:2px solid var(--brd)">
    <td colspan="4" style="padding:.55rem;font-size:.7rem;color:var(--az1)">TOTAL · ${data.length} clientes</td>
    <td class="num" style="text-align:right;color:var(--az1);font-weight:900">${mm(totalFac)}</td>
    <td class="num" style="text-align:right;color:var(--am);font-weight:900">${mm(total2026)}</td>
    <td class="num" style="text-align:right;color:var(--az2);font-weight:900">${mm(totalCartera)}</td>
    <td colspan="2"></td>
  </tr>`;
  document.getElementById('rel-foot').textContent='Mostrando '+data.length+' de '+totalBase+' clientes · Cartera NC '+ANO_ACTUAL+': '+mm(totalCartera)+(relFiltroFecha<9999?' (todos contratos nuevos ≤'+relFiltroFecha+'d)':'')+' · Total fac '+(ANO_ACTUAL-2)+'-'+ANO_ACTUAL+': '+mm(totalFac);
  const notaEl=document.getElementById('rel-nota-consistencia');
  if(notaEl){
    if(relFiltroFecha<9999){
      notaEl.style.display='block';
      notaEl.innerHTML='ℹ️ <strong>Nota:</strong> La columna Cartera muestra la cartera del período seleccionado usando el mismo criterio que la hoja <strong>Nuevos Clientes</strong> (NC_DATA · dias_inicio_cli ≤ '+relFiltroFecha+'d). Los totales deben coincidir al filtrar por "Nuevo" con el mismo período.';
    } else {
      notaEl.style.display='none';
    }
  }
}

function tabSwitch(grp,id,btn){
  document.querySelectorAll(`#view-tipos .tab-pane`).forEach(p=>p.classList.remove('on'));
  document.querySelectorAll(`#view-tipos .tab-btn`).forEach(b=>b.classList.remove('on'));
  document.getElementById(`${grp}-${id}`).classList.add('on');
  btn.classList.add('on');
}
