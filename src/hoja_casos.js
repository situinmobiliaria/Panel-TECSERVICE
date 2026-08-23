// ═══════════════════════════════════════════════════════════════
// hoja_casos.js — Casos Relevantes + Equipos Detenidos
// Fuente: window.CASOS_DATA (hoja "Casos Relevantes" del Excel)
// ═══════════════════════════════════════════════════════════════

// ── INIT ──────────────────────────────────────────────────────────
function initCasos() {
  const wrap = document.getElementById('view-casos');
  if (!wrap || wrap.dataset.init) return;
  wrap.dataset.init = '1';
  wrap.innerHTML = _casosHTML();
  _bindCasosCtrl();
  renderCasos();
}

// ── HTML ESQUELETO ────────────────────────────────────────────────
function _casosHTML() {
  return `
  <div class="sh">
    <h2>Equipos Detenidos · Casos Relevantes</h2>
    <div class="sh-line"></div>
    <span class="sh-tag" id="casos-tag">Información actualizada desde Excel · Hoja "Casos Relevantes"</span>
  </div>

  <!-- KPIs strip -->
  <div class="sumstrip" style="margin-bottom:.75rem">
    <div><div class="ss-v" id="cas-k-casos" style="color:var(--rd2)">—</div><div class="ss-l">Casos abiertos</div></div>
    <div><div class="ss-v" id="cas-k-eq" style="color:var(--am)">—</div><div class="ss-l">Equipos detenidos</div></div>
    <div><div class="ss-v" id="cas-k-gar" style="color:var(--teal)">—</div><div class="ss-l">Con Garantía vigente</div></div>
    <div><div class="ss-v" id="cas-k-sg" style="color:var(--mut)">—</div><div class="ss-l">Sin garantía</div></div>
    <div><div class="ss-v" id="cas-k-contr" style="color:var(--az2)">—</div><div class="ss-l">Con Contrato</div></div>
  </div>

  <!-- Flujo de equipos detenidos por estado -->
  <div class="card" style="margin-bottom:.9rem" id="cas-flujo-card">
    <div class="ch" style="background:linear-gradient(135deg,rgba(51,68,141,.16),rgba(51,68,141,.05));flex-wrap:wrap;gap:.5rem">
      <span class="ct" style="color:var(--az1)">Equipos Detenidos por Estado</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-flujo-sub">&mdash;</span>
      <button id="cas-flujo-pdf" onclick="casosFlujoExportPDF()"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF</button>
    </div>
    <div class="cb" style="padding:.85rem .9rem"><div id="cas-flujo"></div></div>
  </div>

  <!-- Buscador global -->
  <div class="card" style="margin-bottom:.75rem">
    <div class="ctrl" style="gap:.55rem;flex-wrap:wrap">
      <span class="ctrl-lbl">Buscar</span>
      <input type="text" id="cas-search" class="search-inp" placeholder="🔍 Cliente, problema, equipo…"
        style="width:260px;font-size:.65rem;padding:.28rem .55rem" oninput="renderCasos()">
    </div>
  </div>

  <!-- Resumen por Equipo -->
  <div class="card" style="margin-bottom:.9rem" id="cas-eq-card">
    <div class="ch" style="background:linear-gradient(135deg,rgba(255,160,0,.18),rgba(255,160,0,.06));flex-wrap:wrap;gap:.5rem">
      <span class="ct" style="color:var(--am)">Resumen por Equipo</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t3-count">&mdash;</span>
      <button id="cas-eq-pdf" onclick="casosEqExportPDF()"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF</button>
    </div>
    <div class="cb"><div id="cas-eq-tabla"></div></div>
  </div>

  <!-- Tabla 1: Casos Relevantes -->
  <div class="card" style="margin-bottom:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(192,0,0,.18),rgba(192,0,0,.06));flex-wrap:wrap;gap:.5rem">
      <span class="ct" style="color:#000">Casos Relevantes</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t1-count">—</span>
      <div style="display:flex;align-items:center;gap:.45rem;margin-left:auto;flex-wrap:wrap">
        <span class="ctrl-lbl">Coordinador</span>
        <select id="cas-sel-coord" style="font-size:.62rem;border:1px solid var(--brd);border-radius:5px;padding:.25rem .5rem;background:#fff;color:var(--txt);font-family:'Roboto',sans-serif" onchange="renderCasos()">
          <option value="">Todos</option>
        </select>
        <span class="ctrl-lbl" style="margin-left:.3rem">Responsable</span>
        <select id="cas-sel-resp" style="font-size:.62rem;border:1px solid var(--brd);border-radius:5px;padding:.25rem .5rem;background:#fff;color:var(--txt);font-family:'Roboto',sans-serif" onchange="renderCasos()">
          <option value="">Todos</option>
        </select>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table1" style="min-width:1180px;table-layout:fixed">
        <colgroup>
          <col style="width:7%"><col style="width:10%"><col style="width:13%"><col style="width:7%">
          <col style="width:9%"><col style="width:29%"><col style="width:7%"><col style="width:18%">
        </colgroup>
        <thead><tr>
          <th>Coordinador</th>
          <th>Cliente</th>
          <th>Problema</th>
          <th style="text-align:center">Estado</th>
          <th>Responsable</th>
          <th>Comentario</th>
          <th style="text-align:center">Salesforce</th>
          <th>Acciones</th>
        </tr></thead>
        <tbody id="cas-tbody1"></tbody>
      </table>
    </div>
  </div>

  <!-- Tabla 2: Equipos Detenidos -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(255,160,0,.18),rgba(255,160,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--am)">Equipos Detenidos</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t2-count">—</span>
      <div class="btn-g" id="cas-btn-gar" style="margin-left:auto">
        <button class="btn on" data-cgar="todas">Todos</button>
        <button class="btn" data-cgar="vigente">Con Garantía</button>
        <button class="btn" data-cgar="sin">Sin Garantía</button>
      </div>
    </div>
    <div class="ctrl" style="gap:.5rem;flex-wrap:wrap;padding:.5rem .9rem">
      <span class="ctrl-lbl">Marca</span>
      <select id="cas-f-marca" onchange="renderCasos()" class="cas-sel"></select>
      <span class="ctrl-lbl" style="margin-left:.3rem">Estado</span>
      <select id="cas-f-estado" onchange="renderCasos()" class="cas-sel"></select>
      <span class="ctrl-lbl" style="margin-left:.3rem">Coordinadora</span>
      <select id="cas-f-coord" onchange="renderCasos()" class="cas-sel"></select>
      <span class="ctrl-lbl" style="margin-left:.3rem">Tipo de comentario</span>
      <select id="cas-f-tipo" onchange="renderCasos()" class="cas-sel"></select>
      <button onclick="window.casEqLimpiar()" style="font-size:.6rem;padding:.2rem .55rem;border:1px solid var(--brd);
        border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer;margin-left:.3rem">Limpiar</button>
      <span style="font-size:.6rem;color:var(--mut)" id="cas-f-tag"></span>
    </div>
    <style>.cas-sel{font-size:.62rem;border:1px solid var(--brd);border-radius:5px;padding:.22rem .45rem;
      background:#fff;color:var(--txt);font-family:'Roboto',sans-serif;max-width:190px}</style>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table2" style="min-width:1950px">
        <thead><tr>
          <th style="min-width:120px">Modelo</th>
          <th style="min-width:200px">Nombre Activo</th>
          <th style="min-width:110px">N° Serie</th>
          <th style="min-width:90px">Marca</th>
          <th style="min-width:100px">Estado</th>
          <th style="min-width:110px">Coordinadora</th>
          <th style="min-width:150px">Tipo de Comentario</th>
          <th style="min-width:260px">Comentario Coordinadora</th>
          <th style="min-width:90px">N° Contrato</th>
          <th style="min-width:120px">Estado Garantía</th>
          <th style="min-width:200px">Nombre Cliente</th>
          <th style="min-width:110px">Neta Mes</th>
          <th style="min-width:115px">Fact. Anual Esp.</th>
          <th style="min-width:115px">Fact. a la Fecha</th>
          <th style="min-width:90px">Inicio</th>
          <th style="min-width:90px">Término</th>
        </tr></thead>
        <tbody id="cas-tbody2"></tbody>
      </table>
    </div>
    <div style="padding:.4rem .9rem;background:var(--gy);border-top:1px solid var(--brd);font-size:.58rem;color:var(--mut)" id="cas-nota">—</div>
  </div>

`;
}

