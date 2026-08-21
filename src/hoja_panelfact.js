// ═══════════════════════════════════════════════════════════════
// hoja_panelfact.js — Panel Facturación Cliente (Real vs Presupuesto)
// Depende de: datos.js (APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let pfTipo='todos';
let pfContr='todos';
let pfSrch='';
let _pfSortCol='real_ytd',_pfSortAsc=false;

// Facturación real del cliente a la fecha. Usa real_ytd_fac, que el extractor
// calcula con la misma base que "Ingresos Totales" de Analisis Facturación
// (Empresa TS + Tipo Factura + catálogos Servicio Técnico / REAS /
// Trazabilidad), de modo que la suma de todos los clientes cuadra con el KPI
// de la portada. real_ytd viene de la hoja FACTURACION y no cuadra.
function _pfReal(p){
  return (p && p.real_ytd_fac !== undefined) ? (p.real_ytd_fac||0) : ((p&&p.real_ytd)||0);
}
function pfSortCol(col){_pfSortAsc=(_pfSortCol===col)?!_pfSortAsc:false;_pfSortCol=col;renderPanelFact();}
let _chPfBar=null,_chPfDist=null;

// Universo de la hoja: panel_fact deduplica las filas alias de FACTURACION y
// suma los clientes que sólo aparecen en la BBDD, de modo que el KPI de arriba
// cuadre con la tabla de abajo y con Ingresos Totales de la portada.
function pfUniverso(){
  return (APP_DATA.panel_fact && APP_DATA.panel_fact.length)
    ? APP_DATA.panel_fact : APP_DATA.panel;
}

function pfDataFiltrada(){
  return pfUniverso().filter(p=>{
    if(pfTipo!=='todos'&&p.tipo_cli!==pfTipo)return false;
    if(pfContr==='con'&&!p.tiene_contrato)return false;
    if(pfContr==='sin'&&p.tiene_contrato)return false;
    if(pfSrch&&!p.cliente.toLowerCase().includes(pfSrch.toLowerCase()))return false;
    return true;
  });
}

function renderPanelFact(){
  const data=pfDataFiltrada();
  const realPanel=data.reduce((s,p)=>s+_pfReal(p),0);
  const presup=data.reduce((s,p)=>s+(p.presup_contr_ytd||0),0);
  const presupAnio=data.reduce((s,p)=>s+(p.presup_contr_anio||0),0);
  // Total facturado: usar Analisis Facturación como fuente master
  const _afPF=APP_DATA.analisis_fac||{};
  const real=realPanel;   // suma de la tabla: portada y detalle deben cuadrar
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
    .sort((a,b)=>((b.presup_contr_ytd||0)+_pfReal(b))-((a.presup_contr_ytd||0)+_pfReal(a)))
    .slice(0,15);
  const labels15=top15.map(p=>p.cliente.length>30?p.cliente.slice(0,28)+'…':p.cliente);
  const realData15=top15.map(p=>_pfReal(p)/1e6);
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
    const pct=_pfReal(p)/p.presup_contr_ytd*100;
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

  _pfRenderDetalle();
}

// ═══════════════════════════════════════════════════════════════
// FACTURACIÓN DEL AÑO POR CLIENTE
// Se arma desde APP_DATA.fact_clientes, que el extractor calcula con la
// misma base que "Ingresos Totales" de Analisis Facturación: empresa TS,
// tipo de documento Factura y catálogos Servicio Técnico / REAS /
// Trazabilidad. Incluye clientes que facturan pero no están en la hoja
// FACTURACION, por eso su suma cuadra con el KPI de portada y no con los
// 111 clientes del panel.
// ═══════════════════════════════════════════════════════════════
let _pfDetFilt = 'todos';
let _pfDetSort = 'real', _pfDetAsc = false;

function pfDetFiltro(k){ _pfDetFilt = k; _pfRenderDetalle(); }
function pfDetSort(f){ _pfDetAsc = (_pfDetSort === f) ? !_pfDetAsc : false; _pfDetSort = f; _pfRenderDetalle(); }

