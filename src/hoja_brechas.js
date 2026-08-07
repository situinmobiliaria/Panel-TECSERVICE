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

  const COLORS = ['#002D73','#28D2C3','#FFC000','#33448D','#7A1FAA','#D46000',
                  '#00832F','#C00000','#4C9BE8','#E8B24C'];
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
            ${th('N° OC', 'left')}${th('OV SAP', 'left')}${th('FECHA FACT.', 'left')}${th('MONTO', 'right')}</tr></thead>
          <tbody>${it.map((r, i) => `
            <tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="padding:.28rem .6rem;font-size:.63rem;${SEP}">${esc(r.prop)}</td>
              <td style="padding:.28rem .6rem;font-size:.63rem;${SEP}" title="${esc(r.cliente)}">${esc(r.cliente)}</td>
              <td style="padding:.28rem .6rem;font-size:.62rem;color:var(--mut);${SEP}" title="${esc(r.oport)}">${esc(r.oport)}</td>
              <td style="padding:.28rem .6rem;font-size:.6rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(r.oc)}</td>
              <td style="padding:.28rem .6rem;font-size:.6rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(r.ov)}</td>
              <td style="padding:.28rem .6rem;font-size:.6rem;color:var(--mut);${SEP}">${esc(r.fecha_fmt) || '—'}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.64rem;font-weight:600;
                         font-variant-numeric:tabular-nums">${nCLP(r.monto)}</td>
            </tr>`).join('')}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="6" style="padding:.35rem .6rem;font-size:.64rem">TOTAL · ${it.length} oportunidades</td>
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
  function stProductos() {
    const box = document.getElementById('br-st-prod');
    if (!box) return;
    // Índice SKU -> stock actual, desde la hoja Inventario TS
    const stockSku = {};
    Object.values(INV.data || {}).forEach(d => (d.items || []).forEach(i => {
      stockSku[i.sku] = (stockSku[i.sku] || 0) + i.st;
    }));
    const g = (ST.productos || []).slice(0, 15);
    box.innerHTML = `
      <div style="overflow-x:auto;max-height:300px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:520px">
          <thead><tr>${th('SKU', 'left')}${th('PRODUCTO', 'left')}${th('OPS', 'right')}
            ${th('UN', 'right')}${th('MONTO', 'right')}${th('STOCK', 'right')}</tr></thead>
          <tbody>${g.map((p, i) => {
            const s = stockSku[p.cod];
            const hay = s !== undefined && s > 0;
            return `<tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'}">
              <td style="padding:.28rem .6rem;font-size:.6rem;font-family:'Roboto Mono',monospace;${SEP}">${esc(p.cod)}</td>
              <td style="padding:.28rem .6rem;font-size:.62rem;color:var(--mut);${SEP}"
                  title="${esc(p.prod)}">${esc(p.prod.length > 34 ? p.prod.slice(0, 33) + '…' : p.prod)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.62rem;${SEP}">${p.n}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.62rem;color:var(--mut);${SEP}">${nUn(p.cant)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.63rem;font-weight:600;
                         font-variant-numeric:tabular-nums;${SEP}">${nCLP(p.monto)}</td>
              <td style="padding:.28rem .6rem;text-align:right;font-size:.6rem;
                         color:${hay ? 'var(--gn)' : 'var(--rd)'};font-weight:700">
                ${s === undefined ? 'no está' : nUn(s)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.4">
        «Stock» es la existencia actual de ese SKU en bodega según la hoja Inventario Bodega.
        «no está» significa que el código no aparece en el inventario de repuestos.</p>`;
  }

  // Detalle con filtro por línea de negocio
  let _fLinea = 'todas';
  function stFiltro() {
    const box = document.getElementById('br-st-filtro');
    if (!box) return;
    const ls = ['todas'].concat((ST.por_linea || []).map(x => x.k));
    box.innerHTML = ls.map(k =>
      `<button onclick="window._brLinea(${JSON.stringify(k).replace(/"/g, '&quot;')})"
        style="font-size:.58rem;padding:.2rem .55rem;border-radius:3px;cursor:pointer;
        border:1px solid ${_fLinea === k ? 'var(--az1)' : 'var(--brd)'};
        background:${_fLinea === k ? 'var(--az1)' : 'var(--bg2)'};color:${_fLinea === k ? '#fff' : 'var(--txt)'};
        font-weight:${_fLinea === k ? '700' : '400'}">${k === 'todas' ? 'Todas las líneas' : esc(k)}</button>`).join('');
  }

  function stDetalle() {
    const box = document.getElementById('br-st-det');
    if (!box) return;
    const it = (ST.items || []).filter(r => _fLinea === 'todas' || r.linea === _fLinea);
    const tot = it.reduce((s, r) => s + r.monto, 0);
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
              TOTAL${_fLinea === 'todas' ? '' : ' · ' + esc(_fLinea)} · ${it.length} líneas</td>
            <td style="padding:.35rem .6rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums">${nCLP(tot)}</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  window._brLinea = function (k) { _fLinea = k; stFiltro(); stDetalle(); };

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

  window.initBrechas = function () {
    if (!OP.total && !ST.total && !CT.total) return;
    kpis(); barraComp();
    opProp(); tablaGrupo('br-op-cli', OP.por_cliente || [], OP.total, 'CLIENTE', { color: '#33448D' });
    opDetalle();
    stKPIs(); stAging(); stLinea(); stMes();
    tablaGrupo('br-st-cli', ST.por_cliente || [], ST.total, 'CLIENTE', { color: '#C00000' });
    stProductos(); stFiltro(); stDetalle();
  };
})();
