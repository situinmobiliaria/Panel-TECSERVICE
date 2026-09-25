// ═══════════════════════════════════════════════════════════════
// hoja_panelfact.js — Panel Facturación Cliente (Real vs Presupuesto)
// Depende de: datos.js (APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let pfTipo='todos';
let pfContr='todos';
let pfSrch='';
let _pfSortCol='real_ytd',_pfSortAsc=false;

// ═══════════════════════════════════════════════════════════════
// MARGEN NETO — margen de "Facturación del Año por Cliente" ajustado por
// costo operativo (horas hombre + viajes), sólo con datos desde abril en
// adelante, que es desde donde hay costo de terreno cargado.
// Fuente: APP_DATA.citas_costeo (hoja "Citas Servicios Trimestrales") y
// APP_DATA.region_clientes (hoja "Región Clientes"). Con el botón
// desactivado, la tabla no cambia en nada: _pfRenderDetalle() corta al tiro
// hacia _pfRenderMargenNeto() sólo cuando mgActivo es true.
// ═══════════════════════════════════════════════════════════════
let mgActivo = false;

const MG_COSTO_HORA = 25000;   // $/hora hombre
const MG_MES_DESDE  = 4;       // abril: primer mes con costo de terreno cargado

// Tarifa de "Total viaje" por región (valor único ida y vuelta, no por
// técnico). La Región Metropolitana no venía en la tabla entregada porque
// los técnicos están basados ahí, pero igual tiene un costo fijo de
// movilización por viaje único: no es un caso "sin región".
const MG_TARIFA_VIAJE = {
  'Arica y Parinacota': 556000, 'Tarapacá': 476000, 'Antofagasta': 446000,
  'Atacama': 416000, 'Coquimbo': 366000, 'Valparaíso': 194000,
  "O'Higgins": 188000, 'Maule': 198000, 'Ñuble': 416000, 'Biobío': 366000,
  'Araucanía': 396000, 'Los Ríos': 426000, 'Los Lagos': 436000,
  'Aysén': 506000, 'Magallanes': 526000, 'Metropolitana': 50000,
};

function _mgNorm(s){
  return s ? String(s).trim().toUpperCase().replace(/\s+/g,' ')
             .normalize('NFD').replace(/[̀-ͯ]/g,'') : '';
}

// Filas de Citas Servicios Trimestrales de un cliente, desde abril del año
// dado. Cada fila es [cliente_idx, año, mes, día, atención_idx, minutos].
function _mgFilasCliente(clienteKey, anio){
  const CC = (window.APP_DATA || {}).citas_costeo;
  if(!CC || !CC.filas || !CC.filas.length) return [];
  const idx = (CC.clientes || []).findIndex(c => _mgNorm(c) === clienteKey);
  if(idx < 0) return [];
  return CC.filas.filter(f => f[0] === idx && f[1] === anio && f[2] >= MG_MES_DESDE);
}

// Viajes únicos de un cliente desde abril: la llave es cliente + fecha. No
// importa cuántas citas o técnicos distintos atendieron ese día —es un solo
// viaje a terreno—, así que dos o más filas del mismo cliente el mismo día
// cuentan como un solo viaje. Devuelve un Set con esa llave por cada viaje
// distinto.
function getUniqueTrips(clienteKey, anio){
  const filas = _mgFilasCliente(clienteKey, anio);
  const trips = new Set();
  filas.forEach(f => {
    trips.add(f[1] + '-' + f[2] + '-' + f[3]);   // año-mes-día
  });
  return trips;
}

// Costo de viaje único a la región del cliente. Devuelve null si la región
// no está en la tabla de tarifas (no debería pasar salvo error de datos: las
// regiones que entrega el extractor ya vienen acotadas a esta lista).
function getRegionTravelCost(region){
  return Object.prototype.hasOwnProperty.call(MG_TARIFA_VIAJE, region) ? MG_TARIFA_VIAJE[region] : null;
}

