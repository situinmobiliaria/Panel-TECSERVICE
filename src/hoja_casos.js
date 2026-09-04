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
      <button id="cas-flujo-pdf" onclick="exportarPanel({ids:['cas-flujo'],titulo:'Flujo de Equipos Detenidos',archivo:'Casos_Flujo',btn:'cas-flujo-pdf'})"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
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
      <button id="cas-eq-pdf" onclick="exportarPanel({ids:['cas-eq-tabla'],titulo:'Resumen por Equipo',archivo:'Casos_Resumen_por_Equipo',btn:'cas-eq-pdf'})"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
    </div>
    <div class="cb"><div id="cas-eq-tabla"></div></div>
  </div>

  <!-- Resumen por Marca -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(255,160,0,.18),rgba(255,160,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--am)">Resumen por Marca</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-marca-count">&mdash;</span>
      <button id="cas-marca-pdf" onclick="exportarPanel({ids:['cas-marca-tabla'],titulo:'Resumen por Marca',archivo:'Casos_Resumen_por_Marca',btn:'cas-marca-pdf'})"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
    </div>
    <div class="cb"><div id="cas-marca-tabla"></div></div>
  </div>

  <!-- Resumen por Cliente -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(0,45,115,.16),rgba(0,45,115,.05));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--az1)">Resumen por Cliente</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-cli-count">&mdash;</span>
      <button id="cas-cli-pdf" onclick="exportarPanel({ids:['cas-cli-tabla'],titulo:'Resumen por Cliente',archivo:'Casos_Por_Cliente',btn:'cas-cli-pdf'})"
        style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
               border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
    </div>
    <div class="cb"><div id="cas-cli-tabla"></div></div>
  </div>

  <!-- Tabla 2: Equipos Detenidos -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(255,160,0,.18),rgba(255,160,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--am)">Equipos Detenidos</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t2-count">—</span>
      <div style="margin-left:auto;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <div class="btn-g" id="cas-btn-gar">
          <button class="btn on" data-cgar="todas">Todos</button>
          <button class="btn" data-cgar="vigente">Con Garantía</button>
          <button class="btn" data-cgar="sin">Sin Garantía</button>
        </div>
        <button id="cas-eq-pdf2" onclick="exportarPanel({ids:['cas-table2-wrap'],titulo:'Equipos Detenidos · Detalle',archivo:'Casos_Detalle',btn:'cas-eq-pdf2'})"
          style="font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
                 border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
        <button id="cas-eq-xls" onclick="casosEquiposExcelExport()"
          style="font-size:.58rem;padding:.22rem .7rem;background:#0F7B3F;color:#fff;border:none;
                 border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar Excel</button>
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
    <div style="overflow-x:auto" id="cas-table2-wrap">
      <table class="tbl" id="cas-table2" style="min-width:2150px">
        <thead><tr>
          <th style="min-width:120px">Modelo</th>
          <th style="min-width:200px">Nombre Activo</th>
          <th style="min-width:110px">N° Serie</th>
          <th style="min-width:90px">Marca</th>
          <th style="min-width:100px">Estado</th>
          <th style="min-width:110px">Coordinadora</th>
          <th style="min-width:180px">Comentario Coordinadora</th>
          <th style="min-width:105px">Fecha Ingreso</th>
          <th style="min-width:90px">Vida Media</th>
          <th style="min-width:105px">Fecha Estado</th>
          <th style="min-width:95px">Días en Estado</th>
          <th style="min-width:110px">Costo Equipo</th>
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
    <div style="display:flex;justify-content:flex-end;margin:0 .9rem .5rem">
      <button id="cas-t1-pdf" onclick="exportarPanel({ids:['cas-table1-wrap'],titulo:'Casos Relevantes',archivo:'Casos_Relevantes',btn:'cas-t1-pdf',ancho:2200,cols:['5%','6%','12%','5%','6%','45%','6%','15%']})" style="font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
    </div>
    <div style="overflow-x:auto" id="cas-table1-wrap">
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

  <!-- Resumen de Casos: facturación y base instalada del cliente -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="flex-wrap:wrap;gap:.4rem">
      <span class="ct">Resumen de Casos · Facturación y Base Instalada</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-res-count">&mdash;</span>
      <button id="cas-res-pdf" onclick="exportarPanel({ids:['cas-res-tabla'],titulo:'Resumen de Casos · Facturación y Base Instalada',archivo:'Casos_Resumen_Facturacion',btn:'cas-res-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
    </div>
    <div class="cb"><div id="cas-res-tabla"></div></div>
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

// ── VIDA MEDIA (días desde Fecha Ingreso hasta hoy) ───────────────
// «Fecha Ingreso» es la fecha en que el equipo entró en el flujo de
// reparación (extractor.py la formatea como DD-MM-AAAA). La vida media
// de una etapa es el promedio de días transcurridos desde esa fecha
// hasta el corte del panel (APP_DATA.hoy) para los equipos de esa etapa.
function _parseFechaCasos(s) {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return isNaN(d.getTime()) ? null : d;
}
// Vida del equipo en años, desde su fecha de ingreso hasta el corte del
// panel. Devuelve null si la fila no trae fecha, para poder distinguir «no
// se sabe» de «recién ingresado».
function _vidaAnios(e) {
  const f = _parseFechaCasos(e.fecha_ingreso);
  return f ? _diasDesde(f) / 365.25 : null;
}

// Días que el equipo lleva en el estado actual. Se recalcula desde «Fecha de
// Estado» contra el corte del panel en vez de usar la antigüedad que trae el
// Excel, que es un =HOY()-fecha y por lo tanto queda congelada en el momento
// en que se convirtió el archivo. La del Excel queda de respaldo por si la
// fila no trae fecha.
function _diasEnEstado(e) {
  const f = _parseFechaCasos(e.fecha_estado);
  if (f) return _diasDesde(f);
  const d = +e.dias_estado || 0;
  return d > 0 ? d : null;
}

