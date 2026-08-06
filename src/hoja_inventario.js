// hoja_inventario.js — Inventario TS
// Depende de: datos.js, utils.js
(function () {

  const INV = (window.APP_DATA || {}).inventario || {};

  const fmtM  = v => 'MM$' + (v / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtMM = v => 'MM$' + Math.round(v / 1e6).toLocaleString('es-CL');
  const fmtN  = v => Math.round(v).toLocaleString('es-CL');
  const pct   = (a, b) => b ? ((a / b) * 100).toFixed(1) + '%' : '—';

  const PALETTE = {
    EQUIPOS:      '#002D73',
    CONSUMIBLES:  '#33448D',
    REPUESTOS:    '#28D2C3',
    ACCESORIOS:   '#FFC000',
    IMPLANTES:    '#7A1FAA',
    INSTRUMENTAL: '#D46000',
    OTROS:        '#B8C1D8',
  };
  const ROT_COLOR = {
    'Alta Rotacion':    '#00832F',
    'Mediana Rotacion': '#FFC000',
    'Baja Rotacion':    '#D46000',
    'Sin Rotacion':     '#C00000',
  };
  const CHART_COLORS = ['#002D73','#33448D','#28D2C3','#FFC000','#7A1FAA','#D46000','#00832F','#C00000','#4C9BE8','#E8B24C','#4CE8A0','#E84C9B'];

  // ── KPIs ────────────────────────────────────────────────────────────────────
  function renderKPIs() {
    const tot   = INV.total_valorizado || 0;
    const items = INV.total_items || 0;
    const rep   = INV.total_repuestos || 0;
    const sinR  = INV.sin_rotacion || 0;

    const tile = (lbl, val, sub, color) =>
      `<div style="background:var(--bg2);border-radius:8px;padding:.7rem 1rem;border-top:3px solid ${color};flex:1;min-width:140px">
        <div style="font-size:.57rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-bottom:.3rem">${lbl}</div>
        <div style="font-size:1.25rem;font-weight:800;color:${color};font-variant-numeric:tabular-nums;line-height:1">${val}</div>
        <div style="font-size:.6rem;color:var(--mut);margin-top:.25rem">${sub}</div>
      </div>`;

    document.getElementById('inv-kpi-row').innerHTML =
      tile('Total Valorizado', fmtM(tot), `${fmtN(items)} ítems`, '#002D73') +
      tile('Repuestos', fmtM(rep), pct(rep, tot) + ' del total', '#28D2C3') +
      tile('Sin Rotación', fmtM(sinR), 'Inventario en riesgo', '#C00000') +
      tile('Alta Rotación', fmtM((INV.por_rotacion || {})['Alta Rotacion'] || 0),
        pct((INV.por_rotacion || {})['Alta Rotacion'] || 0, tot), '#00832F');
  }

  // ── Donut Categoría ──────────────────────────────────────────────────────────
  let _chartCat = null;
  function renderChartCat() {
    const ctx = document.getElementById('cInvCat');
    if (!ctx) return;
    if (_chartCat) { _chartCat.destroy(); _chartCat = null; }
    const cats = INV.por_categoria || {};
    const labels = Object.keys(cats);
    const data   = Object.values(cats);
    const colors = labels.map(l => PALETTE[l.toUpperCase()] || '#B8C1D8');

    _chartCat = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'var(--bg)' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 }, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtMM(c.raw)} (${pct(c.raw, INV.total_valorizado)})` } },
        },
      },
    });
  }

  // ── Horizontal bar Top Marcas ────────────────────────────────────────────────
  let _chartMarcas = null;
  function renderChartMarcas(catFilter) {
    const ctx = document.getElementById('cInvMarcas');
    if (!ctx) return;
    if (_chartMarcas) { _chartMarcas.destroy(); _chartMarcas = null; }

    let source;
    if (!catFilter || catFilter === 'TODOS') {
      source = INV.top_marcas || {};
    } else {
      // Usar marca_por_categoria
      const mpc = INV.marca_por_categoria || {};
      source = {};
      for (const [m, cats] of Object.entries(mpc)) {
        const v = (cats[catFilter] || 0);
        if (v > 0) source[m] = v;
      }
      source = Object.fromEntries(Object.entries(source).sort((a, b) => b[1] - a[1]).slice(0, 15));
    }

    const labels = Object.keys(source).slice(0, 15);
    const data   = labels.map(l => source[l]);
    const maxV   = Math.max(...data, 1);

    _chartMarcas = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map((v, i) => CHART_COLORS[i % CHART_COLORS.length] + 'CC'),
          borderColor:     data.map((v, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: 1, borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${fmtMM(c.raw)} (${pct(c.raw, INV.total_valorizado)})` } },
        },
        scales: {
          x: { grid: { color: '#E2E6F022' }, ticks: { font: { size: 8 }, callback: v => 'MM$' + Math.round(v / 1e6).toLocaleString('es-CL') } },
          y: { grid: { display: false }, ticks: { font: { size: 8 } } },
        },
      },
    });
  }

  // ── Donut Rotación ───────────────────────────────────────────────────────────
  let _chartRot = null;
  function renderChartRot() {
    const ctx = document.getElementById('cInvRot');
    if (!ctx) return;
    if (_chartRot) { _chartRot.destroy(); _chartRot = null; }
    const rot = INV.por_rotacion || {};
    const ORDER = ['Alta Rotacion', 'Mediana Rotacion', 'Baja Rotacion', 'Sin Rotacion'];
    const labels = ORDER.filter(k => rot[k] !== undefined);
    const data   = labels.map(l => rot[l] || 0);
    const colors = labels.map(l => ROT_COLOR[l] || '#B8C1D8');

    _chartRot = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'var(--bg)' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 }, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtMM(c.raw)} (${pct(c.raw, INV.total_valorizado)})` } },
        },
      },
    });
  }

  // ── Tabla por Marca (filtrable por categoría) ────────────────────────────────
  let _selCat = 'REPUESTOS'; // default: repuestos

  function renderCatSeg() {
    const seg = document.getElementById('inv-cat-seg');
    if (!seg) return;
    const cats = ['TODOS', ...(INV.categorias || [])];
    seg.innerHTML = cats.map(c =>
      `<button onclick="window._invSetCat('${c}')" id="inv-seg-${c.replace(/\s/g,'_')}"
        style="font-size:.58rem;padding:.18rem .55rem;border-radius:3px;border:1px solid var(--brd);
        background:${_selCat===c?'#002D73':'var(--bg2)'};color:${_selCat===c?'#fff':'var(--txt)'};cursor:pointer">${c}</button>`
    ).join('');
  }

  function renderTable(cat) {
    const tbl = document.getElementById('inv-table');
    if (!tbl) return;

    let rows = [];
    if (cat === 'TODOS' || !cat) {
      // Tabla: marca | costo total | % total | top categoría
      const top = INV.top_marcas || {};
      rows = Object.entries(top).map(([marca, val]) => {
        const mpc = (INV.marca_por_categoria || {})[marca] || {};
        const topCat = Object.entries(mpc).sort((a,b)=>b[1]-a[1])[0];
        return { marca, val, topCat: topCat ? topCat[0] : '—', topCatVal: topCat ? topCat[1] : 0 };
      }).sort((a,b)=>b.val-a.val);

      const total = rows.reduce((s,r)=>s+r.val, 0);
      tbl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.72rem">
        <thead>
          <tr style="background:var(--az1);color:#fff">
            <th style="text-align:left;padding:.4rem .6rem;font-size:.6rem;letter-spacing:.04em">MARCA</th>
            <th style="text-align:right;padding:.4rem .6rem;font-size:.6rem">COSTO TOTAL</th>
            <th style="text-align:right;padding:.4rem .6rem;font-size:.6rem">% DEL TOTAL</th>
            <th style="text-align:left;padding:.4rem .6rem;font-size:.6rem">PRINCIPAL CATEGORÍA</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr style="background:${i%2===0?'var(--bg2)':'var(--bg)'}">
              <td style="padding:.35rem .6rem;font-weight:600">${r.marca}</td>
              <td style="text-align:right;padding:.35rem .6rem;font-variant-numeric:tabular-nums">${fmtMM(r.val)}</td>
              <td style="text-align:right;padding:.35rem .6rem;color:var(--mut)">${pct(r.val, total)}</td>
              <td style="padding:.35rem .6rem">
                <span style="background:${PALETTE[r.topCat] || '#B8C1D8'}22;color:${PALETTE[r.topCat] || '#555'};
                  padding:.1rem .4rem;border-radius:3px;font-size:.6rem;border:1px solid ${PALETTE[r.topCat] || '#B8C1D8'}55">
                  ${r.topCat}
                </span>
              </td>
            </tr>`).join('')}
          <tr style="background:var(--az3);font-weight:700;color:#fff">
            <td style="padding:.4rem .6rem">TOTAL (Top 20 Marcas)</td>
            <td style="text-align:right;padding:.4rem .6rem;font-variant-numeric:tabular-nums">${fmtMM(total)}</td>
            <td style="text-align:right;padding:.4rem .6rem">100%</td>
            <td></td>
          </tr>
        </tbody>
      </table>`;

    } else {
      // Filtro por categoría específica
      const mpc = INV.marca_por_categoria || {};
      const filtrados = Object.entries(mpc)
        .map(([marca, cats]) => ({ marca, val: cats[cat] || 0 }))
        .filter(r => r.val > 0)
        .sort((a,b) => b.val - a.val);

      // Para REPUESTOS usar datos más ricos
      const repData = cat === 'REPUESTOS' ? (INV.repuestos_por_marca || {}) : {};

      const total = filtrados.reduce((s,r)=>s+r.val, 0);
      const hasStock = cat === 'REPUESTOS';

      tbl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.72rem">
        <thead>
          <tr style="background:${PALETTE[cat] || '#002D73'};color:#fff">
            <th style="text-align:left;padding:.4rem .6rem;font-size:.6rem;letter-spacing:.04em">MARCA</th>
            <th style="text-align:right;padding:.4rem .6rem;font-size:.6rem">COSTO TOTAL</th>
            <th style="text-align:right;padding:.4rem .6rem;font-size:.6rem">% CATEGORÍA</th>
            ${hasStock ? '<th style="text-align:right;padding:.4rem .6rem;font-size:.6rem">STOCK (UN)</th><th style="text-align:right;padding:.4rem .6rem;font-size:.6rem">Nº ÍTEMS</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${filtrados.map((r, i) => {
            const rd = repData[r.marca] || {};
            return `<tr style="background:${i%2===0?'var(--bg2)':'var(--bg)'}">
              <td style="padding:.35rem .6rem;font-weight:600">${r.marca}</td>
              <td style="text-align:right;padding:.35rem .6rem;font-variant-numeric:tabular-nums">${fmtMM(r.val)}</td>
              <td style="text-align:right;padding:.35rem .6rem;color:var(--mut)">${pct(r.val, total)}</td>
              ${hasStock ? `<td style="text-align:right;padding:.35rem .6rem;color:var(--mut)">${fmtN(rd.stock||0)}</td>
                <td style="text-align:right;padding:.35rem .6rem;color:var(--mut)">${rd.n_items||0}</td>` : ''}
            </tr>`;
          }).join('')}
          <tr style="background:${PALETTE[cat]||'#002D73'};font-weight:700;color:#fff">
            <td style="padding:.4rem .6rem">TOTAL ${cat}</td>
            <td style="text-align:right;padding:.4rem .6rem;font-variant-numeric:tabular-nums">${fmtMM(total)}</td>
            <td style="text-align:right;padding:.4rem .6rem">100%</td>
            ${hasStock ? '<td></td><td></td>' : ''}
          </tr>
        </tbody>
      </table>`;
    }
  }

  window._invSetCat = function(cat) {
    _selCat = cat;
    renderCatSeg();
    renderTable(cat);
    renderChartMarcas(cat === 'TODOS' ? null : cat);
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  window.initInventario = function () {
    const el = document.getElementById('view-inventario');
    if (!el) return;

    if (!INV.total_valorizado) {
      const kr = document.getElementById('inv-kpi-row');
      if (kr) kr.innerHTML = '<p style="padding:1.5rem;color:var(--mut);font-style:italic">Sin datos de inventario disponibles.</p>';
      return;
    }

    const lbl = document.getElementById('inv-fecha-lbl');
    if (lbl) lbl.textContent = (window.APP_DATA || {}).hoy || new Date().toLocaleDateString('es-CL');

    renderKPIs();
    renderChartCat();
    renderChartMarcas(null);
    renderChartRot();
    renderCatSeg();
    renderTable(_selCat);
  };
})();
