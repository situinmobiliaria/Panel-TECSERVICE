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
    <h2>Casos Relevantes · Equipos Detenidos</h2>
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

  <!-- Buscador global -->
  <div class="card" style="margin-bottom:.75rem">
    <div class="ctrl" style="gap:.55rem;flex-wrap:wrap">
      <span class="ctrl-lbl">Buscar</span>
      <input type="text" id="cas-search" class="search-inp" placeholder="🔍 Cliente, problema, equipo…"
        style="width:260px;font-size:.65rem;padding:.28rem .55rem" oninput="renderCasos()">
    </div>
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
      <table class="tbl" id="cas-table1" style="min-width:900px">
        <thead><tr>
          <th style="min-width:110px">Coordinador</th>
          <th style="min-width:160px">Cliente</th>
          <th style="min-width:200px">Problema</th>
          <th style="min-width:120px">Responsable</th>
          <th style="min-width:320px">Comentario</th>
          <th style="min-width:120px">Salesforce</th>
        </tr></thead>
        <tbody id="cas-tbody1"></tbody>
      </table>
    </div>
  </div>

  <!-- Tabla 2: Equipos Detenidos -->
  <div class="card">
    <div class="ch" style="background:linear-gradient(135deg,rgba(255,160,0,.18),rgba(255,160,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--am)">Equipos Detenidos</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t2-count">—</span>
      <div class="btn-g" id="cas-btn-gar" style="margin-left:auto">
        <button class="btn on" data-cgar="todas">Todos</button>
        <button class="btn" data-cgar="vigente">Con Garantía</button>
        <button class="btn" data-cgar="sin">Sin Garantía</button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table2" style="min-width:1800px">
        <thead><tr>
          <th style="min-width:120px">Modelo</th>
          <th style="min-width:200px">Nombre Activo</th>
          <th style="min-width:110px">N° Serie</th>
          <th style="min-width:90px">Marca</th>
          <th style="min-width:100px">Estado</th>
          <th style="min-width:110px">Coordinadora</th>
          <th style="min-width:260px">Comentario Coordinadora</th>
          <th style="min-width:150px">Razón Estandarizada</th>
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

  <!-- Tabla 3: Resumen por Modelo/Marca -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(255,160,0,.18),rgba(255,160,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--am)">Tabla Resumen Equipos</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t3-count">—</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table3" style="min-width:800px">
        <thead><tr>
          <th style="min-width:100px">Marca</th>
          <th style="min-width:140px">Familia de Equipo</th>
          <th style="min-width:110px">N° Equipos Detenidos</th>
          <th style="min-width:100px">N° Contratos</th>
          <th style="min-width:100px">N° Sin Contrato</th>
          <th style="min-width:110px">N° Total Asociados</th>
          <th style="min-width:140px">$ Facturación Mes (Contratos)</th>
        </tr></thead>
        <tbody id="cas-tbody3"></tbody>
        <tfoot id="cas-tfoot3"></tfoot>
      </table>
    </div>
  </div>

  <!-- Tabla 4: Resumen por Razón -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(192,0,0,.18),rgba(192,0,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--rd)">Resumen por Razón</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t4-count">—</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table4" style="min-width:700px">
        <thead><tr>
          <th style="min-width:220px">Razón</th>
          <th style="min-width:100px">N° Equipos</th>
          <th style="min-width:120px">$ por Cliente</th>
          <th style="min-width:120px">$ Contrato</th>
          <th style="min-width:90px">% del Total</th>
        </tr></thead>
        <tbody id="cas-tbody4"></tbody>
        <tfoot id="cas-tfoot4"></tfoot>
      </table>
    </div>
  </div>

  <!-- Tabla 5: Detalle de Equipos por Razón -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(192,0,0,.18),rgba(192,0,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--rd)">Detalle de Equipos por Razón</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t5-count">—</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table5" style="min-width:1200px">
        <thead><tr>
          <th style="min-width:190px">Razón</th>
          <th style="min-width:140px">Familia de Equipo</th>
          <th style="min-width:100px">Marca</th>
          <th style="min-width:200px">Cliente</th>
          <th style="min-width:110px">$ por Cliente</th>
          <th style="min-width:110px">$ Contrato</th>
          <th style="min-width:100px">% del Contrato</th>
        </tr></thead>
        <tbody id="cas-tbody5"></tbody>
        <tfoot id="cas-tfoot5"></tfoot>
      </table>
    </div>
    <div style="padding:.4rem .9rem;background:var(--gy);border-top:1px solid var(--brd);font-size:.58rem;color:var(--mut)">
      $ por Cliente = Facturación Neta Mes · $ Contrato = Facturación Anual Esperada · % del Contrato = Facturación a la Fecha / Facturación Anual Esperada
    </div>
  </div>

  <!-- Tabla 6: Resumen por Cliente -->
  <div class="card" style="margin-top:.9rem">
    <div class="ch" style="background:linear-gradient(135deg,rgba(51,68,141,.18),rgba(51,68,141,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--az2)">Resumen por Cliente</span>
      <span style="font-size:.58rem;color:var(--mut)" id="cas-t6-count">—</span>
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="cas-table6" style="min-width:900px">
        <thead><tr>
          <th style="min-width:260px">Cliente</th>
          <th style="min-width:100px">N° Equipos</th>
          <th style="min-width:180px">Familias de Equipo</th>
          <th style="min-width:120px">$ por Cliente</th>
          <th style="min-width:120px">$ Contrato</th>
          <th style="min-width:90px">% del Total</th>
        </tr></thead>
        <tbody id="cas-tbody6"></tbody>
        <tfoot id="cas-tfoot6"></tfoot>
      </table>
    </div>
  </div>`;
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
  const m = (marca || '').trim().toUpperCase();
  return _MARCA_NORM[m] || (marca || '').trim() || 'Sin marca';
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

// ── CLASIFICACIÓN ESTANDARIZADA DEL COMENTARIO DE COORDINADORA ─────
// Interpreta el texto libre de "Comentario Coordinadora" y lo agrupa en
// categorías fijas mediante reglas por palabra clave (orden = prioridad,
// gana la primera regla que calza). Así, cuando el Excel se actualiza con
// comentarios nuevos, siguen clasificándose sin tener que tocar el código.
const _RAZON_REGLAS = [
  { label: 'Resuelto / Operativo',                    color: 'var(--teal)', rx: /reparad|reemplazad|equipo operativo|^operativo$/i },
  { label: 'Entregado sin Reparar',                    color: 'var(--am)',   rx: /entregado.*sin reparaci/i },
  { label: 'Baja / Desinstalación',                    color: 'var(--rd)',   rx: /dado de baja|\bbaja\b|desinstala|se quema/i },
  { label: 'Equipo No Ubicado',                        color: '#7A1FAA',     rx: /no se (encuentra|encuntra)|no esta en (el|la)/i },
  { label: 'Pendiente Confirmación del Cliente',       color: 'var(--az2)',  rx: /confirmaci[oó]n.*cliente|posicionado/i },
  { label: 'Trabajos / Reparación en Curso',           color: 'var(--am)',   rx: /soldadura|trabajos de/i },
  { label: 'Visita Correctiva Programada',             color: 'var(--az2)',  rx: /visita correctiva|se realizar[aá]/i },
  { label: 'Esperando Repuesto',                       color: 'var(--rd)',   rx: /repuesto|tarjeta|v[aá]lvula|pieza|sin stock|puerta/i },
  { label: 'Esperando OC / Cotización del Cliente',    color: '#E87722',     rx: /\boc\b|cotizaci[oó]n|orden de compra/i },
  { label: 'Esperando Diagnóstico / Evaluación Técnica', color: 'var(--az3)', rx: /evaluando|diagn[oó]stico|revisar|res?puesta de|\bmp\b|f[aá]brica|software/i },
];

function _clasificarRazon(comentario) {
  const c = (comentario || '').trim();
  if (!c) return { label: 'Sin Información', color: 'var(--mut)' };
  for (const r of _RAZON_REGLAS) if (r.rx.test(c)) return { label: r.label, color: r.color };
  return { label: 'Otro', color: 'var(--mut)' };
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
    return (c.cliente + c.problema + c.comentario + c.coordinador + c.responsable)
      .toLowerCase().includes(busq);
  });

  const tbody1 = document.getElementById('cas-tbody1');
  if (tbody1) {
    tbody1.innerHTML = casosFilt.map(c => {
      const sfLink = c.salesforce
        ? `<span class="pill pte" style="font-size:.52rem;font-family:'Roboto Mono',monospace">${_escH(c.salesforce)}</span>`
        : '<span style="color:var(--mut);font-size:.6rem">—</span>';
      return `<tr>
        <td><span style="font-size:.62rem;font-weight:600;color:var(--az3)">${_escH(c.coordinador)||'<span style="color:var(--mut)">—</span>'}</span></td>
        <td><strong style="font-size:.65rem">${_escH(c.cliente)}</strong></td>
        <td>
          <div style="font-size:.63rem;font-weight:700;color:#e00000">${_escH(c.problema)}</div>
        </td>
        <td><span style="font-size:.62rem">${_escH(c.responsable)||'<span style="color:var(--mut)">No definido</span>'}</span></td>
        <td>
          <div style="font-size:.6rem;line-height:1.55;color:#111;font-weight:600;text-transform:uppercase;max-width:360px">
            ${_escH(c.comentario)||'<span style="color:var(--mut);text-transform:none;font-weight:400">Sin comentario</span>'}
          </div>
        </td>
        <td>${sfLink}</td>
      </tr>`;
    }).join('');
  }

  const t1count = document.getElementById('cas-t1-count');
  if (t1count) t1count.textContent = casosFilt.length + ' caso' + (casosFilt.length !== 1 ? 's' : '');

  // ── Tabla 2: Equipos Detenidos ────────────────────────────────
  const eqFilt = equipos.filter(e => {
    const garOk = garF === 'todas'
      ? true
      : garF === 'vigente'
        ? e.garantia.toUpperCase().includes('VIGENTE')
        : !e.garantia.toUpperCase().includes('VIGENTE');
    if (!garOk) return false;
    if (!busq) return true;
    return (e.modelo + e.nombre + e.marca + e.coordinadora + e.comentario_coord + e.comentario_mat)
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
      const razon = _clasificarRazon(e.comentario_coord);
      const razonCell = `<span class="badge" style="font-size:.53rem;background:${razon.color}18;color:${razon.color};border:1px solid ${razon.color}55">${razon.label}</span>`;
      return `<tr>
        <td><strong style="font-size:.63rem;color:var(--am)">${_escH(e.modelo)}</strong></td>
        <td><span style="font-size:.63rem">${_escH(e.nombre)}</span></td>
        <td><span style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${_escH(e.serie)||'—'}</span></td>
        <td><span style="font-size:.62rem">${_escH(e.marca)}</span></td>
        <td style="text-align:center">${estadoBadge}</td>
        <td><span style="font-size:.62rem;color:var(--az3)">${_escH(e.coordinadora)||'—'}</span></td>
        <td><div style="font-size:.6rem;line-height:1.5;max-width:280px;color:#111;font-weight:600">${_escH(e.comentario_coord)||_dash}</div></td>
        <td style="text-align:center">${razonCell}</td>
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

  // ── Tabla 3: Resumen por Familia de Equipo/Marca ────────────────
  const tbody3 = document.getElementById('cas-tbody3');
  const tfoot3 = document.getElementById('cas-tfoot3');
  if (tbody3) {
    const _fmtM3 = v => v > 0 ? 'MM$' + fN1(v / 1e6) : '—';

    // Agrupar equipos filtrados por Marca (normalizada) → Familia de equipo (normalizada)
    const porMarca = {};
    eqFilt.forEach(e => {
      const marca  = _normMarca(e.marca);
      const modelo = _familiaModelo(marca, e.modelo);
      if (!porMarca[marca]) porMarca[marca] = {};
      if (!porMarca[marca][modelo]) porMarca[marca][modelo] = { cantidad: 0, conContrato: 0, sinContrato: 0, facMes: 0 };
      const g = porMarca[marca][modelo];
      g.cantidad++;
      if (e.contrato_num) { g.conContrato++; g.facMes += (e.neta_mes || 0); }
      else g.sinContrato++;
    });

    const marcas = Object.keys(porMarca).sort();
    const html = [];
    let granCant = 0, granCon = 0, granSin = 0, granTot = 0, granFac = 0;

    marcas.forEach(marca => {
      const modelos = Object.keys(porMarca[marca]).sort();
      let subCant = 0, subCon = 0, subSin = 0, subFac = 0;

      modelos.forEach((modelo, idx) => {
        const g = porMarca[marca][modelo];
        const total = g.conContrato + g.sinContrato;
        subCant += g.cantidad; subCon += g.conContrato; subSin += g.sinContrato; subFac += g.facMes;

        const marcaCell = idx === 0
          ? `<td rowspan="${modelos.length + 1}" style="font-weight:700;font-size:.62rem;vertical-align:middle;text-align:center;background:rgba(255,160,0,.08)">${_escH(marca)}</td>`
          : '';

        html.push(`<tr>
          ${marcaCell}
          <td><span style="font-size:.62rem;font-weight:600;color:var(--am)">${_escH(modelo)}</span></td>
          <td style="text-align:center;font-size:.62rem">${g.cantidad}</td>
          <td style="text-align:center;font-size:.62rem;color:var(--az2)">${g.conContrato}</td>
          <td style="text-align:center;font-size:.62rem;color:var(--mut)">${g.sinContrato}</td>
          <td style="text-align:center;font-size:.62rem;font-weight:700">${total}</td>
          <td style="text-align:right;font-size:.62rem;font-weight:700;color:var(--teal)">${_fmtM3(g.facMes)}</td>
        </tr>`);
      });

      const subTotal = subCon + subSin;
      html.push(`<tr style="background:rgba(255,160,0,.14)">
        <td colspan="2" style="text-align:right;font-size:.6rem;font-style:italic;color:var(--txt);padding:.3rem .6rem">Subtotal ${_escH(marca)}</td>
        <td style="text-align:center;font-size:.62rem;font-weight:700">${subCant}</td>
        <td style="text-align:center;font-size:.62rem;font-weight:700;color:var(--az2)">${subCon}</td>
        <td style="text-align:center;font-size:.62rem;font-weight:700;color:var(--mut)">${subSin}</td>
        <td style="text-align:center;font-size:.62rem;font-weight:800">${subTotal}</td>
        <td style="text-align:right;font-size:.62rem;font-weight:800;color:var(--teal)">${_fmtM3(subFac)}</td>
      </tr>`);

      granCant += subCant; granCon += subCon; granSin += subSin; granTot += subTotal; granFac += subFac;
    });

    tbody3.innerHTML = html.join('') || '<tr><td colspan="7" style="text-align:center;padding:1.2rem;color:var(--mut)">Sin equipos para los filtros seleccionados</td></tr>';

    if (tfoot3) {
      tfoot3.innerHTML = marcas.length ? `<tr>
        <td colspan="2" style="padding:.4rem .7rem;font-size:.62rem">Total General · ${marcas.length} marca${marcas.length !== 1 ? 's' : ''}</td>
        <td style="text-align:center;font-size:.65rem">${granCant}</td>
        <td style="text-align:center;font-size:.65rem">${granCon}</td>
        <td style="text-align:center;font-size:.65rem">${granSin}</td>
        <td style="text-align:center;font-size:.65rem">${granTot}</td>
        <td style="text-align:right;font-size:.65rem">${_fmtM3(granFac)}</td>
      </tr>` : '';
    }

    const t3count = document.getElementById('cas-t3-count');
    if (t3count) t3count.textContent = marcas.length + ' marca' + (marcas.length !== 1 ? 's' : '') + ' · ' + eqFilt.length + ' equipo' + (eqFilt.length !== 1 ? 's' : '');
  }

  // ── Tabla 4 y 5: Resumen y Detalle por Razón ────────────────────
  const tbody4 = document.getElementById('cas-tbody4');
  const tfoot4 = document.getElementById('cas-tfoot4');
  const tbody5 = document.getElementById('cas-tbody5');
  const tfoot5 = document.getElementById('cas-tfoot5');
  if (tbody4 || tbody5) {
    const _fmtM4  = v => v > 0 ? 'MM$' + fN1(v / 1e6) : '—';
    const _dash4  = '<span style="color:var(--mut);font-size:.6rem">—</span>';
    const _noAsoc4 = '<span style="font-size:.57rem;color:var(--mut);font-style:italic">SIN CLIENTE ASOCIADO</span>';

    // Agrupar equipos filtrados por Razón estandarizada
    const porRazon = {};
    eqFilt.forEach(e => {
      const razon = _clasificarRazon(e.comentario_coord);
      if (!porRazon[razon.label]) porRazon[razon.label] = { color: razon.color, equipos: [] };
      porRazon[razon.label].equipos.push(e);
    });
    const razones = Object.keys(porRazon).sort((a, b) => porRazon[b].equipos.length - porRazon[a].equipos.length);

    // ── Tabla 4: Resumen por Razón ──────────────────────────────
    if (tbody4) {
      const filas = razones.map(lbl => {
        const g = porRazon[lbl];
        const sumCliente  = g.equipos.reduce((s, e) => s + (e.nombre_cliente ? (e.neta_mes  || 0) : 0), 0);
        const sumContrato = g.equipos.reduce((s, e) => s + (e.nombre_cliente ? (e.fac_anual || 0) : 0), 0);
        return { lbl, color: g.color, cant: g.equipos.length, sumCliente, sumContrato };
      });
      const totContratoGlobal = filas.reduce((s, f) => s + f.sumContrato, 0);
      const gran4Cant     = filas.reduce((s, f) => s + f.cant, 0);
      const gran4Cliente  = filas.reduce((s, f) => s + f.sumCliente, 0);
      const gran4Contrato = filas.reduce((s, f) => s + f.sumContrato, 0);

      tbody4.innerHTML = filas.map(f => {
        const pct = totContratoGlobal > 0 ? (f.sumContrato / totContratoGlobal * 100) : 0;
        return `<tr>
          <td><span class="badge" style="font-size:.55rem;background:${f.color}18;color:${f.color};border:1px solid ${f.color}55">${_escH(f.lbl)}</span></td>
          <td style="text-align:center;font-size:.63rem;font-weight:700">${f.cant}</td>
          <td style="text-align:right;font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM4(f.sumCliente)}</td>
          <td style="text-align:right;font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM4(f.sumContrato)}</td>
          <td style="text-align:right;font-size:.63rem;color:var(--mut)">${f.sumContrato > 0 ? fN1(pct) + '%' : '—'}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center;padding:1.2rem;color:var(--mut)">Sin equipos para los filtros seleccionados</td></tr>';

      if (tfoot4) {
        tfoot4.innerHTML = razones.length ? `<tr>
          <td style="padding:.4rem .7rem;font-size:.62rem">Total General · ${razones.length} ${razones.length !== 1 ? 'razones' : 'razón'}</td>
          <td style="text-align:center;font-size:.65rem">${gran4Cant}</td>
          <td style="text-align:right;font-size:.65rem">${_fmtM4(gran4Cliente)}</td>
          <td style="text-align:right;font-size:.65rem">${_fmtM4(gran4Contrato)}</td>
          <td style="text-align:right;font-size:.65rem">100,0%</td>
        </tr>` : '';
      }
      const t4count = document.getElementById('cas-t4-count');
      if (t4count) t4count.textContent = razones.length + ' ' + (razones.length !== 1 ? 'razones' : 'razón') + ' · ' + eqFilt.length + ' equipo' + (eqFilt.length !== 1 ? 's' : '');
    }

    // ── Tabla 5: Detalle de Equipos por Razón ───────────────────
    if (tbody5) {
      const html5 = [];
      let gran5Cant = 0, gran5Cliente = 0, gran5Contrato = 0;

      razones.forEach(lbl => {
        const g = porRazon[lbl];
        let firstRow = true;
        let subCant = 0, subCliente = 0, subContrato = 0;

        g.equipos.forEach(e => {
          const marca   = _normMarca(e.marca);
          const familia = _familiaModelo(marca, e.modelo);
          const razonCell = firstRow
            ? `<td rowspan="${g.equipos.length}" style="vertical-align:top;padding-top:.4rem;text-align:center;background:${g.color}12">
                <span class="badge" style="font-size:.53rem;background:${g.color}18;color:${g.color};border:1px solid ${g.color}55">${_escH(lbl)}</span>
              </td>`
            : '';
          firstRow = false;

          const tieneCliente = !!e.nombre_cliente;
          const clienteCell = tieneCliente
            ? `<strong style="font-size:.62rem">${_escH(e.nombre_cliente)}</strong>`
            : _noAsoc4;
          const porClienteCell = tieneCliente && e.neta_mes > 0
            ? `<span style="font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM4(e.neta_mes)}</span>` : _dash4;
          const contratoCell = tieneCliente && e.fac_anual > 0
            ? `<span style="font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM4(e.fac_anual)}</span>` : _dash4;
          const pctContrato = (tieneCliente && e.fac_anual > 0) ? (e.fac_ytd / e.fac_anual) * 100 : null;
          const pctCell = pctContrato !== null
            ? `<span style="font-size:.62rem;font-weight:700;color:var(--teal)">${fN1(pctContrato)}%</span>` : _dash4;

          subCant++;
          subCliente  += (tieneCliente ? (e.neta_mes  || 0) : 0);
          subContrato += (tieneCliente ? (e.fac_anual || 0) : 0);

          html5.push(`<tr>
            ${razonCell}
            <td><span style="font-size:.62rem;font-weight:600;color:var(--am)">${_escH(familia)}</span></td>
            <td><span style="font-size:.6rem">${_escH(marca)}</span></td>
            <td>${clienteCell}</td>
            <td style="text-align:right">${porClienteCell}</td>
            <td style="text-align:right">${contratoCell}</td>
            <td style="text-align:center">${pctCell}</td>
          </tr>`);
        });

        html5.push(`<tr style="background:${g.color}14">
          <td colspan="4" style="text-align:right;font-size:.6rem;font-style:italic;color:var(--txt);padding:.3rem .6rem">Subtotal ${_escH(lbl)} · ${subCant} equipo${subCant !== 1 ? 's' : ''}</td>
          <td style="text-align:right;font-size:.62rem;font-weight:800;color:var(--az2)">${_fmtM4(subCliente)}</td>
          <td style="text-align:right;font-size:.62rem;font-weight:800;color:var(--az2)">${_fmtM4(subContrato)}</td>
          <td></td>
        </tr>`);

        gran5Cant += subCant; gran5Cliente += subCliente; gran5Contrato += subContrato;
      });

      tbody5.innerHTML = html5.join('') || '<tr><td colspan="7" style="text-align:center;padding:1.2rem;color:var(--mut)">Sin equipos para los filtros seleccionados</td></tr>';

      if (tfoot5) {
        tfoot5.innerHTML = razones.length ? `<tr>
          <td colspan="4" style="padding:.4rem .7rem;font-size:.62rem">Total General · ${gran5Cant} equipo${gran5Cant !== 1 ? 's' : ''}</td>
          <td style="text-align:right;font-size:.65rem">${_fmtM4(gran5Cliente)}</td>
          <td style="text-align:right;font-size:.65rem">${_fmtM4(gran5Contrato)}</td>
          <td></td>
        </tr>` : '';
      }
      const t5count = document.getElementById('cas-t5-count');
      if (t5count) t5count.textContent = eqFilt.length + ' equipo' + (eqFilt.length !== 1 ? 's' : '');
    }
  }

  // ── Tabla 6: Resumen por Cliente ─────────────────────────────────
  const tbody6 = document.getElementById('cas-tbody6');
  const tfoot6 = document.getElementById('cas-tfoot6');
  if (tbody6) {
    const _fmtM6 = v => v > 0 ? 'MM$' + fN1(v / 1e6) : '—';

    const porCliente = {};
    eqFilt.forEach(e => {
      const cliente = e.nombre_cliente || 'Sin Cliente Asociado';
      const marca   = _normMarca(e.marca);
      const familia = _familiaModelo(marca, e.modelo);
      if (!porCliente[cliente]) porCliente[cliente] = { cant: 0, familias: new Set(), sumCliente: 0, sumContrato: 0 };
      const g = porCliente[cliente];
      g.cant++;
      g.familias.add(familia);
      if (e.nombre_cliente) {
        g.sumCliente  += (e.neta_mes  || 0);
        g.sumContrato += (e.fac_anual || 0);
      }
    });

    const clientes = Object.keys(porCliente).sort((a, b) => porCliente[b].sumContrato - porCliente[a].sumContrato);
    const totContratoGlobal6 = clientes.reduce((s, c) => s + porCliente[c].sumContrato, 0);
    const gran6Cant     = clientes.reduce((s, c) => s + porCliente[c].cant, 0);
    const gran6Cliente  = clientes.reduce((s, c) => s + porCliente[c].sumCliente, 0);
    const gran6Contrato = clientes.reduce((s, c) => s + porCliente[c].sumContrato, 0);

    tbody6.innerHTML = clientes.map(cli => {
      const g = porCliente[cli];
      const pct = totContratoGlobal6 > 0 ? (g.sumContrato / totContratoGlobal6 * 100) : 0;
      const esSinCliente = cli === 'Sin Cliente Asociado';
      return `<tr>
        <td>${esSinCliente
          ? `<span style="font-size:.6rem;color:var(--mut);font-style:italic">${_escH(cli)}</span>`
          : `<strong style="font-size:.62rem">${_escH(cli)}</strong>`}</td>
        <td style="text-align:center;font-size:.63rem;font-weight:700">${g.cant}</td>
        <td><span style="font-size:.58rem;color:var(--am)">${[...g.familias].map(_escH).join(', ')}</span></td>
        <td style="text-align:right;font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM6(g.sumCliente)}</td>
        <td style="text-align:right;font-size:.63rem;font-weight:700;color:var(--az2)">${_fmtM6(g.sumContrato)}</td>
        <td style="text-align:right;font-size:.63rem;color:var(--mut)">${g.sumContrato > 0 ? fN1(pct) + '%' : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;padding:1.2rem;color:var(--mut)">Sin equipos para los filtros seleccionados</td></tr>';

    if (tfoot6) {
      tfoot6.innerHTML = clientes.length ? `<tr>
        <td style="padding:.4rem .7rem;font-size:.62rem">Total General · ${clientes.length} cliente${clientes.length !== 1 ? 's' : ''}</td>
        <td style="text-align:center;font-size:.65rem">${gran6Cant}</td>
        <td></td>
        <td style="text-align:right;font-size:.65rem">${_fmtM6(gran6Cliente)}</td>
        <td style="text-align:right;font-size:.65rem">${_fmtM6(gran6Contrato)}</td>
        <td style="text-align:right;font-size:.65rem">100,0%</td>
      </tr>` : '';
    }
    const t6count = document.getElementById('cas-t6-count');
    if (t6count) t6count.textContent = clientes.length + ' cliente' + (clientes.length !== 1 ? 's' : '') + ' · ' + eqFilt.length + ' equipo' + (eqFilt.length !== 1 ? 's' : '');
  }

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

  const nota = document.getElementById('cas-nota');
  if (nota) nota.textContent =
    `${eqFilt.length} equipos detenidos · ${totGar} con garantía vigente · ${totSG} sin garantía · datos desde Excel`;

  const tag = document.getElementById('casos-tag');
  if (tag) tag.textContent =
    `${casos.length} casos abiertos · ${equipos.length} equipos detenidos · actualizado al correr el extractor`;
}

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