function _pfRenderDetalle(){
  const box = document.getElementById('pf-det-tabla');
  if(!box) return;
  const todos = (window.APP_DATA || {}).fact_clientes || [];
  if(!todos.length){
    box.innerHTML = '<p style="padding:1.2rem;color:var(--mut);font-style:italic">Sin datos de facturación.</p>';
    return;
  }
  const totGeneral = todos.reduce((s, x) => s + x.real, 0);

  const fb = document.getElementById('pf-det-filt');
  if(fb){
    const opts = [['todos','Todos'],['Público','Públicos'],['Privado','Privados'],
                  ['con','Con contrato'],['sin','Sin contrato'],['solocosto','Sin facturación']];
    fb.innerHTML = opts.map(function(o){
      const k = o[0], t = o[1], on = _pfDetFilt === k;
      return '<button onclick="pfDetFiltro(\'' + k + '\')" style="font-size:.57rem;padding:.18rem .5rem;' +
             'border-radius:3px;cursor:pointer;border:1px solid ' + (on ? 'var(--az1)' : 'var(--brd)') +
             ';background:' + (on ? 'var(--az1)' : 'var(--bg2)') + ';color:' + (on ? '#fff' : 'var(--txt)') +
             ';font-weight:' + (on ? '700' : '400') + '">' + t + '</button>';
    }).join('');
  }

  let filas = todos.slice();
  if(_pfDetFilt === 'con')        filas = filas.filter(x => x.contrato);
  else if(_pfDetFilt === 'sin')   filas = filas.filter(x => !x.contrato);
  else if(_pfDetFilt === 'solocosto') filas = filas.filter(x => x.solo_costo);
  else if(_pfDetFilt !== 'todos') filas = filas.filter(x => x.tipo_cli === _pfDetFilt);
  const q = (pfSrch || '').trim().toLowerCase();
  if(q) filas = filas.filter(x => x.cliente.toLowerCase().includes(q));

  const _mgPct = x => x.real ? (x.real - (x.costo || 0)) / x.real * 100 : (x.costo ? -100 : 0);
  // Tooltip: para la fila consolidada lista los clientes que la componen
  const _pfTip = function(x){
    if(!x.detalle || !x.detalle.length) return x.cliente;
    const top = x.detalle.slice(0, 30)
      .map(d => d.cliente + ': ' + fmtMM(d.costo)).join('\n');
    return x.cliente + ' (' + x.detalle.length + ')\n' + top +
      (x.detalle.length > 30 ? '\n…y ' + (x.detalle.length - 30) + ' más' : '');
  };
  filas.sort(function(a, b){
    const va = _pfDetSort === 'margen' ? _mgPct(a) : a[_pfDetSort];
    const vb = _pfDetSort === 'margen' ? _mgPct(b) : b[_pfDetSort];
    if(typeof va === 'string') return _pfDetAsc ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es');
    if(typeof va === 'boolean') return _pfDetAsc ? (va ? 1 : 0) - (vb ? 1 : 0) : (vb ? 1 : 0) - (va ? 1 : 0);
    return _pfDetAsc ? va - vb : vb - va;
  });

  const tot  = filas.reduce((s, x) => s + x.real, 0);
  const totK = filas.reduce((s, x) => s + (x.costo || 0), 0);
  const maxV = Math.max.apply(null, filas.map(x => x.real).concat([1]));
  const SEP  = 'border-right:1px solid var(--brd)';
  const th = (t, f, al) =>
    '<th onclick="pfDetSort(\'' + f + '\')" style="position:sticky;top:0;z-index:2;background:var(--az1);' +
    'color:#fff;padding:.35rem .6rem;font-size:.57rem;letter-spacing:.03em;text-align:' + al +
    ';white-space:nowrap;cursor:pointer;border-right:1px solid rgba(255,255,255,.18)">' + t +
    (_pfDetSort === f ? (_pfDetAsc ? ' ▲' : ' ▼') : '') + '</th>';
  const thPlain = (t, al) =>
    '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.35rem .6rem;' +
    'font-size:.57rem;text-align:' + al + ';border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';

  const cuerpo = filas.map(function(x, i){
    const mg  = _mgPct(x);
    const tb2 = x.tipo_cli === 'Público' ? 'pb' : x.tipo_cli === 'Privado' ? 'por' : 'pgr';
    const tl  = x.tipo_cli === 'Público' ? 'PÚB' : x.tipo_cli === 'Privado' ? 'PRIV' : 'N/D';
    return '<tr style="background:' + (i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)') + '">' +
      '<td style="padding:.26rem .6rem;text-align:right;font-family:\'Roboto Mono\',monospace;font-size:.58rem;color:var(--mut);' + SEP + '">' + (i + 1) + '</td>' +
      '<td style="padding:.26rem .6rem;font-size:.64rem;font-weight:600;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + SEP + '" title="' + _pfTip(x) + '">' + x.cliente +
        (x.solo_costo ? '<span style="font-size:.52rem;background:var(--rd2);color:var(--rd);border-radius:3px;padding:.05rem .3rem;margin-left:.3rem;font-weight:700">' + (x.n_sc || 0) + ' CLIENTES</span>' : '') + '</td>' +
      '<td style="padding:.26rem .6rem;' + SEP + '"><span class="pill ' + tb2 + '">' + tl + '</span></td>' +
      '<td style="padding:.26rem .6rem;text-align:center;' + SEP + '"><span class="pill ' + (x.contrato ? 'pg' : 'pgr') + '" style="font-size:.55rem">' + (x.contrato ? 'CON' : 'SIN') + '</span></td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.65rem;font-weight:700;font-variant-numeric:tabular-nums;' + SEP + '">' + fmtMM(x.real) + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;color:var(--or);font-variant-numeric:tabular-nums;' + SEP + '">' + ((x.costo || 0) ? fmtMM(x.costo) : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.64rem;font-weight:700;font-variant-numeric:tabular-nums;color:' +
        ((x.real - (x.costo || 0)) >= 0 ? 'var(--gn)' : 'var(--rd)') + ';' + SEP + '">' + fmtMM(x.real - (x.costo || 0)) + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.62rem;font-weight:700;font-variant-numeric:tabular-nums;color:' +
        (mg >= 60 ? 'var(--gn)' : mg >= 35 ? 'var(--am)' : 'var(--rd)') + ';' + SEP + '">' +
        (x.real ? mg.toFixed(1).replace('.', ',') + '%' : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem"><div style="display:flex;align-items:center;gap:5px">' +
        '<div style="flex:1;height:5px;background:var(--gy);border-radius:3px;overflow:hidden;min-width:36px">' +
        '<div style="height:100%;width:' + (x.real / maxV * 100) + '%;background:var(--az2)"></div></div>' +
        '<span style="font-size:.55rem;color:var(--mut);min-width:32px;text-align:right">' + (x.real / tot * 100).toFixed(1) + '%</span>' +
      '</div></td></tr>';
  }).join('');

  box.innerHTML =
    '<div style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
    '<table style="width:100%;border-collapse:collapse;min-width:760px">' +
    '<thead><tr>' + thPlain('#', 'right') + th('CLIENTE / INSTITUCIÓN', 'cliente', 'left') +
      th('TIPO', 'tipo_cli', 'left') + th('CONTRATO', 'contrato', 'center') +
      th('REAL FACTURADO A LA FECHA', 'real', 'right') + th('COSTO TOTAL', 'costo', 'right') +
      thPlain('MARGEN BRUTO', 'right') + th('% MARGEN', 'margen', 'right') + thPlain('% DEL TOTAL', 'right') +
    '</tr></thead><tbody>' + cuerpo + '</tbody>' +
    '<tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td colspan="4" style="padding:.35rem .6rem;font-size:.64rem;' + SEP + '">TOTAL · ' + filas.length +
        ' clientes' + ((_pfDetFilt === 'todos' && !q) ? '' : ' (filtrado)') + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;' + SEP + '">' + fmtMM(tot) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums;' + SEP + '">' + fmtMM(totK) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;' + SEP + '">' + fmtMM(tot - totK) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;' + SEP + '">' + (tot ? ((tot - totK) / tot * 100).toFixed(1).replace('.', ',') : '0') + '%</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.6rem">' + (tot / totGeneral * 100).toFixed(1) + '%</td>' +
    '</tr></tfoot></table></div>' +
    '<p style="font-size:.55rem;color:var(--mut);margin:.5rem 0 0;line-height:1.45">' +
    'Facturación real Ene–' + MES_CORTE_NOMBRE + ' ' + ANO_ACTUAL + ' desde la hoja «Facturacion a Fecha», con los ' +
    'mismos filtros que usa «Ingresos Totales» de Analisis Facturación: empresa <strong>TS</strong>, tipo de ' +
    'documento <strong>Factura</strong> y catálogos <strong>Servicio Técnico, REAS y Trazabilidad</strong>. ' +
    'Excluye provisiones y los catálogos de venta de equipos. Sin filtros, el total cuadra con el indicador ' +
    'de la portada.<br>' +
    'El <strong>costo total</strong> es la suma de «Costo Total» (columna R) de la hoja <strong>GD</strong>, ' +
    'que registra los repuestos consumidos en cada cliente, agrupada por nombre de cliente. El ' +
    '<strong>margen bruto</strong> es la facturación menos ese costo. Los clientes sin movimientos en GD ' +
    'aparecen con costo cero, por lo que su margen es todo lo facturado.<br>' +
    'La fila <strong>Clientes sin Facturación</strong> agrupa a los que consumieron repuestos y no registran ' +
    'facturación en el período, por lo que su margen bruto es todo negativo; el detalle de quiénes son está ' +
    'en el tooltip de esa fila. El grupo se rearma en cada actualización: si alguno empieza a facturar sale ' +
    'y pasa a tener su propia fila, y si aparecen otros se incorporan solos.</p>';

  const lbl = document.getElementById('pf-det-lbl');
  const kGeneral = todos.reduce((s, x) => s + (x.costo || 0), 0);
  if(lbl) lbl.textContent = todos.length + ' clientes · ' + fmtMM(totGeneral) + ' facturado · ' +
    fmtMM(kGeneral) + ' costo · margen ' + (totGeneral ? ((totGeneral - kGeneral) / totGeneral * 100).toFixed(1).replace('.', ',') : '0') + '%';
}

function initPanelFact(){
  document.querySelectorAll('#pf-tipo .btn').forEach(b=>{
    b.addEventListener('click',()=>{document.querySelectorAll('#pf-tipo .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');pfTipo=b.dataset.pft;renderPanelFact();});
  });
  document.querySelectorAll('#pf-contr .btn').forEach(b=>{
    b.addEventListener('click',()=>{document.querySelectorAll('#pf-contr .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');pfContr=b.dataset.pfc;renderPanelFact();});
  });
  const s=document.getElementById("pf-srch");
  if(s)s.addEventListener('input',e=>{pfSrch=e.target.value;_pfRenderDetalle();});
  renderPanelFact();
}
