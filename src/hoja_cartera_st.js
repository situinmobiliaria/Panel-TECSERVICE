// ═══════════════════════════════════════════════════════════════
// hoja_cartera_st.js — Cartera de Clientes ST
// La cartera completa de Servicio Técnico —todo cliente con al menos un
// equipo factible de ST, tenga o no contrato— repartida entre los dos
// ejecutivos, con sus equipos, su potencial y su facturación.
// Depende de: APP_DATA.cartera_st (extractor.build_cartera_st), utils.js,
//             Chart.js, Leaflet, xlsx-js-style
// ═══════════════════════════════════════════════════════════════
(function () {
  const A = window.APP_DATA || {};
  const K = A.cartera_st || {};
  if (!K.clientes || !K.clientes.length) return;

  const CL = K.clientes;
  const EJES = K.ejecutivos || ['Eglys Ramírez', 'Cristián Pérez'];
  // Los mismos colores que usan Visitas Ejecutivos y el Plan RM.
  const EJECOL = { 'Eglys Ramírez': '#7A1FAA', 'Cristián Pérez': '#003F7F', 'Por asignar': '#8A93AB' };
  const LINEAS = [
    { k: 'esterilizacion', lbl: 'Esterilización', col: '#002D73' },
    { k: 'endoscopia', lbl: 'Endoscopía', col: '#28D2C3' },
    { k: 'dental', lbl: 'Dental', col: '#FFC000' },
    { k: 'incardia', lbl: 'Incardia', col: '#D46000' },
    { k: 'mobiliario', lbl: 'Mobiliario', col: '#7B2FBE' },
    { k: 'mmq_reas', lbl: 'MMQ / REAS', col: '#00832F' },
    { k: 'otros', lbl: 'Otros', col: '#B8C1D8' },
  ];

  // Estado de los segmentadores. Todo lo de la hoja se pinta desde acá.
  const F = { eje: 'todos', reg: 'todas', linea: 'todas', contr: 'todos', q: '' };
  let _sel = null;                 // cliente elegido en el mapa o la tabla
  let _abierta = {};               // regiones desplegadas en la tabla
  let _ord = 'tot', _asc = false;
  let _chEje = null, _chReg = null, _chLin = null, _chTop = null;
  let _map = null, _capa = null, _marcas = {};

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n0 = v => Math.round(v || 0).toLocaleString('es-CL');
  const n1 = v => (+v || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const mmm = v => 'MM$' + n1((v || 0) / 1e6);
  const norm = s => s ? String(s).trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : '';
  const ejeCorto = e => e === 'Por asignar' ? 'Por asignar' : String(e || '').split(' ')[0];
  const eqLinea = (c, l) => (c.eq || {})[l] || 0;

  // ── Filtro ───────────────────────────────────────────────────
  function lista() {
    const q = norm(F.q);
    return CL.filter(c =>
      (F.eje === 'todos' || c.resp === F.eje) &&
      (F.reg === 'todas' || c.r === F.reg) &&
      (F.linea === 'todas' || eqLinea(c, F.linea) > 0) &&
      (F.contr === 'todos' || (F.contr === 'con' ? c.cc : !c.cc)) &&
      (!q || norm(c.n).indexOf(q) >= 0));
  }
  const suma = (cs, f) => cs.reduce((a, c) => a + (f(c) || 0), 0);

  // ── Markup ───────────────────────────────────────────────────
  function markup() {
    const btn = (id, fn, txt) => '<button id="' + id + '" onclick="' + fn + '" style="margin-left:auto;' +
      'font-size:.58rem;padding:.22rem .7rem;background:#0F7B3F;color:#fff;border:none;border-radius:4px;' +
      'cursor:pointer;white-space:nowrap">' + txt + '</button>';
    return `
    <div class="sh"><h2>Cartera de Clientes ST</h2><div class="sh-line"></div>
      <span class="sh-tag">Todos los clientes con equipos factibles de ST, con contrato o sin él, repartidos por ejecutivo</span></div>

    <div class="card" style="margin-bottom:.75rem">
      <div style="display:flex;flex-wrap:wrap;gap:.45rem;align-items:center;padding:.6rem .85rem">
        <span style="font-size:.55rem;font-weight:700;letter-spacing:.06em;color:var(--mut);text-transform:uppercase">Ejecutivo</span>
        <div id="cst-f-eje" style="display:flex;gap:.22rem"></div>
        <span style="font-size:.55rem;font-weight:700;letter-spacing:.06em;color:var(--mut);text-transform:uppercase;margin-left:.35rem">Región</span>
        <select id="cst-f-reg" onchange="window._cstReg(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);max-width:190px"></select>
        <span style="font-size:.55rem;font-weight:700;letter-spacing:.06em;color:var(--mut);text-transform:uppercase;margin-left:.35rem">Línea</span>
        <div id="cst-f-lin" style="display:flex;gap:.22rem;flex-wrap:wrap"></div>
        <span style="font-size:.55rem;font-weight:700;letter-spacing:.06em;color:var(--mut);text-transform:uppercase;margin-left:.35rem">Contrato</span>
        <div id="cst-f-contr" style="display:flex;gap:.22rem"></div>
        <input id="cst-f-q" placeholder="🔍 Buscar cliente…" oninput="window._cstQ(this.value)"
          style="border:1px solid var(--brd);border-radius:20px;padding:.24rem .7rem;font-size:.62rem;outline:none;
                 width:170px;font-family:'Roboto',sans-serif;background:var(--bg2);color:var(--txt)">
        <button class="btn" onclick="window._cstReset()" style="font-size:.57rem">Limpiar</button>
        <span id="cst-f-res" style="margin-left:auto;font-size:.58rem;color:var(--mut)">—</span>
      </div>
    </div>

    <div class="g5" id="cst-kpi" style="margin-bottom:.8rem"></div>

    <div class="card" id="cst-nota-card" style="margin-bottom:.85rem;border-left:4px solid var(--am)">
      <div class="cb" style="padding:.6rem .85rem">
        <div style="font-size:.6rem;font-weight:800;color:var(--az1);margin-bottom:.35rem">
          Qué incluye esta cartera y qué no</div>
        <div id="cst-nota" style="font-size:.6rem;line-height:1.65;color:var(--txt)"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.75rem;margin-bottom:.85rem">
      <div class="card">
        <div class="ch"><span class="ct">Cartera por ejecutivo</span>
          <span id="cst-eje-lbl" style="font-size:.57rem;color:var(--mut)">—</span></div>
        <div class="cb"><div style="position:relative;height:250px"><canvas id="cCstEje"></canvas></div>
          <div id="cst-eje-tab" style="margin-top:.6rem"></div></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Equipos por línea</span>
          <span id="cst-lin-lbl" style="font-size:.57rem;color:var(--mut)">—</span></div>
        <div class="cb"><div style="position:relative;height:250px"><canvas id="cCstLin"></canvas></div>
          <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.5">
            Equipos con Potencial ST = Sí de la cartera filtrada, abiertos por línea y por ejecutivo.</p></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:.85rem">
      <div class="ch" style="flex-wrap:wrap;gap:.4rem"><span class="ct">Cartera por región</span>
        <span id="cst-reg-lbl" style="font-size:.57rem;color:var(--mut)">—</span>
        <span style="font-size:.55rem;color:var(--mut);margin-left:.4rem">clic en una barra o fila para filtrar esa región</span></div>
      <div class="cb">
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:.8rem;align-items:start">
          <div style="position:relative;height:320px"><canvas id="cCstReg"></canvas></div>
          <div id="cst-reg-tab" style="max-height:320px;overflow:auto"></div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:.75rem;margin-bottom:.85rem">
      <div class="card mapa-fijo">
        <div class="ch"><span class="ct">Mapa de la cartera</span>
          <span id="cst-map-lbl" style="font-size:.57rem;color:var(--mut)">—</span>
          <button class="btn" onclick="window._cstFit()" style="margin-left:auto;font-size:.56rem">Centrar</button></div>
        <div class="cb"><div id="cstMapa" style="height:520px;border-radius:6px;overflow:hidden"></div>
          <div id="cst-map-leg" style="padding-top:.5rem;border-top:1px solid var(--brd);margin-top:.5rem"></div></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Top clientes por potencial ST</span>
          <span id="cst-top-lbl" style="font-size:.57rem;color:var(--mut)">—</span></div>
        <div class="cb"><div style="position:relative;height:520px"><canvas id="cCstTop"></canvas></div></div>
      </div>
    </div>

    <div class="card" id="cst-det-card">
      <div class="ch" style="flex-wrap:wrap;gap:.4rem">
        <span class="ct">Detalle por cliente</span>
        <span id="cst-det-lbl" style="font-size:.57rem;color:var(--mut)">—</span>
        <button class="btn" onclick="window._cstAbrir(true)" style="font-size:.56rem;margin-left:.4rem">Expandir todo</button>
        <button class="btn" onclick="window._cstAbrir(false)" style="font-size:.56rem">Colapsar todo</button>
        ${btn('cst-xls', 'window._cstExcel()', 'Exportar Excel')}
      </div>
      <div class="cb"><div id="cst-det" style="max-height:640px;overflow:auto"></div>
        <p style="font-size:.56rem;color:var(--mut);margin:.55rem 0 0;line-height:1.55">
          Son los mismos clientes que la hoja Base Instalada muestra en Detalle por Cliente con el filtro
          Potencial ST = Sí y la casilla «Sumar clientes con contrato vigente» marcada, así que los totales de
          clientes, equipos y potencial cuadran con esa tabla. El <strong>potencial ST</strong>
          de un cliente con contrato vigente es cero, porque ya está capturado; la columna
          <strong>Potencial bruto</strong> muestra cuánto valdría ese parque si no lo tuviera.<br>
          <strong>Con contrato vigente</strong> significa contrato con Estado «Activado» en la hoja CONTRATOS TODOS,
          que es el criterio que usa todo el panel. No es lo mismo que la columna <strong>Estado BI</strong>, que
          viene de la base instalada y marca como Contrato o Garantía a más clientes de los que tienen contrato hoy.<br>
          Un cliente cargado en la base con más de un nombre —«Hospital de Los Ángeles Dr. Víctor Ríos Ruiz» y
          «Hospital Víctor Ríos Ruiz»— se cuenta <strong>una sola vez</strong>, sumando sus equipos: la marca
          <span style="color:var(--az2);font-weight:700">+1</span> junto al nombre avisa cuántas formas más tiene, y
          el detalle sale al pasar el mouse. Por eso la cartera tiene menos clientes que la tabla de Base Instalada,
          aunque los equipos y el potencial son los mismos.</p>
      </div>
    </div>`;
  }

  // ── Segmentadores ────────────────────────────────────────────
  function chips(id, opts, activo, fn) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML = opts.map(o => {
      const on = String(o[0]) === String(activo);
      const col = o[2] || 'var(--az1)';
      return '<button onclick="' + fn + '(\'' + o[0] + '\')" style="font-size:.57rem;padding:.17rem .55rem;' +
        'border-radius:3px;cursor:pointer;white-space:nowrap;border:1px solid ' + (on ? col : 'var(--brd)') +
        ';background:' + (on ? col : 'var(--bg2)') + ';color:' + (on ? '#fff' : 'var(--txt)') +
        ';font-weight:' + (on ? 700 : 400) + '">' + esc(o[1]) + '</button>';
    }).join('');
  }

  function pintarFiltros() {
    const ejes = [...new Set(CL.map(c => c.resp))];
    chips('cst-f-eje', [['todos', 'Todos']].concat(ejes.map(e => [e, ejeCorto(e), EJECOL[e] || '#8A93AB'])),
          F.eje, 'window._cstEje');
    chips('cst-f-lin', [['todas', 'Todas']].concat(LINEAS.filter(l => CL.some(c => eqLinea(c, l.k) > 0))
          .map(l => [l.k, l.lbl, l.col])), F.linea, 'window._cstLinea');
    chips('cst-f-contr', [['todos', 'Todos'], ['con', 'Con contrato', '#00832F'], ['sin', 'Sin contrato', '#C00000']],
          F.contr, 'window._cstContr');
    const sel = document.getElementById('cst-f-reg');
    if (sel) {
      const regs = [...new Set(CL.map(c => c.r))].sort((a, b) =>
        suma(CL.filter(c => c.r === b), c => c.tot) - suma(CL.filter(c => c.r === a), c => c.tot));
      sel.innerHTML = ['<option value="todas">Todas las regiones</option>']
        .concat(regs.map(r => '<option value="' + esc(r) + '"' + (F.reg === r ? ' selected' : '') + '>' +
          esc(r) + '</option>')).join('');
    }
    const q = document.getElementById('cst-f-q');
    if (q && q.value !== F.q) q.value = F.q;
  }

  window._cstEje = v => { F.eje = v; _sel = null; render(); };
  window._cstReg = v => { F.reg = v; _sel = null; render(true); };
  window._cstLinea = v => { F.linea = v; _sel = null; render(); };
  window._cstContr = v => { F.contr = v; _sel = null; render(); };
  window._cstQ = v => { F.q = v; _sel = null; render(true); };
  window._cstReset = () => { F.eje = 'todos'; F.reg = 'todas'; F.linea = 'todas'; F.contr = 'todos'; F.q = ''; _sel = null; render(true); };
  window._cstAbrir = function (abrir) {
    _abierta = {};
    if (abrir) lista().forEach(c => { _abierta[c.r] = true; });
    detalle();
  };
  window._cstTogReg = function (r) { _abierta[r] = !_abierta[r]; detalle(); };
  window._cstOrd = function (col) {
    if (_ord === col) _asc = !_asc; else { _ord = col; _asc = col === 'n'; }
    detalle();
  };
  window._cstSel = function (n) {
    _sel = _sel === n ? null : n;
    detalle();
    if (_sel && _marcas[_sel] && _map) {
      _map.setView(_marcas[_sel].getLatLng(), Math.max(_map.getZoom(), 10), { animate: true });
      _marcas[_sel].openTooltip();
    }
  };
  window._cstFit = function () {
    const pts = lista().filter(c => c.lat != null);
    if (_map && pts.length) { try { _map.fitBounds(L.latLngBounds(pts.map(c => [c.lat, c.lon])).pad(.12)); } catch (e) {} }
  };
  window._cstMapRefresh = function () { if (_map) _map.invalidateSize(); };

  // ── Alcance de la cartera ────────────────────────────────────
  // El número de clientes con contrato de esta hoja no es el de la hoja
  // CONTRATOS TODOS, y sin explicarlo se lee como un descuadre.
  function nota() {
    const el = document.getElementById('cst-nota');
    if (!el) return;
    const q = K.cuadre || {};
    const lista15 = (arr, f) => arr.slice(0, 6).map(f).join(', ') +
      (arr.length > 6 ? ' y ' + (arr.length - 6) + ' más' : '');
    el.innerHTML =
      '<strong>El universo</strong> es el mismo de la hoja <strong>Base Instalada</strong>, tabla Detalle por ' +
      'Cliente, con el filtro <strong>Potencial ST = Sí</strong> y la casilla «Sumar clientes con contrato vigente» ' +
      'marcada: todo cliente con al menos un equipo factible de servicio técnico. Los equipos y el potencial cuadran ' +
      'con esa tabla.<br>' +
      '<strong>Los nombres repetidos se unifican.</strong> La base instalada carga al mismo cliente con más de un ' +
      'nombre —«Hospital de Los Ángeles Dr. Víctor Ríos Ruiz» y «Hospital Víctor Ríos Ruiz»—; acá se cuentan una ' +
      'sola vez y se suman sus equipos' + (K.unificados ? ' (' + K.unificados + ' nombres unificados)' : '') +
      '. Por eso la cartera tiene <strong>' + n0(CL.length) + ' clientes</strong> y no los ' +
      n0(CL.length + (K.unificados || 0)) + ' de esa tabla.<br>' +
      (q.activados ?
        '<strong>Los clientes con contrato son ' + n0(q.en_cartera) + ' y no ' + n0(q.activados) + '.</strong> ' +
        'CONTRATOS TODOS tiene ' + n0(q.activados) + ' clientes con Estado «Activado»; de ellos, ' +
        n0(q.en_cartera) + ' están acá y ' + n0((q.sin_st || []).length + (q.sin_bi || []).length) +
        ' quedan fuera porque no tienen equipos factibles de ST: ' +
        ((q.sin_st || []).length ? '<strong>' + n0(q.sin_st.length) + '</strong> tienen equipos en la base pero ' +
          'ninguno con Potencial ST = Sí (' + esc(lista15(q.sin_st, x => x.n + ' ' + x.eq + ' eq')) + ')' : '') +
        ((q.sin_st || []).length && (q.sin_bi || []).length ? ' y ' : '') +
        ((q.sin_bi || []).length ? '<strong>' + n0(q.sin_bi.length) + '</strong> no tienen base instalada cargada (' +
          esc(lista15(q.sin_bi, x => x)) + ')' : '') + '.' : '');
  }

  // ── KPIs ─────────────────────────────────────────────────────
  function kpis(cs) {
    const box = document.getElementById('cst-kpi');
    if (!box) return;
    const eq = suma(cs, c => c.tot), pot = suma(cs, c => c.pot), fac = suma(cs, c => c.f26);
    const conC = cs.filter(c => c.cc).length;
    const regs = new Set(cs.map(c => c.r)).size;
    const k = (col, val, lbl, sub) => '<div class="kpi" style="--kc:' + col + '"><div class="kpi-lbl">' + lbl +
      '</div><div class="kpi-val">' + val + '</div><div class="kpi-sub">' + sub + '</div></div>';
    box.innerHTML =
      k('var(--az1)', n0(cs.length), 'Clientes de la cartera', regs + ' regiones · ' + n0(eq) + ' equipos ST') +
      k('var(--teal)', n0(conC), 'Con contrato vigente',
        cs.length ? (conC / cs.length * 100).toFixed(0) + '% de la cartera' : '—') +
      k('var(--am)', mmm(pot), 'Potencial ST por capturar', 'de ' + mmm(suma(cs, c => c.pot_bruto)) + ' del parque') +
      k('var(--gn)', mmm(fac), 'Facturación ' + ANO_ACTUAL, mmm(suma(cs, c => c.fcontr)) + ' de contratos') +
      k('var(--or)', n0(suma(cs, c => c.pipe_eq) / 1e6) ? mmm(suma(cs, c => c.pipe_eq)) : '—', 'Pipeline de equipos',
        mmm(suma(cs, c => c.pipe_st)) + ' de garantías');
    const res = document.getElementById('cst-f-res');
    if (res) {
      const p = [];
      if (F.eje !== 'todos') p.push(ejeCorto(F.eje));
      if (F.reg !== 'todas') p.push(F.reg);
      if (F.linea !== 'todas') p.push((LINEAS.find(l => l.k === F.linea) || {}).lbl);
      if (F.contr !== 'todos') p.push(F.contr === 'con' ? 'con contrato' : 'sin contrato');
      if (F.q) p.push('«' + F.q + '»');
      res.innerHTML = '<strong>' + n0(cs.length) + '</strong> clientes · <strong>' + n0(eq) + '</strong> equipos ST' +
        (p.length ? ' · ' + esc(p.join(' · ')) : ' · sin filtros');
    }
  }

  // ── Cartera por ejecutivo ────────────────────────────────────
  function porEjecutivo(cs) {
    const ejes = [...new Set(CL.map(c => c.resp))];
    const datos = ejes.map(e => {
      const sub = cs.filter(c => c.resp === e);
      return { eje: e, n: sub.length, eq: suma(sub, c => c.tot), pot: suma(sub, c => c.pot),
        fac: suma(sub, c => c.f26), cc: sub.filter(c => c.cc).length,
        regs: new Set(sub.map(c => c.r)).size };
    }).filter(d => d.n);

    const ctx = document.getElementById('cCstEje');
    if (ctx && typeof safeChart === 'function') {
      if (_chEje) _chEje.destroy();
      _chEje = safeChart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: datos.map(d => ejeCorto(d.eje)), datasets: [
          { label: 'Clientes', data: datos.map(d => d.n), backgroundColor: datos.map(d => EJECOL[d.eje] || '#8A93AB'),
            borderRadius: 5, yAxisID: 'y' },
          { label: 'Potencial ST (MM$)', data: datos.map(d => +(d.pot / 1e6).toFixed(1)), type: 'line',
            borderColor: '#FFC000', backgroundColor: 'rgba(255,192,0,.15)', pointRadius: 5, borderWidth: 2.5,
            yAxisID: 'y1' },
        ] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } },
          scales: { x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: '#E2E6F0' }, title: { display: true, text: 'Clientes', font: { size: 9 }, color: '#6B7BA8' } },
            y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false },
              title: { display: true, text: 'MM$', font: { size: 9 }, color: '#6B7BA8' } } } },
      });
    }

    const box = document.getElementById('cst-eje-tab');
    if (box) {
      const SEP = 'border-right:1px solid var(--brd)';
      const th = t => '<th style="background:var(--az1);color:#fff;padding:.28rem .45rem;font-size:.53rem;' +
        'text-align:right;border-right:1px solid rgba(255,255,255,.18)">' + t + '</th>';
      const td = (v, extra) => '<td style="padding:.24rem .45rem;text-align:right;font-size:.6rem;' +
        'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v + '</td>';
      box.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
        '<th style="background:var(--az1);color:#fff;padding:.28rem .45rem;font-size:.53rem;text-align:left;' + SEP + '">EJECUTIVO</th>' +
        th('CLIENTES') + th('EQUIPOS ST') + th('CON CONTRATO') + th('POTENCIAL ST') + th('FACT. ' + ANO_ACTUAL) +
        '</tr></thead><tbody>' + datos.map((d, i) =>
          '<tr style="background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + ';border-left:3px solid ' +
          (EJECOL[d.eje] || '#8A93AB') + '">' +
          '<td style="padding:.24rem .45rem;font-size:.61rem;font-weight:700;color:' + (EJECOL[d.eje] || '#8A93AB') + ';' + SEP + '">' +
          esc(d.eje) + '</td>' + td(n0(d.n)) + td(n0(d.eq)) +
          td(d.cc + ' · ' + (d.n ? Math.round(d.cc / d.n * 100) : 0) + '%', 'color:var(--teal);') +
          td(mmm(d.pot), 'color:var(--am);font-weight:700;') + td(mmm(d.fac), 'color:var(--gn);') + '</tr>').join('') +
        '</tbody></table>';
    }
    const lbl = document.getElementById('cst-eje-lbl');
    if (lbl) lbl.textContent = datos.map(d => ejeCorto(d.eje) + ': ' + n0(d.n)).join(' · ');
  }

  // ── Equipos por línea ────────────────────────────────────────
  function porLinea(cs) {
    const ctx = document.getElementById('cCstLin');
    if (!ctx || typeof safeChart !== 'function') return;
    if (_chLin) _chLin.destroy();
    const ejes = [...new Set(CL.map(c => c.resp))].filter(e => cs.some(c => c.resp === e));
    const lins = LINEAS.filter(l => cs.some(c => eqLinea(c, l.k) > 0));
    _chLin = safeChart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: lins.map(l => l.lbl), datasets: ejes.map(e => ({
        label: ejeCorto(e), data: lins.map(l => suma(cs.filter(c => c.resp === e), c => eqLinea(c, l.k))),
        backgroundColor: EJECOL[e] || '#8A93AB', borderRadius: 4, stack: 'l' })) },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + n0(c.parsed.y) + ' equipos' } } },
        scales: { x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: '#E2E6F0' } } } },
    });
    const lbl = document.getElementById('cst-lin-lbl');
    if (lbl) lbl.textContent = n0(suma(cs, c => c.tot)) + ' equipos ST';
  }

  // ── Cartera por región ───────────────────────────────────────
  function porRegion(cs) {
    const regs = [...new Set(cs.map(c => c.r))].map(r => {
      const sub = cs.filter(c => c.r === r);
      const porEje = {};
      EJES.concat(['Por asignar']).forEach(e => { porEje[e] = sub.filter(c => c.resp === e).length; });
      return { r: r, n: sub.length, eq: suma(sub, c => c.tot), pot: suma(sub, c => c.pot),
        fac: suma(sub, c => c.f26), cc: sub.filter(c => c.cc).length, porEje: porEje,
        eje: [...new Set(sub.map(c => c.resp))] };
    }).sort((a, b) => b.eq - a.eq);

    const ctx = document.getElementById('cCstReg');
    if (ctx && typeof safeChart === 'function') {
      if (_chReg) _chReg.destroy();
      const ejes = [...new Set(CL.map(c => c.resp))];
      _chReg = safeChart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: regs.map(r => r.r), datasets: ejes.map(e => ({
          label: ejeCorto(e),
          data: regs.map(r => suma(cs.filter(c => c.r === r.r && c.resp === e), c => c.tot)),
          backgroundColor: EJECOL[e] || '#8A93AB', borderRadius: 4, stack: 'r' })) },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          onClick: (evt, els) => { if (els && els.length) window._cstReg(regs[els[0].index].r); },
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
            tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + n0(c.parsed.x) + ' equipos' } } },
          scales: { x: { stacked: true, beginAtZero: true, grid: { color: '#E2E6F0' } },
            y: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } } } },
      });
    }

    const box = document.getElementById('cst-reg-tab');
    if (box) {
      const SEP = 'border-right:1px solid var(--brd)';
      const TH = 'position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.3rem .45rem;' +
        'font-size:.53rem;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)';
      const th = (t, al) => '<th style="' + TH + ';text-align:' + (al || 'left') + '">' + t + '</th>';
      const td = (v, extra) => '<td style="padding:.24rem .45rem;text-align:right;font-size:.6rem;' +
        'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v + '</td>';
      const totEq = suma(cs, c => c.tot);
      box.innerHTML = '<table style="width:100%;border-collapse:collapse;min-width:560px"><thead><tr>' +
        th('REGIÓN') + th('EJECUTIVO') + th('CLIENTES', 'right') + th('EQUIPOS ST', 'right') + th('%', 'right') +
        th('CON CONTR.', 'right') + th('POTENCIAL ST', 'right') + th('FACT. ' + ANO_ACTUAL, 'right') +
        '</tr></thead><tbody>' + regs.map((r, i) =>
          '<tr onclick="window._cstReg(' + JSON.stringify(F.reg === r.r ? 'todas' : r.r).replace(/"/g, '&quot;') + ')" ' +
          'style="cursor:pointer;background:' + (F.reg === r.r ? 'rgba(255,192,0,.18)' : (i % 2 ? 'var(--bg)' : 'var(--bg2)')) + '">' +
          '<td style="padding:.24rem .45rem;font-size:.61rem;font-weight:600;white-space:nowrap;' + SEP + '">' + esc(r.r) + '</td>' +
          '<td style="padding:.24rem .45rem;font-size:.55rem;' + SEP + '">' +
            r.eje.map(e => '<span style="color:' + (EJECOL[e] || '#8A93AB') + ';font-weight:700">' + esc(ejeCorto(e)) +
              '</span> ' + r.porEje[e]).join(' · ') + '</td>' +
          td(n0(r.n)) + td(n0(r.eq), 'font-weight:700;color:var(--az1);') +
          td((r.eq / (totEq || 1) * 100).toFixed(1) + '%', 'color:var(--mut);') +
          td(r.cc, 'color:var(--teal);') + td(r.pot ? mmm(r.pot) : '—', 'color:var(--am);font-weight:700;') +
          td(r.fac ? mmm(r.fac) : '—', 'color:var(--gn);') + '</tr>').join('') +
        '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
        '<td colspan="2" style="padding:.28rem .45rem;font-size:.58rem;' + SEP + '">TOTAL · ' + regs.length + ' regiones</td>' +
        td(n0(cs.length), 'color:#fff;') + td(n0(totEq), 'color:#fff;') + td('100%', 'color:#fff;') +
        td(cs.filter(c => c.cc).length, 'color:#7FE8DF;') + td(mmm(suma(cs, c => c.pot)), 'color:#FFC000;') +
        td(mmm(suma(cs, c => c.f26)), 'color:#7FE8B0;') + '</tr></tfoot></table>';
    }
    const lbl = document.getElementById('cst-reg-lbl');
    if (lbl) lbl.textContent = regs.length + ' regiones · ' + n0(suma(cs, c => c.tot)) + ' equipos ST' +
      (F.reg === 'todas' ? '' : ' · filtrado en ' + F.reg);
  }

  // ── Top clientes ─────────────────────────────────────────────
  function topClientes(cs) {
    const ctx = document.getElementById('cCstTop');
    if (!ctx || typeof safeChart !== 'function') return;
    if (_chTop) _chTop.destroy();
    const top = cs.slice().sort((a, b) => (b.pot || b.pot_bruto) - (a.pot || a.pot_bruto)).slice(0, 18);
    _chTop = safeChart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: top.map(c => c.n.length > 34 ? c.n.slice(0, 32) + '…' : c.n),
        datasets: [{ label: 'Potencial ST', data: top.map(c => +((c.pot || c.pot_bruto) / 1e6).toFixed(2)),
          backgroundColor: top.map(c => c.cc ? '#8A93AB' : (EJECOL[c.resp] || '#002D73')), borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        onClick: (evt, els) => { if (els && els.length) window._cstSel(top[els[0].index].n); },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { title: c => top[c[0].dataIndex].n,
            label: c => { const x = top[c.dataIndex];
              return [x.resp + ' · ' + x.r, n0(x.tot) + ' equipos ST',
                (x.cc ? 'Con contrato · potencial capturado ' : 'Potencial ST ') + mmm(x.pot || x.pot_bruto),
                'Facturación ' + ANO_ACTUAL + ': ' + mmm(x.f26)]; } } } },
        scales: { x: { beginAtZero: true, grid: { color: '#E2E6F0' }, title: { display: true, text: 'MM$', font: { size: 9 }, color: '#6B7BA8' } },
          y: { grid: { display: false }, ticks: { font: { size: 8 } } } } },
    });
    const lbl = document.getElementById('cst-top-lbl');
    if (lbl) lbl.textContent = 'los ' + top.length + ' mayores · gris = con contrato vigente';
  }

  // ── Mapa ─────────────────────────────────────────────────────
  function mapa(cs, recentrar) {
    if (typeof L === 'undefined') return;
    const el = document.getElementById('cstMapa');
    if (!el) return;
    if (!_map) {
      _map = L.map('cstMapa', { zoomControl: true, scrollWheelZoom: false }).setView([-35.5, -70.8], 4);
      if (window.mapaTiles) window.mapaTiles(_map);
      _capa = L.layerGroup().addTo(_map);
    }
    _capa.clearLayers();
    _marcas = {};
    const pts = cs.filter(c => c.lat != null && c.lon != null);
    const maxEq = Math.max.apply(null, pts.map(c => c.tot).concat([1]));
    pts.forEach(c => {
      const col = EJECOL[c.resp] || '#8A93AB';
      const act = _sel === c.n;
      const mk = L.circleMarker([c.lat, c.lon], {
        radius: Math.max(4, Math.sqrt(c.tot / maxEq) * 18) + (act ? 4 : 0),
        fillColor: col, color: act ? '#111827' : col, weight: act ? 3 : 1.4,
        opacity: 1, fillOpacity: c.cc ? .45 : .75,
      }).bindTooltip(
        '<div style="font-family:Roboto,sans-serif;min-width:200px">' +
        '<div style="font-weight:900;font-size:.75rem;color:' + col + ';border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:4px">' +
        esc(c.n) + '</div>' +
        '<div style="font-size:.66rem"><strong>' + n0(c.tot) + '</strong> equipos ST' +
        (c.vu != null ? ' · ' + n1(c.vu) + '% de vida útil' : '') + '</div>' +
        '<div style="font-size:.63rem;color:#555">' + esc(c.resp) + ' · ' + esc(c.r) +
        (c.com ? ' · ' + esc(c.com) : '') + '</div>' +
        '<div style="font-size:.63rem;color:#555">' + (c.cc ? 'Con contrato vigente' : 'Potencial ST ' + mmm(c.pot)) + '</div>' +
        '<div style="font-size:.63rem;color:#555">Facturación ' + ANO_ACTUAL + ': <strong>' + mmm(c.f26) + '</strong></div>' +
        '</div>', { sticky: true, direction: 'top', opacity: .97 });
      mk.on('click', () => window._cstSel(c.n));
      mk.addTo(_capa);
      _marcas[c.n] = mk;
    });
    if (recentrar && pts.length) {
      try { _map.fitBounds(L.latLngBounds(pts.map(c => [c.lat, c.lon])).pad(.12)); } catch (e) {}
    }
    const lbl = document.getElementById('cst-map-lbl');
    if (lbl) lbl.textContent = n0(pts.length) + ' clientes ubicados' +
      (cs.length - pts.length ? ' · ' + n0(cs.length - pts.length) + ' sin ubicación' : '');
    const leg = document.getElementById('cst-map-leg');
    if (leg) {
      const item = (col, txt, n) => '<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.57rem;margin-right:1rem">' +
        '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';opacity:.75;border:1.5px solid ' + col + '"></span>' +
        txt + ' <strong>' + n0(n) + '</strong></span>';
      leg.innerHTML = [...new Set(CL.map(c => c.resp))].map(e =>
        item(EJECOL[e] || '#8A93AB', ejeCorto(e), cs.filter(c => c.resp === e).length)).join('') +
        '<span style="font-size:.57rem;color:var(--mut)">· el tamaño es el número de equipos ST · los clientes con ' +
        'contrato van más pálidos · clic para fijar uno en la tabla</span>';
    }
    setTimeout(() => { if (_map) _map.invalidateSize(); }, 60);
  }

  // ── Detalle por cliente, agrupado por región ─────────────────
  function detalle() {
    const box = document.getElementById('cst-det');
    if (!box) return;
    const cs = lista();
    const SEP = 'border-right:1px solid var(--brd)';
    const TH = 'position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.32rem .4rem;' +
      'font-size:.52rem;letter-spacing:.02em;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18);cursor:pointer';
    const th = (t, col, al) => '<th onclick="window._cstOrd(' + JSON.stringify(col).replace(/"/g, '&quot;') + ')" ' +
      'style="' + TH + ';text-align:' + (al || 'left') + '">' + t + (_ord === col ? (_asc ? ' ▲' : ' ▼') : '') + '</th>';
    const td = (v, extra) => '<td style="padding:.22rem .4rem;text-align:right;font-size:.59rem;' +
      'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v + '</td>';

    const porReg = {};
    cs.forEach(c => { (porReg[c.r] || (porReg[c.r] = [])).push(c); });
    const regs = Object.keys(porReg).sort((a, b) => {
      if (a === 'Sin región') return 1;
      if (b === 'Sin región') return -1;
      return suma(porReg[b], c => c.tot) - suma(porReg[a], c => c.tot);
    });
    const val = c => _ord === 'n' ? c.n : _ord === 'resp' ? c.resp : _ord === 'vu' ? (c.vu == null ? -1 : c.vu)
      : _ord === 'pot' ? c.pot : _ord === 'f26' ? c.f26 : c.tot;

    let h = '<table style="width:100%;border-collapse:collapse;min-width:1080px"><thead><tr>' +
      th('CLIENTE', 'n') + th('EJECUTIVO', 'resp') + th('COMUNA', 'n') + th('EQUIPOS ST', 'tot', 'right') +
      LINEAS.slice(0, 3).map(l => '<th style="' + TH + ';text-align:right;color:' + l.col + '">' +
        l.lbl.toUpperCase().slice(0, 7) + '</th>').join('') +
      th('% VIDA ÚTIL', 'vu', 'right') + th('CONTRATO', 'resp', 'right') + th('POTENCIAL ST', 'pot', 'right') +
      th('POT. BRUTO', 'pot', 'right') + th('FACT. ' + ANO_ACTUAL, 'f26', 'right') +
      '</tr></thead><tbody>';

    regs.forEach((r, ri) => {
      const sub = porReg[r].slice().sort((a, b) => {
        const x = val(a), y = val(b);
        const c0 = (typeof x === 'string') ? String(x).localeCompare(String(y), 'es') : (x - y);
        return (_asc ? c0 : -c0) || b.tot - a.tot;
      });
      const ab = !!_abierta[r];
      const ejesR = [...new Set(sub.map(c => c.resp))];
      h += '<tr onclick="window._cstTogReg(' + JSON.stringify(r).replace(/"/g, '&quot;') + ')" ' +
        'style="cursor:pointer;background:var(--gy);border-top:1px solid var(--brd)">' +
        '<td style="padding:.28rem .4rem;font-size:.66rem;font-weight:800;color:var(--az1);' + SEP + '">' +
        '<span style="display:inline-block;width:11px;color:var(--mut)">' + (ab ? '▾' : '▸') + '</span>' + esc(r) +
        ' <span style="font-size:.55rem;color:var(--mut);font-weight:400">· ' + sub.length + ' clientes</span></td>' +
        '<td style="padding:.28rem .4rem;font-size:.55rem;' + SEP + '">' + ejesR.map(e =>
          '<span style="color:' + (EJECOL[e] || '#8A93AB') + ';font-weight:700">' + esc(ejeCorto(e)) + '</span> ' +
          sub.filter(c => c.resp === e).length).join(' · ') + '</td>' +
        '<td style="' + SEP + '"></td>' +
        td(n0(suma(sub, c => c.tot)), 'font-weight:700;color:var(--az1);') +
        LINEAS.slice(0, 3).map(l => td(n0(suma(sub, c => eqLinea(c, l.k))) || '—', 'color:' + l.col + ';')).join('') +
        (() => { const v = sub.filter(c => c.vu != null);
          return td(v.length ? n1(v.reduce((a, c) => a + c.vu, 0) / v.length) + '%' : '—', 'color:var(--mut);'); })() +
        td(sub.filter(c => c.cc).length, 'color:var(--teal);') +
        td(mmm(suma(sub, c => c.pot)), 'color:var(--am);font-weight:700;') +
        td(mmm(suma(sub, c => c.pot_bruto)), 'color:var(--mut);') +
        td(mmm(suma(sub, c => c.f26)), 'color:var(--gn);') + '</tr>';
      if (!ab) return;
      sub.forEach((c, i) => {
        const act = _sel === c.n;
        h += '<tr onclick="window._cstSel(' + JSON.stringify(c.n).replace(/"/g, '&quot;') + ')" ' +
          'style="cursor:pointer;background:' + (act ? 'rgba(255,192,0,.18)' : (i % 2 ? 'var(--bg)' : 'var(--bg2)')) +
          ';border-left:3px solid ' + (EJECOL[c.resp] || '#8A93AB') + '">' +
          '<td style="padding:.22rem .4rem .22rem 1.5rem;font-size:.6rem;font-weight:600;max-width:270px;' +
            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + SEP + '" title="' + esc(c.n) +
            ((c.alias || []).length ? '&#10;También en la base como: ' + esc(c.alias.join(' · ')) : '') + '">' +
            esc(c.n) + ((c.alias || []).length ? ' <span style="color:var(--az2);font-size:.52rem">+' +
            c.alias.length + '</span>' : '') + '</td>' +
          '<td style="padding:.22rem .4rem;font-size:.56rem;font-weight:700;color:' + (EJECOL[c.resp] || '#8A93AB') + ';' + SEP + '">' +
            esc(ejeCorto(c.resp)) + '</td>' +
          '<td style="padding:.22rem .4rem;font-size:.55rem;color:var(--mut);white-space:nowrap;' + SEP + '">' +
            esc(c.com || '—') + '</td>' +
          td(n0(c.tot), 'font-weight:700;') +
          LINEAS.slice(0, 3).map(l => td(eqLinea(c, l.k) || '—', 'color:' + l.col + ';')).join('') +
          td(c.vu == null ? '—' : n1(c.vu) + '%', 'color:' + (c.vu == null ? 'var(--mut)' : c.vu >= 100 ? '#C00000' : c.vu >= 80 ? '#D46000' : 'var(--gn)') + ';') +
          td(c.cc ? '<span class="badge bok">Sí</span>' : '<span style="color:var(--mut)">—</span>') +
          td(c.pot ? mmm(c.pot) : '<span style="color:var(--mut)">—</span>', 'color:var(--am);font-weight:700;') +
          td(mmm(c.pot_bruto), 'color:var(--mut);') +
          td(c.f26 ? mmm(c.f26) : '—', 'color:var(--gn);') + '</tr>';
      });
    });

    h += '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td colspan="3" style="padding:.3rem .4rem;font-size:.6rem;' + SEP + '">' + n0(cs.length) + ' clientes · ' +
        regs.length + ' regiones</td>' +
      td(n0(suma(cs, c => c.tot)), 'color:#fff;') +
      LINEAS.slice(0, 3).map(l => td(n0(suma(cs, c => eqLinea(c, l.k))), 'color:#fff;')).join('') +
      (() => { const v = cs.filter(c => c.vu != null);
        return td(v.length ? n1(v.reduce((a, c) => a + c.vu, 0) / v.length) + '%' : '—', 'color:#fff;'); })() +
      td(cs.filter(c => c.cc).length, 'color:#7FE8DF;') +
      td(mmm(suma(cs, c => c.pot)), 'color:#FFC000;') + td(mmm(suma(cs, c => c.pot_bruto)), 'color:#B8C1D8;') +
      td(mmm(suma(cs, c => c.f26)), 'color:#7FE8B0;') + '</tr></tfoot></table>';
    box.innerHTML = h;
    const lbl = document.getElementById('cst-det-lbl');
    if (lbl) lbl.textContent = n0(cs.length) + ' clientes · clic en una región para abrirla y en un cliente para fijarlo en el mapa';
  }

  // ── Excel ────────────────────────────────────────────────────
  window._cstExcel = function () {
    if (typeof XLSX === 'undefined') { alert('Librería Excel no cargada.'); return; }
    const cs = lista();
    const cab = t => ({ v: t, t: 's', s: { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '002D73' } }, alignment: { horizontal: 'center', wrapText: true } } });
    const filtro = [F.eje !== 'todos' ? F.eje : '', F.reg !== 'todas' ? F.reg : '',
      F.linea !== 'todas' ? (LINEAS.find(l => l.k === F.linea) || {}).lbl : '',
      F.contr !== 'todos' ? (F.contr === 'con' ? 'con contrato' : 'sin contrato') : ''].filter(Boolean).join(' · ');
    const aoa = [['Cartera de Clientes ST' + (filtro ? ' · ' + filtro : '')], [],
      ['Cliente', 'Ejecutivo', 'Región', 'Comuna', 'Equipos ST', 'Esterilización', 'Endoscopía', 'Dental',
       'Incardia', 'Mobiliario', 'MMQ/REAS', 'Otros', '% Vida útil', 'Contrato vigente', 'Estado BI',
       'Potencial ST ($)', 'Potencial bruto ($)', 'Facturación ' + ANO_ACTUAL + ' ($)', 'De contratos ($)',
       'Pipeline equipos ($)', 'Potencial garantías ($)', 'Ubicación', 'Otros nombres en la base'].map(cab)];
    cs.slice().sort((a, b) => a.r.localeCompare(b.r) || b.tot - a.tot).forEach(c => aoa.push([
      c.n, c.resp, c.r, c.com || '', c.tot, eqLinea(c, 'esterilizacion'), eqLinea(c, 'endoscopia'),
      eqLinea(c, 'dental'), eqLinea(c, 'incardia'), eqLinea(c, 'mobiliario'), eqLinea(c, 'mmq_reas'),
      eqLinea(c, 'otros'), c.vu == null ? '' : c.vu, c.cc ? 'Sí' : 'No', c.estado || '',
      c.pot, c.pot_bruto, c.f26, c.fcontr, c.pipe_eq, c.pipe_st, c.prec || '', (c.alias || []).join(' · ')]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 46 }, { wch: 17 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 13 }, { wch: 11 },
      { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 8 }, { wch: 11 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 40 }];
    ws['!freeze'] = { xSplit: 1, ySplit: 3 };
    for (let i = 0; i < cs.length; i++) {
      [15, 16, 17, 18, 19, 20].forEach(col => {
        const ref = XLSX.utils.encode_cell({ r: 3 + i, c: col });
        if (ws[ref]) ws[ref].z = '#,##0';
      });
      const rv = XLSX.utils.encode_cell({ r: 3 + i, c: 12 });
      if (ws[rv] && typeof ws[rv].v === 'number') ws[rv].z = '0.0"%"';
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cartera ST');
    XLSX.writeFile(wb, 'Cartera_clientes_ST_' + (A.hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
  };

  // ── Render ───────────────────────────────────────────────────
  function render(recentrar) {
    const cs = lista();
    pintarFiltros();
    nota();
    kpis(cs);
    porEjecutivo(cs);
    porLinea(cs);
    porRegion(cs);
    topClientes(cs);
    mapa(cs, recentrar);
    detalle();
  }

  window.initCarteraST = function () {
    const w = document.getElementById('view-cartera');
    if (!w) return;
    if (!w.dataset.listo) {
      w.innerHTML = markup();
      w.dataset.listo = '1';
      // La tabla abre con las dos regiones mayores desplegadas.
      const regs = [...new Set(CL.map(c => c.r))]
        .sort((a, b) => suma(CL.filter(c => c.r === b), c => c.tot) - suma(CL.filter(c => c.r === a), c => c.tot));
      regs.slice(0, 2).forEach(r => { _abierta[r] = true; });
      render(true);
    } else if (_map) {
      setTimeout(() => _map.invalidateSize(), 60);
    }
  };

  // Se engancha a la navegación como el Plan RM: la vista se arma la primera
  // vez que se entra, no al cargar el panel.
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig.apply(this, arguments);
      if (name === 'cartera') setTimeout(window.initCarteraST, 80);
    };
  }
})();