// Costo operativo (horas hombre + viajes) de un cliente, desde abril del año
// dado. "sinRegion" es true cuando el cliente no tiene región conocida —no
// aparece en la hoja "Región Clientes", o aparece como "Región no
// Identificada"—: en ese caso NO se asume costo de viaje $0, se deja en null
// y se marca para revisión explícita en la tabla.
function getClientOperationalCosts(clienteNombre, anio){
  const RC = (window.APP_DATA || {}).region_clientes || {};
  const key = _mgNorm(clienteNombre);
  const filas = _mgFilasCliente(key, anio);
  const horasMin = filas.reduce((s,f) => s + (f[5] || 0), 0);
  const costoHoras = Math.round(horasMin / 60 * MG_COSTO_HORA);
  const trips = getUniqueTrips(key, anio);
  const viajesUnicos = trips.size;
  const sinRegion = !Object.prototype.hasOwnProperty.call(RC, key) || RC[key] == null;
  const region = sinRegion ? null : RC[key];
  const costoViajeUnitario = sinRegion ? null : getRegionTravelCost(region);
  const costoViajes = (sinRegion || costoViajeUnitario == null) ? 0 : viajesUnicos * costoViajeUnitario;
  return {
    horasMin, costoHoras, viajesUnicos, region, costoViajeUnitario, costoViajes,
    costoOperativo: costoHoras + costoViajes,
    sinRegion: sinRegion && viajesUnicos > 0,   // sin datos de viaje, "sin región" no aplica: no hay nada que costear
  };
}

// Margen ajustado de un cliente: toma el objeto de APP_DATA.fact_clientes
// (con .mensual y .costo_mensual, 12 valores Ene-Dic ya calculados por el
// extractor) y le resta el costo operativo desde abril. ingresos_desde_abril
// y margen_bruto_desde_abril excluyen enero-marzo, tal como el resto de este
// cálculo, porque el costo de terreno sólo está cargado desde ahí.
function getAdjustedClientMargin(clienteObj, anio){
  anio = anio || (window.ANO_ACTUAL || new Date().getFullYear());
  const mensual = clienteObj.mensual || [];
  const costoMensual = clienteObj.costo_mensual || [];
  const ingresosAbril = mensual.slice(MG_MES_DESDE - 1).reduce((s,v) => s + (v || 0), 0);
  const costoGdAbril  = costoMensual.slice(MG_MES_DESDE - 1).reduce((s,v) => s + (v || 0), 0);
  const margenBrutoAbril = ingresosAbril - costoGdAbril;
  const op = getClientOperationalCosts(clienteObj.cliente, anio);
  const margenAjustado = margenBrutoAbril - op.costoOperativo;
  const margenAjustadoPct = ingresosAbril ? (margenAjustado / ingresosAbril * 100) : 0;
  return Object.assign({ ingresosAbril, costoGdAbril, margenBrutoAbril, margenAjustado, margenAjustadoPct }, op);
}

function pfToggleMargenNeto(){
  mgActivo = !mgActivo;
  const btn = document.getElementById('pf-mg-toggle');
  if(btn) btn.classList.toggle('on', mgActivo);
  _pfRenderDetalle();
}

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

  // Con el toggle "Margen Neto" activado, la tabla original no se toca: se
  // corta acá y se dibuja la vista de margen ajustado en su lugar, sobre el
  // mismo universo ya filtrado (tipo, contrato, búsqueda).
  if(mgActivo){ _pfRenderMargenNeto(filas, todos, totGeneral); return; }

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