// ── CATEGORÍA DE COMENTARIO ───────────────────────────────────────
// La hoja trae dos columnas: P es texto libre de la coordinadora y Q la
// versión categorizada. El resumen usa Q, unificando las dos variantes
// que sólo difieren en redacción.
// Etiquetas canónicas de la columna «Comentario Coordinadora 2». Sólo unifica
// diferencias de tildes o mayúsculas: los estados que la hoja distingue se
// respetan tal cual, porque «en reparación» y «en espera de reparación» —o
// «en diagnóstico» y «en espera de diagnóstico»— no son lo mismo.
const _CAT_CANON = [
  'EN ESPERA DE OC', 'EN ESPERA DE REPUESTOS', 'EN ESPERA DE DIAGNÓSTICO',
  'EN ESPERA DE REPARACIÓN', 'EN ESPERA DE LIMPIEZA', 'EN DIAGNÓSTICO',
  'EN REPARACIÓN', 'SINIESTRADO', 'SIN RESPUESTA', 'SIN USO', 'OTROS',
];
const _catKey = t => String(t || '').trim().toUpperCase()
  .replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const _CAT_NORM = {};
_CAT_CANON.forEach(c => { _CAT_NORM[_catKey(c)] = c; });

// Espera → rojizos (el equipo depende de un tercero); en curso → azules;
// fuera de servicio → morados.
const _CAT_COLOR = {
  'EN ESPERA DE OC':          '#C00000',
  'EN ESPERA DE REPUESTOS':   '#D46000',
  'EN ESPERA DE DIAGNÓSTICO': '#8B8200',
  'EN ESPERA DE REPARACIÓN':  '#B8860B',
  'EN ESPERA DE LIMPIEZA':    '#9C7A00',
  'EN DIAGNÓSTICO':           '#0A7D74',
  'EN REPARACIÓN':            '#0A5C8C',
  'SINIESTRADO':              '#7A1FAA',
  'SIN RESPUESTA':            '#9C3D54',
  'SIN USO':                  '#4A6FA5',
  'OTROS':                    '#6B7BA8',
};
function _catComentario(e) {
  const raw = (e.comentario_cat || e.comentario_coord || '').trim();
  if (!raw) return 'SIN COMENTARIO';
  return _CAT_NORM[_catKey(raw)] || raw.toUpperCase();
}
// Alguna fila trae en la columna de categoría el comentario largo en vez de
// una categoría; se recorta para que no reviente la tabla y el texto completo
// queda en el tooltip.
function _catCorto(k) {
  return k.length > 46 ? k.slice(0, 45) + '…' : k;
}

// ── FLUJO DE EQUIPOS DETENIDOS POR ESTADO ─────────────────────────
// Replica el esquema de chevrones del reporte: una etapa por estado de la
// columna «Comentario Coordinadora 2». Los estados de detalle que la hoja
// distingue pero que no son parte del flujo principal (siniestrado, sin uso,
// en espera de limpieza…) caen en «Otros», así que si mañana aparece un
// estado nuevo entra ahí solo, sin romper el esquema.
const _FLUJO = [
  { k: 'En Diagnóstico',        cats: ['EN DIAGNÓSTICO'],           col: '#C7CEEA' },
  { k: 'Espera de Diagnóstico', cats: ['EN ESPERA DE DIAGNÓSTICO'], col: '#A7B3E0' },
  { k: 'Espera OC',             cats: ['EN ESPERA DE OC'],          col: '#6B7BC4' },
  { k: 'Espera Repuestos',      cats: ['EN ESPERA DE REPUESTOS'],   col: '#2C3E9E' },
  { k: 'En Reparación',         cats: ['EN REPARACIÓN'],            col: '#1B2A6B' },
  { k: 'Otros',                 cats: null,                         col: '#111827' },
];
function _flujoEtapa(cat) {
  for (let i = 0; i < _FLUJO.length - 1; i++) {
    if (_FLUJO[i].cats.indexOf(cat) >= 0) return _FLUJO[i].k;
  }
  return 'Otros';
}

