// ═══════════════════════════════════════════════════════════════
// hoja_rep_vend.js — Venta de Repuestos (dentro de Inventario TS)
// Réplica de la tabla dinámica "TD" (hoja Repuestos Vendidas):
// marca × mes, con alternancia monto / cantidad, gráficos y top clientes.
// Depende de: datos.js, utils.js, Chart.js
// ═══════════════════════════════════════════════════════════════
(function () {
  const RV = (window.APP_DATA || {}).rep_vend || {};
  let _modo = 'monto';               // 'monto' | 'cant'
  let _chMes = null, _chMarca = null;

  const nUn  = v => (v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const nCLP = v => '$' + Math.round(v || 0).toLocaleString('es-CL');
  const nMM  = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc   = (a, b) => b ? ((a / b) * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const esc  = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const COLORS = ['#002D73','#28D2C3','#FFC000','#33448D','#7A1FAA','#D46000',
                  '#00832F','#C00000','#4C9BE8','#E8B24C','#1AA8A0','#9B59B6'];

  const esMonto = () => _modo === 'monto';
  const val  = (arr, i) => (arr || [])[i] || 0;
  const fmtV = v => esMonto() ? nCLP(v) : nUn(v);
  const fmtC = v => esMonto() ? nMM(v)  : nUn(v);

  // ── KPIs ─────────────────────────────────────────────────────
  function renderKPIs() {
    const box = document.getElementById('rv-kpi');
    if (!box) return;
    const meses = RV.meses || [];
    const iUlt  = meses.length - 1;
    const ultM  = val(RV.tot_monto, iUlt);
    const prevM = iUlt > 0 ? val(RV.tot_monto, iUlt - 1) : 0;
    const varP  = prevM > 0 ? ((ultM - prevM) / prevM * 100) : null;
    const prom  = meses.length ? RV.tot_monto_g / meses.length : 0;

    const tile = (lbl, v, sub, kc) =>
      `<div class="kpi" style="--kc:${kc}">
         <div class="kpi-lbl">${lbl}</div>
         <div class="kpi-val" style="color:${kc}">${v}</div>
         <div class="kpi-sub">${sub}</div>
       </div>`;

    box.innerHTML =
      tile('Venta Total Repuestos', nMM(RV.tot_monto_g),
           `${nUn(RV.tot_cant_g)} unidades · ${meses.length} meses`, 'var(--az3)') +
      tile('Promedio Mensual', nMM(prom),
           `${meses[0] ? meses[0].lbl : ''} – ${meses[iUlt] ? meses[iUlt].lbl : ''}`, 'var(--az2)') +
      tile(`Último Mes · ${meses[iUlt] ? meses[iUlt].lbl : ''}`, nMM(ultM),
           varP === null ? '—'
             : `<span style="color:${varP >= 0 ? 'var(--gn)' : 'var(--rd)'};font-weight:700">${varP >= 0 ? '+' : ''}${varP.toFixed(1).replace('.', ',')}%</span> vs mes anterior`,
           'var(--teal)') +
      tile('Clientes', nUn(RV.n_clientes), `${(RV.marcas || []).length} marcas`, 'var(--am)');
  }

  // ── Selector monto / cantidad ────────────────────────────────
  function renderModo() {
    const box = document.getElementById('rv-modo');
    if (!box) return;
    const b = (k, t) =>
      `<button onclick="window._rvModo('${k}')" style="font-size:.6rem;padding:.22rem .7rem;border-radius:3px;
        border:1px solid ${_modo === k ? 'var(--az1)' : 'var(--brd)'};cursor:pointer;
        background:${_modo === k ? 'var(--az1)' : 'var(--bg2)'};color:${_modo === k ? '#fff' : 'var(--txt)'};
        font-weight:${_modo === k ? '700' : '400'}">${t}</button>`;
    box.innerHTML = b('monto', 'Monto ($)') + b('cant', 'Cantidad (un)');
  }

  // ── Gráfico: barras apiladas por mes ─────────────────────────
  function renderChartMes() {
    const ctx = document.getElementById('cRvMes');
    if (!ctx || !window.Chart) return;
    if (_chMes) { _chMes.destroy(); _chMes = null; }

    const meses  = RV.meses || [];
    const key    = esMonto() ? 'monto' : 'cant';
    const marcas = RV.marcas || [];
    const top    = marcas.slice(0, 6);
    const resto  = marcas.slice(6);

    const ds = top.map((m, i) => ({
      label: m.length > 22 ? m.slice(0, 21) + '…' : m,
      data: (RV.data[m] || {})[key] || [],
      backgroundColor: COLORS[i % COLORS.length],
      borderWidth: 0, stack: 's',
    }));
    if (resto.length) {
      ds.push({
        label: `Otras (${resto.length})`,
        data: meses.map((_, i) => resto.reduce((s, m) => s + val((RV.data[m] || {})[key], i), 0)),
        backgroundColor: '#B8C1D8', borderWidth: 0, stack: 's',
      });
    }

    const lbl = document.getElementById('rv-chart-lbl');
    if (lbl) lbl.textContent = esMonto() ? 'en millones de pesos' : 'en unidades';

    _chMes = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: meses.map(x => x.lbl), datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 7 } },
          tooltip: {
            callbacks: {
              label: c => ` ${c.dataset.label}: ${fmtV(c.raw)}`,
              footer: items => 'Total: ' + fmtV(items.reduce((s, i) => s + i.raw, 0)),
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 8 } } },
          y: {
            stacked: true, beginAtZero: true, grid: { color: '#E2E6F033' },
            ticks: { font: { size: 8 }, callback: v => esMonto() ? Math.round(v / 1e6) : nUn(v) },
            title: { display: true, text: esMonto() ? 'MM$' : 'unidades', font: { size: 8 }, color: '#6B7BA8' },
          },
        },
      },
    });
  }

  // ── Gráfico: distribución por marca ──────────────────────────
  function renderChartMarca() {
    const ctx = document.getElementById('cRvMarca');
    if (!ctx || !window.Chart) return;
    if (_chMarca) { _chMarca.destroy(); _chMarca = null; }

    const key    = esMonto() ? 'monto_tot' : 'cant_tot';
    const marcas = RV.marcas || [];
    const top    = marcas.slice(0, 7);
    const resto  = marcas.slice(7);
    const labels = top.map(m => m.length > 20 ? m.slice(0, 19) + '…' : m);
    const data   = top.map(m => (RV.data[m] || {})[key] || 0);
    if (resto.length) {
      labels.push(`Otras (${resto.length})`);
      data.push(resto.reduce((s, m) => s + ((RV.data[m] || {})[key] || 0), 0));
    }
    const tot = data.reduce((s, v) => s + v, 0);

    _chMarca = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: COLORS.slice(0, top.length).concat(['#B8C1D8']), borderWidth: 2, borderColor: 'var(--wh)' }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 6 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtV(c.raw)} (${pc(c.raw, tot)})` } },
        },
      },
    });
  }

  // ── Tabla marca × mes ────────────────────────────────────────
  function renderTable() {
    const box = document.getElementById('rv-table');
    if (!box) return;
    const meses  = RV.meses || [];
    const marcas = RV.marcas || [];
    if (!marcas.length) {
      box.innerHTML = '<p style="padding:1.4rem;color:var(--mut);font-style:italic">Sin datos de venta de repuestos.</p>';
      return;
    }
    const key    = esMonto() ? 'monto' : 'cant';
    const keyTot = esMonto() ? 'monto_tot' : 'cant_tot';
    const totG   = esMonto() ? RV.tot_monto_g : RV.tot_cant_g;
    const totArr = esMonto() ? RV.tot_monto   : RV.tot_cant;
    const SEP    = 'border-right:1px solid var(--brd)';

    const th = (t, al, extra) =>
      `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.4rem .55rem;
        font-size:.57rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
        border-right:1px solid rgba(255,255,255,.18);${extra || ''}">${t}</th>`;

    const rows = marcas.map((m, i) => {
      const d = RV.data[m] || {};
      const zebra = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';
      const celdas = meses.map((_, j) => {
        const v = val(d[key], j);
        return `<td style="padding:.3rem .55rem;text-align:right;font-size:.63rem;
          font-variant-numeric:tabular-nums;color:${v ? 'var(--txt)' : 'var(--mut)'};${SEP}">${v ? fmtV(v) : '—'}</td>`;
      }).join('');
      return `<tr style="background:${zebra}">
        <td style="padding:.3rem .55rem;font-size:.66rem;font-weight:600;white-space:nowrap;
                   position:sticky;left:0;background:${zebra};z-index:1;${SEP}" title="${esc(m)}">${esc(m)}</td>
        ${celdas}
        <td style="padding:.3rem .55rem;text-align:right;font-size:.66rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEP}">${fmtV(d[keyTot])}</td>
        <td style="padding:.3rem .55rem;text-align:right;font-size:.6rem;color:var(--mut)">${pc(d[keyTot], totG)}</td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:520px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1100px">
          <thead><tr>
            ${th('MARCA', 'left', 'position:sticky;left:0;z-index:3;min-width:180px')}
            ${meses.map(x => th(x.lbl.toUpperCase(), 'right')).join('')}
            ${th('TOTAL', 'right')}
            ${th('%', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.4rem .55rem;font-size:.66rem;position:sticky;left:0;background:var(--az3);z-index:1;${SEP}">TOTAL</td>
            ${meses.map((_, j) => `<td style="padding:.4rem .55rem;text-align:right;font-size:.63rem;
              font-variant-numeric:tabular-nums;${SEP}">${fmtV(val(totArr, j))}</td>`).join('')}
            <td style="padding:.4rem .55rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;${SEP}">${fmtV(totG)}</td>
            <td style="padding:.4rem .55rem;text-align:right;font-size:.6rem">100%</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.4">
        Fuente: hoja «Repuestos Vendidas», campo «Precio de venta» agrupado por «Marca 2» y mes.
        Incluye todos los estados de cotización (Aprobado, En borrador y Rechazado), igual que la tabla dinámica del Excel.
      </p>`;
  }

  // ── Tabla top 3 clientes por marca ───────────────────────────
  function renderClientes() {
    const box = document.getElementById('rv-cli-table');
    if (!box) return;
    const marcas = (RV.marcas || []).filter(m => (RV.data[m] || {}).monto_tot > 0);
    if (!marcas.length) { box.innerHTML = ''; return; }
    const SEP = 'border-right:1px solid var(--brd)';
    const th = (t, al) =>
      `<th style="background:var(--az1);color:#fff;padding:.4rem .6rem;font-size:.58rem;
        letter-spacing:.03em;text-align:${al};white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">${t}</th>`;

    const MED = ['#C9A227', '#9AA5B1', '#B06E3B'];   // oro, plata, bronce
    const rows = marcas.map((m, i) => {
      const d     = RV.data[m] || {};
      const zebra = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';
      const top   = d.top || [];
      const nf    = Math.max(top.length, 1);
      return top.map((t, k) => `
        <tr style="background:${zebra}">
          ${k === 0 ? `<td rowspan="${nf}" style="padding:.3rem .6rem;font-size:.66rem;font-weight:600;
              white-space:nowrap;vertical-align:top;${SEP}">${esc(m)}
              <div style="font-size:.55rem;color:var(--mut);font-weight:400;margin-top:.15rem">
                ${d.n_clientes} cliente${d.n_clientes === 1 ? '' : 's'}</div></td>` : ''}
          <td style="padding:.3rem .6rem;text-align:center;font-size:.62rem;font-weight:700;
                     color:${MED[k] || 'var(--mut)'};${SEP}">${k + 1}</td>
          <td style="padding:.3rem .6rem;font-size:.64rem;${SEP}" title="${esc(t.c)}">${esc(t.c)}</td>
          <td style="padding:.3rem .6rem;text-align:right;font-size:.64rem;font-weight:600;
                     font-variant-numeric:tabular-nums;${SEP}">${nCLP(t.monto)}</td>
          <td style="padding:.3rem .6rem;text-align:right;font-size:.62rem;color:var(--mut);${SEP}">${nUn(t.cant)}</td>
          <td style="padding:.3rem .6rem;text-align:right;font-size:.62rem;color:var(--mut)">${pc(t.monto, d.monto_tot)}</td>
        </tr>`).join('') + (d.resto_n > 0 ? `
        <tr style="background:${zebra}">
          <td style="padding:.22rem .6rem;font-size:.58rem;color:var(--mut);font-style:italic;${SEP}"></td>
          <td style="padding:.22rem .6rem;font-size:.58rem;color:var(--mut);font-style:italic;${SEP}">
            otros ${d.resto_n} cliente${d.resto_n === 1 ? '' : 's'}</td>
          <td style="padding:.22rem .6rem;text-align:right;font-size:.58rem;color:var(--mut);${SEP}">${nCLP(d.resto_monto)}</td>
          <td style="${SEP}"></td>
          <td style="padding:.22rem .6rem;text-align:right;font-size:.58rem;color:var(--mut)">${pc(d.resto_monto, d.monto_tot)}</td>
        </tr>` : '');
    }).join('');

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:560px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:760px">
          <thead><tr>
            ${th('MARCA', 'left')}${th('#', 'center')}${th('CLIENTE', 'left')}
            ${th('MONTO VENDIDO', 'right')}${th('UNIDADES', 'right')}${th('% DE LA MARCA', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  window._rvModo = function (k) {
    if (_modo === k) return;
    _modo = k;
    renderModo();
    renderTable();
    renderChartMes();
    renderChartMarca();
  };

  window.initRepVend = function () {
    if (!(RV.marcas || []).length) return;
    const meses = RV.meses || [];
    const p = document.getElementById('rv-periodo');
    if (p && meses.length) p.textContent = `${meses[0].lbl} – ${meses[meses.length - 1].lbl}`;
    renderKPIs();
    renderModo();
    renderTable();
    renderClientes();
    renderChartMes();
    renderChartMarca();
  };
})();
