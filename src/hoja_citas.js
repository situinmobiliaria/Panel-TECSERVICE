// ═══════════════════════════════════════════════════════════════
// hoja_citas.js — Servicios en Terreno
// Cómo trabajó el equipo técnico cada mes: citas completadas, horas
// en terreno, naturaleza de la visita, clientes atendidos y
// cumplimiento contra lo programado. Una fila por visita.
// Depende de: datos.js, utils.js, Chart.js
// ═══════════════════════════════════════════════════════════════
(function () {
  const CT = (window.APP_DATA || {}).citas || {};

  let _mes  = 'todos';     // índice de mes, o 'todos'
  let _rol  = 'todos';
  let _tipo = 'todos';
  let _met  = 'horas';     // 'horas' | 'citas'
  let _chMes = null, _chTec = null, _chTipo = null, _chProg = null;
  let _chCli = null, _chCliMes = null, _chCoord = null;

  const esc  = s => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const nUn  = v => Math.round(v || 0).toLocaleString('es-CL');
  const n1   = v => (v || 0).toLocaleString('es-CL',
    { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc0  = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const pc1  = (a, b) => b ? n1(a / b * 100) + '%' : '—';

  // Los minutos se guardan crudos y se muestran en horas: una visita dura
  // horas, no minutos, y la suma del año en minutos no se puede leer.
  const hrs = m => (m || 0) / 60;
  // Valor según la métrica activa: horas de terreno o número de visitas.
  const val = (min, n) => _met === 'horas' ? hrs(min) : n;
  const fmtV = v => _met === 'horas' ? n1(v) + ' h' : nUn(v);
  const lblMet = () => _met === 'horas' ? 'Horas en terreno' : 'Citas completadas';

  // Color por naturaleza de la visita. El orden es el del ciclo de servicio
  // —primero se diagnostica, después se repara— y no el del volumen, para que
  // la leyenda signifique lo mismo en todos los gráficos de la hoja.
  const COL_TIPO = {
    'Diagnóstico':                    '#002D73',
    'Mantención correctiva':          '#C00000',
    'Mantención preventiva':          '#00832F',
    'Instalación y puesta en marcha': '#D46000',
    'Movimiento de equipo':           '#7A1FAA',
    'Revisión y capacitación':        '#28D2C3',
    'Otros':                          '#B8C1D8',
  };
  const colTipo = t => COL_TIPO[t] || '#B8C1D8';
  const COLORS = ['#002D73', '#28D2C3', '#FFC000', '#33448D', '#7A1FAA',
                  '#D46000', '#00832F', '#C00000', '#4C9BE8', '#E8B24C'];

  // Las filas cabecera de cuadrilla ya salen del extractor. Si alguna cita
  // quedara sólo con el nombre del trabajo en el recurso, va a un grupo aparte
  // para que el ranking, los cargos y los conteos vean sólo personas.
  const SIN_TEC = '(Sin técnico identificado)';
  const SIN_ID  = (CT.tecnicos || []).length;
  const PERSONA = CT.tec_persona || [];
  const TEC   = (CT.tecnicos || []).concat(SIN_TEC);
  const ROLES = (CT.roles || []).concat('Sin técnico identificado');
  const TROL  = (CT.tec_rol || []).concat(ROLES.length - 1);
  const CLI   = CT.clientes || [];
  const TIPOS = CT.tipos || [];
  const EQ    = CT.equipos || [];
  const MESES = CT.meses || [];
  const FILAS = (CT.filas || []).map(f => PERSONA[f[0]] ? f : [SIN_ID].concat(f.slice(1)));
  const ORDEN_TIPO = CT.orden_tipo || TIPOS;

  const rolDe = t => ROLES[TROL[t]] || 'Sin cargo declarado';
  const conPersona = fs => fs.filter(f => f[0] !== SIN_ID);
  const nTecnicos = fs => new Set(conPersona(fs).map(f => f[0])).size;

  // ── Filtro ───────────────────────────────────────────────────
  // Una sola pasada devuelve las filas vivas; todo lo demás se calcula sobre
  // ellas, así que los tres segmentadores se combinan sin casos especiales.
  function filtradas() {
    const im = _mes === 'todos' ? -1 : +_mes;
    return FILAS.filter(f =>
      (im < 0 || f[4] === im) &&
      (_rol === 'todos' || rolDe(f[0]) === _rol) &&
      (_tipo === 'todos' || TIPOS[f[2]] === _tipo));
  }
  const mesesVis = () => _mes === 'todos' ? MESES.map((m, i) => i) : [+_mes];

  function lblFiltro() {
    const p = [];
    p.push(_mes === 'todos'
      ? (MESES.length ? MESES[0].lbl + ' – ' + MESES[MESES.length - 1].lbl : '—')
      : MESES[+_mes].lbl);
    if (_rol !== 'todos') p.push(_rol);
    if (_tipo !== 'todos') p.push(_tipo);
    return p.join(' · ');
  }

  // ── Agregación genérica ──────────────────────────────────────
  // clave → {n, min, prog, cr, cli:Set, mes:{}} sobre las filas dadas.
  function agrupar(fs, keyFn) {
    const g = {};
    fs.forEach(f => {
      const k = keyFn(f);
      if (k == null) return;
      const d = g[k] || (g[k] = { k: k, n: 0, min: 0, prog: 0, cr: 0,
                                  cli: new Set(), mes: {}, tec: new Set() });
      d.n++; d.min += f[5]; d.prog += f[6]; d.cr += f[7];
      d.cli.add(f[1]); if (f[0] !== SIN_ID) d.tec.add(f[0]);
      const m = d.mes[f[4]] || (d.mes[f[4]] = { n: 0, min: 0 });
      m.n++; m.min += f[5];
    });
    return g;
  }
  const valG = d => val(d.min, d.n);
  const valM = (d, i) => { const m = d.mes[i]; return m ? val(m.min, m.n) : 0; };

  // ── Segmentadores ────────────────────────────────────────────
  function seg(id, opts, activo, fn) {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = opts.map(([k, t]) =>
      `<button onclick="window.${fn}('${String(k).replace(/'/g, "\\'")}')"
        style="font-size:.6rem;padding:.22rem .7rem;border-radius:3px;cursor:pointer;
        border:1px solid ${activo === String(k) ? 'var(--az1)' : 'var(--brd)'};
        background:${activo === String(k) ? 'var(--az1)' : 'var(--bg2)'};
        color:${activo === String(k) ? '#fff' : 'var(--txt)'};
        font-weight:${activo === String(k) ? '700' : '400'}">${esc(t)}</button>`).join('');
  }

  function renderSegs() {
    seg('ct-mes', [['todos', 'Todo el período']]
      .concat(MESES.map((m, i) => [String(i), m.lbl])), _mes, '_ctMes');
    // Sólo los cargos que existen, y el más numeroso primero.
    const porRol = agrupar(FILAS, f => rolDe(f[0]));
    const rs = Object.keys(porRol).sort((a, b) => porRol[b].n - porRol[a].n);
    seg('ct-rol', [['todos', 'Todos los cargos']].concat(rs.map(r => [r, r])), _rol, '_ctRol');
    const pres = ORDEN_TIPO.filter(t => TIPOS.indexOf(t) >= 0);
    seg('ct-tipo', [['todos', 'Toda intervención']].concat(pres.map(t => [t, t])), _tipo, '_ctTipo');
    seg('ct-met', [['horas', 'Horas'], ['citas', 'N° de citas']], _met, '_ctMet');
    seg('ct-top', [['10', 'Top 10'], ['15', 'Top 15'], ['30', 'Top 30'], ['todos', 'Todos']],
        _topN >= 1e9 ? 'todos' : String(_topN), '_ctTop');
  }

  window._ctMes  = function (v) { _mes = v; render(); };
  window._ctRol  = function (v) { _rol = v; render(); };
  window._ctTipo = function (v) { _tipo = v; render(); };
  window._ctMet  = function (v) { _met = v; render(); };

  // ── KPIs ─────────────────────────────────────────────────────
  function kpis(fs) {
    const box = document.getElementById('ct-kpis');
    if (!box) return;
    const min  = fs.reduce((s, f) => s + f[5], 0);
    const prog = fs.reduce((s, f) => s + f[6], 0);
    const cr   = fs.reduce((s, f) => s + f[7], 0);
    const tec  = nTecnicos(fs);
    const cli  = new Set(fs.map(f => f[1])).size;
    const sinD = fs.filter(f => !f[5]).length;
    const media = fs.length ? min / fs.length : 0;
    const unicas = new Set(fs.map(f => f[9])).size;

    const k = (col, val2, lbl, sub, tip) =>
      `<div class="kpi" style="--kc:${col}" data-tip="${esc(tip)}">
         <div class="kpi-lbl">${lbl}</div>
         <div class="kpi-val">${val2}</div>
         <div class="kpi-sub">${sub}</div>
       </div>`;

    box.innerHTML =
      k('var(--az1)', nUn(unicas), 'Citas completadas',
        nUn(fs.length) + ' asignaciones de técnico · ' + cli + ' clientes' + (sinD ? ' · ' + nUn(sinD) + ' sin tiempo registrado' : ''),
        'Citas únicas por número, con estado Completada en el período y filtros activos. Una cita con dos técnicos es una cita y dos asignaciones; las horas suman las de cada técnico.' +
        (sinD ? ' ' + nUn(sinD) + ' de ellas tienen Duración Modificada en cero: cuentan como visita pero no suman horas.' : '')) +
      k('var(--teal)', n1(hrs(min)) + ' h', 'Horas en terreno',
        nUn(min) + ' minutos',
        'Suma de «Duración Modificada», que es la corregida a mano. La duración real arrastra citas dejadas abiertas y triplica el total.') +
      k('var(--az2)', Math.round(media) + ' min', 'Duración media por cita',
        n1(media / 60) + ' h por visita',
        'Minutos en terreno divididos por el número de visitas.') +
      k('var(--or)', nUn(tec), 'Técnicos en terreno',
        (tec ? n1(conPersona(fs).length / tec) : '0') + ' citas por técnico',
        'Personas con al menos una cita completada en el período.') +
      k('var(--gn)', pc0(min, prog), 'Real sobre programado',
        n1(hrs(prog)) + ' h programadas',
        'Horas efectivas contra las agendadas. Bajo 100% significa que la visita tomó menos de lo reservado.') +
      k('#7A1FAA', pc0(cr, fs.length), 'Visitas con repuesto',
        nUn(cr) + ' de ' + nUn(fs.length),
        'Citas cuyo tipo de trabajo termina en «CR»: requirieron repuesto.');
  }

  // ── Gráfico: mes × naturaleza de la visita ───────────────────
  function chMes(fs) {
    const cv = document.getElementById('ctMes');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chMes) { _chMes.destroy(); _chMes = null; }
    const I = mesesVis();
    const pres = ORDEN_TIPO.filter(t => TIPOS.indexOf(t) >= 0);
    const ds = pres.map(t => {
      const g = agrupar(fs.filter(f => TIPOS[f[2]] === t), f => f[4]);
      return {
        label: t,
        data: I.map(i => g[i] ? valG(g[i]) : 0),
        backgroundColor: colTipo(t),
        borderWidth: 0,
      };
    }).filter(d => d.data.some(v => v > 0));
    _chMes = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: { labels: I.map(i => MESES[i].lbl), datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtV(c.raw) } },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } },
               grid: { color: 'rgba(107,123,168,.14)' },
               title: { display: true, text: lblMet(), font: { size: 10 } } },
        },
      },
    });
  }

  // ── Gráfico: ranking de técnicos ─────────────────────────────
  function chTec(fs) {
    const cv = document.getElementById('ctTec');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chTec) { _chTec.destroy(); _chTec = null; }
    cv.parentNode.style.height =
      Math.max(300, 26 + nTecnicos(fs) * 22) + 'px';
    // Todas las personas de la hoja, no un top: son 25 y la pregunta es
    // justamente quién quedó abajo. Cortarlo escondía a un tercio del equipo.
    const g = agrupar(conPersona(fs), f => f[0]);
    const arr = Object.values(g).sort((a, b) => valG(b) - valG(a));
    _chTec = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: {
        labels: arr.map(d => TEC[d.k]),
        datasets: [{
          data: arr.map(valG),
          backgroundColor: arr.map(d => colTipo(rolDe(d.k) === 'Técnico' ? 'Diagnóstico' : 'Mantención preventiva')),
          borderRadius: 3, borderWidth: 0,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => {
                const d = arr[c.dataIndex];
                return [' ' + fmtV(valG(d)),
                        ' ' + nUn(d.n) + ' citas · ' + n1(hrs(d.min)) + ' h',
                        ' ' + d.cli.size + ' clientes · ' + Math.round(d.min / d.n) + ' min por cita',
                        ' ' + rolDe(d.k)];
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(107,123,168,.14)' },
               ticks: { font: { size: 10 } },
               title: { display: true, text: lblMet(), font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });
  }

  // ── Gráfico: mezcla por naturaleza ───────────────────────────
  function chTipo(fs) {
    const cv = document.getElementById('ctTipo');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chTipo) { _chTipo.destroy(); _chTipo = null; }
    const g = agrupar(fs, f => TIPOS[f[2]]);
    const pres = ORDEN_TIPO.filter(t => g[t]);
    const tot = pres.reduce((s, t) => s + valG(g[t]), 0);
    _chTipo = new Chart(cv.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: pres,
        datasets: [{
          data: pres.map(t => valG(g[t])),
          backgroundColor: pres.map(colTipo),
          borderColor: '#fff', borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
          tooltip: {
            callbacks: {
              label: c => {
                const d = g[c.label];
                return ' ' + fmtV(c.raw) + '  (' + pc1(c.raw, tot) + ') · ' + nUn(d.n) + ' citas';
              },
            },
          },
        },
      },
    });
  }

  // ── Gráfico: real contra programado ──────────────────────────
  // Las dos series comparten unidad y escala a propósito: con dos ejes la
  // brecha entre lo agendado y lo efectivo se puede dibujar de cualquier tamaño.
  function chProg(fs) {
    const cv = document.getElementById('ctProg');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chProg) { _chProg.destroy(); _chProg = null; }
    const I = mesesVis();
    const g = agrupar(fs, f => f[4]);
    _chProg = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: {
        labels: I.map(i => MESES[i].lbl),
        datasets: [
          { label: 'Programado', data: I.map(i => g[i] ? hrs(g[i].prog) : 0),
            backgroundColor: '#C7CEEA', borderRadius: 3, borderWidth: 0 },
          { label: 'Real en terreno', data: I.map(i => g[i] ? hrs(g[i].min) : 0),
            backgroundColor: '#002D73', borderRadius: 3, borderWidth: 0 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } },
          tooltip: {
            callbacks: {
              label: c => ' ' + c.dataset.label + ': ' + n1(c.raw) + ' h',
              afterBody: c => {
                const d = g[I[c[0].dataIndex]];
                return d ? 'Cumplimiento: ' + pc0(d.min, d.prog) : '';
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(107,123,168,.14)' },
               ticks: { font: { size: 10 } },
               title: { display: true, text: 'Horas', font: { size: 10 } } },
        },
      },
    });
  }

  // ── Gráfico: clientes con más trabajo en terreno ─────────────
  // Barras apiladas por naturaleza de la visita: el largo dice cuánto trabajo
  // se llevó el cliente y la composición dice de qué tipo. Un cliente largo
  // hecho de correctiva no es el mismo problema que uno hecho de preventiva.
  let _topN = 15;
  window._ctTop = function (v) { _topN = v === 'todos' ? 1e9 : +v; render(); };

  function chCli(fs) {
    const cv = document.getElementById('ctCli');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chCli) { _chCli.destroy(); _chCli = null; }
    const g = agrupar(fs, f => f[1]);
    const orden = Object.values(g).sort((a, b) => valG(b) - valG(a));
    const arr = orden.slice(0, Math.min(_topN, orden.length));
    const claves = arr.map(d => String(d.k));
    const pres = ORDEN_TIPO.filter(t => TIPOS.indexOf(t) >= 0);
    // El canvas crece con el número de barras: apretadas no se leen los nombres.
    cv.parentNode.style.height = Math.max(260, 26 + arr.length * 22) + 'px';

    const ds = pres.map(t => {
      const gt = agrupar(fs.filter(f => TIPOS[f[2]] === t), f => f[1]);
      return {
        label: t,
        data: claves.map(k => gt[k] ? valG(gt[k]) : 0),
        backgroundColor: colTipo(t),
        borderWidth: 0,
      };
    }).filter(d => d.data.some(v => v > 0));

    _chCli = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: { labels: arr.map(d => CLI[d.k]), datasets: ds },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, padding: 10 } },
          tooltip: {
            callbacks: {
              label: c => ' ' + c.dataset.label + ': ' + fmtV(c.raw),
              afterBody: c => {
                const d = arr[c[0].dataIndex];
                return [nUn(d.n) + ' citas · ' + n1(hrs(d.min)) + ' h',
                        d.tec.size + ' técnicos distintos',
                        Math.round(d.min / d.n) + ' min por cita'];
              },
            },
          },
        },
        scales: {
          x: { stacked: true, beginAtZero: true, grid: { color: 'rgba(107,123,168,.14)' },
               ticks: { font: { size: 10 } },
               title: { display: true, text: lblMet(), font: { size: 10 } } },
          y: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } },
        },
      },
    });
  }

  // ── Gráfico: cómo evolucionan mes a mes los clientes más atendidos ──
  function chCliMes(fs) {
    const cv = document.getElementById('ctCliMes');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chCliMes) { _chCliMes.destroy(); _chCliMes = null; }
    const I = mesesVis();
    const g = agrupar(fs, f => f[1]);
    const top = Object.values(g).sort((a, b) => valG(b) - valG(a)).slice(0, 6);
    _chCliMes = new Chart(cv.getContext('2d'), {
      type: 'line',
      data: {
        labels: I.map(i => MESES[i].lbl),
        datasets: top.map((d, i) => ({
          label: CLI[d.k],
          data: I.map(j => valM(d, j)),
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length],
          borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .25, fill: false,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 }, padding: 8 } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtV(c.raw) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(107,123,168,.14)' },
               ticks: { font: { size: 10 } },
               title: { display: true, text: lblMet(), font: { size: 10 } } },
        },
      },
    });
  }

  // ── Tabla agrupada genérica, expandible ──────────────────────
  // Las tres tablas de la hoja tienen la misma forma —un grupo que se abre a
  // su detalle, los meses en columnas— así que se dibujan con la misma función
  // y sólo cambian las claves y las etiquetas.
  // Los cargos arrancan abiertos: colapsados se veían cuatro filas y parecía
  // que faltaba gente, cuando el detalle son las 25 personas de la hoja.
  const _abiertas = { rol: new Set(), tec: new Set(), cli: new Set(), atec: new Set(), acoo: new Set() };
  let _rolInicial = false;
  window._ctTog = function (tabla, k) {
    const s = _abiertas[tabla];
    if (s.has(k)) s.delete(k); else s.add(k);
    render();
  };
  window._ctTodo = function (tabla, abrir) {
    _abiertas[tabla].clear();
    if (abrir) (window['_ctKeys_' + tabla] || []).forEach(k => _abiertas[tabla].add(k));
    render();
  };

  function tablaGrupo(o) {
    const box = document.getElementById(o.box);
    if (!box) return;
    const I = mesesVis();
    const G = agrupar(o.fs, o.keyG);
    const keys = Object.keys(G).sort((a, b) => valG(G[b]) - valG(G[a]));
    window['_ctKeys_' + o.tabla] = keys;
    if (!keys.length) { box.innerHTML = '<p style="font-size:.6rem;color:var(--mut)">Sin datos para el filtro activo.</p>'; return; }
    const gTot = keys.reduce((s, k) => s + valG(G[k]), 0);

    const th = (t, al, extra) =>
      `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.4rem .55rem;
        font-size:.56rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
        border-right:1px solid rgba(255,255,255,.18);${extra || ''}">${t}</th>`;
    const SEP = 'border-right:1px solid var(--brd)';
    const num = (v, st) => `<td style="padding:.3rem .55rem;text-align:right;font-size:.62rem;
      font-variant-numeric:tabular-nums;${SEP};${st || ''}">${v}</td>`;

    let rows = '';
    keys.forEach((k, i) => {
      const d = G[k];
      const ab = _abiertas[o.tabla].has(k);
      const col = COLORS[i % COLORS.length];
      rows += `<tr style="background:var(--bg2);cursor:pointer;border-left:3px solid ${col}"
          onclick="window._ctTog('${o.tabla}',${JSON.stringify(String(k)).replace(/"/g, '&quot;')})">
        <td style="padding:.3rem .55rem;font-size:.66rem;font-weight:700;white-space:nowrap;
                   position:sticky;left:0;background:var(--bg2);z-index:1;${SEP}">
          <span style="display:inline-block;width:.8rem;font-size:.5rem;color:var(--mut);
            transform:rotate(${ab ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(o.lblG(k, d))}
        </td>
        ${num(nUn(d.n), 'color:var(--mut)')}
        ${num(n1(hrs(d.min)) + ' h', 'font-weight:700;color:var(--az1)')}
        ${num(Math.round(d.min / d.n), 'color:var(--mut)')}
        ${num(o.col4(d))}
        ${num(pc0(d.min, d.prog), 'color:' + (d.prog && d.min / d.prog > 1 ? 'var(--or)' : 'var(--gn)'))}
        ${I.map(j => num(valM(d, j) ? fmtV(valM(d, j)) : '—',
                         valM(d, j) ? '' : 'color:var(--mut)')).join('')}
        ${num(fmtV(valG(d)), 'font-weight:700')}
        <td style="padding:.3rem .55rem;text-align:right;font-size:.58rem;color:var(--mut)">${pc1(valG(d), gTot)}</td>
      </tr>`;

      if (ab) {
        const S = agrupar(o.fs.filter(f => String(o.keyG(f)) === String(k)), o.keyD);
        Object.keys(S).sort((a, b) => valG(S[b]) - valG(S[a])).forEach(k2 => {
          const s = S[k2];
          rows += `<tr style="background:var(--bg)">
            <td style="padding:.22rem .55rem .22rem 1.9rem;font-size:.61rem;color:var(--mut);
                       white-space:nowrap;position:sticky;left:0;background:var(--bg);z-index:1;${SEP}">${esc(o.lblD(k2, s))}</td>
            ${num(nUn(s.n), 'color:var(--mut)')}
            ${num(n1(hrs(s.min)) + ' h', 'color:var(--az2)')}
            ${num(Math.round(s.min / s.n), 'color:var(--mut)')}
            ${num(o.col4(s), 'color:var(--mut)')}
            ${num(pc0(s.min, s.prog), 'color:var(--mut)')}
            ${I.map(j => num(valM(s, j) ? fmtV(valM(s, j)) : '—', 'color:var(--mut)')).join('')}
            ${num(fmtV(valG(s)))}
            <td style="padding:.22rem .55rem;text-align:right;font-size:.56rem;color:var(--mut)">${pc1(valG(s), valG(d))}</td>
          </tr>`;
        });
      }
    });

    const T = o.fs.reduce((a, f) => ({ n: a.n + 1, min: a.min + f[5], prog: a.prog + f[6] }),
                          { n: 0, min: 0, prog: 0 });
    const GM = agrupar(o.fs, f => f[4]);
    box.innerHTML = `
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center">
        <button onclick="window._ctTodo('${o.tabla}',true)" style="font-size:.57rem;padding:.16rem .5rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Expandir todo</button>
        <button onclick="window._ctTodo('${o.tabla}',false)" style="font-size:.57rem;padding:.16rem .5rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Colapsar todo</button>
        <span style="font-size:.57rem;color:var(--mut)">${keys.length} ${o.nomG} · clic para abrir ${o.nomD}</span>
      </div>
      <div style="overflow-x:auto;max-height:460px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:${420 + I.length * 62}px">
          <thead><tr>
            ${th(o.cab, 'left', 'position:sticky;left:0;z-index:3;min-width:200px')}
            ${th('CITAS', 'right')}${th('HORAS', 'right')}${th('MIN/CITA', 'right')}
            ${th(o.cab4, 'right')}${th('REAL/PROG', 'right')}
            ${I.map(j => th(MESES[j].lbl.toUpperCase(), 'right')).join('')}
            ${th('TOTAL', 'right')}${th('%', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.35rem .55rem;font-size:.63rem;position:sticky;left:0;background:var(--az3);z-index:1;${SEP}">TOTAL</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem;${SEP}">${nUn(T.n)}</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem;${SEP}">${n1(hrs(T.min))} h</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem;${SEP}">${T.n ? Math.round(T.min / T.n) : 0}</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem;${SEP}">${o.tot4(o.fs)}</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem;${SEP}">${pc0(T.min, T.prog)}</td>
            ${I.map(j => `<td style="padding:.35rem .55rem;text-align:right;font-size:.61rem;${SEP}">${GM[j] ? fmtV(valG(GM[j])) : '—'}</td>`).join('')}
            <td style="padding:.35rem .55rem;text-align:right;font-size:.63rem;${SEP}">${fmtV(val(T.min, T.n))}</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.58rem">100%</td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.5">${o.nota}</p>`;
  }

  // ── Análisis por técnico y coordinador ───────────────────────
  // Las citas sin persona (el recurso trae el nombre del trabajo) y las de
  // clientes sin contrato no se reparten: quedan en su propia fila al pie.
  const SIN_COO = '(Sin coordinador identificado)';
  const tecDe = f => TEC[f[0]];
  const cooDe = f => (CT.cli_coord || [])[f[1]] || SIN_COO;
  const G_TIPO = [['% PREV.', 'Mantención preventiva'], ['% CORR.', 'Mantención correctiva'],
                  ['% DIAG.', 'Diagnóstico'], ['% INST.', 'Instalación y puesta en marcha']];

  function tablaAnalisis(o) {
    const box = document.getElementById(o.box);
    if (!box) return;
    const G = {};
    o.fs.forEach(f => {
      const k = o.keyG(f);
      const d = G[k] || (G[k] = { k, n: 0, min: 0, prog: 0, sd: 0, cli: new Set(), otro: new Set(), mes: new Set(), ids: new Set(), t: {} });
      // Lo programado sólo cuenta si la cita trae duración: si no, una cita sin
      // dato hunde el Real/Prog de un técnico que sí la hizo.
      d.n++; d.min += f[5]; if (f[5]) d.prog += f[6]; else d.sd++;
      d.cli.add(f[1]); d.mes.add(f[4]); d.ids.add(f[9]);
      if (o.keyD(f) !== SIN_TEC && o.keyD(f) !== SIN_COO) d.otro.add(o.keyD(f));
      d.t[TIPOS[f[2]]] = (d.t[TIPOS[f[2]]] || 0) + 1;
    });
    const orden = Object.values(G).sort((a, b) =>
      (a.k === o.sin) - (b.k === o.sin) || valG(b) - valG(a));
    window['_ctKeys_' + o.tabla] = orden.map(d => d.k);
    if (!orden.length) { box.innerHTML = '<p style="font-size:.6rem;color:var(--mut)">Sin datos para el filtro activo.</p>'; return; }
    const totH = orden.reduce((s, d) => s + d.min, 0), totN = new Set(o.fs.map(f => f[9])).size;
    const th = (t, al) => `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.4rem .55rem;
      font-size:.56rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">${t}</th>`;
    const SEP = 'border-right:1px solid var(--brd)';
    const num = (v, st) => `<td style="padding:.3rem .55rem;text-align:right;font-size:.62rem;font-variant-numeric:tabular-nums;${SEP};${st || ''}">${v}</td>`;
    const cols = d => `
      ${num(nUn(d.ids.size))}
      ${num(n1(hrs(d.min)) + ' h', 'font-weight:700;color:var(--az1)')}
      ${num(pc1(d.min, totH), 'color:var(--mut)')}
      ${num(d.n - d.sd ? Math.round(d.min / (d.n - d.sd)) : '—', 'color:var(--mut)')}
      ${num(n1(d.ids.size / d.mes.size), 'color:var(--mut)')}
      ${num(nUn(d.cli.size))}
      ${num(nUn(d.otro.size))}
      ${G_TIPO.map(([, t]) => num(pc0(d.t[t] || 0, d.n))).join('')}
      ${num(pc0(d.min, d.prog), 'color:' + (d.prog && d.min / d.prog > 1 ? 'var(--or)' : 'var(--gn)'))}
      ${num(d.sd ? nUn(d.sd) : '—', 'color:' + (d.sd / d.n > .3 ? 'var(--rd,#C00000);font-weight:700' : 'var(--mut)'))}`;
    let rows = '';
    orden.forEach((d, i) => {
      const ab = _abiertas[o.tabla].has(d.k), bg = d.k === o.sin ? '#FFF8E5' : 'var(--bg2)';
      rows += `<tr style="background:${bg};cursor:pointer;border-left:3px solid ${COLORS[i % COLORS.length]}"
          onclick="window._ctTog('${o.tabla}',${JSON.stringify(String(d.k)).replace(/"/g, '&quot;')})">
        <td style="padding:.3rem .55rem;font-size:.66rem;font-weight:700;white-space:nowrap;position:sticky;left:0;background:${bg};z-index:1;${SEP}">
          <span style="display:inline-block;width:.8rem;font-size:.5rem;color:var(--mut);transform:rotate(${ab ? 90 : 0}deg)">&#9654;</span>${esc(d.k)}</td>
        ${cols(d)}</tr>`;
      if (ab) {
        const S = {};
        o.fs.filter(f => o.keyG(f) === d.k).forEach(f => {
          const k = (o.abrir || o.keyD)(f);
          const s = S[k] || (S[k] = { k, n: 0, min: 0, prog: 0, sd: 0, cli: new Set(), mes: new Set(), t: {} });
          s.n++; s.min += f[5]; if (f[5]) s.prog += f[6]; else s.sd++;
          s.cli.add(f[1]); s.mes.add(f[4]); s.t[TIPOS[f[2]]] = (s.t[TIPOS[f[2]]] || 0) + 1;
        });
        Object.values(S).sort((a, b) => valG(b) - valG(a)).forEach(s => {
          const c = (v) => num(v, 'color:var(--mut)');
          rows += `<tr style="background:var(--bg)">
            <td style="padding:.22rem .55rem .22rem 1.9rem;font-size:.61rem;color:var(--mut);white-space:nowrap;position:sticky;left:0;background:var(--bg);z-index:1;${SEP}">${esc(s.k)}</td>
            ${c(nUn(s.n))}${num(n1(hrs(s.min)) + ' h', 'color:var(--az2)')}${c(pc1(s.min, d.min))}
            ${c(s.n - s.sd ? Math.round(s.min / (s.n - s.sd)) : '—')}${c(n1(s.n / s.mes.size))}${c(nUn(s.cli.size))}${c('')}
            ${G_TIPO.map(([, t]) => c(pc0(s.t[t] || 0, s.n))).join('')}${c(pc0(s.min, s.prog))}${c(s.sd ? nUn(s.sd) : '—')}</tr>`;
        });
      }
    });
    const lee = orden.filter(d => d.k !== o.sin);
    box.innerHTML = `
      <div style="display:flex;gap:.4rem;margin-bottom:.5rem;flex-wrap:wrap;align-items:center" class="exp-oculto">
        <button onclick="window._ctTodo('${o.tabla}',true)" style="font-size:.57rem;padding:.16rem .5rem;border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Expandir todo</button>
        <button onclick="window._ctTodo('${o.tabla}',false)" style="font-size:.57rem;padding:.16rem .5rem;border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">Colapsar todo</button>
        <span style="font-size:.57rem;color:var(--mut)">${lee.length} ${o.nom} · clic para abrir ${o.nomD}</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1050px">
          <thead><tr>${th(o.cab, 'left')}${['CITAS', 'HORAS', '% HORAS', 'MIN/CITA', 'CITAS/MES', 'CLIENTES', o.cabD].map(t => th(t, 'right')).join('')}
            ${G_TIPO.map(([t]) => th(t, 'right')).join('')}${th('REAL/PROG', 'right')}${th('SIN DURACIÓN', 'right')}</tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="background:var(--az3);color:#fff;font-weight:700">
            <td style="padding:.35rem .55rem;font-size:.63rem;position:sticky;left:0;background:var(--az3);z-index:1">TOTAL</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem">${nUn(totN)}</td>
            <td style="padding:.35rem .55rem;text-align:right;font-size:.61rem">${n1(hrs(totH))} h</td>
            <td colspan="${6 + G_TIPO.length + 1}"></td></tr></tfoot>
        </table>
      </div>
      <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.5">${o.nota}</p>`;
  }

  // Horas de cada coordinador abiertas por tipo de intervención.
  function chCoord(fs) {
    const cv = document.getElementById('ctCoord');
    if (!cv || typeof Chart === 'undefined') return;
    if (_chCoord) { _chCoord.destroy(); _chCoord = null; }
    const g = agrupar(fs, cooDe);
    const keys = Object.keys(g).sort((a, b) => (a === SIN_COO) - (b === SIN_COO) || valG(g[b]) - valG(g[a]));
    const pres = ORDEN_TIPO.filter(t => fs.some(f => TIPOS[f[2]] === t));
    const celda = {};
    fs.forEach(f => {
      const k = cooDe(f) + '|' + TIPOS[f[2]], c = celda[k] || (celda[k] = { n: 0, min: 0 });
      c.n++; c.min += f[5];
    });
    _chCoord = new Chart(cv.getContext('2d'), {
      type: 'bar',
      data: { labels: keys, datasets: pres.map(t => ({
        label: t, backgroundColor: colTipo(t), borderColor: '#fff', borderWidth: 1,
        data: keys.map(k => { const c = celda[k + '|' + t]; return c ? val(c.min, c.n) : 0; }) })) },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtV(c.raw) } } },
        scales: { x: { stacked: true, title: { display: true, text: lblMet(), font: { size: 10 } } },
                  y: { stacked: true, ticks: { font: { size: 10 } } } } },
    });
  }

  // Clientes sin contrato cuyo coordinador sale del dueño de sus oportunidades:
  // se listan para poder revisarlos, porque no es un dato directo.
  function listaAsignados(fs) {
    const box = document.getElementById('ct-a-coo-lista');
    if (!box) return;
    const FTE = CT.cli_coord_fte || [];
    const G = {};
    fs.filter(f => FTE[f[1]] === 'Propietario').forEach(f => {
      const d = G[f[1]] || (G[f[1]] = { n: 0, min: 0 });
      d.n++; d.min += f[5];
    });
    const L = Object.keys(G).sort((a, b) => G[b].n - G[a].n);
    if (!L.length) { box.innerHTML = ''; return; }
    const th = (t, al) => `<th style="background:var(--az1);color:#fff;padding:.32rem .55rem;font-size:.56rem;text-align:${al}">${t}</th>`;
    const td = (t, x) => `<td style="padding:.24rem .55rem;font-size:.62rem;${x || ''}">${t}</td>`;
    box.innerHTML = `<details><summary style="font-size:.62rem;color:var(--az1);font-weight:700;cursor:pointer;margin:.6rem 0 .3rem">
        ${L.length} clientes sin contrato con coordinador asignado por sus oportunidades: ver lista</summary>
      <table style="width:100%;border-collapse:collapse"><thead><tr>${th('CLIENTE', 'left')}${th('COORDINADOR', 'left')}${th('CITAS', 'right')}${th('HORAS', 'right')}</tr></thead>
      <tbody>${L.map((k, i) => `<tr style="background:${i % 2 ? 'var(--bg)' : 'var(--bg2)'}">
        ${td(esc(CLI[k]), 'font-weight:600')}${td(esc(CT.cli_coord[k]))}${td(nUn(G[k].n), 'text-align:right')}${td(n1(hrs(G[k].min)) + ' h', 'text-align:right')}</tr>`).join('')}</tbody></table></details>`;
  }

  // ── Tablas comparativas ──────────────────────────────────────
  // Una fila por persona con las mismas medidas, para ver quién carga más
  // trabajo. Se ordena por la medida elegida y cada uno se mide contra el
  // promedio del grupo o contra otra persona.
  const _cmp = { tec: { met: 'horas', ref: 'prom' }, coo: { met: 'horas', ref: 'prom' } };
  const CARTERA = CT.coord_cartera || {};
  window._ctMetT = v => { _cmp.tec.met = v; render(); };
  window._ctMetC = v => { _cmp.coo.met = v; render(); };
  window._ctRefT = v => { _cmp.tec.ref = v; render(); };
  window._ctRefC = v => { _cmp.coo.ref = v; render(); };

  const M_TEC = [
    ['horas', 'HORAS', d => hrs(d.min), n1], ['citas', 'CITAS', d => d.n, nUn],
    ['dias', 'DÍAS EN TERRENO', d => d.dias.size, nUn],
    ['cdia', 'CITAS/DÍA', d => d.n / d.dias.size, n1],
    ['hdia', 'HORAS/DÍA', d => d.diasD.size ? hrs(d.min) / d.diasD.size : 0, n1],
    ['hmes', 'HORAS/MES', d => hrs(d.min) / d.mes.size, n1],
    ['cli', 'CLIENTES', d => d.cli.size, nUn],
    ['corr', 'CORRECTIVAS', d => d.corr, nUn],
  ];
  const M_COO = [
    ['horas', 'HORAS', d => hrs(d.min), n1], ['citas', 'CITAS', d => d.ids.size, nUn],
    ['cli', 'CLIENTES ATENDIDOS', d => d.cli.size, nUn],
    ['tec', 'TÉCNICOS', d => d.tec.size, nUn],
    ['ctr', 'CONTRATOS ACTIVOS', d => (CARTERA[d.k] || {}).contratos || 0, nUn],
    ['hctr', 'HORAS/CONTRATO', d => { const c = (CARTERA[d.k] || {}).contratos; return c ? hrs(d.min) / c : 0; }, n1],
    ['ccli', 'CITAS/CLIENTE', d => d.ids.size / d.cli.size, n1],
    ['hmes', 'HORAS/MES', d => hrs(d.min) / d.mes.size, n1],
  ];

  function tablaCompara(o) {
    const box = document.getElementById(o.box);
    if (!box) return;
    const G = {};
    o.fs.forEach(f => {
      const k = o.keyG(f);
      if (k === o.sin) return;
      const d = G[k] || (G[k] = { k, n: 0, min: 0, corr: 0, cli: new Set(), tec: new Set(), mes: new Set(), dias: new Set(), diasD: new Set(), ids: new Set() });
      d.n++; d.min += f[5]; d.cli.add(f[1]); d.mes.add(f[4]); d.dias.add(f[8]); d.ids.add(f[9]);
      if (f[5]) d.diasD.add(f[8]);
      if (f[0] !== SIN_ID) d.tec.add(f[0]);
      if (TIPOS[f[2]] === 'Mantención correctiva') d.corr++;
    });
    const L = Object.values(G);
    if (!L.length) { box.innerHTML = '<p style="font-size:.6rem;color:var(--mut)">Sin datos para el filtro activo.</p>'; return; }
    const st = _cmp[o.tabla];
    if (st.ref !== 'prom' && !G[st.ref]) st.ref = 'prom';
    const met = o.med.find(m => m[0] === st.met) || o.med[0];
    const v = (d, m) => m[2](d);
    const prom = m => L.reduce((s, d) => s + v(d, m), 0) / L.length;
    L.sort((a, b) => v(b, met) - v(a, met));
    const base = st.ref === 'prom' ? prom(met) : v(G[st.ref], met);
    const maxV = Math.max(...L.map(d => v(d, met))) || 1;
    seg(o.chips, o.med.map(m => [m[0], m[1]]), st.met, o.fnMet);
    const nomRef = st.ref === 'prom' ? 'promedio' : st.ref;
    const refSel = document.getElementById(o.sel);
    if (refSel) refSel.innerHTML = `<option value="prom">Promedio del grupo</option>` +
      L.slice().sort((a, b) => String(a.k).localeCompare(b.k)).map(d =>
        `<option value="${esc(d.k)}" ${d.k === st.ref ? 'selected' : ''}>${esc(d.k)}</option>`).join('');
    const SEP = 'border-right:1px solid var(--brd)';
    const th = (t, al, on) => `<th style="position:sticky;top:0;z-index:2;background:${on ? '#1a3a6b' : 'var(--az1)'};color:#fff;padding:.4rem .5rem;
      font-size:.56rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)">${t}</th>`;
    const td = (t, x) => `<td style="padding:.28rem .5rem;text-align:right;font-size:.62rem;font-variant-numeric:tabular-nums;${SEP};${x || ''}">${t}</td>`;
    const rows = L.map((d, i) => {
      const dif = base ? (v(d, met) - base) / Math.abs(base) : 0;
      const esRef = d.k === st.ref;
      const col = esRef ? 'var(--mut)' : dif > 0.005 ? '#00832F' : dif < -0.005 ? '#C00000' : 'var(--mut)';
      const bg = esRef ? '#FFF2CC' : i % 2 ? 'var(--bg)' : 'var(--bg2)';
      return `<tr style="background:${bg}">
        ${td(i + 1, 'text-align:center;color:var(--mut)')}
        <td style="padding:.28rem .55rem;font-size:.64rem;font-weight:600;white-space:nowrap;${SEP}">${esc(d.k)}</td>
        ${o.med.map(m => td(m[3](v(d, m)), m === met ? 'font-weight:700;color:var(--az1)' : '')).join('')}
        <td style="padding:.28rem .5rem;min-width:130px;${SEP}"><div style="height:9px;border-radius:2px;background:var(--az2);width:${Math.max(1, v(d, met) / maxV * 100)}%"></div></td>
        ${td(esRef ? 'base' : (dif > 0 ? '+' : '') + n1(dif * 100) + '%', 'font-weight:700;color:' + col)}</tr>`;
    }).join('');
    box.innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:980px">
      <thead><tr>${th('#', 'center')}${th(o.cab, 'left')}${o.med.map(m => th(m[1], 'right', m === met)).join('')}
        ${th(met[1], 'left', true)}${th('VS ' + esc(nomRef.toUpperCase()), 'right', true)}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:var(--az3);color:#fff;font-weight:700">
        <td></td><td style="padding:.35rem .55rem;font-size:.63rem">PROMEDIO</td>
        ${o.med.map(m => `<td style="padding:.35rem .5rem;text-align:right;font-size:.61rem">${n1(prom(m))}</td>`).join('')}
        <td></td><td></td></tr></tfoot></table></div>
      <p style="font-size:.55rem;color:var(--mut);margin:.45rem 0 0;line-height:1.5">${o.nota}</p>`;
  }

  // ── Render ───────────────────────────────────────────────────
  function render() {
    const fs = filtradas();
    renderSegs();
    kpis(fs);
    chMes(fs); chTec(fs); chTipo(fs); chProg(fs); chCli(fs); chCliMes(fs); chCoord(fs);

    const st = document.getElementById('ct-sub');
    if (st) st.textContent = nUn(new Set(fs.map(f => f[9])).size) + ' citas · ' + n1(hrs(fs.reduce((s, f) => s + f[5], 0))) +
      ' h · ' + nTecnicos(fs) + ' técnicos · ' +
      new Set(fs.map(f => f[1])).size + ' clientes · ' + lblFiltro();

    if (!_rolInicial) {
      _rolInicial = true;
      new Set(FILAS.map(f => rolDe(f[0]))).forEach(r => _abiertas.rol.add(r));
    }
    tablaCompara({
      box: 'ct-c-tec', tabla: 'tec', fs: fs, keyG: tecDe, sin: SIN_TEC, cab: 'TÉCNICO', med: M_TEC,
      chips: 'ct-cm-tec', fnMet: '_ctMetT', sel: 'ct-cr-tec',
      nota: 'Días en terreno = días distintos con al menos una cita. Horas/día se calcula sobre los días con duración registrada. ' +
            'Cuidado con las horas de quien tiene muchas citas sin duración (ver SIN DURACIÓN en el análisis): aparece con menos horas de las reales; ahí sirve mejor mirar citas y días.',
    });
    tablaCompara({
      box: 'ct-c-coo', tabla: 'coo', fs: fs, keyG: cooDe, sin: SIN_COO, cab: 'COORDINADOR', med: M_COO,
      chips: 'ct-cm-coo', fnMet: '_ctMetC', sel: 'ct-cr-coo',
      nota: 'El coordinador no va a terreno: las horas son las de las citas a clientes de su cartera, o sea el trabajo que le toca coordinar. ' +
            'Contratos activos = estado Activado en CONTRATOS TODOS. Las citas sin coordinador identificado no entran.',
    });

    tablaAnalisis({
      box: 'ct-a-tec', tabla: 'atec', fs: fs, keyG: tecDe, keyD: cooDe, sin: SIN_TEC,
      cab: 'TÉCNICO', cabD: 'COORDINADORES', nom: 'técnicos', nomD: 'sus coordinadores',
      nota: 'Cuando dos técnicos van a la misma cita, la cita y sus horas cuentan para cada uno. MIN/CITA se calcula sobre las citas con duración; SIN DURACIÓN cuenta las que no la traen, y sus horas no suman, así que un técnico con muchas citas sin duración aparece con menos horas de las reales.',
    });
    tablaAnalisis({
      box: 'ct-a-coo', tabla: 'acoo', fs: fs, keyG: cooDe, keyD: tecDe, sin: SIN_COO,
      abrir: f => cooDe(f) === SIN_COO ? CLI[f[1]] : tecDe(f),
      cab: 'COORDINADOR', cabD: 'TÉCNICOS', nom: 'coordinadores', nomD: 'sus técnicos',
      nota: 'La hoja de citas no trae coordinador: se toma el del cliente en CONTRATOS TODOS, y con más de uno manda el de más contratos activados. ' +
            'Si el cliente no tiene contrato, se usa el dueño de sus oportunidades en «Repuestos Vendidas» y las hojas de Brechas, que en los clientes con contrato coincide con el coordinador el 98% de las veces. ' +
            '«Sin coordinador identificado» son clientes que no aparecen con coordinador en ninguna hoja, más GEMCO, que es la propia empresa. Ábrela para ver cuáles son.',
    });
    listaAsignados(fs);

    tablaGrupo({
      box: 'ct-t-rol', tabla: 'rol', fs: fs,
      keyG: f => rolDe(f[0]), keyD: f => f[0],
      lblG: (k, d) => k + '  (' + d.tec.size + ')', lblD: k2 => TEC[k2],
      cab: 'CARGO / TÉCNICO', nomG: 'cargos', nomD: 'sus técnicos',
      cab4: 'CLIENTES', col4: d => nUn(d.cli.size),
      tot4: f2 => nUn(new Set(f2.map(x => x[1])).size),
      nota: 'El cargo sale del nombre del recurso en la hoja —«Camila Castro - Tecnico superviso»—, ' +
            'unificando las variantes de escritura. Quien no lo trae queda en «Sin cargo declarado».',
    });

    tablaGrupo({
      box: 'ct-t-tec', tabla: 'tec', fs: fs,
      keyG: f => f[0], keyD: f => TIPOS[f[2]],
      lblG: k => +k === SIN_ID ? SIN_TEC : TEC[k] + '  ·  ' + rolDe(+k), lblD: k2 => k2,
      cab: 'TÉCNICO / INTERVENCIÓN', nomG: 'técnicos', nomD: 'el tipo de intervención',
      cab4: 'CLIENTES', col4: d => nUn(d.cli.size),
      tot4: f2 => nUn(new Set(f2.map(x => x[1])).size),
      nota: 'Abre cada técnico para ver en qué se le fue el tiempo: diagnóstico, correctiva, preventiva o instalación.',
    });

    tablaGrupo({
      box: 'ct-t-cli', tabla: 'cli', fs: fs,
      keyG: f => f[1], keyD: f => f[0],
      lblG: k => CLI[k], lblD: k2 => +k2 === SIN_ID ? SIN_TEC : TEC[k2] + '  ·  ' + rolDe(+k2),
      cab: 'CLIENTE / TÉCNICO', nomG: 'clientes', nomD: 'quién lo atendió',
      cab4: 'TÉCNICOS', col4: d => nUn(d.tec.size),
      tot4: f2 => nUn(new Set(f2.map(x => x[0])).size),
      nota: 'Cuánta atención en terreno recibió cada cliente y cuántas personas distintas lo visitaron. ' +
            'Muchos técnicos distintos en un mismo cliente suele significar que nadie se quedó con el caso.',
    });

    // Equipos más intervenidos, como tabla corta al pie
    const boxE = document.getElementById('ct-eq');
    if (boxE) {
      const G = agrupar(fs, f => EQ[f[3]]);
      const arr = Object.values(G).sort((a, b) => valG(b) - valG(a)).slice(0, 12);
      const tot = Object.values(G).reduce((s, d) => s + valG(d), 0);
      boxE.innerHTML = `<table style="width:100%;border-collapse:collapse">
        <thead><tr>${['EQUIPO', 'CITAS', 'HORAS', 'MIN/CITA', 'CON REPUESTO', '% DEL TOTAL'].map((t, i) =>
          `<th style="background:var(--az1);color:#fff;padding:.35rem .55rem;font-size:.56rem;
            text-align:${i ? 'right' : 'left'};border-right:1px solid rgba(255,255,255,.18)">${t}</th>`).join('')}
        </tr></thead><tbody>${arr.map((d, i) => `<tr style="background:${i % 2 ? 'var(--bg)' : 'var(--bg2)'}">
          <td style="padding:.28rem .55rem;font-size:.63rem;font-weight:600">${esc(d.k)}</td>
          <td style="padding:.28rem .55rem;text-align:right;font-size:.62rem">${nUn(d.n)}</td>
          <td style="padding:.28rem .55rem;text-align:right;font-size:.62rem;font-weight:700;color:var(--az1)">${n1(hrs(d.min))} h</td>
          <td style="padding:.28rem .55rem;text-align:right;font-size:.62rem;color:var(--mut)">${Math.round(d.min / d.n)}</td>
          <td style="padding:.28rem .55rem;text-align:right;font-size:.62rem;color:var(--mut)">${pc0(d.cr, d.n)}</td>
          <td style="padding:.28rem .55rem;text-align:right;font-size:.62rem;color:var(--mut)">${pc1(valG(d), tot)}</td>
        </tr>`).join('')}</tbody></table>`;
    }
  }

  window.initCitas = function () {
    if (!FILAS.length) {
      const v = document.getElementById('view-citas');
      if (v) v.innerHTML = '<div class="card"><div class="cb" style="padding:1rem">' +
        '<p style="font-size:.7rem;color:var(--mut)">La hoja «Citas Servicios Trimestrales» no trajo datos.</p></div></div>';
      return;
    }
    render();
  };
})();
