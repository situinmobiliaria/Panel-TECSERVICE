// ═══════════════════════════════════════════════════════════════
// hoja_base_instalada.js — Base Instalada de Equipos
// Depende de: datos.js (APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let _chBILinea=null, _chBITipos=null, _chBIClientes=null, _chBIRegion=null;
let _biFiltLinea='todos', _biFiltEstado='todos', _biFiltRelacion='todos', _biQuery='';
let _biFiltPotencial='todos';
let _biLineasFiltroTipos='todos';
let _biSortCol=2, _biSortAsc=false;
let _biAllClientes=[]; // lista completa para re-filtrar con potencial

// Lookup maps cruzados con panel (facturación) y DATA (contratos activos)
let _biPanelMap={}, _biContratoMap={}, _biFacRes={};

function _biNorm(s){ return s?s.trim().toUpperCase().replace(/\s+/g,' ').normalize('NFD').replace(/[̀-ͯ]/g,''):''; }

// Resolución 1:1 entre cliente de Base Instalada y cliente de facturación.
// El match parcial suelto confundía hospitales distintos que comparten
// prefijo — «Hospital San José» calzaba además con los de Maipú, Melipilla
// y Casablanca, y su facturación se contaba cuatro veces (MM$51,6 de más).
// Ahora el match exacto reclama primero y el parcial sólo toma entradas
// libres y sin ambigüedad: si dos clientes BI se disputan la misma entrada,
// ninguno se la queda.
function _biResolverFac(clientes){
  _biFacRes={};
  const tomadas=new Set(), pendientes=[];
  (clientes||[]).forEach(c=>{
    const k=_biNorm(c.nombre);
    if(!k) return;
    if(_biPanelMap[k]){ _biFacRes[k]=_biPanelMap[k]; tomadas.add(k); }
    else if(k.length>=8) pendientes.push(k);
  });
  const cand={};
  pendientes.forEach(k=>{
    const hit=Object.keys(_biPanelMap).filter(pk=>
      pk.length>=8 && !tomadas.has(pk) && (pk.includes(k)||k.includes(pk)));
    if(hit.length===1){ (cand[hit[0]]=cand[hit[0]]||[]).push(k); }
  });
  Object.keys(cand).forEach(pk=>{
    if(cand[pk].length===1) _biFacRes[cand[pk][0]]=_biPanelMap[pk];
  });
}
function _biLookupPanel(nombre){ return _biFacRes[_biNorm(nombre)]||null; }

// Facturación de una lista de clientes BI contando cada cliente una sola vez.
// BASE INSTALADA trae algún nombre repetido (Corporación Municipal de
// Providencia aparece dos veces), y sumar por fila inflaba el total.
function _biFacUnicos(list){
  const usados = new Set();
  let monto = 0;
  (list||[]).forEach(c=>{
    const p = _biLookupPanel(c.nombre);
    if(!p || usados.has(p.cliente)) return;
    usados.add(p.cliente);
    monto += _biFac(p);
  });
  return { monto: monto, usados: usados };
}

// Clientes que facturan y no tienen ninguna fila en la base instalada. Van
// como fila «Otros clientes» al pie de la tabla para que la columna Fac. 2026
// cierre en el mismo total que el resto del panel. El monto se calcula como
// residuo contra ese total, así el cuadre no depende de que los nombres
// coincidan entre las dos fuentes.
function _biOtrosFac(){
  const facCli = APP_DATA.fact_clientes || [];
  const totPanel = facCli.reduce((s,c)=>s+(c.real||0),0);
  const { monto: cruz, usados } = _biFacUnicos(_biAllClientes);
  const fuera = facCli.filter(c=>!usados.has(c.cliente) && (c.real||0)>0);
  return { n: fuera.length, monto: totPanel - cruz, clientes: fuera,
           cruz: cruz, tot: totPanel, usados: usados };
}

// La fila «Otros clientes» sólo tiene sentido sobre el universo completo: con
// un filtro activo el pie muestra el subconjunto y agregarla lo desvirtuaría.
function _biSinFiltros(){
  return _biFiltPotencial==='todos' && _biFiltEstado==='todos' &&
         _biFiltRelacion==='todos'  && _biFiltLinea==='todos'  && !_biQuery;
}

// Facturación del año del cliente. real_ytd_fac viene de la BBDD y es la
// misma base que «Ingresos Totales» de la portada; real_ytd sale de la hoja
// FACTURACION y no cuadra con el resto del panel.
function _biFac(p){ return p ? (p.real_ytd_fac!==undefined?(p.real_ytd_fac||0):(p.real_ytd||0)) : 0; }
function _biLookupContrato(nombre){
  const k=_biNorm(nombre);
  if(_biContratoMap[k]) return _biContratoMap[k];
  if(k.length>=8){
    const found=Object.keys(_biContratoMap).find(ck=>ck.includes(k)||k.includes(ck));
    if(found) return _biContratoMap[found];
  }
  return null;
}

// Badge de estado relación (desde panel de facturación)
// ── POTENCIAL ST ANUAL (MANTENIMIENTO BI) ──────────────────────
// Valor anual de mantención por equipo, según línea de negocio. Se aplica
// sólo sobre los equipos con Potencial ST = Sí, por eso usa _biVal(), que
// ya devuelve el conteo del filtro activo.
//   Esterilización  50 UF/año
//   Endoscopía      22 UF/año
//   Dental          15 UF/año
// Los montos quedan fijos en pesos a propósito: no se recalculan con la UF
// del día para que el tablero no cambie de cifras entre una corrida y otra.
const _BI_TARIFA = {
  esterilizacion: 2043239,   // 50 UF
  endoscopia:      898585,   // 22 UF
  dental:          612671,   // 15 UF
};

function _biPotAnual(c){
  return Object.keys(_BI_TARIFA).reduce((s,k)=>s+_biVal(c,k)*_BI_TARIFA[k],0);
}

// Potencial ST por región. Se calcula sumando el potencial de los mismos
// clientes que muestra la tabla de Detalle por Cliente y excluyendo a los que
// ya tienen contrato o garantía vigente, igual que el total de esa tabla; si
// se multiplicaran los equipos de la región por la tarifa, el número no
// calzaría porque incluiría a los clientes ya capturados.
// Cada cliente se atribuye a la región donde tiene la mayoría de sus equipos.
let _biRegPotMap = null;
function _biRegPotCalc(){
  _biRegPotMap = {};
  (_biAllClientes||[]).forEach(c=>{
    const p = _biLookupPanel(c.nombre), d = _biLookupContrato(c.nombre);
    if((d && d.n > 0) || (p && p.tiene_contrato)) return;   // ya capturado
    const r = c.region || 'Sin región';
    _biRegPotMap[r] = (_biRegPotMap[r] || 0) + _biPotAnual(c);
  });
  return _biRegPotMap;
}
function _biRegPot(d){
  if(!_biRegPotMap) _biRegPotCalc();
  return _biRegPotMap[d.region] || 0;
}

// Celda de la columna "Potencial ST Anual": si el cliente ya tiene contrato
// no hay potencial que capturar, se marca como CONTRATO ACTIVO.
function _biPotCelda(c,p,d){
  const conContrato = (d && d.n > 0) || (p && p.tiene_contrato);
  if(conContrato) return '<span class="badge bok">Contrato activo</span>';
  const v = _biPotAnual(c);
  if(!v) return '<span style="color:var(--mut)">—</span>';
  return `<strong style="color:var(--am);font-family:'Roboto Mono',monospace">${mm(v)}</strong>`;
}

function _biRelBadge(p,d){
  if(!p&&!d) return '<span class="badge bgy">Sin datos</span>';
  if(d&&d.n>0){
    if(d.tipos.includes('Comercial'))return'<span class="badge bok">Contrato activo</span>';
    return'<span class="badge bte">Garantía activa</span>';
  }
  if(p){
    const er=p.estado_relacion||'';
    if(er==='Nuevo')    return'<span class="badge bte">Nuevo</span>';
    if(er==='Renovado') return'<span class="badge bok">Renovado</span>';
    if(er==='Perdido')  return'<span class="badge brd">Perdido</span>';
    if(p.tiene_contrato)return'<span class="badge bok">Con contrato</span>';
    return'<span class="badge bgy">Sin contrato</span>';
  }
  return'<span class="badge bgy">Sin contrato</span>';
}

// Colores por línea de negocio
const _BI_LINEA_COLORES = {
  'DENTAL':            '#FFC000',
  'ESTERILIZACIÓN':    '#002D73',
  'ESTERILIZACION':    '#002D73',
  'INCARDIA':          '#D46000',
  'ENDOSCOPIA':        '#28D2C3',
  'MOBILIARIO CLINICO':'#7B2FBE',
  'MMQ':               '#00832F',
  'REAS':              '#C00000',
};
function _biLineaColor(l){ return _BI_LINEA_COLORES[l] || '#B8C1D8'; }

function _biEstadoBadge(estado){
  if(estado==='Contrato')     return `<span class="badge bok">Contrato</span>`;
  if(estado==='Garantia')     return `<span class="badge bte">Garantía</span>`;
  if(estado==='Sin garantia') return `<span class="badge bgy">Sin garantía</span>`;
  return `<span class="badge bgy">Sin clasificar</span>`;
}

// Lista base para KPIs, cards y gráficos — siempre todos los clientes.
// _biVal() se encarga de devolver el conteo correcto (total/total_si/total_no)
// según el filtro activo, sin necesidad de excluir clientes.
function _biBaseList(){
  return _biAllClientes;
}
// Obtiene el valor correcto de total/línea según filtro potencial activo
function _biVal(c, prop){
  if(_biFiltPotencial === 'si') return c[prop+'_si'] !== undefined ? c[prop+'_si'] : c[prop] || 0;
  if(_biFiltPotencial === 'no') return c[prop+'_no'] !== undefined ? c[prop+'_no'] : c[prop] || 0;
  return c[prop] || 0;
}

function _biClientesFiltrados(){
  let list = _biBaseList();

  // Para filtros de potencial, ocultar clientes con 0 equipos en la vista activa
  if(_biFiltPotencial !== 'todos'){
    list = list.filter(c => _biVal(c,'total') > 0);
  }

  if(_biFiltEstado !== 'todos'){
    list = list.filter(c => c.estado === _biFiltEstado);
  }
  if(_biFiltRelacion !== 'todos'){
    list = list.filter(c => {
      const d = _biLookupContrato(c.nombre);
      const tieneContrato = d && d.n > 0;
      return _biFiltRelacion === 'con' ? tieneContrato : !tieneContrato;
    });
  }
  if(_biFiltLinea !== 'todos'){
    const linea = _biFiltLinea;
    list = list.filter(c => {
      if(linea==='dental')        return c.dental > 0;
      if(linea==='esterilizacion') return c.esterilizacion > 0;
      if(linea==='incardia')      return c.incardia > 0;
      if(linea==='endoscopia')    return c.endoscopia > 0;
      if(linea==='mobiliario')    return c.mobiliario > 0;
      if(linea==='mmq_reas')      return c.mmq_reas > 0;
      return true;
    });
  }
  if(_biQuery){
    const q = _biQuery.toLowerCase();
    list = list.filter(c => c.nombre.toLowerCase().includes(q));
  }

  // Sort — siempre por base instalada total (filtrada) mayor a menor como primario
  const cols = ['nombre','nombre','total','dental','esterilizacion','incardia','endoscopia','mobiliario','mmq_reas','estado'];
  const colKey = cols[_biSortCol] || 'total';
  list = [...list].sort((a,b)=>{
    // Para columnas numéricas usar _biVal para respetar el filtro potencial activo
    const numProps = ['total','dental','esterilizacion','incardia','endoscopia','mobiliario','mmq_reas'];
    if(numProps.includes(colKey)){
      const va = _biVal(a, colKey), vb = _biVal(b, colKey);
      if(va !== vb) return _biSortAsc ? va-vb : vb-va;
      // Orden secundario: total filtrado descendente
      return _biVal(b,'total') - _biVal(a,'total');
    }
    const va = a[colKey], vb = b[colKey];
    const cmp = _biSortAsc
      ? String(va).localeCompare(String(vb),'es')
      : String(vb).localeCompare(String(va),'es');
    if(cmp !== 0) return cmp;
    return _biVal(b,'total') - _biVal(a,'total');
  });
  return list;
}

// Regiones desplegadas en la tabla de Detalle por Cliente. La tabla abre
// mostrando sólo las regiones: con más de 200 clientes, la lista plana obliga
// a buscar a ojo, mientras que el orden geográfico es el que usa el equipo
// comercial para repartirse el trabajo.
const _biRegAbierta = {};
window._biTogReg = function (r) {
  _biRegAbierta[r] = !_biRegAbierta[r];
  _biRenderTabla();
};
window._biRegTodas = function (abrir) {
  Object.keys(_biRegAbierta).forEach(k => delete _biRegAbierta[k]);
  if (abrir) _biClientesFiltrados().forEach(c => { _biRegAbierta[c.region || 'Sin región'] = true; });
  _biRenderTabla();
};

// Potencial de un cliente, abierto en sus tres componentes. El de
// mantenimiento sólo cuenta en quien NO tiene contrato: donde ya lo hay no
// queda nada por capturar. El de equipos y el de garantías vienen del
// pipeline, que es venta futura y aplica tenga o no contrato hoy.
// Pipeline de clientes que no están en la base instalada: concesionarias y
// hospitales nuevos, que es donde justamente se vende equipo. Va en la fila de
// cierre para que el total de la columna calce con la suma del Excel.
function _biPipeResid(){
  const r = (APP_DATA.base_instalada || {}).pipe_resid || {};
  return { monto: +r.monto || 0, st: +r.st || 0, n: +r.n || 0 };
}

// ── VIDA MEDIA DE LA BASE INSTALADA ────────────────────────────
// Los años desde la instalación salen de la hoja Prospectos BI, que lee la
// «Fecha de Compra» equipo por equipo. Sólo un tercio de la base la trae, así
// que junto al promedio se guarda sobre cuántos equipos se calculó: una vida
// media de 6 años sobre el 20% del parque dice bastante menos que la misma
// cifra sobre el 90%, y sin ese dato al lado no hay cómo distinguirlas.
// Vida útil de referencia de cada tipo de equipo, en años. Sale de la tabla
// que se mantiene aparte, no del sistema.
const _BI_VU = APP_DATA.vida_util || {};
const _biVU = t => +_BI_VU[String(t || '').trim().toUpperCase()] || 0;

// El desgaste se mide como proporción de la vida útil y no en años absolutos:
// una turbina dental de 2 años de vida útil con 1,8 encima está al 90% y toca
// renovarla, mientras que un autoclave de 15 años con esos mismos 1,8 va en el
// 12%. El promedio en años de los dos no describe a ninguno.
// Un equipo entra al promedio sólo si trae fecha de instalación Y su tipo
// tiene vida útil de referencia; los demás quedan fuera y se reportan en la
// cobertura, para no inventar un desgaste que no se puede calcular.
let _biVidaIdx = null;
function _biVidaIndice(){
  if(_biVidaIdx) return _biVidaIdx;
  const P = APP_DATA.prosp_bi || {};
  const cl = P.clientes || [], tp = P.tipos || [], filas = P.filas || [], hoy = P.hoy_ym || 0;
  const idx = {};
  filas.forEach(f=>{
    const k = _biNorm(cl[f[3]] || '');
    if(!k) return;
    const d = idx[k] || (idx[k] = { n:0, nf:0, suma:0, sumaA:0 });
    d.n++;
    const vu = _biVU(tp[f[2]]);
    if(f[6] >= 0 && vu > 0){
      const anios = (hoy - f[6]) / 12;
      d.nf++; d.suma += anios / vu * 100; d.sumaA += anios;
    }
  });
  _biVidaIdx = idx;
  return idx;
}

