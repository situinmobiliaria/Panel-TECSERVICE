// hoja_inventario.js — Inventario TS (Tabla TD)
// Depende de: datos.js, utils.js
(function () {
  const TD = (window.APP_DATA || {}).td_inv || {};
  const _expanded = new Set();

  const fmtM = v => '$' + Math.round(v / 1e6 * 10) / 10 + ' MM';

  window.initInventario = function () {
    if (!Object.keys(TD).length) {
      const tbl = document.getElementById('inv-table');
      if (tbl) tbl.innerHTML = '<p style="padding:1.5rem;color:var(--mut)">Sin datos disponibles.</p>';
      return;
    }

    const lbl = document.getElementById('inv-fecha-lbl');
    if (lbl) lbl.textContent = (window.APP_DATA || {}).hoy || new Date().toLocaleDateString('es-CL');

    const tbl = document.getElementById('inv-table');
    if (!tbl) return;

    const marcas = Object.keys(TD).sort((a, b) => (TD[b].total || 0) - (TD[a].total || 0));
    const tot = marcas.reduce((s, m) => s + (TD[m].total || 0), 0);

    let html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">';
    html += '<thead><tr style="background:var(--az1);color:#fff">';
    html += '<th style="padding:.4rem .6rem;text-align:left;font-size:.65rem">MARCA</th>';
    html += '<th style="padding:.4rem .6rem;text-align:right;font-size:.65rem">TOTAL</th>';
    html += '<th style="padding:.4rem .6rem;text-align:right;font-size:.65rem">% TOTAL</th>';
    html += '</tr></thead><tbody>';

    marcas.forEach((marca, i) => {
      const data = TD[marca];
      const isOpen = _expanded.has(marca);
      const pct = tot ? ((data.total / tot) * 100).toFixed(1) : 0;

      html += `<tr style="background:${i%2===0?'var(--bg2)':'var(--bg)'};cursor:pointer;border-left:3px solid #002D73"
        onclick="window._invToggleMarca('${marca.replace(/'/g,"\\'")}')">
        <td style="padding:.35rem .6rem;font-weight:600">
          <span style="display:inline-block;margin-right:.4rem;transform:rotate(${isOpen?90:0}deg);transition:transform .15s;font-size:.6rem">▶</span>
          ${marca}
        </td>
        <td style="padding:.35rem .6rem;text-align:right;font-variant-numeric:tabular-nums">${fmtM(data.total)}</td>
        <td style="padding:.35rem .6rem;text-align:right;color:var(--mut);font-size:.65rem">${pct}%</td>
      </tr>`;

      if (isOpen && data.meses) {
        Object.entries(data.meses).forEach(([mes, val]) => {
          html += `<tr style="background:var(--bg)">
            <td style="padding:.28rem .6rem;padding-left:2rem;font-size:.65rem;color:var(--mut)">${mes}</td>
            <td style="padding:.28rem .6rem;text-align:right;font-variant-numeric:tabular-nums;font-size:.68rem">${fmtM(val)}</td>
            <td style="padding:.28rem .6rem;text-align:right;color:var(--mut);font-size:.65rem">${((val/tot)*100).toFixed(1)}%</td>
          </tr>`;
        });
      }
    });

    html += `<tr style="background:var(--az3);color:#fff;font-weight:700">
      <td style="padding:.4rem .6rem">TOTAL</td>
      <td style="padding:.4rem .6rem;text-align:right;font-variant-numeric:tabular-nums">${fmtM(tot)}</td>
      <td style="padding:.4rem .6rem;text-align:right">100%</td>
    </tr>`;
    html += '</tbody></table></div>';

    tbl.innerHTML = html;
  };

  window._invToggleMarca = function(marca) {
    if (_expanded.has(marca)) _expanded.delete(marca);
    else _expanded.add(marca);
    window.initInventario();
  };
})();
