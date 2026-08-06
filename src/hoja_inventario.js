// hoja_inventario.js — Inventario TS (Repuestos)
// Depende de: datos.js, utils.js
(function () {
  const INV = (window.APP_DATA || {}).inventario || {};

  const fmtM  = v => 'MM$' + (v / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtMM = v => 'MM$' + Math.round(v / 1e6).toLocaleString('es-CL');
  const fmtCLP = v => '$' + Math.round(v).toLocaleString('es-CL');
  const fmtN  = v => Math.round(v).toLocaleString('es-CL');
  const pct   = (a, b) => b ? ((a / b) * 100).toFixed(1) + '%' : '—';

  const ROT_COLOR = {
    'Alta Rotacion':    '#00832F',
    'Mediana Rotacion': '#FFC000',
    'Baja Rotacion':    '#D46000',
    'Sin Rotacion':     '#C00000',
    'Sin dato':         '#B8C1D8',
  };
  const BAR_COLORS = ['#002D73','#33448D','#4C7FBF','#28D2C3','#1AA8A0','#7A1FAA','#FFC000','#D46000','#00832F','#C00000','#4C9BE8','#E8B24C','#9B59B6','#E84C9B','#4CE8A0'];

  // ── KPIs ────────────────────────────────────────────────────────────────────
  function renderKPIs() {
    const tot  = INV.total_valorizado || 0;
    const sinR = INV.sin_rotacion || 0;
    const rot  = INV.por_rotacion || {};
    const alta = rot['Alta Rotacion'] || 0;

    const tile = (lbl, val, sub, color) =>
      `<div style="background:var(--bg2);border-radius:8px;padding:.7rem 1rem;border-top:3px solid ${color};flex:1;min-width:130px">
        <div style="font-size:.57rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-bottom:.3rem">${lbl}</div>
        <div style="font-size:1.2rem;font-weight:800;color:${color};font-variant-numeric:tabular-nums;line-height:1">${val}</div>
        <div style="font-size:.6rem;color:var(--mut);margin-top:.25rem">${sub}</div>
      </div>`;

    document.getElementById('inv-kpi-row').innerHTML =
      tile('Total Valorizado', fmtM(tot), `${fmtN(INV.total_items || 0)} SKUs · ${fmtN(INV.total_stock || 0)} unidades`, '#002D73') +
      tile('Alta Rotación', fmtM(alta), pct(alta, tot) + ' del total', '#00832F') +
      tile('Sin Rotación', fmtM(sinR), pct(sinR, tot) + ' · riesgo obsolescencia', '#C00000') +
      tile('Marcas', Object.keys(INV.por_marca || {}).length, 'proveedores con repuestos', '#33448D');
  }

  // ── Gráfico Rotación (donut) ─────────────────────────────────────────────────
  let _chartRot = null;
  function renderChartRot() {
    const ctx = document.getElementById('cInvRot');
    if (!ctx || !window.Chart) return;
    if (_chartRot) { _chartRot.destroy(); _chartRot = null; }
    const rot = INV.por_rotacion || {};
    const ORDER = ['Alta Rotacion', 'Mediana Rotacion', 'Baja Rotacion', 'Sin Rotacion'];
    const labels = ORDER.filter(k => rot[k]);
    const data   = labels.map(l => rot[l]);
    const colors = labels.map(l => ROT_COLOR[l]);
    const tot    = INV.total_valorizado || 1;

    _chartRot = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'var(--bg)' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 }, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtMM(c.raw)} (${pct(c.raw, tot)})` } },
        },
      },
    });
  }

  // ── Gráfico Top Marcas (horizontal bar) ─────────────────────────────────────
  let _chartMarcas = null;
  function renderChartMarcas() {
    const ctx = document.getElementById('cInvMarcas');
    if (!ctx || !window.Chart) return;
    if (_chartMarcas) { _chartMarcas.destroy(); _chartMarcas = null; }
    const marcas = INV.por_marca || {};
    const labels = Object.keys(marcas).slice(0, 12);
    const data   = labels.map(m => marcas[m].costo_total);
    const tot    = INV.total_valorizado || 1;

    _chartMarcas = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: BAR_COLORS.map(c => c + 'CC'),
          borderColor:     BAR_COLORS,
          borderWidth: 1, borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${fmtMM(c.raw)} (${pct(c.raw, tot)})` } },
        },
        scales: {
          x: { grid: { color: '#E2E6F022' }, ticks: { font: { size: 8 }, callback: v => 'MM$' + Math.round(v / 1e6) } },
          y: { grid: { display: false }, ticks: { font: { size: 8 } } },
        },
      },
    });
  }

  // ── Gráfico Top Bodegas (bar) ────────────────────────────────────────────────
  let _chartBod = null;
  function renderChartBod() {
    const ctx = document.getElementById('cInvBod');
    if (!ctx || !window.Chart) return;
    if (_chartBod) { _chartBod.destroy(); _chartBod = null; }
    const bods = (INV.top_bodegas || []).slice(0, 8);
    const labels = bods.map(b => b[0]);
    const data   = bods.map(b => b[1]);
    const tot    = INV.total_valorizado || 1;

    _chartBod = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: '#33448DCC', borderColor: '#33448D', borderWidth: 1, borderRadius: 3 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${fmtMM(c.raw)} (${pct(c.raw, tot)})` } },
        },
        scales: {
          x: { grid: { color: '#E2E6F022' }, ticks: { font: { size: 8 }, callback: v => 'MM$' + Math.round(v / 1e6) } },
          y: { grid: { display: false }, ticks: { font: { size: 8 } } },
        },
      },
    });
  }

  // ── Tabla expandible Marca → SKUs ────────────────────────────────────────────
  let _searchQ = '';
  const _expanded = new Set();

  function renderTable() {
    const tbl = document.getElementById('inv-table');
    if (!tbl) return;
    const marcas  = INV.por_marca || {};
    const tot     = INV.total_valorizado || 1;
    const q       = _searchQ.toLowerCase();

    // Filtrar marcas/SKUs que coincidan con búsqueda
    const marcaKeys = Object.keys(marcas).filter(m => {
      if (!q) return true;
      if (m.toLowerCase().includes(q)) return true;
      return (marcas[m].items || []).some(i => i.sku.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
    });

    const TH = (t, al='left', w='') =>
      `<th style="position:sticky;top:0;background:var(--az1);color:#fff;padding:.38rem .6rem;font-size:.6rem;letter-spacing:.04em;text-align:${al};white-space:nowrap${w?';width:'+w:''}">` + t + '</th>';

    let rows = '';
    marcaKeys.forEach((marca, mi) => {
      const md      = marcas[marca];
      const isOpen  = _expanded.has(marca);
      const color   = BAR_COLORS[mi % BAR_COLORS.length];

      // Filtrar items si hay búsqueda
      let items = md.items || [];
      if (q && !marca.toLowerCase().includes(q)) {
        items = items.filter(i => i.sku.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
      }

      rows += `
        <tr style="background:var(--bg2);cursor:pointer;border-left:3px solid ${color}"
            onclick="window._invToggle('${marca.replace(/'/g, "\\'")}')">
          <td style="padding:.38rem .6rem;font-size:.75rem">
            <span style="font-size:.7rem;margin-right:.4rem;display:inline-block;transition:transform .15s;transform:rotate(${isOpen ? 90 : 0}deg)">▶</span>
            <strong>${marca}</strong>
            <span style="font-size:.6rem;color:var(--mut);margin-left:.4rem">${md.n_items} SKUs</span>
          </td>
          <td style="text-align:right;padding:.38rem .6rem;font-size:.75rem;font-variant-numeric:tabular-nums;font-weight:700">${fmtMM(md.costo_total)}</td>
          <td style="text-align:right;padding:.38rem .6rem;font-size:.7rem;color:var(--mut)">${pct(md.costo_total, tot)}</td>
          <td style="text-align:right;padding:.38rem .6rem;font-size:.7rem;font-variant-numeric:tabular-nums">${fmtN(md.stock)}</td>
          <td></td><td></td>
        </tr>`;

      if (isOpen) {
        items.forEach(item => {
          const rotC = ROT_COLOR[item.rot] || '#B8C1D8';
          rows += `
            <tr style="background:var(--bg)">
              <td style="padding:.28rem .6rem .28rem 2.2rem;font-size:.68rem;color:var(--mut)">
                <span style="font-family:monospace;font-size:.66rem;background:var(--bg2);padding:.08rem .3rem;border-radius:3px;margin-right:.4rem">${item.sku}</span>
                ${item.desc}
              </td>
              <td style="text-align:right;padding:.28rem .6rem;font-size:.68rem;font-variant-numeric:tabular-nums">${fmtMM(item.ct)}</td>
              <td style="text-align:right;padding:.28rem .6rem;font-size:.68rem;color:var(--mut)">${pct(item.ct, tot)}</td>
              <td style="text-align:right;padding:.28rem .6rem;font-size:.68rem;font-variant-numeric:tabular-nums">${fmtN(item.stock)}</td>
              <td style="text-align:right;padding:.28rem .6rem;font-size:.68rem;font-variant-numeric:tabular-nums;color:var(--mut)">${fmtCLP(item.cu)}</td>
              <td style="padding:.28rem .6rem">
                <span style="font-size:.58rem;padding:.1rem .35rem;border-radius:3px;background:${rotC}22;color:${rotC};border:1px solid ${rotC}44;white-space:nowrap">${item.rot}</span>
              </td>
            </tr>`;
        });
      }
    });

    // Total footer
    const totVal = marcaKeys.reduce((s, m) => s + marcas[m].costo_total, 0);
    const totSt  = marcaKeys.reduce((s, m) => s + marcas[m].stock, 0);

    tbl.innerHTML = `
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;flex-wrap:wrap">
        <input id="inv-search" type="text" placeholder="Buscar marca o SKU…"
          value="${_searchQ}"
          oninput="window._invSearch(this.value)"
          style="font-size:.72rem;padding:.3rem .6rem;border:1px solid var(--brd);border-radius:4px;background:var(--bg2);color:var(--txt);width:220px">
        <span style="font-size:.65rem;color:var(--mut)">${marcaKeys.length} marcas · ${marcaKeys.reduce((s,m)=>s+(marcas[m].items||[]).length,0)} SKUs</span>
        <button onclick="window._invExpandAll(true)"
          style="font-size:.62rem;padding:.2rem .5rem;border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Expandir todo</button>
        <button onclick="window._invExpandAll(false)"
          style="font-size:.62rem;padding:.2rem .5rem;border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Colapsar todo</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr>
              ${TH('MARCA / SKU · DESCRIPCIÓN','left','40%')}
              ${TH('COSTO TOTAL','right','12%')}
              ${TH('% TOTAL','right','8%')}
              ${TH('STOCK (UN)','right','10%')}
              ${TH('COSTO UNIT.','right','12%')}
              ${TH('ROTACIÓN','left','14%')}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:var(--az3);color:#fff;font-weight:700">
              <td style="padding:.4rem .6rem;font-size:.72rem">TOTAL (${marcaKeys.length} marcas)</td>
              <td style="text-align:right;padding:.4rem .6rem;font-size:.72rem;font-variant-numeric:tabular-nums">${fmtMM(totVal)}</td>
              <td style="text-align:right;padding:.4rem .6rem;font-size:.7rem">100%</td>
              <td style="text-align:right;padding:.4rem .6rem;font-size:.72rem;font-variant-numeric:tabular-nums">${fmtN(totSt)}</td>
              <td></td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  window._invToggle = function(marca) {
    if (_expanded.has(marca)) _expanded.delete(marca);
    else _expanded.add(marca);
    renderTable();
  };

  window._invSearch = function(q) {
    _searchQ = q;
    if (q) {
      // Auto-expandir marcas con matches
      const marcas = INV.por_marca || {};
      Object.keys(marcas).forEach(m => {
        const hits = (marcas[m].items || []).some(i =>
          i.sku.toLowerCase().includes(q.toLowerCase()) || i.desc.toLowerCase().includes(q.toLowerCase())
        );
        if (hits && !m.toLowerCase().includes(q.toLowerCase())) _expanded.add(m);
      });
    }
    renderTable();
  };

  window._invExpandAll = function(open) {
    const marcas = INV.por_marca || {};
    _expanded.clear();
    if (open) Object.keys(marcas).forEach(m => _expanded.add(m));
    renderTable();
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  window.initInventario = function () {
    if (!INV.total_valorizado) {
      const kr = document.getElementById('inv-kpi-row');
      if (kr) kr.innerHTML = '<p style="padding:1.5rem;color:var(--mut);font-style:italic">Sin datos de inventario disponibles.</p>';
      return;
    }
    const lbl = document.getElementById('inv-fecha-lbl');
    if (lbl) lbl.textContent = (window.APP_DATA || {}).hoy || new Date().toLocaleDateString('es-CL');

    renderKPIs();
    renderChartMarcas();
    renderChartRot();
    renderChartBod();
    renderTable();
  };
})();