// Agrega los equipos por etapa. La facturación se acumula por contrato
// distinto: varios equipos detenidos suelen compartir el mismo contrato.
function _flujoDatos(equipos) {
  const et = {};
  _FLUJO.forEach(f => { et[f.k] = { eq: 0, cli: {}, ctr: {}, coment: [], mod: {} }; });
  const ctrGlobal = {};
  const cliGlobal = {};
  const modGlobal = {};
  equipos.forEach(e => {
    const k = _flujoEtapa(_catComentario(e));
    const d = et[k];
    d.eq++;
    const marca = _normMarca(e.marca);
    const modKey = marca + ' ' + _familiaModelo(marca, e.modelo);
    d.mod[modKey] = (d.mod[modKey] || 0) + 1;
    modGlobal[modKey] = (modGlobal[modKey] || 0) + 1;
    const cli = (e.nombre_cliente || '').trim();
    if (cli) {
      const c = d.cli[cli] || (d.cli[cli] = { eq: 0, ctr: {} });
      c.eq++;
      if (e.contrato_num) c.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
      const cg = cliGlobal[cli] || (cliGlobal[cli] = { eq: 0, ctr: {} });
      cg.eq++;
      if (e.contrato_num) cg.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
    }
    if (e.contrato_num) {
      d.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
      ctrGlobal[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
    }
    const txt = (e.comentario_coord || '').trim();
    if (txt && d.coment.indexOf(txt) < 0) d.coment.push(txt);
  });
  const suma = (o, i) => Object.keys(o).reduce((a, k) => a + o[k][i], 0);
  const totYtd = suma(ctrGlobal, 1) || 1;
  Object.keys(cliGlobal).forEach(c => { cliGlobal[c].ytd = suma(cliGlobal[c].ctr, 1); });
  _FLUJO.forEach(f => {
    const d = et[f.k];
    d.anual = suma(d.ctr, 0);
    d.ytd   = suma(d.ctr, 1);
    d.nCli  = Object.keys(d.cli).length;
    d.nCtr  = Object.keys(d.ctr).length;
    d.top   = Object.keys(d.cli).map(c => ({
        cliente: c, eq: d.cli[c].eq,
        pct: (cliGlobal[c].ytd || 0) / totYtd * 100,
      })).sort((a, b) => b.eq - a.eq || b.pct - a.pct);
    // Los 2 equipos (marca + familia) más frecuentes de la etapa, y qué
    // parte de los equipos detenidos en esa etapa concentran entre los dos.
    d.topMod = Object.keys(d.mod).map(m => ({ modelo: m, eq: d.mod[m] }))
      .sort((a, b) => b.eq - a.eq).slice(0, 2);
    d.topModPct = d.eq ? (d.topMod.reduce((a, m) => a + m.eq, 0) / d.eq * 100) : 0;
  });
  const nEqTot = equipos.length;
  // Top 3 clientes y top 3 equipos (marca + familia) del total, sin
  // segmentar por etapa: para la tarjeta "Total" que resume todo el flujo.
  const topCliGlobal = Object.keys(cliGlobal).map(c => ({
      cliente: c, eq: cliGlobal[c].eq, pct: (cliGlobal[c].ytd || 0) / totYtd * 100,
    })).sort((a, b) => b.eq - a.eq || b.pct - a.pct).slice(0, 3);
  const topModGlobal = Object.keys(modGlobal).map(m => ({ modelo: m, eq: modGlobal[m] }))
    .sort((a, b) => b.eq - a.eq).slice(0, 3)
    .map(m => Object.assign(m, { pct: nEqTot ? m.eq / nEqTot * 100 : 0 }));
  return { et: et, totCtr: ctrGlobal, totCli: cliGlobal,
           anual: suma(ctrGlobal, 0), ytd: suma(ctrGlobal, 1),
           topCliGlobal: topCliGlobal, topModGlobal: topModGlobal };
}

function _renderCasosFlujo(equipos) {
  const box = document.getElementById('cas-flujo');
  if (!box) return;
  const D = _flujoDatos(equipos);
  const nEq = equipos.length;
  const nCli = Object.keys(D.totCli).length;
  const sumaEt = _FLUJO.reduce((a, f) => a + D.et[f.k].nCli, 0);
  const facPanel = ((window.APP_DATA || {}).fact_clientes || [])
    .reduce((a, c) => a + (c.real || 0), 0);
  const pctPanel = facPanel ? D.ytd / facPanel * 100 : 0;

  // Chevron: punta a la derecha salvo en la última etapa
  const chev = (f, i) => {
    const ult = i === _FLUJO.length - 1;
    const claro = i < 2;
    return '<div style="flex:1;min-width:0;background:' + f.col +
      ';color:' + (claro ? '#1B2A6B' : '#fff') + ';font-size:.63rem;font-weight:700;text-align:center;' +
      'padding:.4rem .5rem .4rem ' + (i ? '1.1rem' : '.6rem') + ';white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis;clip-path:polygon(0 0,' + (ult ? '100% 0,100% 50%,100% 100%' : 'calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%') +
      ',0 100%' + (i ? ',14px 50%' : '') + ')">' + f.k + '</div>';
  };

  const tarjeta = f => {
    const d = D.et[f.k];
    const li = (t, v, col) => '<li style="margin-bottom:.28rem;line-height:1.45"><span style="color:var(--mut)">' +
      t + ':</span> <strong style="color:' + (col || 'var(--txt)') + '">' + v + '</strong></li>';
    const top = d.top.slice(0, 3).map(c =>
      '<div style="margin:.12rem 0 0 .55rem;font-size:.6rem;line-height:1.4">• ' + _escH(c.cliente) +
      ' <span style="color:var(--mut)">(' + c.eq + ' eq · ' + c.pct.toFixed(0) + '% fact.)</span></div>'
    ).join('') || '<div style="margin-left:.55rem;color:var(--mut);font-size:.6rem">—</div>';
    const com = d.coment.slice(0, 2).map(t =>
      '<div style="margin:.12rem 0 0 .55rem;font-size:.57rem;color:var(--mut);line-height:1.4">• ' +
      _escH(t.length > 90 ? t.slice(0, 88) + '…' : t) + '</div>').join('') ||
      '<div style="margin-left:.55rem;color:var(--mut);font-size:.6rem">—</div>';
    // Métricas de concentración de la etapa: qué peso tiene sobre el total
    // de equipos detenidos, sobre los clientes afectados y sobre la
    // facturación total del panel, más los 2 equipos que más pesan en ella.
    const pctEqEt  = nEq  ? (d.eq   / nEq  * 100) : 0;
    const pctCliEt = nCli ? (d.nCli / nCli * 100) : 0;
    const pctFacEt = facPanel ? (d.ytd / facPanel * 100) : 0;
    const topMod = d.topMod.map(m =>
      '<div style="margin:.12rem 0 0 .55rem;font-size:.6rem;line-height:1.4">• ' + _escH(m.modelo) +
      ' <span style="color:var(--mut)">(' + m.eq + ' eq)</span></div>'
    ).join('') || '<div style="margin-left:.55rem;color:var(--mut);font-size:.6rem">—</div>';
    return '<div style="flex:1 1 190px;min-width:190px;border:1px solid ' + f.col + ';border-top:3px solid ' + f.col +
      ';border-radius:5px;padding:.55rem .6rem;background:var(--wh)">' +
      '<ul style="list-style:none;margin:0;padding:0;font-size:.63rem">' +
        li('N° Equipos', d.eq, f.col) +
        li('N° Clientes', d.nCli) +
        li('Fact. anual esperada', mm(d.anual), 'var(--az1)') +
        li('Fact. a la fecha', mm(d.ytd), 'var(--teal)') +
      '</ul>' +
      '<div style="font-size:.6rem;color:var(--mut);margin-top:.35rem">Clientes más importantes</div>' + top +
      '<div style="font-size:.6rem;color:var(--mut);margin-top:.35rem">Comentario</div>' + com +
      '<div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed ' + f.col + '55">' +
        '<ul style="list-style:none;margin:0;padding:0;font-size:.6rem">' +
          li('% de equipos detenidos', pctEqEt.toFixed(0) + '%', f.col) +
          li('% de clientes afectados', pctCliEt.toFixed(0) + '%') +
          li('% de facturación total concentrada', pctFacEt.toFixed(0) + '%', 'var(--teal)') +
        '</ul>' +
        '<div style="font-size:.6rem;color:var(--mut);margin-top:.3rem">Equipos más relevantes</div>' + topMod +
        (d.eq ? '<div style="margin:.15rem 0 0 .55rem;font-size:.58rem;color:var(--mut)">Concentran el ' +
          d.topModPct.toFixed(0) + '% de los equipos de esta etapa</div>' : '') +
      '</div>' +
      '</div>';
  };

  // Tarjeta "Total": resume el flujo completo, sin segmentar por etapa —
  // total de equipos y clientes, los clientes y los equipos (marca+familia)
  // que más pesan en el total, y qué % de los clientes cae en cada etapa.
  const tarjetaTotal = () => {
    const li = (t, v, col) => '<li style="margin-bottom:.28rem;line-height:1.45"><span style="color:var(--mut)">' +
      t + ':</span> <strong style="color:' + (col || 'var(--txt)') + '">' + v + '</strong></li>';
    const topCli = D.topCliGlobal.map(c =>
      '<div style="margin:.12rem 0 0 .55rem;font-size:.6rem;line-height:1.4">• ' + _escH(c.cliente) +
      ' <span style="color:var(--mut)">(' + c.eq + ' eq · ' + c.pct.toFixed(0) + '% fact.)</span></div>'
    ).join('') || '<div style="margin-left:.55rem;color:var(--mut);font-size:.6rem">—</div>';
    const topMod = D.topModGlobal.map(m =>
      '<div style="margin:.12rem 0 0 .55rem;font-size:.6rem;line-height:1.4">• ' + _escH(m.modelo) +
      ' <span style="color:var(--mut)">(' + m.eq + ' eq · ' + m.pct.toFixed(0) + '%)</span></div>'
    ).join('') || '<div style="margin-left:.55rem;color:var(--mut);font-size:.6rem">—</div>';
    const porEtapa = _FLUJO.map(f => {
      const d = D.et[f.k];
      const pct = nCli ? (d.nCli / nCli * 100) : 0;
      return '<div style="display:flex;justify-content:space-between;gap:.4rem;margin-top:.15rem;font-size:.6rem">' +
        '<span style="color:var(--mut)">' + f.k + '</span><strong style="color:' + f.col + '">' +
        pct.toFixed(0) + '%</strong></div>';
    }).join('');
    return '<div style="flex:1.15 1 210px;min-width:210px;border:1px solid #111827;border-top:3px solid #111827;' +
      'border-radius:5px;padding:.55rem .6rem;background:var(--wh)">' +
      '<div style="font-size:.63rem;font-weight:700;color:#111827;letter-spacing:.04em;margin-bottom:.35rem">TOTAL</div>' +
      '<ul style="list-style:none;margin:0;padding:0;font-size:.63rem">' +
        li('N° Equipos', nEq, '#111827') +
        li('N° Clientes', nCli) +
        li('% de facturación total', pctPanel.toFixed(0) + '%', 'var(--teal)') +
        li('Fact. anual esperada', mm(D.anual), 'var(--az1)') +
        li('Fact. a la fecha', mm(D.ytd), 'var(--teal)') +
      '</ul>' +
      '<div style="font-size:.6rem;color:var(--mut);margin-top:.35rem">Clientes más importantes</div>' + topCli +
      '<div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed #11182755">' +
        '<div style="font-size:.6rem;color:var(--mut);margin-bottom:.1rem">% de clientes por etapa</div>' + porEtapa +
      '</div>' +
      '<div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed #11182755">' +
        '<div style="font-size:.6rem;color:var(--mut)">Equipos con más problemas (top 3)</div>' + topMod +
      '</div>' +
      '</div>';
  };

  box.innerHTML =
    '<div style="display:flex;gap:3px;margin-bottom:.5rem">' + _FLUJO.map(chev).join('') + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:stretch">' + _FLUJO.map(tarjeta).join('') + tarjetaTotal() + '</div>' +
    '<div style="margin-top:.7rem;padding:.55rem .8rem;background:rgba(40,210,195,.09);border-left:3px solid var(--teal);' +
      'border-radius:4px;font-size:.63rem;line-height:1.6">' +
      '<div>• Total <strong>' + nEq + ' equipos detenidos</strong>, en <strong>' + nCli +
        ' clientes</strong>, que representan un <strong>' + pctPanel.toFixed(0) +
        '%</strong> de la facturación total del año.</div>' +
      '<div>• Facturación real a la fecha de esos clientes <strong>' + mm(D.ytd) +
        '</strong> vs. esperada <strong>' + mm(D.anual) + '</strong>.</div>' +
      (sumaEt > nCli ? '<div style="color:var(--mut);font-size:.6rem;margin-top:.15rem">' +
        'Los clientes de cada etapa suman ' + sumaEt + ' porque ' + (sumaEt - nCli) +
        ' aparece' + (sumaEt - nCli > 1 ? 'n' : '') + ' en más de una etapa; el total sin repetir es ' +
        nCli + '.</div>' : '') +
    '</div>';

  const sub = document.getElementById('cas-flujo-sub');
  if (sub) sub.textContent = nEq + ' equipos · ' + nCli + ' clientes · ' +
    Object.keys(D.totCtr).length + ' contratos';
}

// ── EXPORTAR EL FLUJO A PDF ───────────────────────────────────────
async function casosFlujoExportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('cas-flujo-pdf');
  const ICON = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  let wrap = null;
  try {
    const src = document.getElementById('cas-flujo');
    if (!src) throw new Error('No se encontró el contenido');
    const hoy = (window.APP_DATA || {}).hoy || '';
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1400px;' +
      'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    const enc = document.createElement('div');
    enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
    enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
      'TECSERVICE — Equipos Detenidos por Estado</span>' +
      (hoy ? '&emsp;<span style="font-size:10px;color:#555">Datos al ' + hoy + '</span>' : '');
    wrap.appendChild(enc);
    const cl = src.cloneNode(true);
    cl.querySelectorAll('*').forEach(n => {
      n.style.position = 'static'; n.style.maxHeight = 'none'; n.style.overflow = 'visible';
    });
    wrap.appendChild(cl);
    document.body.appendChild(wrap);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const realW = Math.ceil(wrap.getBoundingClientRect().width)  || wrap.offsetWidth;
    const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
    if (!realW || !realH) throw new Error('No se pudo medir el contenido');
    const canvas = await html2canvas(wrap, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const { jsPDF } = window.jspdf;
    const MM_PX = 25.4 / 96;
    const pw = realW * MM_PX, ph = realH * MM_PX;
    const pdf = new jsPDF({ orientation: pw >= ph ? 'landscape' : 'portrait', unit: 'mm', format: [pw, ph] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pw, ph);
    pdf.save('Equipos_Detenidos_TS_' + (hoy || '').replace(/[\s/]+/g, '-') + '.pdf');
  } catch (err) {
    console.error('casosFlujoExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
  }
}

// ── BIND CONTROLES ────────────────────────────────────────────────
function _bindCasosCtrl() {
  document.querySelectorAll('#cas-btn-gar .btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#cas-btn-gar .btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    renderCasos();
  }));
}

function _casGarFilter() {
  const active = document.querySelector('#cas-btn-gar .btn.on');
  return active ? active.dataset.cgar : 'todas';
}

// ── POBLAR SELECTS DINÁMICOS ──────────────────────────────────────
function _poblarSelect(id, valores) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const current = sel.value;
  // Solo rebuild si cambiaron las opciones
  const opts = ['<option value="">Todos</option>',
    ...valores.map(v => `<option value="${_escH(v)}"${current===v?' selected':''}>${_escH(v)}</option>`)
  ].join('');
  if (sel.innerHTML !== opts) sel.innerHTML = opts;
}