// Desgaste de un grupo de clientes: % medio de vida útil consumida, los años
// que hay detrás y sobre qué parte del parque se pudo calcular.
function _biVida(cs){
  const idx = _biVidaIndice();
  let n = 0, nf = 0, suma = 0, sumaA = 0;
  (cs||[]).forEach(c=>{
    const d = idx[_biNorm(c.nombre)];
    if(!d) return;
    n += d.n; nf += d.nf; suma += d.suma; sumaA += d.sumaA;
  });
  return { vida: nf ? suma/nf : null, anios: nf ? sumaA/nf : null,
           nf: nf, n: n, cob: n ? nf/n : 0 };
}

// Las líneas de negocio, con el color con que las pinta el resto de la hoja.
// El texto va oscuro sobre los tonos claros: blanco sobre amarillo no se lee.
const _BI_LIN = [
  { label: 'Dental',             prop: 'dental',         color: 'FFC000', ink: '1A1A1A' },
  { label: 'Esterilización',     prop: 'esterilizacion', color: '002D73', ink: 'FFFFFF' },
  { label: 'Incardia',           prop: 'incardia',       color: 'D46000', ink: 'FFFFFF' },
  { label: 'Endoscopía',         prop: 'endoscopia',     color: '28D2C3', ink: '1A1A1A' },
  { label: 'Mobiliario Clínico', prop: 'mobiliario',     color: '7B2FBE', ink: 'FFFFFF' },
  { label: 'MMQ / REAS',         prop: 'mmq_reas',       color: '00832F', ink: 'FFFFFF' },
  { label: 'Otros',              prop: 'otros',          color: 'B8C1D8', ink: '1A1A1A' },
];

