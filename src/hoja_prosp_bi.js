// ═══════════════════════════════════════════════════════════════
// hoja_prosp_bi.js — Prospectos BI
// La base instalada leída como cartera de renovación: cuánto vale, qué tan
// vieja está y quién tiene equipos cerca del fin de su vida útil.
// Depende de: APP_DATA.prosp_bi (extractor.read_prospectos_bi)
// ═══════════════════════════════════════════════════════════════
(function () {
  const A = window.APP_DATA || {};
  const P = A.prosp_bi || {};
  if (!P.filas || !P.filas.length) return;

  const REG = P.regiones, LIN = P.lineas, TIP = P.tipos, CLI = P.clientes, EST = P.estados;
  const HOY_YM = P.hoy_ym;
  const VU = P.vida_util || 10;          // vida útil de referencia, en años

  // Índices de columna de cada fila, para que el código se lea solo.
  const cREG = 0, cLIN = 1, cTIP = 2, cCLI = 3, cEST = 4, cPOT = 5, cYM = 6, cVAL = 7,
        cNOM = 8, cFAB = 9, cMOD = 10, cSER = 11, cDIA = 12;
  const NOM = P.nombres || [], FAB = P.fabricantes || [],
        MOD = P.modelos || [], SER = P.series || [];

  // ── Estado de los segmentadores ─────────────────────────────
  let _pot = 'todos';        // 'todos' | 'si' | 'no'  ← Potencial ST, manda en toda la hoja
  let _vidaMin = 7;          // umbral de la herramienta de prospección
  let _pLinea = 'todas';
  let _pRegion = 'todas';
  let _metrica = 'n';        // 'n' = equipos · 'val' = valorización en $
  const _abReg = {}, _abLin = {}, _abCli = {};
  let _heatEje = 'linea';    // filas del mapa: 'linea' | 'region'
  let _heatLin = 'todas';    // filtro de línea del mapa
  let _chAging = null, _chLinea = null, _chReg = null, _chVent = null;

  // ── Utilidades ──────────────────────────────────────────────
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const mm = v => window.fmtMM ? fmtMM(v) : 'MM$' + (v / 1e6).toFixed(1);
  const n0 = v => Math.round(v || 0).toLocaleString('es-CL');
  const n1 = v => (+v || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Vida del equipo en años. null cuando la fila no trae fecha de instalación:
  // se distingue de «recién instalado» para no ensuciar los promedios.
  const vida = f => f[cYM] >= 0 ? (HOY_YM - f[cYM]) / 12 : null;
  // Fecha de instalación en formato chileno. El Excel no siempre trae el día;
  // cuando falta se muestra sólo mes y año en vez de inventar un 1.
  const fechaInst = f => {
    if (f[cYM] < 0) return '—';
    const a = Math.floor(f[cYM] / 12), m = (f[cYM] % 12) + 1;
    const p = n => (n < 10 ? '0' : '') + n;
    return (f[cDIA] ? p(f[cDIA]) + '/' : '') + p(m) + '/' + a;
  };

  const base = () => P.filas.filter(f =>
    _pot === 'todos' || (_pot === 'si' ? f[cPOT] === 1 : f[cPOT] === 0));

  // Acumulador común: todas las tablas de la hoja miden lo mismo.
  function acumula(filas, clave) {
    const g = {};
    filas.forEach(f => {
      const k = clave(f);
      const d = g[k] || (g[k] = {
        k: k, n: 0, nf: 0, vsum: 0, v7: 0, v10: 0, v5: 0,
        val: 0, valf: 0, val7: 0, val10: 0, cli: {}, nval: 0,
      });
      d.n++;
      d.val += f[cVAL];
      if (f[cVAL]) d.nval++;
      d.cli[f[cCLI]] = 1;
      const v = vida(f);
      if (v != null) {
        // valf: valorización sólo de los equipos con fecha. Es el universo
        // sobre el que tiene sentido hablar de vigente y vencida; el resto de
        // la base no se puede clasificar y se muestra aparte.
        d.nf++; d.vsum += v; d.valf += f[cVAL];
        if (v >= 5) d.v5++;
        if (v >= 7) { d.v7++; d.val7 += f[cVAL]; }
        if (v >= VU) { d.v10++; d.val10 += f[cVAL]; }
      }
    });
    return Object.keys(g).map(k => {
      const d = g[k];
      d.vida = d.nf ? d.vsum / d.nf : null;
      d.nCli = Object.keys(d.cli).length;
      // Vigente = con fecha y por debajo de la vida útil. Vencida = con fecha
      // y por encima. Sin fecha = no clasificable, ni vigente ni vencida.
      d.nVig   = d.nf - d.v10;
      d.valVig = d.valf - d.val10;
      d.nSin   = d.n - d.nf;
      d.valSin = d.val - d.valf;
      return d;
    }).sort((a, b) => b.val - a.val || b.n - a.n);
  }

  // ── Estructura de la hoja ───────────────────────────────────
  function markup() {
    return `
    <div class="sh"><h2>Prospectos BI</h2><div class="sh-line"></div>
      <span class="sh-tag">Base instalada como cartera de renovación ·
        <strong id="pb-tag">—</strong></span></div>

    <div class="card">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Potencial de ST</span>
        <div id="pb-pot" style="display:flex;gap:.25rem"></div>
        <span style="font-size:.56rem;color:var(--mut);margin-left:auto" id="pb-cob">—</span>
        <button id="pb-kpi-pdf" onclick="exportarPanel({ids:['pb-kpi'],titulo:'Prospectos BI · Indicadores',archivo:'Prospectos_BI_indicadores',btn:'pb-kpi-pdf'})" style="margin-left:.6rem;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
      </div>
      <div class="cb"><div id="pb-kpi" class="g5" style="grid-template-columns:repeat(5,1fr)"></div></div>
    </div>

    <div class="card" style="margin-top:.9rem">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Mapa de renovación</span>
        <span style="font-size:.56rem;color:var(--mut)">año en que cada equipo cumple ${VU} años</span>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                     margin-left:.6rem">Medir en</span>
        <div id="pb-met-heat" style="display:flex;gap:.25rem"></div>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                     margin-left:.4rem">Filas</span>
        <div id="pb-heat-eje" style="display:flex;gap:.25rem"></div>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                     margin-left:.4rem">Línea</span>
        <select id="pb-heat-lin" onchange="window._pbHeatLin(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
        <button id="pb-heat-pdf" onclick="exportarPanel({ids:['pb-heat'],titulo:'Prospectos BI · Mapa de renovación',archivo:'Prospectos_BI_mapa_renovacion',btn:'pb-heat-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
      </div>
      <div class="cb"><div id="pb-heat"></div></div>
    </div>

    <div class="g2" style="margin-top:.9rem;display:grid;grid-template-columns:1.15fr 1fr;gap:.9rem">
      <div class="card">
        <div class="ch" style="flex-wrap:wrap;gap:.4rem"><span class="ct">Antigüedad de la base instalada</span>
          <span style="font-size:.56rem;color:var(--mut)">equipos y valorización por tramo</span>
          <button id="pb-age-pdf" onclick="exportarPanel({ids:['pb-age-box'],titulo:'Prospectos BI · Antigüedad de la base instalada',archivo:'Prospectos_BI_antiguedad',btn:'pb-age-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button></div>
        <div class="cb"><div id="pb-age-box" style="position:relative;height:290px"><canvas id="cPbAging"></canvas></div></div>
      </div>
      <div class="card">
        <div class="ch" style="flex-wrap:wrap;gap:.4rem"><span class="ct">Ventana de renovación</span>
          <span style="font-size:.56rem;color:var(--mut)">cumple ${VU} años</span>
          <button id="pb-vent-pdf" onclick="exportarPanel({ids:['pb-vent-box'],titulo:'Prospectos BI · Ventana de renovación',archivo:'Prospectos_BI_ventana',btn:'pb-vent-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button></div>
        <div class="cb"><div id="pb-vent-box" style="position:relative;height:290px"><canvas id="cPbVent"></canvas></div></div>
      </div>
    </div>

    <div class="card" style="margin-top:.9rem">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem"><span class="ct">Base instalada por región</span>
        <span style="font-size:.56rem;color:var(--mut)" id="pb-reg-count">—</span>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                     margin-left:.4rem">Medir en</span>
        <div id="pb-met-reg" style="display:flex;gap:.25rem"></div>
        <button id="pb-reg-pdf" onclick="exportarPanel({ids:['pb-reg-tabla'],titulo:'Prospectos BI · Base Instalada por Región',archivo:'Prospectos_BI_por_region',btn:'pb-reg-pdf'})"
          style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
                 border-radius:4px;cursor:pointer;white-space:nowrap">Exportar</button></div>
      <div class="cb"><div id="pb-reg-tabla"></div></div>
    </div>

    <div class="g2" style="margin-top:.9rem;display:grid;grid-template-columns:1fr 1fr;gap:.9rem">
      <div class="card">
        <div class="ch"><span class="ct">Valorización por línea de negocio</span>
          <button id="pb-glin-pdf" onclick="exportarPanel({ids:['pb-glin-box'],titulo:'Prospectos BI · Valorización por línea',archivo:'Prospectos_BI_valorizacion_linea',btn:'pb-glin-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button></div>
        <div class="cb"><div id="pb-glin-box" style="position:relative;height:250px"><canvas id="cPbLinea"></canvas></div></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Valorización por región</span>
          <button id="pb-greg-pdf" onclick="exportarPanel({ids:['pb-greg-box'],titulo:'Prospectos BI · Valorización por región',archivo:'Prospectos_BI_valorizacion_region',btn:'pb-greg-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button></div>
        <div class="cb"><div id="pb-greg-box" style="position:relative;height:250px"><canvas id="cPbReg"></canvas></div></div>
      </div>
    </div>

    <div class="card" style="margin-top:.9rem">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem"><span class="ct">Base instalada por línea de negocio</span>
        <span style="font-size:.56rem;color:var(--mut)" id="pb-lin-count">—</span>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;
                     margin-left:.4rem">Medir en</span>
        <div id="pb-met-lin" style="display:flex;gap:.25rem"></div>
        <button id="pb-lin-pdf" onclick="exportarPanel({ids:['pb-lin-tabla'],titulo:'Prospectos BI · Base Instalada por Línea',archivo:'Prospectos_BI_por_linea',btn:'pb-lin-pdf'})"
          style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;
                 border-radius:4px;cursor:pointer;white-space:nowrap">Exportar</button></div>
      <div class="cb"><div id="pb-lin-tabla"></div></div>
    </div>

    <div class="sh" style="margin-top:1.5rem"><h2>Selector de prospectos</h2><div class="sh-line"></div>
      <span class="sh-tag">Clientes con equipos sobre el umbral de vida ·
        <strong id="pb-sel-tag">—</strong></span></div>

    <div class="card">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Filtros</span>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em"
              title="Años transcurridos entre la fecha de instalación del equipo y hoy">Antigüedad mínima del equipo</span>
        <div id="pb-vida" style="display:flex;gap:.25rem"></div>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-left:.4rem">Línea</span>
        <select id="pb-f-linea" onchange="window._pbLinea(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em">Región</span>
        <select id="pb-f-region" onchange="window._pbRegion(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
        <button onclick="window._pbLimpiar()" style="font-size:.57rem;padding:.2rem .55rem;border-radius:3px;
          cursor:pointer;border:1px solid var(--brd);background:var(--bg2);color:var(--mut)">Limpiar</button>
        <button id="pb-sel-pdf" onclick="exportarPanel({ids:['pb-sel-kpi','pb-sel-tabla'],titulo:'Prospectos BI · Selector de prospectos',archivo:'Prospectos_BI_seleccion',btn:'pb-sel-pdf'})" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;background:#002D73;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar</button>
      </div>
      <div class="cb">
        <p style="font-size:.6rem;color:var(--mut);margin:0 0 .8rem;line-height:1.6;
                  border-left:3px solid var(--az2);padding-left:.7rem">
          La <strong>antigüedad</strong> de un equipo son los años entre su fecha de instalación
          (columna «Fecha de Compra» del Excel) y hoy. El filtro deja pasar a los clientes que tengan
          <strong>al menos un equipo</strong> con esa antigüedad o más, y todas las cifras de la tabla
          se refieren sólo a esos equipos, no a todo el parque del cliente.
          Con la vida útil de referencia en ${VU} años, un umbral de 7 busca lo que va a
          necesitar reposición dentro de los próximos ${VU - 7}.
          <strong>Haz clic en un cliente</strong> para ver sus equipos uno a uno.</p>
        <div id="pb-sel-kpi" class="g5" style="grid-template-columns:repeat(4,1fr);margin-bottom:.9rem"></div>
        <div id="pb-sel-tabla"></div>
      </div>
    </div>`;
  }

  // ── Segmentador principal ───────────────────────────────────
  function botones(id, opts, activo, fn) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML = opts.map(o =>
      '<button onclick="' + fn + '(\'' + o[0] + '\')" style="font-size:.57rem;padding:.2rem .6rem;' +
      'border-radius:3px;cursor:pointer;white-space:nowrap;border:1px solid ' +
      (String(o[0]) === String(activo) ? 'var(--az2)' : 'var(--brd)') + ';background:' +
      (String(o[0]) === String(activo) ? 'var(--az2)' : 'var(--bg2)') + ';color:' +
      (String(o[0]) === String(activo) ? '#fff' : 'var(--txt)') + ';font-weight:' +
      (String(o[0]) === String(activo) ? 700 : 400) + '">' + esc(o[1]) + '</button>').join('');
  }

  window._pbPot = v => { if (_pot !== v) { _pot = v; render(); } };
  window._pbVida = v => { if (_vidaMin !== +v) { _vidaMin = +v; renderSelector(); } };
  window._pbLinea = v => { _pLinea = v; renderSelector(); };
  window._pbRegion = v => { _pRegion = v; renderSelector(); };
  // El mismo estado se ofrece en tres tarjetas distintas; cambiarlo en una
  // repinta las tres, para que no queden diciendo cosas distintas.
  function pintaMetrica() {
    const opts = [['n', 'N° de equipos'], ['val', 'Valorización $']];
    ['pb-met-heat', 'pb-met-reg', 'pb-met-lin']
      .forEach(id => botones(id, opts, _metrica, 'window._pbMetrica'));
  }
  window._pbMetrica = v => { if (_metrica !== v) { _metrica = v; render(); } };
  window._pbLimpiar = () => {
    _vidaMin = 7; _pLinea = 'todas'; _pRegion = 'todas';
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    s('pb-f-linea', 'todas'); s('pb-f-region', 'todas');
    renderSelector();
  };
  window._pbTogReg = k => { _abReg[k] = !_abReg[k]; tablaRegion(); };
  window._pbTogLin = k => { _abLin[k] = !_abLin[k]; tablaLinea(); };
  window._pbTogCli = k => { _abCli[k] = !_abCli[k]; renderSelector(); };
  window._pbHeatEje = v => { if (_heatEje !== v) { _heatEje = v; heatmap(); } };
  window._pbHeatLin = v => { _heatLin = v; heatmap(); };

  // ── KPIs de cabecera ────────────────────────────────────────
  function kpis(filas) {
    const box = document.getElementById('pb-kpi');
    if (!box) return;
    const t = acumula(filas, () => 'x')[0] || { n: 0, val: 0, vida: null, v10: 0, val10: 0, nf: 0, nval: 0 };
    const card = (lbl, val, sub, col) =>
      '<div class="kpi" style="border-top:3px solid ' + col + '">' +
        '<div class="kl">' + lbl + '</div>' +
        '<div class="kv" style="color:' + col + '">' + val + '</div>' +
        '<div class="ks">' + sub + '</div></div>';
    box.innerHTML =
      card('Equipos en la BI', n0(t.n), t.nCli + ' clientes', 'var(--az1)') +
      card('Valorización', mm(t.val), n0(t.nval) + ' equipos valorizados', 'var(--teal)') +
      card('Vida media', t.vida != null ? n1(t.vida) + ' años' : '—',
           'sobre ' + n0(t.nf) + ' con fecha', 'var(--am)') +
      card('Sobre ' + VU + ' años', n0(t.v10),
           (t.nf ? (t.v10 / t.nf * 100).toFixed(0) : 0) + '% de los que tienen fecha', 'var(--rd)') +
      card('Valor a renovar', mm(t.val10), 'equipos que ya cumplieron su vida útil', 'var(--or)');

    const cob = document.getElementById('pb-cob');
    if (cob) {
      cob.innerHTML = 'Cobertura del dato: <strong>' + (t.n ? (t.nf / t.n * 100).toFixed(0) : 0) +
        '%</strong> con fecha de instalación · <strong>' +
        (t.n ? (t.nval / t.n * 100).toFixed(0) : 0) + '%</strong> con valorización';
    }
    const tag = document.getElementById('pb-tag');
    if (tag) tag.textContent = _pot === 'todos' ? 'toda la base instalada'
      : _pot === 'si' ? 'sólo equipos con Potencial de ST' : 'sólo equipos sin Potencial de ST';
  }

  // ── Curva de antigüedad ─────────────────────────────────────
  const TRAMOS = [
    { k: '0 a 3 años',   min: 0,  max: 3,   col: '#00832F' },
    { k: '3 a 5 años',   min: 3,  max: 5,   col: '#5AA02C' },
    { k: '5 a 7 años',   min: 5,  max: 7,   col: '#C9A227' },
    { k: '7 a 10 años',  min: 7,  max: VU,  col: '#D46000' },
    { k: VU + ' años o más', min: VU, max: 1e9, col: '#C00000' },
  ];

  function chartAging(filas) {
    const ctx = document.getElementById('cPbAging');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_chAging) { _chAging.destroy(); _chAging = null; }
    const eq = TRAMOS.map(() => 0), val = TRAMOS.map(() => 0);
    filas.forEach(f => {
      const v = vida(f);
      if (v == null) return;
      for (let i = 0; i < TRAMOS.length; i++) {
        if (v >= TRAMOS[i].min && v < TRAMOS[i].max) { eq[i]++; val[i] += f[cVAL]; break; }
      }
    });
    _chAging = new Chart(ctx.getContext('2d'), {
      data: {
        labels: TRAMOS.map(t => t.k),
        datasets: [
          { type: 'bar', label: 'Equipos', data: eq, yAxisID: 'y',
            backgroundColor: TRAMOS.map(t => t.col + 'CC'), borderRadius: 3, order: 2 },
          { type: 'line', label: 'Valorización', data: val, yAxisID: 'y2',
            borderColor: '#002D73', backgroundColor: '#002D7322', borderWidth: 2,
            pointRadius: 3, tension: .25, fill: true, order: 1 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
          tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y2'
            ? 'Valorización: ' + mm(c.raw) : 'Equipos: ' + n0(c.raw) } },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E2E6F033' }, ticks: { font: { size: 8 } },
               title: { display: true, text: 'Equipos', font: { size: 8 }, color: '#6B7BA8' } },
          y2: { position: 'right', beginAtZero: true, grid: { display: false },
                ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
                title: { display: true, text: 'MM$', font: { size: 8 }, color: '#002D73' } },
          x: { grid: { display: false }, ticks: { font: { size: 8.5 } } },
        },
      },
    });
  }

  // ── Ventana de renovación: cuándo cumple sus 10 años cada equipo ──
  function chartVentana(filas) {
    const ctx = document.getElementById('cPbVent');
    if (!ctx || typeof Chart === 'undefined') return;
    if (_chVent) { _chVent.destroy(); _chVent = null; }
    const anioHoy = Math.floor(HOY_YM / 12);
    const g = {};
    filas.forEach(f => {
      if (f[cYM] < 0) return;
      // Año calendario en que el equipo cumple la vida útil de referencia.
      const a = Math.floor((f[cYM] + VU * 12) / 12);
      const k = a <= anioHoy ? 'Ya cumplida' : (a > anioHoy + 5 ? 'Más de 5 años' : String(a));
      const d = g[k] || (g[k] = { n: 0, val: 0 });
      d.n++; d.val += f[cVAL];
    });
    const orden = ['Ya cumplida'].concat(
      Array.from({ length: 5 }, (_, i) => String(anioHoy + 1 + i))).concat(['Más de 5 años']);
    const labels = orden.filter(k => g[k]);
    if (!labels.length) return;
    _chVent = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Valorización a renovar', data: labels.map(k => g[k].val),
          backgroundColor: labels.map(k => k === 'Ya cumplida' ? '#C00000CC' : '#0A5C8CCC'),
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: c => mm(c.raw),
            afterLabel: c => n0(g[labels[c.dataIndex]].n) + ' equipos',
          } },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
               title: { display: true, text: 'MM$', font: { size: 8 }, color: '#6B7BA8' } },
          x: { grid: { display: false }, ticks: { font: { size: 8.5 } } },
        },
      },
    });
  }

  // ── Mapa de calor de la ventana de renovación ────────────────
  // Filas: línea de negocio o región. Columnas: el año en que el equipo cumple
  // la vida útil. La lectura es el COLOR: la mancha muestra dónde se concentra
  // lo que hay que renovar, y el número es el detalle que se busca después.
  //
  // Rampa secuencial de un solo tono (naranjo), clara → oscura, con lightness
  // monótona: eso es lo que hace que el ojo ordene los valores sin leerlos. Una
  // rampa arcoíris se ve más "de calor" pero no tiene orden perceptual.
  const HEAT_RAMPA = ['#FFF3E6', '#FBDCBB', '#F4BE8A', '#E89A56',
                      '#D1712A', '#A64B0E', '#6E2E02'];
  // Sobre este punto de la rampa el texto negro deja de leerse (contraste
  // calculado, no a ojo): de ahí en adelante va en blanco.
  const HEAT_INV = 0.72;

  function heatColor(t) {
    if (!(t > 0)) return 'var(--bg2)';
    const x = Math.min(1, Math.max(0, t)) * (HEAT_RAMPA.length - 1);
    const i = Math.min(HEAT_RAMPA.length - 2, Math.floor(x)), r = x - i;
    const hx = c => [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16),
                     parseInt(c.substr(5, 2), 16)];
    const a = hx(HEAT_RAMPA[i]), b = hx(HEAT_RAMPA[i + 1]);
    return 'rgb(' + a.map((v, k) => Math.round(v + (b[k] - v) * r)).join(',') + ')';
  }

  // La escala se comprime con raíz cuadrada: sin eso, una celda enorme aplasta
  // al resto del mapa a un beige indistinguible y se pierde toda la lectura.
  const heatT = (v, max) => max > 0 ? Math.sqrt(Math.max(0, v) / max) : 0;

  function heatTip(ev, txt) {
    let t = document.getElementById('pb-heat-tip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pb-heat-tip';
      t.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;display:none;' +
        'background:#1e2434;border:1px solid #3a4460;border-radius:6px;padding:.45rem .6rem;' +
        'font-family:Roboto,sans-serif;font-size:.62rem;color:#fff;white-space:pre-line;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.45);max-width:260px';
      document.body.appendChild(t);
    }
    if (!txt) { t.style.display = 'none'; return; }
    // textContent y no innerHTML: los nombres de línea y región vienen del
    // Excel y no son texto de confianza.
    t.textContent = txt;
    t.style.display = 'block';
    t.style.left = Math.min(ev.clientX + 14, window.innerWidth - 280) + 'px';
    t.style.top = Math.min(ev.clientY + 12, window.innerHeight - 90) + 'px';
  }

  function heatmap() {
    const box = document.getElementById('pb-heat');
    if (!box) return;
    pintaMetrica();
    botones('pb-heat-eje', [['linea', 'Línea de negocio'], ['region', 'Región']],
            _heatEje, 'window._pbHeatEje');
    const selL = document.getElementById('pb-heat-lin');
    if (selL) {
      selL.innerHTML = [['todas', 'Todas']].concat(LIN.slice().sort().map(l => [l, l]))
        .map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === _heatLin ? ' selected' : '') +
             '>' + esc(o[1]) + '</option>').join('');
    }

    const anioHoy = Math.floor(HOY_YM / 12);
    const N_ANIOS = 8;
    const cols = [{ k: 'venc', lbl: 'Vencida' }].concat(
      Array.from({ length: N_ANIOS }, (_, i) => ({ k: String(anioHoy + i), lbl: String(anioHoy + i) })));

    const filas = base().filter(f =>
      f[cYM] >= 0 && (_heatLin === 'todas' || LIN[f[cLIN]] === _heatLin));
    const eje = f => _heatEje === 'linea' ? LIN[f[cLIN]] : REG[f[cREG]];

    const g = {};
    filas.forEach(f => {
      const a = Math.floor((f[cYM] + VU * 12) / 12);
      // Lo que vence más allá de la ventana queda fuera: son equipos nuevos, no
      // cartera de renovación de los próximos años.
      const k = a < anioHoy ? 'venc' : (a >= anioHoy + N_ANIOS ? null : String(a));
      if (k === null) return;
      const r = eje(f);
      const d = g[r] || (g[r] = { tot: 0, c: {} });
      const v = esVal() ? f[cVAL] : 1;
      d.tot += v;
      d.c[k] = (d.c[k] || 0) + v;
    });

    const rows = Object.keys(g).sort((a, b) => g[b].tot - g[a].tot);
    if (!rows.length) {
      box.innerHTML = '<div style="padding:1.4rem;text-align:center;color:var(--mut);font-size:.68rem">' +
        'Sin equipos con fecha de instalación para estos filtros.</div>';
      return;
    }
    let max = 0;
    rows.forEach(r => cols.forEach(c => { max = Math.max(max, g[r].c[c.k] || 0); }));
    const totCol = {};
    cols.forEach(c => { totCol[c.k] = rows.reduce((a, r) => a + (g[r].c[c.k] || 0), 0); });
    const granTot = rows.reduce((a, r) => a + g[r].tot, 0);

    // Encabezados: el año, y la columna de vencidos marcada aparte porque no es
    // un año futuro sino todo lo que ya se pasó.
    const thHead = (lbl, esVenc) =>
      '<th style="padding:.2rem .3rem .35rem;text-align:center;font-size:.57rem;font-weight:600;' +
      'letter-spacing:.03em;color:' + (esVenc ? 'var(--rd)' : 'var(--mut)') + ';white-space:nowrap">' +
      lbl + '</th>';

    const celdas = rows.map(r =>
      '<tr>' +
      '<td style="padding:0 .5rem 0 0;font-size:.63rem;font-weight:600;white-space:nowrap;' +
        'max-width:150px;overflow:hidden;text-overflow:ellipsis;color:var(--txt)" title="' +
        esc(r) + '">' + esc(r) + '</td>' +
      cols.map(c => {
        const v = g[r].c[c.k] || 0;
        const t = heatT(v, max);
        const fg = !v ? 'transparent' : (t >= HEAT_INV ? '#fff' : '#3A2A18');
        return '<td class="pb-hc" data-r="' + esc(r) + '" data-c="' + esc(c.lbl) + '" ' +
          'data-v="' + v + '" style="height:30px;padding:0;text-align:center;font-size:.57rem;' +
          'font-variant-numeric:tabular-nums;border-radius:2px;cursor:default;' +
          'background:' + heatColor(t) + ';color:' + fg + '">' +
          // El número sólo donde aporta: en las celdas pálidas compite con el
          // color y ensucia la mancha. El valor exacto está en el hover.
          (t >= 0.28 ? fMet(v) : '') + '</td>';
      }).join('') +
      '<td style="padding:0 0 0 .55rem;text-align:right;font-size:.62rem;font-weight:700;' +
        'white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--az1)">' +
        fMet(g[r].tot) + '</td>' +
      '</tr>').join('');

    box.innerHTML =
      '<div style="overflow-x:auto">' +
      '<table style="border-collapse:separate;border-spacing:2px;width:100%;min-width:760px">' +
      '<thead><tr><th></th>' + cols.map(c => thHead(c.lbl, c.k === 'venc')).join('') +
      '<th style="padding:.2rem 0 .35rem .55rem;text-align:right;font-size:.57rem;font-weight:600;' +
        'letter-spacing:.03em;color:var(--az1)">TOTAL</th></tr></thead>' +
      '<tbody>' + celdas + '</tbody>' +
      '<tfoot><tr>' +
      '<td style="padding:.35rem .5rem 0 0;font-size:.6rem;font-weight:700;color:var(--mut)">TOTAL</td>' +
      cols.map(c => '<td style="padding:.35rem .2rem 0;text-align:center;font-size:.59rem;' +
        'font-weight:700;font-variant-numeric:tabular-nums;color:var(--txt)">' +
        (totCol[c.k] ? fMet(totCol[c.k]) : '·') + '</td>').join('') +
      '<td style="padding:.35rem 0 0 .55rem;text-align:right;font-size:.6rem;font-weight:700;' +
        'font-variant-numeric:tabular-nums;color:var(--az1)">' + fMet(granTot) + '</td>' +
      '</tr></tfoot></table></div>' +
      // Leyenda continua: la rampa completa, no seis parches sueltos.
      '<div style="display:flex;align-items:center;gap:.5rem;margin-top:.75rem;font-size:.56rem;' +
        'color:var(--mut)">' +
        '<span>0</span>' +
        '<span style="flex:0 0 190px;height:11px;border-radius:3px;background:linear-gradient(90deg,' +
          HEAT_RAMPA.join(',') + ')"></span>' +
        '<span>' + fMet(max) + ' (celda más alta)</span>' +
        '<span style="margin-left:auto;font-style:italic">pasa el cursor por una celda para el detalle</span>' +
      '</div>' +
      '<p style="font-size:.57rem;color:var(--mut);margin:.55rem 0 0;line-height:1.55">' +
      'Cada equipo cae en el año en que cumple sus ' + VU + ' años de vida útil; los que ya lo hicieron ' +
      'quedan en «Vencida». El color compara contra la celda más alta del propio mapa —dice dónde está ' +
      'la concentración, no un monto absoluto— y la escala va comprimida en raíz cuadrada para que una ' +
      'celda muy grande no aplaste al resto. Sólo entran equipos con fecha de instalación; lo que vence ' +
      'después de ' + (anioHoy + N_ANIOS - 1) + ' queda fuera de la ventana.</p>';

    // Hover por celda: el número exacto y el contexto, sin cargar el mapa.
    box.querySelectorAll('.pb-hc').forEach(td => {
      td.addEventListener('pointermove', ev => {
        const v = +td.dataset.v || 0;
        heatTip(ev, td.dataset.r + '\n' + td.dataset.c + ': ' + (v ? fMet(v) : 'sin equipos') +
          (v && granTot ? '\n' + (v / granTot * 100).toFixed(1).replace('.', ',') +
            '% de la ventana' : ''));
        td.style.outline = '2px solid var(--az1)';
        td.style.outlineOffset = '-2px';
      });
      td.addEventListener('pointerleave', () => { heatTip(null, ''); td.style.outline = 'none'; });
    });
  }

  // ── Gráficos de barras horizontales ─────────────────────────
  function chartBarras(idCanvas, datos, color, ref) {
    const ctx = document.getElementById(idCanvas);
    if (!ctx || typeof Chart === 'undefined') return null;
    if (ref) ref.destroy();
    const top = datos.slice(0, 10);
    if (!top.length) return null;
    return new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top.map(d => d.k),
        datasets: [
          { label: 'Valorización total', data: top.map(d => d.val),
            backgroundColor: color + '99', borderRadius: 3 },
          { label: 'De equipos sobre ' + VU + ' años', data: top.map(d => d.val10),
            backgroundColor: '#C00000CC', borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: {
          x: { stacked: false, beginAtZero: true, grid: { color: '#E2E6F033' },
               ticks: { font: { size: 8 }, callback: v => Math.round(v / 1e6) },
               title: { display: true, text: 'MM$', font: { size: 8 }, color: '#6B7BA8' } },
          y: { grid: { display: false }, ticks: { font: { size: 8 } } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 8.5 } } },
          tooltip: { callbacks: {
            label: c => c.dataset.label + ': ' + mm(c.raw),
            afterLabel: c => n0(top[c.dataIndex].n) + ' equipos · vida media ' +
              (top[c.dataIndex].vida != null ? n1(top[c.dataIndex].vida) + ' años' : 's/d'),
          } },
        },
      },
    });
  }

  // ── Tablas jerárquicas ──────────────────────────────────────
  const SEP = 'border-right:1px solid var(--brd)';
  const TD = 'padding:.34rem .6rem;white-space:nowrap';
  const th = (t, al) => '<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;' +
    'padding:.4rem .6rem;font-size:.58rem;letter-spacing:.04em;text-align:' + (al || 'left') +
    ';white-space:nowrap;' + SEP + '">' + t + '</th>';
  const num = (v, extra) => '<td style="' + TD + ';text-align:right;font-size:.64rem;' +
    'font-variant-numeric:tabular-nums;' + (extra || '') + SEP + '">' + v + '</td>';
  // El color de la vida media dice de un vistazo si el parque está por vencer.
  const colVida = v => v == null ? 'var(--mut)'
    : v >= VU ? 'var(--rd)' : v >= 7 ? 'var(--or)' : v >= 5 ? 'var(--am)' : 'var(--gn)';
  // Las tablas muestran lo mismo medido en equipos o en pesos: el segmentador
  // cambia de qué campo se leen las columnas, no la estructura de la tabla.
  const esVal = () => _metrica === 'val';
  const fMet = v => esVal() ? mm(v) : n0(v);
  const mVig = d => esVal() ? d.valVig : d.nVig;
  const mVen = d => esVal() ? d.val10 : d.v10;
  const mTot = d => esVal() ? d.val : d.n;
  const mSin = d => esVal() ? d.valSin : d.nSin;
  // Proporción vencida dentro de lo clasificable (vigente + vencida): decir
  // «% de la BI total» sería engañoso cuando dos tercios no tienen fecha.
  const pctVenNum = d => (mVig(d) + mVen(d)) ? mVen(d) / (mVig(d) + mVen(d)) * 100 : null;
  const pctVen = d => { const p = pctVenNum(d); return p == null ? '—' : p.toFixed(0) + '%'; };

  function tablaJerarquica(cfg) {
    const box = document.getElementById(cfg.box);
    if (!box) return;
    const filas = base();
    const D = acumula(filas, cfg.clave);
    // El % del total se calcula sobre la misma métrica que se está mostrando.
    const total = filas.reduce((a, f) => a + (esVal() ? f[cVAL] : 1), 0);

    let html = '<div style="overflow-x:auto;max-height:480px;overflow-y:auto">' +
      '<table style="width:100%;border-collapse:collapse;min-width:960px;table-layout:fixed"><colgroup>' +
      '<col style="width:24%"><col style="width:9%"><col style="width:12%"><col style="width:12%">' +
      '<col style="width:12%"><col style="width:11%"><col style="width:10%"><col style="width:10%">' +
      '</colgroup><thead><tr>' +
      th(cfg.titulo) + th('CLIENTES', 'right') +
      th('BI VIGENTE', 'right') + th('BI VENCIDA', 'right') + th('BI TOTAL', 'right') +
      th('VIDA MEDIA', 'right') + th('% DEL TOTAL', 'right') + th('% VENCIDA', 'right') +
      '</tr></thead><tbody>';

    D.forEach((d, i) => {
      const ab = !!cfg.abiertas[d.k];
      const hijos = acumula(filas.filter(f => cfg.clave(f) === d.k), cfg.claveHijo);
      html += '<tr onclick="' + cfg.toggle + '(' + JSON.stringify(d.k).replace(/"/g, '&quot;') + ')" ' +
        'style="cursor:pointer;background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD + ';font-size:.68rem;font-weight:700;color:var(--am);overflow:hidden;' +
          'text-overflow:ellipsis;' + SEP + '"><span style="display:inline-block;width:11px;color:var(--mut)">' +
          (ab ? '▾' : '▸') + '</span>' + esc(d.k) + '</td>' +
        num(n0(d.nCli)) +
        num(fMet(mVig(d)), 'font-weight:700;color:var(--gn);') +
        num(fMet(mVen(d)), mVen(d) ? 'font-weight:700;color:var(--rd);' : 'color:var(--mut);') +
        num(fMet(mTot(d)), 'font-weight:700;color:var(--az1);') +
        num(d.vida != null ? n1(d.vida) + ' a' : '—', 'font-weight:700;color:' + colVida(d.vida) + ';') +
        num(total ? (mTot(d) / total * 100).toFixed(1).replace('.', ',') + '%' : '—', 'color:var(--mut);') +
        num(pctVen(d), 'color:' + (pctVenNum(d) > 30 ? 'var(--rd)' : 'var(--mut)') + ';') +
        '</tr>';
      if (ab) {
        hijos.forEach(h => {
          html += '<tr style="background:var(--gy)">' +
            '<td style="' + TD + ';font-size:.62rem;padding-left:1.9rem;overflow:hidden;' +
              'text-overflow:ellipsis;' + SEP + '" title="' + esc(h.k) + '">' + esc(h.k) + '</td>' +
            num(n0(h.nCli)) +
            num(fMet(mVig(h)), 'color:var(--gn);') +
            num(fMet(mVen(h)), mVen(h) ? 'color:var(--rd);' : 'color:var(--mut);') +
            num(fMet(mTot(h)), 'color:var(--az2);') +
            num(h.vida != null ? n1(h.vida) + ' a' : '—', 'color:' + colVida(h.vida) + ';') +
            num(total ? (mTot(h) / total * 100).toFixed(1).replace('.', ',') + '%' : '—', 'color:var(--mut);') +
            num(pctVen(h), 'color:var(--mut);') +
            '</tr>';
        });
      }
    });

    const T = acumula(filas, () => 'x')[0] || { n: 0, nCli: 0, nf: 0, vida: null, v10: 0, val: 0, val10: 0 };
    html += '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.4rem .6rem;font-size:.64rem;' + SEP + '">TOTAL · ' + D.length + ' ' + cfg.unidad + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + n0(T.nCli) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + fMet(mVig(T)) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + fMet(mVen(T)) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + fMet(mTot(T)) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' +
        (T.vida != null ? n1(T.vida) + ' a' : '—') + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">100%</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem">' + pctVen(T) + '</td>' +
      '</tr></tfoot></table></div>' +
      '<p style="font-size:.57rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      '<strong>BI vigente</strong> son los equipos que todavía no cumplen los ' + VU + ' años de vida útil ' +
      'de referencia y <strong>BI vencida</strong> los que ya los cumplieron. Ambas se calculan sólo sobre ' +
      'los equipos con fecha de instalación, así que <strong>no suman la BI total</strong>: el resto son ' +
      'equipos sin fecha en el Excel, que no se pueden clasificar y no se reparten entre las otras dos. ' +
      'Por lo mismo el <strong>% vencida</strong> se calcula sobre lo clasificable (vigente + vencida) y no ' +
      'sobre la BI total. La <strong>vida media</strong> corre sobre ese mismo universo con fecha. ' +
      'El segmentador «Medir en» cambia estas columnas entre número de equipos y valorización en pesos.</p>';

    box.innerHTML = html;
    const c = document.getElementById(cfg.count);
    if (c) c.textContent = D.length + ' ' + cfg.unidad;
  }

  const tablaRegion = () => tablaJerarquica({
    box: 'pb-reg-tabla', count: 'pb-reg-count', titulo: 'REGIÓN / LÍNEA', unidad: 'regiones',
    clave: f => REG[f[cREG]], claveHijo: f => LIN[f[cLIN]],
    abiertas: _abReg, toggle: 'window._pbTogReg',
  });
  const tablaLinea = () => tablaJerarquica({
    box: 'pb-lin-tabla', count: 'pb-lin-count', titulo: 'LÍNEA / TIPO DE EQUIPO', unidad: 'líneas',
    clave: f => LIN[f[cLIN]], claveHijo: f => TIP[f[cTIP]],
    abiertas: _abLin, toggle: 'window._pbTogLin',
  });

  // ── Selector de prospectos ──────────────────────────────────
  function poblarFiltros() {
    const sel = (id, opts, val) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.innerHTML = opts.map(o => '<option value="' + esc(o[0]) + '"' +
        (o[0] === val ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
    };
    sel('pb-f-linea', [['todas', 'Todas']].concat(LIN.slice().sort().map(l => [l, l])), _pLinea);
    sel('pb-f-region', [['todas', 'Todas']].concat(REG.slice().sort().map(r => [r, r])), _pRegion);
    botones('pb-vida', [[5, '5+ años'], [7, '7+ años'], [8, '8+ años'],
                        [10, '10+ años'], [12, '12+ años']], _vidaMin, 'window._pbVida');
  }

  function renderSelector() {
    poblarFiltros();
    // Sólo entran equipos con fecha: sin fecha no se puede afirmar la vida, y
    // meterlos como «desconocidos» inflaría el potencial con humo.
    const filas = base().filter(f => {
      const v = vida(f);
      if (v == null || v < _vidaMin) return false;
      if (_pLinea !== 'todas' && LIN[f[cLIN]] !== _pLinea) return false;
      if (_pRegion !== 'todas' && REG[f[cREG]] !== _pRegion) return false;
      return true;
    });

    const T = acumula(filas, () => 'x')[0] || { n: 0, nCli: 0, val: 0, vida: null };
    const box = document.getElementById('pb-sel-kpi');
    const card = (lbl, val, sub, col) =>
      '<div class="kpi" style="border-top:3px solid ' + col + '">' +
        '<div class="kl">' + lbl + '</div><div class="kv" style="color:' + col + '">' + val + '</div>' +
        '<div class="ks">' + sub + '</div></div>';
    if (box) {
      box.innerHTML =
        card('Clientes prospectables', n0(T.nCli), 'con al menos un equipo sobre el umbral', 'var(--az1)') +
        card('Equipos', n0(T.n), 'vida ≥ ' + _vidaMin + ' años', 'var(--am)') +
        card('Valorización', mm(T.val), 'valor de reposición del parque', 'var(--teal)') +
        card('Vida media', T.vida != null ? n1(T.vida) + ' años' : '—',
             'de los equipos seleccionados', 'var(--or)');
    }

    const tag = document.getElementById('pb-sel-tag');
    if (tag) {
      tag.textContent = 'vida ≥ ' + _vidaMin + ' años' +
        (_pLinea !== 'todas' ? ' · ' + _pLinea : '') +
        (_pRegion !== 'todas' ? ' · ' + _pRegion : '');
    }

    const tb = document.getElementById('pb-sel-tabla');
    if (!tb) return;
    if (!filas.length) {
      tb.innerHTML = '<div style="padding:1.4rem;text-align:center;color:var(--mut);font-size:.68rem">' +
        'Ningún equipo cumple estos filtros.</div>';
      return;
    }
    const D = acumula(filas, f => CLI[f[cCLI]]);
    const totalSel = T.val;

    let html = '<div style="overflow-x:auto;max-height:520px;overflow-y:auto">' +
      '<table style="width:100%;border-collapse:collapse;min-width:940px;table-layout:fixed"><colgroup>' +
      '<col style="width:32%"><col style="width:8%"><col style="width:10%"><col style="width:10%">' +
      '<col style="width:12%"><col style="width:14%"><col style="width:14%">' +
      '</colgroup><thead><tr>' +
      th('CLIENTE') + th('EQUIPOS', 'right') + th('ANTIGÜEDAD MEDIA', 'right') +
      th('MÁS ANTIGUO', 'right') + th('LÍNEAS') + th('VALORIZACIÓN', 'right') + th('% DEL TOTAL', 'right') +
      '</tr></thead><tbody>';

    D.forEach((d, i) => {
      const propias = filas.filter(f => CLI[f[cCLI]] === d.k);
      const maxV = Math.max.apply(null, propias.map(f => vida(f) || 0));
      const ls = {};
      propias.forEach(f => { ls[LIN[f[cLIN]]] = (ls[LIN[f[cLIN]]] || 0) + 1; });
      const lsTxt = Object.keys(ls).sort((a, b) => ls[b] - ls[a])
        .map(l => l + ' (' + ls[l] + ')').join(', ');
      const ab = !!_abCli[d.k];
      html += '<tr onclick="window._pbTogCli(' + JSON.stringify(d.k).replace(/"/g, '&quot;') + ')" ' +
        'style="cursor:pointer;background:' + (i % 2 ? 'var(--bg)' : 'var(--bg2)') + '">' +
        '<td style="' + TD + ';font-size:.65rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;' +
          SEP + '" title="' + esc(d.k) + '">' +
          '<span style="display:inline-block;width:11px;color:var(--mut)">' + (ab ? '▾' : '▸') + '</span>' +
          esc(d.k) + '</td>' +
        num(n0(d.n), 'font-weight:700;') +
        num(d.vida != null ? n1(d.vida) + ' a' : '—', 'color:' + colVida(d.vida) + ';font-weight:700;') +
        num(n1(maxV) + ' a', 'color:' + colVida(maxV) + ';') +
        '<td style="' + TD + ';font-size:.58rem;color:var(--mut);overflow:hidden;text-overflow:ellipsis;' +
          SEP + '" title="' + esc(lsTxt) + '">' + esc(lsTxt) + '</td>' +
        num(mm(d.val), 'font-weight:700;color:var(--az1);') +
        num(totalSel ? (d.val / totalSel * 100).toFixed(1).replace('.', ',') + '%' : '—', 'color:var(--mut);') +
        '</tr>';

      if (ab) {
        // Detalle equipo por equipo: lo que el ejecutivo necesita para salir a
        // visitar. Se ordena del más antiguo al más nuevo, que es el orden en
        // que conviene atacarlos.
        html += '<tr><td colspan="7" style="padding:0;background:var(--gy)">' +
          '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
          [['EQUIPO', 'left'], ['MARCA / MODELO', 'left'], ['N° SERIE', 'left'], ['LÍNEA', 'left'],
           ['REGIÓN', 'left'], ['ESTADO', 'left'], ['INSTALADO', 'right'], ['ANTIGÜEDAD', 'right'],
           ['VALORIZACIÓN', 'right']].map(h =>
            '<th style="padding:.24rem .6rem;font-size:.53rem;letter-spacing:.04em;color:var(--mut);' +
            'text-align:' + h[1] + ';border-bottom:1px solid var(--brd);white-space:nowrap">' +
            h[0] + '</th>').join('') + '</tr></thead><tbody>' +
          propias.slice().sort((a, b) => (vida(b) || 0) - (vida(a) || 0)).map(f => {
            const v = vida(f);
            const td2 = (c, al, st) => '<td style="padding:.24rem .6rem;font-size:.58rem;text-align:' +
              (al || 'left') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
              (st || '') + '">' + c + '</td>';
            const marcaMod = [FAB[f[cFAB]], MOD[f[cMOD]]].filter(Boolean).join(' ');
            return '<tr>' +
              td2(esc(NOM[f[cNOM]] || TIP[f[cTIP]]), 'left', 'font-weight:600') +
              td2(esc(marcaMod) || '—', 'left', 'color:var(--mut)') +
              td2(esc(SER[f[cSER]]) || '—', 'left',
                  "font-family:'Roboto Mono',monospace;font-size:.55rem;color:var(--mut)") +
              td2(esc(LIN[f[cLIN]]), 'left', 'color:var(--mut)') +
              td2(esc(REG[f[cREG]]), 'left', 'color:var(--mut)') +
              td2(esc(EST[f[cEST]]), 'left', 'color:var(--mut)') +
              td2(fechaInst(f), 'right', "font-family:'Roboto Mono',monospace;font-size:.55rem") +
              td2(v != null ? n1(v) + ' a' : '—', 'right',
                  'font-weight:700;color:' + colVida(v)) +
              td2(f[cVAL] ? mm(f[cVAL]) : '<span style="color:var(--mut)">sin valorizar</span>',
                  'right', 'font-variant-numeric:tabular-nums');
          }).join('</tr>') + '</tr></tbody></table></td></tr>';
      }
    });

    html += '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td style="padding:.4rem .6rem;font-size:.64rem;' + SEP + '">TOTAL · ' + D.length + ' clientes</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + n0(T.n) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' +
        (T.vida != null ? n1(T.vida) + ' a' : '—') + '</td>' +
      '<td style="' + SEP + '"></td><td style="' + SEP + '"></td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem;' + SEP + '">' + mm(T.val) + '</td>' +
      '<td style="padding:.4rem .6rem;text-align:right;font-size:.64rem">100%</td>' +
      '</tr></tfoot></table></div>' +
      '<p style="font-size:.57rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      'Sólo entran equipos <strong>con fecha de instalación</strong>: sin ella no se puede afirmar la vida ' +
      'del equipo, y contarlos como candidatos inflaría el potencial. La valorización de la columna ' +
      'corresponde a los equipos seleccionados, no a todo el parque del cliente. ' +
      'La vida útil de referencia son ' + VU + ' años. ' +
      '<strong>Haz clic en un cliente</strong> para desplegar sus equipos con marca, modelo, número de ' +
      'serie, fecha de instalación y antigüedad, ordenados del más antiguo al más nuevo.</p>';
    tb.innerHTML = html;
  }

  // ── Exportables ─────────────────────────────────────────────
  window.pbExportPDF = async function (idBox, nombre) {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
      return;
    }
    let wrap = null;
    try {
      const src = document.getElementById(idBox);
      if (!src) throw new Error('No se encontró el contenido');
      const hoy = A.hoy || '';
      wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1240px;' +
        'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
      const enc = document.createElement('div');
      enc.style.cssText = 'border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px';
      enc.innerHTML = '<span style="font-size:15px;font-weight:700;color:#002D73">' +
        'TECSERVICE — Prospectos BI</span>&emsp;<span style="font-size:10px;color:#555">' +
        (_pot === 'todos' ? 'toda la base instalada' :
         _pot === 'si' ? 'con Potencial de ST' : 'sin Potencial de ST') +
        (hoy ? ' · datos al ' + hoy : '') + '</span>';
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
      await hdEntregar(canvas, nombre + '_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                       realW * MM_PX, realH * MM_PX);
    } catch (err) {
      console.error('pbExportPDF:', err);
      alert('Error al generar: ' + err.message);
    } finally {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
  };

  // ── Render completo ─────────────────────────────────────────
  function render() {
    botones('pb-pot', [['todos', 'Todos'], ['si', 'Con potencial'], ['no', 'Sin potencial']],
            _pot, 'window._pbPot');
    pintaMetrica();
    const filas = base();
    kpis(filas);
    heatmap();
    chartAging(filas);
    chartVentana(filas);
    tablaRegion();
    tablaLinea();
    _chLinea = chartBarras('cPbLinea', acumula(filas, f => LIN[f[cLIN]]), '#002D73', _chLinea);
    _chReg = chartBarras('cPbReg', acumula(filas, f => REG[f[cREG]]), '#0A7D74', _chReg);
    renderSelector();
  }

  window.initProspBI = function () {
    const w = document.getElementById('view-prospbi');
    if (!w) return;
    if (!w.dataset.listo) { w.innerHTML = markup(); w.dataset.listo = '1'; }
    render();
  };

  // Se engancha a la navegación como el resto de las hojas nuevas: la vista
  // se arma la primera vez que se entra, no al cargar el panel.
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig.apply(this, arguments);
      if (name === 'prospbi') setTimeout(window.initProspBI, 80);
    };
  }
})();