// ── NORMALIZACIÓN MARCA / FAMILIA DE EQUIPO ────────────────────────
// Corrige duplicados de marca por errores de tipeo o nombres alternos
// del mismo fabricante, y agrupa variantes de un mismo equipo bajo
// una única "familia" (ej: DS610, DS610-1SL-2S, DS610/2SL → DS610).
const _MARCA_NORM = {
  'STELLCO':    'STEELCO',      // typo: falta una L de menos / letra de más
  'DDC':        'DDC DOLPHIN',  // mismo fabricante, nombre abreviado
  'DOLPHIN':    'DDC DOLPHIN',  // mismo fabricante, nombre abreviado
  'CLINICLAVE': 'MELAG'         // Cliniclave es una línea de esterilizadores MELAG
};

const _FAMILIA_NORM = {
  'STEELCO': {
    'AD 400/1': 'AD 400/1', 'AD400/1': 'AD 400/1',
    'DS1000': 'DS1000',
    'DS500': 'DS500', 'DS500 CL': 'DS500',
    'DS5000SCL': 'DS5000SCL',
    'DS610': 'DS610', 'DS610 - 1SL-2S': 'DS610', 'DS610 - 2SL-2S': 'DS610',
    'DS610-1SL-2S': 'DS610', 'DS610-2SL-SL': 'DS610', 'DS610/1SL/2S': 'DS610', 'DS610/2 SL': 'DS610',
    'LVS 2 C/2 EDX 2P': 'LVS 2', 'LVS 2C/2': 'LVS 2',
    'US100': 'US100', 'US80': 'US80',
    'VS 4/2': 'VS 4', 'VS 8/1': 'VS 8', 'VS 8/2': 'VS 8', 'VS6/2': 'VS 6'
  },
  'BIEN AIR': {
    'CHIROPRO PLUS': 'CHIROPRO PLUS', 'CHIROPRO PLUS 3G': 'CHIROPRO PLUS',
    'MC MX-i': 'MX-i', 'MX-I PLUS': 'MX-i',
    'PUNTA RECTA': 'PUNTA RECTA'
  },
  'MELAG': {
    '45M': '45M', 'C45': 'C45',
    'MELAQUICK 12+P': 'MELAQUICK 12+P',
    'MELASEAL': 'MELASEAL', 'MELASEAL PRO': 'MELASEAL'
  },
  'DDC DOLPHIN': {
    'DOLPHIN PULMATIC': 'PULMATIC', 'PULMATIC': 'PULMATIC'
  }
};

