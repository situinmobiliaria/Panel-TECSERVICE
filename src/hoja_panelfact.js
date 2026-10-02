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
  if(btn){ btn.classList.toggle('on', mgActivo); btn.setAttribute('aria-checked', mgActivo ? 'true' : 'false'); }
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
  _pfRenderComposicion();
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

// Facturación y costo de cada cliente abiertos en «contratos» y «otros».
//   · Facturación contratos: el presupuesto de contratos a la fecha del cliente
//     (panel_fact), la misma cifra con que «Facturación a la Fecha» arma su
//     F. Contratos. Facturación otros es el resto de lo que facturó (negativo
//     cuando lo devengado del contrato supera lo facturado).
//   · Costos: el costo total del cliente se reparte con la misma ponderación
//     que tiene su facturación —si 90% es de contrato y 10% otros, el costo
//     va 90/10—. Con facturación negativa, o con contrato mayor que lo
//     facturado, la ponderación se acota entre 0% y 100% para que los dos
//     costos sumen siempre el costo total. Sin facturación, el costo va a
//     contratos si el cliente tiene contrato y a otros si no.
//   · Los clientes con contrato que no facturaron nada este año no tienen fila
//     en fact_clientes: se agregan (marcados extra) para que la columna de
//     contratos sume lo mismo que «Facturación a la Fecha».
// Trabaja sobre copias: fact_clientes lo usan otras hojas y no se toca.
function _pfFilasDesglose(){
  const base = (window.APP_DATA || {}).fact_clientes || [];
  const idx = {};
  const filas = base.map(x => { const c = Object.assign({}, x, { f_ctr: 0 }); idx[_mgNorm(x.cliente)] = c; return c; });
  pfUniverso().forEach(p => {
    const v = p.presup_contr_ytd || 0;
    const c = idx[_mgNorm(p.cliente)] || idx[_mgNorm(p.nombre_analisis || '')];
    if(c) c.f_ctr += v;
    else if(v){
      const e = { cliente: p.cliente, tipo_cli: p.tipo_cli || '', contrato: true, real: 0, costo: 0, f_ctr: v, extra: true };
      filas.push(e); idx[_mgNorm(p.cliente)] = e;
    }
  });
  filas.forEach(x => {
    x.f_otr = x.real - x.f_ctr;
    const w = x.real > 0 ? Math.min(1, Math.max(0, x.f_ctr / x.real)) : (x.f_ctr > 0 ? 1 : 0);
    x.k_ctr = (x.costo || 0) * w;
    x.k_otr = (x.costo || 0) - x.k_ctr;
  });
  return filas;
}

