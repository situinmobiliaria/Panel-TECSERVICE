// ═══════════════════════════════════════════════════════════════
// hoja_rep_vend.js — Venta de Repuestos (dentro de Inventario TS)
// Réplica de la tabla dinámica "TD" (hoja Repuestos Vendidas):
// marca × mes, con segmentador de año, alternancia monto / cantidad,
// gráficos y top clientes.
// Depende de: datos.js, utils.js, Chart.js
// ═══════════════════════════════════════════════════════════════
(function () {
  const RV = (window.APP_DATA || {}).rep_vend || {};
  let _modo = 'monto';               // 'monto' | 'cant'
  let _anio = 'todos';               // 'todos' | '2025' | '2026'
  let _cli  = null;                  // cliente seleccionado en el gráfico
  let _chMes = null, _chMarca = null, _chCli = null;

  const nUn  = v => (v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const nCLP = v => '$' + Math.round(v || 0).toLocaleString('es-CL');
  const nMM  = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc   = (a, b) => b ? ((a / b) * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const esc  = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const COLORS = ['#002D73','#28D2C3','#FFC000','#33448D','#7A1FAA','#D46000',
                  '#00832F','#C00000','#4C9BE8','#E8B24C','#1AA8A0','#9B59B6'];

  const esMonto = () => _modo === 'monto';
  const fmtV = v => esMonto() ? nCLP(v) : nUn(v);

  // ── Filtro de año: índices de RV.meses que entran ────────────
  function idxs() {
    const ms = RV.meses || [];
    return ms.map((x, i) => (_anio === 'todos' || x.a === _anio) ? i : -1).filter(i => i >= 0);
  }
  function mesesSel() { const I = idxs(); return I.map(i => RV.meses[i]); }

  // Suma de un array mensual sobre los meses seleccionados
  function sumaSel(arr) {
    if (!arr) return 0;
    return idxs().reduce((s, i) => s + (arr[i] || 0), 0);
  }
  // Total de una marca según año y modo
  function totMarca(m) {
    const d = RV.data[m] || {};
    return sumaSel(esMonto() ? d.monto : d.cant);
  }
  // Total general según año y modo
  function totGeneral() {
    return sumaSel(esMonto() ? RV.tot_monto : RV.tot_cant);
  }
  // Etiqueta del período activo
  function lblPeriodo() {
    const ms = mesesSel();
    if (!ms.length) return '—';
    if (_anio === 'todos') return `${ms[0].lbl} – ${ms[ms.length - 1].lbl}`;
    return `${ms[0].lbl} – ${ms[ms.length - 1].lbl} · año ${_anio}`;
  }
  function lblAnio() {
    return _anio === 'todos' ? 'ambos años (2025 y 2026)' : `año ${_anio}`;
  }
  // Clientes de una marca agregados según el año activo
  function cliMarca(m) {
    const d = RV.data[m] || {};
    const anios = _anio === 'todos' ? (RV.anios || []) : [_anio];
    return (d.clientes || []).map(r => {
      let mo = 0, q = 0;
      anios.forEach(a => { mo += r['m' + a.slice(2)] || 0; q += r['q' + a.slice(2)] || 0; });
      return { c: r.c, monto: mo, cant: q };
    }).filter(r => r.monto > 0 || r.cant > 0)
      .sort((a, b) => b.monto - a.monto);
  }

  // ── Segmentadores ────────────────────────────────────────────
  function seg(id, opts, activo, fn) {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = opts.map(([k, t]) =>
      `<button onclick="window.${fn}('${k}')" style="font-size:.6rem;padding:.22rem .7rem;border-radius:3px;
        border:1px solid ${activo === k ? 'var(--az1)' : 'var(--brd)'};cursor:pointer;
        background:${activo === k ? 'var(--az1)' : 'var(--bg2)'};color:${activo === k ? '#fff' : 'var(--txt)'};
        font-weight:${activo === k ? '700' : '400'}">${t}</button>`).join('');
  }
  function renderSegs() {
    const anios = RV.anios || [];
    seg('rv-anio', [['todos', 'Ambos años']].concat(anios.map(a => [a, a])), _anio, '_rvAnio');
    seg('rv-modo', [['monto', 'Monto ($)'], ['cant', 'Cantidad (un)']], _modo, '_rvModo');
  }

  // ── KPIs ─────────────────────────────────────────────────────
  function renderKPIs() {
    const box = document.getElementById('rv-kpi');
    if (!box) return;
    const ms   = mesesSel();
    const I    = idxs();
    const totM = sumaSel(RV.tot_monto);
    const totQ = sumaSel(RV.tot_cant);
    const iUlt = I[I.length - 1];
    const ultM = iUlt !== undefined ? (RV.tot_monto[iUlt] || 0) : 0;
    const iPrev = I[I.length - 2];
    const prevM = iPrev !== undefined ? (RV.tot_monto[iPrev] || 0) : 0;
    const varP  = prevM > 0 ? ((ultM - prevM) / prevM * 100) : null;
    const prom  = ms.length ? totM / ms.length : 0;
    const nCli  = new Set((RV.marcas || []).flatMap(m => cliMarca(m).map(r => r.c))).size;
    const nMar  = (RV.marcas || []).filter(m => totMarca(m) > 0).length;

    // El pie de cada indicador deja explícito de qué período son las cifras.
    const pie = t => `<div style="font-size:.55rem;color:var(--az2);font-weight:700;margin-top:.2rem">${t}</div>`;
    const tile = (lbl, v, sub, kc) =>
      `<div class="kpi" style="--kc:${kc}">
         <div class="kpi-lbl">${lbl}</div>
         <div class="kpi-val" style="color:${kc}">${v}</div>
         <div class="kpi-sub">${sub}${pie(lblAnio())}</div>
       </div>`;

    box.innerHTML =
      tile('Venta Total Repuestos', nMM(totM),
           `${nUn(totQ)} unidades · ${ms.length} mes${ms.length === 1 ? '' : 'es'}`, 'var(--az3)') +
      tile('Promedio Mensual', nMM(prom),
           ms.length ? `${ms[0].lbl} – ${ms[ms.length - 1].lbl}` : '—', 'var(--az2)') +
      tile(`Último Mes · ${ms.length ? ms[ms.length - 1].lbl : ''}`, nMM(ultM),
           varP === null ? 'sin mes previo en el período'
             : `<span style="color:${varP >= 0 ? 'var(--gn)' : 'var(--rd)'};font-weight:700">${varP >= 0 ? '+' : ''}${varP.toFixed(1).replace('.', ',')}%</span> vs mes anterior`,
           'var(--teal)') +
      tile('Clientes', nUn(nCli), `${nMar} marcas con venta`, 'var(--am)');
  }

  // ── Plugin inline: % sobre los arcos del donut ───────────────
  // No hay chartjs-plugin-datalabels cargado; esto evita sumar otro CDN.
  const pctEnArcos = {
    id: 'pctEnArcos',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const data = chart.data.datasets[0].data;
      const tot  = data.reduce((s, v) => s + (v || 0), 0);
      if (!tot) return;
      ctx.save();
      ctx.font = '700 10px Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      meta.data.forEach((arc, i) => {
        const p = (data[i] || 0) / tot * 100;
        if (p < 4) return;                       // muy angosto: no cabe
        const { x, y } = arc.tooltipPosition();
        const txt = p.toFixed(1).replace('.', ',') + '%';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(0,0,0,.45)';
        ctx.strokeText(txt, x, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(txt, x, y);
      });
      ctx.restore();
    },
  };

  // ── Gráfico: barras apiladas por mes ─────────────────────────
  function renderChartMes() {
    const ctx = document.getElementById('cRvMes');
    if (!ctx || !window.Chart) return;
    if (_chMes) { _chMes.destroy(); _chMes = null; }

    const I      = idxs();
    const ms     = mesesSel();
    const key    = esMonto() ? 'monto' : 'cant';
    const marcas = (RV.marcas || []).slice().sort((a, b) => totMarca(b) - totMarca(a))
                     .filter(m => totMarca(m) > 0);
    const top    = marcas.slice(0, 6);
    const resto  = marcas.slice(6);

    const ds = top.map((m, i) => ({
      label: m.length > 22 ? m.slice(0, 21) + '…' : m,
      data: I.map(j => ((RV.data[m] || {})[key] || [])[j] || 0),
      backgroundColor: COLORS[i % COLORS.length],
      borderWidth: 0, stack: 's',
    }));
    if (resto.length) {
      ds.push({
        label: `Otras (${resto.length})`,
        data: I.map(j => resto.reduce((s, m) => s + (((RV.data[m] || {})[key] || [])[j] || 0), 0)),
        backgroundColor: '#B8C1D8', borderWidth: 0, stack: 's',
      });
    }

    const lbl = document.getElementById('rv-chart-lbl');
    if (lbl) lbl.textContent = (esMonto() ? 'en millones de pesos' : 'en unidades') + ' · ' + lblAnio();

    _chMes = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: ms.map(x => x.lbl), datasets: ds },
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

    const marcas = (RV.marcas || []).slice().sort((a, b) => totMarca(b) - totMarca(a))
                     .filter(m => totMarca(m) > 0);
    const top    = marcas.slice(0, 7);
    const resto  = marcas.slice(7);
    const labels = top.map(m => m.length > 20 ? m.slice(0, 19) + '…' : m);
    const data   = top.map(m => totMarca(m));
    if (resto.length) {
      labels.push(`Otras (${resto.length})`);
      data.push(resto.reduce((s, m) => s + totMarca(m), 0));
    }
    const tot = data.reduce((s, v) => s + v, 0);

    _chMarca = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: COLORS.slice(0, top.length).concat(['#B8C1D8']), borderWidth: 2, borderColor: 'var(--wh)' }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '52%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 6 } },
          tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtV(c.raw)} (${pc(c.raw, tot)})` } },
        },
      },
      plugins: [pctEnArcos],
    });
  }

  // ── Tabla marca × mes ────────────────────────────────────────
  function renderTable() {
    const box = document.getElementById('rv-table');
    if (!box) return;
    const I  = idxs();
    const ms = mesesSel();
    const marcas = (RV.marcas || []).slice().sort((a, b) => totMarca(b) - totMarca(a))
                     .filter(m => totMarca(m) > 0);
    if (!marcas.length) {
      box.innerHTML = '<p style="padding:1.4rem;color:var(--mut);font-style:italic">Sin datos para el período seleccionado.</p>';
      return;
    }
    const key  = esMonto() ? 'monto' : 'cant';
    const totG = totGeneral();
    const arrT = esMonto() ? RV.tot_monto : RV.tot_cant;
    const SEP  = 'border-right:1px solid var(--brd)';

    const th = (t, al, extra) =>
      `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.4rem .55rem;
        font-size:.57rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
        border-right:1px solid rgba(255,255,255,.18);${extra || ''}">${t}</th>`;

    const rows = marcas.map((m, i) => {
      const d = RV.data[m] || {};
      const z = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';
      const celdas = I.map(j => {
        const v = (d[key] || [])[j] || 0;
        return `<td style="padding:.3rem .55rem;text-align:right;font-size:.63rem;
          font-variant-numeric:tabular-nums;color:${v ? 'var(--txt)' : 'var(--mut)'};${SEP}">${v ? fmtV(v) : '—'}</td>`;
      }).join('');
      const tm = totMarca(m);
      return `<tr style="background:${z}">
        <td style="padding:.3rem .55rem;font-size:.66rem;font-weight:600;white-space:nowrap;
                   position:sticky;left:0;background:${z};z-index:1;${SEP}" title="${esc(m)}">${esc(m)}</td>
        ${celdas}
        <td style="padding:.3rem .55rem;text-align:right;font-size:.66rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEP}">${fmtV(tm)}</td>
        <td style="padding:.3rem .55rem;text-align:right;font-size:.6rem;color:var(--mut)">${pc(tm, totG)}</td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:520px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:${260 + ms.length * 62}px">
          <thead><tr>
            ${th('MARCA', 'left', 'position:sticky;left:0;z-index:3;min-width:180px')}
            ${ms.map(x => th(x.lbl.toUpperCase(), 'right')).join('')}
            ${th('TOTAL', 'right')}
            ${th('%', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.4rem .55rem;font-size:.66rem;position:sticky;left:0;background:var(--az3);z-index:1;${SEP}">TOTAL</td>
            ${I.map(j => `<td style="padding:.4rem .55rem;text-align:right;font-size:.63rem;
              font-variant-numeric:tabular-nums;${SEP}">${fmtV((arrT || [])[j] || 0)}</td>`).join('')}
            <td style="padding:.4rem .55rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;${SEP}">${fmtV(totG)}</td>
            <td style="padding:.4rem .55rem;text-align:right;font-size:.6rem">100%</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.4">
        Período: <strong>${lblPeriodo()}</strong>. Fuente: hoja «Repuestos Vendidas», campo «Precio de venta»
        agrupado por «Marca 2» y mes. Incluye todos los estados de cotización (Aprobado, En borrador y
        Rechazado), igual que la tabla dinámica del Excel.
      </p>`;
  }

  // ── Tabla top 3 clientes por marca ───────────────────────────
  function renderClientes() {
    const box = document.getElementById('rv-cli-table');
    if (!box) return;
    const marcas = (RV.marcas || []).slice().sort((a, b) => totMarca(b) - totMarca(a))
                     .filter(m => totMarca(m) > 0);
    if (!marcas.length) { box.innerHTML = ''; return; }
    const SEP = 'border-right:1px solid var(--brd)';
    const th = (t, al) =>
      `<th style="background:var(--az1);color:#fff;padding:.4rem .6rem;font-size:.58rem;
        letter-spacing:.03em;text-align:${al};white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">${t}</th>`;
    const MED = ['#C9A227', '#9AA5B1', '#B06E3B'];   // oro, plata, bronce

    const rows = marcas.map((m, i) => {
      const cl  = cliMarca(m);
      if (!cl.length) return '';
      const z   = i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)';
      const top = cl.slice(0, 3);
      const res = cl.slice(3);
      const tm  = cl.reduce((s, r) => s + r.monto, 0);
      return top.map((t, k) => `
        <tr style="background:${z}">
          ${k === 0 ? `<td rowspan="${top.length}" style="padding:.3rem .6rem;font-size:.66rem;font-weight:600;
              white-space:nowrap;vertical-align:top;${SEP}">${esc(m)}
              <div style="font-size:.55rem;color:var(--mut);font-weight:400;margin-top:.15rem">
                ${cl.length} cliente${cl.length === 1 ? '' : 's'}</div></td>` : ''}
          <td style="padding:.3rem .6rem;text-align:center;font-size:.62rem;font-weight:700;
                     color:${MED[k] || 'var(--mut)'};${SEP}">${k + 1}</td>
          <td style="padding:.3rem .6rem;font-size:.64rem;${SEP}" title="${esc(t.c)}">${esc(t.c)}</td>
          <td style="padding:.3rem .6rem;text-align:right;font-size:.64rem;font-weight:600;
                     font-variant-numeric:tabular-nums;${SEP}">${nCLP(t.monto)}</td>
          <td style="padding:.3rem .6rem;text-align:right;font-size:.62rem;color:var(--mut);${SEP}">${nUn(t.cant)}</td>
          <td style="padding:.3rem .6rem;text-align:right;font-size:.62rem;color:var(--mut)">${pc(t.monto, tm)}</td>
        </tr>`).join('') + (res.length ? `
        <tr style="background:${z}">
          <td style="${SEP}"></td>
          <td style="padding:.22rem .6rem;font-size:.58rem;color:var(--mut);font-style:italic;${SEP}">
            otros ${res.length} cliente${res.length === 1 ? '' : 's'}</td>
          <td style="padding:.22rem .6rem;text-align:right;font-size:.58rem;color:var(--mut);${SEP}">${nCLP(res.reduce((s, r) => s + r.monto, 0))}</td>
          <td style="padding:.22rem .6rem;text-align:right;font-size:.58rem;color:var(--mut);${SEP}">${nUn(res.reduce((s, r) => s + r.cant, 0))}</td>
          <td style="padding:.22rem .6rem;text-align:right;font-size:.58rem;color:var(--mut)">${pc(res.reduce((s, r) => s + r.monto, 0), tm)}</td>
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
      </div>
      <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0">Período: <strong>${lblPeriodo()}</strong>.</p>`;
  }

  // ── Evolución mensual de un cliente ──────────────────────────
  // Total de un cliente en el período activo
  function totCli(c) {
    const d = (RV.cli_serie || {})[c];
    if (!d) return 0;
    return sumaSel(esMonto() ? d.monto : d.cant);
  }
  // Clientes con venta en el período, de mayor a menor
  function clientesOrdenados() {
    return Object.keys(RV.cli_serie || {})
      .filter(c => sumaSel((RV.cli_serie[c] || {}).monto) > 0)
      .sort((a, b) => sumaSel(RV.cli_serie[b].monto) - sumaSel(RV.cli_serie[a].monto));
  }

  function renderCliSelect() {
    const sel = document.getElementById('rv-cli-sel');
    if (!sel) return;
    const cl = clientesOrdenados();
    if (!cl.length) { sel.innerHTML = ''; _cli = null; return; }
    // Si el cliente elegido no vendió en el período, cae al primero
    if (!_cli || cl.indexOf(_cli) === -1) _cli = cl[0];
    sel.innerHTML = cl.map((c, i) =>
      `<option value="${esc(c)}"${c === _cli ? ' selected' : ''}>${i + 1}. ${esc(c)} — ${nMM(sumaSel(RV.cli_serie[c].monto))}</option>`
    ).join('');
    const lbl = document.getElementById('rv-cli-lbl');
    if (lbl) lbl.textContent = `${cl.length} clientes con venta · ${lblAnio()}`;
  }

  function renderCliKPI() {
    const box = document.getElementById('rv-cli-kpi');
    if (!box) return;
    const d = (RV.cli_serie || {})[_cli];
    if (!d) { box.innerHTML = ''; return; }
    const I    = idxs();
    const mo   = sumaSel(d.monto);
    const qt   = sumaSel(d.cant);
    const act  = I.filter(i => (d.monto[i] || 0) > 0).length;
    const totG = sumaSel(RV.tot_monto);
    const mejor = I.reduce((b, i) => (d.monto[i] || 0) > (d.monto[b] || 0) ? i : b, I[0]);

    const chip = (lbl, v) =>
      `<div style="background:var(--bg2);border-left:3px solid var(--az2);border-radius:5px;padding:.35rem .7rem">
         <div style="font-size:.53rem;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)">${lbl}</div>
         <div style="font-size:.8rem;font-weight:800;color:var(--az1);font-variant-numeric:tabular-nums">${v}</div>
       </div>`;
    box.innerHTML =
      chip('Vendido', nMM(mo)) +
      chip('Unidades', nUn(qt)) +
      chip('% del total', pc(mo, totG)) +
      chip('Meses con venta', `${act} de ${I.length}`) +
      chip('Mejor mes', mejor !== undefined ? `${RV.meses[mejor].lbl} · ${nMM(d.monto[mejor] || 0)}` : '—') +
      chip('Marcas', `${d.n_marcas} · ${(d.marcas[0] || ['—'])[0]}`);
  }

  function renderChartCli() {
    const ctx = document.getElementById('cRvCli');
    if (!ctx || !window.Chart) return;
    if (_chCli) { _chCli.destroy(); _chCli = null; }
    const d = (RV.cli_serie || {})[_cli];
    if (!d) return;
    const I   = idxs();
    const ms  = mesesSel();
    const key = esMonto() ? 'monto' : 'cant';
    const serie = I.map(i => (d[key] || [])[i] || 0);
    // Promedio del período como línea de referencia
    const prom = serie.length ? serie.reduce((s, v) => s + v, 0) / serie.length : 0;

    _chCli = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ms.map(x => x.lbl),
        datasets: [
          { label: _cli.length > 40 ? _cli.slice(0, 39) + '…' : _cli,
            data: serie, backgroundColor: '#002D73CC', borderColor: '#002D73',
            borderWidth: 1, borderRadius: 3, order: 2 },
          { label: 'Promedio del período', data: ms.map(() => prom), type: 'line',
            borderColor: '#FFC000', borderWidth: 2, borderDash: [5, 4],
            pointRadius: 0, fill: false, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtV(c.raw)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 8 } } },
          y: { beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => esMonto() ? Math.round(v / 1e6) : nUn(v) },
               title: { display: true, text: esMonto() ? 'MM$' : 'unidades', font: { size: 8 }, color: '#6B7BA8' } },
        },
      },
    });
  }

  function repintar() {
    renderSegs(); renderKPIs(); renderTable();
    renderClientes(); renderChartMes(); renderChartMarca();
    renderCliSelect(); renderCliKPI(); renderChartCli();
    const p = document.getElementById('rv-periodo');
    if (p) p.textContent = lblPeriodo();
  }

  window._rvModo = function (k) { if (_modo !== k) { _modo = k; repintar(); } };
  window._rvAnio = function (k) { if (_anio !== k) { _anio = k; repintar(); } };
  window._rvCli  = function (c) { _cli = c; renderCliKPI(); renderChartCli(); };

  window.initRepVend = function () {
    if (!(RV.marcas || []).length) return;
    repintar();
  };
})();