// El nombre de la línea en el Excel se agrupa igual que en la base instalada:
// MMQ y REAS caen juntas y todo lo que no está en la lista va a «Otros». Si
// las dos agrupaciones no coincidieran, los equipos por línea no sumarían el
// total de la fila.
function _biLineaProp(l) {
  const u = String(l || '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (u === 'DENTAL') return 'dental';
  if (u === 'ESTERILIZACION') return 'esterilizacion';
  if (u === 'INCARDIA') return 'incardia';
  if (u === 'ENDOSCOPIA') return 'endoscopia';
  if (u === 'MOBILIARIO CLINICO') return 'mobiliario';
  if (u === 'MMQ' || u === 'REAS') return 'mmq_reas';
  return 'otros';
}

// El mismo desgaste, abierto por línea: un cliente con la esterilización recién
// renovada y el dental al final de su vida tiene un promedio que no describe
// ninguna de las dos, y es la línea gastada la que da la visita.
let _biVidaLinIdx = null;
function _biVidaLinIndice() {
  if (_biVidaLinIdx) return _biVidaLinIdx;
  const P = APP_DATA.prosp_bi || {};
  const cl = P.clientes || [], ln = P.lineas || [], tp = P.tipos || [],
        filas = P.filas || [], hoy = P.hoy_ym || 0;
  const idx = {};
  filas.forEach(f => {
    const k = _biNorm(cl[f[3]] || '');
    if (!k) return;
    const pr = _biLineaProp(ln[f[1]] || '');
    const c = idx[k] || (idx[k] = {});
    const d = c[pr] || (c[pr] = { n: 0, nf: 0, suma: 0, sumaA: 0 });
    d.n++;
    const vu = _biVU(tp[f[2]]);
    if (f[6] >= 0 && vu > 0) {
      const anios = (hoy - f[6]) / 12;
      d.nf++; d.suma += anios / vu * 100; d.sumaA += anios;
    }
  });
  _biVidaLinIdx = idx;
  return idx;
}

// Sobre el 100% el parque ya agotó su vida útil de referencia; sobre el 80%
// está entrando en la ventana de reposición.
function _biColVida(v){
  return v == null ? 'var(--mut)' : v >= 100 ? 'var(--rd)'
       : v >= 80 ? 'var(--or)' : v >= 60 ? 'var(--am)' : 'var(--gn)';
}

// Los mismos cuatro tramos, en rgba: el canvas de la matriz no resuelve
// variables CSS, así que si se dejaran var(--rd) los puntos salen negros. Los
// valores son los del panel (--rd, --or, --am, --gn) y tienen que moverse
// junto con _biColVida o la tabla y la matriz dirían cosas distintas.
const _BI_TRAMOS = [
  { min: 100, lbl: 'Vida útil agotada (≥100%)', hex: '#C00000' },
  { min:  80, lbl: 'Por reponer (80–100%)',     hex: '#D46000' },
  { min:  60, lbl: 'En vigilancia (60–80%)',    hex: '#FFC000' },
  { min:   0, lbl: 'Con recorrido (<60%)',      hex: '#00832F' },
];
function _biTramo(v){
  return _BI_TRAMOS.find(t => v >= t.min) || _BI_TRAMOS[_BI_TRAMOS.length - 1];
}
// El hex a rgba, para poder bajarle la opacidad sin duplicar la paleta.
function _biRgba(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

// Celda de monto: en blanco cuando es cero, para que la tabla no se llene de
// ceros y las cifras que sí existen se vean.
function _biCelPot(v, col, fuerte){
  if(!v) return '<td style="text-align:right;color:var(--mut)">—</td>';
  return `<td style="text-align:right;font-family:'Roboto Mono',monospace;color:${col}` +
    (fuerte ? ';font-weight:700' : '') + `">${mm(v)}</td>`;
}

// Potencial de un cliente, abierto en sus tres componentes. El de
// mantenimiento sólo cuenta en quien NO tiene contrato: donde ya lo hay no
// queda nada por capturar. El de equipos y el de garantías vienen del
// pipeline, que es venta futura y aplica tenga o no contrato hoy.
function _biPot3(c, p, d){
  const conContrato = (d && d.n > 0) || (p && p.tiene_contrato);
  const mant = conContrato ? 0 : (_biPotAnual(c) || 0);
  const eq   = +c.pipe_eq || 0;
  const gar  = +c.pipe_st || 0;
  return { mant: mant, eq: eq, gar: gar, st: mant + gar, total: eq + mant + gar };
}

// Suma de una columna en un grupo de clientes.
function _biSumaCol(cs, campo) {
  return cs.reduce((s, c) => s + _biVal(c, campo), 0);
}

// Facturación de un grupo, sin contar dos veces al cliente que aparece con
// más de un nombre en la base instalada.
function _biFacGrupo(cs) {
  const vistos = new Set();
  let fac = 0, contr = 0, pot = 0, conContrato = 0, eq = 0, gar = 0;
  cs.forEach(c => {
    const p = _biLookupPanel(c.nombre);
    const d = _biLookupContrato(c.nombre);
    if ((d && d.n > 0) || (p && p.tiene_contrato)) conContrato++;
    const t = _biPot3(c, p, d);
    pot += t.mant;   // ya viene en cero si el cliente tiene contrato
    eq  += t.eq;
    gar += t.gar;
    if (!p || vistos.has(p.cliente)) return;
    vistos.add(p.cliente);
    fac += _biFac(p);
    contr += p.presup_contr_ytd || 0;
  });
  return { fac: fac, contr: contr, pot: pot, conContrato: conContrato,
           eq: eq, gar: gar, st: pot + gar, total: eq + pot + gar };
}

function _biEsc(x){
  return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _biRenderTabla(){
  const list = _biClientesFiltrados();
  const tb = document.getElementById('tb-bi-cli');
  if(!tb) return;

  if(list.length === 0){
    tb.innerHTML = `<tr><td colspan="13" style="text-align:center;color:var(--mut);padding:1.2rem;font-style:italic">Sin resultados para los filtros seleccionados</td></tr>`;
  } else {
    // ── Agrupación por región ──
    const porReg = {};
    list.forEach(c => {
      const r = c.region || 'Sin región';
      (porReg[r] || (porReg[r] = [])).push(c);
    });
    // Las regiones se ordenan por tamaño de base instalada; «Sin región» va al
    // final porque no es un lugar sino la falta del dato.
    const regs = Object.keys(porReg).sort((a, b) => {
      if (a === 'Sin región') return 1;
      if (b === 'Sin región') return -1;
      return _biSumaCol(porReg[b], 'total') - _biSumaCol(porReg[a], 'total');
    });

    const cel = (v, col, peso) =>
      `<td style="text-align:right;font-family:'Roboto Mono',monospace;color:${col}` +
      (peso ? ';font-weight:700' : '') + `">${v}</td>`;

    tb.innerHTML = regs.map((r, ri) => {
      const cs = porReg[r];
      const ab = !!_biRegAbierta[r];
      const g = _biFacGrupo(cs);
      const filaReg = `<tr onclick="window._biTogReg(${JSON.stringify(r).replace(/"/g,'&quot;')})"
        style="cursor:pointer;background:var(--gy);border-top:1px solid var(--brd)">
        <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${ri+1}</td>
        <td><span style="display:inline-block;width:12px;color:var(--mut)">${ab?'▾':'▸'}</span>
          <strong style="font-size:.71rem;color:var(--az1)">${_biEsc(r)}</strong>
          <span style="font-size:.58rem;color:var(--mut)"> · ${cs.length} cliente${cs.length===1?'':'s'}</span></td>
        ${cel(_biSumaCol(cs,'total').toLocaleString('es-CL'),'var(--az1)',1)}
        ${cel(_biSumaCol(cs,'dental').toLocaleString('es-CL')||'—','var(--am)',1)}
        ${cel(_biSumaCol(cs,'esterilizacion').toLocaleString('es-CL')||'—','var(--az2)',1)}
        ${cel(_biSumaCol(cs,'incardia').toLocaleString('es-CL')||'—','var(--or)',1)}
        ${cel(_biSumaCol(cs,'endoscopia').toLocaleString('es-CL')||'—','var(--teal)',1)}
        ${cel(_biSumaCol(cs,'mobiliario').toLocaleString('es-CL')||'—','#7B2FBE',1)}
        ${cel(_biSumaCol(cs,'mmq_reas').toLocaleString('es-CL')||'—','var(--gn)',1)}
        ${(()=>{const v=_biVida(cs);return v.vida==null
          ? '<td style="text-align:right;color:var(--mut)">—</td>'
          : `<td style="text-align:right;font-family:'Roboto Mono',monospace;font-weight:700;
               color:${_biColVida(v.vida)}" title="${fN1(v.anios)} años de antigüedad media sobre una vida útil de referencia de ${fN1(v.anios/v.vida*100)} años">${fN1(v.vida)}%
               <span style="font-weight:400;font-size:.55rem;color:var(--mut)">(${Math.round(v.cob*100)}%)</span></td>`;})()}
        <td style="font-size:.58rem;color:var(--mut)">${g.conContrato} con contrato</td>
        <td style="text-align:right;color:var(--az1);font-weight:700">${g.fac?mm(g.fac):'—'}</td>
        <td style="text-align:right;color:var(--teal);font-weight:700">${g.contr?mm(g.contr):'—'}</td>
        <td style="text-align:right"><strong style="color:var(--am);font-family:'Roboto Mono',monospace">${g.pot?mm(g.pot):'—'}</strong></td>
        ${_biCelPot(g.eq,'var(--az2)')}
        ${_biCelPot(g.gar,'var(--teal)')}
        ${_biCelPot(g.eq,'var(--az1)',1)}
        ${_biCelPot(g.st,'var(--am)',1)}
        ${_biCelPot(g.total,'var(--az1)',1)}
      </tr>`;
      if (!ab) return filaReg;

      // Dentro de la región manda el potencial total: es el orden en que
      // conviene visitarlos, y no el alfabético ni el del número de equipos.
      const csOrd = cs.slice().sort((a,b)=>{
        const ta = _biPot3(a, _biLookupPanel(a.nombre), _biLookupContrato(a.nombre)).total;
        const tb = _biPot3(b, _biLookupPanel(b.nombre), _biLookupContrato(b.nombre)).total;
        return tb - ta || _biVal(b,'total') - _biVal(a,'total');
      });
      return filaReg + csOrd.map((c,i)=>{
        const p=_biLookupPanel(c.nombre);
        const d=_biLookupContrato(c.nombre);
        const fac2026=p?(mm(_biFac(p))):'—';
        const facContr=p?(mm(p.presup_contr_ytd||0)):'—';
        return `<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.6rem;padding-left:1.1rem">${i+1}</td>
      <td style="padding-left:1.6rem"><strong style="font-size:.7rem">${shortN(c.nombre)}</strong></td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;font-weight:700;color:var(--az1)">${_biVal(c,'total').toLocaleString('es-CL')}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--am)">${_biVal(c,'dental')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--az2)">${_biVal(c,'esterilizacion')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--or)">${_biVal(c,'incardia')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--teal)">${_biVal(c,'endoscopia')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:#7B2FBE">${_biVal(c,'mobiliario')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--gn)">${_biVal(c,'mmq_reas')||'—'}</td>
      ${(()=>{const v=_biVida([c]);return v.vida==null
        ? '<td style="text-align:right;color:var(--mut)">—</td>'
        : `<td style="text-align:right;font-family:'Roboto Mono',monospace;color:${_biColVida(v.vida)}" title="${fN1(v.anios)} años de antigüedad media">${fN1(v.vida)}%</td>`;})()}
      <td>${_biEstadoBadge(c.estado)}</td>
      <td style="text-align:right;color:var(--az1);font-weight:700">${fac2026}</td>
      <td style="text-align:right;color:var(--teal)">${facContr}</td>
      <td style="text-align:right">${_biPotCelda(c,p,d)}</td>
      ${(()=>{const t=_biPot3(c,p,d);return _biCelPot(t.eq,'var(--az2)')+
        _biCelPot(t.gar,'var(--teal)')+_biCelPot(t.eq,'var(--az1)',1)+
        _biCelPot(t.st,'var(--am)',1)+_biCelPot(t.total,'var(--az1)',1);})()}
    </tr>`;
      }).join('');
    }).join('');

    // Fila de cierre: lo que facturan los clientes sin base instalada
    const otros = _biSinFiltros() ? _biOtrosFac() : null;
    if(otros && otros.n){
      const nom = otros.clientes.slice(0,25).map(c=>c.cliente).join('\n');
      tb.innerHTML += `<tr style="background:var(--gy);border-top:2px solid var(--brd)">
        <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">—</td>
        <td title="${(nom+(otros.n>25?'\n…y '+(otros.n-25)+' más':'')).replace(/"/g,'&quot;')}">
          <strong style="font-size:.7rem;color:var(--mut)">Otros clientes</strong>
          <span style="font-size:.58rem;color:var(--mut)"> · ${otros.n} sin base instalada cargada</span></td>
        <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--mut)">—</td>
        <td colspan="8" style="text-align:center;font-size:.58rem;color:var(--mut);font-style:italic">
          facturan o tienen pipeline sin equipos registrados en esta hoja</td>
        <td style="text-align:right;color:var(--az1);font-weight:700">${mm(otros.monto)}</td>
        <td style="text-align:right;color:var(--mut)">—</td>
        <td style="text-align:right;color:var(--mut)">—</td>
        ${_biCelPot(_biPipeResid().monto,'var(--az2)')}
        ${_biCelPot(_biPipeResid().st,'var(--teal)')}
        ${_biCelPot(_biPipeResid().monto,'var(--az1)',1)}
        ${_biCelPot(_biPipeResid().st,'var(--am)',1)}
        ${_biCelPot(_biPipeResid().monto+_biPipeResid().st,'var(--az1)',1)}
      </tr>`;
    }
  }

  // La matriz mira los mismos clientes filtrados que la tabla.
  if (typeof _biRenderMatriz === 'function') setTimeout(_biRenderMatriz, 0);

  // Footer
  const foot = document.getElementById('tfoot-bi-cli');
  if(foot){
    const tot  = list.reduce((s,c)=>s+_biVal(c,'total'),0);
    const dent = list.reduce((s,c)=>s+_biVal(c,'dental'),0);
    const este = list.reduce((s,c)=>s+_biVal(c,'esterilizacion'),0);
    const inc  = list.reduce((s,c)=>s+_biVal(c,'incardia'),0);
    const endo = list.reduce((s,c)=>s+_biVal(c,'endoscopia'),0);
    const mob  = list.reduce((s,c)=>s+_biVal(c,'mobiliario'),0);
    const mmq  = list.reduce((s,c)=>s+_biVal(c,'mmq_reas'),0);
    // Sin filtros, el pie incluye la fila «Otros clientes» para que Fac. 2026
    // cierre en el mismo total que la portada.
    const otrosF = _biSinFiltros() ? _biOtrosFac() : { n:0, monto:0 };
    const facTotal = _biFacUnicos(list).monto + otrosF.monto;
    const conContr = list.filter(c=>{const d=_biLookupContrato(c.nombre);return d&&d.n>0;}).length;
    // Sólo suma el potencial de quienes NO tienen contrato: en los que ya lo
    // tienen no hay nada que capturar.
    const potTotal = list.reduce((s2,c)=>{
      const p2=_biLookupPanel(c.nombre), d2=_biLookupContrato(c.nombre);
      if((d2&&d2.n>0)||(p2&&p2.tiene_contrato)) return s2;
      return s2+_biPotAnual(c);
    },0);
    // El pipeline del pie incluye el residuo de la fila de cierre, así la
    // columna cuadra con la suma total del Excel y no sólo con lo cruzado.
    const rp = _biSinFiltros() ? _biPipeResid() : { monto:0, st:0 };
    const pipeEq = list.reduce((a,c)=>a+(+c.pipe_eq||0),0) + rp.monto;
    const pipeSt = list.reduce((a,c)=>a+(+c.pipe_st||0),0) + rp.st;
    const st='text-align:right;font-family:\'Roboto Mono\',monospace;color:rgba(255,255,255,.75)';
    foot.innerHTML = `<td colspan="2" style="font-weight:700;font-size:.62rem;color:rgba(255,255,255,.85)">${list.length} clientes · ${conContr} con contrato activo${otrosF.n?' · +'+otrosF.n+' sin base instalada':''}</td>
      <td style="${st};font-weight:700;color:#fff">${tot.toLocaleString('es-CL')}</td>
      <td style="${st}">${dent}</td><td style="${st}">${este}</td>
      <td style="${st}">${inc}</td><td style="${st}">${endo}</td>
      <td style="${st}">${mob}</td><td style="${st}">${mmq}</td>
      ${(()=>{const v=_biVida(list);return v.vida==null?'<td></td>'
        :`<td style="${st};font-weight:700;color:#fff">${fN1(v.vida)}%
          <span style="font-weight:400;font-size:.55rem;opacity:.7">(${Math.round(v.cob*100)}%)</span></td>`;})()}
      <td></td>
      <td style="${st};font-weight:700;color:#FFC000">${mm(facTotal)}</td>
      <td></td>
      <td style="${st};font-weight:700;color:#FFC000" title="Potencial de los clientes sin contrato">${mm(potTotal)}</td>
      <td style="${st};color:#fff">${mm(pipeEq)}</td>
      <td style="${st};color:#fff">${mm(pipeSt)}</td>
      <td style="${st};font-weight:700;color:#fff">${mm(pipeEq)}</td>
      <td style="${st};font-weight:700;color:#FFC000">${mm(potTotal+pipeSt)}</td>
      <td style="${st};font-weight:700;color:#fff">${mm(pipeEq+potTotal+pipeSt)}</td>`;
  }
}

// ── MATRIZ DE PROSPECCIÓN ──────────────────────────────────────
// Cruza las dos preguntas que la tabla responde por separado: qué tan vieja
// está la base de cada cliente y cuánto servicio técnico hay ahí por capturar.
// Un solo color para todos los puntos: la guía de visualización limita a tres
// los tonos de un gráfico de dispersión, y acá hay diecisiete regiones, así
// que la región se elige en el filtro y se lee en el tooltip, no en el color.
let _biMxChart = null, _biMxRegion = 'todas';

window._biMxReg = function (v) { _biMxRegion = v; _biRenderMatriz(); };
window._biMxReset = function () { if (_biMxChart && _biMxChart.resetZoom) _biMxChart.resetZoom(); };

// Datos de la matriz: un punto por cliente con desgaste conocido.
function _biMxDatos() {
  const list = _biClientesFiltrados().filter(c =>
    _biMxRegion === 'todas' || (c.region || 'Sin región') === _biMxRegion);
  const pts = [];
  let sinVida = 0;
  list.forEach(c => {
    const v = _biVida([c]);
    const p = _biLookupPanel(c.nombre);
    const d = _biLookupContrato(c.nombre);
    const t = _biPot3(c, p, d);
    // Sólo el potencial ST anual de mantenimiento de la base instalada: las
    // garantías del pipeline son venta futura y no mantenimiento de lo que el
    // cliente ya tiene. Quien tiene contrato vale cero y queda fuera.
    if (!t.mant) return;               // sin potencial de mantenimiento no hay nada que prospectar
    if (v.vida == null) { sinVida++; return; }
    pts.push({
      nombre: c.nombre, region: c.region || 'Sin región',
      x: +v.vida.toFixed(2), anios: v.anios, y: t.mant, st: t.mant, mant: t.mant, gar: t.gar,
      eq: t.eq, total: t.total, equipos: _biVal(c, 'total'), cob: v.cob,
      contrato: (d && d.n > 0) || (p && p.tiene_contrato),
      // La base instalada abierta por línea viaja con el punto: el gráfico no
      // la usa, pero el exportable la necesita y así no se recorre dos veces.
      lin: _BI_LIN.reduce((o, l) => { o[l.prop] = _biVal(c, l.prop); return o; }, {}),
      vidaLin: _biVidaLinIndice()[_biNorm(c.nombre)] || {},
    });
  });
  return { pts: pts, sinVida: sinVida };
}

const _biMediana = (a) => {
  if (!a.length) return 0;
  const o = a.slice().sort((x, y) => x - y), m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

// Las medianas se dibujan como plugin porque Chart.js no trae anotaciones y
// cargar otra librería por dos líneas no se justifica.
const _biMxGuias = {
  id: 'biMxGuias',
  beforeDatasetsDraw(ch, args, opt) {
    if (!opt || !isFinite(opt.mx) || !isFinite(opt.my)) return;
    const { ctx, chartArea: a, scales } = ch;
    const px = scales.x.getPixelForValue(opt.mx), py = scales.y.getPixelForValue(opt.my);
    ctx.save();
    // Cuadrante de prioridad: base más vieja y más potencial que la mediana.
    ctx.fillStyle = 'rgba(212,96,0,.07)';
    ctx.fillRect(px, a.top, a.right - px, py - a.top);
    ctx.strokeStyle = 'rgba(107,123,168,.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom);
    ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#A34515';
    ctx.font = '600 10px Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Visitar primero', a.right - 8, a.top + 14);
    ctx.restore();
  },
};

function _biRenderMatriz() {
  const box = document.getElementById('cBiMatriz');
  if (!box || typeof Chart === 'undefined') return;

  // Filtro de región, con las que existen en el conjunto filtrado
  const sel = document.getElementById('bi-mx-reg');
  if (sel && !sel.dataset.listo) {
    const regs = [...new Set(_biClientesFiltrados().map(c => c.region || 'Sin región'))].sort();
    sel.innerHTML = ['<option value="todas">Todas</option>']
      .concat(regs.map(r => `<option value="${_biEsc(r)}">${_biEsc(r)}</option>`)).join('');
    sel.dataset.listo = '1';
  }

  const { pts, sinVida } = _biMxDatos();
  const lbl = document.getElementById('bi-mx-lbl');
  if (lbl) {
    lbl.textContent = pts.length + ' clientes en la matriz' +
      (sinVida ? ' · ' + sinVida + ' sin fecha de instalación o sin vida útil de referencia quedan fuera' : '');
  }
  const leg = document.getElementById('bi-mx-leg');
  if (leg) {
    const cuenta = _BI_TRAMOS.map(t => pts.filter(p => _biTramo(p.x) === t).length);
    leg.innerHTML = _BI_TRAMOS.map((t, i) =>
      '<span style="display:inline-flex;align-items:center;gap:.28rem;font-size:.57rem;margin-right:.9rem">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:' + _biRgba(t.hex, .6) +
      ';border:2px solid #fff;box-shadow:0 0 0 1px ' + t.hex + '55"></span>' +
      _biEsc(t.lbl) + ' <strong>' + cuenta[i] + '</strong></span>').join('');
  }
  if (_biMxChart) { _biMxChart.destroy(); _biMxChart = null; }
  if (!pts.length) { _biRenderCurva(); return; }

  const maxST = Math.max.apply(null, pts.map(p => p.st));
  // Radio por raíz del monto: el área del punto queda proporcional al valor, y
  // el mínimo de 5 px mantiene el punto visible y agarrable en el hover.
  pts.forEach(p => { p.r = 5 + Math.sqrt(p.st / maxST) * 17; });

  _biMxChart = new Chart(box.getContext('2d'), {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Clientes',
        data: pts,
        // El color dice en qué tramo de vida útil está el cliente, con la misma
        // escala de la tabla: el eje ya lo ubica, pero en un gráfico con
        // seiscientos puntos el color es lo que se lee primero.
        backgroundColor: pts.map(p => _biRgba(_biTramo(p.x).hex, .6)),
        hoverBackgroundColor: pts.map(p => _biRgba(_biTramo(p.x).hex, .9)),
        borderColor: '#fff',          // anillo del color de la superficie
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },   // una sola serie: la titula la tarjeta
        biMxGuias: {
          mx: _biMediana(pts.map(p => p.x)),
          my: _biMediana(pts.map(p => p.y)),
        },
        // Con seiscientos clientes los puntos se apiñan cerca del origen y no
        // hay forma de elegir uno. La rueda acerca sobre el cursor, arrastrar
        // desplaza y el botón vuelve a la vista completa. Los límites impiden
        // alejarse más allá de la vista original o acercarse hasta un vacío
        // sin puntos de referencia.
        zoom: {
          limits: { x: { min: 'original', max: 'original', minRange: 0.5 },
                    y: { min: 'original', max: 'original' } },
          pan: {
            enabled: true, mode: 'xy', threshold: 4,
            // El cursor es la única señal de que el lienzo se puede arrastrar.
            onPanStart:    ({ chart }) => { chart.canvas.style.cursor = 'grabbing'; },
            onPanComplete: ({ chart }) => { chart.canvas.style.cursor = 'grab'; },
          },
          zoom: {
            wheel: { enabled: true, speed: 0.08 },
            pinch: { enabled: true },
            mode: 'xy',
          },
        },
        tooltip: {
          callbacks: {
            title: c => c[0].raw.nombre,
            label: c => {
              const p = c.raw;
              return [
                p.region + (p.contrato ? ' · con contrato' : ''),
                'Vida útil consumida: ' + fN1(p.x) + '%  (' + Math.round(p.cob * 100) + '% del parque medible)',
                '   ' + fN1(p.anios) + ' años de antigüedad media',
                'Equipos: ' + p.equipos.toLocaleString('es-CL'),
                'Potencial ST anual (mantenimiento BI): ' + mm(p.mant),
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: '% de vida útil consumida por la base instalada',
                   font: { size: 9 }, color: '#6B7BA8' },
          grid: { color: '#E2E6F0' },
          ticks: { font: { size: 9 }, callback: v => v + '%' },
          beginAtZero: true,
        },
        y: {
          title: { display: true, text: 'Potencial ST anual · mantenimiento BI (MM$)', font: { size: 9 }, color: '#6B7BA8' },
          grid: { color: '#E2E6F0' },
          ticks: { font: { size: 9 }, callback: v => Math.round(v / 1e6) },
          beginAtZero: true,
        },
      },
    },
    // El plugin de zoom se registra solo al cargarse, pero no hace nada donde
    // no se declaren opciones de zoom: los demás gráficos del panel quedan
    // igual y sólo esta matriz responde a la rueda.
    plugins: [_biMxGuias],
  });
  // La mano abierta desde el inicio: sin ella nadie descubre que se arrastra.
  box.style.cursor = 'grab';
  // La curva de concentración mira los mismos clientes y la misma región.
  _biRenderCurva();
}

// ── CURVA DE CONCENTRACIÓN DEL POTENCIAL ST ──────────────────────
// Los clientes ordenados de mayor a menor potencial ST anual de mantenimiento BI
// y acumulados: cada punto
// es un cliente, el eje horizontal cuántos clientes van y el vertical el
// potencial en pesos que se lleva sumando hasta él. Como el primero es el de mayor
// potencial, la curva sube empinada y se va aplanando: la pendiente responde
// cuántos clientes foco hacen falta, porque donde se aplana sumar uno más ya
// casi no mueve el potencial.
// No depende de la vida útil, así que entran también los clientes que la matriz
// deja fuera por no tener fecha de instalación.
let _biCvChart = null;
let _biCvRegion = 'todas';     // región propia del gráfico, independiente de la matriz
let _biCvSel = null;           // nombre del cliente elegido
const _BI_CV_CORTES = [0.5, 0.8];

window._biCvReg = function (v) { _biCvRegion = v; _biRenderCurva(); };
window._biCvCli = function (v) { _biCvSel = v || null; _biRenderCurva(); };

function _biCurvaDatos() {
  const list = _biClientesFiltrados().filter(c =>
    _biCvRegion === 'todas' || (c.region || 'Sin región') === _biCvRegion);
  const arr = [];
  list.forEach(c => {
    const p = _biLookupPanel(c.nombre), d = _biLookupContrato(c.nombre);
    const t = _biPot3(c, p, d);
    // Entran TODOS los clientes de la tabla Detalle por Cliente, también los de
    // potencial cero, para que el número de clientes calce con esa tabla y con
    // el resumen por región. Los de cero quedan al final de la curva, donde se
    // ve que ya no suman: los que tienen contrato vigente y los que sólo tienen
    // equipos sin tarifa (Incardia, Mobiliario, MMQ/REAS, Otros).
    const contrato = (d && d.n > 0) || !!(p && p.tiene_contrato);
    arr.push({ nombre: c.nombre, region: c.region || 'Sin región',
               st: t.mant, mant: t.mant, gar: t.gar, eq: t.eq, c: c, p: p, contrato: contrato });
  });
  // Primero el de mayor potencial: es el orden en que conviene sumarlos. Entre
  // los de igual potencial —en la práctica, los de cero— manda el tamaño del parque.
  arr.sort((a, b) => b.st - a.st || _biVal(b.c, 'total') - _biVal(a.c, 'total'));
  const total = arr.reduce((a, p) => a + p.st, 0);
  let acum = 0;
  const pts = arr.map((p, i) => {
    acum += p.st;
    const pct = total ? acum / total * 100 : 0;
    return Object.assign(p, { x: i + 1, y: acum, acum: acum, pct: pct });
  });
  // Cuántos clientes hacen falta para llegar a cada corte del potencial.
  const cortes = _BI_CV_CORTES.map(q => {
    const k = total > 0 ? pts.findIndex(p => p.acum >= total * q - 1e-6) : -1;
    return { q: q, i: k, p: k >= 0 ? pts[k] : null };
  });
  const conPot = pts.filter(p => p.st > 0).length;
  const sinPot = pts.filter(p => !(p.st > 0));
  const nContr = sinPot.filter(p => p.contrato).length;
  return { pts: pts, total: total, cortes: cortes, conPot: conPot,
           nContr: nContr, nSinTar: sinPot.length - nContr };
}

// Guías de cada corte: una línea desde el eje vertical hasta el punto y otra
// hasta el eje horizontal, con cuántos clientes y cuánta plata lo alcanzan.
const _biCvGuias = {
  id: 'biCvGuias',
  afterDatasetsDraw(ch, args, opt) {
    const cortes = (opt && opt.cortes) || [];
    const { ctx, chartArea: a, scales } = ch;
    ctx.save();
    cortes.forEach((c, j) => {
      if (!c.p) return;
      const px = scales.x.getPixelForValue(c.p.x), py = scales.y.getPixelForValue(c.p.y);
      if (px < a.left || px > a.right || py < a.top || py > a.bottom) return;
      const col = j ? '#D46000' : '#002D73';
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(px, py); ctx.lineTo(px, a.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 10px Roboto, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const txt = c.p.x + ' clientes · ' + mm(c.p.acum) + ' (' + Math.round(c.q * 100) + '% del potencial)';
      const tw = ctx.measureText(txt).width;
      ctx.fillText(txt, Math.min(px + 7, a.right - tw - 2), py + 6);
    });
    ctx.restore();
  },
};

// ── Ficha del cliente elegido ────────────────────────────────────
// Lo que un ejecutivo necesita para decidir si lo visita y con qué argumento:
// por qué está en el foco, de dónde sale su potencial, en qué estado está su
// parque y cómo va la relación comercial.
function _biCvFicha(pt, total, n, cortes) {
  const box = document.getElementById('bi-cv-det');
  if (!box) return;
  if (!pt) {
    box.innerHTML = '<div style="font-size:.6rem;color:var(--mut);padding:.6rem .2rem">' +
      'Haz clic en un punto o elige un cliente arriba para ver su ficha.</div>';
    return;
  }
  const c = pt.c, p = pt.p || {};
  const v = _biVida([c]);
  const foco = cortes[cortes.length - 1];
  const esFoco = foco.i >= 0 && pt.x - 1 <= foco.i && pt.st > 0;
  const UF = { esterilizacion: 50, endoscopia: 22, dental: 15 };
  const LBL = { esterilizacion: 'Esterilización', endoscopia: 'Endoscopía', dental: 'Dental' };
  const fila = (k, val, st) => '<div style="display:flex;justify-content:space-between;gap:.6rem;' +
    'padding:.14rem 0;border-bottom:1px dashed var(--brd);font-size:.62rem">' +
    '<span style="color:var(--mut)">' + k + '</span><span style="font-weight:600;text-align:right;' +
    (st || '') + '">' + val + '</span></div>';
  const bloque = (tit, cuerpo) => '<div style="background:var(--bg2);border:1px solid var(--brd);' +
    'border-radius:5px;padding:.55rem .7rem"><div style="font-size:.55rem;font-weight:700;letter-spacing:.06em;' +
    'text-transform:uppercase;color:var(--az1);margin-bottom:.35rem">' + tit + '</div>' + cuerpo + '</div>';

  // De dónde sale el potencial: equipos cobrables por su tarifa.
  const lineas = Object.keys(_BI_TARIFA).map(k => {
    const ne = _biVal(c, k);
    if (!ne) return '';
    return fila(LBL[k] + ' · ' + ne.toLocaleString('es-CL') + ' eq × ' + UF[k] + ' UF',
                mm(ne * _BI_TARIFA[k]));
  }).join('') || fila('Sin equipos cobrables', '—');
  const noCob = ['incardia', 'mobiliario', 'mmq_reas', 'otros']
    .reduce((a, k) => a + _biVal(c, k), 0);

  const estRel = p.estado_relacion || 'Sin historial';
  const colRel = /perdido/i.test(estRel) ? 'color:var(--rd)'
               : /nuevo|renovado/i.test(estRel) ? 'color:var(--gn)' : '';

  box.innerHTML =
    '<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem .9rem;margin:.2rem 0 .55rem">' +
      '<span style="font-size:.8rem;font-weight:800;color:var(--az1)">#' + pt.x + ' · ' + _biEsc(pt.nombre) + '</span>' +
      '<span style="font-size:.6rem;color:var(--mut)">' + _biEsc(pt.region) +
        (p.coord && p.coord !== 'Sin contrato' ? ' · coordinador ' + _biEsc(p.coord) : '') + '</span>' +
      '<span style="font-size:.57rem;font-weight:700;padding:.1rem .45rem;border-radius:3px;' +
        (esFoco ? 'background:#002D73;color:#fff' : 'background:var(--gy);color:var(--mut)') + '">' +
        (esFoco ? 'CLIENTE FOCO · dentro del 80%'
         : !(pt.st > 0) ? (pt.contrato ? 'SIN POTENCIAL · contrato vigente' : 'SIN POTENCIAL · sin equipos con tarifa')
         : 'Fuera del 80% del potencial') + '</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem">' +
      bloque('Por qué es foco',
        fila('Potencial ST anual', mm(pt.mant), 'color:var(--az1);font-size:.72rem') +
        fila('Aporte al total', fN1(pt.mant / total * 100) + '%') +
        fila('Posición', '#' + pt.x + ' de ' + n.toLocaleString('es-CL')) +
        fila('Acumulado hasta él', mm(pt.acum) + ' (' + fN1(pt.pct) + '%)')) +
      bloque('De dónde sale el potencial',
        lineas +
        (noCob ? fila('Otros equipos (sin tarifa)', noCob.toLocaleString('es-CL') + ' eq', 'color:var(--mut)') : '')) +
      bloque('Estado del parque',
        fila('Base instalada', _biVal(c, 'total').toLocaleString('es-CL') + ' equipos') +
        fila('% vida útil consumida', v.vida == null ? 'sin dato' : fN1(v.vida) + '%',
             'color:' + _biColVida(v.vida)) +
        fila('Antigüedad media', v.anios == null ? '—' : fN1(v.anios) + ' años') +
        fila('Parque medible', Math.round(v.cob * 100) + '% de los equipos')) +
      bloque('Relación comercial',
        fila('Contrato', pt.contrato ? 'Contrato o garantía vigente' : 'Sin contrato vigente',
             pt.contrato ? 'color:var(--gn)' : 'color:var(--or)') +
        fila('Relación', _biEsc(estRel), colRel) +
        fila('Facturación 2026 a la fecha', p.real_ytd_fac ? mm(p.real_ytd_fac) : '—') +
        fila('Facturación 2025', p.real_anual_2025 ? mm(p.real_anual_2025) : '—') +
        (p.fin_fmt ? fila('Último contrato terminó', _biEsc(p.fin_fmt)) : '') +
        ((pt.eq || pt.gar) ? fila('Pipeline en curso', mm(pt.eq) + ' eq · ' + mm(pt.gar) + ' gar.') : '')) +
    '</div>';
}

function _biRenderCurva() {
  const cv = document.getElementById('cBiCurva');
  if (!cv || typeof Chart === 'undefined') return;
  if (_biCvChart) { _biCvChart.destroy(); _biCvChart = null; }

  // Región: sólo las que tienen clientes con potencial, de mayor a menor.
  const selR = document.getElementById('bi-cv-reg');
  if (selR) {
    const potR = {}, nR = {};
    _biClientesFiltrados().forEach(c => {
      const t = _biPot3(c, _biLookupPanel(c.nombre), _biLookupContrato(c.nombre));
      const r = c.region || 'Sin región';
      potR[r] = (potR[r] || 0) + t.mant;
      nR[r] = (nR[r] || 0) + 1;
    });
    const regs = Object.keys(potR).sort((a, b) => potR[b] - potR[a] || nR[b] - nR[a]);
    if (_biCvRegion !== 'todas' && regs.indexOf(_biCvRegion) < 0) _biCvRegion = 'todas';
    selR.innerHTML = '<option value="todas">Todas las regiones</option>' + regs.map(r =>
      '<option value="' + _biEsc(r) + '"' + (r === _biCvRegion ? ' selected' : '') + '>' +
      _biEsc(r) + ' · ' + nR[r] + ' clientes · ' + mm(potR[r]) + '</option>').join('');
  }

  const { pts, total, cortes, conPot, nContr, nSinTar } = _biCurvaDatos();

  // Cliente: la lista en el mismo orden del gráfico, para encontrar uno sin
  // tener que atinarle al punto entre cientos.
  if (_biCvSel && !pts.some(p => p.nombre === _biCvSel)) _biCvSel = null;
  const selC = document.getElementById('bi-cv-cli');
  if (selC) {
    selC.innerHTML = '<option value="">Elegir cliente…</option>' + pts.map(p =>
      '<option value="' + _biEsc(p.nombre) + '"' + (p.nombre === _biCvSel ? ' selected' : '') + '>#' +
      p.x + ' · ' + _biEsc(p.nombre) + ' · ' + mm(p.mant) + '</option>').join('');
  }

  const res = document.getElementById('bi-cv-res');
  if (res) {
    const nf = v => v.toLocaleString('es-CL');
    res.innerHTML = !pts.length ? 'Sin clientes para este filtro.' :
      '<strong>' + nf(pts.length) + '</strong> clientes —los mismos de la tabla Detalle por Cliente— · ' +
      '<strong>' + nf(conPot) + '</strong> con potencial ST anual por <strong>' + mm(total) + '</strong>' +
      (pts.length - conPot ? ' · <span style="color:var(--mut)">' + nf(pts.length - conPot) +
        ' sin potencial: ' + nf(nContr) + ' con contrato vigente y ' + nf(nSinTar) +
        ' sin equipos de Esterilización, Endoscopía o Dental</span>' : '') +
      (_biCvRegion === 'todas' ? '' : ' · ' + _biEsc(_biCvRegion)) +
      cortes.map((c, j) => !c.p ? '' :
        ' · <span style="color:' + (j ? '#D46000' : '#002D73') + '">los <strong>' + c.p.x +
        '</strong> primeros concentran el <strong>' + Math.round(c.q * 100) + '%</strong> (' +
        mm(c.p.acum) + ')</span>').join('');
  }
  if (!pts.length || !(total > 0)) { _biCvFicha(null); return; }

  // Los clientes que suman hasta el 80% van en azul fuerte: son el foco. El
  // resto, más claro, es la cola. El elegido se marca en naranja y más grande.
  const foco = cortes[cortes.length - 1].i;
  const rBase = pts.length > 400 ? 2.5 : 3.5;
  const colPt = (p, i) => p.nombre === _biCvSel ? '#D46000'
    : i <= foco ? '#002D73' : p.st > 0 ? 'rgba(107,123,168,.55)' : 'rgba(184,193,216,.45)';
  _biCvChart = new Chart(cv.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Clientes',
        data: pts,
        showLine: true,
        borderColor: 'rgba(0,45,115,.35)',
        borderWidth: 1.5,
        pointRadius: pts.map(p => p.nombre === _biCvSel ? 8 : rBase),
        pointHoverRadius: 7,
        pointBackgroundColor: pts.map(colPt),
        pointBorderColor: pts.map((p, i) => p.nombre === _biCvSel ? '#fff' : colPt(p, i)),
        pointBorderWidth: pts.map(p => p.nombre === _biCvSel ? 2 : 1),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        biCvGuias: { cortes: cortes },
        zoom: {
          limits: { x: { min: 'original', max: 'original' }, y: { min: 'original', max: 'original' } },
          pan: {
            enabled: true, mode: 'xy', threshold: 4,
            onPanStart:    ({ chart }) => { chart.canvas.style.cursor = 'grabbing'; },
            onPanComplete: ({ chart }) => { chart.canvas.style.cursor = 'grab'; },
          },
          zoom: { wheel: { enabled: true, speed: 0.08 }, pinch: { enabled: true }, mode: 'xy' },
        },
        tooltip: {
          callbacks: {
            title: c => '#' + c[0].raw.x + ' · ' + c[0].raw.nombre,
            label: c => {
              const p = c.raw, v = _biVida([p.c]);
              return [
                p.region + ' · ' + _biVal(p.c, 'total').toLocaleString('es-CL') + ' equipos',
                p.st > 0 ? 'Potencial ST anual: ' + mm(p.mant)
                         : 'Sin potencial: ' + (p.contrato ? 'contrato vigente' : 'sin equipos con tarifa'),
                'Acumulado: ' + mm(p.acum) + '  (' + fN1(p.pct) + '% del total)',
                '% vida útil: ' + (v.vida == null ? 'sin dato' : fN1(v.vida) + '%'),
                'Clic para ver la ficha',
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'N° de clientes foco (de mayor a menor potencial)', font: { size: 9 }, color: '#6B7BA8' },
          grid: { color: '#E2E6F0' }, beginAtZero: true, max: pts.length,
          ticks: { font: { size: 9 }, precision: 0 },
        },
        y: {
          title: { display: true, text: 'Potencial ST anual acumulado · mantenimiento BI (MM$)', font: { size: 9 }, color: '#6B7BA8' },
          grid: { color: '#E2E6F0' }, beginAtZero: true, max: total,
          ticks: { font: { size: 9 }, callback: v => Math.round(v / 1e6).toLocaleString('es-CL') },
        },
      },
    },
    plugins: [_biCvGuias],
  });
  cv.style.cursor = 'grab';

  // Clic en un punto: se elige el cliente y se abre su ficha.
  cv.onclick = ev => {
    if (!_biCvChart) return;
    const els = _biCvChart.getElementsAtEventForMode(ev, 'nearest', { intersect: true }, true);
    if (!els.length) return;
    _biCvSel = pts[els[0].index].nombre;
    _biRenderCurva();
  };

  _biCvFicha(pts.find(p => p.nombre === _biCvSel) || null, total, pts.length, cortes);
}
window._biCvReset = function () { if (_biCvChart && _biCvChart.resetZoom) _biCvChart.resetZoom(); };

// El exportable es un Excel con una hoja por región, cada una con sus diez
// clientes a visitar y una columna en blanco para escribir el plan de acción:
// la lista no es para mirarla sino para repartirla y que vuelva completada.
// Los clientes sin región quedan fuera — no hay a quién asignárselos.
window._biMxExport = function () {
  if (typeof XLSX === 'undefined') {
    alert('Librería Excel no cargada. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('bi-mx-pdf');
  const txt = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  try {
    const { pts } = _biMxDatos();
    // Sólo la base instalada de hoy y lo que ella puede rendir en
    // mantenimiento. El pipeline de equipos y las garantías que traería son
    // venta futura, no base instalada, y quien ya tiene contrato no deja nada
    // por capturar: por eso quedan fuera los de potencial cero.
    const porReg = {};
    pts.forEach(p => {
      if (p.region === 'Sin región') return;      // no hay a quién asignárselos
      if (!(p.mant > 0)) return;
      (porReg[p.region] || (porReg[p.region] = [])).push(p);
    });
    const regs = Object.keys(porReg).sort((a, b) =>
      porReg[b].reduce((s, p) => s + p.mant, 0) - porReg[a].reduce((s, p) => s + p.mant, 0));
    if (!regs.length) {
      alert('No hay clientes con región y potencial de mantenimiento para exportar.');
      return;
    }

    const M = v => Math.round((v || 0) / 1e5) / 10;   // a MM$ con un decimal

    // ── Formato ──
    // Los montos llevan separador de miles con un decimal; la vida, uno solo.
    // El formato se aplica a la celda, no al texto, para que Excel los siga
    // tratando como números y se puedan ordenar y sumar.
    const FMT_MM = '#,##0.0', FMT_N = '#,##0', FMT_V = '0.0"%"';
    const BORDE = { style: 'thin', color: { rgb: 'D4D5E8' } };
    const bordes = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
    const cab = (bg, ink) => ({
      font: { bold: true, sz: 9, color: { rgb: ink || 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: bg } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: bordes,
    });
    const sCab = cab('002D73');
    const sCel = (par, extra) => Object.assign({
      font: { sz: 9 },
      fill: { patternType: 'solid', fgColor: { rgb: par ? 'F7F9FC' : 'FFFFFF' } },
      border: bordes,
    }, extra || {});
    const sTot = {
      font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '0E2D55' } },
      border: bordes,
    };

    const wb = XLSX.utils.book_new();
    const usados = {};
    regs.forEach(r => {
      const top = porReg[r].slice().sort((a, b) => b.mant - a.mant).slice(0, 10);
      // Sólo las líneas que la región efectivamente tiene: una columna de ceros
      // para una línea ausente estorba la lectura y no dice nada.
      const lins = _BI_LIN.filter(l => top.some(p => (p.lin[l.prop] || 0) > 0));
      const L = lins.length;
      const cEq = 2 + 2 * L, cVi = 3 + 2 * L, cMt = 4 + 2 * L, cPl = 5 + 2 * L;
      const nC = 6 + 2 * L;

      // Cabecera en dos pisos: arriba la línea, abajo sus equipos y su vida.
      // Sin ese techo no se ve a qué línea pertenece cada par de columnas.
      const g = ['#', 'Cliente'], h = ['', ''];
      lins.forEach(l => { g.push(l.label, ''); h.push('Equipos', '% Vida Útil'); });
      g.push('Base Instalada Total', ''); h.push('Equipos', '% Vida Útil');
      g.push('Pot. Mantenimiento MM$', 'Plan de Acción'); h.push('', '');

      const vid = d => (d && d.nf) ? Math.round(d.suma / d.nf * 10) / 10 : '';
      const filas = top.map((p, i) => {
        const f = [i + 1, p.nombre];
        lins.forEach(l => { f.push(p.lin[l.prop] || '', vid(p.vidaLin[l.prop])); });
        f.push(p.equipos, Math.round(p.x * 10) / 10, M(p.mant), '');   // x = % de vida útil
        return f;                              // Plan de Acción: se llena a mano
      });

      // Fila de total: la vida se promedia pesada por equipos con fecha, no
      // promediando promedios — un cliente de dos equipos no puede mover la
      // media igual que uno de doscientos.
      const ag = {}; lins.forEach(l => ag[l.prop] = { eq: 0, nf: 0, suma: 0 });
      let tEq = 0, tNf = 0, tSu = 0, tMt = 0;
      top.forEach(p => {
        lins.forEach(l => {
          const a = ag[l.prop]; a.eq += p.lin[l.prop] || 0;
          const d = p.vidaLin[l.prop]; if (d) { a.nf += d.nf; a.suma += d.suma; }
        });
        tEq += p.equipos; tMt += p.mant;
        Object.keys(p.vidaLin).forEach(k => { tNf += p.vidaLin[k].nf; tSu += p.vidaLin[k].suma; });
      });
      const ft = ['', 'TOTAL · ' + top.length + ' clientes'];
      lins.forEach(l => { const a = ag[l.prop]; ft.push(a.eq || '', vid(a)); });
      ft.push(tEq, vid({ nf: tNf, suma: tSu }), M(tMt), '');
      filas.push(ft);

      const ws = XLSX.utils.aoa_to_sheet([g, h].concat(filas));
      const uF = filas.length + 1;             // índice de la fila de total
      for (let c = 0; c < nC; c++) {
        for (let f = 0; f <= uF; f++) {
          const ref = XLSX.utils.encode_cell({ r: f, c: c });
          if (!ws[ref]) ws[ref] = { t: 's', v: '' };
          if (f <= 1) {
            // Cada línea lleva el color con que la pinta el resto de la hoja.
            const li = (c >= 2 && c < cEq) ? lins[(c - 2) >> 1] : null;
            ws[ref].s = li ? cab(li.color, li.ink) : c === cPl ? cab('B26A00') : sCab;
            continue;
          }
          if (f === uF) ws[ref].s = sTot;
          else {
            // El plan va en ámbar y el potencial en verde: se ve de inmediato
            // cuál columna hay que llenar y cuál es la cifra que la justifica.
            const ex = c === cPl ? { fill: { patternType: 'solid', fgColor: { rgb: 'FFF8E1' } } }
                     : c === cMt ? { fill: { patternType: 'solid', fgColor: { rgb: 'E8F5EC' } } }
                     : null;
            ws[ref].s = sCel(f % 2 === 1, ex);
          }
          if (c === cMt) ws[ref].z = FMT_MM;
          else if (c === cVi || (c >= 2 && c < cEq && (c - 2) % 2 === 1)) ws[ref].z = FMT_V;
          else if (c === cEq || (c >= 2 && c < cEq)) ws[ref].z = FMT_N;
          if (c >= 2 && c <= cMt) ws[ref].s = Object.assign({}, ws[ref].s,
            { alignment: { horizontal: 'right' } });
        }
      }

      // Los dos pisos de la cabecera se unen: la línea sobre su par de
      // columnas, y las columnas sueltas de arriba abajo.
      const mg = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
                  { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }];
      lins.forEach((l, i) => mg.push({ s: { r: 0, c: 2 + 2 * i }, e: { r: 0, c: 3 + 2 * i } }));
      mg.push({ s: { r: 0, c: cEq }, e: { r: 0, c: cVi } });
      mg.push({ s: { r: 0, c: cMt }, e: { r: 1, c: cMt } });
      mg.push({ s: { r: 0, c: cPl }, e: { r: 1, c: cPl } });
      ws['!merges'] = mg;

      const cols = [{ wch: 4 }, { wch: 44 }];
      lins.forEach(() => cols.push({ wch: 9 }, { wch: 11 }));
      cols.push({ wch: 10 }, { wch: 13 }, { wch: 20 }, { wch: 46 });
      ws['!cols'] = cols;
      ws['!rows'] = [{ hpt: 20 }, { hpt: 30 }];
      // El filtro cuelga del piso de abajo y deja el total fuera.
      ws['!autofilter'] = { ref: 'A2:' + XLSX.utils.encode_col(nC - 1) + uF };
      ws['!freeze'] = { xSplit: 2, ySplit: 2 };
      // Excel no admite : \ / ? * [ ] en el nombre de la hoja, ni más de 31
      // caracteres, y no acepta dos hojas con el mismo nombre.
      let nom = String(r).replace(/[:\\\/\?\*\[\]]/g, '-').slice(0, 28) || 'Región';
      if (usados[nom]) { nom = nom.slice(0, 26) + '_' + (++usados[nom]); }
      else usados[nom] = 1;
      XLSX.utils.book_append_sheet(wb, ws, nom);
    });

    const hoy = (window.APP_DATA || {}).hoy || '';
    XLSX.writeFile(wb, 'Plan_Visitas_BI_TS_' + (hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
  } catch (err) {
    console.error('_biMxExport:', err);
    alert('Error al generar el Excel: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txt; }
  }
};

function biFiltrarLinea(btn){
  document.querySelectorAll('#bi-filt-linea .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _biFiltLinea = btn.dataset.bfl;
  _biRenderTabla();
}
function biFiltrarEstado(btn){
  document.querySelectorAll('#bi-filt-estado .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _biFiltEstado = btn.dataset.bfe;
  _biRenderTabla();
}
function biFiltrarRelacion(btn){
  document.querySelectorAll('#bi-filt-relacion .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _biFiltRelacion = btn.dataset.bfr;
  _biRenderTabla();
}
function biFiltrarLineasTipos(btn){
  document.querySelectorAll('#bi-tipos-linea-filt .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _biLineasFiltroTipos = btn.dataset.blt;
  _biRefreshDynamic();
}
function biFiltrarPotencial(btn){
  document.querySelectorAll('#bi-filt-potencial .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _biFiltPotencial = btn.dataset.bfp;
  _biRefreshDynamic();
}

// Actualiza KPIs, cards de línea y tabla al cambiar el filtro de Potencial ST
// ═══════════════════════════════════════════════════════════════
// MAPA DE EQUIPOS POR REGIÓN
// Coordenadas y paleta son las mismas del mapa de Desglose de Ingresos,
// y el color se asigna por la posición de la región en
// desglose_ingresos.por_region.regiones, para que una región tenga
// exactamente el mismo color en las dos hojas.
// ═══════════════════════════════════════════════════════════════
const _BI_GEO = {
  'Arica y Parinacota':{lat:-18.5,lon:-70.3}, 'Tarapacá':{lat:-20.2,lon:-69.3},
  'Antofagasta':{lat:-23.7,lon:-69.7}, 'Atacama':{lat:-27.4,lon:-70.3},
  'Coquimbo':{lat:-30.0,lon:-71.3}, 'Valparaíso':{lat:-33.0,lon:-71.6},
  'Metropolitana de Santiago':{lat:-33.5,lon:-70.6}, 'Metropolitana':{lat:-33.5,lon:-70.6},
  "O'Higgins":{lat:-34.6,lon:-71.0}, 'Maule':{lat:-35.4,lon:-71.7},
  'Ñuble':{lat:-36.7,lon:-71.8}, 'Bío Bío':{lat:-37.5,lon:-72.4},
  'Biobío':{lat:-37.5,lon:-72.4}, 'Araucanía':{lat:-38.9,lon:-72.3},
  'Los Ríos':{lat:-39.8,lon:-73.2}, 'Los Lagos':{lat:-41.5,lon:-73.0},
  'Aysén':{lat:-45.6,lon:-72.1},
  'Magallanes y la Antártica Chilena':{lat:-53.2,lon:-70.9}, 'Magallanes':{lat:-53.2,lon:-70.9},
};
const _BI_PALETTE = ['#002D73','#28D2C3','#FFC000','#E87722','#7A1FAA',
                     '#0A5C8C','#00832F','#D46000','#8B008B','#5a7da8',
                     '#c44569','#574b90','#3c9d4e','#b5451b','#888','#333','#aaa'];

// Orden de color: primero las regiones del Desglose en su mismo orden (para
// que una región tenga idéntico color en ambas hojas), y a continuación las
// que sólo existen en base instalada — Atacama, O'Higgins y Magallanes no
// tienen facturación, así que no aparecen allá y necesitan color propio.
let _biRegOrden = null;
function _biRegColor(r){
  if(!_biRegOrden){
    const ord = ((((window.APP_DATA||{}).desglose_ingresos||{}).por_region)||{}).regiones || [];
    _biRegOrden = ord.slice();
    Object.keys(((window.APP_DATA||{}).base_instalada||{}).por_region || {})
      .filter(x => x !== 'Sin región' && _biRegOrden.indexOf(x) === -1)
      .sort()
      .forEach(x => _biRegOrden.push(x));
  }
  const i = _biRegOrden.indexOf(r);
  return _BI_PALETTE[(i >= 0 ? i : _biRegOrden.length) % _BI_PALETTE.length];
}

// Datos por región respetando el filtro Potencial ST del inicio de la hoja
function _biRegData(){
  const pr = ((window.APP_DATA||{}).base_instalada||{}).por_region || {};
  const usaSi = _biFiltPotencial === 'si';
  // Los clientes se cuentan sobre la misma lista y con la misma región que la
  // tabla Detalle por Cliente —cada cliente en la región donde tiene la mayoría
  // de sus equipos—. El conteo del extractor contaba un cliente en cada región
  // donde tuviera algún equipo, así que el que tiene equipos repartidos sumaba
  // dos veces y el total no calzaba con el detalle.
  const nCli = {};
  (_biAllClientes||[]).forEach(c=>{
    if(_biFiltPotencial !== 'todos' && !(_biVal(c,'total') > 0)) return;
    const r = c.region || 'Sin región';
    nCli[r] = (nCli[r] || 0) + 1;
  });
  const out = [];
  Object.entries(pr).forEach(([r,d])=>{
    const tot = usaSi ? (d.total_si||0) : (d.total||0);
    if(tot <= 0) return;
    const ln = usaSi ? (d.lineas_si||{}) : (d.lineas||{});
    out.push({region:r, total:tot, n_clientes:nCli[r]||0,
              lineas:Object.entries(ln).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])});
  });
  // "Sin región" siempre al final: no es una región, es la falta de dato.
  return out.sort((a,b)=>{
    const sa = a.region === 'Sin región', sb = b.region === 'Sin región';
    if(sa !== sb) return sa ? 1 : -1;
    return b.total - a.total;
  });
}

let _biMapL = null, _biMapLyr = null;
function _biRenderMapa(){
  if(!window.L) return;
  const cont = document.getElementById('biMapa');
  if(!cont) return;
  const datos = _biRegData();

  if(!_biMapL){
    _biMapL = L.map('biMapa',{zoomControl:true,scrollWheelZoom:false}).setView([-35.5,-70.5],4);
    mapaTiles(_biMapL);
  }
  if(!_biMapLyr) _biMapLyr = L.layerGroup().addTo(_biMapL);
  _biMapLyr.clearLayers();

  const maxV = Math.max(...datos.map(d=>d.total), 1);
  const totG = datos.reduce((s,d)=>s+d.total,0);

  datos.forEach(d=>{
    const geo = _BI_GEO[d.region];
    if(!geo) return;                       // "Sin región" no se dibuja
    const clr = _biRegColor(d.region);
    const radius = Math.max(7, Math.sqrt(d.total/maxV)*34);
    const filas = d.lineas.map(([l,v])=>
      `<tr><td style="padding:1px 0"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;
        background:${_biLineaColor(String(l).toUpperCase())};margin-right:5px"></span>${l}</td>
       <td style="text-align:right;padding:1px 0 1px 12px;font-weight:700">${v.toLocaleString('es-CL')}</td>
       <td style="text-align:right;padding:1px 0 1px 8px;color:#9aa;font-size:.9em">${(v/d.total*100).toFixed(0)}%</td></tr>`).join('');
    L.circleMarker([geo.lat,geo.lon],{
      radius, fillColor:clr, color:clr, weight:1.5, opacity:1, fillOpacity:.78,
    }).bindTooltip(
      `<div style="font-family:Roboto,sans-serif;min-width:190px">
         <div style="font-weight:900;font-size:.78rem;color:${clr};border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:4px">
           ${d.region}</div>
         <div style="font-size:.72rem;margin-bottom:4px">
           <strong style="font-size:.9rem">${d.total.toLocaleString('es-CL')}</strong> equipos
           <span style="color:#888">· ${(d.total/totG*100).toFixed(1)}% del total</span></div>
         <table style="font-size:.66rem;border-collapse:collapse;width:100%">${filas}</table>
         <div style="font-size:.62rem;color:#888;margin-top:4px;border-top:1px solid #eee;padding-top:3px">
           ${d.n_clientes} cliente${d.n_clientes===1?'':'s'}</div>
       </div>`,
      {sticky:true, direction:'top', opacity:.97}
    ).addTo(_biMapLyr);
  });

  const lbl = document.getElementById('bi-mapa-lbl');
  if(lbl) lbl.textContent = `${datos.length} regiones · ${totG.toLocaleString('es-CL')} equipos`;
  setTimeout(()=>{ if(_biMapL) _biMapL.invalidateSize(); }, 60);
}

// Leaflet mide mal si el contenedor estaba oculto: sv() llama a esto al
// entrar a la hoja para que recalcule el tamaño.
window._biMapRefresh = function(){
  if(_biMapL) _biMapL.invalidateSize();
};

function _biRenderRegTabla(){
  const box = document.getElementById('bi-reg-tabla');
  if(!box) return;
  _biRegPotMap = null;   // el potencial depende del segmentador, se recalcula
  const datos = _biRegData();
  if(!datos.length){ box.innerHTML=''; return; }
  const totG = datos.reduce((s,d)=>s+d.total,0);
  const maxV = Math.max(...datos.map(d=>d.total),1);

  // Columnas = líneas con equipos, ordenadas por volumen total
  const acum = {};
  datos.forEach(d=>d.lineas.forEach(([l,v])=>{acum[l]=(acum[l]||0)+v;}));
  const cols = Object.keys(acum).sort((a,b)=>acum[b]-acum[a]);

  const th = (t,al)=>`<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;
    padding:.35rem .5rem;font-size:.55rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
    border-right:1px solid rgba(255,255,255,.18)">${t}</th>`;
  const SEP='border-right:1px solid var(--brd)';

  box.innerHTML = `
    <div style="overflow-x:auto;max-height:400px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;min-width:${220+cols.length*62}px">
        <thead><tr>
          ${th('REGIÓN','left')}${th('EQUIPOS','right')}${th('%','right')}
          ${cols.map(c=>th(String(c).toUpperCase().slice(0,11),'right')).join('')}
          ${th('CLIENTES','right')}
          ${th('POTENCIAL ST','right')}
        </tr></thead>
        <tbody>${datos.map((d,i)=>{
          const m = Object.fromEntries(d.lineas);
          return `<tr style="background:${i%2===0?'var(--bg2)':'var(--bg)'};border-left:3px solid ${_biRegColor(d.region)}">
            <td style="padding:.28rem .5rem;font-size:.63rem;font-weight:600;white-space:nowrap;${SEP}">${d.region}</td>
            <td style="padding:.28rem .5rem;text-align:right;font-size:.65rem;font-weight:700;
                       font-variant-numeric:tabular-nums;${SEP}">${d.total.toLocaleString('es-CL')}</td>
            <td style="padding:.28rem .5rem;${SEP}">
              <div style="display:flex;align-items:center;gap:4px">
                <div style="flex:1;height:5px;background:var(--gy);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${d.total/maxV*100}%;background:${_biRegColor(d.region)}"></div></div>
                <span style="font-size:.55rem;color:var(--mut);min-width:30px;text-align:right">${(d.total/totG*100).toFixed(1)}%</span>
              </div></td>
            ${cols.map(c=>`<td style="padding:.28rem .5rem;text-align:right;font-size:.61rem;
              font-variant-numeric:tabular-nums;color:${m[c]?_biLineaColor(String(c).toUpperCase()):'var(--mut)'};${SEP}">${m[c]?m[c].toLocaleString('es-CL'):'—'}</td>`).join('')}
            <td style="padding:.28rem .5rem;text-align:right;font-size:.61rem;color:var(--mut);${SEP}">${d.n_clientes}</td>
            <td style="padding:.28rem .5rem;text-align:right;font-size:.64rem;font-weight:700;color:var(--am);
                       font-variant-numeric:tabular-nums">${_biRegPot(d)?mm(_biRegPot(d)):'—'}</td>
          </tr>`;}).join('')}</tbody>
        <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
          <td style="padding:.32rem .5rem;font-size:.63rem;${SEP}">TOTAL · ${datos.length} regiones</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;${SEP}">${totG.toLocaleString('es-CL')}</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.58rem;${SEP}">100%</td>
          ${cols.map(c=>`<td style="padding:.32rem .5rem;text-align:right;font-size:.61rem;
            font-variant-numeric:tabular-nums;${SEP}">${acum[c].toLocaleString('es-CL')}</td>`).join('')}
          <td style="padding:.32rem .5rem;text-align:right;font-size:.61rem;${SEP}">${datos.reduce((s,d)=>s+d.n_clientes,0)}</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.64rem;
                     font-variant-numeric:tabular-nums">${mm(datos.reduce((s,d)=>s+_biRegPot(d),0))}</td>
        </tr></tfoot>
      </table>
    </div>
    <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.55">
      La región viene de la columna «Región» de la hoja BASE INSTALADA. Los equipos que en el Excel
      figuran sin región, con «Sin Información» o con error quedan agrupados en «Sin región» y no se
      dibujan en el mapa.<br>
      <strong>Potencial ST</strong> suma el potencial de los mismos clientes de la tabla Detalle por Cliente,
      <strong>excluyendo a los que ya tienen contrato o garantía vigente</strong>, por lo que su total coincide
      con el de esa tabla. Tarifas anuales de mantención por equipo:
      Esterilización <strong>50 UF</strong> (${mm(_BI_TARIFA.esterilizacion)}),
      Endoscopía <strong>22 UF</strong> (${mm(_BI_TARIFA.endoscopia)}) y
      Dental <strong>15 UF</strong> (${mm(_BI_TARIFA.dental)}); las demás líneas no valorizan.
      Respeta el segmentador de Potencial ST del inicio de la hoja. Cada cliente se atribuye a la región
      donde tiene la mayoría de sus equipos.</p>`;
}

function _biRefreshDynamic(){
  const base = _biBaseList();
  const total = base.reduce((s,c)=>s+_biVal(c,'total'),0);
  const biConContratoActivo = base.filter(c=>{ const d=_biLookupContrato(c.nombre); return d&&d.n>0; }).length;

  // Actualizar KPI grid
  const kpiGrid = document.getElementById('bi-kpi-grid');
  if(kpiGrid){
    const totEl   = document.getElementById('bi-kpi-total-val');
    const cliEl   = document.getElementById('bi-kpi-clientes-val');
    const contrEl = document.getElementById('bi-kpi-contrato-val');
    const pctCli2 = document.getElementById('bi-kpi-clientes-sub2');
    const estVal  = document.getElementById('bi-kpi-estado-val');
    const pctContr= document.getElementById('bi-kpi-contrato-sub');
    const baseTotal = base.reduce((s,c)=>s+_biVal(c,'total'),0);
    const conContrato = base.reduce((s,c)=>s+(c.con_contrato?_biVal(c,'total'):0),0);
    if(totEl)   totEl.textContent   = baseTotal.toLocaleString('es-CL');
    if(cliEl)   cliEl.textContent   = base.length.toLocaleString('es-CL');
    if(contrEl) contrEl.textContent = biConContratoActivo;
    if(pctCli2) pctCli2.textContent = base.length > 0 ? ((biConContratoActivo/base.length)*100).toFixed(1)+'% clientes BI' : '—';
    if(estVal)  estVal.textContent  = conContrato.toLocaleString('es-CL');
    if(pctContr)pctContr.textContent= baseTotal > 0 ? ((conContrato/baseTotal)*100).toFixed(1)+'% equipos' : '—';
  }

  // Actualizar cards por línea
  const cardsContainer = document.getElementById('bi-linea-cards');
  if(cardsContainer){
    const _LINEAS_DEF = [
      {key:'dental',        label:'Dental',            color:'#FFC000', icon:'🦷', prop:'dental'},
      {key:'esterilizacion',label:'Esterilización',   color:'#002D73', icon:'⚗️',  prop:'esterilizacion'},
      {key:'incardia',      label:'Incardia',           color:'#D46000', icon:'🫀', prop:'incardia'},
      {key:'endoscopia',    label:'Endoscopía',         color:'#28D2C3', icon:'🔭', prop:'endoscopia'},
      {key:'mobiliario',    label:'Mobiliario Clínico', color:'#7B2FBE', icon:'🛏️', prop:'mobiliario'},
      {key:'mmq_reas',      label:'MMQ / REAS',         color:'#00832F', icon:'🔧', prop:'mmq_reas'},
    ];
    cardsContainer.innerHTML = _LINEAS_DEF.map(def => {
      const nTotal = base.reduce((s,c)=>s+_biVal(c,def.prop),0);
      const nCli   = base.filter(c=>_biVal(c,def.prop)>0).length;
      const nContr = base.filter(c=>_biVal(c,def.prop)>0 && _biLookupContrato(c.nombre)?.n>0).length;
      const pctCon = nCli>0?(nContr/nCli*100).toFixed(0):0;
      const topCli = [...base].filter(c=>_biVal(c,def.prop)>0).sort((a,b)=>_biVal(b,def.prop)-_biVal(a,def.prop)).slice(0,3);
      const cliRows = topCli.map(c=>
        `<div style="display:flex;justify-content:space-between;font-size:.6rem;padding:.1rem 0;border-bottom:1px solid var(--gy2)">
          <span style="color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${c.nombre.length>28?c.nombre.slice(0,26)+'…':c.nombre}</span>
          <span style="font-family:'Roboto Mono',monospace;font-weight:700;color:${def.color};flex-shrink:0">${_biVal(c,def.prop)}</span>
        </div>`).join('');
      return `<div class="card" style="border-top:3px solid ${def.color};padding:0;overflow:hidden">
        <div style="padding:.65rem .8rem;background:linear-gradient(135deg,${def.color}18,transparent)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.3rem">
            <div>
              <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);font-weight:700">${def.icon} ${def.label}</div>
              <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.6rem;color:${def.color};line-height:1.1">${nTotal.toLocaleString('es-CL')}</div>
              <div style="font-size:.58rem;color:var(--mut)">equipos · ${nCli} clientes</div>
            </div>
            <div style="text-align:right">
              <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.1rem;color:var(--gn)">${pctCon}%</div>
              <div style="font-size:.55rem;color:var(--mut)">con contrato</div>
            </div>
          </div>
          <div style="height:4px;background:var(--gy2);border-radius:2px;margin:.4rem 0">
            <div style="width:${pctCon}%;height:100%;background:var(--gn);border-radius:2px;transition:width .6s"></div>
          </div>
        </div>
        <div style="padding:.4rem .8rem .55rem;border-top:1px solid var(--brd)">
          <div style="font-size:.58rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.28rem">Top clientes</div>
          ${cliRows||'<div style="font-size:.6rem;color:var(--mut)">Sin datos</div>'}
        </div>
      </div>`;
    }).join('');
  }

  // ── Torta: Distribución por Línea de Negocio (desde clientes filtrados) ───
  const _LINEA_MAP = [
    {label:'Dental',            prop:'dental',          color:'#FFC000'},
    {label:'Esterilización',    prop:'esterilizacion',  color:'#002D73'},
    {label:'Incardia',          prop:'incardia',        color:'#D46000'},
    {label:'Endoscopía',        prop:'endoscopia',      color:'#28D2C3'},
    {label:'Mobiliario Clínico',prop:'mobiliario',      color:'#7B2FBE'},
    {label:'MMQ / REAS',        prop:'mmq_reas',        color:'#00832F'},
    {label:'Otros',             prop:'otros',           color:'#B8C1D8'},
  ];
  const _lineaTotals = _LINEA_MAP.map(l=>({...l, n: base.reduce((s,c)=>s+_biVal(c,l.prop),0)})).filter(l=>l.n>0);
  const _ctxLineas = document.getElementById('cBILineas');
  if(_ctxLineas){
    if(_chBIRegion) _chBIRegion.destroy();
    _chBIRegion = safeChart(_ctxLineas.getContext('2d'),{
      type:'doughnut',
      data:{
        labels:_lineaTotals.map(l=>l.label),
        datasets:[{data:_lineaTotals.map(l=>l.n),backgroundColor:_lineaTotals.map(l=>l.color),borderWidth:2,borderColor:'#fff'}]
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'55%',
        plugins:{
          legend:{position:'right',labels:{boxWidth:12,font:{size:10},padding:10}},
          tooltip:{callbacks:{label:c=>{const tot=_lineaTotals.reduce((s,l)=>s+l.n,0);return ` ${c.label}: ${c.raw.toLocaleString('es-CL')} (${tot>0?(c.raw/tot*100).toFixed(1):0}%)`;} }}
        }
      }
    });
  }

  // ── Gráfico Top 12 Tipos (segmentable por línea) ──────────────────────────
  const _biRef = APP_DATA.base_instalada || {};
  const _porTipoLinea = _biRef.por_tipo_linea || {};
  const _LINEA_KEY_MAP = {
    dental:'DENTAL', esterilizacion:'ESTERILIZACIÓN', incardia:'INCARDIA',
    endoscopia:'ENDOSCOPIA', mobiliario:'MOBILIARIO CLINICO', mmq_reas:'MMQ'
  };
  let _tiposData;
  if(_biLineasFiltroTipos !== 'todos'){
    const lineaKey = _LINEA_KEY_MAP[_biLineasFiltroTipos] || _biLineasFiltroTipos.toUpperCase();
    // Buscar la clave exacta en por_tipo_linea (con o sin acento)
    const foundKey = Object.keys(_porTipoLinea).find(k =>
      k.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(lineaKey.normalize('NFD').replace(/[̀-ͯ]/g,''))
    );
    _tiposData = foundKey ? _porTipoLinea[foundKey] : [];
  } else {
    _tiposData = _biFiltPotencial==='si' ? (_biRef.por_tipo_si||_biRef.por_tipo)
               : _biFiltPotencial==='no' ? (_biRef.por_tipo_no||_biRef.por_tipo)
               : _biRef.por_tipo;
  }
  const _top12 = (_tiposData||[]).slice(0,12);
  const _ctxTipos = document.getElementById('cBITipos');
  if(_ctxTipos){
    if(_chBITipos) _chBITipos.destroy();
    _chBITipos = safeChart(_ctxTipos.getContext('2d'),{
      type:'bar',
      data:{labels:_top12.map(x=>x.tipo.length>30?x.tipo.slice(0,28)+'…':x.tipo),
        datasets:[{label:'Equipos',data:_top12.map(x=>x.n),
          backgroundColor:_top12.map((_,i)=>{const cols=['#FFC000','#002D73','#D46000','#28D2C3','#7B2FBE','#00832F'];return cols[i%cols.length];}),
          borderRadius:4}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw.toLocaleString('es-CL')} equipos`}}},
        scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{font:{size:10}}},y:{grid:{display:false},ticks:{font:{size:9}}}}}
    });
  }

  _biRenderTabla();
  _biRenderMapa();
  _biRenderRegTabla();
  _biNotaFac();
}

