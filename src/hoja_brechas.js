// ═══════════════════════════════════════════════════════════════
// hoja_brechas.js — Brechas de Facturación
// Tres fuentes: hoja "Brecha Oport por Facturar", ALERTA_DATA (bajo
// contrato) y hoja "Brecha Sin Stock".
// Depende de: datos.js, utils.js, Chart.js
// ═══════════════════════════════════════════════════════════════
(function () {
  const A   = window.APP_DATA || {};
  const OP  = A.br_oport    || {};
  const CT  = A.br_contrato || {};
  const ST  = A.br_stock    || {};
  const INV = A.inv_ts      || {};

  const nUn  = v => (v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const nCLP = v => '$' + Math.round(v || 0).toLocaleString('es-CL');
  const nMM  = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc   = (a, b) => b ? ((a / b) * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const esc  = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Tonos ordenados para que dos azules nunca queden juntos en la misma torta:
  // #002D73 y #33448D se confundían entre sí.
  const COLORS = ['#002D73','#28D2C3','#FFC000','#7A1FAA','#00832F','#D46000',
                  '#C00000','#4C9BE8','#E8B24C','#33448D'];
  // Semáforo por antigüedad: mientras más vieja la espera, más grave
  const AGING_COLOR = {
    '0–30 días': '#00832F', '31–60 días': '#8B8200', '61–90 días': '#D46000',
    '91–180 días': '#C00000', 'Más de 180 días': '#7A0000', 'Sin fecha': '#B8C1D8',
  };

  const SEP = 'border-right:1px solid var(--brd)';
  const th = (t, al, extra) =>
    `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.4rem .6rem;
      font-size:.58rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
      border-right:1px solid rgba(255,255,255,.18);${extra || ''}">${t}</th>`;

  const totalBrecha = () => (OP.total || 0) + (CT.total || 0) + (ST.total || 0);

  // ── KPIs principales ─────────────────────────────────────────
  function kpis() {
    const box = document.getElementById('br-kpi');
    if (!box) return;
    const T = totalBrecha();
    const tile = (lbl, v, sub, kc) =>
      `<div class="kpi" style="--kc:${kc}">
         <div class="kpi-lbl">${lbl}</div>
         <div class="kpi-val" style="color:${kc}">${v}</div>
         <div class="kpi-sub">${sub}</div>
       </div>`;
    box.innerHTML =
      tile('Brecha Oportunidades por Facturar', nMM(OP.total),
           `${nUn(OP.n)} oportunidades · ${pc(OP.total, T)} de la brecha`, 'var(--az2)') +
      tile('Brecha Facturación Bajo Contrato', nMM(CT.total),
           `${nUn(CT.n_clientes)} clientes · ${pc(CT.total, T)} de la brecha`, 'var(--am)') +
      tile('Brecha Sin Stock', nMM(ST.total),
           `${nUn(ST.n_ov)} órdenes · ${pc(ST.total, T)} de la brecha`, 'var(--rd)') +
      tile('Brecha Total', nMM(T), 'suma de las tres brechas', 'var(--az3)');

    const f = document.getElementById('br-fecha');
    if (f) f.textContent = A.hoy || '';
    const t1 = document.getElementById('br-op-tag');
    if (t1) t1.textContent = `${nUn(OP.n)} oportunidades · ${nMM(OP.total)}`;
    const t2 = document.getElementById('br-st-tag');
    if (t2) t2.textContent = `${nUn(ST.n)} líneas de repuesto · ${nMM(ST.total)}`;
  }

  // ── Barra apilada de composición ─────────────────────────────
  function barraComp() {
    const box = document.getElementById('br-barra');
    if (!box) return;
    const T = totalBrecha();
    if (!T) { box.innerHTML = ''; return; }
    const partes = [
      ['Oportunidades por Facturar', OP.total || 0, '#33448D'],
      ['Bajo Contrato',             CT.total || 0, '#FFC000'],
      ['Sin Stock',                 ST.total || 0, '#C00000'],
    ];
    box.innerHTML = `
      <div style="display:flex;height:34px;border-radius:5px;overflow:hidden;margin-bottom:.55rem">
        ${partes.map(([l, v, c]) => v <= 0 ? '' : `
          <div style="width:${v / T * 100}%;background:${c};display:flex;align-items:center;
                      justify-content:center;color:#fff;font-size:.62rem;font-weight:700"
               title="${l}: ${nCLP(v)}">${v / T > 0.07 ? pc(v, T) : ''}</div>`).join('')}
      </div>
      <div style="display:flex;gap:1.2rem;flex-wrap:wrap">
        ${partes.map(([l, v, c]) => `
          <div style="display:flex;align-items:center;gap:.35rem;font-size:.63rem">
            <span style="width:10px;height:10px;border-radius:2px;background:${c};display:inline-block"></span>
            <span>${l}</span><strong style="font-variant-numeric:tabular-nums">${nMM(v)}</strong>
            <span style="color:var(--mut)">${pc(v, T)}</span>
          </div>`).join('')}
        <div style="margin-left:auto;font-size:.63rem;font-weight:700;color:var(--az1)">
          TOTAL ${nMM(T)}</div>
      </div>`;
  }

  // ── Tabla genérica agrupada ──────────────────────────────────
  function tablaGrupo(elId, filas, total, colLbl, opts) {
    const box = document.getElementById(elId);
    if (!box) return;
    opts = opts || {};
    const max = Math.max(...filas.map(f => f.monto), 1);
    box.innerHTML = `
      <div style="overflow-x:auto;max-height:${opts.alto || 300}px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${th(colLbl, 'left')}${th('N°', 'right')}${th('MONTO', 'right')}${th('% ', 'right')}${th('', 'left')}</tr></thead>
          <tbody>${filas.map((f, i) => `
            <tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="padding:.3rem .6rem;font-size:.65rem;${SEP}" title="${esc(f.k)}">${esc(f.k)}</td>
              <td style="padding:.3rem .6rem;text-align:right;font-size:.63rem;color:var(--mut);${SEP}">${f.n}</td>
              <td style="padding:.3rem .6rem;text-align:right;font-size:.65rem;font-weight:600;
                         font-variant-numeric:tabular-nums;${SEP}">${nCLP(f.monto)}</td>
              <td style="padding:.3rem .6rem;text-align:right;font-size:.6rem;color:var(--mut);${SEP}">${pc(f.monto, total)}</td>
              <td style="padding:.3rem .6rem;width:100px">
                <div style="height:7px;background:var(--gy);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${f.monto / max * 100}%;background:${opts.color || '#33448D'}"></div>
                </div></td>
            </tr>`).join('')}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.35rem .6rem;font-size:.64rem;${SEP}">TOTAL</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;${SEP}">${filas.reduce((s, f) => s + f.n, 0)}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.64rem;font-variant-numeric:tabular-nums;${SEP}">${nCLP(total)}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">100%</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  // ── 1. OPORTUNIDADES POR FACTURAR ────────────────────────────
  let _chOpProp = null;
  function opProp() {
    const ctx = document.getElementById('cBrOpProp');
    if (!ctx || !window.Chart) return;
    if (_chOpProp) { _chOpProp.destroy(); _chOpProp = null; }
    const g = OP.por_propietario || [];
    const tot = g.reduce((s, x) => s + x.monto, 0);
    _chOpProp = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels: g.map(x => x.k), datasets: [{ data: g.map(x => x.monto),
        backgroundColor: COLORS, borderWidth: 2, borderColor: 'var(--wh)' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '52%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 6 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${nCLP(c.raw)} (${pc(c.raw, tot)})` } },
        },
      },
      plugins: [pctArcos],
    });
  }

  function opDetalle() {
    const box = document.getElementById('br-op-det');
    if (!box) return;
    const it = OP.items || [];
    box.innerHTML = `
      <div style="overflow-x:auto;max-height:420px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:900px">
          <thead><tr>${th('PROPIETARIO', 'left')}${th('CLIENTE', 'left')}${th('OPORTUNIDAD', 'left')}
            ${th('N° OC', 'left')}${th('OV SAP', 'left')}${th('MONTO', 'right')}</tr></thead>
          <tbody>${it.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="padding:.28rem .6rem;font-size:.63rem;${SEP}">${esc(r.prop)}</td>
              <td style="padding:.28rem .6rem;font-size:.63rem;${SEP}" title="${esc(r.cliente)}">${esc(r.cliente)}</td>
              <td style="padding:.28rem .6rem;font-size:.62rem;color:var(--mut);${SEP}" title="${esc(r.oport)}">${esc(r.oport)}</td>
              <td style="padding:.28rem .6rem;font-size:.6rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(r.oc)}</td>
              <td style="padding:.28rem .6rem;font-size:.6rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(r.ov)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.64rem;font-weight:600;
                         font-variant-numeric:tabular-nums">${nCLP(r.monto)}</td>
            </tr>`).join('')}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="5" style="padding:.35rem .6rem;font-size:.64rem">TOTAL · ${it.length} oportunidades</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.64rem;font-variant-numeric:tabular-nums">${nCLP(OP.total)}</td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  // ── 2. BRECHA SIN STOCK ──────────────────────────────────────
  function stKPIs() {
    const box = document.getElementById('br-st-kpi');
    if (!box) return;
    const ag = ST.aging || [];
    const viejo = ag.filter(x => x.k === '91–180 días' || x.k === 'Más de 180 días')
                    .reduce((s, x) => s + x.monto, 0);
    const tile = (lbl, v, sub, kc) =>
      `<div class="kpi" style="--kc:${kc}">
         <div class="kpi-lbl">${lbl}</div>
         <div class="kpi-val" style="color:${kc}">${v}</div>
         <div class="kpi-sub">${sub}</div>
       </div>`;
    box.innerHTML =
      tile('Órdenes Detenidas', nUn(ST.n_ov),
           `${nUn(ST.n)} líneas de repuesto · ${nUn(ST.cant_total)} unidades`, 'var(--az3)') +
      tile('Clientes Afectados', nUn(ST.n_clientes),
           `${(ST.por_linea || []).length} líneas de negocio`, 'var(--az2)') +
      tile('Espera Promedio', ST.dias_prom != null ? nUn(ST.dias_prom) + ' días' : '—',
           ST.dias_max != null ? `la más antigua lleva ${nUn(ST.dias_max)} días` : '—', 'var(--or)') +
      tile('Brecha con Más de 90 Días', nMM(viejo),
           `${pc(viejo, ST.total)} del total · riesgo de perderse`, 'var(--rd)');
  }

  let _chAging = null, _chLinea = null, _chMes = null;

  function stAging() {
    const ctx = document.getElementById('cBrStAging');
    if (!ctx || !window.Chart) return;
    if (_chAging) { _chAging.destroy(); _chAging = null; }
    const g = (ST.aging || []).filter(x => x.monto > 0);
    _chAging = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: g.map(x => x.k), datasets: [{ label: 'Brecha', data: g.map(x => x.monto),
        backgroundColor: g.map(x => AGING_COLOR[x.k] || '#33448D'), borderWidth: 0, borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: c => ` ${nCLP(c.raw)} (${pc(c.raw, ST.total)})`,
            afterLabel: c => `${g[c.dataIndex].n} líneas de repuesto`,
          } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 8 } } },
          y: { beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
               title: { display: true, text: 'MM$', font: { size: 8 }, color: '#6B7BA8' } },
        },
      },
    });
  }

  function stLinea() {
    const ctx = document.getElementById('cBrStLinea');
    if (!ctx || !window.Chart) return;
    if (_chLinea) { _chLinea.destroy(); _chLinea = null; }
    const g = ST.por_linea || [];
    _chLinea = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: { labels: g.map(x => x.k.length > 30 ? x.k.slice(0, 29) + '…' : x.k),
              datasets: [{ data: g.map(x => x.monto), backgroundColor: COLORS,
                           borderWidth: 2, borderColor: 'var(--wh)' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '52%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 5 } },
          tooltip: { callbacks: {
            label: c => ` ${nCLP(c.raw)} (${pc(c.raw, ST.total)})`,
            afterLabel: c => `${g[c.dataIndex].n} líneas · ${nUn(g[c.dataIndex].cant)} un`,
          } },
        },
      },
      plugins: [pctArcos],
    });
  }

  function stMes() {
    const ctx = document.getElementById('cBrStMes');
    if (!ctx || !window.Chart) return;
    if (_chMes) { _chMes.destroy(); _chMes = null; }
    const g = ST.por_mes || [];
    let acum = 0;
    const acumArr = g.map(x => (acum += x.monto));
    _chMes = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: g.map(x => x.k),
        datasets: [
          { label: 'Brecha del mes', data: g.map(x => x.monto),
            backgroundColor: '#C00000CC', borderColor: '#C00000', borderWidth: 1,
            borderRadius: 3, order: 2, yAxisID: 'y' },
          { label: 'Acumulado', data: acumArr, type: 'line', borderColor: '#002D73',
            borderWidth: 2, pointRadius: 2, fill: false, order: 1, yAxisID: 'y2' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 7 } },
          tooltip: { callbacks: {
            label: c => ` ${c.dataset.label}: ${nCLP(c.raw)}`,
            afterBody: it => it.length ? `${g[it[0].dataIndex].n} líneas de repuesto` : '',
          } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 8 } } },
          y: { beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
               title: { display: true, text: 'MM$ del mes', font: { size: 8 }, color: '#6B7BA8' } },
          y2: { position: 'right', beginAtZero: true, grid: { display: false },
                ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
                title: { display: true, text: 'MM$ acumulado', font: { size: 8 }, color: '#002D73' } },
        },
      },
    });
  }

  // Repuestos que más bloquean, cruzados con el stock en bodega
  // ── Repuestos que bloquean ventas ────────────────────────────
  // Todos los SKU en brecha, cruzados contra bodega y contra las OC ya
  // puestas al proveedor. Por Comprar = solicitadas − stock − back order.
  let _prodQ = '', _prodSoloComprar = false;
  window._brProdQ = function (v) { _prodQ = v; stProductos(true); };
  window._brProdF = function () { _prodSoloComprar = !_prodSoloComprar; stProductos(); };

  function stProductos(mantenerFoco) {
    const box = document.getElementById('br-st-prod');
    if (!box) return;
    // Índice SKU -> stock actual, desde la hoja Inventario Bodega
    const stockSku = {};
    Object.values(INV.data || {}).forEach(d => (d.items || []).forEach(i => {
      stockSku[i.sku] = (stockSku[i.sku] || 0) + i.st;
    }));

    const filas = (ST.productos || []).map(p => {
      const s   = stockSku[p.cod];
      const bo  = p.bo || 0;
      const cmp = Math.max(p.cant - (s || 0) - bo, 0);
      return Object.assign({}, p, { stock: s, bo: bo, comprar: cmp });
    });

    const q = _prodQ.trim().toUpperCase();
    const g = filas.filter(p =>
      (!q || p.cod.toUpperCase().includes(q) || (p.prod || '').toUpperCase().includes(q)) &&
      (!_prodSoloComprar || p.comprar > 0));

    const tot = k => g.reduce((a, p) => a + (p[k] || 0), 0);
    const nCob = filas.filter(p => p.comprar === 0).length;
    const nBO  = filas.filter(p => p.bo > 0).length;

    box.innerHTML = `
      <div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center">
        <input id="br-prod-q" value="${esc(_prodQ)}" placeholder="Buscar SKU o producto…"
          oninput="window._brProdQ(this.value)"
          style="font-size:.6rem;padding:.2rem .45rem;border:1px solid var(--brd);border-radius:3px;
                 background:var(--bg2);color:var(--txt);width:190px">
        <button onclick="window._brProdF()" style="font-size:.58rem;padding:.18rem .5rem;border-radius:3px;cursor:pointer;
          border:1px solid ${_prodSoloComprar ? '#C00000' : 'var(--brd)'};
          background:${_prodSoloComprar ? '#C0000018' : 'var(--bg2)'};
          color:${_prodSoloComprar ? '#C00000' : 'var(--txt)'};font-weight:${_prodSoloComprar ? 700 : 400}">
          Sólo con compra pendiente</button>
        <span style="font-size:.58rem;color:var(--mut)">
          ${g.length} de ${filas.length} SKU · ${nBO} con back order · ${nCob} ya cubiertos entre stock y OC</span>
      </div>
      <div style="overflow-x:auto;max-height:460px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:760px">
          <thead><tr>${th('SKU', 'left')}${th('PRODUCTO', 'left')}${th('OPS', 'right')}
            ${th('UN SOLIC.', 'right')}${th('MONTO', 'right')}${th('STOCK', 'right')}
            ${th('BACK ORDER', 'right')}${th('POR COMPRAR', 'right')}</tr></thead>
          <tbody>${g.map((p, i) => {
            const s = p.stock, hay = s !== undefined && s > 0;
            return `<tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="padding:.28rem .6rem;font-size:.6rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(p.cod)}</td>
              <td style="padding:.28rem .6rem;font-size:.62rem;color:var(--mut);${SEP}"
                  title="${esc(p.prod)}">${esc(p.prod.length > 40 ? p.prod.slice(0, 39) + '…' : p.prod)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.62rem;${SEP}"
                  title="${p.n_cli} cliente(s)">${p.n}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.62rem;color:var(--mut);${SEP}">${nUn(p.cant)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.63rem;font-weight:600;
                         font-variant-numeric:tabular-nums;${SEP}">${nCLP(p.monto)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.6rem;${SEP};
                         color:${hay ? 'var(--gn)' : 'var(--rd)'};font-weight:700">
                ${s === undefined ? 'no está' : nUn(s)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.6rem;${SEP};
                         color:${p.bo > 0 ? '#1F6FB2' : 'var(--mut)'};font-weight:${p.bo > 0 ? 700 : 400}"
                  title="${p.bo > 0 ? nUn(p.bo) + ' un. solicitadas al proveedor'
                                    : 'sin órdenes de compra para este SKU'}">
                ${p.bo > 0 ? nUn(p.bo) : '—'}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.63rem;font-weight:700;
                         font-variant-numeric:tabular-nums;color:${p.comprar > 0 ? '#C00000' : 'var(--gn)'}">
                ${p.comprar > 0 ? nUn(p.comprar) : '0'}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="2" style="padding:.35rem .6rem;font-size:.62rem;${SEP}">TOTAL · ${g.length} SKU</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">${tot('n')}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">${nUn(tot('cant'))}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nCLP(tot('monto'))}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">
              ${nUn(g.reduce((a, p) => a + (p.stock || 0), 0))}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">${nUn(tot('bo'))}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.62rem;
                       font-variant-numeric:tabular-nums">${nUn(tot('comprar'))}</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.5">
        <strong>Por Comprar = Un. Solicitadas − Stock − Back Order</strong>, con piso en cero: si stock y
        OC ya cubren la brecha del SKU queda en 0, no en negativo.
        «Stock» es la existencia actual en bodega (hoja Inventario Bodega); «no está» significa que el
        código no aparece en el inventario y se computa como cero.
        «Back Order» es la Cantidad Solicitada de la hoja Back Order cruzada por SKU, sumando todas las
        órdenes de compra sin distinguir su estatus.</p>`;
    if (mantenerFoco) {
      const inp = document.getElementById('br-prod-q');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  }

  // Detalle con filtro por línea de negocio y por antigüedad
  let _fLinea = 'todas';
  let _fAging = 'todas';

  // Mismos tramos que el gráfico de antigüedad (definidos en el extractor)
  const TRAMOS = [[0, 30, '0–30 días'], [31, 60, '31–60 días'], [61, 90, '61–90 días'],
                  [91, 180, '91–180 días'], [181, Infinity, 'Más de 180 días']];
  const tramoDe = d => {
    if (d == null) return 'Sin fecha';
    const t = TRAMOS.find(([lo, hi]) => d >= lo && d <= hi);
    return t ? t[2] : 'Sin fecha';
  };

  function btn(k, txt, activo, fn, color) {
    const on = activo === k;
    const c = on ? (color || 'var(--az1)') : 'var(--brd)';
    return `<button onclick="window.${fn}(${JSON.stringify(k).replace(/"/g, '&quot;')})"
      style="font-size:.58rem;padding:.2rem .55rem;border-radius:3px;cursor:pointer;border:1px solid ${c};
      background:${on ? (color || 'var(--az1)') : 'var(--bg2)'};color:${on ? '#fff' : 'var(--txt)'};
      font-weight:${on ? '700' : '400'}">${txt}</button>`;
  }

  function stFiltro() {
    const box = document.getElementById('br-st-filtro');
    if (box) {
      box.innerHTML = ['todas'].concat((ST.por_linea || []).map(x => x.k))
        .map(k => btn(k, k === 'todas' ? 'Todas' : esc(k), _fLinea, '_brLinea')).join('');
    }
    const box2 = document.getElementById('br-st-filtro-ag');
    if (box2) {
      // Sólo los tramos que existen, con el color del semáforo del gráfico
      const conDatos = (ST.aging || []).filter(a => a.n > 0);
      box2.innerHTML = btn('todas', 'Todas', _fAging, '_brAging') +
        conDatos.map(a => btn(a.k, `${esc(a.k)} <span style="opacity:.7">(${a.n})</span>`,
                              _fAging, '_brAging', AGING_COLOR[a.k])).join('');
    }
  }

  function stDetalle() {
    const box = document.getElementById('br-st-det');
    if (!box) return;
    const it = (ST.items || []).filter(r =>
      (_fLinea === 'todas' || r.linea === _fLinea) &&
      (_fAging === 'todas' || tramoDe(r.dias) === _fAging));
    const tot = it.reduce((s, r) => s + r.monto, 0);

    const tag = document.getElementById('br-st-det-tag');
    if (tag) tag.textContent = `${it.length} de ${(ST.items || []).length} líneas · ${nMM(tot)}`;
    const pill = d => {
      if (d == null) return '<span style="color:var(--mut)">—</span>';
      const c = d <= 30 ? '#00832F' : d <= 60 ? '#8B8200' : d <= 90 ? '#D46000' : d <= 180 ? '#C00000' : '#7A0000';
      return `<span style="background:${c}22;color:${c};border:1px solid ${c}55;padding:.05rem .35rem;
        border-radius:3px;font-size:.58rem;font-weight:700;white-space:nowrap">${d} d</span>`;
    };
    box.innerHTML = `
      <div style="overflow-x:auto;max-height:460px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1000px">
          <thead><tr>${th('CLIENTE', 'left')}${th('OPORTUNIDAD', 'left')}${th('LÍNEA', 'left')}
            ${th('SKU', 'left')}${th('PRODUCTO', 'left')}${th('CANT', 'right')}
            ${th('MONTO', 'right')}${th('CREADA', 'left')}${th('ESPERA', 'left')}</tr></thead>
          <tbody>${it.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="padding:.26rem .6rem;font-size:.62rem;${SEP}" title="${esc(r.cliente)}">${esc(r.cliente)}</td>
              <td style="padding:.26rem .6rem;font-size:.6rem;color:var(--mut);${SEP}" title="${esc(r.oport)}">${esc(r.oport)}</td>
              <td style="padding:.26rem .6rem;font-size:.58rem;color:var(--mut);${SEP}" title="${esc(r.linea)}">${esc(r.linea)}</td>
              <td style="padding:.26rem .6rem;font-size:.58rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(r.cod)}</td>
              <td style="padding:.26rem .6rem;font-size:.6rem;color:var(--mut);${SEP}" title="${esc(r.prod)}">${esc(r.prod)}</td>
              <td style="padding:.26rem .6rem;text-align:right;font-size:.6rem;${SEP}">${nUn(r.cant)}</td>
              <td style="padding:.26rem .6rem;text-align:right;font-size:.63rem;font-weight:600;
                         font-variant-numeric:tabular-nums;${SEP}">${nCLP(r.monto)}</td>
              <td style="padding:.26rem .6rem;font-size:.58rem;color:var(--mut);${SEP}">${esc(r.fecha_fmt) || '—'}</td>
              <td style="padding:.26rem .6rem;${SEP}">${pill(r.dias)}</td>
            </tr>`).join('')}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="6" style="padding:.35rem .6rem;font-size:.63rem">
              TOTAL${_fLinea === 'todas' ? '' : ' · ' + esc(_fLinea)}${_fAging === 'todas' ? '' : ' · ' + esc(_fAging)} · ${it.length} líneas</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums">${nCLP(tot)}</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  window._brLinea = function (k) { _fLinea = k; stFiltro(); stDetalle(); };
  window._brAging = function (k) { _fAging = k; stFiltro(); stDetalle(); };

  // Plugin: % sobre los arcos de los donuts
  const pctArcos = {
    id: 'brPctArcos',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data;
      const tot  = data.reduce((s, v) => s + (v || 0), 0);
      if (!tot) return;
      ctx.save();
      ctx.font = '700 10px Roboto, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      meta.data.forEach((arc, i) => {
        const p = (data[i] || 0) / tot * 100;
        if (p < 4) return;
        const { x, y } = arc.tooltipPosition();
        const t = p.toFixed(1).replace('.', ',') + '%';
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(t, x, y);
        ctx.fillStyle = '#fff'; ctx.fillText(t, x, y);
      });
      ctx.restore();
    },
  };

  // ── Indicador en la hoja Resumen, con desglose al pasar el mouse ──
  function initSnapshot() {
    const T = totalBrecha();
    if (!T) return;

    const val = document.getElementById('rs-snap-brecha');
    if (val) val.textContent = nMM(T);

    // Bloque corto en el Resumen: las tres brechas abiertas
    const kbox = document.getElementById('rs-br-kpi');
    if (kbox) {
      const tile = (lbl, v, sub, kc) =>
        `<div class="kpi" style="--kc:${kc}">
           <div class="kpi-lbl">${lbl}</div>
           <div class="kpi-val" style="color:${kc}">${nMM(v)}</div>
           <div class="kpi-sub">${sub} · ${pc(v, T)} de la brecha</div>
         </div>`;
      kbox.innerHTML =
        tile('Oportunidades por Facturar', OP.total, `${nUn(OP.n)} oportunidades`, 'var(--az2)') +
        tile('Facturación Bajo Contrato',  CT.total, `${nUn(CT.n_clientes)} clientes`, 'var(--am)') +
        tile('Brecha Sin Stock',           ST.total, `${nUn(ST.n_ov)} órdenes detenidas`, 'var(--rd)');
    }
    const tt = document.getElementById('rs-br-tot');
    if (tt) tt.textContent = nMM(T);

    const pop = document.getElementById('rs-snap-brecha-pop');
    if (!pop) return;
    const filas = [
      ['Oportunidades por Facturar', OP.total || 0, '#33448D'],
      ['Bajo Contrato',              CT.total || 0, '#FFC000'],
      ['Sin Stock',                  ST.total || 0, '#C00000'],
    ];
    pop.innerHTML =
      `<div style="font-size:.55rem;text-transform:uppercase;letter-spacing:.06em;
                   color:rgba(255,255,255,.55);margin-bottom:.3rem">Composición de la brecha</div>` +
      filas.map(([l, v, c]) =>
        `<div class="kpi-pop-row">
           <span class="d" style="background:${c}"></span>
           <span class="l">${l}</span>
           <span class="v">${nMM(v)}</span>
           <span class="p">${pc(v, T)}</span>
         </div>`).join('') +
      `<div class="kpi-pop-row kpi-pop-tot">
         <span class="d" style="background:transparent"></span>
         <span class="l" style="color:#fff">TOTAL</span>
         <span class="v">${nMM(T)}</span>
         <span class="p">100%</span>
       </div>
       <div style="font-size:.53rem;color:rgba(255,255,255,.45);margin-top:.35rem">
         Clic para ver el detalle completo</div>`;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSnapshot);
  } else {
    initSnapshot();
  }


  // ── Brecha por cliente, expandible al detalle de SKU ─────────
  // Colapsada muestra monto y la mezcla de rotacion de los SKU faltantes;
  // al abrir un cliente aparece cada SKU con su rotacion y espera.
  const ROT_COLOR = {
    'Alta Rotacion': '#00832F', 'Alta Rotación': '#00832F',
    'Mediana Rotacion': '#8B8200', 'Mediana Rotación': '#8B8200',
    'Baja Rotacion': '#D46000', 'Baja Rotación': '#D46000',
    'Sin Rotacion': '#C00000', 'Sin Rotación': '#C00000',
    'Sin Información': '#B8C1D8', 'Sin informacion': '#B8C1D8',
  };
  const rotColor = r => ROT_COLOR[r] || '#B8C1D8';
  // Gris claro necesita texto oscuro; el resto de los tonos aguanta blanco
  const rotTxt = r => (rotColor(r) === '#B8C1D8' ? '#1B2A5B' : '#fff');

  const _stOpen = new Set();
  window._brCli = function (c) {
    if (_stOpen.has(c)) _stOpen.delete(c); else _stOpen.add(c);
    stClientes();
  };
  window._brCliTodos = function (abrir) {
    _stOpen.clear();
    if (abrir) (ST.clientes_det || []).forEach(x => _stOpen.add(x.cliente));
    stClientes();
  };

  function stClientes() {
    const box = document.getElementById('br-st-cli');
    if (!box) return;
    const dat = ST.clientes_det || [];
    if (!dat.length) { box.innerHTML = ''; return; }
    const maxV = Math.max(...dat.map(d => d.monto), 1);

    // Barra apilada con la mezcla de rotacion, proporcional al valorizado.
    // El % va dentro del segmento; los muy angostos lo omiten y quedan en el tooltip.
    const barraRot = (rot, alto) => {
      const partes = Object.entries(rot || {});
      if (!partes.length) return '';
      const h = alto || 15;
      return `<div style="display:flex;height:${h}px;border-radius:3px;overflow:hidden;min-width:120px">` +
        partes.map(([k, v]) =>
          `<div style="width:${v.pct}%;background:${rotColor(k)};color:${rotTxt(k)};
             display:flex;align-items:center;justify-content:center;font-size:.5rem;font-weight:700;
             line-height:1;overflow:hidden" title="${esc(k)}: ${nCLP(v.monto)} · ${v.pct}% del valorizado · ${v.n} SKU"
           >${v.pct >= 7 ? v.pct.toString().replace('.', ',') + '%' : ''}</div>`
        ).join('') + '</div>';
    };

    // Mezcla global, misma forma que el `rot` de cada cliente
    const rotTotal = {};
    (ST.por_rotacion || []).forEach(r => {
      rotTotal[r.k] = { monto: r.monto, n: r.n, pct: r.pct_monto };
    });

    let rows = '';
    dat.forEach((d, i) => {
      const open  = _stOpen.has(d.cliente);
      const zebra = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';
      rows += `<tr style="background:${zebra};cursor:pointer;border-left:3px solid #C00000"
          onclick="window._brCli(${JSON.stringify(d.cliente).replace(/"/g, '&quot;')})">
        <td style="padding:.3rem .6rem;font-size:.64rem;font-weight:600;${SEP}" title="${esc(d.cliente)}">
          <span style="display:inline-block;width:.8rem;font-size:.52rem;color:var(--mut);
            transform:rotate(${open ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(d.cliente)}
        </td>
        <td style="padding:.3rem .6rem;text-align:right;font-size:.62rem;color:var(--mut);${SEP}">${d.n}</td>
        <td style="padding:.3rem .6rem;text-align:right;font-size:.65rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEP}">${nCLP(d.monto)}</td>
        <td style="padding:.3rem .6rem;text-align:right;font-size:.6rem;color:var(--mut);${SEP}">${pc(d.monto, ST.total)}</td>
        <td style="padding:.3rem .6rem;${SEP}">
          <div style="display:flex;align-items:center;gap:5px">
            <div style="flex:1;height:6px;background:var(--gy);border-radius:3px;overflow:hidden;min-width:40px">
              <div style="height:100%;width:${d.monto / maxV * 100}%;background:#C00000"></div></div>
          </div></td>
        <td style="padding:.3rem .6rem;width:34%">${barraRot(d.rot)}</td>
      </tr>`;

      if (open) {
        rows += `<tr style="background:var(--bg)"><td colspan="6" style="padding:0">
          <table style="width:100%;border-collapse:collapse;background:var(--bg)">
            <thead><tr>
              ${['SKU','PRODUCTO','LÍNEA','CANT','MONTO','ROTACIÓN','ESPERA'].map((t, k) =>
                `<th style="background:var(--gy);color:var(--az1);padding:.2rem .5rem;font-size:.53rem;
                  text-align:${k >= 3 && k <= 4 ? 'right' : 'left'};border-right:1px solid var(--brd)">${t}</th>`).join('')}
            </tr></thead>
            <tbody>${(d.skus || []).map(x => {
              const dc = x.dias == null ? '#B8C1D8'
                : x.dias <= 30 ? '#00832F' : x.dias <= 60 ? '#8B8200'
                : x.dias <= 90 ? '#D46000' : x.dias <= 180 ? '#C00000' : '#7A0000';
              return `<tr>
                <td style="padding:.22rem .5rem .22rem 1.6rem;font-size:.57rem;
                           font-family:'Roboto Mono',monospace;${SEP}">${esc(x.cod)}</td>
                <td style="padding:.22rem .5rem;font-size:.59rem;color:var(--mut);max-width:260px;overflow:hidden;
                           text-overflow:ellipsis;white-space:nowrap;${SEP}" title="${esc(x.prod)}">${esc(x.prod)}</td>
                <td style="padding:.22rem .5rem;font-size:.55rem;color:var(--mut);${SEP}"
                    title="${esc(x.oport)}">${esc(String(x.linea).slice(0, 26))}</td>
                <td style="padding:.22rem .5rem;text-align:right;font-size:.58rem;${SEP}">${nUn(x.cant)}</td>
                <td style="padding:.22rem .5rem;text-align:right;font-size:.6rem;font-weight:600;
                           font-variant-numeric:tabular-nums;${SEP}">${nCLP(x.monto)}</td>
                <td style="padding:.22rem .5rem;${SEP}">
                  <span style="background:${rotColor(x.rot)}22;color:${rotColor(x.rot)};
                    border:1px solid ${rotColor(x.rot)}55;padding:.04rem .3rem;border-radius:3px;
                    font-size:.53rem;font-weight:700;white-space:nowrap">${esc(x.rot)}</span></td>
                <td style="padding:.22rem .5rem;font-size:.56rem;color:${dc};font-weight:700">
                  ${x.dias == null ? '—' : x.dias + ' d'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table></td></tr>`;
      }
    });

    // Leyenda de rotacion, con el peso global de cada tipo
    const leyenda = (ST.por_rotacion || []).map(r =>
      `<span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.56rem;margin-right:.8rem">
         <span style="width:9px;height:9px;border-radius:2px;background:${rotColor(r.k)}"></span>
         ${esc(r.k)} <strong>${r.pct_monto}%</strong>
         <span style="color:var(--mut)">· ${r.n} SKU</span></span>`).join('');

    box.innerHTML = `
      <div style="display:flex;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center">
        <button onclick="window._brCliTodos(true)" style="font-size:.58rem;padding:.18rem .5rem;border:1px solid var(--brd);
          border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Expandir todo</button>
        <button onclick="window._brCliTodos(false)" style="font-size:.58rem;padding:.18rem .5rem;border:1px solid var(--brd);
          border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Colapsar todo</button>
        <span style="font-size:.58rem;color:var(--mut)">${dat.length} clientes · clic para ver los SKU faltantes</span>
      </div>
      <div style="padding:.3rem 0 .5rem;border-bottom:1px solid var(--brd);margin-bottom:.4rem">${leyenda}</div>
      <div style="overflow-x:auto;max-height:420px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:620px">
          <thead><tr>
            ${th('CLIENTE', 'left')}${th('SKU', 'right')}${th('MONTO', 'right')}${th('%', 'right')}
            ${th('', 'left')}${th('MEZCLA DE ROTACIÓN (% DEL VALORIZADO)', 'left')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.35rem .6rem;font-size:.63rem;${SEP}">TOTAL · ${dat.length} clientes</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">${dat.reduce((s2, d) => s2 + d.n, 0)}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums;${SEP}">${nCLP(ST.total)}</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.6rem;${SEP}">100%</td>
            <td style="${SEP}"></td>
            <td style="padding:.3rem .6rem">${barraRot(rotTotal, 17)}</td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  // ══════════════════════════════════════════════════════════════
  // QUÉ COMPRAR POR CLIENTE
  // ══════════════════════════════════════════════════════════════
  // Cruza la cantidad pedida de cada SKU con el stock en bodega y con las
  // órdenes ya puestas al proveedor, para llegar a cuánto hay que comprar.
  //
  // El punto delicado es que el stock es UNO SOLO y varios clientes pueden
  // estar esperando el mismo repuesto. Restarle las mismas 5 unidades a cada
  // cliente diría que todos están cubiertos y que no hay que comprar nada.
  // Por eso la asignación es secuencial: dentro de cada SKU los clientes se
  // ordenan por el monto que tienen detenido y las unidades disponibles se
  // reparten en ese orden hasta agotarse. Lo que queda sin cubrir después de
  // repartir es lo que efectivamente hay que comprar.
  //
  // El criterio de prioridad es el dinero en juego, no el orden alfabético ni
  // la antigüedad: si hay una sola pieza, se la lleva la brecha más grande.
  let _cmpSoloComprar = false;
  const _cmpOpen = new Set();

  window._brCmpTog = function (c) {
    if (_cmpOpen.has(c)) _cmpOpen.delete(c); else _cmpOpen.add(c);
    stCompras();
  };
  window._brCmpF = function () { _cmpSoloComprar = !_cmpSoloComprar; stCompras(); };

  function _asignacion() {
    // Stock actual por SKU, sumando todas las bodegas.
    const stock = {};
    Object.values(INV.data || {}).forEach(d => (d.items || []).forEach(i => {
      stock[i.sku] = (stock[i.sku] || 0) + i.st;
    }));
    const bo = A.back_order || {};

    // Demanda al nivel (cliente, SKU): un mismo cliente puede pedir el mismo
    // repuesto en varias órdenes de venta y hay que tratarlas como una sola.
    const dem = {};
    (ST.clientes_det || []).forEach(c => (c.skus || []).forEach(k => {
      const id = c.cliente + '\u0000' + k.cod;
      const d = dem[id] || (dem[id] = {
        cliente: c.cliente, cod: k.cod, prod: k.prod, cant: 0, monto: 0, rot: k.rot,
      });
      d.cant += k.cant; d.monto += k.monto;
    }));

    // Reparto por SKU, de mayor a menor monto detenido.
    const porSku = {};
    Object.values(dem).forEach(d => (porSku[d.cod] || (porSku[d.cod] = [])).push(d));
    Object.keys(porSku).forEach(cod => {
      let dispSt = stock[cod] === undefined ? 0 : stock[cod];
      let dispBo = +bo[cod] || 0;
      porSku[cod].sort((a, b) => b.monto - a.monto).forEach(d => {
        d.pu = d.cant ? d.monto / d.cant : 0;
        d.enInv = stock[cod] !== undefined;
        d.st = Math.min(dispSt, d.cant); dispSt -= d.st;
        const resto = d.cant - d.st;
        d.bo = Math.min(dispBo, resto); dispBo -= d.bo;
        d.comprar = resto - d.bo;
        d.valComprar = d.comprar * d.pu;
      });
    });
    return Object.values(dem);
  }

  function stCompras() {
    const box = document.getElementById('br-st-compras');
    if (!box) return;
    const items = _asignacion();
    if (!items.length) { box.innerHTML = ''; return; }

    // Agregado por cliente
    const g = {};
    items.forEach(d => {
      const c = g[d.cliente] || (g[d.cliente] = {
        cliente: d.cliente, n: 0, cant: 0, monto: 0, st: 0, bo: 0, comprar: 0, val: 0, skus: [],
      });
      c.n++; c.cant += d.cant; c.monto += d.monto;
      c.st += d.st; c.bo += d.bo; c.comprar += d.comprar; c.val += d.valComprar;
      c.skus.push(d);
    });
    // De mayor a menor brecha en $: es el mismo orden en que se reparte el
    // stock, así que la tabla se lee en el orden en que se prioriza.
    let D = Object.values(g).sort((a, b) => b.monto - a.monto || b.val - a.val);
    if (_cmpSoloComprar) D = D.filter(c => c.comprar > 0);

    const T = D.reduce((a, c) => ({
      n: a.n + c.n, cant: a.cant + c.cant, monto: a.monto + c.monto, st: a.st + c.st,
      bo: a.bo + c.bo, comprar: a.comprar + c.comprar, val: a.val + c.val,
    }), { n: 0, cant: 0, monto: 0, st: 0, bo: 0, comprar: 0, val: 0 });

    const TD = 'padding:.3rem .55rem;white-space:nowrap';
    const num = (v, extra) => '<td style="' + TD + ';text-align:right;font-size:.62rem;' +
      'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v + '</td>';

    let html =
      '<div style="display:flex;gap:.5rem;margin-bottom:.55rem;flex-wrap:wrap;align-items:center">' +
        '<button onclick="window._brCmpF()" style="font-size:.58rem;padding:.18rem .55rem;border-radius:3px;' +
          'cursor:pointer;border:1px solid ' + (_cmpSoloComprar ? '#C00000' : 'var(--brd)') + ';' +
          'background:' + (_cmpSoloComprar ? '#C0000018' : 'var(--bg2)') + ';color:' +
          (_cmpSoloComprar ? '#C00000' : 'var(--txt)') + ';font-weight:' +
          (_cmpSoloComprar ? 700 : 400) + '">Sólo con compra pendiente</button>' +
        '<span style="font-size:.57rem;color:var(--mut)">' + D.length + ' clientes · ' + T.n +
          ' pares cliente-SKU · clic en un cliente para el detalle</span>' +
      '</div>' +
      '<div style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
      '<table style="width:100%;border-collapse:collapse;min-width:940px;table-layout:fixed"><colgroup>' +
      '<col style="width:26%"><col style="width:7%"><col style="width:9%"><col style="width:11%">' +
      '<col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:12%">' +
      '<col style="width:8%">' +
      '</colgroup><thead><tr>' +
      th('CLIENTE / SKU') + th('SKU', 'right') + th('UN. SOLIC.', 'right') + th('BRECHA', 'right') +
      th('DE STOCK', 'right') + th('DE BACK ORDER', 'right') + th('POR COMPRAR', 'right') +
      th('VALOR A COMPRAR', 'right') + th('% CUBIERTO', 'right') +
      '</tr></thead><tbody>';

    D.forEach((c, i) => {
      const ab = _cmpOpen.has(c.cliente);
      const cub = c.cant ? (c.st + c.bo) / c.cant * 100 : 0;
      html += '<tr onclick="window._brCmpTog(' + JSON.stringify(c.cliente).replace(/"/g, '&quot;') + ')" ' +
        'style="cursor:pointer;background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD + ';font-size:.65rem;font-weight:700;color:var(--am);overflow:hidden;' +
          'text-overflow:ellipsis;' + SEP + '" title="' + esc(c.cliente) + '">' +
          '<span style="display:inline-block;width:11px;color:var(--mut)">' + (ab ? '▾' : '▸') + '</span>' +
          esc(c.cliente) + '</td>' +
        num(c.n) + num(nUn(c.cant), 'color:var(--mut);') +
        num(nMM(c.monto), 'font-weight:700;color:var(--az1);') +
        num(c.st ? nUn(c.st) : '—', c.st ? 'color:var(--gn);' : 'color:var(--mut);') +
        num(c.bo ? nUn(c.bo) : '—', c.bo ? 'color:#1F6FB2;' : 'color:var(--mut);') +
        num(c.comprar ? nUn(c.comprar) : '0',
            c.comprar ? 'font-weight:700;color:#C00000;' : 'font-weight:700;color:var(--gn);') +
        num(c.val ? nMM(c.val) : '—', c.val ? 'font-weight:700;color:#C00000;' : 'color:var(--gn);') +
        num(cub.toFixed(0) + '%', 'color:' + (cub >= 99 ? 'var(--gn)' : cub >= 50 ? 'var(--or)' : 'var(--rd)') + ';') +
        '</tr>';

      if (ab) {
        c.skus.slice().sort((a, b) => b.valComprar - a.valComprar || b.monto - a.monto).forEach(d => {
          const cb = d.cant ? (d.st + d.bo) / d.cant * 100 : 0;
          html += '<tr style="background:var(--gy)">' +
            '<td style="' + TD + ';font-size:.6rem;padding-left:1.8rem;overflow:hidden;' +
              'text-overflow:ellipsis;' + SEP + '" title="' + esc(d.cod + ' · ' + d.prod) + '">' +
              '<span style="font-family:\'Roboto Mono\',monospace;font-size:.57rem;color:var(--az2)">' +
              esc(d.cod) + '</span> <span style="color:var(--mut)">' + esc(d.prod) + '</span></td>' +
            '<td style="' + SEP + '"></td>' +
            num(nUn(d.cant), 'color:var(--mut);') + num(nMM(d.monto), 'color:var(--az2);') +
            num(d.st ? nUn(d.st) : (d.enInv ? '0' : 'no está'),
                d.st ? 'color:var(--gn);' : 'color:var(--mut);font-size:.57rem;') +
            num(d.bo ? nUn(d.bo) : '—', d.bo ? 'color:#1F6FB2;' : 'color:var(--mut);') +
            num(d.comprar ? nUn(d.comprar) : '0', d.comprar ? 'color:#C00000;font-weight:700;' : 'color:var(--gn);') +
            num(d.valComprar ? nMM(d.valComprar) : '—', d.valComprar ? 'color:#C00000;' : 'color:var(--gn);') +
            num(cb.toFixed(0) + '%', 'color:var(--mut);') +
            '</tr>';
        });
      }
    });

    const cubT = T.cant ? (T.st + T.bo) / T.cant * 100 : 0;
    html += '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.35rem .55rem;font-size:.62rem;' + SEP + '">TOTAL · ' + D.length + ' clientes</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + T.n + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + nUn(T.cant) + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + nMM(T.monto) + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + nUn(T.st) + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + nUn(T.bo) + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + nUn(T.comprar) + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem;' + SEP + '">' + nMM(T.val) + '</td>' +
      '<td style="padding:.35rem .55rem;text-align:right;font-size:.62rem">' + cubT.toFixed(0) + '%</td>' +
      '</tr></tfoot></table></div>' +
      '<p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      '<strong>Por comprar = Un. solicitadas − stock asignado − back order asignado.</strong> ' +
      'El stock de bodega y las órdenes ya puestas al proveedor son una sola bolsa por SKU, así que se ' +
      '<strong>asignan secuencialmente</strong>: dentro de cada repuesto los clientes se ordenan por el monto ' +
      'que tienen detenido y las unidades se reparten en ese orden hasta agotarse. Por eso un cliente puede ' +
      'aparecer sin cobertura aunque el SKU figure con stock: ese stock ya quedó comprometido con una brecha ' +
      'mayor. Restarle el stock completo a cada cliente por separado —que es lo intuitivo— haría aparecer ' +
      'cubierta una demanda que la bodega no alcanza a servir. ' +
      '«no está» significa que el código no aparece en el inventario y se computa como cero.</p>';

    box.innerHTML = html;
    const cEl = document.getElementById('br-cmp-count');
    if (cEl) cEl.textContent = nUn(T.comprar) + ' unidades por comprar · ' + nMM(T.val);
  }

  window.brComprasExportPDF = async function () {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
      return;
    }
    let wrap = null;
    try {
      const src = document.getElementById('br-st-compras');
      if (!src) throw new Error('No se encontró el contenido');
      const hoy = A.hoy || '';
      wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1240px;' +
        'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
      const enc = document.createElement('div');
      enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
      enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
        'TECSERVICE — Qué comprar por cliente</span>' +
        (hoy ? '&emsp;<span style="font-size:10px;color:#555">Datos al ' + hoy + '</span>' : '');
      wrap.appendChild(enc);
      const cl = src.cloneNode(true);
      cl.querySelectorAll('*').forEach(n => {
        n.style.position = 'static'; n.style.maxHeight = 'none'; n.style.overflow = 'visible';
      });
      wrap.appendChild(cl);
      document.body.appendChild(wrap);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const realW = Math.ceil(wrap.getBoundingClientRect().width) || wrap.offsetWidth;
      const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
      if (!realW || !realH) throw new Error('No se pudo medir el contenido');
      const canvas = await html2canvas(wrap, {
        scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
        width: realW, height: realH, windowWidth: realW, windowHeight: realH,
      });
      const MM_PX = 25.4 / 96;
      await hdEntregar(canvas, 'Que_comprar_por_cliente_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                       realW * MM_PX, realH * MM_PX);
    } catch (err) {
      console.error('brComprasExportPDF:', err);
      alert('Error al generar: ' + err.message);
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
  };

  window.initBrechas = function () {
    if (!OP.total && !ST.total && !CT.total) return;
    kpis(); barraComp();
    opProp(); tablaGrupo('br-op-cli', OP.por_cliente || [], OP.total, 'CLIENTE', { color: '#33448D' });
    opDetalle();
    stKPIs(); stAging(); stLinea(); stMes();
    stClientes();
    stProductos(); stFiltro(); stDetalle();
    stCompras();
  };
})();
