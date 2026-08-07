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
    // Fondo de color sólido con degradado, mismo lenguaje que las barras
    // .f-gn / .f-rd del tablero. Los cuatro tonos llevan texto blanco.
    const tile = (lbl, val, sub, c1, c2, accent) =>
      `<div style="background:linear-gradient(135deg,${c1},${c2});border-radius:8px;
                   padding:.75rem 1.05rem;flex:1;min-width:150px;color:#fff;
                   box-shadow:0 1px 3px rgba(0,0,0,.18)">
         <div style="font-size:.57rem;text-transform:uppercase;letter-spacing:.07em;
                     color:rgba(255,255,255,.72);margin-bottom:.35rem">${lbl}</div>
         <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.4rem;
                     color:${accent};font-variant-numeric:tabular-nums;line-height:1">${val}</div>
         <div style="font-size:.6rem;color:rgba(255,255,255,.6);margin-top:.3rem">${sub}</div>
       </div>`;
    box.innerHTML =
      tile('Costo Total Inventario', nMM(INV.total_costo), nCLP(INV.total_costo),
           '#001B47', '#002D73', '#28D2C3') +
      tile('Unidades en Stock',      nUn(INV.total_stock), 'suma de En stock',
           '#22306B', '#33448D', '#8FD8FF') +
      tile('SKUs',                   nUn(INV.total_skus),  'artículos distintos',
           '#0A5F59', '#128A80', '#7BFFF2') +
      tile('Marcas',                 nUn(INV.n_marcas),    'proveedores',
           '#7A5200', '#A8760B', '#FFD966');
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

    // Borde vertical entre columnas: hace visible dónde empieza y termina cada
    // una, ahora que SKU y descripción son columnas separadas de ancho fijo.
    const SEP = 'border-right:1px solid var(--brd)';
    const th = (t, al) =>
      `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.42rem .7rem;
        font-size:.6rem;letter-spacing:.04em;text-align:${al};white-space:nowrap;
        border-right:1px solid rgba(255,255,255,.18)">${t}</th>`;

    let rows = '';
    marcas.forEach((m, i) => {
      const d      = data[m];
      const isOpen = _open.has(m);
      const zebra  = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';

      rows += `<tr style="background:${zebra};cursor:pointer;border-left:3px solid #002D73"
          onclick="window._invtsToggle(${JSON.stringify(m).replace(/"/g, '&quot;')})">
        <td style="padding:.4rem .7rem;font-size:.73rem;font-weight:600;white-space:nowrap;
                   overflow:hidden;text-overflow:ellipsis;${SEP}" title="${esc(m)}">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
            transform:rotate(${isOpen ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(m)}
        </td>
        <td style="padding:.4rem .7rem;font-size:.62rem;color:var(--mut);white-space:nowrap;${SEP}">${d.n_skus} SKU</td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums;${SEP}">${nUn(d.stock)}</td>
        <td style="padding:.4rem .7rem;${SEP}"></td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.73rem;font-weight:700;font-variant-numeric:tabular-nums;${SEP}">${nCLP(d.ct)}</td>
        <td style="padding:.4rem .7rem;text-align:right;font-size:.68rem;color:var(--mut)">${pc(d.ct, gCt)}</td>
      </tr>`;

      if (isOpen) {
        let items = d.items || [];
        if (q && !m.toLowerCase().includes(q)) {
          items = items.filter(i => i.sku.toLowerCase().includes(q) || (i.d || '').toLowerCase().includes(q));
        }
        items.forEach(it => {
          rows += `<tr style="background:var(--bg)">
            <td style="padding:.25rem .7rem .25rem 1.9rem;${SEP}">
              <span style="font-family:'Roboto Mono',monospace;font-size:.63rem;background:var(--bg2);
                padding:.05rem .3rem;border-radius:3px;display:inline-block;max-width:100%;
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom"
                title="${esc(it.sku)}">${esc(it.sku)}</span>
            </td>
            <td style="padding:.25rem .7rem;font-size:.66rem;color:var(--mut);white-space:nowrap;
                       overflow:hidden;text-overflow:ellipsis;${SEP}" title="${esc(it.d)}">${esc(it.d)}</td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;${SEP}">${nUn(it.st)}</td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;color:var(--mut);${SEP}">${nCLP(it.cu)}</td>
            <td style="padding:.25rem .7rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;${SEP}">${nCLP(it.ct)}</td>
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
        <table style="width:100%;min-width:940px;border-collapse:collapse;table-layout:fixed">
          <colgroup>
            <col style="width:210px">
            <col>
            <col style="width:100px">
            <col style="width:130px">
            <col style="width:140px">
            <col style="width:82px">
          </colgroup>
          <thead><tr>
            ${th('MARCA / SKU', 'left')}
            ${th('DESCRIPCIÓN', 'left')}
            ${th('EN STOCK', 'right')}
            ${th('COSTO UNITARIO', 'right')}
            ${th('COSTO TOTAL', 'right')}
            ${th('% TOTAL', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.45rem .7rem;font-size:.72rem;white-space:nowrap;${SEP}">TOTAL${q ? ' (filtrado)' : ''}</td>
            <td style="padding:.45rem .7rem;font-size:.66rem;font-weight:400;color:rgba(255,255,255,.75);${SEP}">${marcas.length} marcas · ${nUn(gSk)} SKU</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums;${SEP}">${nUn(gSt)}</td>
            <td style="${SEP}"></td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums;${SEP}">${nCLP(gCt)}</td>
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