// Conciliación de la columna Fac. 2026 contra el total del panel. La hoja
// sólo puede sumar a los clientes que tienen equipos registrados, así que
// deja explícito cuánto factura el resto en vez de aparentar un descuadre.
function _biNotaFac(){
  const el = document.getElementById('bi-fac-nota');
  if(!el) return;
  const otros = _biOtrosFac();
  const totPanel = otros.tot, cruz = otros.cruz;
  const nCruz = otros.usados ? otros.usados.size : 0;
  if(!totPanel){ el.textContent=''; return; }
  el.innerHTML =
    `<strong>Fac. 2026</strong> es la facturación del año de cada cliente, con la misma base que «Ingresos Totales» `+
    `de la portada. Los clientes con equipos registrados suman <strong>${mm(cruz)}</strong> en ${nCruz} filas y la `+
    `fila <strong>Otros clientes</strong> recoge los ${otros.n} que facturan sin base instalada cargada `+
    `(<strong>${mm(otros.monto)}</strong>), de modo que el total cierra en los ${mm(totPanel)} del panel. `+
    `Cada cliente se cuenta una sola vez: el cruce por nombre exige coincidencia exacta o una única coincidencia `+
    `parcial sin ambigüedad. Al aplicar cualquier filtro la fila «Otros clientes» se oculta y el pie pasa a mostrar `+
    `sólo el subconjunto seleccionado.`;
}
function biSearch(val){
  _biQuery = val;
  _biRenderTabla();
}
function biSortCol(col, th){
  if(_biSortCol === col) _biSortAsc = !_biSortAsc;
  else { _biSortCol = col; _biSortAsc = false; }
  if(th){
    const tbl = th.closest('table');
    tbl.querySelectorAll('th').forEach(h=>h.classList.remove('th-asc','th-desc'));
    th.classList.add(_biSortAsc ? 'th-asc' : 'th-desc');
  }
  _biRenderTabla();
}

