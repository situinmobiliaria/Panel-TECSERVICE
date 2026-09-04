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
  let _fam  = 'todas';               // familia de producto (Equipo Asociado)
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
  // Serie mensual de una marca según la familia activa
  function serieMarca(m) {
    const d = RV.data[m] || {};
    const k = esMonto() ? 'monto' : 'cant';
    if (_fam === 'todas') return d[k] || [];
    const f = (d.fam || {})[_fam];
    return f ? f[esMonto() ? 'm' : 'q'] : [];
  }
  // Total de una marca según año, modo y familia
  function totMarca(m) { return sumaSel(serieMarca(m)); }

  // Serie mensual general según la familia activa
  function serieTotal() {
    const k = esMonto() ? 'monto' : 'cant';
    if (_fam === 'todas') return (esMonto() ? RV.tot_monto : RV.tot_cant) || [];
    const f = (RV.fam || {})[_fam];
    return f ? f[k] : [];
  }
  function totGeneral() { return sumaSel(serieTotal()); }

  function lblFam() { return _fam === 'todas' ? 'todas las familias' : _fam; }
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
    // Con familia filtrada no hay apertura cliente×marca×familia: se usa el
    // desglose por familia del cliente, que sí existe.
    if (_fam !== 'todas') {
      const I = idxs();
      return (d.clientes || []).map(r => {
        const cs = (RV.cli_serie || {})[r.c] || {};
        const f  = (cs.fam || {})[_fam];
        if (!f) return null;
        // Prorratea la familia del cliente por el peso de esta marca en él
        const totCli = I.reduce((s2, i) => s2 + ((cs.monto || [])[i] || 0), 0);
        const enMarca = I.reduce((s2, i) => s2 + (((cs.det || {})[m] || {}).m || [])[i] || 0, 0);
        if (!totCli || !enMarca) return null;
        const w = enMarca / totCli;
        const mo = I.reduce((s2, i) => s2 + (f.m[i] || 0), 0) * w;
        const q  = I.reduce((s2, i) => s2 + (f.q[i] || 0), 0) * w;
        return mo > 0 ? { c: r.c, monto: Math.round(mo), cant: Math.round(q) } : null;
      }).filter(Boolean).sort((a, b) => b.monto - a.monto);
    }
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
    seg('rv-fam', [['todas', 'Todas']].concat((RV.familias || []).map(f => [f, f])), _fam, '_rvFam');
  }

  // ── KPIs ─────────────────────────────────────────────────────
  function renderKPIs() {
    const box = document.getElementById('rv-kpi');
    if (!box) return;
    const ms   = mesesSel();
    const I    = idxs();
    const sMonto = _fam === 'todas' ? (RV.tot_monto || [])
                 : (((RV.fam || {})[_fam] || {}).monto || []);
    const sCant  = _fam === 'todas' ? (RV.tot_cant || [])
                 : (((RV.fam || {})[_fam] || {}).cant || []);
    const totM = sumaSel(sMonto);
    const totQ = sumaSel(sCant);
    const iUlt = I[I.length - 1];
    const ultM = iUlt !== undefined ? (sMonto[iUlt] || 0) : 0;
    const iPrev = I[I.length - 2];
    const prevM = iPrev !== undefined ? (sMonto[iPrev] || 0) : 0;
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
         <div class="kpi-sub">${sub}${pie(lblAnio() + (_fam === 'todas' ? '' : ' · ' + _fam))}</div>
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
      data: I.map(j => (serieMarca(m)[j] || 0)),
      backgroundColor: COLORS[i % COLORS.length],
      borderWidth: 0, stack: 's',
    }));
    if (resto.length) {
      ds.push({
        label: `Otras (${resto.length})`,
        data: I.map(j => resto.reduce((s, m) => s + (serieMarca(m)[j] || 0), 0)),
        backgroundColor: '#B8C1D8', borderWidth: 0, stack: 's',
      });
    }

    const lbl = document.getElementById('rv-chart-lbl');
    if (lbl) lbl.textContent = (esMonto() ? 'en millones de pesos' : 'en unidades') +
      ' · ' + lblAnio() + (_fam === 'todas' ? '' : ' · ' + _fam);

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

  // ── Tabla resumen por familia de producto ────────────────────
  // Familia como fila principal, expandible a sus marcas. Los meses van en
  // columnas, igual que la tabla de marcas.
  const _famOpen = new Set();
  window._rvFamToggle = function (f) {
    if (_famOpen.has(f)) _famOpen.delete(f); else _famOpen.add(f);
    renderTablaFam();
  };

  function renderTablaFam() {
    const box = document.getElementById('rv-fam-table');
    if (!box) return;
    const I  = idxs();
    const ms = mesesSel();
    const fams = (RV.familias || []).filter(f => _fam === 'todas' || f === _fam);
    if (!fams.length) { box.innerHTML = ''; return; }

    const kM = esMonto() ? 'monto' : 'cant';
    const kD = esMonto() ? 'm' : 'q';
    const serieFam = f => ((RV.fam || {})[f] || {})[kM] || [];
    const gTot = fams.reduce((s, f) => s + sumaSel(serieFam(f)), 0);

    const th = (t, al, extra) =>
      `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.4rem .55rem;
        font-size:.57rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
        border-right:1px solid rgba(255,255,255,.18);${extra || ''}">${t}</th>`;
    const SEPc = 'border-right:1px solid var(--brd)';

    let rows = '';
    fams.forEach((f, i) => {
      const sf   = serieFam(f);
      const tf   = sumaSel(sf);
      const open = _famOpen.has(f);
      const col  = COLORS[i % COLORS.length];
      rows += `<tr style="background:var(--bg2);cursor:pointer;border-left:3px solid ${col}"
          onclick="window._rvFamToggle(${JSON.stringify(f).replace(/"/g, '&quot;')})">
        <td style="padding:.35rem .55rem;font-size:.68rem;font-weight:700;white-space:nowrap;
                   position:sticky;left:0;background:var(--bg2);z-index:1;${SEPc}">
          <span style="display:inline-block;width:.8rem;font-size:.52rem;color:var(--mut);
            transform:rotate(${open ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(f)}
        </td>
        ${I.map(j => `<td style="padding:.35rem .55rem;text-align:right;font-size:.63rem;
          font-variant-numeric:tabular-nums;${SEPc}">${(sf[j] || 0) ? fmtV(sf[j]) : '—'}</td>`).join('')}
        <td style="padding:.35rem .55rem;text-align:right;font-size:.67rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEPc}">${fmtV(tf)}</td>
        <td style="padding:.35rem .55rem;text-align:right;font-size:.6rem;color:var(--mut)">${pc(tf, gTot)}</td>
      </tr>`;

      if (open) {
        // Marcas dentro de la familia, con su serie mensual
        const marcas = (RV.marcas || [])
          .map(m => ({ m, s: ((RV.data[m] || {}).fam || {})[f] }))
          .filter(x => x.s && I.some(j => (x.s[kD][j] || 0) > 0))
          .sort((a, b) => sumaSel(b.s[kD]) - sumaSel(a.s[kD]));
        marcas.forEach(({ m, s: sm }) => {
          const tm = sumaSel(sm[kD]);
          rows += `<tr style="background:var(--bg)">
            <td style="padding:.25rem .55rem .25rem 1.9rem;font-size:.63rem;color:var(--mut);
                       white-space:nowrap;position:sticky;left:0;background:var(--bg);z-index:1;${SEPc}">${esc(m)}</td>
            ${I.map(j => `<td style="padding:.25rem .55rem;text-align:right;font-size:.61rem;
              font-variant-numeric:tabular-nums;color:var(--mut);${SEPc}">${(sm[kD][j] || 0) ? fmtV(sm[kD][j]) : '—'}</td>`).join('')}
            <td style="padding:.25rem .55rem;text-align:right;font-size:.63rem;
                       font-variant-numeric:tabular-nums;${SEPc}">${fmtV(tm)}</td>
            <td style="padding:.25rem .55rem;text-align:right;font-size:.58rem;color:var(--mut)">${pc(tm, tf)}</td>
          </tr>`;
        });
      }
    });

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:440px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:${240 + ms.length * 62}px">
          <thead><tr>
            ${th('FAMILIA / MARCA', 'left', 'position:sticky;left:0;z-index:3;min-width:170px')}
            ${ms.map(x => th(x.lbl.toUpperCase(), 'right')).join('')}
            ${th('TOTAL', 'right')}${th('%', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.4rem .55rem;font-size:.66rem;position:sticky;left:0;background:var(--az3);z-index:1;${SEPc}">TOTAL</td>
            ${I.map(j => `<td style="padding:.4rem .55rem;text-align:right;font-size:.62rem;
              font-variant-numeric:tabular-nums;${SEPc}">${fmtV(fams.reduce((s, f) => s + (serieFam(f)[j] || 0), 0))}</td>`).join('')}
            <td style="padding:.4rem .55rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;${SEPc}">${fmtV(gTot)}</td>
            <td style="padding:.4rem .55rem;text-align:right;font-size:.6rem">100%</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.4">
        Familia de producto = campo «Equipo Asociado» de la hoja «Repuestos Vendidas».</p>`;
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
      const sm = serieMarca(m);
      const celdas = I.map(j => {
        const v = sm[j] || 0;
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
              font-variant-numeric:tabular-nums;${SEP}">${fmtV(serieTotal()[j] || 0)}</td>`).join('')}
            <td style="padding:.4rem .55rem;text-align:right;font-size:.66rem;font-variant-numeric:tabular-nums;${SEP}">${fmtV(totG)}</td>
            <td style="padding:.4rem .55rem;text-align:right;font-size:.6rem">100%</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.4">
        Período: <strong>${lblPeriodo()}</strong> · Familia: <strong>${esc(lblFam())}</strong>.
        Fuente: hoja «Repuestos Vendidas», campo «Precio de venta»
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
  function serieCli(c) {
    const d = (RV.cli_serie || {})[c];
    if (!d) return [];
    if (_fam === 'todas') return (esMonto() ? d.monto : d.cant) || [];
    const f = (d.fam || {})[_fam];
    return f ? f[esMonto() ? 'm' : 'q'] : [];
  }
  function totCli(c) { return sumaSel(serieCli(c)); }
  // Clientes con venta en el período, de mayor a menor
  function clientesOrdenados() {
    const mo = c => { const d = RV.cli_serie[c] || {};
      if (_fam === 'todas') return sumaSel(d.monto);
      const f = (d.fam || {})[_fam]; return f ? sumaSel(f.m) : 0; };
    return Object.keys(RV.cli_serie || {}).filter(c => mo(c) > 0)
      .sort((a, b) => mo(b) - mo(a));
  }

  function renderCliSelect() {
    const dl  = document.getElementById('rv-cli-dl');
    const inp = document.getElementById('rv-cli-inp');
    if (!dl || !inp) return;
    const cl = clientesOrdenados();
    if (!cl.length) { dl.innerHTML = ''; inp.value = ''; _cli = null; return; }
    // Si el cliente elegido no vendió en el período, cae al primero
    if (!_cli || cl.indexOf(_cli) === -1) _cli = cl[0];
    // El value es el nombre exacto (lo que se escribe); el label agrega el
    // ranking y el monto para poder elegir sin saber el nombre completo.
    dl.innerHTML = cl.map((c, i) =>
      `<option value="${esc(c)}" label="${i + 1}º · ${nMM(sumaSel(RV.cli_serie[c].monto))}"></option>`
    ).join('');
    inp.value = _cli;
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
    const dk  = esMonto() ? 'm' : 'q';

    // Una serie apilada por marca: al pasar el mouse el tooltip muestra el
    // aporte de cada marca y el total del mes en el pie.
    const det = d.det || {};
    const marcasCli = Object.keys(det)
      .filter(m => I.some(i => ((det[m] || {})[dk] || [])[i] > 0))
      .sort((a, b) => I.reduce((s, i) => s + (det[b][dk][i] || 0), 0)
                    - I.reduce((s, i) => s + (det[a][dk][i] || 0), 0));

    const ds = marcasCli.map((m, k) => ({
      label: m.length > 24 ? m.slice(0, 23) + '…' : m,
      data: I.map(i => (det[m][dk] || [])[i] || 0),
      backgroundColor: COLORS[k % COLORS.length],
      borderWidth: 0, stack: 'c', order: 2,
    }));

    const sc    = serieCli(_cli);
    const serie = I.map(i => sc[i] || 0);
    const prom  = serie.length ? serie.reduce((s, v) => s + v, 0) / serie.length : 0;
    ds.push({
      label: 'Promedio del período', data: ms.map(() => prom), type: 'line',
      borderColor: '#FFC000', borderWidth: 2, borderDash: [5, 4],
      pointRadius: 0, fill: false, order: 1,
    });

    _chCli = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: ms.map(x => x.lbl), datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 7 } },
          tooltip: {
            callbacks: {
              // Sólo las marcas con venta ese mes, para no llenar de ceros
              label: c => c.dataset.type === 'line'
                ? ` ${c.dataset.label}: ${fmtV(c.raw)}`
                : (c.raw > 0 ? ` ${c.dataset.label}: ${fmtV(c.raw)}` : null),
              footer: items => {
                const t = items.filter(i => i.dataset.type !== 'line')
                               .reduce((s, i) => s + i.raw, 0);
                return 'TOTAL DEL MES: ' + fmtV(t);
              },
            },
            footerFont: { weight: '700', size: 11 },
            footerColor: '#FFD966',
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 8 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => esMonto() ? Math.round(v / 1e6) : nUn(v) },
               title: { display: true, text: esMonto() ? 'MM$' : 'unidades', font: { size: 8 }, color: '#6B7BA8' } },
        },
      },
    });
  }

  function repintar() {
    renderSegs(); renderKPIs(); renderTablaFam(); renderTable();
    renderClientes(); renderChartMes(); renderChartMarca();
    renderCliSelect(); renderCliKPI(); renderChartCli();
    const p = document.getElementById('rv-periodo');
    if (p) p.textContent = lblPeriodo();
  }

  window._rvModo = function (k) { if (_modo !== k) { _modo = k; repintar(); } };
  window._rvAnio = function (k) { if (_anio !== k) { _anio = k; repintar(); } };
  window._rvFam  = function (k) { if (_fam  !== k) { _fam  = k; repintar(); } };
  window._rvCli  = function (c) { _cli = c; renderCliKPI(); renderChartCli(); };

  // Acepta el nombre exacto (elegido del datalist) o un texto parcial: en ese
  // caso toma el primer cliente que lo contenga, ordenado por venta.
  window._rvCliInput = function (v) {
    const q = (v || '').trim().toLowerCase();
    if (!q) return;
    const cl = clientesOrdenados();
    let hit = cl.find(c => c.toLowerCase() === q);
    if (!hit) hit = cl.find(c => c.toLowerCase().includes(q));
    if (hit && hit !== _cli) { _cli = hit; renderCliKPI(); renderChartCli(); }
  };

  window.initRepVend = function () {
    if (!(RV.marcas || []).length) return;
    repintar();
  };

  // ═══════════════════════════════════════════════════════════════
  // BLOQUE EN LA HOJA RESUMEN
  // ═══════════════════════════════════════════════════════════════
  const INV = (window.APP_DATA || {}).inv_ts || {};

  // La marca se escribe distinto en cada hoja del Excel: "Marca 2" en
  // Repuestos Vendidas vs "FirmName" en Inventario Bodega. 15 de 20 calzan
  // exacto; estas son las que no. "OTROS (SIN MARCA ATRIBUIBLE)" y "AT GROUP"
  // no tienen equivalente en inventario y quedan fuera del comparativo.
  const ALIAS_INV = {
    'PENTAX': 'PENTAX MEDICAL',
    'DDC DOLPHIN': 'DDC',
    'BIEN AIR': 'BIEN-AIR',
  };
  const invDeMarca = m => (INV.data || {})[ALIAS_INV[m] || m];

  let _chRsMes = null, _chRsMarca = null;
  let _rsAnio = 'todos';             // filtro propio del bloque en Resumen

  // Índices de RV.meses según el año elegido en este bloque
  function rsIdx() {
    return (RV.meses || []).map((x, i) => (_rsAnio === 'todos' || x.a === _rsAnio) ? i : -1)
                           .filter(i => i >= 0);
  }
  function rsSuma(arr) { return rsIdx().reduce((s, i) => s + ((arr || [])[i] || 0), 0); }
  function rsVentaMarca(m) { return rsSuma((RV.data[m] || {}).monto); }
  function rsLblAnio() { return _rsAnio === 'todos' ? 'ambos años (2025 y 2026)' : `año ${_rsAnio}`; }

  function rsSeg() {
    const box = document.getElementById('rs-rep-anio');
    if (!box) return;
    const opts = [['todos', 'Ambos años']].concat((RV.anios || []).map(a => [a, a]));
    box.innerHTML = opts.map(([k, t]) =>
      `<button onclick="window._rsRepAnio('${k}')" style="font-size:.6rem;padding:.22rem .7rem;border-radius:3px;
        border:1px solid ${_rsAnio === k ? 'var(--az1)' : 'var(--brd)'};cursor:pointer;
        background:${_rsAnio === k ? 'var(--az1)' : 'var(--bg2)'};color:${_rsAnio === k ? '#fff' : 'var(--txt)'};
        font-weight:${_rsAnio === k ? '700' : '400'}">${t}</button>`).join('');
  }

  function rsKPIs() {
    const box = document.getElementById('rs-rep-kpi');
    if (!box) return;
    const ms = RV.meses || [];
    const I  = rsIdx();
    const nm = I.length;
    const venta = rsSuma(RV.tot_monto);
    const uds   = rsSuma(RV.tot_cant);
    // Rotación anualizada: así 2025 (7 meses) y 2026 (7 meses) son comparables
    // entre sí y con el período completo.
    const anual = nm ? venta / nm * 12 : 0;
    const rot   = INV.total_costo ? anual / INV.total_costo : 0;
    const marcasOrd = (RV.marcas || []).slice().sort((a, b) => rsVentaMarca(b) - rsVentaMarca(a));
    const top = marcasOrd[0];
    const vTop = top ? rsVentaMarca(top) : 0;

    // pie: leyenda del período. El inventario es una foto de hoy, así que
    // lleva su propia nota en gris en vez del año seleccionado.
    const pie = (t, gris) =>
      `<div style="font-size:.55rem;font-weight:700;margin-top:.2rem;
         color:${gris ? 'var(--mut)' : 'var(--az2)'}">${t}</div>`;
    const tile = (lbl, v, sub, kc, foot) =>
      `<div class="kpi" style="--kc:${kc}">
         <div class="kpi-lbl">${lbl}</div>
         <div class="kpi-val" style="color:${kc}">${v}</div>
         <div class="kpi-sub">${sub}${foot}</div>
       </div>`;
    const pAnio = pie(rsLblAnio(), false);

    box.innerHTML =
      tile('Inventario Valorizado', nMM(INV.total_costo),
           `${nUn(INV.total_skus)} SKU · ${nUn(INV.n_marcas)} marcas`, 'var(--az3)',
           pie('stock actual · no depende del período', true)) +
      tile('Venta de Repuestos', nMM(venta),
           `${nUn(uds)} unidades · ${nm} mes${nm === 1 ? '' : 'es'}`, 'var(--az2)', pAnio) +
      tile('Rotación Inventario', rot.toFixed(2).replace('.', ',') + 'x',
           'venta anualizada / stock', rot >= 1 ? 'var(--gn)' : 'var(--am)', pAnio) +
      tile('Marca Principal', top ? (top.length > 16 ? top.slice(0, 15) + '…' : top) : '—',
           top ? `${nMM(vTop)} · ${pc(vTop, venta)} de la venta` : '—', 'var(--teal)', pAnio);

    const per = document.getElementById('rs-rep-per');
    if (per && nm) per.textContent = `${ms[I[0]].lbl} – ${ms[I[nm - 1]].lbl}`;
  }

  function rsChartMes() {
    const ctx = document.getElementById('cRsRepMes');
    if (!ctx || !window.Chart) return;
    if (_chRsMes) { _chRsMes.destroy(); _chRsMes = null; }
    const I    = rsIdx();
    const ms   = I.map(i => RV.meses[i]);
    const dat  = I.map(i => (RV.tot_monto || [])[i] || 0);
    const prom = dat.length ? dat.reduce((s, v) => s + v, 0) / dat.length : 0;

    _chRsMes = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ms.map(x => x.lbl),
        datasets: [
          { label: 'Venta repuestos', data: dat,
            backgroundColor: ms.map(x => x.a === '2026' ? '#002D73CC' : '#33448D77'),
            borderColor: ms.map(x => x.a === '2026' ? '#002D73' : '#33448D'),
            borderWidth: 1, borderRadius: 3, order: 2 },
          { label: 'Promedio', data: ms.map(() => prom), type: 'line',
            borderColor: '#FFC000', borderWidth: 2, borderDash: [5, 4],
            pointRadius: 0, fill: false, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${nCLP(c.raw)}` } },
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

  function rsChartMarca() {
    const ctx = document.getElementById('cRsRepMarca');
    if (!ctx || !window.Chart || !INV.marcas) return;
    if (_chRsMarca) { _chRsMarca.destroy(); _chRsMarca = null; }

    // Top 10 por stock valorizado, con su venta del período al lado
    const ventaDe = {};
    (RV.marcas || []).forEach(m => {
      const k = ALIAS_INV[m] || m;
      ventaDe[k] = (ventaDe[k] || 0) + rsVentaMarca(m);
    });
    const top = INV.marcas.slice(0, 10);

    _chRsMarca = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top.map(m => m.length > 15 ? m.slice(0, 14) + '…' : m),
        datasets: [
          { label: 'Stock valorizado', data: top.map(m => INV.data[m].ct),
            backgroundColor: '#33448DCC', borderColor: '#33448D', borderWidth: 1, borderRadius: 2 },
          { label: `Venta · ${_rsAnio === 'todos' ? 'ambos años' : _rsAnio}`,
            data: top.map(m => ventaDe[m] || 0),
            backgroundColor: '#28D2C3CC', borderColor: '#28D2C3', borderWidth: 1, borderRadius: 2 },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8 }, padding: 7 } },
          tooltip: {
            callbacks: {
              label: c => ` ${c.dataset.label}: ${nCLP(c.raw)}`,
              footer: it => {
                const s = it.find(x => x.datasetIndex === 0), v = it.find(x => x.datasetIndex === 1);
                if (!s || !v || !s.raw) return '';
                return 'Rotación: ' + (v.raw / s.raw).toFixed(2).replace('.', ',') + 'x';
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
               title: { display: true, text: 'MM$', font: { size: 8 }, color: '#6B7BA8' } },
          y: { grid: { display: false }, ticks: { font: { size: 8 } } },
        },
      },
    });
  }

  function initResumenRep() {
    if (!(RV.marcas || []).length) return;
    rsSeg(); rsKPIs(); rsChartMes(); rsChartMarca();
  }
  window._rsRepAnio = function (k) {
    if (_rsAnio === k) return;
    _rsAnio = k;
    initResumenRep();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResumenRep);
  } else {
    initResumenRep();
  }
})();


// ═══════════════════════════════════════════════════════════════
// EQUIPOS QUE MÁS FALLAN
// ═══════════════════════════════════════════════════════════════
// La hoja de repuestos no trae una columna de equipo: el extractor lo deduce
// del «Nombre de cotización», que es texto libre. Lo que no se pudo deducir
// queda como «Sin equipo identificado» en vez de repartirse — casi todo eso
// son cuotas de convenio y mantenciones masivas de varios equipos a la vez,
// que no hablan de una máquina en particular.
//
// La unidad de conteo es la COTIZACIÓN distinta, no la línea: una reparación
// genera una cotización con muchas líneas de repuesto, y contar líneas haría
// parecer que falla más el equipo que lleva más piezas por intervención.
(function () {
  const EF = (window.APP_DATA || {}).eq_fallas || {};
  if (!EF.filas || !EF.filas.length) return;

  const M = EF.marcas, T = EF.tipos, MO = EF.modelos, NA = EF.nats;
  const SIN = EF.sin_eq || 'Sin equipo identificado';
  // Índices de columna en cada fila, para que el código se lea solo.
  const cMAR = 0, cTIP = 1, cMOD = 2, cNAT = 3, cANIO = 4, cCOT = 6, cCLI = 7,
        cMON = 8, cCANT = 9;

  let _anio = 'todos', _nat = 'todas', _chart = null;
  const _abiertas = {};

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mm = v => window.fmtMM ? fmtMM(v) : 'MM$' + (v / 1e6).toFixed(1);
  const nUn = v => Math.round(v).toLocaleString('es-CL');
  const eqLbl = (t, m) => t === SIN ? SIN : (m ? t + ' ' + m : t + ' (modelo no indicado)');

  const filtra = () => EF.filas.filter(f =>
    (_anio === 'todos' || f[cANIO] === +_anio) &&
    (_nat === 'todas' || NA[f[cNAT]] === _nat));

  // Agrupa contando cotizaciones y clientes distintos con Sets: sumar los
  // conteos de cada grupo contaría dos veces la cotización que toca dos
  // equipos, y son bastantes.
  function agrupa(filas, clave) {
    const g = {};
    filas.forEach(f => {
      const k = clave(f);
      const d = g[k] || (g[k] = { k: k, monto: 0, cant: 0, lin: 0, cot: {}, cli: {}, corr: 0 });
      d.monto += f[cMON]; d.cant += f[cCANT]; d.lin++;
      d.cot[f[cCOT]] = 1; d.cli[f[cCLI]] = 1;
      if (NA[f[cNAT]] === 'Correctivo') d.corr += f[cMON];
    });
    return Object.keys(g).map(k => {
      const d = g[k];
      d.nCot = Object.keys(d.cot).length;
      d.nCli = Object.keys(d.cli).length;
      d.prom = d.nCot ? d.monto / d.nCot : 0;
      return d;
    }).sort((a, b) => b.monto - a.monto);
  }

  // ── Segmentadores ────────────────────────────────────────────
  function botones(box, opts, activo, fn) {
    const b = document.getElementById(box);
    if (!b) return;
    b.innerHTML = opts.map(o =>
      '<button onclick="' + fn + '(\'' + o[0] + '\')" style="font-size:.57rem;padding:.2rem .55rem;' +
      'border-radius:3px;cursor:pointer;white-space:nowrap;border:1px solid ' +
      (o[0] === activo ? 'var(--az2)' : 'var(--brd)') + ';background:' +
      (o[0] === activo ? 'var(--az2)' : 'var(--bg2)') + ';color:' +
      (o[0] === activo ? '#fff' : 'var(--txt)') + ';font-weight:' +
      (o[0] === activo ? 700 : 400) + '">' + esc(o[1]) + '</button>').join('');
  }

  function segmentadores() {
    botones('ef-anio', [['todos', 'Ambos']].concat((EF.anios || []).map(a => [String(a), String(a)])),
            _anio, 'window._efAnio');
    // Sólo se ofrecen las naturalezas que existen en los datos, y en un orden
    // que pone adelante la que habla de fallas.
    const orden = ['Correctivo', 'Preventivo', 'Garantía', 'Convenio', 'Uso interno', 'Sin clasificar'];
    const hay = orden.filter(n => NA.indexOf(n) >= 0);
    botones('ef-nat', [['todas', 'Todas']].concat(hay.map(n => [n, n])), _nat, 'window._efNat');
  }
  window._efAnio = v => { if (_anio !== v) { _anio = v; render(); } };
  window._efNat  = v => { if (_nat  !== v) { _nat  = v; render(); } };

  // ── KPIs ─────────────────────────────────────────────────────
  function kpis(filas, eqs) {
    const box = document.getElementById('ef-kpi');
    if (!box) return;
    const monto = filas.reduce((a, f) => a + f[cMON], 0);
    const cot = {}, ident = [];
    filas.forEach(f => { cot[f[cCOT]] = 1; });
    let mIdent = 0;
    eqs.forEach(d => { if (d.tipo !== SIN) { ident.push(d); mIdent += d.monto; } });
    const tarjeta = (lbl, val, sub, col) =>
      '<div class="kpi" style="border-top:3px solid ' + col + '">' +
        '<div class="kl">' + lbl + '</div>' +
        '<div class="kv" style="color:' + col + '">' + val + '</div>' +
        '<div class="ks">' + sub + '</div></div>';
    box.innerHTML =
      tarjeta('Intervenciones', nUn(Object.keys(cot).length),
              'cotizaciones distintas', 'var(--az1)') +
      tarjeta('Equipos distintos', nUn(ident.length),
              'combinaciones marca + modelo', 'var(--am)') +
      tarjeta('Repuestos consumidos', mm(monto),
              nUn(filas.reduce((a, f) => a + f[cCANT], 0)) + ' unidades', 'var(--teal)') +
      tarjeta('Atribuido a un equipo', monto ? (mIdent / monto * 100).toFixed(0) + '%' : '—',
              mm(mIdent) + ' de ' + mm(monto), 'var(--or)');
  }

  // ── Gráfico: los 12 equipos que más consumen ─────────────────
  function grafico(eqs) {
    const ctx = document.getElementById('cEfTop');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_chart) { _chart.destroy(); _chart = null; }
    const top = eqs.filter(d => d.tipo !== SIN).slice(0, 12);
    if (!top.length) return;
    _chart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top.map(d => d.marca + ' · ' + eqLbl(d.tipo, d.modelo)),
        datasets: [{
          label: 'Repuestos', data: top.map(d => d.monto),
          backgroundColor: '#002D73CC', borderRadius: 3, borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => mm(c.raw),
              afterLabel: c => {
                const d = top[c.dataIndex];
                return [d.nCot + ' intervenciones · ' + d.nCli + ' clientes',
                        'Promedio por intervención: ' + mm(d.prom)];
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
               title: { display: true, text: 'MM$', font: { size: 8 }, color: '#6B7BA8' } },
          y: { grid: { display: false }, ticks: { font: { size: 8.5 } } },
        },
      },
    });
  }

  // ── Tabla: marca, desplegable a equipo ───────────────────────
  window._efTog = function (m) {
    _abiertas[m] = !_abiertas[m];
    tabla();
  };

  function tabla() {
    const box = document.getElementById('ef-tabla');
    if (!box) return;
    const filas = filtra();
    const porMarca = agrupa(filas, f => M[f[cMAR]]);
    const total = filas.reduce((a, f) => a + f[cMON], 0);

    const SEP = 'border-right:1px solid var(--brd)';
    const TD = 'padding:.34rem .6rem;white-space:nowrap';
    const th = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;' +
      'padding:.4rem .6rem;font-size:.58rem;letter-spacing:.04em;text-align:' + (al || 'left') +
      ';white-space:nowrap;' + SEP + '">' + t + '</th>';
    const num = (v, extra) => '<td style="' + TD + ';text-align:right;font-size:.64rem;' +
      'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v + '</td>';

    let html = '<div style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
      '<table style="width:100%;border-collapse:collapse;min-width:880px;table-layout:fixed"><colgroup>' +
      '<col style="width:30%"><col style="width:10%"><col style="width:9%"><col style="width:9%">' +
      '<col style="width:9%"><col style="width:12%"><col style="width:8%"><col style="width:13%">' +
      '</colgroup><thead><tr>' +
      th('MARCA / EQUIPO') + th('INTERV.', 'right') + th('LÍNEAS', 'right') +
      th('UNIDADES', 'right') + th('CLIENTES', 'right') + th('REPUESTOS', 'right') +
      th('% DEL TOTAL', 'right') + th('PROM. x INTERV.', 'right') +
      '</tr></thead><tbody>';

    porMarca.forEach((d, i) => {
      const ab = !!_abiertas[d.k];
      const eqs = agrupa(filas.filter(f => M[f[cMAR]] === d.k),
                         f => T[f[cTIP]] + '||' + MO[f[cMOD]]);
      html += '<tr onclick="window._efTog(' + JSON.stringify(d.k).replace(/"/g, '&quot;') + ')" ' +
        'style="cursor:pointer;background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD + ';font-size:.68rem;font-weight:700;color:var(--am);overflow:hidden;' +
          'text-overflow:ellipsis;' + SEP + '"><span style="display:inline-block;width:11px;color:var(--mut)">' +
          (ab ? '▾' : '▸') + '</span>' + esc(d.k) +
          '<span style="font-weight:400;color:var(--mut);font-size:.58rem"> · ' + eqs.length +
          ' equipo' + (eqs.length === 1 ? '' : 's') + '</span></td>' +
        num(d.nCot, 'font-weight:700;') + num(d.lin, 'color:var(--mut);') +
        num(nUn(d.cant), 'color:var(--mut);') + num(d.nCli) +
        num(mm(d.monto), 'font-weight:700;color:var(--az1);') +
        num(total ? (d.monto / total * 100).toFixed(1).replace('.', ',') + '%' : '—', 'color:var(--mut);') +
        num(mm(d.prom), 'color:var(--teal);') + '</tr>';

      if (ab) {
        eqs.forEach(e => {
          const p = e.k.split('||');
          const esSin = p[0] === SIN;
          html += '<tr style="background:var(--gy)">' +
            '<td style="' + TD + ';font-size:.63rem;padding-left:1.9rem;overflow:hidden;' +
              'text-overflow:ellipsis;' + SEP + ';color:' + (esSin ? 'var(--mut)' : 'var(--txt)') +
              ';font-style:' + (esSin ? 'italic' : 'normal') + '">' + esc(eqLbl(p[0], p[1])) + '</td>' +
            num(e.nCot) + num(e.lin, 'color:var(--mut);') + num(nUn(e.cant), 'color:var(--mut);') +
            num(e.nCli) + num(mm(e.monto), 'color:var(--az2);') +
            num(total ? (e.monto / total * 100).toFixed(1).replace('.', ',') + '%' : '—', 'color:var(--mut);') +
            num(mm(e.prom), 'color:var(--teal);') + '</tr>';
        });
      }
    });

    html += '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.4rem .6rem;font-size:.64rem;' + SEP + '">TOTAL · ' + porMarca.length + ' marcas</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' +
        nUn(Object.keys(filas.reduce((o, f) => { o[f[cCOT]] = 1; return o; }, {})).length) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + filas.length + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' +
        nUn(filas.reduce((a, f) => a + f[cCANT], 0)) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' +
        nUn(Object.keys(filas.reduce((o, f) => { o[f[cCLI]] = 1; return o; }, {})).length) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + mm(total) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">100%</td>' +
      '<td style="padding:.4rem .6rem"></td>' +
      '</tr></tfoot></table></div>' +
      '<p style="font-size:.57rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      '<strong>Una intervención es una cotización distinta</strong>, no una línea: una reparación cotiza ' +
      'muchos repuestos de una vez, y contar líneas haría parecer que falla más el equipo que lleva más ' +
      'piezas. Las cotizaciones y los clientes se cuentan sin repetir, así que las filas de equipo pueden ' +
      'sumar más que su marca cuando una misma cotización toca dos equipos. ' +
      'El equipo se deduce del «Nombre de cotización» del Excel, que es texto libre: lo que no se pudo ' +
      'identificar queda a la vista como «' + SIN + '» y no se reparte entre los demás. ' +
      'Casi todo eso son cuotas de convenio y mantenciones masivas de varios equipos a la vez.</p>';

    box.innerHTML = html;
    const c = document.getElementById('ef-count');
    if (c) {
      const eqTot = agrupa(filas, f => M[f[cMAR]] + '||' + T[f[cTIP]] + '||' + MO[f[cMOD]])
        .filter(d => d.k.indexOf('||' + SIN + '||') < 0).length;
      c.textContent = eqTot + ' equipos identificados · ' + porMarca.length + ' marcas';
    }
  }

  function render() {
    segmentadores();
    const filas = filtra();
    const eqs = agrupa(filas, f => M[f[cMAR]] + '||' + T[f[cTIP]] + '||' + MO[f[cMOD]])
      .map(d => { const p = d.k.split('||'); d.marca = p[0]; d.tipo = p[1]; d.modelo = p[2]; return d; });
    kpis(filas, eqs);
    grafico(eqs);
    tabla();
    const p = document.getElementById('ef-periodo');
    if (p) p.textContent = (_anio === 'todos' ? (EF.anios || []).join(' y ') : _anio) +
      (_nat === 'todas' ? '' : ' · ' + _nat);
  }

  window.efExportPDF = async function () {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
      return;
    }
    const btn = document.getElementById('ef-pdf');
    const ICON = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
    let wrap = null;
    try {
      const src = document.getElementById('ef-tabla');
      if (!src) throw new Error('No se encontró el contenido');
      const hoy = (window.APP_DATA || {}).hoy || '';
      wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1240px;' +
        'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
      const enc = document.createElement('div');
      enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
      enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
        'TECSERVICE — Equipos que más fallan</span>' +
        '&emsp;<span style="font-size:10px;color:#555">' +
        (_anio === 'todos' ? (EF.anios || []).join(' y ') : _anio) +
        (_nat === 'todas' ? '' : ' · ' + _nat) + (hoy ? ' · datos al ' + hoy : '') + '</span>';
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
      await hdEntregar(canvas, 'Equipos_que_mas_fallan_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                       realW * MM_PX, realH * MM_PX);
    } catch (err) {
      console.error('efExportPDF:', err);
      alert('Error al generar: ' + err.message);
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
