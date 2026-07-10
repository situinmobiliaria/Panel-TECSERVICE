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
      return `<tr>
        <td><strong style="font-size:.63rem;color:var(--am)">${_escH(e.modelo)}</strong></td>
        <td><span style="font-size:.63rem">${_escH(e.nombre)}</span></td>
        <td><span style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--mut)">${_escH(e.serie)||'—'}</span></td>
        <td><span style="font-size:.62rem">${_escH(e.marca)}</span></td>
        <td style="text-align:center">${estadoBadge}</td>
        <td><span style="font-size:.62rem;color:var(--az3)">${_escH(e.coordinadora)||'—'}</span></td>
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