function _diasDesde(fecha) {
  const hoyStr = (window.APP_DATA || {}).hoy;
  const hoy = hoyStr ? new Date(hoyStr) : new Date();
  return Math.max(0, Math.round((hoy - fecha) / 86400000));
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
// distinto: varios equipos detenidos suelen compartir el mismo contrato y
// sumarla por equipo la multiplicaría. El valorizado, en cambio, sí es por
// equipo: es el costo CIF de cada uno.
function _flujoDatos(equipos) {
  const et = {};
  _FLUJO.forEach(f => {
    et[f.k] = { eq: 0, cli: {}, ctr: {}, coment: [], mod: {}, marca: {}, cif: 0,
                vidaSum: 0, vidaN: 0, antSum: 0, antN: 0 };
  });
  const ctrG = {}, cliG = {}, modG = {}, marcaG = {};
  let cifG = 0, vidaSumG = 0, vidaNG = 0, antSumG = 0, antNG = 0;

  equipos.forEach(e => {
    const d = et[_flujoEtapa(_catComentario(e))];
    d.eq++;
    const cif = +e.costo_cif || 0;
    d.cif += cif;
    cifG += cif;

    const fi = _parseFechaCasos(e.fecha_ingreso);
    if (fi) {
      const dias = _diasDesde(fi);
      d.vidaSum += dias; d.vidaN++;
      vidaSumG += dias; vidaNG++;
    }
    // La antigüedad en el estado es independiente de la vida del equipo: un
    // equipo viejo puede llevar tres días detenido y uno nuevo, un año.
    const ant = _diasEnEstado(e);
    if (ant != null) {
      d.antSum += ant; d.antN++;
      antSumG += ant; antNG++;
    }

    const marca = _normMarca(e.marca);
    d.marca[marca] = d.marca[marca] || { eq: 0, cif: 0 };
    d.marca[marca].eq++; d.marca[marca].cif += cif;
    marcaG[marca] = (marcaG[marca] || 0) + 1;

    const modKey = marca + ' ' + _familiaModelo(marca, e.modelo);
    d.mod[modKey] = (d.mod[modKey] || 0) + 1;
    modG[modKey]  = (modG[modKey]  || 0) + 1;

    const cli = (e.nombre_cliente || '').trim();
    if (cli) {
      const c = d.cli[cli] || (d.cli[cli] = { eq: 0, ctr: {} });
      c.eq++;
      const g = cliG[cli] || (cliG[cli] = { eq: 0, ctr: {} });
      g.eq++;
      if (e.contrato_num) {
        c.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
        g.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
      }
    }
    if (e.contrato_num) {
      d.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
      ctrG[e.contrato_num]  = [e.fac_anual || 0, e.fac_ytd || 0];
    }
    const txt = (e.comentario_coord || '').trim();
    if (txt && d.coment.indexOf(txt) < 0) d.coment.push(txt);
  });

  const suma  = (o, i) => Object.keys(o).reduce((a, k) => a + o[k][i], 0);
  const totYtd = suma(ctrG, 1) || 1;
  Object.keys(cliG).forEach(c => { cliG[c].ytd = suma(cliG[c].ctr, 1); });

  _FLUJO.forEach(f => {
    const d = et[f.k];
    d.anual   = suma(d.ctr, 0);
    d.ytd     = suma(d.ctr, 1);
    d.nCli    = Object.keys(d.cli).length;
    d.nCtr    = Object.keys(d.ctr).length;
    d.nMarcas = Object.keys(d.marca).length;
    d.pctCif  = cifG ? d.cif / cifG * 100 : 0;
    d.anualProm = d.nCli ? d.anual / d.nCli : 0;
    d.vidaMedia = d.vidaN ? d.vidaSum / d.vidaN : null;
    d.antMedia  = d.antN  ? d.antSum  / d.antN  : null;
    d.top = Object.keys(d.cli).map(c => ({
        cliente: c, eq: d.cli[c].eq, pct: (cliG[c].ytd || 0) / totYtd * 100,
        ytd: cliG[c].ytd || 0,
      })).sort((a, b) => b.eq - a.eq || b.pct - a.pct);
    d.marcas = Object.keys(d.marca).map(m => ({
        marca: m, eq: d.marca[m].eq, cif: d.marca[m].cif,
        pct: d.cif ? d.marca[m].cif / d.cif * 100 : 0,
      })).sort((a, b) => b.cif - a.cif || b.eq - a.eq);
    d.topMod = Object.keys(d.mod).map(m => ({ modelo: m, eq: d.mod[m] }))
      .sort((a, b) => b.eq - a.eq).slice(0, 2);
    d.topModPct = d.eq ? d.topMod.reduce((a, m) => a + m.eq, 0) / d.eq * 100 : 0;
  });

  const nEqTot = equipos.length;
  const topCliGlobal = Object.keys(cliG).map(c => ({
      cliente: c, eq: cliG[c].eq, pct: (cliG[c].ytd || 0) / totYtd * 100,
      ytd: cliG[c].ytd || 0,
    })).sort((a, b) => b.eq - a.eq || b.pct - a.pct).slice(0, 3);
  const topModGlobal = Object.keys(modG).map(m => ({ modelo: m, eq: modG[m] }))
    .sort((a, b) => b.eq - a.eq).slice(0, 3)
    .map(m => Object.assign(m, { pct: nEqTot ? m.eq / nEqTot * 100 : 0 }));

  return { et: et, totCtr: ctrG, totCli: cliG, cif: cifG,
           nMarcas: Object.keys(marcaG).length,
           anual: suma(ctrG, 0), ytd: suma(ctrG, 1),
           vidaMedia: vidaNG ? vidaSumG / vidaNG : null,
           antMedia:  antNG  ? antSumG  / antNG  : null,
           topCliGlobal: topCliGlobal, topModGlobal: topModGlobal };
}

function _renderCasosFlujo(equipos) {
  const box = document.getElementById('cas-flujo');
  if (!box) return;
  const D = _flujoDatos(equipos);
  const nEq  = equipos.length;
  const nCli = Object.keys(D.totCli).length;
  const sumaEt = _FLUJO.reduce((a, f) => a + D.et[f.k].nCli, 0);
  const facPanel = ((window.APP_DATA || {}).fact_clientes || [])
    .reduce((a, c) => a + (c.real || 0), 0);
  const pctPanel = facPanel ? D.ytd / facPanel * 100 : 0;
  const pc0 = v => (v || 0).toFixed(0) + '%';

  // Chevron: punta a la derecha salvo en la última etapa
  const chev = (f, i) => {
    const ult   = i === _FLUJO.length - 1;
    const claro = i < 2;
    return '<div style="flex:1;min-width:0;background:' + f.col +
      ';color:' + (claro ? '#1B2A6B' : '#fff') + ';font-size:.63rem;font-weight:700;text-align:center;' +
      'padding:.4rem .5rem .4rem ' + (i ? '1.1rem' : '.6rem') + ';white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis;clip-path:polygon(0 0,' +
      (ult ? '100% 0,100% 50%,100% 100%' : 'calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%') +
      ',0 100%' + (i ? ',14px 50%' : '') + ')">' + f.k + '</div>';
  };

  const li = (t, v, col) =>
    '<li style="display:flex;justify-content:space-between;gap:.4rem;margin-bottom:.26rem;line-height:1.4">' +
    '<span style="color:var(--mut)">' + t + '</span>' +
    '<strong style="color:' + (col || 'var(--txt)') + ';white-space:nowrap">' + v + '</strong></li>';
  const sub = t => '<div style="font-size:.59rem;color:var(--mut);margin-top:.4rem;' +
    'text-transform:uppercase;letter-spacing:.04em">' + t + '</div>';
  const vacio = '<div style="margin-left:.5rem;color:var(--mut);font-size:.6rem">—</div>';

  const tarjeta = f => {
    const d = D.et[f.k];
    const top = d.top.slice(0, 3).map(c =>
      '<div style="margin:.1rem 0 0 .5rem;font-size:.6rem;line-height:1.35">• ' + _escH(c.cliente) +
      ' <span style="color:var(--mut)">(' + c.eq + ' eq · ' + pc0(c.pct) + ' fact. · ' + mm(c.ytd) +
      ' ingresos)</span></div>').join('') || vacio;
    // Desglose de valorización por marca, justo bajo el valorizado total
    const marcas = d.marcas.slice(0, 4).map(m =>
      '<div style="display:flex;justify-content:space-between;gap:.4rem;margin:.1rem 0 0 .5rem;' +
      'font-size:.6rem;line-height:1.35"><span>• ' + _escH(m.marca) +
      ' <span style="color:var(--mut)">(' + m.eq + ')</span></span>' +
      '<span style="white-space:nowrap;color:var(--or);font-weight:600">' + mm(m.cif) +
      ' <span style="color:var(--mut);font-weight:400">' + pc0(m.pct) + '</span></span></div>').join('') || vacio;
    const topMod = d.topMod.map(m =>
      '<div style="margin:.1rem 0 0 .5rem;font-size:.6rem;line-height:1.35">• ' + _escH(m.modelo) +
      ' <span style="color:var(--mut)">(' + m.eq + ' eq)</span></div>').join('') || vacio;

    return '<div style="flex:1 1 200px;min-width:200px;border:1px solid ' + f.col +
      ';border-top:3px solid ' + f.col + ';border-radius:5px;padding:.55rem .6rem;background:var(--wh)">' +
      '<ul style="list-style:none;margin:0;padding:0;font-size:.62rem">' +
        li('N° Equipos', d.eq, f.col) +
        li('N° Clientes', d.nCli) +
        li('N° Marcas', d.nMarcas) +
        li('Vida media (desde ingreso)', d.vidaN ? fN1(d.vidaMedia / 365.25) + ' años' : '—') +
        li('Antigüedad media en estado',
           d.antMedia != null ? Math.round(d.antMedia) + ' días' : '—',
           d.antMedia >= 180 ? 'var(--rd)' : d.antMedia >= 90 ? 'var(--or)' : undefined) +
        li('Fact. anual esperada', mm(d.anual), 'var(--az1)') +
        li('Fact. a la fecha', mm(d.ytd), 'var(--teal)') +
        li('Fact. anual prom. x cliente', mm(d.anualProm), 'var(--az2)') +
      '</ul>' +
      sub('Valorizado de los equipos') +
      '<ul style="list-style:none;margin:.1rem 0 0;padding:0;font-size:.62rem">' +
        li('Valorizado total', mm(d.cif), 'var(--or)') +
        li('% del valorizado detenido', pc0(d.pctCif), 'var(--or)') +
      '</ul>' + marcas +
      sub('Clientes más importantes') + top +
      sub('Equipos más relevantes') + topMod +
      (d.eq ? '<div style="margin:.15rem 0 0 .5rem;font-size:.57rem;color:var(--mut)">Concentran el ' +
        pc0(d.topModPct) + ' de los equipos de la etapa</div>' : '') +
      '<div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed ' + f.col + '55">' +
        '<ul style="list-style:none;margin:0;padding:0;font-size:.6rem">' +
          li('% de equipos detenidos', pc0(nEq ? d.eq / nEq * 100 : 0), f.col) +
          li('% de clientes afectados', pc0(nCli ? d.nCli / nCli * 100 : 0)) +
          li('% de facturación del año', pc0(facPanel ? d.ytd / facPanel * 100 : 0), 'var(--teal)') +
        '</ul></div></div>';
  };

  // Tarjeta Total: el flujo completo, sin segmentar
  const tarjetaTotal = () => {
    const topCli = D.topCliGlobal.map(c =>
      '<div style="margin:.1rem 0 0 .5rem;font-size:.6rem;line-height:1.35">• ' + _escH(c.cliente) +
      ' <span style="color:var(--mut)">(' + c.eq + ' eq · ' + pc0(c.pct) + ' fact. · ' + mm(c.ytd) +
      ' ingresos)</span></div>').join('') || vacio;
    const topMod = D.topModGlobal.map(m =>
      '<div style="margin:.1rem 0 0 .5rem;font-size:.6rem;line-height:1.35">• ' + _escH(m.modelo) +
      ' <span style="color:var(--mut)">(' + m.eq + ' eq · ' + pc0(m.pct) + ')</span></div>').join('') || vacio;
    const porEtapa = _FLUJO.map(f => {
      const d = D.et[f.k];
      if (!d.eq) return '';
      return '<div style="display:flex;justify-content:space-between;gap:.4rem;margin:.1rem 0 0 .5rem;' +
        'font-size:.6rem;line-height:1.35"><span>• ' + f.k + '</span><span style="white-space:nowrap">' +
        d.nCli + ' cli <span style="color:var(--mut)">(' + pc0(nCli ? d.nCli / nCli * 100 : 0) +
        ')</span></span></div>';
    }).join('') || vacio;
    return '<div style="flex:1 1 200px;min-width:200px;border:1px solid var(--az1);border-top:3px solid var(--az1);' +
      'border-radius:5px;padding:.55rem .6rem;background:rgba(0,45,115,.04)">' +
      '<div style="font-size:.66rem;font-weight:800;color:var(--az1);margin-bottom:.35rem">TOTAL</div>' +
      '<ul style="list-style:none;margin:0;padding:0;font-size:.62rem">' +
        li('N° Equipos', nEq, 'var(--az1)') +
        li('N° Clientes', nCli) +
        li('N° Marcas', D.nMarcas) +
        li('Vida media (desde ingreso)', D.vidaMedia != null ? fN1(D.vidaMedia / 365.25) + ' años' : '—') +
        li('Antigüedad media en estado',
           D.antMedia != null ? Math.round(D.antMedia) + ' días' : '—',
           D.antMedia >= 180 ? 'var(--rd)' : D.antMedia >= 90 ? 'var(--or)' : undefined) +
        li('Fact. anual esperada', mm(D.anual), 'var(--az1)') +
        li('Fact. a la fecha', mm(D.ytd), 'var(--teal)') +
        li('Fact. anual prom. x cliente', mm(nCli ? D.anual / nCli : 0), 'var(--az2)') +
      '</ul>' +
      sub('Valorizado de los equipos') +
      '<ul style="list-style:none;margin:.1rem 0 0;padding:0;font-size:.62rem">' +
        li('Valorizado total', mm(D.cif), 'var(--or)') +
        li('% del valorizado detenido', '100%', 'var(--or)') +
      '</ul>' +
      sub('Clientes más importantes') + topCli +
      sub('Equipos más relevantes') + topMod +
      sub('% de clientes por etapa') + porEtapa +
      '</div>';
  };

  box.innerHTML =
    '<div style="display:flex;gap:3px;margin-bottom:.5rem">' + _FLUJO.map(chev).join('') + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:stretch">' +
      _FLUJO.map(tarjeta).join('') + tarjetaTotal() + '</div>' +
    '<div style="margin-top:.7rem;padding:.55rem .8rem;background:rgba(40,210,195,.09);' +
      'border-left:3px solid var(--teal);border-radius:4px;font-size:.63rem;line-height:1.6">' +
      '<div>• Total <strong>' + nEq + ' equipos detenidos</strong>, en <strong>' + nCli +
        ' clientes</strong> y <strong>' + D.nMarcas + ' marcas</strong>, que representan un <strong>' +
        pc0(pctPanel) + '</strong> de la facturación total del año.</div>' +
      '<div>• Facturación real a la fecha de esos clientes <strong>' + mm(D.ytd) +
        '</strong> vs. esperada <strong>' + mm(D.anual) + '</strong>.</div>' +
      '<div>• Valorizado de los equipos detenidos <strong>' + mm(D.cif) + '</strong>.</div>' +
      (sumaEt > nCli ? '<div style="color:var(--mut);font-size:.6rem;margin-top:.15rem">' +
        'Los clientes de cada etapa suman ' + sumaEt + ' porque ' + (sumaEt - nCli) +
        ' aparece' + (sumaEt - nCli > 1 ? 'n' : '') + ' en más de una etapa; el total sin repetir es ' +
        nCli + '.</div>' : '') +
    '</div>';

  const st = document.getElementById('cas-flujo-sub');
  if (st) st.textContent = nEq + ' equipos · ' + nCli + ' clientes · ' +
    Object.keys(D.totCtr).length + ' contratos · ' + mm(D.cif) + ' valorizado';
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
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, 'Equipos_Detenidos_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);
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
  window._casEqFiltUlt = eqFilt; // para exportar a Excel exactamente lo que se ve en la tabla

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
                    padding:.08rem .35rem;border-radius:3px;font-size:.55rem;font-weight:700;
                    white-space:nowrap">${_escH(_catCorto(k))}</span>`;
        })()}</td>
        <td style="text-align:center">${_mono(e.fecha_ingreso)}</td>
        <td style="text-align:center">${(() => {
          const v = _vidaAnios(e);
          if (v == null) return _dash;
          // Sobre diez años el equipo ya pasó su vida útil de referencia.
          const col = v >= 10 ? 'var(--rd)' : v >= 7 ? 'var(--or)' : 'var(--mut)';
          return `<span style="font-size:.62rem;font-weight:${v >= 7 ? 700 : 400};color:${col};
                    font-variant-numeric:tabular-nums">${fN1(v)} años</span>`;
        })()}</td>
        <td style="text-align:center">${_mono(e.fecha_estado)}</td>
        <td style="text-align:center">${(() => {
          const d = _diasEnEstado(e);
          if (d == null) return _dash;
          // Sobre medio año detenido en la misma etapa el caso ya está estancado.
          const col = d >= 180 ? 'var(--rd)' : d >= 90 ? 'var(--or)' : 'var(--mut)';
          return `<span style="font-size:.62rem;font-weight:${d >= 90 ? 700 : 400};color:${col};
                    font-variant-numeric:tabular-nums">${d}</span>`;
        })()}</td>
        <td style="text-align:right">${e.costo_cif>0
          ? `<span style="font-size:.63rem;font-weight:700;color:var(--or);font-family:'Roboto Mono',monospace">${mm(e.costo_cif)}</span>`
          : _dash}</td>
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

  _renderCasosResumen(casosFilt);
  _renderCasosFlujo(eqFilt);
  _renderCasosEquipos(eqFilt);
  _renderCasosMarca(eqFilt);
  _renderCasosCliente(eqFilt);

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