function initBaseInstalada(){
  const bi = APP_DATA.base_instalada || {};
  _biAllClientes = bi.clientes || [];   // guardar para re-filtrar con potencial
  const clientes = _biAllClientes;
  const porLinea = bi.por_linea || {};
  const porEstado = bi.por_estado || {};
  const porTipo   = bi.por_tipo   || [];
  const total     = bi.total || 0;

  // ── Construir mapas cruzados con panel y DATA ─────────────────────────────
  // panel_fact deduplica las filas alias de FACTURACION y suma los clientes
  // que sólo aparecen en la BBDD; panel se deja como respaldo.
  _biPanelMap = {};
  ((APP_DATA.panel_fact && APP_DATA.panel_fact.length)
      ? APP_DATA.panel_fact : (APP_DATA.panel||[])).forEach(p=>{
    const k=_biNorm(p.cliente);
    if(k) _biPanelMap[k]=p;
  });
  _biResolverFac(_biAllClientes);
  _biContratoMap = {};
  (typeof DATA!=='undefined'?DATA:[]).forEach(d=>{
    const k=_biNorm(d.cliente);
    if(!_biContratoMap[k]) _biContratoMap[k]={n:0,tipos:[],coords:[]};
    _biContratoMap[k].n++;
    if(!_biContratoMap[k].tipos.includes(d.tipo)) _biContratoMap[k].tipos.push(d.tipo);
    if(d.coord&&!_biContratoMap[k].coords.includes(d.coord)) _biContratoMap[k].coords.push(d.coord);
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const conContrato = (porEstado['Contrato']||0) + (porEstado['Garantia']||0);
  const lineasActivas = Object.keys(porLinea).length;
  // Clientes BI que tienen contrato activo en DATA
  const biConContratoActivo = clientes.filter(c=>{ const d=_biLookupContrato(c.nombre); return d&&d.n>0; }).length;
  // Facturación 2026 de clientes BI que están en el panel
  const facBITotal = _biFacUnicos(clientes).monto;

  // ── Helpers de líneas para cards ─────────────────────────────────────────
  const _LINEAS_DEF = [
    {key:'dental',       label:'Dental',           color:'#FFC000', icon:'🦷', prop:'dental'},
    {key:'esterilizacion',label:'Esterilización',  color:'#002D73', icon:'⚗️',  prop:'esterilizacion'},
    {key:'incardia',     label:'Incardia',          color:'#D46000', icon:'🫀', prop:'incardia'},
    {key:'endoscopia',   label:'Endoscopía',        color:'#28D2C3', icon:'🔭', prop:'endoscopia'},
    {key:'mobiliario',   label:'Mobiliario Clínico',color:'#7B2FBE', icon:'🛏️', prop:'mobiliario'},
    {key:'mmq_reas',     label:'MMQ / REAS',        color:'#00832F', icon:'🔧', prop:'mmq_reas'},
  ];
  const porTipoLinea = bi.por_tipo_linea || {};

  // Mapa normalizado de porLinea (sin acentos, mayúsculas) para lookup robusto
  const _plNorm = {};
  Object.keys(porLinea).forEach(k => {
    const nk = k.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    _plNorm[nk] = (porLinea[k]||0);
  });
  _plNorm['MMQ_REAS'] = (_plNorm['MMQ']||0) + (_plNorm['REAS']||0);
  function _normKey(s){ return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

  function _biTopCliLine(prop, n=3){
    return [...clientes].filter(c=>c[prop]>0).sort((a,b)=>b[prop]-a[prop]).slice(0,n);
  }
  function _biLineCard(def){
    // Busca total en porLinea normalizado (clave por key, luego por label completo)
    const nTotal = _plNorm[_normKey(def.key)] != null && _plNorm[_normKey(def.key)] > 0
      ? _plNorm[_normKey(def.key)]
      : _plNorm[_normKey(def.label)] != null && _plNorm[_normKey(def.label)] > 0
        ? _plNorm[_normKey(def.label)]
        : clientes.reduce((s,c)=>s+(c[def.prop]||0),0);
    const nCli   = clientes.filter(c=>c[def.prop]>0).length;
    const nContr = clientes.filter(c=>c[def.prop]>0 && _biLookupContrato(c.nombre)?.n>0).length;
    const pctCon = nCli>0?(nContr/nCli*100).toFixed(0):0;
    const topTip = (porTipoLinea[def.label.toUpperCase()]||porTipoLinea[def.label.split(' ')[0].toUpperCase()]||[]).slice(0,4);
    const topCli = _biTopCliLine(def.prop, 3);
    const tipoRows = topTip.map(t=>{
      const pct = nTotal>0?Math.round(t.n/nTotal*100):0;
      const barW = Math.max(2,Math.round(pct*0.8));
      return `<div style="display:flex;align-items:center;gap:.4rem;font-size:.6rem;margin:.12rem 0">
        <div style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mut)">${t.tipo.length>28?t.tipo.slice(0,26)+'…':t.tipo}</div>
        <div style="width:60px;height:4px;background:var(--gy2);border-radius:2px;flex-shrink:0">
          <div style="width:${barW}%;height:100%;background:${def.color};border-radius:2px"></div>
        </div>
        <div style="font-family:'Roboto Mono',monospace;width:36px;text-align:right;color:var(--txt);flex-shrink:0">${t.n}</div>
      </div>`;
    }).join('');
    const cliRows = topCli.map(c=>
      `<div style="display:flex;justify-content:space-between;font-size:.6rem;padding:.1rem 0;border-bottom:1px solid var(--gy2)">
        <span style="color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${c.nombre.length>28?c.nombre.slice(0,26)+'…':c.nombre}</span>
        <span style="font-family:'Roboto Mono',monospace;font-weight:700;color:${def.color};flex-shrink:0">${c[def.prop]}</span>
      </div>`).join('');
    return `<div class="card" style="border-top:3px solid ${def.color};padding:0;overflow:hidden">
      <div style="padding:.65rem .8rem;background:linear-gradient(135deg,${def.color}18,transparent)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.3rem">
          <div>
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);font-weight:700">${def.icon} ${def.label}</div>
            <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.6rem;color:${def.color};line-height:1.1">${nTotal.toLocaleString('es-CL')}</div>
            <div style="font-size:.58rem;color:var(--mut)">equipos · ${nCli} clientes</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.1rem;color:var(--gn)">${pctCon}%</div>
            <div style="font-size:.55rem;color:var(--mut)">con contrato</div>
          </div>
        </div>
        <div style="height:4px;background:var(--gy2);border-radius:2px;margin:.4rem 0">
          <div style="width:${pctCon}%;height:100%;background:var(--gn);border-radius:2px;transition:width .6s"></div>
        </div>
      </div>
      <div style="padding:.4rem .8rem .55rem;border-top:1px solid var(--brd)">
        <div style="font-size:.58rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.28rem">Top equipos</div>
        ${tipoRows||'<div style="font-size:.6rem;color:var(--mut)">Sin datos</div>'}
      </div>
      <div style="padding:.4rem .8rem .55rem;border-top:1px solid var(--brd)">
        <div style="font-size:.58rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.28rem">Top clientes</div>
        ${cliRows||'<div style="font-size:.6rem;color:var(--mut)">Sin datos</div>'}
      </div>
    </div>`;
  }

  // ── Vista regional con MAPA_DATA ──────────────────────────────────────────
  const mapaCli = typeof MAPA_DATA!=='undefined'?MAPA_DATA:[];
  const regionMap={};
  mapaCli.forEach(c=>{
    const r=c.region||'Sin región';
    if(!regionMap[r])regionMap[r]={n:0,bi:0,cc:0,ing:0,pot:0};
    regionMap[r].n++;
    regionMap[r].bi+=c.bi||0;
    regionMap[r].ing+=c.ingreso||0;
    regionMap[r].pot+=c.pot||0;
    if(c.cc)regionMap[r].cc++;
  });
  const regArr=Object.entries(regionMap).sort((a,b)=>b[1].bi-a[1].bi).slice(0,14);

  const v = document.getElementById('view-base');
  v.innerHTML = `
  <div class="sh">
    <h2>Base Instalada · Equipos TECSERVICE</h2>
    <div class="sh-line"></div>
    <span class="sh-tag">${total.toLocaleString('es-CL')} equipos activos · ${clientes.length} clientes · ${lineasActivas} líneas de negocio</span>
  </div>

  <!-- Segmentador Potencial ST -->
  <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;padding:.5rem .7rem;background:var(--gy);border-radius:6px;border-left:3px solid var(--az2)">
    <span style="font-size:.65rem;font-weight:700;color:var(--az1)">Potencial ST:</span>
    <div id="bi-filt-potencial" style="display:flex;gap:.25rem">
      <button class="btn on" data-bfp="todos" onclick="biFiltrarPotencial(this)">Todos</button>
      <button class="btn" data-bfp="si" onclick="biFiltrarPotencial(this)" style="border-left:2px solid var(--gn)">Sí</button>
      <button class="btn" data-bfp="no" onclick="biFiltrarPotencial(this)" style="border-left:2px solid var(--rd)">No</button>
    </div>
    <span style="font-size:.58rem;color:var(--mut);margin-left:.4rem;line-height:1.4">
      <strong style="color:var(--gn)">Sí</strong> = solo marcas que TECSERVICE actualmente representa · este equipamiento constituye oportunidades potenciales de servicio de mantención.
      <strong style="color:var(--rd)">No</strong> = marcas que ya no representamos.
    </span>
  </div>

  <!-- KPIs compactos -->
  <div id="bi-kpi-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:.55rem;margin-bottom:1rem">
    <div class="kpi" style="--kc:var(--az1)"><div class="kpi-lbl">Total Equipos</div><div class="kpi-val" id="bi-kpi-total-val">${total.toLocaleString('es-CL')}</div><div class="kpi-sub">activos en servicio</div></div>
    <div class="kpi" style="--kc:var(--az2)"><div class="kpi-lbl">Clientes</div><div class="kpi-val" id="bi-kpi-clientes-val">${clientes.length.toLocaleString('es-CL')}</div><div class="kpi-sub" id="bi-kpi-clientes-sub">instituciones</div></div>
    <div class="kpi" style="--kc:var(--gn)"><div class="kpi-lbl">Con Contrato Activo</div><div class="kpi-val" id="bi-kpi-contrato-val">${biConContratoActivo}</div><div class="kpi-sub" id="bi-kpi-clientes-sub2">${clientes.length>0?((biConContratoActivo/clientes.length)*100).toFixed(1):'0'}% clientes BI</div></div>
    <div class="kpi" style="--kc:var(--teal)"><div class="kpi-lbl">Contr./Garantía BI</div><div class="kpi-val" id="bi-kpi-estado-val">${conContrato.toLocaleString('es-CL')}</div><div class="kpi-sub" id="bi-kpi-contrato-sub">${total>0?((conContrato/total)*100).toFixed(1):'0'}% equipos</div></div>
    <div class="kpi" style="--kc:var(--or)"><div class="kpi-lbl">Tipos de Equipo</div><div class="kpi-val">${porTipo.length}</div><div class="kpi-sub">tipos distintos</div></div>
  </div>

  <!-- Cards por línea de negocio (2×3) -->
  <div class="sh" style="margin-bottom:.6rem"><h2>Por Línea de Negocio</h2><div class="sh-line"></div><span class="sh-tag">Distribución de equipos · top tipos · clientes · % con contrato activo</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.1rem" id="bi-linea-cards"></div>

  <!-- Mapa de equipos por región + tabla resumen -->
  <div class="sh" style="margin-bottom:.6rem"><h2>Distribución Geográfica</h2><div class="sh-line"></div>
    <span class="sh-tag">Equipos de base instalada por región · el tamaño de la burbuja es proporcional a la cantidad</span></div>
  <div style="display:grid;grid-template-columns:1fr 1.25fr;gap:.8rem;margin-bottom:1.1rem">
    <div class="card">
      <div class="ch"><span class="ct">Equipos por Región</span>
        <span style="font-size:.55rem;color:var(--mut);margin-left:auto" id="bi-mapa-lbl">—</span></div>
      <div class="cb" style="padding:.5rem">
        <div id="biMapa" style="height:430px;border-radius:6px;overflow:hidden"></div>
      </div>
    </div>
    <div class="card">
      <div class="ch"><span class="ct">Resumen por Región</span></div>
      <div class="cb"><div id="bi-reg-tabla"></div></div>
    </div>
  </div>

  <!-- Distribución por Línea + Top tipos por línea -->
  <div class="g6040" style="margin-bottom:1rem">
    <div class="card">
      <div class="ch"><span class="ct">Distribución por Línea de Negocio</span></div>
      <div class="cb" style="position:relative;height:320px"><canvas id="cBILineas"></canvas></div>
    </div>
    <div class="card">
      <div class="ch"><span class="ct">Top 12 Tipos de Equipo</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem;padding:.4rem .8rem;border-bottom:1px solid var(--brd)" id="bi-tipos-linea-filt">
        <button class="btn on" data-blt="todos" onclick="biFiltrarLineasTipos(this)">Todas</button>
        <button class="btn" data-blt="dental"          onclick="biFiltrarLineasTipos(this)" style="border-left:2px solid #FFC000">Dental</button>
        <button class="btn" data-blt="esterilizacion"  onclick="biFiltrarLineasTipos(this)" style="border-left:2px solid #002D73">Esteril.</button>
        <button class="btn" data-blt="incardia"        onclick="biFiltrarLineasTipos(this)" style="border-left:2px solid #D46000">Incardia</button>
        <button class="btn" data-blt="endoscopia"      onclick="biFiltrarLineasTipos(this)" style="border-left:2px solid #28D2C3">Endosc.</button>
        <button class="btn" data-blt="mobiliario"      onclick="biFiltrarLineasTipos(this)" style="border-left:2px solid #7B2FBE">Mobil.</button>
        <button class="btn" data-blt="mmq_reas"        onclick="biFiltrarLineasTipos(this)" style="border-left:2px solid #00832F">MMQ/REAS</button>
      </div>
      <div class="cb" style="position:relative;height:280px"><canvas id="cBITipos"></canvas></div>
    </div>
  </div>

  <!-- Filtros + Tabla compacta -->
  <div class="sh" style="margin-bottom:.5rem"><h2>Detalle por Cliente</h2><div class="sh-line"></div>
    <span style="font-size:.56rem;color:var(--mut);margin-right:.5rem">clic en una región para ver sus clientes</span>
    <button class="btn" onclick="window._biRegTodas(true)"
      style="font-size:.57rem;padding:.18rem .55rem">Expandir todo</button>
    <button class="btn" onclick="window._biRegTodas(false)"
      style="font-size:.57rem;padding:.18rem .55rem;margin-left:.25rem">Colapsar todo</button>
    <span class="sh-tag" style="margin-left:.6rem">Filtro: <span id="bi-filter-info">Todos</span></span>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:.6rem;align-items:center">
    <div id="bi-filt-linea" style="display:flex;gap:.25rem;flex-wrap:wrap">
      <button class="btn on" data-bfl="todos" onclick="biFiltrarLinea(this)">Todas</button>
      <button class="btn" data-bfl="dental" onclick="biFiltrarLinea(this)" style="border-left:2px solid #FFC000">Dental</button>
      <button class="btn" data-bfl="esterilizacion" onclick="biFiltrarLinea(this)" style="border-left:2px solid #002D73">Esteril.</button>
      <button class="btn" data-bfl="incardia" onclick="biFiltrarLinea(this)" style="border-left:2px solid #D46000">Incardia</button>
      <button class="btn" data-bfl="endoscopia" onclick="biFiltrarLinea(this)" style="border-left:2px solid #28D2C3">Endosc.</button>
      <button class="btn" data-bfl="mobiliario" onclick="biFiltrarLinea(this)" style="border-left:2px solid #7B2FBE">Mobil.</button>
      <button class="btn" data-bfl="mmq_reas" onclick="biFiltrarLinea(this)" style="border-left:2px solid #00832F">MMQ/REAS</button>
    </div>
    <div id="bi-filt-relacion" style="display:flex;gap:.25rem;flex-wrap:wrap;border-left:1px solid var(--brd);padding-left:.5rem">
      <button class="btn on" data-bfr="todos" onclick="biFiltrarRelacion(this)">Todos</button>
      <button class="btn" data-bfr="con" onclick="biFiltrarRelacion(this)" style="border-left:2px solid var(--gn)">Con contrato</button>
      <button class="btn" data-bfr="sin" onclick="biFiltrarRelacion(this)" style="border-left:2px solid var(--rd)">Sin contrato</button>
    </div>
    <input type="search" placeholder="🔍 Buscar cliente…" oninput="biSearch(this.value)"
      style="margin-left:auto;border:1px solid var(--brd);border-radius:20px;padding:.28rem .8rem;font-size:.65rem;outline:none;width:190px;font-family:'Roboto',sans-serif">
  </div>
  <div class="card" style="overflow:auto;max-height:72vh">
    <table class="tbl" style="font-size:.65rem">
      <thead><tr>
        <th style="width:2rem">#</th>
        <th onclick="biSortCol(1,this)">Cliente</th>
        <th onclick="biSortCol(2,this)" class="num th-desc">Total</th>
        <th onclick="biSortCol(3,this)" class="num" style="color:#FFC000">Dental</th>
        <th onclick="biSortCol(4,this)" class="num" style="color:#A0B8F0">Esteril.</th>
        <th onclick="biSortCol(5,this)" class="num" style="color:#F0A060">Incardia</th>
        <th onclick="biSortCol(6,this)" class="num" style="color:#28D2C3">Endosc.</th>
        <th onclick="biSortCol(7,this)" class="num" style="color:#C0A0F0">Mobil.</th>
        <th onclick="biSortCol(8,this)" class="num" style="color:#80D080">MMQ/REAS</th>
        <th class="num" title="Cuánto de su vida útil lleva consumido el parque: para cada equipo, los años desde su instalación divididos por la vida útil de referencia de su tipo, y el promedio de esos porcentajes.&#10;Sobre 100% el equipo ya agotó la vida útil esperada.&#10;Sólo entran los equipos que traen fecha de instalación y cuyo tipo tiene vida útil definida: entre paréntesis, qué proporción del parque de la región cumple ambas cosas.">% Vida Útil</th>
        <th onclick="biSortCol(9,this)">Estado BI</th>
        <th onclick="biSortCol(10,this)" class="num" style="color:#FFC000" title="Facturación del año del cliente, misma base que «Ingresos Totales» de la portada.&#10;Sólo cubre a los clientes de la base instalada: los que facturan sin tener equipos registrados aquí no aparecen.">Fac. 2026</th>
        <th class="num">F. Contr.</th>
        <th class="num" style="color:#FFC000" title="Potencial de servicio técnico anual sobre la base instalada.&#10;&#10;Tarifa anual de mantención por equipo:&#10;  · Esterilización   50 UF   ($2.043.239)&#10;  · Endoscopía       22 UF   ($898.585)&#10;  · Dental           15 UF   ($612.671)&#10;&#10;Se valorizan sólo los equipos con Potencial ST = Sí, según el filtro del inicio de la hoja.&#10;Los clientes con contrato vigente se marcan como Contrato activo y no suman al total.">Potencial ST Anual<br><span style="font-weight:400;font-size:.55rem">(Mantenimiento BI)</span></th>
      <th style="text-align:right">PIPELINE<br>EQUIPOS</th>
      <th style="text-align:right">POTENCIAL ST<br>GARANTÍAS</th>
      <th style="text-align:right;background:var(--az3)">Σ POTENCIAL<br>EQUIPOS</th>
      <th style="text-align:right;background:var(--az3)">Σ POTENCIAL<br>ST</th>
      <th style="text-align:right;background:var(--az3)">POTENCIAL<br>TOTAL</th>
      <tbody id="tb-bi-cli"></tbody>
      <tfoot><tr id="tfoot-bi-cli" style="background:var(--az3);font-size:.62rem"></tr></tfoot>
    </table>
  </div>

  <div class="card" style="margin-top:.9rem" id="bi-mx-card">
    <div class="ch" style="flex-wrap:wrap;gap:.5rem">
      <span class="ct">Matriz de Prospección · % Vida Útil vs Potencial ST Anual</span>
      <span style="font-size:.56rem;color:var(--mut)" id="bi-mx-lbl">&mdash;</span>
      <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                   margin-left:.6rem">Región</span>
      <select id="bi-mx-reg" onchange="window._biMxReg(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
        border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
      <button id="bi-mx-reset" onclick="window._biMxReset()" title="Volver a la vista completa"
        style="font-size:.57rem;padding:.2rem .55rem;border-radius:3px;cursor:pointer;
               border:1px solid var(--brd);background:var(--bg2);color:var(--mut)">Restablecer zoom</button>
      <button id="bi-mx-pdf" onclick="window._biMxExport()"
        title="Un Excel con una hoja por región: sus diez clientes a visitar, la base instalada y su % de vida útil consumida abiertos por línea, el potencial de mantenimiento y una columna para el plan de acción"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#0F7B3F;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap">Exportar Excel</button>
    </div>
    <div class="cb">
      <div id="bi-mx-box" style="position:relative;height:420px"><canvas id="cBiMatriz"></canvas></div>
      <div id="bi-mx-leg" style="padding:.5rem 0 0;border-top:1px solid var(--brd);margin-top:.5rem"></div>
      <p style="font-size:.57rem;color:var(--mut);margin:.6rem 0 0;line-height:1.55">
        Cada punto es un cliente. El eje horizontal es <strong>cuánto de su vida útil lleva consumido</strong>
        el parque y el vertical el <strong>potencial ST anual de mantenimiento de la base instalada</strong>
        —equipos de Esterilización, Endoscopía y Dental por su tarifa anual, sólo en clientes sin contrato—;
        el tamaño del punto repite ese potencial. No incluye las garantías ni los equipos del pipeline, que son
        venta futura. Las líneas marcan la mediana de cada eje: el
        <strong>cuadrante superior derecho</strong> reúne a los clientes con el parque más desgastado y más
        potencial, que son los que conviene visitar primero.
        El desgaste se mide en proporción y no en años: una turbina dental de 2 años de vida útil con 1,8 encima
        está al 90% y toca renovarla, mientras que un autoclave de 15 años con esos mismos 1,8 va en el 12%.
        Sobre 100% el equipo ya agotó la vida útil esperada.
        Usa la <strong>rueda del mouse para acercar</strong> y arrastra para moverte: cerca del origen los
        puntos se apiñan y el zoom es la forma de separarlos y elegir uno.
        Sólo entran los clientes con equipos que traigan fecha de instalación y cuyo tipo tenga vida útil
        definida; sin las dos cosas no hay eje horizontal donde ubicarlos.
        El <strong>exportable</strong> es un Excel con una hoja por región: sus diez clientes de mayor
        <strong>potencial de mantenimiento</strong>, con la base instalada y su % de vida útil consumida
        abiertos línea por línea, y una columna en blanco para el plan de acción. Sólo mira la base instalada de
        hoy —el pipeline de equipos y las garantías que traería son venta futura, no base instalada—, y
        los clientes sin región no entran porque no hay a quién asignárselos.</p>
    </div>
  </div>

  <div class="card" style="margin-top:.9rem" id="bi-cv-card">
    <div class="ch" style="flex-wrap:wrap;gap:.5rem">
      <span class="ct">Concentración del Potencial ST Anual · Clientes Foco</span>
      <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                   margin-left:.4rem">Región</span>
      <select id="bi-cv-reg" onchange="window._biCvReg(this.value)" style="font-size:.6rem;padding:.2rem .4rem;border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
      <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                   margin-left:.4rem">Cliente</span>
      <select id="bi-cv-cli" onchange="window._biCvCli(this.value)" style="font-size:.6rem;padding:.2rem .4rem;border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);max-width:260px"></select>
      <button onclick="window._biCvReset()" title="Volver a la vista completa"
        style="font-size:.57rem;padding:.2rem .55rem;border-radius:3px;cursor:pointer;
               border:1px solid var(--brd);background:var(--bg2);color:var(--mut)">Restablecer zoom</button>
      <button id="bi-cv-pdf" onclick="exportarPanel({ids:['bi-cv-card'],titulo:'Base Instalada · Concentración del Potencial ST',archivo:'BI_concentracion_potencial',btn:'bi-cv-pdf'})"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap">Exportar</button>
    </div>
    <div class="cb">
      <div id="bi-cv-res" style="font-size:.62rem;color:var(--txt);margin-bottom:.5rem;line-height:1.6"></div>
      <div style="position:relative;height:400px"><canvas id="cBiCurva"></canvas></div>
      <div id="bi-cv-det" style="margin-top:.7rem;padding-top:.5rem;border-top:1px solid var(--brd)"></div>
      <p style="font-size:.57rem;color:var(--mut);margin:.6rem 0 0;line-height:1.55">
        Cada punto es un cliente. Se ordenan de <strong>mayor a menor potencial ST anual</strong> —mantenimiento
        de la base instalada, el mismo de la matriz; sin garantías ni equipos del pipeline— y se van sumando: el eje horizontal es cuántos
        clientes van y el vertical el potencial en MM$ que se lleva acumulado hasta ese cliente. Como el
        primero es el de mayor potencial, la curva <strong>sube empinada</strong> —cada cliente foco agrega mucho— y
        <strong>se va aplanando</strong>: donde se aplana, sumar un cliente más casi no mueve el potencial. Las guías marcan cuántos clientes hacen falta para
        llegar al 50% y al 80% del potencial, y los puntos en azul fuerte son los que componen ese 80%.
        La región se elige arriba y es independiente de la matriz. <strong>Haz clic en un punto</strong> o elige
        un cliente en la lista para ver su ficha: por qué está en el foco, de dónde sale su potencial, el estado
        de su parque y cómo va la relación comercial.
        Como no depende de la vida útil, entran también los clientes que la matriz deja fuera por falta de fecha de
        instalación. Rueda del mouse para acercar la cabeza de la curva.</p>
    </div>
  </div>

  <p id="bi-fac-nota" style="font-size:.6rem;color:var(--mut);margin:.5rem .2rem 0;line-height:1.6"></p>`;

  // KPIs, cards por línea, gráficos y tabla se delegan a _biRefreshDynamic
  // para que reaccionen al filtro Potencial ST
  _biRefreshDynamic();
}

// Helper: agrega región a cada cliente buscando en MAPA_DATA por nombre normalizado
function _biRegionFromClients(clients){
  const mapaArr = typeof MAPA_DATA !== 'undefined' ? MAPA_DATA : [];
  const lookup = {};
  mapaArr.forEach(c => { if(c.nombre) lookup[_biNorm(c.nombre)] = c.region||'Sin región'; });
  function findRegion(nombre){
    const k = _biNorm(nombre);
    if(lookup[k]) return lookup[k];
    const found = Object.keys(lookup).find(mk => mk.length >= 6 && (mk.includes(k)||k.includes(mk)));
    return found ? lookup[found] : 'Sin región';
  }
  const regionMap = {};
  clients.forEach(c => {
    const r = findRegion(c.nombre);
    if(!regionMap[r]) regionMap[r] = {n:0, bi:0};
    regionMap[r].n++;
    regionMap[r].bi += c.total;
  });
  return Object.entries(regionMap).sort((a,b)=>b[1].bi-a[1].bi).slice(0,14);
}
