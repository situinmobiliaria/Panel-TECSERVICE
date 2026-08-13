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
let _biPanelMap={}, _biContratoMap={};

function _biNorm(s){ return s?s.trim().toUpperCase().replace(/\s+/g,' ').normalize('NFD').replace(/[̀-ͯ]/g,''):''; }
function _biLookupPanel(nombre){
  const k=_biNorm(nombre);
  if(_biPanelMap[k]) return _biPanelMap[k];
  // búsqueda parcial (uno contiene al otro, mínimo 8 chars)
  if(k.length>=8){
    const found=Object.keys(_biPanelMap).find(pk=>pk.includes(k)||k.includes(pk));
    if(found) return _biPanelMap[found];
  }
  return null;
}
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

function _biRenderTabla(){
  const list = _biClientesFiltrados();
  const tb = document.getElementById('tb-bi-cli');
  if(!tb) return;

  if(list.length === 0){
    tb.innerHTML = `<tr><td colspan="13" style="text-align:center;color:var(--mut);padding:1.2rem;font-style:italic">Sin resultados para los filtros seleccionados</td></tr>`;
  } else {
    tb.innerHTML = list.map((c,i)=>{
      const p=_biLookupPanel(c.nombre);
      const d=_biLookupContrato(c.nombre);
      const fac2026=p?(mm(p.real_ytd||0)):'—';
      const facContr=p?(mm(p.presup_contr_ytd||0)):'—';
      return `<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
      <td><strong style="font-size:.7rem">${shortN(c.nombre)}</strong></td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;font-weight:700;color:var(--az1)">${_biVal(c,'total').toLocaleString('es-CL')}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--am)">${_biVal(c,'dental')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--az2)">${_biVal(c,'esterilizacion')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--or)">${_biVal(c,'incardia')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--teal)">${_biVal(c,'endoscopia')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:#7B2FBE">${_biVal(c,'mobiliario')||'—'}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--gn)">${_biVal(c,'mmq_reas')||'—'}</td>
      <td>${_biEstadoBadge(c.estado)}</td>
      <td style="text-align:right;color:var(--az1);font-weight:700">${fac2026}</td>
      <td style="text-align:right;color:var(--teal)">${facContr}</td>
      <td style="text-align:right">${_biPotCelda(c,p,d)}</td>
    </tr>`;
    }).join('');
  }

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
    const facTotal = list.reduce((s,c)=>{const p=_biLookupPanel(c.nombre);return s+(p&&p.real_ytd?p.real_ytd:0);},0);
    const conContr = list.filter(c=>{const d=_biLookupContrato(c.nombre);return d&&d.n>0;}).length;
    // Sólo suma el potencial de quienes NO tienen contrato: en los que ya lo
    // tienen no hay nada que capturar.
    const potTotal = list.reduce((s2,c)=>{
      const p2=_biLookupPanel(c.nombre), d2=_biLookupContrato(c.nombre);
      if((d2&&d2.n>0)||(p2&&p2.tiene_contrato)) return s2;
      return s2+_biPotAnual(c);
    },0);
    const st='text-align:right;font-family:\'Roboto Mono\',monospace;color:rgba(255,255,255,.75)';
    foot.innerHTML = `<td colspan="2" style="font-weight:700;font-size:.62rem;color:rgba(255,255,255,.85)">${list.length} clientes · ${conContr} con contrato activo</td>
      <td style="${st};font-weight:700;color:#fff">${tot.toLocaleString('es-CL')}</td>
      <td style="${st}">${dent}</td><td style="${st}">${este}</td>
      <td style="${st}">${inc}</td><td style="${st}">${endo}</td>
      <td style="${st}">${mob}</td><td style="${st}">${mmq}</td>
      <td></td>
      <td style="${st};font-weight:700;color:#FFC000">${mm(facTotal)}</td>
      <td></td>
      <td style="${st};font-weight:700;color:#FFC000" title="Potencial de los clientes sin contrato">${mm(potTotal)}</td>`;
  }
}

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
  const out = [];
  Object.entries(pr).forEach(([r,d])=>{
    const tot = usaSi ? (d.total_si||0) : (d.total||0);
    if(tot <= 0) return;
    const ln = usaSi ? (d.lineas_si||{}) : (d.lineas||{});
    out.push({region:r, total:tot, n_clientes:d.n_clientes||0,
              lineas:Object.entries(ln).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])});
  });
  return out.sort((a,b)=>b.total-a.total);
}

let _biMapL = null, _biMapLyr = null;
function _biRenderMapa(){
  if(!window.L) return;
  const cont = document.getElementById('biMapa');
  if(!cont) return;
  const datos = _biRegData();

  if(!_biMapL){
    _biMapL = L.map('biMapa',{zoomControl:true,scrollWheelZoom:false}).setView([-35.5,-70.5],4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OpenStreetMap © CARTO',maxZoom:18}).addTo(_biMapL);
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
            <td style="padding:.28rem .5rem;text-align:right;font-size:.61rem;color:var(--mut)">${d.n_clientes}</td>
          </tr>`;}).join('')}</tbody>
        <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
          <td style="padding:.32rem .5rem;font-size:.63rem;${SEP}">TOTAL · ${datos.length} regiones</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.65rem;font-variant-numeric:tabular-nums;${SEP}">${totG.toLocaleString('es-CL')}</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.58rem;${SEP}">100%</td>
          ${cols.map(c=>`<td style="padding:.32rem .5rem;text-align:right;font-size:.61rem;
            font-variant-numeric:tabular-nums;${SEP}">${acum[c].toLocaleString('es-CL')}</td>`).join('')}
          <td style="padding:.32rem .5rem;text-align:right;font-size:.61rem">${datos.reduce((s,d)=>s+d.n_clientes,0)}</td>
        </tr></tfoot>
      </table>
    </div>
    <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.4">
      La región se obtiene cruzando el cliente contra BASE MAPA. Los clientes sin coincidencia
      quedan en «Sin región» y no se dibujan en el mapa.</p>`;
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
  _biPanelMap = {};
  (APP_DATA.panel||[]).forEach(p=>{
    const k=_biNorm(p.cliente);
    if(k) _biPanelMap[k]=p;
  });
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
  const facBITotal = clientes.reduce((s,c)=>{ const p=_biLookupPanel(c.nombre); return s+(p&&p.real_ytd?p.real_ytd:0); },0);

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
    <span class="sh-tag">Filtro: <span id="bi-filter-info">Todos</span></span>
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
        <th onclick="biSortCol(9,this)">Estado BI</th>
        <th onclick="biSortCol(10,this)" class="num" style="color:#FFC000">Fac. 2026</th>
        <th class="num">F. Contr.</th>
        <th class="num" style="color:#FFC000" title="Potencial de servicio técnico anual sobre la base instalada.&#10;&#10;Tarifa anual de mantención por equipo:&#10;  · Esterilización   50 UF   ($2.043.239)&#10;  · Endoscopía       22 UF   ($898.585)&#10;  · Dental           15 UF   ($612.671)&#10;&#10;Se valorizan sólo los equipos con Potencial ST = Sí, según el filtro del inicio de la hoja.&#10;Los clientes con contrato vigente se marcan como Contrato activo y no suman al total.">Potencial ST Anual<br><span style="font-weight:400;font-size:.55rem">(Mantenimiento BI)</span></th>
      </tr></thead>
      <tbody id="tb-bi-cli"></tbody>
      <tfoot><tr id="tfoot-bi-cli" style="background:var(--az3);font-size:.62rem"></tr></tfoot>
    </table>
  </div>`;

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