// ── EXPORTAR EQUIPOS DETENIDOS A PDF ───────────────────────────────
async function casosDetalleExportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('cas-eq-pdf2');
  const ICON = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  let wrap = null;
  try {
    const src = document.getElementById('cas-table2-wrap');
    if (!src) throw new Error('No se encontró el contenido');
    const hoy = (window.APP_DATA || {}).hoy || '';
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:2200px;' +
      'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    const enc = document.createElement('div');
    enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
    enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
      'TECSERVICE — Equipos Detenidos · Detalle</span>' +
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
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, 'Equipos_Detenidos_Detalle_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);
  } catch (err) {
    console.error('casosDetalleExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
  }
}

// ── EXPORTAR EQUIPOS DETENIDOS A EXCEL ─────────────────────────────
// Vuelca exactamente las columnas y filas visibles en la tabla "Equipos
// Detenidos" (con los filtros/segmentadores activos), incluyendo el
// mismo texto "NO ASOCIADO A CONTRATO" que se ve en pantalla para los
// equipos sin contrato.
function casosEquiposExcelExport() {
  if (typeof XLSX === 'undefined') {
    alert('Librería Excel no cargada. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const eqFilt = window._casEqFiltUlt || [];
  const _noContr = 'NO ASOCIADO A CONTRATO';
  const headers = [
    'Modelo', 'Nombre Activo', 'N° Serie', 'Marca', 'Estado', 'Coordinadora',
    'Comentario Coordinadora', 'Fecha Ingreso', 'Vida (años)', 'Fecha Estado',
    'Días en Estado',
    'Costo Equipo',
    'N° Contrato', 'Estado Garantía', 'Nombre Cliente', 'Neta Mes',
    'Fact. Anual Esp.', 'Fact. a la Fecha', 'Inicio', 'Término',
  ];
  const rows = eqFilt.map(e => {
    const sinContrato = !e.contrato_num;
    const estado = e.estado.toUpperCase().includes('NO OPER') ? 'No Operativo' : e.estado;
    return [
      e.modelo || '', e.nombre || '', e.serie || '', e.marca || '', estado,
      e.coordinadora || '', _catComentario(e),
      e.fecha_ingreso || '', _vidaAnios(e), e.fecha_estado || '', _diasEnEstado(e),
      e.costo_cif || 0,
      sinContrato ? _noContr : e.contrato_num,
      e.garantia || '',
      sinContrato ? _noContr : (e.nombre_cliente || ''),
      sinContrato ? _noContr : (e.neta_mes || 0),
      sinContrato ? _noContr : (e.fac_anual || 0),
      sinContrato ? _noContr : (e.fac_ytd || 0),
      sinContrato ? _noContr : (e.fecha_inicio || ''),
      sinContrato ? _noContr : (e.fecha_fin || ''),
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Equipos Detenidos');
  const hoy = (window.APP_DATA || {}).hoy || '';
  XLSX.writeFile(wb, 'Equipos_Detenidos_TS_' + (hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
}

// ── RESUMEN DE CASOS: FACTURACIÓN Y BASE INSTALADA ────────────────
// La tabla de casos trae el cliente escrito a mano y abreviado («HP Tisné»,
// «HP BUIN»), mientras que la facturación y la base instalada usan el nombre
// completo. Para cruzarlos se comparan los tokens distintivos del nombre —los
// que quedan al sacar «hospital», «clínica», «de», etc.— y sólo se da por
// bueno el cliente cuyo nombre CONTIENE todos los del caso. Si no calza
// ninguno se muestra «sin identificar» en vez de arriesgar un cliente
// equivocado: una fila vacía se corrige, una fila con la facturación de otro
// cliente se propaga sin que nadie lo note.
const _CAS_STOP = new Set(['HP','HOSP','HOSPITAL','CLINICA','CLINICO','CENTRO','CESFAM','DE','DEL',
  'LA','EL','LOS','LAS','SA','SPA','LTDA','DR','DRA','SERVICIO','SALUD','COMPLEJO','ASISTENCIAL',
  'BASE','INSTITUTO','CORPORACION','MUNICIPAL','MUNICIPALIDAD','SOCIEDAD','CONCESIONARIA',
  'COMUNITARIO']);
// Abreviaturas que no se resuelven comparando palabras, porque son siglas o
// porque el nombre corto no comparte ninguna con el de la base. Se corrigen a
// mano y se documentan acá; agregar una entrada es todo lo que hace falta
// cuando aparezca otro caso así.
const _CAS_ALIAS = {
  'ISM': 'INSUMOS Y SERVICIOS MEDICOS S.A.',
  // El Félix Bulnes lo opera la concesionaria: la facturación y la base
  // instalada están a nombre de ella, no del hospital.
  'HP FELIX BULNES': 'SOCIEDAD CONCESIONARIA METROPOLITANA DE SALUD S.A.',
  'FELIX BULNES':    'SOCIEDAD CONCESIONARIA METROPOLITANA DE SALUD S.A.',
};

function _casNorm(s) {
  return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const _casToks = s => _casNorm(s).split(' ').filter(t => t.length > 2 && !_CAS_STOP.has(t));
const _casEsHosp = s => /^(HP|H|HOSP|HOSPITAL)\b/.test(_casNorm(s));

let _casIdx = null;
function _casIndice() {
  if (_casIdx) return _casIdx;
  const A = window.APP_DATA || {};
  const cand = {};
  const add = nom => {
    const k = _casNorm(nom);
    if (k && !cand[k]) cand[k] = { nombre: nom, toks: new Set(_casToks(nom)), hosp: _casEsHosp(nom) };
  };
  (A.panel_fact || []).forEach(p => add(p.nombre_analisis || p.cliente));
  ((A.base_instalada || {}).clientes || []).forEach(c => add(c.nombre));
  ((window.CASOS_DATA || {}).equipos || []).forEach(e => { if (e.nombre_cliente) add(e.nombre_cliente); });

  const fact = {}, bi = {};
  (A.panel_fact || []).forEach(p => {
    fact[_casNorm(p.nombre_analisis || p.cliente)] = p;
    const k2 = _casNorm(p.cliente);
    if (!fact[k2]) fact[k2] = p;
  });
  ((A.base_instalada || {}).clientes || []).forEach(c => { bi[_casNorm(c.nombre)] = c; });
  // La hoja FACTURACIÓN del Excel es la única fuente con el corte contratos /
  // no contratos por cliente; sus nombres también entran como candidatos.
  const desg = {};
  Object.keys(A.fact_desglose || {}).forEach(k => {
    const d = A.fact_desglose[k];
    desg[_casNorm(d.nombre)] = d;
    add(d.nombre);
  });
  _casIdx = { cand: Object.values(cand), fact: fact, bi: bi, desg: desg };
  return _casIdx;
}

function _casCliente(abrev) {
  const ix = _casIndice();
  const al = _CAS_ALIAS[_casNorm(abrev)];
  if (al) return al;
  const t = _casToks(abrev);
  if (!t.length) return null;
  const h = _casEsHosp(abrev);
  let best = null, bs = null;
  ix.cand.forEach(c => {
    for (let i = 0; i < t.length; i++) if (!c.toks.has(t[i])) return;
    // Empata primero por el tipo de institución y después por el nombre que
    // menos palabras sobrantes tiene respecto del abreviado.
    const sc = [c.hosp === h ? 1 : 0, -Math.abs(c.toks.size - t.length)];
    if (!bs || sc[0] > bs[0] || (sc[0] === bs[0] && sc[1] > bs[1])) { bs = sc; best = c.nombre; }
  });
  return best;
}

function _renderCasosResumen(casos) {
  const box = document.getElementById('cas-res-tabla');
  if (!box) return;
  const ix = _casIndice();
  const SEP2 = 'border-right:1px solid var(--brd)';
  const TD2 = 'padding:.34rem .6rem;white-space:nowrap';
  const th2 = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;' +
    'padding:.4rem .6rem;font-size:.58rem;letter-spacing:.04em;text-align:' + (al || 'left') +
    ';white-space:nowrap;' + SEP2 + '">' + t + '</th>';
  const n2 = (v, extra) => '<td style="' + TD2 + ';text-align:right;font-size:.63rem;' +
    'font-variant-numeric:tabular-nums;' + (extra || '') + SEP2 + '">' + v + '</td>';

  const filas = casos.map(c => {
    const full = _casCliente(c.cliente);
    const p = full ? ix.fact[_casNorm(full)] : null;
    const b = full ? ix.bi[_casNorm(full)] : null;
    // El desglose viene de la hoja FACTURACIÓN, que ya trae por cliente la
    // facturación del año separada en contratos y correctiva (no contratos).
    // Las dos partes suman el total exacto; «correctiva» puede salir negativa
    // cuando lo devengado del contrato supera lo facturado en el año, y se
    // muestra tal cual porque es información y no un error de cálculo.
    const g = full ? ix.desg[_casNorm(full)] : null;
    return {
      coord: c.coordinador || '—', cliente: c.cliente, estado: c.estado || '—',
      resp: c.responsable || '—', full: full,
      fc: (g && +g.c26) || 0, fs: (g && +g.k26) || 0, ft: (g && +g.t26) || 0,
      f25: (g && +g.t25) || 0,
      bi: (g && +g.bi) || (b && +b.total) || 0,
    };
  }).sort((a, b) => b.ft - a.ft || b.bi - a.bi);

  const T = filas.reduce((a, f) => ({ fc: a.fc + f.fc, fs: a.fs + f.fs, ft: a.ft + f.ft,
    f25: a.f25 + f.f25, bi: a.bi + f.bi }), { fc: 0, fs: 0, ft: 0, f25: 0, bi: 0 });
  const sinId = filas.filter(f => !f.full).length;

  box.innerHTML =
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:1000px;' +
    'table-layout:fixed"><colgroup>' +
    '<col style="width:10%"><col style="width:17%"><col style="width:11%"><col style="width:13%">' +
    '<col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:10%">' +
    '<col style="width:9%">' +
    '</colgroup><thead><tr>' +
    th2('COORDINADOR') + th2('CLIENTE') + th2('ESTADO') + th2('RESPONSABLE') +
    th2('FACT. CONTRATO 2026', 'right') + th2('FACT. S/CONTRATO 2026', 'right') +
    th2('TOTAL 2026 (YTD)', 'right') + th2('TOTAL 2025 (AÑO)', 'right') + th2('BI TOTAL', 'right') +
    '</tr></thead><tbody>' +
    filas.map((f, i) => {
      const op = /NO OPERATIVO/i.test(f.estado) ? 'var(--rd)'
        : /SINIESTRAD/i.test(f.estado) ? '#7A1FAA'
        : /OPERATIVO/i.test(f.estado) ? 'var(--gn)' : 'var(--mut)';
      return '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD2 + ';font-size:.63rem;color:var(--az3);' + SEP2 + '">' + _escH(f.coord) + '</td>' +
        '<td style="' + TD2 + ';font-size:.64rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;' +
          SEP2 + '" title="' + _escH(f.full || 'Cliente no identificado en la base') + '">' +
          _escH(f.cliente) + (f.full ? '' :
            ' <span style="font-weight:400;color:var(--rd);font-size:.55rem">· sin identificar</span>') +
          '</td>' +
        '<td style="' + TD2 + ';font-size:.6rem;font-weight:700;color:' + op + ';' + SEP2 + '">' +
          _escH(f.estado) + '</td>' +
        '<td style="' + TD2 + ';font-size:.61rem;color:var(--mut);overflow:hidden;text-overflow:ellipsis;' +
          SEP2 + '">' + _escH(f.resp) + '</td>' +
        n2(f.fc ? mm(f.fc) : '—', f.fc ? 'color:var(--az2);font-weight:600;' : 'color:var(--mut);') +
        n2(f.fs ? mm(f.fs) : '—', f.fs ? 'color:var(--or);font-weight:600;' : 'color:var(--mut);') +
        n2(f.ft ? mm(f.ft) : '—', f.ft ? 'font-weight:700;color:var(--az1);' : 'color:var(--mut);') +
        n2(f.f25 ? mm(f.f25) : '—', 'color:var(--mut);') +
        n2(f.bi ? f.bi.toLocaleString('es-CL') : '—', f.bi ? 'color:var(--teal);font-weight:600;' : 'color:var(--mut);') +
        '</tr>';
    }).join('') +
    '</tbody><tfoot><tr style="background:var(--az3);color:#fff;font-weight:700">' +
    '<td colspan="4" style="padding:.4rem .6rem;font-size:.63rem;' + SEP2 + '">TOTAL · ' +
      filas.length + ' casos</td>' +
    '<td style="padding:.4rem .6rem;text-align:right;font-size:.63rem;' + SEP2 + '">' + mm(T.fc) + '</td>' +
    '<td style="padding:.4rem .6rem;text-align:right;font-size:.63rem;' + SEP2 + '">' + mm(T.fs) + '</td>' +
    '<td style="padding:.4rem .6rem;text-align:right;font-size:.63rem;' + SEP2 + '">' + mm(T.ft) + '</td>' +
    '<td style="padding:.4rem .6rem;text-align:right;font-size:.63rem;' + SEP2 + '">' + mm(T.f25) + '</td>' +
    '<td style="padding:.4rem .6rem;text-align:right;font-size:.63rem">' + T.bi.toLocaleString('es-CL') + '</td>' +
    '</tr></tfoot></table></div>' +
    '<p style="font-size:.57rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
    'La facturación y la base instalada se cruzan por nombre de cliente: la hoja de casos lo escribe ' +
    'abreviado y a mano, así que se emparejan las palabras distintivas del nombre. ' +
    'La facturación y su corte entre <strong>contratos</strong> y <strong>sin contrato</strong> vienen de ' +
    'la hoja FACTURACIÓN del Excel, que ya los trae calculados por cliente; las dos columnas suman el ' +
    'total. Un valor negativo en «sin contrato» significa que lo devengado del contrato superó lo ' +
    'facturado en el año, y se muestra tal cual. ' +
    (sinId ? '<strong style="color:var(--rd)">' + sinId + ' caso' + (sinId === 1 ? '' : 's') +
      ' sin identificar</strong>: el nombre abreviado no calza con ningún cliente de la base, así que ' +
      'sus cifras van en blanco en vez de asignarse a un cliente equivocado.' : '') + '</p>';

  const c = document.getElementById('cas-res-count');
  if (c) c.textContent = filas.length + ' casos' + (sinId ? ' · ' + sinId + ' sin identificar' : '');
}

// ── RESUMEN POR MARCA ─────────────────────────────────────────────
// Una fila por marca: cuántos equipos están detenidos, cuántos tienen
// contrato y cuántos no, y la facturación de los clientes de esa marca.
// La facturación se acumula por contrato distinto: varios equipos parados
// suelen colgar del mismo contrato y sumar por equipo la multiplicaría.
function _renderCasosMarca(equipos) {
  const box = document.getElementById('cas-marca-tabla');
  if (!box) return;
  const g = {};
  const ctrG = {};
  equipos.forEach(e => {
    const m = _normMarca(e.marca);
    const d = g[m] || (g[m] = { eq: 0, con: 0, sin: 0, ctr: {}, cli: {}, cif: 0,
                                vidaSum: 0, vidaN: 0 });
    d.eq++;
    d.cif += (+e.costo_cif || 0);
    // Promedio simple de la vida de los equipos de la marca: se toman sólo los
    // que traen fecha de ingreso, para no arrastrar ceros de filas sin dato.
    const v = _vidaAnios(e);
    if (v != null) { d.vidaSum += v; d.vidaN++; }
    if (e.contrato_num) {
      d.con++;
      d.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
      ctrG[e.contrato_num]  = [e.fac_anual || 0, e.fac_ytd || 0];
    } else d.sin++;
    const c = (e.nombre_cliente || '').trim();
    if (c) d.cli[c] = 1;
  });
  const sum = (o, i) => Object.keys(o).reduce((a, k) => a + o[k][i], 0);
  const D = Object.keys(g).map(m => {
    const d = g[m];
    return { marca: m, eq: d.eq, con: d.con, sin: d.sin, cif: d.cif,
             vida: d.vidaN ? d.vidaSum / d.vidaN : null,
             nCli: Object.keys(d.cli).length, nCtr: Object.keys(d.ctr).length,
             anual: sum(d.ctr, 0), ytd: sum(d.ctr, 1) };
  }).sort((a, b) => b.eq - a.eq || b.ytd - a.ytd);

  if (!D.length) {
    box.innerHTML = '<div style="padding:1.2rem;text-align:center;color:var(--mut);font-size:.68rem">' +
      'Sin equipos para los filtros seleccionados.</div>';
    return;
  }
  const SEP = 'border-right:1px solid var(--brd)';
  const TD  = 'padding:.4rem .7rem;white-space:nowrap';
  const th  = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;' +
    'padding:.42rem .7rem;font-size:.6rem;letter-spacing:.04em;text-align:' + (al || 'left') +
    ';white-space:nowrap;' + SEP + '">' + t + '</th>';
  const maxEq  = Math.max.apply(null, D.map(d => d.eq).concat([1]));
  const cifTot = D.reduce((a, d) => a + d.cif, 0);
  // El total es el promedio sobre todos los equipos, no el promedio de los
  // promedios por marca: una marca con un equipo pesaría lo mismo que una con
  // veinte.
  const vidaST = D.reduce((a, d) => a + (d.vida != null ? d.vida * d.eq : 0), 0);
  const vidaNT = D.reduce((a, d) => a + (d.vida != null ? d.eq : 0), 0);

  box.innerHTML =
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:900px;' +
    'table-layout:fixed"><colgroup>' +
      '<col style="width:15%"><col style="width:6%"><col style="width:8%"><col style="width:8%">' +
      '<col style="width:8%"><col style="width:7%"><col style="width:9%"><col style="width:11%">' +
      '<col style="width:7%"><col style="width:10%"><col style="width:11%">' +
    '</colgroup><thead><tr>' +
      th('MARCA') + th('EQUIPOS', 'right') + th('') + th('CON CONTRATO', 'right') +
      th('SIN CONTRATO', 'right') + th('CLIENTES', 'right') + th('VIDA MEDIA', 'right') +
      th('VALORIZADO', 'right') +
      th('% VALOR.', 'right') + th('FACT. ANUAL ESPERADA', 'right') + th('FACT. A LA FECHA', 'right') +
    '</tr></thead><tbody>' +
    D.map((d, i) =>
      '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD + ';font-size:.72rem;font-weight:700;color:var(--am);overflow:hidden;' +
          'text-overflow:ellipsis;' + SEP + '" title="' + _escH(d.marca) + '">' + _escH(d.marca) + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.73rem;font-weight:700;' + SEP + '">' + d.eq + '</td>' +
        '<td style="padding:.4rem .7rem;' + SEP + '">' +
          '<div style="height:8px;background:var(--gy);border-radius:4px;overflow:hidden;min-width:40px">' +
          '<div style="height:100%;width:' + (d.eq / maxEq * 100) + '%;background:var(--am)"></div></div></td>' +
        '<td style="' + TD + ';text-align:right;font-size:.7rem;color:var(--az2);font-weight:600;' + SEP + '">' +
          (d.con || '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.7rem;color:var(--mut);' + SEP + '">' +
          (d.sin || '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.7rem;' + SEP + '">' + (d.nCli || '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.7rem;font-variant-numeric:tabular-nums;' +
          'color:' + (d.vida >= 10 ? 'var(--rd)' : d.vida >= 7 ? 'var(--or)' : 'var(--mut)') + ';' +
          'font-weight:' + (d.vida >= 7 ? 700 : 400) + ';' + SEP + '">' +
          (d.vida != null ? fN1(d.vida) + ' años' : '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.71rem;font-weight:700;color:var(--or);' +
          'font-variant-numeric:tabular-nums;' + SEP + '">' + (d.cif ? mm(d.cif) : '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.68rem;color:var(--or);' + SEP + '">' +
          (d.cif && cifTot ? (d.cif / cifTot * 100).toFixed(1).replace('.', ',') + '%' : '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.71rem;font-weight:600;color:var(--az1);' +
          'font-variant-numeric:tabular-nums;' + SEP + '">' + (d.anual ? mm(d.anual) : '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.71rem;font-weight:600;color:var(--teal);' +
          'font-variant-numeric:tabular-nums">' + (d.ytd ? mm(d.ytd) : '—') + '</td>' +
      '</tr>').join('') +
    '</tbody><tfoot><tr style="background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.45rem .7rem;font-size:.7rem;' + SEP + '">TOTAL · ' + D.length + ' marcas</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;' + SEP + '">' +
        D.reduce((a, d) => a + d.eq, 0) + '</td>' +
      '<td style="' + SEP + '"></td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;' + SEP + '">' +
        D.reduce((a, d) => a + d.con, 0) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;' + SEP + '">' +
        D.reduce((a, d) => a + d.sin, 0) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;' + SEP + '">' +
        Object.keys(equipos.reduce((o, e) => { const c = (e.nombre_cliente || '').trim();
          if (c) o[c] = 1; return o; }, {})).length + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;font-variant-numeric:tabular-nums;' +
        SEP + '">' + (vidaNT ? fN1(vidaST / vidaNT) + ' años' : '—') + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.71rem;font-variant-numeric:tabular-nums;' +
        SEP + '">' + mm(cifTot) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;' + SEP + '">100%</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.71rem;font-variant-numeric:tabular-nums;' +
        SEP + '">' + mm(sum(ctrG, 0)) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.71rem;font-variant-numeric:tabular-nums">' +
        mm(sum(ctrG, 1)) + '</td>' +
    '</tr></tfoot></table></div>' +
    '<p style="font-size:.6rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      'La vida media es el promedio de los años transcurridos desde la fecha de ingreso de cada equipo ' +
      'hasta la fecha de corte; el total pondera por número de equipos, no por marca. ' +
      'El valorizado es el costo CIF de los equipos detenidos de esa marca. La facturación es la de los ' +
      'contratos asociados a esos equipos, acumulada por contrato ' +
      'distinto y no por equipo. Los equipos sin contrato no aportan monto, y un mismo contrato puede ' +
      'aparecer en más de una marca, por lo que las filas no suman el total.</p>';

  const c = document.getElementById('cas-marca-count');
  if (c) c.textContent = D.length + ' marcas · ' + D.reduce((a, d) => a + d.eq, 0) + ' equipos';
}

// ── EXPORTAR EL RESUMEN POR MARCA ─────────────────────────────────
async function casosMarcaExportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('cas-marca-pdf');
  const ICON = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  let wrap = null;
  try {
    const src = document.getElementById('cas-marca-tabla');
    if (!src) throw new Error('No se encontró el contenido');
    const hoy = (window.APP_DATA || {}).hoy || '';
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1240px;' +
      'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    const enc = document.createElement('div');
    enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
    enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
      'TECSERVICE — Equipos Detenidos por Marca</span>' +
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
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, 'Equipos_Detenidos_por_Marca_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);
  } catch (err) {
    console.error('casosMarcaExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
  }
}

// ── RESUMEN POR CLIENTE ───────────────────────────────────────────
// Una fila por cliente con equipos detenidos: cuántos equipos, su
// valorizado (costo CIF), los ingresos reales a la fecha y el monto de
// contrato anual esperado —ambos acumulados por contrato distinto, como
// en el Resumen por Marca— y la base instalada total del cliente, cruzada
// por nombre contra la hoja "Base Instalada". Los equipos sin cliente
// asociado (sin N° de Contrato) se agrupan en una fila «(sin cliente
// asociado)» para que el valorizado de esta tabla cuadre con el total
// general de equipos detenidos.
const _CAS_CLI_SIN = '(sin cliente asociado)';
function _casCliNorm(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function _renderCasosCliente(equipos) {
  const box = document.getElementById('cas-cli-tabla');
  if (!box) return;
  const g = {};
  equipos.forEach(e => {
    const cli = (e.nombre_cliente || '').trim() || _CAS_CLI_SIN;
    const d = g[cli] || (g[cli] = { eq: 0, cif: 0, ctr: {} });
    d.eq++;
    d.cif += (+e.costo_cif || 0);
    if (e.contrato_num) d.ctr[e.contrato_num] = [e.fac_anual || 0, e.fac_ytd || 0];
  });
  const sum = (o, i) => Object.keys(o).reduce((a, k) => a + o[k][i], 0);

  const biMap = {};
  (((window.APP_DATA || {}).base_instalada || {}).clientes || []).forEach(c => {
    biMap[_casCliNorm(c.nombre)] = c.total || 0;
  });

  const D = Object.keys(g).map(cli => {
    const d = g[cli];
    const k = _casCliNorm(cli);
    return {
      cliente: cli, eq: d.eq, cif: d.cif,
      anual: sum(d.ctr, 0), ytd: sum(d.ctr, 1),
      baseInst: cli === _CAS_CLI_SIN ? null : (biMap.hasOwnProperty(k) ? biMap[k] : null),
    };
  }).sort((a, b) => (a.cliente === _CAS_CLI_SIN) - (b.cliente === _CAS_CLI_SIN) ||
    b.eq - a.eq || b.cif - a.cif);

  if (!D.length) {
    box.innerHTML = '<div style="padding:1.2rem;text-align:center;color:var(--mut);font-size:.68rem">' +
      'Sin equipos para los filtros seleccionados.</div>';
    return;
  }
  const SEP = 'border-right:1px solid var(--brd)';
  const TD  = 'padding:.4rem .7rem;white-space:nowrap';
  const th  = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;' +
    'padding:.42rem .7rem;font-size:.6rem;letter-spacing:.04em;text-align:' + (al || 'left') +
    ';white-space:nowrap;' + SEP + '">' + t + '</th>';
  const maxEq   = Math.max.apply(null, D.map(d => d.eq).concat([1]));
  const cifTot  = D.reduce((a, d) => a + d.cif, 0);
  const DCli    = D.filter(d => d.cliente !== _CAS_CLI_SIN);
  const nMatch  = DCli.filter(d => d.baseInst != null).length;

  box.innerHTML =
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:980px;' +
    'table-layout:fixed"><colgroup>' +
      '<col style="width:22%"><col style="width:9%"><col style="width:9%">' +
      '<col style="width:14%"><col style="width:15%"><col style="width:12%"><col style="width:14%">' +
    '</colgroup><thead><tr>' +
      th('CLIENTE') + th('EQUIPOS', 'right') + th('') +
      th('VALORIZADO', 'right') + th('INGRESOS · FACT. A LA FECHA', 'right') +
      th('BASE INSTALADA', 'right') + th('CONTRATO ANUAL ESPERADO', 'right') +
    '</tr></thead><tbody>' +
    D.map((d, i) => {
      const sinCli = d.cliente === _CAS_CLI_SIN;
      const nomCol = sinCli
        ? '<span style="font-style:italic;color:var(--mut)">' + _escH(d.cliente) + '</span>'
        : _escH(d.cliente);
      return '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD + ';font-size:.7rem;font-weight:700;color:var(--az1);overflow:hidden;' +
          'text-overflow:ellipsis;' + SEP + '" title="' + _escH(d.cliente) + '">' + nomCol + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.72rem;font-weight:700;' + SEP + '">' + d.eq + '</td>' +
        '<td style="padding:.4rem .7rem;' + SEP + '">' +
          '<div style="height:8px;background:var(--gy);border-radius:4px;overflow:hidden;min-width:40px">' +
          '<div style="height:100%;width:' + (d.eq / maxEq * 100) + '%;background:var(--am)"></div></div></td>' +
        '<td style="' + TD + ';text-align:right;font-size:.71rem;font-weight:700;color:var(--or);' +
          'font-variant-numeric:tabular-nums;' + SEP + '">' + (d.cif ? mm(d.cif) : '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.71rem;font-weight:600;color:var(--teal);' +
          'font-variant-numeric:tabular-nums;' + SEP + '">' + (d.ytd ? mm(d.ytd) : '—') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.7rem;' + SEP + '">' +
          (sinCli ? '<span style="color:var(--mut)">—</span>'
            : d.baseInst != null ? d.baseInst : '<span style="color:var(--mut)">s/d</span>') + '</td>' +
        '<td style="' + TD + ';text-align:right;font-size:.71rem;font-weight:600;color:var(--az1);' +
          'font-variant-numeric:tabular-nums">' + (d.anual ? mm(d.anual) : '—') + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody><tfoot><tr style="background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.45rem .7rem;font-size:.7rem;' + SEP + '">TOTAL · ' + DCli.length + ' clientes</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;' + SEP + '">' +
        D.reduce((a, d) => a + d.eq, 0) + '</td>' +
      '<td style="' + SEP + '"></td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.71rem;font-variant-numeric:tabular-nums;' +
        SEP + '">' + mm(cifTot) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.71rem;font-variant-numeric:tabular-nums;' +
        SEP + '">' + mm(D.reduce((a, d) => a + d.ytd, 0)) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;' + SEP + '">' +
        DCli.reduce((a, d) => a + (d.baseInst || 0), 0) + '</td>' +
      '<td style="padding:.45rem .7rem;text-align:right;font-size:.71rem;font-variant-numeric:tabular-nums">' +
        mm(D.reduce((a, d) => a + d.anual, 0)) + '</td>' +
    '</tr></tfoot></table></div>' +
    '<p style="font-size:.6rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      'Los ingresos (fact. a la fecha) y el contrato anual esperado se acumulan por contrato distinto del ' +
      'cliente y no por equipo, porque varios equipos detenidos suelen compartir contrato. La fila «' +
      _CAS_CLI_SIN + '» agrupa los equipos sin N° de Contrato, por eso el valorizado de esta tabla cuadra con ' +
      'el de la tarjeta Total. La base instalada se cruza por nombre exacto de cliente contra la hoja "Base ' +
      'Instalada"' + (nMatch < DCli.length ? '; no se encontró coincidencia para ' + (DCli.length - nMatch) +
        ' de ' + DCli.length + ' clientes (nombre distinto entre hojas)' : '') + '.</p>';

  const c = document.getElementById('cas-cli-count');
  if (c) c.textContent = DCli.length + ' clientes · ' + D.reduce((a, d) => a + d.eq, 0) + ' equipos';
}

// ── EXPORTAR EL RESUMEN POR CLIENTE ───────────────────────────────
async function casosClienteExportPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('cas-cli-pdf');
  const ICON = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  let wrap = null;
  try {
    const src = document.getElementById('cas-cli-tabla');
    if (!src) throw new Error('No se encontró el contenido');
    const hoy = (window.APP_DATA || {}).hoy || '';
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1240px;' +
      'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    const enc = document.createElement('div');
    enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
    enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
      'TECSERVICE — Equipos Detenidos · Resumen por Cliente</span>' +
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
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, 'Resumen_Clientes_Detenidos_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);
  } catch (err) {
    console.error('casosClienteExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
  }
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
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, 'Resumen_Equipos_Detenidos_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);
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