// Vista "Margen Neto" de la tabla "Facturación del Año por Cliente": mismo
// universo de clientes ya filtrado por tipo/contrato/búsqueda, sobre la
// MISMA tabla "Facturación del Año por Cliente" —mismas columnas, mismo
// estilo—, sólo que los datos van desde abril en adelante y se agregan dos
// columnas al final: Costo Horas Hombre y Costo Viajes, para terminar en
// Margen Neto. La fila consolidada "Clientes sin Facturación" no representa
// un cliente real (es un agregado sin nombre propio que cruzar contra
// Citas/Región), así que queda fuera de esta vista.
function _pfRenderMargenNeto(filasFiltradas, todos, totGeneral){
  const box = document.getElementById('pf-det-tabla');
  if(!box) return;
  const anio = window.ANO_ACTUAL || new Date().getFullYear();

  const filas = filasFiltradas.filter(x => !x.solo_costo)
    .map(x => Object.assign({}, x, { _mg: getAdjustedClientMargin(x, anio) }));
  filas.sort((a,b) => b._mg.margenAjustado - a._mg.margenAjustado);

  const nSinRegion = filas.filter(x => x._mg.sinRegion).length;
  const totIng = filas.reduce((s,x) => s + x._mg.ingresosAbril, 0);
  const totCosto = filas.reduce((s,x) => s + x._mg.costoGdAbril, 0);
  const totMB  = filas.reduce((s,x) => s + x._mg.margenBrutoAbril, 0);
  const totCH  = filas.reduce((s,x) => s + x._mg.costoHoras, 0);
  const totCV  = filas.reduce((s,x) => s + x._mg.costoViajes, 0);
  const totMN  = filas.reduce((s,x) => s + x._mg.margenAjustado, 0);
  const totMNP = totIng ? (totMN / totIng * 100) : 0;
  const totMBP = totIng ? (totMB / totIng * 100) : 0;
  // Ingresos desde abril de TODOS los clientes reales (sin la fila consolidada), base del % del total
  const totIngGeneral = todos.filter(x => !x.solo_costo)
    .reduce((s,x) => s + (x.mensual || []).slice(MG_MES_DESDE - 1).reduce((a,v) => a + (v || 0), 0), 0);
  const maxIng = Math.max.apply(null, filas.map(x => x._mg.ingresosAbril).concat([1]));

  const SEP  = 'border-right:1px solid var(--brd)';
  const thPlain = (t, al) =>
    '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.35rem .6rem;' +
    'font-size:.57rem;text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';

  const nUn = v => Math.round(v || 0).toLocaleString('es-CL');

  // Tooltip con el detalle auditable de cómo se llegó al margen neto de esa fila.
  const _tip = x => {
    const m = x._mg;
    const lines = [
      'Ingresos desde abril: ' + fmtMM(m.ingresosAbril),
      'Margen bruto desde abril: ' + fmtMM(m.margenBrutoAbril),
      'Horas hombre: ' + (m.horasMin/60).toFixed(1).replace('.', ',') + ' h (' + nUn(m.horasMin) + ' min)',
      'Costo horas hombre: ' + fmtMM(m.costoHoras),
      'Viajes únicos: ' + m.viajesUnicos,
      'Región: ' + (m.region || (m.sinRegion ? 'SIN REGIÓN — revisar' : 'Metropolitana (sin viajes registrados)')),
      'Costo por viaje: ' + (m.costoViajeUnitario != null ? fmtMM(m.costoViajeUnitario) : '—'),
      'Costo total de viajes: ' + fmtMM(m.costoViajes),
      'Margen neto: ' + fmtMM(m.margenAjustado),
      'Margen neto %: ' + m.margenAjustadoPct.toFixed(1).replace('.', ',') + '%',
    ];
    return x.cliente + '\n' + lines.join('\n');
  };

  const cuerpo = filas.map(function(x, i){
    const m = x._mg;
    const col = m.margenAjustadoPct >= 60 ? 'var(--gn)' : m.margenAjustadoPct >= 35 ? 'var(--am)' : 'var(--rd)';
    // % margen bruto recalculado con los datos desde abril (mismos umbrales de color que la tabla original)
    const pctB = m.ingresosAbril ? m.margenBrutoAbril / m.ingresosAbril * 100 : 0;
    const colB = pctB >= 60 ? 'var(--gn)' : pctB >= 35 ? 'var(--am)' : 'var(--rd)';
    const tb2 = x.tipo_cli === 'Público' ? 'pb' : x.tipo_cli === 'Privado' ? 'por' : 'pgr';
    const tl  = x.tipo_cli === 'Público' ? 'PÚB' : x.tipo_cli === 'Privado' ? 'PRIV' : 'N/D';
    const warn = m.sinRegion
      ? '<span title="Sin región asignada en la hoja Región Clientes: el costo de viaje no se puede calcular y no se asume $0." ' +
        'style="font-size:.52rem;background:var(--rd2);color:var(--rd);border-radius:3px;padding:.05rem .3rem;margin-left:.3rem;font-weight:700">⚠ SIN REGIÓN</span>'
      : '';
    return '<tr style="background:' + (i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)') + '" title="' + _tip(x) + '">' +
      '<td style="padding:.26rem .6rem;text-align:right;font-family:\'Roboto Mono\',monospace;font-size:.58rem;color:var(--mut);' + SEP + '">' + (i + 1) + '</td>' +
      '<td style="padding:.26rem .6rem;font-size:.64rem;font-weight:600;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + SEP + '">' + x.cliente + warn + '</td>' +
      '<td style="padding:.26rem .6rem;' + SEP + '"><span class="pill ' + tb2 + '">' + tl + '</span></td>' +
      '<td style="padding:.26rem .6rem;text-align:center;' + SEP + '"><span class="pill ' + (x.contrato ? 'pg' : 'pgr') + '" style="font-size:.55rem">' + (x.contrato ? 'CON' : 'SIN') + '</span></td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.65rem;font-weight:700;font-variant-numeric:tabular-nums;' + SEP + '">' + fmtMM(m.ingresosAbril) + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;color:var(--or);font-variant-numeric:tabular-nums;' + SEP + '">' + (m.costoGdAbril ? fmtMM(m.costoGdAbril) : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.64rem;font-weight:700;font-variant-numeric:tabular-nums;color:' +
        (m.margenBrutoAbril >= 0 ? 'var(--gn)' : 'var(--rd)') + ';' + SEP + '">' + fmtMM(m.margenBrutoAbril) + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.62rem;font-weight:700;font-variant-numeric:tabular-nums;color:' + colB + ';' + SEP + '">' +
        (m.ingresosAbril ? pctB.toFixed(1).replace('.', ',') + '%' : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;color:var(--or);font-variant-numeric:tabular-nums;' + SEP + '">' + (m.costoHoras ? fmtMM(m.costoHoras) : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;color:var(--or);font-variant-numeric:tabular-nums;' + SEP + '">' + (m.costoViajes ? fmtMM(m.costoViajes) : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.64rem;font-weight:700;font-variant-numeric:tabular-nums;color:' +
        (m.margenAjustado >= 0 ? 'var(--gn)' : 'var(--rd)') + ';' + SEP + '">' + fmtMM(m.margenAjustado) + '</td>' +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.62rem;font-weight:700;font-variant-numeric:tabular-nums;color:' + col + '">' +
        (m.ingresosAbril ? m.margenAjustadoPct.toFixed(1).replace('.', ',') + '%' : '<span style="color:var(--mut)">—</span>') + '</td>' +
      '<td style="padding:.26rem .6rem"><div style="display:flex;align-items:center;gap:5px">' +
        '<div style="flex:1;height:5px;background:var(--gy);border-radius:3px;overflow:hidden;min-width:36px">' +
        '<div style="height:100%;width:' + (m.ingresosAbril / maxIng * 100) + '%;background:var(--az2)"></div></div>' +
        '<span style="font-size:.55rem;color:var(--mut);min-width:32px;text-align:right">' + (totIng ? (m.ingresosAbril / totIng * 100) : 0).toFixed(1) + '%</span>' +
      '</div></td>' +
    '</tr>';
  }).join('');

  box.innerHTML =
    '<div style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
    '<table style="width:100%;border-collapse:collapse;min-width:900px">' +
    '<thead><tr>' + thPlain('#', 'right') + thPlain('CLIENTE / INSTITUCIÓN', 'left') +
      thPlain('TIPO', 'left') + thPlain('CONTRATO', 'center') +
      thPlain('REAL FACTURADO DESDE ABRIL', 'right') + thPlain('COSTO TOTAL', 'right') + thPlain('MARGEN BRUTO', 'right') + thPlain('% MARGEN BRUTO', 'right') +
      thPlain('COSTO HORAS HOMBRE', 'right') + thPlain('COSTO VIAJES', 'right') +
      thPlain('MARGEN NETO', 'right') + thPlain('% MARGEN NETO', 'right') + thPlain('% DEL TOTAL', 'right') +
    '</tr></thead><tbody>' + (cuerpo || '<tr><td colspan="13" style="text-align:center;padding:1.4rem;color:var(--mut)">Sin resultados</td></tr>') + '</tbody>' +
    '<tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td colspan="4" style="padding:.35rem .6rem;font-size:.64rem;' + SEP + '">TOTAL · ' + filas.length + ' clientes' +
        (nSinRegion ? ' · ⚠ ' + nSinRegion + ' sin región' : '') + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.65rem;' + SEP + '">' + fmtMM(totIng) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;' + SEP + '">' + fmtMM(totCosto) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + fmtMM(totMB) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;' + SEP + '">' + totMBP.toFixed(1).replace('.', ',') + '%</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;' + SEP + '">' + fmtMM(totCH) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;' + SEP + '">' + fmtMM(totCV) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.65rem;' + SEP + '">' + fmtMM(totMN) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;' + SEP + '">' + totMNP.toFixed(1).replace('.', ',') + '%</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.6rem">' + (totIngGeneral ? (totIng / totIngGeneral * 100) : 0).toFixed(1) + '%</td>' +
    '</tr></tfoot></table></div>' +
    '<p style="font-size:.55rem;color:var(--mut);margin:.5rem 0 0;line-height:1.45">' +
    '<strong>Margen Neto</strong>: la misma tabla de arriba, pero desde <strong>abril</strong> en adelante —enero a marzo ' +
    'quedan fuera de ingresos, costo y margen bruto—, porque el costo de terreno recién está cargado desde ahí. Se agregan dos ' +
    'columnas: <strong>Costo Horas Hombre</strong> = (Duración Modificada / 60) × $25.000, sumando todas las filas de la hoja ' +
    '<strong>Citas Servicios Trimestrales</strong> del cliente desde abril, y <strong>Costo Viajes</strong> = viajes únicos ' +
    '(cliente + fecha, sin importar cuántas citas o técnicos hubo ese día) × tarifa de la región del cliente (hoja ' +
    '<strong>Región Clientes</strong>; Metropolitana cuesta $50.000 por viaje). El resultado final es <strong>Margen Neto</strong> = ' +
    'Margen Bruto − Costo Horas Hombre − Costo Viajes. Un cliente <strong>sin región</strong> con viajes registrados se marca ' +
    'en rojo y su costo de viaje NO se calcula —no se asume $0—, para que se revise a mano.<br>' +
    'La fila <strong>Clientes sin Facturación</strong> queda fuera de esta vista: es un agregado sin nombre real que cruzar ' +
    'contra Citas o Región Clientes.</p>';

  const lbl = document.getElementById('pf-det-lbl');
  if(lbl) lbl.textContent = filas.length + ' clientes · ' + fmtMM(totIng) + ' ingresos desde abril · margen neto ' +
    fmtMM(totMN) + ' (' + totMNP.toFixed(1).replace('.', ',') + '%)' +
    (nSinRegion ? ' · ⚠ ' + nSinRegion + ' sin región' : '');
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
