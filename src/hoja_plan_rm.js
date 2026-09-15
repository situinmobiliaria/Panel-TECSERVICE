// ═══════════════════════════════════════════════════════════════
// hoja_plan_rm.js — Plan RM y Región de Valparaíso
// Los clientes con Potencial de ST de las dos regiones repartidos en
// tres grupos de visita, y la agenda de los nuevos KAM desde octubre.
// Depende de: APP_DATA.plan_rm (extractor.build_plan_rm), utils.js,
//             Leaflet, xlsx-js-style
// ═══════════════════════════════════════════════════════════════
(function () {
  const A = window.APP_DATA || {};
  const P = A.plan_rm || {};
  if (!P.clientes || !P.clientes.length) return;

  const C = P.clientes, AG = P.agenda || [], SEM = P.semanas || [];
  const REGS = P.regiones || ['Metropolitana', 'Valparaíso'];
  const LBL_REG = { 'Metropolitana': 'Región Metropolitana', 'Valparaíso': 'Región de Valparaíso' };

  // Un color por grupo, el mismo en tablas, agenda y mapa. El tono de fondo es
  // translúcido para que funcione sobre el fondo claro y el oscuro del panel.
  const GRUPO = {
    1: { nom: 'Grupo 1 · Top ' + P.top_pot + ' por potencial ST', quien: 'Cristian / Eglys',
         col: '#002D73', fondo: 'rgba(0,45,115,.11)', xl: 'DCE6F4' },
    2: { nom: 'Grupo 2 · Top ' + P.top_camas + ' por camas', quien: 'Nuevos KAM · con plan de entrada',
         col: '#B86E00', fondo: 'rgba(255,170,20,.17)', xl: 'FFEFC9' },
    3: { nom: 'Grupo 3 · Resto de la cartera', quien: 'Nuevos KAM · sin plan escrito',
         col: '#2E7D4F', fondo: 'rgba(46,125,79,.08)', xl: 'E8F3EC' },
  };
  const KAMCOL = { 'KAM 1': '#0A5C8C', 'KAM 2': '#D46000' };

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n0 = v => Math.round(v || 0).toLocaleString('es-CL');
  const n1 = v => (+v || 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
                  'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fecha = iso => { const p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const fCorta = iso => { const d = fecha(iso); return DIAS[d.getDay()].slice(0, 3) + ' ' +
    String(d.getDate()).padStart(2, '0') + ' ' + MESES[d.getMonth()]; };
  const fLarga = iso => { const d = fecha(iso); const x = DIAS[d.getDay()];
    return x.charAt(0).toUpperCase() + x.slice(1) + ' ' + d.getDate() + ' de ' + MESESL[d.getMonth()]; };
  const semLbl = s => { const w = SEM.find(x => x.s === s); if (!w) return 'Semana ' + s;
    const a = fecha(w.desde), b = fecha(w.hasta);
    return 'Semana ' + s + ' · ' + a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MESES[a.getMonth()] : '') +
      '–' + b.getDate() + ' ' + MESES[b.getMonth()]; };
  const aprox = u => /^Aprox/.test(u.prec);

  // ── Planes de entrada ────────────────────────────────────────
  // Se guardan en este navegador mientras el KAM escribe. El panel es un
  // archivo estático y no tiene dónde guardarlos para todos: para compartirlos
  // se exporta el Excel, que los lleva en su columna.
  const LS_KEY = 'planrm_planes_v1';
  let planes = {};
  try { planes = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { planes = {}; }
  window._prmPlan = function (el) {
    const u = C[+el.dataset.i];
    if (!u) return;
    planes[u.n] = el.value;
    try { localStorage.setItem(LS_KEY, JSON.stringify(planes)); } catch (e) { /* sin almacenamiento */ }
    const cnt = document.getElementById('prm-planes-cnt');
    if (cnt) cnt.textContent = contarPlanes();
  };
  const contarPlanes = () => {
    const g2 = C.filter(u => u.g === 2);
    return g2.filter(u => (planes[u.n] || '').trim()).length + ' de ' + g2.length + ' planes escritos';
  };

  // ── Estado ───────────────────────────────────────────────────
  const _filtro = { 'Metropolitana': 'todos', 'Valparaíso': 'todos' };
  const _busq = { 'Metropolitana': '', 'Valparaíso': '' };
  let _sem = SEM.length ? SEM[0].s : 'todas';
  let _kam = 'ambos';
  let _map = null, _capa = null;

  // ── Estructura ───────────────────────────────────────────────
  const btnExp = (id, onclick, txt, verde) =>
    '<button id="' + id + '" onclick="' + onclick + '" style="margin-left:auto;font-size:.58rem;padding:.22rem .7rem;' +
    'background:' + (verde ? '#0F7B3F' : '#002D73') + ';color:#fff;border:none;border-radius:4px;cursor:pointer;' +
    'white-space:nowrap">' + txt + '</button>';

  function markup() {
    const tablaReg = reg => {
      const id = reg === 'Metropolitana' ? 'rm' : 'va';
      return `
      <div class="card" style="margin-top:.9rem" id="prm-card-${id}">
        <div class="ch" style="flex-wrap:wrap;gap:.5rem">
          <span class="ct">${esc(LBL_REG[reg])} · clientes con Potencial de ST</span>
          <span style="font-size:.57rem;color:var(--mut)" id="prm-sub-${id}">—</span>
          <div id="prm-fil-${id}" style="display:flex;gap:.25rem;margin-left:.4rem"></div>
          <input id="prm-q-${id}" placeholder="Buscar cliente o comuna…" oninput="window._prmBusq('${reg}',this.value)"
            style="font-size:.6rem;padding:.2rem .45rem;border:1px solid var(--brd);border-radius:3px;
                   background:var(--bg2);color:var(--txt);min-width:170px">
          ${btnExp('prm-exp-' + id, "exportarPanel({ids:['prm-card-" + id + "'],titulo:'Plan " + esc(LBL_REG[reg]) + "',archivo:'Plan_" + id.toUpperCase() + "',btn:'prm-exp-" + id + "',ancho:2200})", 'Exportar')}
        </div>
        <div class="cb" style="padding:.7rem .8rem"><div id="prm-tab-${id}"></div></div>
      </div>`;
    };

    return `
    <div class="sh"><h2>Plan RM y Región de Valparaíso</h2><div class="sh-line"></div>
      <span class="sh-tag">Clientes con Potencial de ST · visitas de Cristian, Eglys y los nuevos KAM</span></div>

    <div class="g5" id="prm-kpi" style="grid-template-columns:repeat(5,1fr);margin-bottom:.9rem"></div>

    <div class="card" id="prm-como">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem"><span class="ct">Cómo se arma el plan</span>
        ${btnExp('prm-como-pdf', "exportarPanel({ids:['prm-como'],titulo:'Plan RM y Valparaíso · Cómo se arma',archivo:'Plan_RM_como_se_arma',btn:'prm-como-pdf',ancho:1500})", 'Exportar')}
      </div>
      <div class="cb" style="padding:.85rem .9rem"><div id="prm-flujo"></div></div>
    </div>

    <div class="card" style="margin-top:.9rem">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Planilla del plan</span>
        <span style="font-size:.58rem;color:var(--mut)" id="prm-planes-cnt">—</span>
        ${btnExp('prm-xls', 'window._prmExcelPlan()', 'Exportar Excel del plan', true)}
      </div>
      <div class="cb" style="padding:.55rem .9rem;font-size:.6rem;color:var(--mut);line-height:1.6">
        En las tablas de abajo, los clientes del <strong style="color:${GRUPO[2].col}">grupo 2</strong> tienen una
        columna <strong>Plan de entrada</strong> para que el KAM escriba cómo pretende entrar. Lo escrito se guarda en
        <strong>este navegador</strong>: para compartirlo con el equipo usa <strong>Exportar Excel del plan</strong>, que
        lleva ambas regiones con los planes escritos.
      </div>
    </div>

    ${tablaReg('Metropolitana')}
    ${tablaReg('Valparaíso')}

    <div class="sh" style="margin-top:1.5rem"><h2>Agenda de los nuevos KAM</h2><div class="sh-line"></div>
      <span class="sh-tag" id="prm-ag-tag">—</span></div>

    <div class="card" id="prm-ag-card">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Visitas</span>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-left:.3rem">Semana</span>
        <select id="prm-sem" onchange="window._prmSem(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
        <button onclick="window._prmSemPaso(-1)" title="Semana anterior" style="font-size:.6rem;padding:.14rem .45rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">‹</button>
        <button onclick="window._prmSemPaso(1)" title="Semana siguiente" style="font-size:.6rem;padding:.14rem .45rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt);cursor:pointer">›</button>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-left:.5rem">KAM</span>
        <div id="prm-kam" style="display:flex;gap:.25rem"></div>
        ${btnExp('prm-ag-xls', 'window._prmExcelAgenda()', 'Exportar Excel de la agenda', true)}
      </div>
      <div class="cb" style="padding:.75rem .9rem">
        <div id="prm-ag-res" style="font-size:.62rem;margin-bottom:.6rem;line-height:1.6"></div>
        <div style="display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:.9rem;align-items:start">
          <div>
            <div id="prm-map" style="height:560px;border-radius:6px;overflow:hidden;border:1px solid var(--brd)"></div>
            <div id="prm-map-leg" style="font-size:.57rem;color:var(--mut);margin-top:.4rem;line-height:1.6"></div>
          </div>
          <div id="prm-ag-tab" style="max-height:600px;overflow-y:auto"></div>
        </div>
      </div>
    </div>`;
  }

  // ── Segmentadores ────────────────────────────────────────────
  function botones(id, opts, activo, fn) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML = opts.map(o => {
      const on = String(o[0]) === String(activo);
      const col = o[2] || 'var(--az1)';
      return '<button onclick="' + fn + '(\'' + o[0] + '\')" style="font-size:.57rem;padding:.2rem .6rem;border-radius:3px;' +
        'cursor:pointer;white-space:nowrap;border:1px solid ' + (on ? col : 'var(--brd)') + ';background:' +
        (on ? col : 'var(--bg2)') + ';color:' + (on ? '#fff' : 'var(--txt)') + ';font-weight:' + (on ? 700 : 400) + '">' +
        esc(o[1]) + '</button>';
    }).join('');
  }

  // ── KPIs ─────────────────────────────────────────────────────
  function kpis() {
    const box = document.getElementById('prm-kpi');
    if (!box) return;
    const cnt = g => C.filter(u => u.g === g).length;
    const porReg = g => REGS.map(r => C.filter(u => u.g === g && u.r === r).length).join(' RM · ') + ' V';
    const k = (col, val, lbl, sub) => '<div class="kpi" style="--kc:' + col + '">' +
      '<div class="kpi-lbl">' + lbl + '</div><div class="kpi-val">' + val + '</div>' +
      '<div class="kpi-sub">' + sub + '</div></div>';
    const fin = AG.length ? AG[AG.length - 1].f : '';
    const diasK = new Set(AG.filter(a => a.k === 'KAM 1').map(a => a.f)).size;
    box.innerHTML =
      k('var(--az3)', n0(C.length), 'Clientes del plan', REGS.map(r => n0(C.filter(u => u.r === r).length) +
        (r === 'Metropolitana' ? ' RM' : ' Valparaíso')).join(' · ')) +
      k(GRUPO[1].col, n0(cnt(1)), 'Cristian / Eglys', porReg(1) + ' · top por potencial ST') +
      k(GRUPO[2].col, n0(cnt(2)), 'KAM con plan de entrada', porReg(2) + ' · top por camas') +
      k(GRUPO[3].col, n0(cnt(3)), 'KAM sin plan escrito', porReg(3) + ' · resto de la cartera') +
      k('var(--or)', n0(AG.length), 'Visitas agendadas',
        diasK + ' días hábiles por KAM · ' + (AG.length ? fCorta(AG[0].f) + ' a ' + fCorta(fin) : '—'));
  }

  // ── Cómo se arma ─────────────────────────────────────────────
  function flujo() {
    const box = document.getElementById('prm-flujo');
    if (!box) return;
    const cnt = (g, r) => C.filter(u => u.g === g && (!r || u.r === r)).length;
    const paso = (g, titulo, criterio, detalle) => {
      const G = GRUPO[g];
      return '<div style="flex:1 1 0;min-width:220px;border:1px solid ' + G.col + '55;border-top:4px solid ' + G.col +
        ';border-radius:6px;padding:.7rem .8rem;background:' + G.fondo + '">' +
        '<div style="font-size:.56rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:' + G.col + '">Paso ' + g + '</div>' +
        '<div style="font-size:.78rem;font-weight:800;color:var(--txt);margin:.15rem 0 .1rem">' + titulo + '</div>' +
        '<div style="font-size:.63rem;font-weight:700;color:' + G.col + ';margin-bottom:.4rem">' + G.quien + '</div>' +
        '<div style="display:flex;gap:.9rem;margin-bottom:.45rem">' +
          REGS.map(r => '<div><div style="font-size:1.25rem;font-weight:900;color:' + G.col + ';line-height:1">' +
            cnt(g, r) + '</div><div style="font-size:.53rem;color:var(--mut)">' +
            (r === 'Metropolitana' ? 'RM' : 'Valparaíso') + '</div></div>').join('') +
        '</div>' +
        '<div style="font-size:.6rem;color:var(--txt);line-height:1.55"><strong>Criterio:</strong> ' + criterio + '</div>' +
        '<div style="font-size:.57rem;color:var(--mut);line-height:1.55;margin-top:.3rem">' + detalle + '</div></div>';
    };
    const flecha = '<div style="align-self:center;font-size:1.3rem;color:var(--mut);padding:0 .1rem">→</div>';

    const camF = f => C.filter(u => u.camF === f).length;
    const precC = f => C.filter(u => f(u.prec)).length;
    const k1 = C.filter(u => u.resp === 'KAM 1'), k2 = C.filter(u => u.resp === 'KAM 2');
    const topCom = lst => {
      const m = {};
      lst.forEach(u => { if (u.com && !aprox(u)) m[u.com] = (m[u.com] || 0) + 1; });
      return Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 6).join(', ');
    };
    const dups = C.filter(u => u.g === 2 && u.dup && u.dup.length);
    const med = P.medianas || {};
    const rem = C.filter(u => u.rem);

    box.innerHTML =
      '<p style="font-size:.63rem;line-height:1.65;margin:0 0 .8rem;color:var(--txt)">El universo son los clientes de la ' +
      '<strong>Región Metropolitana</strong> y de la <strong>Región de Valparaíso</strong> que tienen equipos con ' +
      '<strong>Potencial de ST</strong> —los mismos que muestra la hoja Base Instalada con el filtro ST = Sí—. Cada región ' +
      'se ordena por separado y cada cliente queda en un solo grupo: se elige primero el grupo 1, y los grupos 2 y 3 salen ' +
      'de los clientes que quedaron.</p>' +
      '<div style="display:flex;gap:.5rem;align-items:stretch;flex-wrap:wrap">' +
        paso(1, 'Top ' + P.top_pot + ' por potencial ST anual',
          'mayor potencial ST anual de mantenimiento de la base instalada con Potencial de ST (equipos de ' +
          'Esterilización, Endoscopía y Dental por su tarifa anual, sólo en clientes sin contrato).',
          'Son las cuentas donde hay más venta de mantenimiento por capturar; las toma el equipo con más experiencia.') + flecha +
        paso(2, 'Top ' + P.top_camas + ' del resto por camas',
          'de los clientes que no quedaron en el grupo 1, los de mayor número de camas. Las camas miden el tamaño de la ' +
          'institución y, con él, la puerta de entrada a futuros negocios.',
          'Para cada uno el KAM escribe un <strong>plan de entrada</strong> en la columna de la tabla.') + flecha +
        paso(3, 'Resto de la cartera',
          'todos los demás clientes con Potencial de ST de la región.',
          'Los visitan los mismos KAM dentro de su agenda, sin plan escrito.') +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin-top:.9rem">' +
        '<div style="border:1px solid var(--brd);border-radius:6px;padding:.6rem .75rem;background:var(--bg2)">' +
          '<div style="font-size:.6rem;font-weight:800;color:var(--az1);margin-bottom:.3rem">Agenda de los nuevos KAM</div>' +
          '<div style="font-size:.59rem;line-height:1.6">Visitan a los grupos 2 y 3: <strong>' + n0(AG.length) + '</strong> visitas, ' +
          '<strong>' + P.visitas_dia + ' por día</strong> cada uno y en paralelo, en días hábiles desde el <strong>' +
          (AG.length ? fLarga(AG[0].f) : '—') + '</strong> hasta el <strong>' + (AG.length ? fLarga(AG[AG.length - 1].f) : '—') +
          '</strong>. Primero los clientes con plan de entrada y después el resto. Se descuentan los feriados del ' +
          (P.feriados || []).map(f => fecha(f).getDate() + ' ' + MESES[fecha(f).getMonth()]).join(', ') + '.</div>' +
        '</div>' +
        '<div style="border:1px solid var(--brd);border-radius:6px;padding:.6rem .75rem;background:var(--bg2)">' +
          '<div style="font-size:.6rem;font-weight:800;color:var(--az1);margin-bottom:.3rem">Territorios</div>' +
          '<div style="font-size:.59rem;line-height:1.6">' +
          '<span style="color:' + KAMCOL['KAM 1'] + ';font-weight:800">KAM 1</span> · ' + k1.length + ' clientes de la RM ' +
          '(oriente, centro y sur): ' + esc(topCom(k1)) + '.<br>' +
          '<span style="color:' + KAMCOL['KAM 2'] + ';font-weight:800">KAM 2</span> · ' + k2.length + ' clientes: toda la ' +
          'Región de Valparaíso y el poniente de la RM, que es el lado que da hacia la costa: ' + esc(topCom(k2)) + '. ' +
          'Hace Valparaíso en un bloque seguido para no ir y volver desde Santiago en la misma semana.<br>' +
          'Cada día junta ' + P.visitas_dia + ' clientes cercanos entre sí.</div>' +
        '</div>' +
        '<div style="border:1px solid var(--brd);border-radius:6px;padding:.6rem .75rem;background:var(--bg2)">' +
          '<div style="font-size:.6rem;font-weight:800;color:var(--az1);margin-bottom:.3rem">De dónde salen los datos</div>' +
          '<div style="font-size:.59rem;line-height:1.6">' +
          '<strong>Camas:</strong> ' + camF('Registro') + ' clientes cruzados con el registro de camas por establecimiento; ' +
          camF('Estimado') + ' hospitales o clínicas que no figuran en él, estimados con la mediana de su tipo en la región ' +
          '(RM: hospitales ' + ((med['Metropolitana'] || {}).hospital || '—') + ', clínicas ' + ((med['Metropolitana'] || {}).clinica || '—') +
          '; Valparaíso: hospitales ' + ((med['Valparaíso'] || {}).hospital || '—') + ', clínicas ' + ((med['Valparaíso'] || {}).clinica || '—') +
          '); ' + camF('Sin internación') + ' sin internación (dentales, CESFAM, centros médicos, empresas).<br>' +
          '<strong>Ubicación:</strong> ' + precC(p => /Direcci|Base Mapa|DEIS/.test(p)) + ' por dirección o establecimiento, ' +
          precC(p => /comuna/.test(p)) + ' en el centro de su comuna y ' + precC(p => /^Aprox/.test(p)) +
          ' <strong>por confirmar</strong>, que la agenda ubica en el centro de la región.</div>' +
        '</div>' +
      '</div>' +
      ((dups.length || rem.length) ? '<div style="margin-top:.7rem;padding:.5rem .75rem;border-left:3px solid var(--or);' +
        'background:rgba(212,96,0,.07);border-radius:4px;font-size:.59rem;line-height:1.6">' +
        (dups.length ? '<strong>Misma institución con dos cuentas:</strong> ' + dups.map(u => esc(u.n) + ' ↔ ' +
          esc(u.dup.join(', '))).filter((x, i, a) => a.indexOf(x) === i).join(' · ') +
          '. Calzan con el mismo establecimiento del registro y ocupan dos lugares del top ' + P.top_camas +
          '; conviene que el KAM haga un solo plan para ambas.<br>' : '') +
        (rem.length ? '<strong>' + rem.map(u => esc(u.n)).join(', ') + '</strong> está en Isla de Pascua: queda a cargo del ' +
          'KAM 2 pero fuera de la agenda, porque requiere un viaje aparte.' : '') + '</div>' : '');
  }

  // ── Tablas por región ────────────────────────────────────────
  window._prmFil = function (reg, g) { _filtro[reg] = g; tabla(reg); };
  window._prmBusq = function (reg, q) { _busq[reg] = q; tabla(reg); };

  function tabla(reg) {
    const id = reg === 'Metropolitana' ? 'rm' : 'va';
    const box = document.getElementById('prm-tab-' + id);
    if (!box) return;
    const todos = C.map((u, i) => Object.assign({ i: i }, u)).filter(u => u.r === reg);
    botones('prm-fil-' + id, [['todos', 'Todos'], ['1', 'Grupo 1', GRUPO[1].col], ['2', 'Grupo 2', GRUPO[2].col],
                              ['3', 'Grupo 3', GRUPO[3].col]], _filtro[reg], "window._prmFil.bind(null,'" + reg + "')");
    const q = (_busq[reg] || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = todos.filter(u => (_filtro[reg] === 'todos' || String(u.g) === _filtro[reg]) &&
      (!q || (u.n + ' ' + u.com).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)))
      .sort((a, b) => a.g - b.g || a.rk - b.rk);

    const sub = document.getElementById('prm-sub-' + id);
    if (sub) sub.textContent = todos.length + ' clientes · grupo 1: ' + todos.filter(u => u.g === 1).length +
      ' · grupo 2: ' + todos.filter(u => u.g === 2).length + ' · grupo 3: ' + todos.filter(u => u.g === 3).length;

    const TH = 'position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.38rem .45rem;font-size:.54rem;' +
      'letter-spacing:.03em;white-space:nowrap;border-right:1px solid rgba(255,255,255,.18)';
    const th = (t, al, tip) => '<th style="' + TH + ';text-align:' + (al || 'left') + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + t + '</th>';
    const td = (v, al, st) => '<td style="padding:.3rem .45rem;font-size:.6rem;text-align:' + (al || 'left') +
      ';border-right:1px solid var(--brd);vertical-align:top;' + (st || '') + '">' + v + '</td>';
    const num = (v, st) => td(v, 'right', 'font-variant-numeric:tabular-nums;white-space:nowrap;' + (st || ''));

    let html = '<div style="overflow:auto;max-height:640px;border:1px solid var(--brd);border-radius:5px">' +
      '<table style="width:100%;border-collapse:collapse;min-width:1850px"><thead><tr>' +
      th('#', 'right', 'Posición dentro de su grupo') + th('CLIENTE') + th('RESPONSABLE') + th('1ª VISITA') +
      th('CAMAS', 'right', 'Camas totales del establecimiento según el registro de camas; «est.» si se estimó') +
      th('POT. ST ANUAL', 'right', 'Potencial ST anual de mantenimiento de la base instalada con Potencial de ST') +
      th('EQUIPOS ST', 'right', 'Equipos de la base instalada con Potencial de ST') +
      th('DENTAL', 'right') + th('ESTERIL.', 'right') + th('ENDOSC.', 'right') + th('INCARDIA', 'right') +
      th('MOBIL.', 'right') + th('OTROS', 'right') +
      th('% V. ÚTIL', 'right', 'Promedio del % de vida útil consumida de sus equipos') +
      th('FACT. 2026', 'right') + th('FACT. 2025', 'right') + th('RELACIÓN') +
      th('PLAN DE ENTRADA (KAM)', 'left', 'Sólo grupo 2: cómo pretende entrar el KAM a este cliente') +
      '</tr></thead><tbody>';

    let gAnt = null;
    lista.forEach(u => {
      const G = GRUPO[u.g];
      if (u.g !== gAnt) {
        const n = todos.filter(x => x.g === u.g).length;
        html += '<tr><td colspan="18" style="padding:.42rem .6rem;background:' + G.col + ';color:#fff;font-size:.64rem;' +
          'font-weight:800;letter-spacing:.02em">' + G.nom + ' · ' + G.quien +
          ' <span style="font-weight:400;opacity:.85">· ' + n + ' clientes</span></td></tr>';
        gAnt = u.g;
      }
      const e = u.eq || {};
      const vis = u.g === 1 ? '<span style="color:' + G.col + ';font-weight:700">cartera propia</span>'
        : u.rem ? '<span style="color:var(--or);font-weight:700">viaje aparte</span>'
        : u.v1 ? '<span style="white-space:nowrap">' + fCorta(u.v1) + '</span>' : '—';
      const cam = u.camF === 'Sin internación'
        ? '<span style="color:var(--mut)" title="' + esc(u.camN) + '">—</span>'
        : n0(u.cam) + (u.camF === 'Estimado' ? ' <span style="font-size:.5rem;font-weight:700;color:#B86E00;border:1px solid #B86E0066;' +
            'border-radius:3px;padding:0 .2rem" title="' + esc(u.camN) + '">est.</span>' : '');
      const camTip = u.camR ? ' title="' + esc(u.camR) + '"' : '';
      const vu = u.vu == null ? '<span style="color:var(--mut)">—</span>'
        : '<span style="font-weight:700;color:' + (u.vu >= 100 ? 'var(--rd)' : u.vu >= 80 ? 'var(--or)' : u.vu >= 60 ? 'var(--am)' : 'var(--gn)') + '">' + n1(u.vu) + '%</span>';
      const plan = u.g === 2
        ? '<textarea data-i="' + u.i + '" oninput="window._prmPlan(this)" rows="2" placeholder="¿Cómo entramos a este cliente?" ' +
          'style="width:100%;min-width:300px;font-size:.6rem;font-family:inherit;padding:.25rem .35rem;border:1px solid ' + G.col + '66;' +
          'border-radius:3px;background:var(--bg);color:var(--txt);resize:vertical">' + esc(planes[u.n] || '') + '</textarea>'
        : '<span style="color:var(--mut);font-size:.55rem">' + (u.g === 1 ? 'lo visitan Cristian / Eglys' : 'sin plan escrito') + '</span>';

      html += '<tr style="background:' + G.fondo + ';border-left:4px solid ' + G.col + ';border-bottom:1px solid var(--brd)">' +
        num(u.rk, 'color:' + G.col + ';font-weight:800') +
        td('<div style="font-weight:700;font-size:.62rem;max-width:280px">' + esc(u.n) + '</div>' +
           '<div style="font-size:.54rem;color:var(--mut)">' + esc(u.com || 'comuna sin dato') +
           (aprox(u) ? ' · <span style="color:var(--or)">ubicación por confirmar</span>' : '') + '</div>' +
           (u.dup && u.dup.length ? '<div style="font-size:.53rem;color:var(--or);font-weight:700">⚑ misma institución que ' +
             esc(u.dup.join(', ')) + '</div>' : '')) +
        td('<span style="font-weight:700;color:' + (KAMCOL[u.resp] || G.col) + ';white-space:nowrap">' + esc(u.resp) + '</span>') +
        td(vis) +
        '<td style="padding:.3rem .45rem;font-size:.6rem;text-align:right;border-right:1px solid var(--brd);vertical-align:top;' +
          'font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:' + (u.g === 2 ? 800 : 600) + '"' + camTip + '>' + cam + '</td>' +
        num(u.pot ? mm(u.pot) : '<span style="color:var(--mut)">' + (u.cc ? 'contrato' : '—') + '</span>', u.g === 1 ? 'font-weight:800;color:' + G.col : '') +
        num(n0(e.total), 'font-weight:700') +
        num(e.dental ? n0(e.dental) : '—', 'color:var(--mut)') + num(e.esterilizacion ? n0(e.esterilizacion) : '—', 'color:var(--mut)') +
        num(e.endoscopia ? n0(e.endoscopia) : '—', 'color:var(--mut)') + num(e.incardia ? n0(e.incardia) : '—', 'color:var(--mut)') +
        num(e.mobiliario ? n0(e.mobiliario) : '—', 'color:var(--mut)') +
        num((e.otros || 0) + (e.mmq_reas || 0) ? n0((e.otros || 0) + (e.mmq_reas || 0)) : '—', 'color:var(--mut)') +
        num(vu) + num(u.f26 ? mm(u.f26) : '—') + num(u.f25 ? mm(u.f25) : '—', 'color:var(--mut)') +
        td('<span style="font-size:.56rem;white-space:nowrap">' + esc(u.rel) + '</span>') +
        td(plan, 'left', 'min-width:310px') +
        '</tr>';
    });
    if (!lista.length) html += '<tr><td colspan="18" style="padding:1rem;text-align:center;color:var(--mut);font-size:.62rem">Sin clientes para este filtro.</td></tr>';
    html += '</tbody></table></div>' +
      '<p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">' +
      'Las <strong>camas</strong> vienen del registro de camas por establecimiento; al pasar el mouse se ve con qué establecimiento ' +
      'se cruzó. <strong>est.</strong> marca a los hospitales y clínicas que no figuran en el registro, estimados con la mediana de ' +
      'su tipo en la región. Los equipos, el potencial y el % de vida útil son de la base instalada con Potencial de ST. ' +
      'La <strong>1ª visita</strong> es el día que le toca en la agenda de los KAM.</p>';
    box.innerHTML = html;
  }

  // ── Agenda ───────────────────────────────────────────────────
  window._prmSem = function (v) { _sem = v === 'todas' ? 'todas' : +v; agenda(); };
  window._prmSemPaso = function (d) {
    const lst = SEM.map(s => s.s);
    const i = _sem === 'todas' ? (d > 0 ? -1 : lst.length) : lst.indexOf(_sem);
    const j = Math.max(0, Math.min(lst.length - 1, i + d));
    _sem = lst[j];
    agenda();
  };
  window._prmKam = function (v) { _kam = v; agenda(); };
  window._prmFoco = function (i) {
    if (!_map || !_capa) return;
    _capa.eachLayer(l => { if (l._prmI === i && l.openPopup) { _map.setView(l.getLatLng(), Math.max(_map.getZoom(), 13)); l.openPopup(); } });
  };

  function agenda() {
    const selS = document.getElementById('prm-sem');
    if (selS) {
      selS.innerHTML = '<option value="todas"' + (_sem === 'todas' ? ' selected' : '') + '>Todas las semanas</option>' +
        SEM.map(s => '<option value="' + s.s + '"' + (s.s === _sem ? ' selected' : '') + '>' + esc(semLbl(s.s)) + '</option>').join('');
    }
    botones('prm-kam', [['ambos', 'Ambos'], ['KAM 1', 'KAM 1', KAMCOL['KAM 1']], ['KAM 2', 'KAM 2', KAMCOL['KAM 2']]],
            _kam, 'window._prmKam');

    const vis = AG.filter(a => (_sem === 'todas' || a.s === _sem) && (_kam === 'ambos' || a.k === _kam));
    const tag = document.getElementById('prm-ag-tag');
    if (tag) tag.textContent = n0(AG.length) + ' visitas · ' + P.visitas_dia + ' por día por KAM · ' +
      (AG.length ? fCorta(AG[0].f) + ' a ' + fCorta(AG[AG.length - 1].f) : '');

    const res = document.getElementById('prm-ag-res');
    if (res) {
      const porK = k => vis.filter(a => a.k === k).length;
      const g2 = vis.filter(a => C[a.c].g === 2).length;
      const ap = vis.filter(a => aprox(C[a.c])).length;
      const dias = new Set(vis.map(a => a.f)).size;
      res.innerHTML = '<strong>' + (_sem === 'todas' ? 'Todas las semanas' : esc(semLbl(_sem))) + '</strong> · ' +
        '<strong>' + vis.length + '</strong> visitas en ' + dias + ' días' +
        (_kam === 'ambos' ? ' (<span style="color:' + KAMCOL['KAM 1'] + ';font-weight:700">KAM 1: ' + porK('KAM 1') + '</span> · ' +
          '<span style="color:' + KAMCOL['KAM 2'] + ';font-weight:700">KAM 2: ' + porK('KAM 2') + '</span>)' : '') +
        ' · <span style="color:' + GRUPO[2].col + ';font-weight:700">' + g2 + ' con plan de entrada</span>' +
        (ap ? ' · <span style="color:var(--or)">' + ap + ' con ubicación por confirmar</span>' : '');
    }

    // Tabla por día
    const tb = document.getElementById('prm-ag-tab');
    if (tb) {
      if (!vis.length) {
        tb.innerHTML = '<div style="padding:1.2rem;text-align:center;color:var(--mut);font-size:.65rem">Sin visitas para este filtro.</div>';
      } else {
        const TH = 'position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.34rem .45rem;font-size:.53rem;letter-spacing:.03em;text-align:left;white-space:nowrap';
        let h = '<table style="width:100%;border-collapse:collapse"><thead><tr>' +
          ['HORA', 'KAM', 'CLIENTE', 'GRUPO', 'CAMAS', 'POT. ST'].map((t, i) =>
            '<th style="' + TH + (i >= 4 ? ';text-align:right' : '') + '">' + t + '</th>').join('') + '</tr></thead><tbody>';
        let dAnt = null;
        vis.slice().sort((a, b) => a.f.localeCompare(b.f) || a.k.localeCompare(b.k) || a.o - b.o).forEach(a => {
          const u = C[a.c], G = GRUPO[u.g];
          if (a.f !== dAnt) {
            h += '<tr><td colspan="6" style="padding:.36rem .5rem;background:var(--gy);font-size:.62rem;font-weight:800;' +
              'color:var(--az1);border-top:1px solid var(--brd)">' + fLarga(a.f) + '</td></tr>';
            dAnt = a.f;
          }
          h += '<tr onclick="window._prmFoco(' + a.c + ')" style="cursor:pointer;border-bottom:1px solid var(--brd);border-left:3px solid ' + G.col + '">' +
            '<td style="padding:.28rem .45rem;font-size:.58rem;font-variant-numeric:tabular-nums;white-space:nowrap">' + a.h + '</td>' +
            '<td style="padding:.28rem .45rem;font-size:.58rem;font-weight:800;color:' + KAMCOL[a.k] + ';white-space:nowrap">' + a.k + '</td>' +
            '<td style="padding:.28rem .45rem;font-size:.6rem"><div style="font-weight:700">' + esc(u.n) + '</div>' +
              '<div style="font-size:.53rem;color:var(--mut)">' + esc(u.com || 'comuna sin dato') + ' · ' + esc(u.r === 'Metropolitana' ? 'RM' : 'Valparaíso') +
              (aprox(u) ? ' · <span style="color:var(--or)">ubicación por confirmar</span>' : '') +
              (u.dir ? ' · ' + esc(u.dir) : '') + '</div></td>' +
            '<td style="padding:.28rem .45rem;font-size:.55rem;white-space:nowrap"><span style="color:#fff;background:' + G.col +
              ';border-radius:3px;padding:.05rem .3rem;font-weight:700">G' + u.g + '</span>' +
              (u.g === 2 ? ' <span style="color:' + G.col + ';font-weight:700">plan</span>' : '') + '</td>' +
            '<td style="padding:.28rem .45rem;font-size:.58rem;text-align:right;font-variant-numeric:tabular-nums">' +
              (u.camF === 'Sin internación' ? '—' : n0(u.cam) + (u.camF === 'Estimado' ? '*' : '')) + '</td>' +
            '<td style="padding:.28rem .45rem;font-size:.58rem;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">' +
              (u.pot ? mm(u.pot) : '—') + '</td></tr>';
        });
        tb.innerHTML = h + '</tbody></table>';
      }
    }
    mapa(vis);
  }

  function mapa(vis) {
    const el = document.getElementById('prm-map');
    if (!el || typeof L === 'undefined') return;
    if (!_map) {
      _map = L.map('prm-map', { zoomControl: true, scrollWheelZoom: true }).setView([-33.3, -71.0], 8);
      if (window.mapaTiles) window.mapaTiles(_map);
      _capa = L.layerGroup().addTo(_map);
    }
    _capa.clearLayers();
    const pts = [];
    // Una línea por día y KAM, en el orden de la visita: muestra el recorrido.
    // Con todas las semanas a la vista las líneas se superponen y no dicen
    // nada, así que sólo se dibujan para una semana.
    if (_sem !== 'todas') {
      const dias = {};
      vis.forEach(a => { (dias[a.k + a.f] = dias[a.k + a.f] || []).push(a); });
      Object.values(dias).forEach(lst => {
        lst.sort((a, b) => a.o - b.o);
        const ll = lst.map(a => [C[a.c].lat, C[a.c].lon]);
        if (ll.length > 1) L.polyline(ll, { color: KAMCOL[lst[0].k], weight: 2.5, opacity: .75, dashArray: '6 5' }).addTo(_capa);
      });
    }
    vis.forEach(a => {
      const u = C[a.c], G = GRUPO[u.g], col = KAMCOL[a.k];
      const ap = aprox(u);
      const icono = L.divIcon({
        className: '',
        iconSize: [22, 22], iconAnchor: [11, 11],
        html: '<div style="width:22px;height:22px;border-radius:50%;background:' + (ap ? '#fff' : col) + ';color:' + (ap ? col : '#fff') +
          ';border:2px ' + (ap ? 'dashed ' + col : 'solid ' + (u.g === 2 ? '#FFB020' : '#fff')) + ';display:flex;align-items:center;' +
          'justify-content:center;font:700 10px Roboto,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35)">' + a.o + '</div>',
      });
      const m = L.marker([u.lat, u.lon], { icon: icono });
      m._prmI = a.c;
      m.bindPopup('<div style="font-family:Roboto,sans-serif;min-width:220px">' +
        '<div style="font-weight:800;font-size:.78rem;color:' + col + '">' + esc(u.n) + '</div>' +
        '<div style="font-size:.66rem;color:#555;margin:.1rem 0 .3rem">' + fLarga(a.f) + ' · ' + a.h + ' · ' + a.k + '</div>' +
        '<div style="font-size:.65rem;line-height:1.55">' +
          '<span style="color:#fff;background:' + G.col + ';border-radius:3px;padding:0 .3rem;font-weight:700">' + G.nom + '</span><br>' +
          esc(u.com || 'comuna sin dato') + (u.dir ? ' · ' + esc(u.dir) : '') + '<br>' +
          'Camas: <strong>' + (u.camF === 'Sin internación' ? 'sin internación' : n0(u.cam) + (u.camF === 'Estimado' ? ' (estimadas)' : '')) + '</strong> · ' +
          'Potencial ST anual: <strong>' + (u.pot ? mm(u.pot) : '—') + '</strong><br>' +
          'Equipos ST: <strong>' + n0((u.eq || {}).total) + '</strong> · Fact. 2026: <strong>' + (u.f26 ? mm(u.f26) : '—') + '</strong>' +
          (ap ? '<br><span style="color:#D46000">Ubicación por confirmar: se muestra en el centro de la región.</span>' : '') +
          (u.g === 2 && (planes[u.n] || '').trim() ? '<br><em>Plan: ' + esc(planes[u.n]) + '</em>' : '') +
        '</div></div>');
      m.addTo(_capa);
      pts.push([u.lat, u.lon]);
    });
    if (pts.length) _map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 13 });
    setTimeout(() => _map && _map.invalidateSize(), 60);

    const leg = document.getElementById('prm-map-leg');
    if (leg) {
      const bola = (bg, fg, borde, txt) => '<span style="display:inline-flex;align-items:center;gap:.25rem;margin-right:.8rem">' +
        '<span style="width:14px;height:14px;border-radius:50%;background:' + bg + ';border:2px ' + borde + ';display:inline-block"></span>' + txt + '</span>';
      leg.innerHTML = bola(KAMCOL['KAM 1'], '#fff', 'solid #fff', 'KAM 1') + bola(KAMCOL['KAM 2'], '#fff', 'solid #fff', 'KAM 2') +
        bola('#888', '#fff', 'solid #FFB020', 'borde amarillo: grupo 2, con plan de entrada') +
        bola('#fff', '#888', 'dashed #888', 'ubicación por confirmar') +
        '<br>El número es el orden de la visita en el día' + (_sem !== 'todas' ? ' y la línea punteada, el recorrido de cada día.' : '. Elige una semana para ver los recorridos.') +
        ' Clic en una fila de la tabla para ubicarla en el mapa.';
    }
  }

  // ── Excel ────────────────────────────────────────────────────
  const BORDE = { style: 'thin', color: { rgb: 'D4D5E8' } };
  const BOX = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  const sCab = { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '002D73' } },
                 alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BOX };
  const sGrupo = g => ({ font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
                         fill: { patternType: 'solid', fgColor: { rgb: GRUPO[g].col.slice(1) } }, border: BOX });
  const sCel = (g, extra) => Object.assign({ font: { sz: 9 }, fill: { patternType: 'solid', fgColor: { rgb: GRUPO[g].xl } },
                                            border: BOX, alignment: { vertical: 'top', wrapText: true } }, extra || {});

  function hojaDesdeFilas(cab, filas, anchos) {
    const ws = XLSX.utils.aoa_to_sheet([cab].concat(filas.map(f => f.v)));
    cab.forEach((c, ci) => { const r = XLSX.utils.encode_cell({ r: 0, c: ci }); ws[r].s = sCab; });
    filas.forEach((f, ri) => {
      cab.forEach((c, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        ws[ref].s = f.titulo ? sGrupo(f.g) : sCel(f.g, f.fmt && f.fmt[ci] ? { numFmt: f.fmt[ci] } : null);
        if (!f.titulo && f.fmt && f.fmt[ci]) ws[ref].z = f.fmt[ci];
      });
    });
    ws['!cols'] = anchos.map(w => ({ wch: w }));
    ws['!rows'] = [{ hpt: 30 }];
    ws['!freeze'] = { xSplit: 2, ySplit: 1 };
    const merges = [];
    filas.forEach((f, ri) => { if (f.titulo) merges.push({ s: { r: ri + 1, c: 0 }, e: { r: ri + 1, c: cab.length - 1 } }); });
    ws['!merges'] = merges;
    return ws;
  }

  window._prmExcelPlan = function () {
    if (typeof XLSX === 'undefined') { alert('Librería Excel no cargada. Verifique conexión a internet e intente de nuevo.'); return; }
    const M = v => Math.round((v || 0) / 1e5) / 10;
    const cab = ['#', 'Cliente', 'Comuna', 'Responsable', '1ª visita', 'Camas', 'Fuente camas', 'Pot. ST anual MM$',
                 'Equipos ST', 'Dental', 'Esterilización', 'Endoscopía', 'Incardia', 'Mobiliario', 'Otros',
                 '% vida útil', 'Fact. 2026 MM$', 'Fact. 2025 MM$', 'Relación', 'Plan de entrada'];
    const fmt = [null, null, null, null, null, '#,##0', null, '#,##0.0', '#,##0', '#,##0', '#,##0', '#,##0', '#,##0',
                 '#,##0', '#,##0', '0.0', '#,##0.0', '#,##0.0', null, null];
    const wb = XLSX.utils.book_new();
    REGS.forEach(reg => {
      const us = C.filter(u => u.r === reg).sort((a, b) => a.g - b.g || a.rk - b.rk);
      const filas = [];
      let gAnt = null;
      us.forEach(u => {
        if (u.g !== gAnt) {
          filas.push({ titulo: true, g: u.g, v: [GRUPO[u.g].nom + ' · ' + GRUPO[u.g].quien] });
          gAnt = u.g;
        }
        const e = u.eq || {};
        filas.push({ g: u.g, fmt: fmt, v: [
          u.rk, u.n, u.com || '', u.resp,
          u.g === 1 ? 'Cartera Cristian / Eglys' : u.rem ? 'Viaje aparte' : (u.v1 ? fCorta(u.v1) : ''),
          u.camF === 'Sin internación' ? '' : u.cam, u.camF, M(u.pot), e.total || 0, e.dental || 0,
          e.esterilizacion || 0, e.endoscopia || 0, e.incardia || 0, e.mobiliario || 0,
          (e.otros || 0) + (e.mmq_reas || 0), u.vu == null ? '' : u.vu, M(u.f26), M(u.f25), u.rel,
          u.g === 2 ? (planes[u.n] || '') : (u.g === 1 ? '(Cristian / Eglys)' : '(sin plan escrito)'),
        ] });
      });
      const ws = hojaDesdeFilas(cab, filas, [4, 46, 18, 16, 14, 8, 14, 13, 9, 8, 11, 10, 9, 10, 8, 10, 12, 12, 16, 60]);
      XLSX.utils.book_append_sheet(wb, ws, reg === 'Metropolitana' ? 'Región Metropolitana' : 'Región de Valparaíso');
    });
    XLSX.writeFile(wb, 'Plan_RM_Valparaiso_' + (A.hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
  };

  window._prmExcelAgenda = function () {
    if (typeof XLSX === 'undefined') { alert('Librería Excel no cargada. Verifique conexión a internet e intente de nuevo.'); return; }
    const M = v => Math.round((v || 0) / 1e5) / 10;
    const cab = ['Semana', 'Fecha', 'Hora', 'Orden', 'Cliente', 'Región', 'Comuna', 'Dirección', 'Ubicación', 'Grupo',
                 'Camas', 'Pot. ST anual MM$', 'Equipos ST', 'Plan de entrada'];
    const fmt = [null, null, null, null, null, null, null, null, null, null, '#,##0', '#,##0.0', '#,##0', null];
    const wb = XLSX.utils.book_new();
    ['KAM 1', 'KAM 2'].forEach(k => {
      const filas = AG.filter(a => a.k === k).map(a => {
        const u = C[a.c];
        return { g: u.g, fmt: fmt, v: [semLbl(a.s), fLarga(a.f), a.h, a.o, u.n, u.r === 'Metropolitana' ? 'RM' : 'Valparaíso',
          u.com || '', u.dir || '', aprox(u) ? 'Por confirmar' : u.prec, 'Grupo ' + u.g,
          u.camF === 'Sin internación' ? '' : u.cam, M(u.pot), (u.eq || {}).total || 0, u.g === 2 ? (planes[u.n] || '') : ''] };
      });
      const ws = hojaDesdeFilas(cab, filas, [24, 24, 7, 6, 44, 11, 18, 34, 22, 9, 8, 13, 10, 50]);
      XLSX.utils.book_append_sheet(wb, ws, k);
    });
    XLSX.writeFile(wb, 'Agenda_KAM_' + (A.hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
  };

  // ── Render ───────────────────────────────────────────────────
  function render() {
    kpis();
    flujo();
    const cnt = document.getElementById('prm-planes-cnt');
    if (cnt) cnt.textContent = contarPlanes();
    REGS.forEach(tabla);
    agenda();
  }

  window.initPlanRM = function () {
    const w = document.getElementById('view-planrm');
    if (!w) return;
    if (!w.dataset.listo) { w.innerHTML = markup(); w.dataset.listo = '1'; render(); }
    else if (_map) setTimeout(() => _map.invalidateSize(), 60);
  };

  // Se engancha a la navegación como Prospectos BI: la vista se arma la
  // primera vez que se entra, no al cargar el panel.
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig.apply(this, arguments);
      if (name === 'planrm') setTimeout(window.initPlanRM, 80);
    };
  }
})();
