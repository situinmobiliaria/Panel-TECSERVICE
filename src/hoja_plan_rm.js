// ═══════════════════════════════════════════════════════════════
// hoja_plan_rm.js — Plan RM y Región de Valparaíso
// Los clientes con Potencial de ST de las dos regiones repartidos en
// tres grupos de visita, y la agenda de Eglys y Cristián desde octubre.
// Depende de: APP_DATA.plan_rm (extractor.build_plan_rm), utils.js,
//             Leaflet, xlsx-js-style
// ═══════════════════════════════════════════════════════════════
(function () {
  const A = window.APP_DATA || {};
  const P = A.plan_rm || {};
  if (!P.clientes || !P.clientes.length) return;

  const C = P.clientes, AG = P.agenda || [], SEM = P.semanas || [], EX = P.excluidos || [];
  const REGS = P.regiones || ['Metropolitana', 'Valparaíso'];
  const LBL_REG = { 'Metropolitana': 'Región Metropolitana', 'Valparaíso': 'Región de Valparaíso' };

  // Un color por grupo, el mismo en tablas, agenda y mapa. El tono de fondo es
  // translúcido para que funcione sobre el fondo claro y el oscuro del panel.
  const GRUPO = {
    1: { nom: 'Grupo 1 · Top ' + P.top_pot + ' por potencial ST', quien: 'Visita primero en la agenda',
         col: '#002D73', fondo: 'rgba(0,45,115,.11)', xl: 'DCE6F4' },
    2: { nom: 'Grupo 2 · Top ' + P.top_camas + ' por camas', quien: 'Con plan de entrada escrito',
         col: '#B86E00', fondo: 'rgba(255,170,20,.17)', xl: 'FFEFC9' },
    3: { nom: 'Grupo 3 · Clientes retail', quien: 'De mayor a menor potencial ST',
         col: '#2E7D4F', fondo: 'rgba(46,125,79,.08)', xl: 'E8F3EC' },
  };
  // Quién visita a cada cliente ya no depende del grupo sino de su comuna: los
  // tres grupos los atienden los mismos dos ejecutivos. Los colores son los
  // mismos que usa la hoja Visitas Ejecutivos.
  const EJES = P.ejecutivos || ['Eglys Ramírez', 'Cristián Pérez'];
  const EJECOL = { 'Eglys Ramírez': '#7A1FAA', 'Cristián Pérez': '#003F7F' };
  EJES.forEach((e, i) => { if (!EJECOL[e]) EJECOL[e] = ['#7A1FAA', '#003F7F', '#0A7D74'][i % 3]; });
  const ejeCorto = e => String(e || '').split(' ')[0];

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
      <span class="sh-tag">Clientes con Potencial de ST · cartera de Eglys Ramírez y Cristián Pérez por comuna</span></div>

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
        columna <strong>Plan de entrada</strong> para escribir cómo se pretende entrar. Lo escrito se guarda en
        <strong>este navegador</strong>: para compartirlo con el equipo usa <strong>Exportar Excel del plan</strong>, que
        lleva ambas regiones con los planes escritos.
      </div>
    </div>

    ${tablaReg('Metropolitana')}
    ${tablaReg('Valparaíso')}

    <div class="sh" style="margin-top:1.5rem"><h2>Agenda de visitas</h2><div class="sh-line"></div>
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
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-left:.5rem">Ejecutivo</span>
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
    </div>

    <div class="card" style="margin-top:.9rem" id="prm-cal-card">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Calendario de visitas · seguimiento</span>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-left:.3rem">Ejecutivo</span>
        <div id="prm-cal-eje" style="display:flex;gap:.25rem"></div>
        <span style="font-size:.55rem;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-left:.4rem">Mes</span>
        <select id="prm-cal-mes" onchange="window._prmCalMes(this.value)" style="font-size:.6rem;padding:.2rem .4rem;
          border:1px solid var(--brd);border-radius:3px;background:var(--bg2);color:var(--txt)"></select>
        <span style="font-size:.57rem;color:var(--mut)" id="prm-cal-tag">—</span>
        ${btnExp('prm-cal-xls', 'window._prmExcelCal()', 'Exportar Excel del calendario', true)}
      </div>
      <div class="cb" style="padding:.7rem .9rem">
        <div id="prm-cal" style="max-height:460px;overflow:auto"></div>
        <p style="font-size:.56rem;color:var(--mut);margin:.5rem 0 0;line-height:1.55">
          Una fila por semana y ejecutivo, con los días trabajados, las visitas, cómo se reparten entre los tres
          grupos y las dos regiones, las comunas que toca y el potencial ST que suma esa semana. Los selectores de
          <strong>ejecutivo</strong> y <strong>mes</strong> son propios de esta tabla y no mueven la agenda de
          arriba; el Excel sale con lo que se esté viendo, con una hoja de resumen semanal y otra con el detalle
          día por día, ambas con columnas en blanco para marcar el avance.</p>
      </div>
    </div>

    <div class="card" style="margin-top:.9rem" id="prm-gantt-card">
      <div class="ch" style="flex-wrap:wrap;gap:.5rem">
        <span class="ct">Carta Gantt del plan</span>
        <span style="font-size:.57rem;color:var(--mut)" id="prm-gantt-tag">—</span>
        ${btnExp('prm-gantt-pdf', "exportarPanel({ids:['prm-gantt-card'],titulo:'Plan RM y Valparaíso · Carta Gantt',archivo:'Plan_RM_carta_gantt',btn:'prm-gantt-pdf',ancho:1600})", 'Exportar')}
      </div>
      <div class="cb" style="padding:.75rem .9rem"><div id="prm-gantt"></div></div>
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
    const diasK = Math.max.apply(null, EJES.map(e => new Set(AG.filter(a => a.k === e).map(a => a.f)).size).concat([0]));
    box.innerHTML =
      k('var(--az3)', n0(C.length), 'Clientes del plan', REGS.map(r => n0(C.filter(u => u.r === r).length) +
        (r === 'Metropolitana' ? ' RM' : ' Valparaíso')).join(' · ')) +
      k(GRUPO[1].col, n0(cnt(1)), 'Top por potencial ST', porReg(1) + ' · primeros en la agenda') +
      k(GRUPO[2].col, n0(cnt(2)), 'Con plan de entrada', porReg(2) + ' · top por camas') +
      k(GRUPO[3].col, n0(cnt(3)), 'Clientes retail', porReg(3) + ' · por potencial ST') +
      k('var(--or)', n0(AG.length), 'Visitas agendadas',
        diasK + ' días hábiles por ejecutivo · ' + (AG.length ? fCorta(AG[0].f) + ' a ' + fCorta(fin) : '—'));
  }

  // Clientes que quedan fuera por tener contrato vigente, plegados.
  function excluidosHtml() {
    if (!EX.length) return '';
    const fila = e => '<tr><td style="padding:.2rem .45rem;font-weight:700">' + esc(e.n) + '</td>' +
      '<td style="padding:.2rem .45rem">' + (e.r === 'Metropolitana' ? 'RM' : 'Valparaíso') + '</td>' +
      '<td style="padding:.2rem .45rem;text-align:right">' + n0(e.eq) + '</td>' +
      '<td style="padding:.2rem .45rem">' + e.ct.map(ct => esc(ct.lin) + (ct.tipo === 'Garantia' ? ' (garantía)' : '') +
        ' · N° ' + esc(ct.num) + ' · hasta ' + String(ct.fin).split('-').reverse().join('/') +
        (ct.venc ? ' <span style="color:var(--rd);font-weight:700">(fecha vencida)</span>' : '') +
        (_prmNorm(ct.cli) !== _prmNorm(e.n) ? ' <span style="color:var(--mut)">(' + esc(ct.cli) + ')</span>' : '')).join('<br>') + '</td></tr>';
    const lst = EX.slice().sort((a, b) => a.r.localeCompare(b.r) || a.n.localeCompare(b.n));
    return '<details style="margin:-.35rem 0 .8rem;font-size:.6rem">' +
      '<summary style="cursor:pointer;color:var(--az1);font-weight:700">Ver los ' + EX.length +
      ' clientes fuera del plan por contrato Activado (' + EX.filter(e => e.r === 'Metropolitana').length + ' RM · ' +
      EX.filter(e => e.r !== 'Metropolitana').length + ' Valparaíso)</summary>' +
      '<div style="overflow-x:auto;margin-top:.4rem"><table style="border-collapse:collapse;width:100%;font-size:.58rem">' +
      '<thead><tr style="background:var(--bg2);text-align:left"><th style="padding:.25rem .45rem">Cliente</th>' +
      '<th style="padding:.25rem .45rem">Región</th><th style="padding:.25rem .45rem;text-align:right">Equipos ST</th>' +
      '<th style="padding:.25rem .45rem">Contrato Activado</th></tr></thead><tbody>' + lst.map(fila).join('') +
      '</tbody></table></div></details>';
  }
  function _prmNorm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
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
    const porEje = {};
    EJES.forEach(e => { porEje[e] = C.filter(u => u.resp === e); });
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
      '<strong>Potencial de ST</strong> —los mismos que muestra la hoja Base Instalada con el filtro ST = Sí—, ' +
      '<strong>sin los ' + EX.length + ' que tienen contrato</strong> en la hoja CONTRATOS TODOS (Estado ' +
      '«Activado», aunque la fecha de término ya haya pasado), porque ya son clientes de ST. Cada región ' +
      'se ordena por separado y cada cliente queda en un solo grupo: se elige primero el grupo 1, y los grupos 2 y 3 salen ' +
      'de los clientes que quedaron.</p>' + excluidosHtml() +
      '<div style="display:flex;gap:.5rem;align-items:stretch;flex-wrap:wrap">' +
        paso(1, 'Top ' + P.top_pot + ' por potencial ST anual',
          'mayor potencial ST anual de mantenimiento de la base instalada con Potencial de ST (equipos de ' +
          'Esterilización, Endoscopía y Dental por su tarifa anual, sólo en clientes sin contrato).',
          'Son las cuentas donde hay más venta de mantenimiento por capturar; las toma el equipo con más experiencia.') + flecha +
        paso(2, 'Top ' + P.top_camas + ' del resto por camas',
          'de los clientes que no quedaron en el grupo 1, los de mayor número de camas. Las camas miden el tamaño de la ' +
          'institución y, con él, la puerta de entrada a futuros negocios.',
          'Para cada uno se escribe un <strong>plan de entrada</strong> en la columna de la tabla.') + flecha +
        paso(3, 'Clientes retail',
          'todos los demás clientes con Potencial de ST de la región.',
          'Se visitan de mayor a menor potencial ST anual: primero las cuentas grandes de la cola.') +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin-top:.9rem">' +
        '<div style="border:1px solid var(--brd);border-radius:6px;padding:.6rem .75rem;background:var(--bg2)">' +
          '<div style="font-size:.6rem;font-weight:800;color:var(--az1);margin-bottom:.3rem">Agenda de visitas</div>' +
          '<div style="font-size:.59rem;line-height:1.6">Visitan a los grupos 2 y 3: <strong>' + n0(AG.length) + '</strong> visitas, ' +
          '<strong>' + P.visitas_dia + ' por día</strong> cada uno y en paralelo, en días hábiles desde el <strong>' +
          (AG.length ? fLarga(AG[0].f) : '—') + '</strong> hasta el <strong>' + (AG.length ? fLarga(AG[AG.length - 1].f) : '—') +
          '</strong>. Primero los clientes con plan de entrada y después el resto. Se descuentan los feriados del ' +
          (P.feriados || []).map(f => fecha(f).getDate() + ' ' + MESES[fecha(f).getMonth()]).join(', ') + '.</div>' +
        '</div>' +
        '<div style="border:1px solid var(--brd);border-radius:6px;padding:.6rem .75rem;background:var(--bg2)">' +
          '<div style="font-size:.6rem;font-weight:800;color:var(--az1);margin-bottom:.3rem">Territorios</div>' +
          '<div style="font-size:.59rem;line-height:1.6">' +
          EJES.map(e => '<span style="color:' + EJECOL[e] + ';font-weight:800">' + esc(e) + '</span> · ' +
            porEje[e].length + ' clientes' +
            (e === P.eje_valpo ? ', incluida toda la Región de Valparaíso' : '') + ': ' +
            esc(((P.comunas_eje || {})[e] || []).join(', ')) + '.<br>').join('') +
          (P.eje_valpo ? '<strong>' + esc(P.eje_valpo) + '</strong> hace Valparaíso en un bloque seguido para no ir y ' +
            'volver desde Santiago en la misma semana.<br>' : '') +
          'Cada día junta ' + P.visitas_dia + ' clientes cercanos entre sí. Los clientes cuya comuna no está en ninguna ' +
          'de las dos listas quedan con el ejecutivo más cercano, marcados «comuna por confirmar».</div>' +
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
          '; conviene hacer un solo plan para ambas.<br>' : '') +
        (rem.length ? '<strong>' + rem.map(u => esc(u.n)).join(', ') + '</strong> está en Isla de Pascua: queda a cargo del ' +
          esc(P.eje_valpo || EJES[0]) + ' pero fuera de la agenda, porque requiere un viaje aparte.' : '') + '</div>' : '');
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
      th('PLAN DE ENTRADA', 'left', 'Sólo grupo 2: cómo se pretende entrar a este cliente') +
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
        td('<span style="font-weight:700;color:' + (EJECOL[u.resp] || G.col) + ';white-space:nowrap" title="' +
          esc(u.resp_src === 'Comuna' ? 'Por su comuna: ' + (u.com || '') : u.resp_src || '') + '">' + esc(ejeCorto(u.resp)) +
          (u.resp_src && u.resp_src.indexOf('Cercanía') === 0 ? ' <span style="color:var(--or)">•</span>' : '') + '</span>') +
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
      'La <strong>1ª visita</strong> es el día que le toca en la agenda. El punto naranjo junto al ejecutivo marca a ' +
      'los clientes cuya comuna no está confirmada: quedaron con el ejecutivo más cercano.</p>';
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
    botones('prm-kam', [['ambos', 'Ambos']].concat(EJES.map(e => [e, ejeCorto(e), EJECOL[e]])),
            _kam, 'window._prmKam');

    const vis = AG.filter(a => (_sem === 'todas' || a.s === _sem) && (_kam === 'ambos' || a.k === _kam));
    const tag = document.getElementById('prm-ag-tag');
    if (tag) tag.textContent = n0(AG.length) + ' visitas · ' + P.visitas_dia + ' por día por ejecutivo · ' +
      (AG.length ? fCorta(AG[0].f) + ' a ' + fCorta(AG[AG.length - 1].f) : '');

    const res = document.getElementById('prm-ag-res');
    if (res) {
      const porK = k => vis.filter(a => a.k === k).length;
      const g2 = vis.filter(a => C[a.c].g === 2).length;
      const ap = vis.filter(a => aprox(C[a.c])).length;
      const dias = new Set(vis.map(a => a.f)).size;
      res.innerHTML = '<strong>' + (_sem === 'todas' ? 'Todas las semanas' : esc(semLbl(_sem))) + '</strong> · ' +
        '<strong>' + vis.length + '</strong> visitas en ' + dias + ' días' +
        (_kam === 'ambos' ? ' (' + EJES.map(e => '<span style="color:' + EJECOL[e] + ';font-weight:700">' +
          esc(ejeCorto(e)) + ': ' + porK(e) + '</span>').join(' · ') + ')' : '') +
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
          ['HORA', 'EJECUTIVO', 'CLIENTE', 'GRUPO', 'CAMAS', 'POT. ST'].map((t, i) =>
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
            '<td style="padding:.28rem .45rem;font-size:.58rem;font-weight:800;color:' + EJECOL[a.k] + ';white-space:nowrap">' + esc(ejeCorto(a.k)) + '</td>' +
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
    calendario();
  }

  // ── Calendario de visitas ─────────────────────────────────────
  // Una fila por semana y ejecutivo. Es la vista de seguimiento: cuántos días
  // sale cada uno, cuántas visitas hace, de qué grupos y regiones son y cuánto
  // potencial ST cubre esa semana.
  //
  // Tiene sus propios filtros de ejecutivo y mes: la agenda de arriba se mira
  // semana por semana para salir a terreno, y este calendario se mira de
  // corrido para hacer seguimiento, así que forzarlos a compartir el mismo
  // filtro obligaba a cambiarlo de ida y de vuelta.
  let _calEje = 'ambos', _calMes = 'todos';
  const mesClave = f => f.slice(0, 7);
  const mesLbl = mk => {
    const p = mk.split('-');
    const n2 = MESESL[+p[1] - 1];
    return n2.charAt(0).toUpperCase() + n2.slice(1) + ' ' + p[0];
  };
  window._prmCalEje = function (v) { _calEje = v; calendario(); };
  window._prmCalMes = function (v) { _calMes = v; calendario(); };

  function calSemanas() {
    const filas = [];
    (SEM || []).forEach(w => {
      EJES.forEach(e => {
        const vs = AG.filter(a => a.s === w.s && a.k === e &&
          (_calEje === 'ambos' || a.k === _calEje) && (_calMes === 'todos' || mesClave(a.f) === _calMes));
        if (!vs.length) return;
        const cs = vs.map(a => C[a.c]);
        const comunas = [...new Set(cs.map(u => u.com).filter(Boolean))];
        const fs = vs.map(a => a.f).sort();
        filas.push({
          sem: w.s, desde: fs[0], hasta: fs[fs.length - 1], eje: e,
          dias: new Set(vs.map(a => a.f)).size, n: vs.length,
          g1: cs.filter(u => u.g === 1).length, g2: cs.filter(u => u.g === 2).length,
          g3: cs.filter(u => u.g === 3).length,
          rm: cs.filter(u => u.r === 'Metropolitana').length,
          vp: cs.filter(u => u.r === 'Valparaíso').length,
          pot: cs.reduce((a, u) => a + (u.pot || 0), 0),
          comunas: comunas,
          aprox: cs.filter(u => aprox(u)).length,
        });
      });
    });
    return filas;
  }

  function calendario() {
    const box = document.getElementById('prm-cal');
    if (!box) return;
    botones('prm-cal-eje', [['ambos', 'Ambos']].concat(EJES.map(e => [e, ejeCorto(e), EJECOL[e]])),
            _calEje, 'window._prmCalEje');
    const meses = [...new Set(AG.map(a => mesClave(a.f)))].sort();
    const selM = document.getElementById('prm-cal-mes');
    if (selM) {
      selM.innerHTML = '<option value="todos"' + (_calMes === 'todos' ? ' selected' : '') + '>Todos los meses</option>' +
        meses.map(mk => '<option value="' + mk + '"' + (mk === _calMes ? ' selected' : '') + '>' +
          esc(mesLbl(mk)) + '</option>').join('');
    }
    const filas = calSemanas();
    const TH = 'position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.32rem .45rem;' +
      'font-size:.53rem;letter-spacing:.03em;white-space:nowrap;text-align:left';
    const th = (t, al) => '<th style="' + TH + (al ? ';text-align:' + al : '') + '">' + t + '</th>';
    const td = (v, extra) => '<td style="padding:.26rem .45rem;font-size:.59rem;' +
      'font-variant-numeric:tabular-nums;' + (extra || '') + '">' + v + '</td>';
    let h = '<table style="width:100%;border-collapse:collapse;min-width:820px"><thead><tr>' +
      th('SEMANA') + th('FECHAS') + th('EJECUTIVO') + th('DÍAS', 'right') + th('VISITAS', 'right') +
      th('G1', 'right') + th('G2', 'right') + th('G3', 'right') + th('RM', 'right') + th('VALPO', 'right') +
      th('POTENCIAL ST', 'right') + th('COMUNAS') + '</tr></thead><tbody>';
    let semAnt = null;
    filas.forEach(f => {
      const col = EJECOL[f.eje];
      if (f.sem !== semAnt) { semAnt = f.sem; }
      h += '<tr style="border-bottom:1px solid var(--brd);border-left:3px solid ' + col + ';cursor:pointer" ' +
        'onclick="window._prmSem(\'' + f.sem + '\')">' +
        td('<strong>S' + f.sem + '</strong>') +
        td(fCorta(f.desde) + ' – ' + fCorta(f.hasta), 'color:var(--mut);font-size:.56rem;white-space:nowrap') +
        td('<span style="font-weight:700;color:' + col + '">' + esc(ejeCorto(f.eje)) + '</span>') +
        td(f.dias, 'text-align:right') + td('<strong>' + f.n + '</strong>', 'text-align:right') +
        td(f.g1 || '—', 'text-align:right;color:' + GRUPO[1].col) +
        td(f.g2 || '—', 'text-align:right;color:' + GRUPO[2].col) +
        td(f.g3 || '—', 'text-align:right;color:' + GRUPO[3].col) +
        td(f.rm || '—', 'text-align:right;color:var(--mut)') +
        td(f.vp || '—', 'text-align:right;color:var(--mut)') +
        td(f.pot ? mm(f.pot) : '—', 'text-align:right;color:var(--am);font-weight:700') +
        td(esc(f.comunas.slice(0, 4).join(', ') + (f.comunas.length > 4 ? ' +' + (f.comunas.length - 4) : '')),
           'font-size:.55rem;color:var(--mut);max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap') +
        '</tr>';
    });
    const tot = filas.reduce((a, f) => ({ n: a.n + f.n, pot: a.pot + f.pot, dias: a.dias + f.dias }), { n: 0, pot: 0, dias: 0 });
    h += '</tbody><tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">' +
      '<td colspan="3" style="padding:.3rem .45rem;font-size:.58rem">TOTAL · ' + filas.length + ' semanas-ejecutivo</td>' +
      '<td style="padding:.3rem .45rem;text-align:right;font-size:.59rem">' + tot.dias + '</td>' +
      '<td style="padding:.3rem .45rem;text-align:right;font-size:.59rem">' + tot.n + '</td>' +
      '<td colspan="5"></td>' +
      '<td style="padding:.3rem .45rem;text-align:right;font-size:.59rem;color:#FFC000">' + mm(tot.pot) + '</td>' +
      '<td></td></tr></tfoot></table>';
    box.innerHTML = h;
    const tag = document.getElementById('prm-cal-tag');
    if (tag) tag.textContent = new Set(filas.map(f => f.sem)).size + ' semanas · ' + tot.n + ' visitas' +
      (_calEje === 'ambos' ? '' : ' · ' + ejeCorto(_calEje)) +
      (_calMes === 'todos' ? '' : ' · ' + mesLbl(_calMes));
  }

  // ── Carta Gantt ───────────────────────────────────────────────
  // Una barra por ejecutivo y bloque del plan —grupo dentro de cada región—,
  // desde su primera hasta su última visita. Muestra el desarrollo completo:
  // en qué semana entra cada grupo y cuándo se cruzan los dos ejecutivos.
  function gantt() {
    const box = document.getElementById('prm-gantt');
    if (!box || !AG.length) return;
    const dia0 = fecha(AG[0].f), diaN = fecha(AG[AG.length - 1].f);
    const span = Math.max(1, (diaN - dia0) / 86400000 + 1);
    const pct = f => (fecha(f) - dia0) / 86400000 / span * 100;

    const barras = [];
    EJES.forEach(e => {
      [1, 2, 3].forEach(g => {
        REGS.forEach(r => {
          const vs = AG.filter(a => a.k === e && C[a.c].g === g && C[a.c].r === r);
          if (!vs.length) return;
          const fs = vs.map(a => a.f).sort();
          barras.push({ eje: e, g: g, r: r, ini: fs[0], fin: fs[fs.length - 1], n: vs.length,
            dias: new Set(fs).size, pot: vs.reduce((a, x) => a + (C[x.c].pot || 0), 0) });
        });
      });
    });
    barras.sort((a, b) => EJES.indexOf(a.eje) - EJES.indexOf(b.eje) || a.ini.localeCompare(b.ini));

    // Cabecera: un tramo por mes del período.
    const meses = [];
    let cur = new Date(dia0.getFullYear(), dia0.getMonth(), 1);
    while (cur <= diaN) {
      const fin = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const a = Math.max(cur, dia0), b = Math.min(fin, diaN);
      meses.push({ lbl: MESESL[cur.getMonth()] + (cur.getFullYear() !== dia0.getFullYear() ? ' ' + cur.getFullYear() : ''),
        izq: (a - dia0) / 86400000 / span * 100, an: ((b - a) / 86400000 + 1) / span * 100 });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    const fila = (izq, ancho, col, txt, tip) =>
      '<div title="' + esc(tip) + '" style="position:absolute;left:' + izq + '%;width:' + Math.max(ancho, 1.2) + '%;' +
      'top:4px;bottom:4px;background:' + col + ';border-radius:4px;color:#fff;font-size:.52rem;font-weight:700;' +
      'display:flex;align-items:center;padding:0 .3rem;overflow:hidden;white-space:nowrap">' + esc(txt) + '</div>';

    let h = '<div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:.3rem;align-items:center">' +
      '<div></div><div style="position:relative;height:18px;border-bottom:1px solid var(--brd)">' +
      meses.map(m => '<div style="position:absolute;left:' + m.izq + '%;width:' + m.an + '%;font-size:.55rem;' +
        'color:var(--mut);border-left:1px solid var(--brd);padding-left:.25rem;text-transform:capitalize">' +
        esc(m.lbl) + '</div>').join('') + '</div>';
    let ejeAnt = null;
    barras.forEach(b => {
      if (b.eje !== ejeAnt) {
        ejeAnt = b.eje;
        h += '<div style="font-size:.63rem;font-weight:800;color:' + EJECOL[b.eje] + ';padding-top:.35rem">' +
          esc(b.eje) + '</div><div style="height:6px"></div>';
      }
      const ini = pct(b.ini), an = pct(b.fin) - pct(b.ini) + (1 / span * 100);
      h += '<div style="font-size:.57rem;color:var(--txt);padding-left:.6rem;white-space:nowrap">' +
        '<span style="color:' + GRUPO[b.g].col + ';font-weight:700">G' + b.g + '</span> · ' +
        esc(b.r === 'Metropolitana' ? 'RM' : 'Valparaíso') +
        ' <span style="color:var(--mut)">(' + b.n + ')</span></div>' +
        '<div style="position:relative;height:22px;background:var(--bg2);border-radius:4px">' +
        fila(ini, an, GRUPO[b.g].col, b.n + ' visitas · ' + b.dias + ' días',
             b.eje + ' · Grupo ' + b.g + ' ' + b.r + ': ' + b.n + ' visitas en ' + b.dias + ' días, del ' +
             fCorta(b.ini) + ' al ' + fCorta(b.fin) + ' · ' + mm(b.pot) + ' de potencial ST') + '</div>';
    });
    h += '</div>';
    box.innerHTML = h +
      '<p style="font-size:.56rem;color:var(--mut);margin:.6rem 0 0;line-height:1.55">Cada barra es un bloque del plan: ' +
      'el grupo dentro de una región, desde la primera hasta la última visita de ese bloque. Los dos ejecutivos ' +
      'trabajan en paralelo, así que sus barras se solapan. El orden dentro de cada ejecutivo es el de la agenda: ' +
      'primero el grupo 1, después el 2 y al final el 3, y ' + esc(P.eje_valpo || '') + ' hace Valparaíso en un ' +
      'bloque seguido.</p>';
    const tag = document.getElementById('prm-gantt-tag');
    if (tag) tag.textContent = barras.length + ' bloques · ' + fCorta(AG[0].f) + ' a ' + fCorta(AG[AG.length - 1].f);
  }

  // Excel del calendario: el resumen por semana y el detalle día por día.
  window._prmExcelCal = function () {
    if (typeof XLSX === 'undefined') { alert('Librería Excel no cargada.'); return; }
    const AZ = '002D73';
    const cab = (t, an) => ({ v: t, t: 's', s: { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: AZ } }, alignment: { horizontal: 'center', wrapText: true } } });
    const filas = calSemanas();
    const filtro = (_calEje === 'ambos' ? '' : ' · ' + _calEje) + (_calMes === 'todos' ? '' : ' · ' + mesLbl(_calMes));
    const aoa1 = [['Calendario de visitas · Plan RM y Región de Valparaíso' + filtro], [],
      ['Semana', 'Desde', 'Hasta', 'Ejecutivo', 'Días', 'Visitas', 'Grupo 1', 'Grupo 2', 'Grupo 3',
       'RM', 'Valparaíso', 'Potencial ST ($)', 'Comunas', 'Ubicación por confirmar', 'Estado', 'Comentario'].map(t => cab(t))];
    filas.forEach(f => aoa1.push(['S' + f.sem, f.desde, f.hasta, f.eje, f.dias, f.n, f.g1, f.g2, f.g3, f.rm, f.vp,
      Math.round(f.pot), f.comunas.join(', '), f.aprox, '', '']));
    const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
    ws1['!cols'] = [{ wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 7 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 7 }, { wch: 10 }, { wch: 16 }, { wch: 46 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];
    ws1['!freeze'] = { xSplit: 0, ySplit: 3 };
    filas.forEach((f, i) => {
      const ref = XLSX.utils.encode_cell({ r: 3 + i, c: 11 });
      if (ws1[ref]) ws1[ref].z = '#,##0';
    });

    const aoa2 = [['Detalle día por día' + filtro], [],
      ['Fecha', 'Semana', 'Ejecutivo', 'Hora', 'Cliente', 'Grupo', 'Región', 'Comuna', 'Dirección',
       'Camas', 'Potencial ST ($)', 'Facturación 2026 ($)', 'Ubicación', 'Estado', 'Comentario'].map(t => cab(t))];
    AG.filter(a => (_calEje === 'ambos' || a.k === _calEje) && (_calMes === 'todos' || mesClave(a.f) === _calMes))
      .sort((a, b) => a.f.localeCompare(b.f) || a.k.localeCompare(b.k) || a.o - b.o).forEach(a => {
      const u = C[a.c];
      aoa2.push([a.f, 'S' + a.s, a.k, a.h, u.n, 'G' + u.g, u.r, u.com || '', u.dir || '',
        u.camF === 'Sin internación' ? '' : u.cam, Math.round(u.pot || 0), Math.round(u.f26 || 0),
        aprox(u) ? 'Por confirmar' : u.prec, '', '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
    ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 8 }, { wch: 44 }, { wch: 8 }, { wch: 15 }, { wch: 18 },
      { wch: 34 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 30 }];
    ws2['!freeze'] = { xSplit: 0, ySplit: 3 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Por semana');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por día');
    XLSX.writeFile(wb, 'Calendario_visitas_' + (A.hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
  };

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
        if (ll.length > 1) L.polyline(ll, { color: EJECOL[lst[0].k], weight: 2.5, opacity: .75, dashArray: '6 5' }).addTo(_capa);
      });
    }
    vis.forEach(a => {
      const u = C[a.c], G = GRUPO[u.g], col = EJECOL[a.k];
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
      leg.innerHTML = EJES.map(e => bola(EJECOL[e], '#fff', 'solid #fff', ejeCorto(e))).join('') +
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
    EJES.forEach(k => {
      const filas = AG.filter(a => a.k === k).map(a => {
        const u = C[a.c];
        return { g: u.g, fmt: fmt, v: [semLbl(a.s), fLarga(a.f), a.h, a.o, u.n, u.r === 'Metropolitana' ? 'RM' : 'Valparaíso',
          u.com || '', u.dir || '', aprox(u) ? 'Por confirmar' : u.prec, 'Grupo ' + u.g,
          u.camF === 'Sin internación' ? '' : u.cam, M(u.pot), (u.eq || {}).total || 0, u.g === 2 ? (planes[u.n] || '') : ''] };
      });
      const ws = hojaDesdeFilas(cab, filas, [24, 24, 7, 6, 44, 11, 18, 34, 22, 9, 8, 13, 10, 50]);
      XLSX.utils.book_append_sheet(wb, ws, k);
    });
    XLSX.writeFile(wb, 'Agenda_ejecutivos_' + (A.hoy || '').replace(/[\s/]+/g, '-') + '.xlsx');
  };

  // ── Render ───────────────────────────────────────────────────
  function render() {
    kpis();
    flujo();
    const cnt = document.getElementById('prm-planes-cnt');
    if (cnt) cnt.textContent = contarPlanes();
    REGS.forEach(tabla);
    agenda();   // pinta también el calendario, que sigue sus filtros
    gantt();    // la Gantt es del plan completo: no depende de los filtros
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
