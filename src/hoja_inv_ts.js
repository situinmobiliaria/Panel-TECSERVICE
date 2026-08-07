// ═══════════════════════════════════════════════════════════════
// hoja_inv_ts.js — Inventario TS · Venta Repuestos
// Réplica de la tabla dinámica "TD Inventario TS" (hoja Inventario Bodega):
// resumen por marca, expandible al detalle de cada SKU.
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════
(function () {
  const INV   = (window.APP_DATA || {}).inv_ts || {};
  const _open = new Set();
  let   _q    = '';

  const nUn  = v => (v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const nCLP = v => '$' + Math.round(v || 0).toLocaleString('es-CL');
  const nMM  = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc   = (a, b) => b ? ((a / b) * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const esc  = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ── KPIs ─────────────────────────────────────────────────────
  function renderKPIs() {
    const box = document.getElementById('invts-kpi');
    if (!box) return;
    const tile = (lbl, val, sub, color) =>
      `<div style="background:var(--bg2);border-radius:8px;padding:.7rem 1rem;border-top:3px solid ${color};flex:1;min-width:150px">
         <div style="font-size:.57rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-bottom:.3rem">${lbl}</div>
         <div style="font-size:1.2rem;font-weight:800;color:${color};font-variant-numeric:tabular-nums;line-height:1">${val}</div>
         <div style="font-size:.6rem;color:var(--mut);margin-top:.25rem">${sub}</div>
       </div>`;
    box.innerHTML =
      tile('Costo Total Inventario', nMM(INV.total_costo), nCLP(INV.total_costo), '#002D73') +
      tile('Unidades en Stock',      nUn(INV.total_stock), 'suma de En stock',    '#33448D') +
      tile('SKUs',                   nUn(INV.total_skus),  'artículos distintos', '#28D2C3') +
      tile('Marcas',                 nUn(INV.n_marcas),    'proveedores',         '#FFC000');
  }

  // ── Tabla ────────────────────────────────────────────────────
  function render() {
    const box = document.getElementById('invts-table');
    if (!box) return;

    const data = INV.data || {};
    let marcas = INV.marcas || [];
    if (!marcas.length) {
      box.innerHTML = '<p style="padding:1.4rem;color:var(--mut);font-style:italic">Sin datos de inventario disponibles.</p>';
      return;
    }

    const q = _q.trim().toLowerCase();
    if (q) {
      marcas = marcas.filter(m =>
        m.toLowerCase().includes(q) ||
        (data[m].items || []).some(i =>
          i.sku.toLowerCase().includes(q) || (i.d || '').toLowerCase().includes(q))
      );
    }

    const gCt = marcas.reduce((s, m) => s + data[m].ct,    0);
    const gSt = marcas.reduce((s, m) => s + data[m].stock, 0);
    const gSk = marcas.reduce((s, m) => s + data[m].n_skus, 0);

    const th = (t, al) =>
      `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.42rem .7rem;
        font-size:.6rem;letter-spacing:.04em;text-align:${al};white-space:nowrap">${t}</th>`;

    let rows = '';
    marcas.forEach((m, i) => {
      const d      = data[m];
      const isOpen = _open.has(m);
      const zebra  = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';

      rows += `<tr style="background:${zebra};cursor:pointer;border-left:3px solid #002D73"
          onclick="window._invtsToggle(${JSON.stringify(m).replace(/"/g, '&quot;')})">
        <td style="padding:.4rem .7rem;font-size:.73rem;font-weight:600;white-space:nowrap">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
            transform:rotate(${isOpen ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(m)}
          <span style="font-size:.58rem;color:var(--mut);font-weight:400;margin-left:.4rem">${d.n_skus} SKU</span>
        </td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums">${nUn(d.stock)}</td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums;color:var(--mut)">${nCLP(d.cu_prom)}</td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.73rem;font-weight:700;font-variant-numeric:tabular-nums">${nCLP(d.ct)}</td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.68rem;color:var(--mut)">${pc(d.ct, gCt)}</td>
      </tr>`;

      if (isOpen) {
        let items = d.items || [];
        if (q && !m.toLowerCase().includes(q)) {
          items = items.filter(i => i.sku.toLowerCase().includes(q) || (i.d || '').toLowerCase().includes(q));
        }
        items.forEach(it => {
          rows += `<tr style="background:var(--bg)">
            <td style="padding:.25rem .7rem .25rem 2.1rem;font-size:.66rem;color:var(--mut)">
              <span style="font-family:'Roboto Mono',monospace;font-size:.63rem;background:var(--bg2);
                padding:.05rem .3rem;border-radius:3px;margin-right:.45rem">${esc(it.sku)}</span>${esc(it.d)}
            </td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums">${nUn(it.st)}</td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;color:var(--mut)">${nCLP(it.cu)}</td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums">${nCLP(it.ct)}</td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.62rem;color:var(--mut)">${pc(it.ct, d.ct)}</td>
          </tr>`;
        });
      }
    });

    box.innerHTML = `
      <div style="display:flex;gap:.5rem;margin-bottom:.6rem;flex-wrap:wrap;align-items:center">
        <input id="invts-q" type="text" placeholder="Buscar marca, SKU o descripción…" value="${esc(_q)}"
          oninput="window._invtsSearch(this.value)"
          style="font-size:.7rem;padding:.28rem .6rem;border:1px solid var(--brd);border-radius:4px;
                 background:var(--bg2);color:var(--txt);width:260px">
        <button onclick="window._invtsAll(true)" style="font-size:.62rem;padding:.22rem .6rem;border:1px solid var(--brd);
          border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Expandir todo</button>
        <button onclick="window._invtsAll(false)" style="font-size:.62rem;padding:.22rem .6rem;border:1px solid var(--brd);
          border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Colapsar todo</button>
        <span style="font-size:.63rem;color:var(--mut)">${marcas.length} marcas · ${nUn(gSk)} SKU · clic en una marca para ver el detalle</span>
      </div>
      <div style="overflow-x:auto;max-height:640px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            ${th('MARCA / SKU · DESCRIPCIÓN', 'left')}
            ${th('EN STOCK', 'right')}
            ${th('COSTO PROMEDIO', 'right')}
            ${th('COSTO TOTAL', 'right')}
            ${th('% TOTAL', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.45rem .7rem;font-size:.72rem">TOTAL${q ? ' (filtrado)' : ''} · ${marcas.length} marcas</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums">${nUn(gSt)}</td>
            <td></td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums">${nCLP(gCt)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.68rem">100%</td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  window._invtsToggle = function (m) {
    if (_open.has(m)) _open.delete(m); else _open.add(m);
    render();
  };

  window._invtsAll = function (open) {
    _open.clear();
    if (open) (INV.marcas || []).forEach(m => _open.add(m));
    render();
  };

  window._invtsSearch = function (v) {
    _q = v;
    if (v.trim()) {
      const ql = v.trim().toLowerCase();
      (INV.marcas || []).forEach(m => {
        const hit = ((INV.data[m] || {}).items || []).some(i =>
          i.sku.toLowerCase().includes(ql) || (i.d || '').toLowerCase().includes(ql));
        if (hit && !m.toLowerCase().includes(ql)) _open.add(m);
      });
    }
    render();
    const inp = document.getElementById('invts-q');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };

  window.initInvTS = function () {
    const lbl = document.getElementById('invts-fecha');
    if (lbl) lbl.textContent = (window.APP_DATA || {}).hoy || '';
    renderKPIs();
    render();
  };
})();
