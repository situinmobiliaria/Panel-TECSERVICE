// ═══════════════════════════════════════════════════════════════
// hoja_pipeline.js — Potencial ST Garantías (Pipeline)
// Pipeline comercial de equipos de las hojas PIPELINE Esterilización,
// Dental y Endoscopía, y el potencial de servicio técnico que arrastran
// las garantías de esos equipos.
// Depende de: APP_DATA.pipeline_st
// ═══════════════════════════════════════════════════════════════
(function () {
  const A  = window.APP_DATA || {};
  const P  = A.pipeline_st || {};

  // ── Parámetros del modelo ────────────────────────────────────
  // El potencial ST por garantía se estima como un % del monto del negocio,
  // distinto por línea; sobre ese potencial se asume un margen de 55%.
  // Están acá y no en el extractor para que se vean y se ajusten fácil,
  // igual que las tarifas UF de la Base Instalada.
  const TASA = { 'Esterilización': 0.10, 'Dental': 0.06, 'Endoscopía': 0.06 };
  const MARGEN = 0.55;
  const COL = { 'Esterilización': '#002D73', 'Dental': '#FFC000', 'Endoscopía': '#28D2C3' };
  const colL = l => COL[l] || '#6B7BA8';

  // Tramos de probabilidad de éxito
  const TRAMOS = [
    { k: 'baja',  lbl: '≤ 25%',     min: 0,  max: 25,  col: '#C00000' },
    { k: 'media', lbl: '26 – 50%',  min: 26, max: 50,  col: '#D46000' },
    { k: 'alta',  lbl: '51 – 75%',  min: 51, max: 75,  col: '#8B8200' },
    { k: 'muy',   lbl: '> 75%',     min: 76, max: 100, col: '#00832F' },
  ];

  let _anio = 'todos', _linea = 'todas', _tramo = 'todos', _q = '';
  const _open = new Set();
  let _ch1 = null, _ch2 = null, _ch3 = null, _ch4 = null;

  // ── Formato ──────────────────────────────────────────────────
  const nUn  = v => (v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const nMM  = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL',
                    { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pcN  = v => (v || 0).toFixed(1).replace('.', ',') + '%';
  const pc   = (a, b) => b ? pcN(a / b * 100) : '—';
  const esc  = s => String(s == null ? '' : s).replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SEP  = 'border-right:1px solid var(--brd)';
  const th   = (t, al) => `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;
    padding:.42rem .7rem;font-size:.6rem;letter-spacing:.04em;text-align:${al || 'left'};
    white-space:nowrap;${SEP}">${t}</th>`;
  const thd  = (t, al) => `<th style="background:var(--gy);color:var(--az1);padding:.3rem .7rem;
    font-size:.58rem;letter-spacing:.03em;text-align:${al || 'left'};white-space:nowrap;${SEP}">${t}</th>`;
  const BTN  = 'font-size:.62rem;padding:.22rem .6rem;border-radius:4px;cursor:pointer;white-space:nowrap';
  const FT   = "'Roboto', sans-serif";

  // ── Cálculo ──────────────────────────────────────────────────
  const potST = it => it.monto * (TASA[it.linea] || 0);
  const tramoDe = p => (TRAMOS.find(t => p >= t.min && p <= t.max) || TRAMOS[0]).k;

  function filtrados() {
    const q = _q.trim().toUpperCase();
    return (P.items || []).filter(it =>
      (_anio === 'todos'  || it.anio === _anio) &&
      (_linea === 'todas' || it.linea === _linea) &&
      (_tramo === 'todos' || tramoDe(it.prob) === _tramo) &&
      (!q || it.cli.toUpperCase().includes(q) || (it.prod || '').toUpperCase().includes(q)));
  }

  // Agrega una lista: monto, potencial, margen y ponderación por probabilidad
  function agg(list) {
    const r = { n: 0, cli: new Set(), monto: 0, pond: 0, pot: 0, potPond: 0 };
    list.forEach(it => {
      const p = potST(it), f = it.prob / 100;
      r.n++; r.cli.add(it.cli.toUpperCase());
      r.monto += it.monto; r.pond += it.monto * f;
      r.pot += p;          r.potPond += p * f;
    });
    r.margen = r.pot * MARGEN;
    r.margenPond = r.potPond * MARGEN;
    r.probProm = r.monto ? r.pond / r.monto * 100 : 0;
    return r;
  }

  // ═══════════════════════════════════════════════════════════════
  window.pipeAnio  = function (v) { _anio = v;  render(); };
  window.pipeLinea = function (v) { _linea = v; render(); };
  window.pipeTramo = function (v) { _tramo = v; render(); };
  window.pipeQ     = function (v) { _q = v; tablaDetalle(true); };
  window.pipeTog   = function (k) {
    if (_open.has(k)) _open.delete(k); else _open.add(k);
    tablaResumen();
  };

  // ── Esqueleto ────────────────────────────────────────────────
  function esqueleto() {
    const lbl = t => `<span style="font-size:.62rem;font-weight:700;color:var(--mut);
      letter-spacing:.05em;min-width:96px">${t}</span>`;
    return `
    <div class="sh"><h2>Potencial ST Garantías (Pipeline)</h2><div class="sh-line"></div>
      <span class="sh-tag" id="pipe-tag">—</span></div>

    <div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.75rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('AÑO:')}<div style="display:flex;gap:.25rem" id="pipe-seg-anio"></div>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('LÍNEA:')}<div style="display:flex;gap:.25rem" id="pipe-seg-linea"></div>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('PROBABILIDAD:')}<div style="display:flex;gap:.25rem" id="pipe-seg-tramo"></div>
      </div>
    </div>

    <div id="pipe-kpi" class="g5" style="grid-template-columns:repeat(5,1fr)"></div>

    <div class="card" style="margin-bottom:.9rem">
      <div class="ch"><span class="ct">Resumen por Línea de Negocio</span>
        <span style="font-size:.63rem;color:var(--mut);margin-left:auto">clic en una línea para abrirla por año</span></div>
      <div class="cb"><div id="pipe-resumen"></div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.9rem">
      <div class="card">
        <div class="ch"><span class="ct">Potencial ST por Línea</span></div>
        <div class="cb" style="position:relative;height:300px"><canvas id="cPipeLinea"></canvas></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Monto del Negocio por Año</span></div>
        <div class="cb" style="position:relative;height:300px"><canvas id="cPipeAnio"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1.4rem">
      <div class="card">
        <div class="ch"><span class="ct">Embudo por Probabilidad de Éxito</span>
          <span style="font-size:.63rem;color:var(--mut);margin-left:auto">bruto vs ponderado</span></div>
        <div class="cb" style="position:relative;height:290px"><canvas id="cPipeProb"></canvas></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Mes Probable de Facturación</span></div>
        <div class="cb" style="position:relative;height:290px"><canvas id="cPipeMes"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="ch"><span class="ct">Detalle de Oportunidades</span>
        <input id="pipe-q" placeholder="🔍 Buscar cliente o producto…" oninput="window.pipeQ(this.value)"
          style="margin-left:auto;font-size:.65rem;padding:.28rem .8rem;border:1px solid var(--brd);
                 border-radius:20px;outline:none;width:230px;font-family:'Roboto',sans-serif"></div>
      <div class="cb"><div id="pipe-detalle"></div></div>
    </div>`;
  }

  function segmentadores() {
    const seg = (cont, opts, actual, fn) => {
      const el = document.getElementById(cont);
      if (!el) return;
      el.innerHTML = opts.map(o => {
        const on = String(o.v) === String(actual), c = o.c || 'var(--az2)';
        return `<button onclick="${fn}('${o.v}')" style="${BTN};
          border:1px solid ${on ? c : 'var(--brd)'};background:${on ? c : 'var(--bg2)'};
          color:${on ? '#fff' : 'var(--txt)'};font-weight:${on ? 700 : 400}">${o.t}</button>`;
      }).join('');
    };
    seg('pipe-seg-anio', [{ v: 'todos', t: 'Todos' }].concat((P.anios || []).map(a => ({ v: a, t: a }))),
        _anio, 'window.pipeAnio');
    seg('pipe-seg-linea', [{ v: 'todas', t: 'Todas' }].concat((P.lineas || []).map(l =>
        ({ v: l, t: l, c: colL(l) }))), _linea, 'window.pipeLinea');
    seg('pipe-seg-tramo', [{ v: 'todos', t: 'Todas' }].concat(TRAMOS.map(t =>
        ({ v: t.k, t: t.lbl, c: t.col }))), _tramo, 'window.pipeTramo');
  }

  // ── KPIs ─────────────────────────────────────────────────────
  const kpiHTML = (lbl, val, sub, kc) => `
    <div class="kpi" style="--kc:${kc}">
      <div class="kpi-lbl">${lbl}</div>
      <div class="kpi-val" style="color:${kc}">${val}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;

  function kpis() {
    const r = agg(filtrados());
    const el = document.getElementById('pipe-kpi');
    if (el) el.innerHTML =
      kpiHTML('Oportunidades', nUn(r.n), r.cli.size + ' clientes en pipeline', '#33448D') +
      kpiHTML('Monto del Negocio', nMM(r.monto), 'venta de equipos', '#002D73') +
      kpiHTML('Prob. Promedio', pcN(r.probProm), 'ponderada por monto', '#8B8200') +
      kpiHTML('Potencial ST Garantías', nMM(r.pot), nMM(r.potPond) + ' ponderado', '#00832F') +
      kpiHTML('Margen ST (55%)', nMM(r.margen), nMM(r.margenPond) + ' ponderado', '#0A7D74');

    const tag = document.getElementById('pipe-tag');
    if (tag) tag.textContent =
      'Pipeline comercial de equipos y el servicio técnico que arrastran sus garantías · ' +
      (P.n || 0) + ' oportunidades en ' + (P.lineas || []).length + ' líneas · ' +
      'años ' + (P.anios || []).join(', ');
  }

  // ── Tabla resumen por línea, expandible por año ───────────────
  function tablaResumen() {
    const box = document.getElementById('pipe-resumen');
    if (!box) return;
    const list = filtrados();
    if (!list.length) { box.innerHTML = '<div style="padding:1rem;color:var(--mut);font-size:.7rem">Sin oportunidades para los filtros seleccionados.</div>'; return; }
    const gl = agg(list);
    const TD = 'padding:.4rem .7rem;white-space:nowrap';

    const lineas = (P.lineas || []).filter(l => list.some(it => it.linea === l));
    let rows = '';
    lineas.forEach((l, i) => {
      const sub = list.filter(it => it.linea === l);
      const r = agg(sub);
      const open = _open.has(l);
      rows += `<tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'};cursor:pointer;
                          border-left:3px solid ${colL(l)}" onclick="window.pipeTog('${l}')">
        <td style="${TD};font-size:.73rem;font-weight:700;${SEP}">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
            transform:rotate(${open ? 90 : 0}deg);transition:transform .15s">&#9654;</span>
          <span style="color:${colL(l)}">${esc(l)}</span>
          <span style="font-size:.58rem;color:var(--mut);font-weight:400"> · ${pcN((TASA[l] || 0) * 100)} de garantía</span></td>
        <td style="${TD};text-align:right;font-size:.7rem;${SEP}">${r.cli.size}</td>
        <td style="${TD};text-align:right;font-size:.7rem;${SEP}">${r.n}</td>
        <td style="${TD};text-align:right;font-size:.73rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEP}">${nMM(r.monto)}</td>
        <td style="${TD};text-align:right;font-size:.68rem;${SEP}">${pcN(r.probProm)}</td>
        <td style="${TD};text-align:right;font-size:.7rem;color:var(--mut);
                   font-variant-numeric:tabular-nums;${SEP}">${nMM(r.pond)}</td>
        <td style="${TD};text-align:right;font-size:.73rem;font-weight:700;color:var(--gn);
                   font-variant-numeric:tabular-nums;${SEP}">${nMM(r.pot)}</td>
        <td style="${TD};text-align:right;font-size:.7rem;color:var(--gn);
                   font-variant-numeric:tabular-nums;${SEP}">${nMM(r.potPond)}</td>
        <td style="${TD};text-align:right;font-size:.72rem;font-weight:700;color:#0A7D74;
                   font-variant-numeric:tabular-nums">${nMM(r.margen)}</td>
      </tr>`;

      if (open) {
        const anios = [...new Set(sub.map(it => it.anio))].sort();
        const TDD = 'padding:.25rem .7rem;font-size:.66rem;white-space:nowrap';
        rows += `<tr style="background:var(--bg)"><td colspan="9" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>${thd('AÑO')}${thd('CLIENTES', 'right')}${thd('OPORT.', 'right')}
              ${thd('MONTO NEGOCIO', 'right')}${thd('PROB. PROM.', 'right')}${thd('MONTO POND.', 'right')}
              ${thd('POTENCIAL ST', 'right')}${thd('POT. POND.', 'right')}${thd('MARGEN 55%', 'right')}</tr></thead>
            <tbody>${anios.map(a => {
              const ra = agg(sub.filter(it => it.anio === a));
              return `<tr>
                <td style="${TDD};padding-left:1.9rem;font-weight:600;${SEP}">${esc(a)}</td>
                <td style="${TDD};text-align:right;${SEP}">${ra.cli.size}</td>
                <td style="${TDD};text-align:right;${SEP}">${ra.n}</td>
                <td style="${TDD};text-align:right;font-weight:600;
                           font-variant-numeric:tabular-nums;${SEP}">${nMM(ra.monto)}</td>
                <td style="${TDD};text-align:right;${SEP}">${pcN(ra.probProm)}</td>
                <td style="${TDD};text-align:right;color:var(--mut);
                           font-variant-numeric:tabular-nums;${SEP}">${nMM(ra.pond)}</td>
                <td style="${TDD};text-align:right;font-weight:600;color:var(--gn);
                           font-variant-numeric:tabular-nums;${SEP}">${nMM(ra.pot)}</td>
                <td style="${TDD};text-align:right;color:var(--gn);
                           font-variant-numeric:tabular-nums;${SEP}">${nMM(ra.potPond)}</td>
                <td style="${TDD};text-align:right;color:#0A7D74;
                           font-variant-numeric:tabular-nums">${nMM(ra.margen)}</td>
              </tr>`;
            }).join('')}</tbody></table></td></tr>`;
      }
    });

    box.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1040px">
          <thead><tr>${th('LÍNEA DE NEGOCIO')}${th('CLIENTES', 'right')}${th('OPORTUNIDADES', 'right')}
            ${th('MONTO NEGOCIO', 'right')}${th('PROB. PROM.', 'right')}${th('MONTO POND.', 'right')}
            ${th('POTENCIAL ST', 'right')}${th('POT. POND.', 'right')}${th('MARGEN 55%', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.45rem .7rem;font-size:.72rem;${SEP}">TOTAL</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;${SEP}">${gl.cli.size}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;${SEP}">${gl.n}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(gl.monto)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;${SEP}">${pcN(gl.probProm)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(gl.pond)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(gl.pot)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(gl.potPond)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums">${nMM(gl.margen)}</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.62rem;color:var(--mut);margin:.55rem 0 0;line-height:1.6">
        <strong>Potencial ST Garantías</strong> = monto del negocio × el porcentaje de garantía de cada línea:
        Esterilización <strong>10%</strong>, Dental <strong>6%</strong> y Endoscopía <strong>6%</strong>.
        El <strong>margen</strong> asume un 55% sobre ese potencial.
        Las columnas «ponderado» multiplican además por la probabilidad de venta de cada oportunidad, y la
        probabilidad promedio se pondera por monto, no por número de oportunidades.
        Fuente: hojas PIPELINE Esterilización, PIPELINE Dental y PIPELINE Endoscopía.</p>`;
  }

  // ── Detalle de oportunidades ─────────────────────────────────
  function tablaDetalle(foco) {
    const box = document.getElementById('pipe-detalle');
    if (!box) return;
    const list = filtrados().slice().sort((a, b) => potST(b) - potST(a));
    const TD = 'padding:.35rem .7rem';
    const g = agg(list);

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:560px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1180px">
          <thead><tr>${th('#', 'right')}${th('CLIENTE')}${th('LÍNEA')}${th('AÑO', 'right')}
            ${th('EQUIPAMIENTO')}${th('PROB.', 'right')}${th('MES FACT.')}${th('MONTO NEGOCIO', 'right')}
            ${th('POTENCIAL ST', 'right')}${th('MARGEN 55%', 'right')}</tr></thead>
          <tbody>${list.map((it, i) => {
            const tr = TRAMOS.find(t => it.prob >= t.min && it.prob <= t.max) || TRAMOS[0];
            const p = potST(it);
            return `<tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="${TD};text-align:right;font-size:.62rem;color:var(--mut);${SEP}">${i + 1}</td>
              <td style="${TD};font-size:.7rem;font-weight:600;${SEP}"
                  title="${esc(it.na || it.cli)}">${esc(it.cli)}</td>
              <td style="${TD};font-size:.62rem;${SEP}">
                <span style="background:${colL(it.linea)}1A;color:${colL(it.linea)};
                  border:1px solid ${colL(it.linea)}55;padding:.06rem .35rem;border-radius:3px;
                  font-size:.55rem;font-weight:700;white-space:nowrap">${esc(it.linea)}</span></td>
              <td style="${TD};text-align:right;font-size:.66rem;${SEP}">${esc(it.anio)}</td>
              <td style="${TD};font-size:.64rem;color:var(--mut);max-width:300px;overflow:hidden;
                         text-overflow:ellipsis;white-space:nowrap;${SEP}"
                  title="${esc(it.prod)}">${esc(it.prod)}</td>
              <td style="${TD};text-align:right;font-size:.66rem;font-weight:700;color:${tr.col};${SEP}">${it.prob}%</td>
              <td style="${TD};font-size:.64rem;color:var(--mut);${SEP}">${esc(it.mes)}</td>
              <td style="${TD};text-align:right;font-size:.7rem;font-weight:600;
                         font-variant-numeric:tabular-nums;${SEP}">${nMM(it.monto)}</td>
              <td style="${TD};text-align:right;font-size:.7rem;font-weight:700;color:var(--gn);
                         font-variant-numeric:tabular-nums;${SEP}">${nMM(p)}</td>
              <td style="${TD};text-align:right;font-size:.68rem;color:#0A7D74;
                         font-variant-numeric:tabular-nums">${nMM(p * MARGEN)}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="10" style="text-align:center;padding:1.4rem;color:var(--mut);font-size:.68rem">Sin resultados</td></tr>'}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="4" style="padding:.45rem .7rem;font-size:.7rem;${SEP}">TOTAL · ${list.length} oportunidades · ${g.cli.size} clientes</td>
            <td colspan="3" style="${SEP}"></td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(g.monto)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(g.pot)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.7rem;
                       font-variant-numeric:tabular-nums">${nMM(g.margen)}</td>
          </tr></tfoot>
        </table>
      </div>`;
    if (foco) {
      const inp = document.getElementById('pipe-q');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  }

  // ── Gráficos ─────────────────────────────────────────────────
  function graficos() {
    if (typeof Chart === 'undefined') return;
    const list = filtrados();
    const lineas = (P.lineas || []).filter(l => list.some(it => it.linea === l));

    // 1 · Potencial ST por línea, dona
    const c1 = document.getElementById('cPipeLinea');
    if (c1) {
      if (_ch1) _ch1.destroy();
      const vals = lineas.map(l => agg(list.filter(it => it.linea === l)).pot);
      const tot = vals.reduce((a, b) => a + b, 0) || 1;
      _ch1 = new Chart(c1.getContext('2d'), {
        type: 'doughnut',
        data: { labels: lineas, datasets: [{ data: vals,
          backgroundColor: lineas.map(colL), borderWidth: 1, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '54%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: FT, size: 10 } } },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' ' + nMM(x.raw) + ' · ' + pcN(x.raw / tot * 100) } } } }
      });
    }

    // 2 · Monto del negocio por año, apilado por línea
    const c2 = document.getElementById('cPipeAnio');
    if (c2) {
      if (_ch2) _ch2.destroy();
      const anios = [...new Set(list.map(it => it.anio))].sort();
      _ch2 = new Chart(c2.getContext('2d'), {
        type: 'bar',
        data: { labels: anios, datasets: lineas.map(l => ({
          label: l, backgroundColor: colL(l), stack: 's', borderRadius: 3,
          data: anios.map(a => agg(list.filter(it => it.anio === a && it.linea === l)).monto / 1e6) })) },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: FT, size: 10 } } },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' ' + x.dataset.label + ': MM$' + x.raw.toFixed(1).replace('.', ',') } } },
          scales: { y: { stacked: true, grid: { color: '#E2E6F0' },
                         ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    x: { stacked: true, grid: { display: false }, ticks: { font: { family: FT, size: 11 } } } } }
      });
    }

    // 3 · Embudo por probabilidad: monto bruto contra monto ponderado
    const c3 = document.getElementById('cPipeProb');
    if (c3) {
      if (_ch3) _ch3.destroy();
      const rs = TRAMOS.map(t => agg(list.filter(it => tramoDe(it.prob) === t.k)));
      _ch3 = new Chart(c3.getContext('2d'), {
        type: 'bar',
        data: { labels: TRAMOS.map(t => t.lbl), datasets: [
          { label: 'Monto del negocio', data: rs.map(r => r.monto / 1e6),
            backgroundColor: TRAMOS.map(t => t.col + '66'), borderRadius: 3 },
          { label: 'Ponderado por probabilidad', data: rs.map(r => r.pond / 1e6),
            backgroundColor: TRAMOS.map(t => t.col), borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: FT, size: 10 } } },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' ' + x.dataset.label + ': MM$' + x.raw.toFixed(1).replace('.', ',') +
                ' · ' + rs[x.dataIndex].n + ' oport.' } } },
          scales: { y: { grid: { color: '#E2E6F0' },
                         ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { family: FT, size: 10 } } } } }
      });
    }

    // 4 · Potencial ST por mes probable de facturación
    const c4 = document.getElementById('cPipeMes');
    if (c4) {
      if (_ch4) _ch4.destroy();
      const orden = (P.meses || []).concat(['Sin definir']);
      const usados = orden.filter(m => list.some(it => it.mes === m));
      _ch4 = new Chart(c4.getContext('2d'), {
        type: 'bar',
        data: { labels: usados, datasets: lineas.map(l => ({
          label: l, backgroundColor: colL(l), stack: 's', borderRadius: 3,
          data: usados.map(m => agg(list.filter(it => it.mes === m && it.linea === l)).pot / 1e6) })) },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { family: FT, size: 10 } } },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' ' + x.dataset.label + ': ' + nMM(x.raw * 1e6) } } },
          scales: { y: { stacked: true, grid: { color: '#E2E6F0' },
                         ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    x: { stacked: true, grid: { display: false }, ticks: { font: { family: FT, size: 9.5 } } } } }
      });
    }
  }

  function render() { segmentadores(); kpis(); tablaResumen(); graficos(); tablaDetalle(); }

  window.initPipeline = function () {
    const w = document.getElementById('view-pipeline');
    if (!w) return;
    if (!P.items || !P.items.length) {
      w.innerHTML = '<div class="sh"><h2>Potencial ST Garantías (Pipeline)</h2><div class="sh-line"></div></div>' +
        '<div style="padding:2rem;color:var(--mut);font-size:.7rem">Sin datos de pipeline.</div>';
      return;
    }
    if (!w.dataset.init) { w.dataset.init = '1'; w.innerHTML = esqueleto(); }
    render();
  };

  // ── HOOK sv() ────────────────────────────────────────────────
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig(name, btn);
      if (name === 'pipeline') setTimeout(window.initPipeline, 80);
    };
  }
})();