function _normMarca(marca) {
  // Se devuelve siempre en mayúsculas: el Excel trae MELAG y Melag, o
  // PURYTAS y Purytas, y sin unificar la caja salen como marcas distintas.
  const m = (marca || '').trim().toUpperCase();
  return _MARCA_NORM[m] || m || 'Sin marca';
}

function _familiaModelo(marcaNorm, modelo) {
  const mod = (modelo || '').trim();
  const tabla = _FAMILIA_NORM[marcaNorm];
  if (tabla) {
    const key = Object.keys(tabla).find(k => k.toUpperCase() === mod.toUpperCase());
    if (key) return tabla[key];
  }
  return mod || 'Sin modelo';
}

// ── RENDER ────────────────────────────────────────────────────────
function renderCasos() {
  if (typeof CASOS_DATA === 'undefined') return;

  const busq      = (document.getElementById('cas-search')?.value || '').toLowerCase().trim();
  const garF      = _casGarFilter();
  const coordF    = document.getElementById('cas-sel-coord')?.value || '';
  const respF     = document.getElementById('cas-sel-resp')?.value  || '';

  const casos   = CASOS_DATA.casos   || [];
  const equipos = CASOS_DATA.equipos || [];

  // Poblar selects con valores únicos (no vacíos)
  const coords = [...new Set(casos.map(c => c.coordinador).filter(Boolean))].sort();
  const resps  = [...new Set(casos.map(c => c.responsable).filter(v => v && v.toLowerCase() !== 'no definido' && v.toLowerCase() !== 'no defindo'))].sort();
  _poblarSelect('cas-sel-coord', coords);
  _poblarSelect('cas-sel-resp',  resps);

  // ── Tabla 1: Casos Relevantes ─────────────────────────────────
  const casosFilt = casos.filter(c => {
    if (coordF && c.coordinador !== coordF) return false;
    if (respF  && c.responsable !== respF)  return false;
    if (!busq) return true;
    return (c.cliente + c.problema + c.comentario + c.coordinador + c.responsable +
            (c.estado || '') + (c.acciones || ''))
      .toLowerCase().includes(busq);
  });

  const tbody1 = document.getElementById('cas-tbody1');
  if (tbody1) {
    tbody1.innerHTML = casosFilt.map(c => {
      const sfLink = c.salesforce
        ? `<span class="pill pte" style="font-size:.52rem;font-family:'Roboto Mono',monospace">${_escH(c.salesforce)}</span>`
        : '<span style="color:var(--mut);font-size:.6rem">—</span>';
      const est = (c.estado || '').trim().toUpperCase();
      const eCol = est.indexOf('NO OPER') >= 0 ? 'var(--rd)'
                 : est.indexOf('OPERATIVO') >= 0 ? 'var(--gn)' : 'var(--mut)';
      const estBadge = est
        ? `<span style="background:${eCol}1A;color:${eCol};border:1px solid ${eCol}55;padding:.08rem .35rem;
             border-radius:3px;font-size:.55rem;font-weight:700;white-space:nowrap">${_escH(c.estado)}</span>`
        : '<span style="color:var(--mut);font-size:.6rem">—</span>';
      return `<tr>
        <td><span style="font-size:.62rem;font-weight:600;color:var(--az3)">${_escH(c.coordinador)||'<span style="color:var(--mut)">—</span>'}</span></td>
        <td><strong style="font-size:.64rem;line-height:1.35">${_escH(c.cliente)}</strong></td>
        <td>
          <div style="font-size:.62rem;font-weight:700;color:#e00000;line-height:1.4">${_escH(c.problema)}</div>
        </td>
        <td style="text-align:center">${estBadge}</td>
        <td><span style="font-size:.62rem">${_escH(c.responsable)||'<span style="color:var(--mut)">No definido</span>'}</span></td>
        <td>
          <div style="font-size:.61rem;line-height:1.5;color:#111;font-weight:600;text-transform:uppercase">
            ${_escH(c.comentario)||'<span style="color:var(--mut);text-transform:none;font-weight:400">Sin comentario</span>'}
          </div>
        </td>
        <td>${sfLink}</td>
        <td>
          <div style="font-size:.61rem;line-height:1.5;color:var(--az1)">
            ${_escH(c.acciones)||'<span style="color:var(--mut)">—</span>'}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  const t1count = document.getElementById('cas-t1-count');
  if (t1count) t1count.textContent = casosFilt.length + ' caso' + (casosFilt.length !== 1 ? 's' : '');

  // ── Tabla 2: Equipos Detenidos ────────────────────────────────
  // Segmentadores de la tabla de equipos. Igual que el de garantía y el
  // buscador, alcanzan a todo el bloque: dibujo, resumen y detalle.
  const _sel = id => { const e = document.getElementById(id); return e ? e.value : ''; };
  const fMarca = _sel('cas-f-marca'), fEstado = _sel('cas-f-estado');
  const fCoord = _sel('cas-f-coord'), fTipo   = _sel('cas-f-tipo');
  _poblarSelect('cas-f-marca',  [...new Set(equipos.map(e => _normMarca(e.marca)).filter(Boolean))].sort());
  _poblarSelect('cas-f-estado', [...new Set(equipos.map(e => (e.estado || '').trim()).filter(Boolean))].sort());
  _poblarSelect('cas-f-coord',  [...new Set(equipos.map(e => (e.coordinadora || '').trim()).filter(Boolean))].sort());
  _poblarSelect('cas-f-tipo',   [...new Set(equipos.map(e => _catComentario(e)).filter(Boolean))].sort());

  const eqFilt = equipos.filter(e => {
    const garOk = garF === 'todas'
      ? true
      : garF === 'vigente'
        ? e.garantia.toUpperCase().includes('VIGENTE')
        : !e.garantia.toUpperCase().includes('VIGENTE');
    if (!garOk) return false;
    if (fMarca  && _normMarca(e.marca) !== fMarca) return false;
    if (fEstado && (e.estado || '').trim() !== fEstado) return false;
    if (fCoord  && (e.coordinadora || '').trim() !== fCoord) return false;
    if (fTipo   && _catComentario(e) !== fTipo) return false;
    if (!busq) return true;
    return (e.modelo + e.nombre + e.serie + e.marca + e.coordinadora +
            e.comentario_coord + (e.comentario_cat || '') + e.comentario_mat + (e.nombre_cliente || ''))
      .toLowerCase().includes(busq);
  });

  const tbody2 = document.getElementById('cas-tbody2');
  if (tbody2) {
    const _fmtM = v => v > 0 ? 'MM$' + fN1(v / 1e6) : '—';
    const _dash = '<span style="color:var(--mut);font-size:.6rem">—</span>';
    const _mono = s => s ? `<span style="font-size:.6rem;font-family:'Roboto Mono',monospace">${_escH(s)}</span>` : _dash;
    tbody2.innerHTML = eqFilt.map(e => {
      const garVigente = e.garantia.toUpperCase().includes('VIGENTE');
      const garBadge = garVigente
        ? `<span class="badge bte" style="font-size:.52rem">${_escH(e.garantia)}</span>`
        : `<span class="badge bgy" style="font-size:.52rem">${_escH(e.garantia)||'—'}</span>`;
      const estadoBadge = e.estado.toUpperCase().includes('NO OPER')
        ? `<span class="badge brd2" style="font-size:.52rem">No Operativo</span>`
        : `<span class="badge bgy" style="font-size:.52rem">${_escH(e.estado)}</span>`;
      const sinContrato = !e.contrato_num;
      const _noContr = `<span style="font-size:.57rem;color:var(--mut);font-style:italic">NO ASOCIADO A CONTRATO</span>`;
      const contrNum = sinContrato ? _noContr
        : `<span class="pill pte" style="font-size:.52rem;font-family:'Roboto Mono',monospace">${_escH(e.contrato_num)}</span>`;
      const clienteCell = sinContrato ? _noContr
        : e.nombre_cliente ? `<strong style="font-size:.62rem">${_escH(e.nombre_cliente)}</strong>` : _dash;
      const netaCell = sinContrato ? _noContr
        : e.neta_mes > 0 ? `<span style="font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM(e.neta_mes)}</span>` : _dash;
      const facAnualCell = sinContrato ? _noContr
        : e.fac_anual > 0 ? `<span style="font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM(e.fac_anual)}</span>` : _dash;
      const facYtdCell = sinContrato ? _noContr
        : e.fac_ytd > 0 ? `<span style="font-size:.63rem;font-weight:700;color:var(--teal)">${_fmtM(e.fac_ytd)}</span>` : _dash;
      const inicioCell = sinContrato ? _noContr : _mono(e.fecha_inicio);
      const finCell    = sinContrato ? _noContr : _mono(e.fecha_fin);
      return `<tr>
        <td><strong style="font-size:.63rem;color:var(--am)">${_escH(e.modelo)}</strong></td>
        <td><span style="font-size:.63rem">${_escH(e.nombre)}</span></td>
        <td><span style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${_escH(e.serie)||'—'}</span></td>
        <td><span style="font-size:.62rem">${_escH(e.marca)}</span></td>
        <td style="text-align:center">${estadoBadge}</td>
        <td><span style="font-size:.62rem;color:var(--az3)">${_escH(e.coordinadora)||'—'}</span></td>
        <td style="text-align:center">${(() => {
          const k = _catComentario(e), col = _CAT_COLOR[k] || '#6B7BA8';
          return `<span title="${_escH(k)}" style="background:${col}1A;color:${col};border:1px solid ${col}55;
                    padding:.08rem .35rem;border-radius:3px;font-size:.53rem;font-weight:700;
                    white-space:nowrap">${_escH(_catCorto(k))}</span>`;
        })()}</td>
        <td><div style="font-size:.6rem;line-height:1.5;max-width:280px;color:#111;font-weight:600">${_escH(e.comentario_coord)||_dash}</div></td>
        <td style="text-align:center">${contrNum}</td>
        <td style="text-align:center">${garBadge}</td>
        <td>${clienteCell}</td>
        <td style="text-align:right">${netaCell}</td>
        <td style="text-align:right">${facAnualCell}</td>
        <td style="text-align:right">${facYtdCell}</td>
        <td style="text-align:center">${inicioCell}</td>
        <td style="text-align:center">${finCell}</td>
      </tr>`;
    }).join('');
  }

  _renderCasosFlujo(eqFilt);
  _renderCasosEquipos(eqFilt);

  // KPIs
  const totGar   = equipos.filter(e => e.garantia.toUpperCase().includes('VIGENTE')).length;
  const totSG    = equipos.filter(e => !e.garantia.toUpperCase().includes('VIGENTE')).length;
  const totContr = equipos.filter(e => e.contrato_num && e.contrato_num !== '').length;

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('cas-k-casos', casos.length);
  s('cas-k-eq',    equipos.length);
  s('cas-k-gar',   totGar);
  s('cas-k-sg',    totSG);
  s('cas-k-contr', totContr);

  const t2count = document.getElementById('cas-t2-count');
  if (t2count) t2count.textContent = eqFilt.length + ' equipo' + (eqFilt.length !== 1 ? 's' : '');

  const nAct = [fMarca, fEstado, fCoord, fTipo].filter(Boolean).length +
               (garF !== 'todas' ? 1 : 0) + (busq ? 1 : 0);
  const fTag = document.getElementById('cas-f-tag');
  if (fTag) fTag.textContent = nAct
    ? nAct + ' filtro' + (nAct > 1 ? 's' : '') + ' activo' + (nAct > 1 ? 's' : '') +
      ' · ' + eqFilt.length + ' de ' + equipos.length + ' equipos'
    : '';

  const nota = document.getElementById('cas-nota');
  if (nota) nota.textContent =
    `${eqFilt.length} equipos detenidos · ${totGar} con garantía vigente · ${totSG} sin garantía · datos desde Excel`;

  const tag = document.getElementById('casos-tag');
  if (tag) tag.textContent =
    `${casos.length} casos abiertos · ${equipos.length} equipos detenidos · actualizado al correr el extractor`;
}

// ── RESUMEN POR EQUIPO ────────────────────────────────────────────
// Una fila por marca y familia de equipo. Al abrirla se ven los clientes
// que tienen ese equipo detenido y cuánto pesan en la facturación del año:
// el % se calcula sobre el total facturado por todos los clientes, el mismo
// número del Resumen del panel.
let _casEqOpen = new Set();
window.casEqTog = function (k) {
  if (_casEqOpen.has(k)) _casEqOpen.delete(k); else _casEqOpen.add(k);
  _renderCasosEquipos(window._casEqUlt || []);
};
window.casEqTodos = function (abrir) {
  _casEqOpen = new Set();
  if (abrir) (window._casEqUlt || []).forEach(e =>
    _casEqOpen.add(_normMarca(e.marca) + '||' + _familiaModelo(_normMarca(e.marca), e.modelo)));
  _renderCasosEquipos(window._casEqUlt || []);
};

function _casEqDatos(equipos) {
  const g = {};
  equipos.forEach(e => {
    const marca = _normMarca(e.marca);
    const fam   = _familiaModelo(marca, e.modelo);
    const k     = marca + '||' + fam;
    const d = g[k] || (g[k] = { marca: marca, fam: fam, eq: 0, sin: 0, ctr: {}, cli: {} });
    d.eq++;
    if (!e.contrato_num) d.sin++;
    else d.ctr[e.contrato_num] = [e.neta_mes || 0, e.fac_anual || 0, e.fac_ytd || 0];
    const cli = (e.nombre_cliente || '').trim() || '(sin cliente asociado)';
    const c = d.cli[cli] || (d.cli[cli] = { eq: 0, ctr: {} });
    c.eq++;
    if (e.contrato_num) c.ctr[e.contrato_num] = [e.neta_mes || 0, e.fac_anual || 0, e.fac_ytd || 0];
  });
  const sum = (o, i) => Object.keys(o).reduce((a, k) => a + o[k][i], 0);
  const facTot = ((window.APP_DATA || {}).fact_clientes || []).reduce((a, c) => a + (c.real || 0), 0) || 1;
  return Object.keys(g).map(k => {
    const d = g[k];
    d.key   = k;
    d.nCtr  = Object.keys(d.ctr).length;
    d.mes   = sum(d.ctr, 0);
    d.anual = sum(d.ctr, 1);
    d.ytd   = sum(d.ctr, 2);
    d.pct   = d.ytd / facTot * 100;
    d.clientes = Object.keys(d.cli).map(n => ({
      cliente: n, eq: d.cli[n].eq,
      anual: sum(d.cli[n].ctr, 1),
      ytd:   sum(d.cli[n].ctr, 2),
      pct:   sum(d.cli[n].ctr, 2) / facTot * 100,
    })).sort((a, b) => b.ytd - a.ytd || b.eq - a.eq);
    d.nCli = d.clientes.filter(c => c.cliente !== '(sin cliente asociado)').length;
    return d;
  }).sort((a, b) => b.eq - a.eq || b.ytd - a.ytd);
}

function _renderCasosEquipos(equipos) {
  window._casEqUlt = equipos;
  const box = document.getElementById('cas-eq-tabla');
  if (!box) return;
  const D = _casEqDatos(equipos);
  if (!D.length) {
    box.innerHTML = '<div style="padding:1.2rem;text-align:center;color:var(--mut);font-size:.68rem">' +
      'Sin equipos para los filtros seleccionados.</div>';
    return;
  }
  const facTot = ((window.APP_DATA || {}).fact_clientes || []).reduce((a, c) => a + (c.real || 0), 0) || 1;
  const SEP = 'border-right:1px solid var(--brd)';
  const TD  = 'padding:.4rem .7rem;white-space:nowrap';
  const th  = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;' +
    'padding:.42rem .7rem;font-size:.6rem;letter-spacing:.04em;text-align:' + (al || 'left') +
    ';white-space:nowrap;' + SEP + '">' + t + '</th>';
  const thd = (t, al) => '<th style="background:var(--gy);color:var(--az1);padding:.3rem .7rem;font-size:.58rem;' +
    'text-align:' + (al || 'left') + ';white-space:nowrap;' + SEP + '">' + t + '</th>';
  const maxEq = Math.max.apply(null, D.map(d => d.eq).concat([1]));

  let filas = '';
  D.forEach((d, i) => {
    const abierto = _casEqOpen.has(d.key);
    filas += '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + ';cursor:pointer" ' +
      'onclick="window.casEqTog(' + JSON.stringify(d.key).replace(/"/g, '&quot;') + ')">' +
      '<td style="' + TD + ';font-size:.7rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;' +
        SEP + '" title="' + _escH(d.marca) + '">' +
        '<span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);transform:rotate(' +
        (abierto ? 90 : 0) + 'deg);transition:transform .15s">&#9654;</span>' + _escH(d.marca) + '</td>' +
      '<td style="' + TD + ';font-size:.7rem;font-weight:700;color:var(--am);overflow:hidden;' +
        'text-overflow:ellipsis;' + SEP + '" title="' + _escH(d.fam) + '">' + _escH(d.fam) + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.73rem;font-weight:700;' + SEP + '">' + d.eq + '</td>' +
      '<td style="padding:.4rem .7rem;' + SEP + '">' +
        '<div style="height:8px;background:var(--gy);border-radius:4px;overflow:hidden;min-width:52px">' +
        '<div style="height:100%;width:' + (d.eq / maxEq * 100) + '%;background:var(--am)"></div></div></td>' +
      '<td style="' + TD + ';text-align:right;font-size:.7rem;' + SEP + '">' + d.nCli + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.7rem;color:var(--az2);' + SEP + '">' + (d.nCtr || '—') + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.68rem;color:var(--mut);' + SEP + '">' + (d.sin || '—') + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.7rem;font-variant-numeric:tabular-nums;' + SEP + '">' +
        (d.mes ? mm(d.mes) : '—') + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.7rem;font-weight:600;color:var(--az1);' +
        'font-variant-numeric:tabular-nums;' + SEP + '">' + (d.anual ? mm(d.anual) : '—') + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.7rem;font-weight:600;color:var(--teal);' +
        'font-variant-numeric:tabular-nums;' + SEP + '">' + (d.ytd ? mm(d.ytd) : '—') + '</td>' +
      '<td style="' + TD + ';text-align:right;font-size:.7rem;font-weight:700;color:var(--rd)">' +
        (d.ytd ? d.pct.toFixed(1).replace('.', ',') + '%' : '—') + '</td></tr>';

    if (abierto) {
      const TDD = 'padding:.25rem .7rem;font-size:.66rem;white-space:nowrap';
      filas += '<tr style="background:var(--bg)"><td colspan="11" style="padding:0">' +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed">' +
        '<colgroup><col style="width:26%"><col style="width:6%"><col style="width:39%"><col style="width:10%"><col style="width:10%"><col style="width:9%"></colgroup>' +
        '<thead><tr>' +
          thd('CLIENTE CON EL PROBLEMA') + thd('EQUIPOS', 'right') + thd('') +
          thd('FACT. ANUAL ESP.', 'right') + thd('FACT. A LA FECHA', 'right') +
          thd('% DEL TOTAL', 'right') +
        '</tr></thead><tbody>' +
        d.clientes.map(c =>
          '<tr><td style="' + TDD + ';padding-left:1.9rem;font-weight:600;overflow:hidden;' +
            'text-overflow:ellipsis;' + SEP + '" title="' + _escH(c.cliente) + '">' + _escH(c.cliente) + '</td>' +
          '<td style="' + TDD + ';text-align:right;' + SEP + '">' + c.eq + '</td>' +
          '<td style="' + SEP + '"></td>' +
          '<td style="' + TDD + ';text-align:right;font-variant-numeric:tabular-nums;' + SEP + '">' +
            (c.anual ? mm(c.anual) : '—') + '</td>' +
          '<td style="' + TDD + ';text-align:right;font-variant-numeric:tabular-nums;color:var(--teal);' + SEP + '">' +
            (c.ytd ? mm(c.ytd) : '—') + '</td>' +
          '<td style="' + TDD + ';text-align:right;font-weight:700;color:var(--rd)">' +
            (c.ytd ? c.pct.toFixed(1).replace('.', ',') + '%' : '—') + '</td></tr>').join('') +
        '</tbody></table></td></tr>';
    }
  });

  const tot = k => D.reduce((a, d) => a + d[k], 0);
  // El bucket «(sin cliente asociado)» agrupa equipos sin contrato: es una
  // fila de detalle, no un cliente, así que no entra en el conteo.
  const cliUnicos = {};
  D.forEach(d => d.clientes.forEach(c => {
    if (c.cliente !== '(sin cliente asociado)') cliUnicos[c.cliente] = 1;
  }));
  const ctrUnicos = {};
  equipos.forEach(e => { if (e.contrato_num) ctrUnicos[e.contrato_num] = [e.neta_mes || 0, e.fac_anual || 0, e.fac_ytd || 0]; });
  const sumC = i => Object.keys(ctrUnicos).reduce((a, k) => a + ctrUnicos[k][i], 0);

  box.innerHTML =
    '<div style="display:flex;gap:.5rem;margin-bottom:.55rem;flex-wrap:wrap;align-items:center">' +
      '<button onclick="window.casEqTodos(true)" style="font-size:.62rem;padding:.22rem .6rem;border:1px solid var(--brd);' +
        'border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Expandir todo</button>' +
      '<button onclick="window.casEqTodos(false)" style="font-size:.62rem;padding:.22rem .6rem;border:1px solid var(--brd);' +
        'border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Colapsar todo</button>' +
      '<span style="font-size:.63rem;color:var(--mut)">' + D.length + ' equipos distintos · clic para ver los clientes afectados</span>' +
    '</div>' +
    '<div style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
    '<table style="width:100%;border-collapse:collapse;min-width:1080px;table-layout:fixed">' +
    '<colgroup><col style="width:11%"><col style="width:15%"><col style="width:6%"><col style="width:8%"><col style="width:7%"><col style="width:7%"><col style="width:8%"><col style="width:9%"><col style="width:10%"><col style="width:10%"><col style="width:9%"></colgroup>' +
    '<thead><tr>' +
      th('MARCA') + th('FAMILIA DE EQUIPO') + th('EQUIPOS', 'right') + th('') + th('CLIENTES', 'right') +
      th('CONTRATOS', 'right') + th('SIN CONTRATO', 'right') + th('NETA MES', 'right') +
      th('FACT. ANUAL ESP.', 'right') + th('FACT. A LA FECHA', 'right') + th('% DEL TOTAL', 'right') +
    '</tr></thead><tbody>' + filas + '</tbody>' +
    '<tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td colspan="2" style="padding:.45rem .7rem;font-size:.7rem;' + SEP + '">TOTAL · ' + D.length + ' equipos distintos</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;' + SEP + '">' + tot('eq') + '</td>' +
      '<td style="' + SEP + '"></td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;' + SEP + '">' + Object.keys(cliUnicos).length + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;' + SEP + '">' + Object.keys(ctrUnicos).length + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;' + SEP + '">' + tot('sin') + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;font-variant-numeric:tabular-nums;' + SEP + '">' + mm(sumC(0)) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;font-variant-numeric:tabular-nums;' + SEP + '">' + mm(sumC(1)) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;font-variant-numeric:tabular-nums;' + SEP + '">' + mm(sumC(2)) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem">' + (sumC(2) / facTot * 100).toFixed(1).replace('.', ',') + '%</td>' +
    '</tr></tfoot></table></div>' +
    '<p style="font-size:.6rem;color:var(--mut);margin:.55rem 0 0;line-height:1.55">' +
      'Los equipos se agrupan por marca y familia, unificando variantes del mismo modelo. La facturación se acumula ' +
      'por contrato distinto y no por equipo, porque varios equipos detenidos comparten contrato, y por eso los ' +
      'subtotales por fila no suman el total. El <strong>% del total</strong> es lo que esos clientes han facturado ' +
      'a la fecha sobre los ' + mm(facTot) + ' facturados en el año por todos los clientes.</p>';

  const c3 = document.getElementById('cas-t3-count');
  if (c3) c3.textContent = D.length + ' equipos distintos · ' + tot('eq') + ' detenidos · ' +
    Object.keys(cliUnicos).length + ' clientes';
}

// ── EXPORTAR EL RESUMEN POR EQUIPO ────────────────────────────────
async function casosEqExportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('cas-eq-pdf');
  const ICON = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  let wrap = null;
  try {
    const src = document.getElementById('cas-eq-tabla');
    if (!src) throw new Error('No se encontró el contenido');
    const hoy = (window.APP_DATA || {}).hoy || '';
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1320px;' +
      'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    const enc = document.createElement('div');
    enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
    enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
      'TECSERVICE — Equipos Detenidos · Resumen por Equipo</span>' +
      (hoy ? '&emsp;<span style="font-size:10px;color:#555">Datos al ' + hoy + '</span>' : '');
    wrap.appendChild(enc);
    const cl = src.cloneNode(true);
    cl.querySelectorAll('button').forEach(b => b.remove());
    cl.querySelectorAll('*').forEach(n => {
      n.style.position = 'static'; n.style.maxHeight = 'none'; n.style.overflow = 'visible';
    });
    wrap.appendChild(cl);
    document.body.appendChild(wrap);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const realW = Math.ceil(wrap.getBoundingClientRect().width)  || wrap.offsetWidth;
    const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
    if (!realW || !realH) throw new Error('No se pudo medir el contenido');
    const canvas = await html2canvas(wrap, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const { jsPDF } = window.jspdf;
    const MM_PX = 25.4 / 96;
    const pw = realW * MM_PX, ph = realH * MM_PX;
    const pdf = new jsPDF({ orientation: pw >= ph ? 'landscape' : 'portrait', unit: 'mm', format: [pw, ph] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pw, ph);
    pdf.save('Resumen_Equipos_Detenidos_TS_' + (hoy || '').replace(/[\s/]+/g, '-') + '.pdf');
  } catch (err) {
    console.error('casosEqExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
  }
}

// Deja los cuatro segmentadores y la garantía en «Todos»
window.casEqLimpiar = function () {
  ['cas-f-marca', 'cas-f-estado', 'cas-f-coord', 'cas-f-tipo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.querySelectorAll('#cas-btn-gar .btn').forEach((b, i) => {
    b.classList.toggle('on', i === 0);
  });
  renderCasos();
};

// ── HELPER: escapar HTML ──────────────────────────────────────────
function _escH(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── HOOK sv() ────────────────────────────────────────────────────
(function () {
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig(name, btn);
      if (name === 'casos') setTimeout(initCasos, 80);
    };
  }
})();