function _pfRenderDetalle(){
  const box = document.getElementById('pf-det-tabla');
  if(!box) return;
  const todos = _pfFilasDesglose();
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
  if(mgActivo){ _pfRenderMargenNeto(filas.filter(x => !x.extra), todos.filter(x => !x.extra), totGeneral); return; }

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
  // Color de los números por grupo: totales (negro), contratos (verde azulado, como en Facturación), otros (naranja, como Otras Facturaciones)
  const GC = { t: ['var(--txt)', '', '#fff'], c: ['var(--teal)', '', '#7FE8DF'], o: ['var(--or)', '', '#FFB570'] };
  const th = (t, f, al, g) =>
    '<th onclick="pfDetSort(\'' + f + '\')" style="position:sticky;top:0;z-index:2;background:' + 'var(--az1)' + ';' +
    'color:#fff;padding:.35rem .6rem;font-size:.57rem;letter-spacing:.03em;text-align:' + al +
    ';white-space:nowrap;cursor:pointer;border-right:1px solid rgba(255,255,255,.18)">' + t +
    (_pfDetSort === f ? (_pfDetAsc ? ' ▲' : ' ▼') : '') + '</th>';
  const thPlain = (t, al, g) =>
    '<th style="position:sticky;top:0;z-index:2;background:' + 'var(--az1)' + ';color:#fff;padding:.35rem .6rem;' +
    'font-size:.57rem;text-align:' + al + ';border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';

  // Celda de monto del desglose contratos / otros: guion cuando es cero.
  const _pfCel = (v, col, g) => '<td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;' +
    'font-variant-numeric:tabular-nums;color:' + (Math.abs(v || 0) < 1 ? 'var(--mut)' : GC[g][0]) + ';' + SEP + '">' +
    (Math.abs(v || 0) < 1 ? '—' : fmtMM(v)) + '</td>';
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
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.65rem;font-weight:700;font-variant-numeric:tabular-nums;color:' + GC.t[0] + ';' + SEP + '">' + fmtMM(x.real) + '</td>' +
      _pfCel(x.f_ctr, 'var(--teal)', 'c') + _pfCel(x.k_ctr, 'var(--or)', 'c') +
      _pfCel(x.f_otr, 'var(--az2)', 'o') + _pfCel(x.k_otr, 'var(--or)', 'o') +
      '<td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;color:' + GC.t[0] + ';font-variant-numeric:tabular-nums;' + SEP + '">' + ((x.costo || 0) ? fmtMM(x.costo) : '<span style="color:var(--mut)">—</span>') + '</td>' +
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
    '<table style="width:100%;border-collapse:collapse;min-width:1120px">' +
    '<thead><tr>' + thPlain('#', 'right') + th('CLIENTE / INSTITUCIÓN', 'cliente', 'left') +
      th('TIPO', 'tipo_cli', 'left') + th('CONTRATO', 'contrato', 'center') +
      th('REAL FACTURADO A LA FECHA', 'real', 'right', 't') +
      th('FACT. CONTRATOS', 'f_ctr', 'right', 'c') + th('COSTO CONTRATOS', 'k_ctr', 'right', 'c') +
      th('FACT. OTROS', 'f_otr', 'right', 'o') + th('COSTO OTROS', 'k_otr', 'right', 'o') +
      th('COSTO TOTAL', 'costo', 'right', 't') +
      thPlain('MARGEN BRUTO', 'right', 't') + th('% MARGEN', 'margen', 'right', 't') + thPlain('% DEL TOTAL', 'right') +
    '</tr></thead><tbody>' + cuerpo + '</tbody>' +
    '<tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td colspan="4" style="padding:.35rem .6rem;font-size:.64rem;' + SEP + '">TOTAL · ' + filas.length +
        ' clientes' + ((_pfDetFilt === 'todos' && !q) ? '' : ' (filtrado)') + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;color:' + GC.t[2] + ';' + SEP + '">' + fmtMM(tot) + '</td>' +
      [['f_ctr', 'c'], ['k_ctr', 'c'], ['f_otr', 'o'], ['k_otr', 'o']].map(function(c){
        return '<td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums;color:' + GC[c[1]][2] + ';' + SEP + '">' + fmtMM(filas.reduce((s, x) => s + (x[c[0]] || 0), 0)) + '</td>';
      }).join('') +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums;color:' + GC.t[2] + ';' + SEP + '">' + fmtMM(totK) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;color:' + GC.t[2] + ';' + SEP + '">' + fmtMM(tot - totK) + '</td>' +
      '<td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;color:' + GC.t[2] + ';' + SEP + '">' + (tot ? ((tot - totK) / tot * 100).toFixed(1).replace('.', ',') : '0') + '%</td>' +
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
    'y pasa a tener su propia fila, y si aparecen otros se incorporan solos.<br>' +
    '<strong>Fact. contratos</strong> es el presupuesto de contratos a la fecha de cada cliente, la misma cifra con que ' +
    '<strong>Facturación a la Fecha</strong> arma su F. Contratos, y <strong>Fact. otros</strong> es el resto de lo que ' +
    'facturó (negativo cuando lo devengado del contrato supera lo facturado). El <strong>costo</strong> de cada cliente se ' +
    'reparte con la misma ponderación que tiene su facturación entre contratos y otros: si 90% es de contrato y 10% otros, el ' +
    'costo va 90/10. Cuando la facturación es negativa o el contrato supera lo facturado la ponderación se acota entre 0% y ' +
    '100%, de modo que costo contratos + costo otros suma siempre el costo total. Los clientes con contrato vigente que no ' +
    'facturaron este año aparecen con facturación cero para que la columna de contratos cuadre con esa hoja.</p>';

  const lbl = document.getElementById('pf-det-lbl');
  const kGeneral = todos.reduce((s, x) => s + (x.costo || 0), 0);
  if(lbl) lbl.textContent = todos.filter(x => !x.extra).length + ' clientes · ' + fmtMM(totGeneral) + ' facturado · ' +
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

// ═══════════════════════════════════════════════════════════════
// COMPOSICIÓN DE LA FACTURACIÓN POR TIPO DE CLIENTE
//
// Cada fila es un solo tipo de ingreso, como «Composición total: contratos
// vs correctiva» de Facturación a la Fecha: la parte de contrato de cada
// cliente es su presupuesto de contratos a la fecha y otras facturaciones, el resto.
//   · Con contrato (contrato vigente, término ≥ hoy): «Contratos activos» es
//     su parte de contrato; «Facturación spot» y «Garantías» (clientes cuyos
//     vigentes son todos de garantía), sus otras facturaciones.
//   · Sin contrato: «Contratos vencidos» es la parte de contrato de los que
//     tuvieron uno y ya no; «Facturación spot», las otras facturaciones de todos.
//   · Perdidos: facturaron en 2025 y nada en 2026. Su columna 2025 es la
//     facturación anual que se dejó de percibir.
//   · Nuevos: facturan por primera vez en 2026 sin contrato (sin facturación
//     2024–2025 ni contrato anterior); los que ya firmaron uno van en Con
//     contrato. Todo lo suyo es otras facturaciones.
//
// El universo es el mismo de la hoja (panel_fact), así que la facturación
// 2026 cuadra con el KPI «Real a la fecha» y con «Facturación a la Fecha».
// La facturación 2025 de cada cliente sale de BASE MAPA (año completo).
// ═══════════════════════════════════════════════════════════════

// El mismo cliente escrito distinto entre años: el nombre de 2025 (BASE
// MAPA) → el nombre con que factura en 2026. Revisado a mano (30-09-2026);
// lo que calza por palabras (S.A. / S.P.A., puntos) se junta solo.
const PC_ALIAS = {
  'HOSPITAL CLINICO GRAL. DR. RAUL YAZIGI': 'HOSPITAL CLINICO DE LA FUERZA AEREA FACH GRAL DR RAUL YAZIGI JAUREGUI',
  'CENTRO OFTALMOLOGICO DR EDGARDO CARRENO SPA': 'CENTRO OFTALMOLOGICO DR. E. CARRENO SPA',
  'HOSPITAL ORIENTE DR LUIS TISNE BROUSSE': 'HOSPITAL DR. LUIS TISNE B.',
  'SERVICIO DE SALUD ARICA HOSP DR JUAN NOE CREVANI': 'HOSPITAL REGIONAL DE ARICA DR. JUAN NOE CREVANI',
  'CLINICA REGIONAL LA PORTADA DE ANTOFAGASTA S.A': 'CLINICA PORTADA DE ANTOFAGASTA STA',
  'INMOBILIARIA SANATORIO ALEMAN SPA': 'CLINICA SANATORIO ALEMAN S.A',
  'SERVICIOS MEDICOS VESPUCIO LTDA.': 'CLINICA VESPUCIO SPA',
  'CLINICA MEDS LA DEHESA SPA': 'CLINICA MEDS LTDA',
};
const _PC_CON = new Set(['DE','DEL','LA','LAS','LOS','EL','Y','E','AL','EN']);
const _PC_RAZ = new Set(['SPA','LTDA','LIMITADA','EIRL','CIA','COMPANIA','SA','SAC','DR','DRA','DOCTOR','DOCTORA','ILUSTRE']);
function _pcClave(s){
  const t = _mgNorm(s).replace(/[^A-Z0-9Ñ ]+/g,' ').split(/\s+/)
    .filter(w => w.length > 1 && !_PC_CON.has(w) && !_PC_RAZ.has(w));
  return t.length ? Array.from(new Set(t)).sort().join(' ') : _mgNorm(s);
}
let _pcAbierta = null;   // fila de la tabla con su lista de clientes desplegada
function pcToggle(k){ _pcAbierta = (_pcAbierta === k) ? null : k; _pfRenderComposicion(); }

// Cliente con un contrato que ya terminó sin renovarse (hoja de contratos
// perdidos). Se usa para los que sólo existen en BASE MAPA y no traen su
// historial de contratos.
function _pcPerdidoVG(nombre){
  const k = _mgNorm(nombre), cl = _pcClave(nombre);
  return (typeof PERDIDOS_VG !== 'undefined' ? PERDIDOS_VG : []).some(c =>
    _mgNorm(c.cliente) === k || _pcClave(c.cliente) === cl);
}

function _pcClientes(){
  const A = window.APP_DATA || {};
  const hoy = A.hoy || '';
  const norm = _mgNorm;
  const PF = pfUniverso();

  // Contratos por cliente (nombre del contrato), y desglose de FACTURACION.
  const ctr = {};
  (typeof DATA !== 'undefined' ? DATA : []).forEach(c => { (ctr[norm(c.cliente)] = ctr[norm(c.cliente)] || []).push(c); });
  const fd = {};
  Object.keys(A.fact_desglose || {}).forEach(k => { const v = A.fact_desglose[k]; fd[norm(v.nombre)] = v; fd[k] = v; });

  const out = [], porNom = {}, porClave = {};
  PF.forEach(p => {
    const ks = [norm(p.cliente), norm(p.nombre_analisis || '')].filter((k, i, a) => k && a.indexOf(k) === i);
    const f = ks.map(k => fd[k]).find(Boolean) || null;
    const cs = [].concat.apply([], ks.map(k => ctr[k] || []));
    const d = { n: p.cliente, tipo: p.tipo_cli || '', real: _pfReal(p),
      r25: Math.max(p.real_anual_2025 || 0, f ? f.t25 || 0 : 0), r24: p.real_anual_2024 || 0,
      f: f, p: p, vig: cs.filter(c => (c.fin || '') >= hoy),
      hist: cs.length > 0 || (p.contr_2025 || 0) > 0 || (p.contr_2024 || 0) > 0 || !!(f && ((f.c25 || 0) > 0 || (f.c26 || 0) > 0)) ||
        p.estado_relacion === 'Renovado' || p.estado_relacion === 'Perdido' || _pcPerdidoVG(p.cliente) };
    out.push(d);
    ks.forEach(k => { porNom[k] = d; });
    const cl = _pcClave(p.cliente);
    porClave[cl] = porClave[cl] === undefined ? d : null;   // null = ambigua
  });

  // Facturación 2025 desde BASE MAPA. Si el cliente de 2025 calza con uno que
  // factura en 2026 —por nombre, alias o palabras—, se le suma a ese; si no,
  // es un cliente perdido.
  (window.MAPA_DATA || []).forEach(m => {
    const v25 = m.ingreso_2025 || 0;
    if (!v25) return;
    const k = norm(m.n);
    const d = porNom[k] || (PC_ALIAS[k] && porNom[norm(PC_ALIAS[k])]) || porClave[_pcClave(m.n)];
    if (d) { d.m25 = (d.m25 || 0) + v25; return; }
    out.push({ n: m.n, tipo: m.tipo || '', real: m.ingreso_2026 || 0, r25: 0, m25: v25, r24: 0, f: null, p: null, vig: [],
      hist: _pcPerdidoVG(m.n) });
  });

  out.forEach(d => {
    // ¿Facturó en 2025? Cuenta cualquier fuente (BASE MAPA, FACTURACION, BBDD).
    const hubo25 = (d.m25 || 0) > 0 || d.r25 > 0;
    // ¿Tuvo relación antes de 2026? Cualquier rastro descarta que sea nuevo:
    // facturación 2024–2025 en BBDD, contratos facturados esos años, o un
    // contrato que figura como renovado o perdido (hubo uno anterior).
    const p = d.p || {};
    const antes = hubo25 || d.r24 > 0 || (p.real_ytd_2025 || 0) > 0 || (p.real_ytd_2024 || 0) > 0 ||
      (p.contr_2025 || 0) > 0 || (p.contr_2024 || 0) > 0 || !!(d.f && (d.f.c25 || 0) > 0) ||
      p.estado_relacion === 'Renovado' || p.estado_relacion === 'Perdido';
    // Monto 2025: sólo BASE MAPA, que suma lo mismo que el año completo de
    // BBDD. Las otras fuentes traen a clientes que BASE MAPA ya tiene con otro
    // nombre y, sumadas, lo contarían dos veces; sólo se usan para un perdido
    // que no aparece en BASE MAPA.
    d.r25 = d.m25 != null ? d.m25 : (!d.real ? d.r25 : 0);
    // Un cliente nuevo que ya firmó contrato es cliente con contrato: su parte
    // de contrato va con los contratos activos. «Nuevos» son los que facturan
    // por primera vez sin contrato, así que toda su facturación es otras facturaciones.
    if (d.vig.length) d.cat = d.vig.every(c => c.tipo === 'Garantia') ? 'gar' : 'act';
    else if (d.real > 0 && !antes) d.cat = 'nuevo';
    // Perdido: tuvo contrato, ya terminó y no ha facturado nada en 2026 en ninguna
    // fuente (la hoja FACTURACION puede traer cobros que la base de ingresos no).
    else if (!d.real) d.cat = (d.hist && !((p.real_ytd || 0) > 0) && !(d.f && (d.f.t26 || 0) > 0)) ? 'perd' : null;
    else d.cat = d.hist ? 'venc' : 'spots';
    // Parte de contrato: el presupuesto de contratos a la fecha, la misma cifra
    // con que «Facturación a la Fecha» arma su F. Contratos (y la misma de la
    // columna Facturación Total Contratos de FACTURACION). El spot es el resto.
    d.contr = (d.p && d.p.presup_contr_ytd) || 0;
    d.spot = d.real - d.contr;
    d.contr25 = d.f ? Math.min(d.f.c25 || 0, d.r25) : 0;
    d.spot25 = d.r25 - d.contr25;
  });
  return out.filter(d => d.cat && (pfTipo === 'todos' || d.tipo === pfTipo));
}

function _pfRenderComposicion(){
  const box = document.getElementById('pf-comp-tabla');
  if (!box) return;
  const L = _pcClientes();
  const de = c => L.filter(d => d.cat === c);
  const suma = (arr, f) => arr.reduce((s, d) => s + (f(d) || 0), 0);
  const tot26 = suma(L, d => d.real);

  // Cada fila es un solo tipo de ingreso —contrato u otras facturaciones—, igual que
  // «Composición total: contratos vs correctiva» de Facturación a la Fecha:
  // la parte de contrato de cada cliente es su presupuesto de contratos a la
  // fecha y otras facturaciones, el resto de lo que facturó. Así las filas de
  // contrato suman el F. Contratos de esa hoja y las demás, sus Otras Facturaciones.
  const conC = L.filter(d => d.cat === 'gar' || d.cat === 'act');
  const sinC = L.filter(d => d.cat === 'venc' || d.cat === 'spots' || d.cat === 'perd');
  const nue = de('nuevo');
  const cont = arr => arr.filter(d => Math.abs(d.contr) >= 1);
  const spot = arr => arr.filter(d => d.spot >= 1);

  // [clave, etiqueta, clientes, fact 2026, fact 2025, nivel, lista (cliente, 2026, 2025), tipo]
  const fila_ = (k, lbl, n, arr, f26, f25, niv, tipo) => [k, lbl, n, suma(arr, f26), suma(arr, f25), niv,
    arr ? arr.filter(d => Math.abs(f26(d) || 0) >= 1 || (k === 'perd')).map(d => [d.n, f26(d), f25(d)]) : null, tipo];
  const real = d => d.real, r25 = d => d.r25;
  const cP = d => d.contr, c25 = d => d.contr25, sP = d => d.spot, s25 = d => d.spot25;
  const F = [
    [ 'con', 'Con Contrato', conC.length, suma(conC, real), suma(conC, r25), 0, null ],
    fila_('act',   'Contratos Activos', cont(conC).length, conC, cP, c25, 1, 'c'),
    fila_('spotc', 'Facturación Spot Clientes con Contrato', spot(de('act')).length, de('act'), sP, s25, 1, 's'),
    fila_('gar',   'Garantías', de('gar').length, de('gar'), sP, s25, 1, 's'),
    [ 'sin', 'Sin Contrato', sinC.length, suma(sinC, real), suma(sinC, r25), 0, null ],
    fila_('venc',  'Contratos Vencidos', cont(sinC).length, sinC, cP, c25, 1, 'c'),
    fila_('spots', 'Facturación Spot Clientes sin Contrato', spot(sinC).length, sinC, sP, s25, 1, 's'),
    [ 'perd', 'Perdidos (Sin Facturación Actual)', de('perd').length, 0, suma(de('perd'), r25), 1,
      de('perd').map(d => [d.n, 0, d.r25]), null ],
    fila_('nuevo', 'Nuevos (Facturación por Primera Vez)', nue.length, nue, real, r25, 0, 's'),
  ];
  const totC = F.filter(r => r[7] === 'c').reduce((s, r) => s + r[3], 0);
  const totS = F.filter(r => r[7] === 's').reduce((s, r) => s + r[3], 0);
  const totC25 = F.filter(r => r[7] === 'c').reduce((s, r) => s + r[4], 0);
  const totS25 = F.filter(r => r[7] === 's').reduce((s, r) => s + r[4], 0);

  const SEP = 'border-right:1px solid var(--brd)';
  const th = (t, al) => '<th style="background:var(--az1);color:#fff;padding:.34rem .6rem;font-size:.57rem;letter-spacing:.03em;' +
    'text-align:' + al + ';white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
  const num = (v, st) => '<td style="padding:.3rem .6rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;' +
    (st || '') + SEP + '">' + v + '</td>';
  const pct = v => tot26 ? (v / tot26 * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const marca = t => t === 'c' ? '<span style="font-size:.5rem;font-weight:700;color:var(--teal);border:1px solid var(--teal);' +
      'border-radius:3px;padding:0 .25rem;margin-left:.35rem">CONTRATO</span>'
    : t === 's' ? '<span style="font-size:.5rem;font-weight:700;color:var(--or);border:1px solid var(--or);' +
      'border-radius:3px;padding:0 .25rem;margin-left:.35rem">MANTENCIONES CORRECTIVAS Y OTRAS FACTURACIONES</span>' : '';
  const fila = r => {
    const [k, lbl, n, f26, f25, niv, lista, tipo] = r;
    const perd = k === 'perd', abierta = _pcAbierta === k;
    const bg = perd ? 'background:rgba(255,230,0,.28);' : niv === 0 ? 'background:var(--bg2);' : '';
    let h = '<tr style="' + bg + (niv === 0 ? 'border-top:1px solid var(--txt);font-weight:700;' : '') +
      (lista ? 'cursor:pointer' : '') + '"' + (lista ? ' onclick="pcToggle(\'' + k + '\')" title="Clic para ver los clientes"' : '') + '>' +
      '<td style="padding:.3rem .6rem;font-size:.66rem;' + (niv ? 'padding-left:1.5rem;' : '') + SEP + '">' +
        (lista ? '<span style="color:var(--mut);font-size:.55rem;display:inline-block;width:.8rem">' + (abierta ? '▾' : '▸') + '</span>' : '') +
        lbl + marca(tipo) + '</td>' +
      num(n, 'font-weight:700;') +
      num(perd ? '<span style="color:var(--mut)">—</span>' : fmtMM(f26), perd ? '' : 'font-weight:700;') +
      num(perd ? '—' : pct(f26), 'color:var(--mut);') +
      num(f25 ? fmtMM(f25) : '—', perd ? 'color:var(--rd);font-weight:800;' : 'color:var(--mut);') + '</tr>';
    if (abierta && lista) {
      const ord = lista.slice().sort((a, b) => (perd ? b[2] - a[2] : b[1] - a[1]));
      const td = (v, st) => '<td style="padding:.18rem .5rem;font-size:.6rem;text-align:right;font-variant-numeric:tabular-nums;width:8rem;' +
        (st || '') + '">' + v + '</td>';
      h += '<tr><td colspan="5" style="padding:0 0 .4rem 1.5rem;background:var(--bg)"><div style="max-height:260px;overflow:auto;border:1px solid var(--brd);border-radius:4px">' +
        '<table style="width:100%;border-collapse:collapse">' + ord.map((c, i) =>
          '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
          '<td style="padding:.18rem .5rem;font-size:.58rem;color:var(--mut);width:2rem;text-align:right">' + (i + 1) + '</td>' +
          '<td style="padding:.18rem .5rem;font-size:.6rem">' + c[0] + '</td>' +
          td(c[1] ? fmtMM(c[1]) : '—') + td(c[2] ? fmtMM(c[2]) : '—', 'color:var(--mut);') + '</tr>'
        ).join('') + '</table></div></td></tr>';
    }
    return h;
  };
  const resumen = (lbl, v26, v25, col) => '<tr style="font-weight:700;border-top:1px solid var(--brd)">' +
    '<td style="padding:.28rem .6rem;font-size:.64rem;color:' + col + ';' + SEP + '">' + lbl + '</td>' + num('') +
    num(fmtMM(v26), 'color:' + col + ';') + num(pct(v26), 'color:' + col + ';') + num(fmtMM(v25), 'color:var(--mut);') + '</tr>';

  box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:640px"><thead><tr>' +
    th('CLIENTE', 'left') + th('#', 'right') + th('FACT. ' + ANO_ACTUAL + ' (ENE–' + MES_CORTE_NOMBRE.slice(0, 3).toUpperCase() + ')', 'right') +
    th('% FACT.', 'right') + th('FACT. ' + (ANO_ACTUAL - 1) + ' (AÑO)', 'right') + '</tr></thead><tbody>' +
    F.map(fila).join('') +
    '<tr><td colspan="5" style="height:.4rem;border-top:1px solid var(--txt)"></td></tr>' +
    resumen('Total Contratos', totC, totC25, 'var(--teal)') +
    resumen('Total Mantenciones Correctivas y Otras Facturaciones', totS, totS25, 'var(--or)') +
    '<tr style="background:var(--az3);color:#fff;font-weight:800">' +
      '<td style="padding:.34rem .6rem;font-size:.66rem;' + SEP + '">TOTAL</td>' +
      num(L.length, 'color:#fff;') + num(fmtMM(tot26), 'color:#FFC000;') + num('100%', 'color:#fff;') +
      num(fmtMM(suma(L, r25)), 'color:#B8C1D8;') + '</tr>' +
    '</tbody></table>' +
    '<p style="font-size:.55rem;color:var(--mut);margin:.5rem 0 0;line-height:1.5">' +
    'Cada fila es un solo tipo de ingreso, igual que «Composición total: contratos vs correctiva» de <strong>Facturación a la ' +
    'Fecha</strong>: la parte de <strong>contrato</strong> de cada cliente es su presupuesto de contratos a la fecha y la ' +
    '<strong>otras facturaciones</strong>, el resto de lo que facturó. Por eso Total Contratos y Total Otras Facturaciones son las ' +
    'mismas cifras de esa hoja. <strong>Con contrato</strong>: al menos un contrato vigente al ' + String(APP_DATA.hoy || '').split('-').reverse().join('/') +
    ' (fecha de término no vencida); <strong>Garantías</strong> son las otras facturaciones de los clientes cuyos contratos vigentes ' +
    'son todos de garantía. Un mismo cliente con contrato aparece en Contratos activos y en su fila de otras facturaciones. ' +
    '<strong>Contratos vencidos</strong>: la parte de contrato de los que tuvieron contrato y hoy no tienen uno vigente. ' +
    'Las otras facturaciones de un cliente salen negativas cuando lo devengado de su contrato supera lo que facturó; el # de esas ' +
    'filas cuenta sólo a los que tienen otras facturaciones positivas. <strong>Perdidos</strong>: clientes que tuvieron contrato, cuyo plazo terminó sin renovarse y que no han facturado nada en ' +
    ANO_ACTUAL + '; su columna ' + (ANO_ACTUAL - 1) + ' es la facturación anual perdida. <strong>Nuevos</strong>: ' +
    'facturan por primera vez en ' + ANO_ACTUAL + ', sin contrato (los que ya firmaron uno están en Con contrato). La facturación ' +
    (ANO_ACTUAL - 1) + ' es de BASE MAPA (año completo), que suma lo mismo que el año completo de la BBDD. Respeta el filtro de ' +
    'tipo de cliente. Clic en una fila para ver sus clientes.</p>';
  const lbl = document.getElementById('pf-comp-lbl');
  if (lbl) lbl.textContent = L.filter(d => d.real).length + ' clientes con facturación · ' + de('perd').length +
    ' perdidos · ' + fmtMM(tot26) + ' facturado';
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
