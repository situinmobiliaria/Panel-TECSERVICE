// ═══════════════════════════════════════════════════════════════
// hoja_ppto2027.js — Presupuesto 2027 Servicio Técnico
// EERR proyectado (hoja «P&L TECSERVICE») e ingresos por tipo, mes y
// cliente (hoja «Ingresos SS») del archivo «PPTO 2027 TS.xlsx».
// El detalle de cada cliente (contrato, vigencia, clasificación) sale de esa
// misma planilla; el tipo de contrato se cruza con CONTRATOS TODOS en el
// extractor, y el comparativo suma «PPTO TS Consolidado» y «EERR Directorio».
// Depende de: APP_DATA.ppto2027, panel, fact_desglose
// ═══════════════════════════════════════════════════════════════
(function () {
  const A = window.APP_DATA || {};
  const P = A.ppto2027 || {};

  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
                 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Color por tipo: el tono es el de la línea (Esterilización azul, Dental
  // amarillo, Endoscopía turquesa) y la reparación va en la versión clara.
  const COL_TIPO = {
    'Mantenimiento Esterilización': '#002D73', 'Reparación Esterilización': '#6F8FCF',
    'Mantenimiento Dental': '#D9A400',         'Reparación Dental': '#FFD966',
    'Mantenimiento Endoscopía': '#0A8F84',     'Reparación Endoscopía': '#7ED9D0',
    'Trazabilidad': '#8E44AD',
  };
  const RESERVA = ['#C0504D', '#4F6228', '#7F6084', '#31859C', '#E46C0A'];
  const colT = (t, i) => COL_TIPO[t] || RESERVA[i % RESERVA.length];
  const COL_ORIGEN = { 'Contrato vigente': '#002D73', 'Contrato nuevo': '#00832F',
                       'Sin contrato': '#D46000' };
  const LBL_ORIGEN = { 'Contrato vigente': 'Contrato vigente (backlog)',
                       'Contrato nuevo': 'Contrato nuevo (por cerrar)',
                       'Sin contrato': 'Sin contrato (reparaciones y otros)' };

  let _clasif = 'todos', _origen = 'todos', _modo = 'monto';
  const _open = new Set();          // grupos / tipos abiertos
  const _cliOpen = new Set();       // clientes con su contrato abierto
  let _celda = null;                // { k, m } celda con el detalle de clientes abierto
  let _eerrIng = false;             // fila de ingresos del EERR abierta por tipo
  let _compMes = false;             // comparativo: mes a mes o acumulado y año
  const _compPar = new Set(['rp']); // comparativo: qué pares de columnas se restan (uno o más)
  let _topN = 20;                   // clientes en el top (0 = todos)
  const _topOpen = new Set();       // clientes del top abiertos
  const _progOpen = new Set();      // tipos de contrato abiertos
  let _ch1 = null, _ch2 = null, _ch3 = null;

  // ── Formato ──────────────────────────────────────────────────
  const nf = (v, d) => (v || 0).toLocaleString('es-CL',
    { minimumFractionDigits: d, maximumFractionDigits: d });
  const fMM = (v, d) => (Math.abs(v || 0) < 1e-9 ? '–' : nf(v, d == null ? 1 : d));
  const pcN = v => nf(v * 100, 1) + '%';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  const SEP = 'border-right:1px solid var(--brd)';
  const FT = "'Roboto', sans-serif";
  const BTN = 'font-size:.62rem;padding:.22rem .6rem;border-radius:4px;cursor:pointer;white-space:nowrap';
  const TH = 'position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;padding:.42rem .55rem;' +
             'font-size:.6rem;letter-spacing:.04em;white-space:nowrap;' + SEP;
  const sum = a => a.reduce((s, v) => s + (v || 0), 0);

  // ── Datos ────────────────────────────────────────────────────
  const TIPOS = P.tipos || [];
  const grupoDe = t => /^mantenimiento/i.test(t) ? 'Mantenimientos'
                    : /^reparaci/i.test(t) ? 'Reparaciones' : t;
  const subDe = t => t.replace(/^(mantenimiento|reparación|reparacion)\s+/i, '');
  const GRUPOS = [];
  TIPOS.forEach(t => { const g = grupoDe(t.tipo); if (!GRUPOS.includes(g)) GRUPOS.push(g); });

  const pasa = it => (_clasif === 'todos' || it.clasif === _clasif) &&
                     (_origen === 'todos' || it.origen === _origen);
  const itemsDe = tipo => ((TIPOS.find(t => t.tipo === tipo) || {}).items || []).filter(pasa);
  const itemsGrupo = g => TIPOS.filter(t => grupoDe(t.tipo) === g)
    .reduce((a, t) => a.concat(itemsDe(t.tipo).map(it => Object.assign({ tipo: t.tipo }, it))), []);
  const todos = () => TIPOS.reduce((a, t) =>
    a.concat(itemsDe(t.tipo).map(it => Object.assign({ tipo: t.tipo }, it))), []);
  const mensual = list => MES.map((_, m) => sum(list.map(it => it.m[m])));
  const total = list => sum(list.map(it => it.tot));

  // Fila del EERR por etiqueta (la primera que empiece con el texto)
  const EERR = P.eerr || [];
  const fila = txt => EERR.find(f => norm(f.lbl).startsWith(norm(txt)));

  // Vigencia escrita en «Observaciones»: «Vigente hasta 2027-05-22»
  const vigencia = it => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(it.obs || ''); return m ? m[0] : ''; };
  const fmtFecha = iso => iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) : '';

  // ═══════════════════════════════════════════════════════════════
  window.p27Clasif = v => { _clasif = v; _celda = null; render(); };
  window.p27Origen = v => { _origen = v; _celda = null; render(); };
  window.p27Modo = v => { _modo = v; segmentadores(); graficos(); };
  window.p27Tog = k => { _open.has(k) ? _open.delete(k) : _open.add(k); tablaIngresos(); };
  window.p27Cli = k => { _cliOpen.has(k) ? _cliOpen.delete(k) : _cliOpen.add(k); tablaIngresos(); };
  window.p27Celda = (ev, k, m) => {
    ev.stopPropagation();
    _celda = (_celda && _celda.k === k && _celda.m === m) ? null : { k, m };
    tablaIngresos();
  };
  window.p27EerrIng = () => { _eerrIng = !_eerrIng; tablaEERR(); };
  window.p27CompMes = () => { _compMes = !_compMes; tablaComparativo(); };
  // Selección múltiple: siempre queda al menos una comparación activa.
  window.p27CompPar = k => {
    if (!_compPar.has(k)) _compPar.add(k);
    else if (_compPar.size > 1) _compPar.delete(k);
    tablaComparativo();
  };
  window.p27Top = n => { _topN = n; tablaTop(); };
  window.p27TopTog = k => { _topOpen.has(k) ? _topOpen.delete(k) : _topOpen.add(k); tablaTop(); };
  window.p27ProgTog = k => { _progOpen.has(k) ? _progOpen.delete(k) : _progOpen.add(k); tablaProg(); };

  // ── Esqueleto ────────────────────────────────────────────────
  function esqueleto() {
    const lbl = t => `<span style="font-size:.62rem;font-weight:700;color:var(--mut);
      letter-spacing:.05em;min-width:110px">${t}</span>`;
    return `
    <style>.p27t td{border-bottom:1px solid var(--brd)} .p27t tbody tr:hover td{filter:brightness(.97)}</style>
    <div class="sh"><h2>Presupuesto 2027 · Servicio Técnico</h2><div class="sh-line"></div>
      <span class="sh-tag" id="p27-tag">—</span></div>

    <div id="p27-kpi" class="g5" style="grid-template-columns:repeat(5,1fr)"></div>
    <div id="p27-kpi2" class="g5" style="grid-template-columns:repeat(4,1fr);margin-top:.6rem"></div>

    <div class="card" style="margin:.9rem 0">
      <div class="ch"><span class="ct">EERR Proyectado 2027 (MM$)</span>
        <span style="font-size:.63rem;color:var(--mut);margin-left:auto">clic en «Ingresos» para abrirlos por tipo</span></div>
      <div class="cb"><div id="p27-eerr"></div><div id="p27-params"></div></div>
    </div>

    <div class="card" style="margin-bottom:.9rem" id="p27-card-comp">
      <div class="ch"><span class="ct">Comparativo PPTO 2026 · Real 2026 · PPTO 2027</span>
        <span id="p27-comp-sub" style="font-size:.63rem;color:var(--mut);margin-left:.7rem"></span>
        <div class="exp-oculto" style="display:flex;gap:.3rem;margin-left:auto;align-items:center;flex-wrap:wrap">
          <span style="font-size:.6rem;font-weight:700;color:var(--mut);letter-spacing:.04em">COMPARAR:</span>
          <div id="p27-seg-comp" style="display:flex;gap:.25rem"></div>
          <button id="p27-comp-btn" onclick="window.p27CompMes()" style="${BTN};border:1px solid var(--brd);background:var(--bg2);color:var(--txt)">Ver mes a mes</button>
          <button id="p27-comp-pdf" onclick="exportarPanel({ids:['p27-card-comp'],titulo:'Comparativo PPTO 2026, Real 2026 y PPTO 2027',archivo:'Comparativo_EERR_2026_2027',btn:'p27-comp-pdf',ancho:1500})" style="${BTN};border:none;background:#002D73;color:#fff">Exportar</button>
        </div></div>
      <div class="cb"><div id="p27-comp"></div></div>
    </div>

    <div class="card" style="margin-bottom:.9rem" id="p27-card-top">
      <div class="ch"><span class="ct">Top de Clientes PPTO 2027</span>
        <div class="exp-oculto" style="display:flex;gap:.3rem;margin-left:auto;align-items:center">
          <div id="p27-seg-top" style="display:flex;gap:.25rem"></div>
          <button id="p27-top-pdf" onclick="exportarPanel({ids:['p27-card-top'],titulo:'Top de Clientes PPTO 2027',archivo:'Top_Clientes_PPTO_2027',btn:'p27-top-pdf',ancho:1600})" style="${BTN};border:none;background:#002D73;color:#fff">Exportar</button>
        </div></div>
      <div class="cb">
        <div id="p27-top-kpi" class="g5" style="grid-template-columns:repeat(4,1fr);margin-bottom:.7rem"></div>
        <div id="p27-top"></div></div>
    </div>

    <div class="card" style="margin-bottom:.9rem" id="p27-card-prog">
      <div class="ch"><span class="ct">Resumen por Tipo de Contrato PPTO 2027</span>
        <button id="p27-prog-pdf" onclick="exportarPanel({ids:['p27-card-prog'],titulo:'Resumen por Tipo de Contrato PPTO 2027',archivo:'Tipo_Contrato_PPTO_2027',btn:'p27-prog-pdf',ancho:1400})" style="${BTN};border:none;background:#002D73;color:#fff;margin-left:auto">Exportar</button></div>
      <div class="cb"><div id="p27-prog"></div></div>
    </div>

    <div style="display:flex;flex-direction:column;gap:.4rem;margin:1.2rem 0 .75rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('CLASIFICACIÓN:')}<div style="display:flex;gap:.25rem;flex-wrap:wrap" id="p27-seg-clasif"></div>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('CONTRATO:')}<div style="display:flex;gap:.25rem;flex-wrap:wrap" id="p27-seg-origen"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:.9rem">
      <div class="ch"><span class="ct">Ingresos Proyectados por Tipo y Mes (MM$)</span>
        <span style="font-size:.63rem;color:var(--mut);margin-left:auto">clic en una fila para abrirla · clic en un monto para ver sus clientes</span></div>
      <div class="cb"><div id="p27-ing"></div></div>
    </div>

    <div class="card" style="margin-bottom:.9rem">
      <div class="ch"><span class="ct">Ingreso Mensual Proyectado y su Composición por Tipo</span>
        <div style="display:flex;gap:.25rem;margin-left:auto" id="p27-seg-modo"></div></div>
      <div class="cb" style="position:relative;height:340px"><canvas id="cP27Mes"></canvas></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.9rem">
      <div class="card">
        <div class="ch"><span class="ct">Composición Anual por Tipo</span></div>
        <div class="cb" style="position:relative;height:300px"><canvas id="cP27Tipo"></canvas></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Ingreso Mensual según Contrato</span></div>
        <div class="cb" style="position:relative;height:300px"><canvas id="cP27Origen"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.4rem">
      <div class="ch"><span class="ct">Contratos que Terminan antes de Diciembre 2027</span>
        <span style="font-size:.63rem;color:var(--mut);margin-left:auto">dejan de facturar durante el año · vigencia según la planilla</span></div>
      <div class="cb"><div id="p27-vence"></div></div>
    </div>

    <div id="p27-notas" style="font-size:.66rem;color:var(--mut);line-height:1.55;margin-bottom:1.5rem"></div>`;
  }

  function segmentadores() {
    const seg = (cont, opts, actual, fn) => {
      const el = document.getElementById(cont);
      if (!el) return;
      el.innerHTML = opts.map(o => {
        const on = String(o.v) === String(actual), c = o.c || 'var(--az2)';
        return `<button onclick="${fn}('${o.v}')" style="${BTN};
          border:1px solid ${on ? c : 'var(--brd)'};background:${on ? c : 'var(--bg2)'};
          color:${on ? '#fff' : 'var(--txt)'};font-weight:${on ? 700 : 400}">${o.t}</button>`;
      }).join('');
    };
    const todosIt = TIPOS.reduce((a, t) => a.concat(t.items), []);
    const clasifs = [...new Set(todosIt.map(it => it.clasif))];
    const origenes = ['Contrato vigente', 'Contrato nuevo', 'Sin contrato']
      .filter(o => todosIt.some(it => it.origen === o));
    seg('p27-seg-clasif', [{ v: 'todos', t: 'Todas' }].concat(clasifs.map(c => ({ v: c, t: c }))),
        _clasif, 'window.p27Clasif');
    seg('p27-seg-origen', [{ v: 'todos', t: 'Todos' }].concat(origenes.map(o =>
        ({ v: o, t: LBL_ORIGEN[o], c: COL_ORIGEN[o] }))), _origen, 'window.p27Origen');
    seg('p27-seg-modo', [{ v: 'monto', t: 'MM$' }, { v: 'pct', t: '% composición' }],
        _modo, 'window.p27Modo');
  }

  // ── KPIs ─────────────────────────────────────────────────────
  const kpiHTML = (lbl, val, sub, kc) => `
    <div class="kpi" style="--kc:${kc}">
      <div class="kpi-lbl">${lbl}</div>
      <div class="kpi-val" style="color:${kc}">${val}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;

  function kpis() {
    const ing = fila('Ingresos de actividades'), mg = fila('MARGEN DEL PRODUCTO'),
          eb = fila('EBITDA'), ebe = fila('EBITDA EMPRESA'), res = fila('Resultado del ejercicio');
    const T = ing ? ing.tot : 0;
    const k = (f, lbl, kc) => f ? kpiHTML(lbl, 'MM$' + nf(f.tot, 1),
      (lbl === 'Ingresos 2027' ? 'MM$' + nf(f.tot / 12, 1) + ' promedio mensual'
                               : pcN(T ? f.tot / T : 0) + ' sobre ingresos'), kc) : '';
    const el = document.getElementById('p27-kpi');
    if (el) el.innerHTML = k(ing, 'Ingresos 2027', '#002D73') + k(mg, 'Margen del Producto', '#0A7D74') +
      k(eb, 'EBITDA', '#00832F') + k(ebe, 'EBITDA Empresa', '#33448D') + k(res, 'Resultado del Ejercicio', '#8B8200');

    // Composición de los ingresos según contrato (sin filtros: es el presupuesto completo)
    const all = TIPOS.reduce((a, t) => a.concat(t.items), []), TT = total(all) || 1;
    const de = o => all.filter(it => it.origen === o);
    const nCli = l => new Set(l.map(it => norm(it.cli))).size;
    const vig = de('Contrato vigente'), nue = de('Contrato nuevo'), sin = de('Sin contrato');
    const vence = vencen();
    const el2 = document.getElementById('p27-kpi2');
    if (el2) el2.innerHTML =
      kpiHTML('Backlog · Contratos Vigentes', 'MM$' + nf(total(vig), 1),
        pcN(total(vig) / TT) + ' de los ingresos · ' + vig.length + ' contratos', COL_ORIGEN['Contrato vigente']) +
      kpiHTML('Contratos Nuevos por Cerrar', 'MM$' + nf(total(nue), 1),
        pcN(total(nue) / TT) + ' de los ingresos · ' + nCli(nue) + ' clientes', COL_ORIGEN['Contrato nuevo']) +
      kpiHTML('Sin Contrato (Reparaciones y Otros)', 'MM$' + nf(total(sin), 1),
        pcN(total(sin) / TT) + ' de los ingresos', COL_ORIGEN['Sin contrato']) +
      kpiHTML('Contratos que Terminan antes de Dic-2027', String(vence.length),
        'MM$' + nf(total(vence), 1) + ' presupuestados hasta su término', '#C00000');

    const tag = document.getElementById('p27-tag');
    if (tag) tag.textContent = 'Proyección ' + esc(P.archivo || 'PPTO 2027 TS') + ' · ' +
      all.length + ' filas de ingreso en ' + TIPOS.length + ' tipos · cifras en MM$';
  }

  // ── EERR proyectado ──────────────────────────────────────────
  function tablaEERR() {
    const box = document.getElementById('p27-eerr');
    if (!box) return;
    if (!EERR.length) { box.innerHTML = '<div style="padding:1rem;color:var(--mut);font-size:.7rem">La planilla no trae la hoja P&amp;L.</div>'; return; }
    const ing = fila('Ingresos de actividades'), T = ing ? ing.tot : 0;
    const CEL = /^(MARGEN DEL PRODUCTO|EBITDA|RESULTADO OPERACIONAL|RESULTADO NO OPERACIONAL|RESULTADO ANTES|TOTAL GASTOS|SUBTOTAL)/;
    const AZUL = /^RESULTADO DEL EJERCICIO/;
    const TD = 'padding:.3rem .5rem;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;font-size:.64rem';
    const SL = bg => `position:sticky;left:0;z-index:1;background:${bg};${SEP}`;
    const ocultas = [];
    let rows = '';
    EERR.forEach(f => {
      if (!f.pct && !f.m.some(v => Math.abs(v) > 1e-9)) { ocultas.push(f.lbl); return; }
      const L = norm(f.lbl), esIng = L.startsWith('INGRESOS DE ACTIVIDADES');
      const azul = AZUL.test(L), cel = !azul && CEL.test(L);
      const bg = azul ? 'var(--az3)' : cel ? '#def3fa' : 'var(--bg,#fff)';
      const col = azul ? '#fff' : f.pct ? 'var(--mut)' : '#111';
      const fw = (azul || cel || esIng) ? 700 : 400;
      const val = v => f.pct ? pcN(v) : fMM(v);
      const flecha = esIng ? `<span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
          transform:rotate(${_eerrIng ? 90 : 0}deg);transition:transform .15s">&#9654;</span>` : '';
      rows += `<tr style="background:${bg};${esIng ? 'cursor:pointer' : ''}" ${esIng ? 'onclick="window.p27EerrIng()"' : ''}>
        <td style="${SL(bg)};padding:.3rem .6rem;font-size:.64rem;font-weight:${fw};color:${col};white-space:nowrap;
          ${f.pct ? 'font-style:italic;padding-left:1.2rem' : ''}">${flecha}${esc(f.lbl.replace(/\s+/g, ' '))}</td>
        ${f.m.map(v => `<td style="${TD};color:${col};font-weight:${fw}">${val(v)}</td>`).join('')}
        <td style="${TD};color:${col};font-weight:700;${SEP}">${val(f.tot)}</td>
        <td style="${TD};color:${azul ? 'rgba(255,255,255,.75)' : 'var(--mut)'}">${f.pct || !T ? '' : pcN(f.tot / T)}</td>
      </tr>`;
      if (esIng && _eerrIng) {
        TIPOS.forEach((t, i) => {
          const mm = mensual(t.items), tt = total(t.items);
          rows += `<tr style="background:var(--bg2)">
            <td style="${SL('var(--bg2)')};padding:.25rem .6rem .25rem 1.6rem;font-size:.62rem;white-space:nowrap">
              <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colT(t.tipo, i)};margin-right:.35rem"></span>${esc(t.tipo)}</td>
            ${mm.map(v => `<td style="${TD};font-size:.62rem">${fMM(v)}</td>`).join('')}
            <td style="${TD};font-size:.62rem;font-weight:700;${SEP}">${fMM(tt)}</td>
            <td style="${TD};font-size:.62rem;color:var(--mut)">${T ? pcN(tt / T) : ''}</td></tr>`;
        });
      }
    });
    box.innerHTML = `
      <div style="overflow:auto;max-height:70vh">
        <table class="p27t" style="width:100%;border-collapse:separate;border-spacing:0">
          <thead><tr>
            <th style="${TH};text-align:left;left:0;z-index:3;min-width:230px">Concepto</th>
            ${MES.map(m => `<th style="${TH};text-align:right">${m} 27</th>`).join('')}
            <th style="${TH};text-align:right;background:#1a3a6b">Total 2027</th>
            <th style="${TH};text-align:right;background:#1a3a6b">% ingresos</th>
          </tr></thead><tbody>${rows}</tbody></table></div>` +
      (ocultas.length ? `<div style="font-size:.6rem;color:var(--mut);margin-top:.4rem">Sin monto en todo el año (no se muestran): ${ocultas.map(esc).join(' · ')}.</div>` : '');

    const pb = document.getElementById('p27-params');
    if (pb && (P.params || []).length) pb.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.7rem;align-items:center">
        <span style="font-size:.6rem;font-weight:700;color:var(--mut);letter-spacing:.05em">PARÁMETROS DEL MODELO:</span>
        ${P.params.map(p => `<span style="font-size:.62rem;padding:.2rem .55rem;border:1px solid var(--brd);border-radius:12px;background:var(--bg2)">
          ${esc(p.lbl)}: <b>${typeof p.v === 'number' ? (p.v < 1 ? pcN(p.v) : nf(p.v, 0)) : esc(p.v)}</b></span>`).join('')}
      </div>`;
  }

  // ── Tabla de ingresos: grupo → tipo → cliente ────────────────
  function tablaIngresos() {
    const box = document.getElementById('p27-ing');
    if (!box) return;
    const all = todos(), TT = total(all);
    if (!all.length) { box.innerHTML = '<div style="padding:1rem;color:var(--mut);font-size:.7rem">Sin ingresos para los filtros seleccionados.</div>'; return; }
    const NC = 15;
    const TD = 'padding:.32rem .5rem;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums';
    const SL = bg => `position:sticky;left:0;z-index:1;background:${bg};${SEP}`;
    const flecha = open => `<span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
      transform:rotate(${open ? 90 : 0}deg);transition:transform .15s">&#9654;</span>`;
    // celdas de monto clicables: abren el detalle de clientes de ese mes (m = 12 → año completo)
    const celdas = (k, list, fs, fw) => {
      const mm = mensual(list), tt = total(list);
      const c = (v, m) => {
        const on = _celda && _celda.k === k && _celda.m === m;
        return `<td onclick="window.p27Celda(event,'${k}',${m})" title="Ver clientes"
          style="${TD};font-size:${fs};font-weight:${m === 12 ? 700 : fw};cursor:pointer;
          ${m === 12 ? SEP + ';' : ''}${on ? 'background:#FFF2CC;outline:1px solid #D9A400' : ''}">
          <span style="border-bottom:1px dotted var(--mut)">${fMM(v)}</span></td>`;
      };
      return mm.map(c).join('') + c(tt, 12) +
        `<td style="${TD};font-size:${fs};color:var(--mut)">${TT ? pcN(tt / TT) : ''}</td>`;
    };
    // detalle de clientes de una celda
    const detalle = (list, titulo, m) => {
      const val = it => m === 12 ? it.tot : it.m[m];
      const l = list.filter(it => Math.abs(val(it)) > 1e-9).sort((a, b) => val(b) - val(a));
      const tot = sum(l.map(val));
      const TDD = 'padding:.25rem .55rem;font-size:.63rem;white-space:nowrap';
      const thd = (t, al) => `<th style="background:var(--gy);color:var(--az1);padding:.3rem .55rem;font-size:.58rem;
        letter-spacing:.03em;text-align:${al || 'left'};white-space:nowrap">${t}</th>`;
      return `<tr><td colspan="${NC}" style="padding:.4rem .6rem .7rem 1.6rem;background:#FFFBEF;border-left:3px solid #D9A400">
        <div style="font-size:.66rem;font-weight:700;color:var(--az1);margin-bottom:.35rem">${esc(titulo)} ·
          ${m === 12 ? 'Total 2027' : MES_L[m] + ' 2027'} · ${l.length} ${l.length === 1 ? 'fila' : 'filas'} · MM$${nf(tot, 1)}</div>
        <div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%">
          <thead><tr>${thd('CLIENTE')}${thd('TIPO')}${thd('N° CONTRATO')}${thd('CONTRATO')}${thd('TIPO DE CONTRATO')}${thd('CLASIFICACIÓN')}
            ${thd('LÍNEA DE PRODUCTO')}${thd('VIGENCIA')}${thd('MONTO MM$', 'right')}${thd('% DEL TOTAL', 'right')}</tr></thead>
          <tbody>${l.map((it, i) => `<tr style="background:${i % 2 ? '#fff' : 'transparent'}">
            <td style="${TDD};font-weight:600">${esc(it.cli)}</td>
            <td style="${TDD}">${esc(it.tipo)}</td>
            <td style="${TDD}">${esc(it.n || '—')}</td>
            <td style="${TDD};color:${COL_ORIGEN[it.origen]}">${esc(it.origen)}</td>
            <td style="${TDD}">${esc(prog(it.prog) || '—')}${it.prog_fte === 'Asignado' ? ' (asignado)' : ''}</td>
            <td style="${TDD}">${esc(it.clasif)}</td>
            <td style="${TDD}">${esc(it.linea || '—')}</td>
            <td style="${TDD}">${vigencia(it) ? fmtFecha(vigencia(it)) : '—'}</td>
            <td style="${TDD};text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${nf(val(it), 2)}</td>
            <td style="${TDD};text-align:right;color:var(--mut)">${tot ? pcN(val(it) / tot) : ''}</td></tr>`).join('')}
          </tbody></table></div></td></tr>`;
    };
    // ficha del contrato de un cliente (todo de la planilla)
    const ficha = it => {
      const meses = it.m.map((v, i) => v ? MES[i] : null).filter(Boolean);
      const dato = (k, v) => `<div><div style="font-size:.56rem;color:var(--mut);letter-spacing:.04em">${k}</div>
        <div style="font-size:.66rem;font-weight:600">${v}</div></div>`;
      return `<tr><td colspan="${NC}" style="padding:.45rem .6rem .6rem 2.6rem;background:var(--bg2);border-left:3px solid ${COL_ORIGEN[it.origen]}">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem .9rem">
          ${dato('N° CONTRATO', esc(it.n || '—'))}
          ${dato('CONTRATO', `<span style="color:${COL_ORIGEN[it.origen]}">${esc(LBL_ORIGEN[it.origen])}</span>`)}
          ${it.prog ? dato('TIPO DE CONTRATO', esc(it.prog) + (it.prog_fte === 'Asignado' ? ' (asignado)' : '')) : ''}
          ${dato('CLASIFICACIÓN', esc(it.clasif))}
          ${dato('LÍNEA DE PRODUCTO', esc(it.linea || '—'))}
          ${it.marca ? dato('MARCA', esc(it.marca)) : ''}
          ${it.equipo ? dato('EQUIPO', esc(it.equipo)) : ''}
          ${dato('VIGENCIA', vigencia(it) ? 'hasta ' + fmtFecha(vigencia(it)) : esc(it.obs || '—'))}
          ${dato('MESES CON INGRESO', meses.length + ' (' + meses.join(', ') + ')')}
          ${dato('MONTO POR MES CON INGRESO', 'MM$' + nf(meses.length ? it.tot / meses.length : 0, 2))}
          ${dato('TOTAL 2027', 'MM$' + nf(it.tot, 2))}
        </div></td></tr>`;
    };
    const filasClientes = (list, k, pad) => {
      let h = '';
      list.slice().sort((a, b) => b.tot - a.tot).forEach((it, i) => {
        // la clave va por posición: el nombre del cliente puede traer comillas
        const ck = k + '|' + i;
        const open = _cliOpen.has(ck);
        h += `<tr style="background:#fff;cursor:pointer" onclick="window.p27Cli('${ck}')">
          <td style="${SL('#fff')};padding:.26rem .6rem .26rem ${pad};font-size:.62rem;white-space:nowrap;max-width:330px;overflow:hidden;text-overflow:ellipsis"
            title="${esc(it.cli)}">${flecha(open)}${esc(it.cli)}
            <span style="color:var(--mut);font-size:.56rem"> · ${it.n ? (/^\d+$/.test(it.n) ? '#' + esc(it.n) : esc(it.n)) : 'sin contrato'}</span></td>
          ${it.m.map(v => `<td style="${TD};font-size:.62rem">${fMM(v, 2)}</td>`).join('')}
          <td style="${TD};font-size:.62rem;font-weight:700;${SEP}">${fMM(it.tot, 2)}</td>
          <td style="${TD};font-size:.62rem;color:var(--mut)">${TT ? pcN(it.tot / TT) : ''}</td></tr>`;
        if (open) h += ficha(it);
      });
      return h;
    };

    let rows = '';
    GRUPOS.forEach((g, gi) => {
      const tiposG = TIPOS.filter(t => grupoDe(t.tipo) === g && itemsDe(t.tipo).length);
      if (!tiposG.length) return;
      const lg = itemsGrupo(g), kg = 'g:' + g, openG = _open.has(kg);
      const unico = tiposG.length === 1 && tiposG[0].tipo === g;
      const cG = unico ? colT(g, TIPOS.findIndex(t => t.tipo === g)) : 'var(--az1)';
      rows += `<tr style="background:var(--bg2);cursor:pointer;border-left:3px solid ${cG}" onclick="window.p27Tog('${kg}')">
        <td style="${SL('var(--bg2)')};padding:.36rem .6rem;font-size:.7rem;font-weight:700;white-space:nowrap">
          ${flecha(openG)}${esc(g)} <span style="font-size:.58rem;color:var(--mut);font-weight:400">· ${lg.length} filas</span></td>
        ${celdas(kg, lg, '.68rem', 700)}</tr>`;
      if (_celda && _celda.k === kg) rows += detalle(lg, g, _celda.m);
      if (!openG) return;
      if (unico) { rows += filasClientes(lg, kg, '1.7rem'); return; }
      tiposG.forEach(t => {
        const lt = itemsDe(t.tipo).map(it => Object.assign({ tipo: t.tipo }, it));
        const kt = 't:' + t.tipo, openT = _open.has(kt), ci = TIPOS.indexOf(t);
        rows += `<tr style="background:#fff;cursor:pointer" onclick="window.p27Tog('${kt}')">
          <td style="${SL('#fff')};padding:.3rem .6rem .3rem 1.5rem;font-size:.66rem;font-weight:600;white-space:nowrap">
            ${flecha(openT)}<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colT(t.tipo, ci)};margin-right:.35rem"></span>${esc(subDe(t.tipo))}
            <span style="font-size:.56rem;color:var(--mut);font-weight:400">· ${lt.length}</span></td>
          ${celdas(kt, lt, '.65rem', 400)}</tr>`;
        if (_celda && _celda.k === kt) rows += detalle(lt, t.tipo, _celda.m);
        if (openT) rows += filasClientes(lt, kt, '2.6rem');
      });
    });
    // total
    rows += `<tr style="background:var(--az3)">
      <td style="${SL('var(--az3)')};padding:.4rem .6rem;font-size:.7rem;font-weight:700;color:#fff">Total ingresos</td>
      ${mensual(all).map((v, m) => `<td onclick="window.p27Celda(event,'tot',${m})" style="${TD};font-size:.68rem;font-weight:700;color:#fff;cursor:pointer">${fMM(v)}</td>`).join('')}
      <td onclick="window.p27Celda(event,'tot',12)" style="${TD};font-size:.68rem;font-weight:700;color:#fff;cursor:pointer;${SEP}">${fMM(TT)}</td>
      <td style="${TD};font-size:.66rem;color:rgba(255,255,255,.75)">100,0%</td></tr>`;
    if (_celda && _celda.k === 'tot') rows += detalle(all, 'Todos los tipos', _celda.m);

    box.innerHTML = `<div style="overflow:auto;max-height:75vh">
      <table class="p27t" style="width:100%;border-collapse:separate;border-spacing:0">
        <thead><tr>
          <th style="${TH};text-align:left;left:0;z-index:3;min-width:260px">Tipo de ingreso</th>
          ${MES.map(m => `<th style="${TH};text-align:right">${m} 27</th>`).join('')}
          <th style="${TH};text-align:right;background:#1a3a6b">Total 2027</th>
          <th style="${TH};text-align:right;background:#1a3a6b">% total</th>
        </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ── Gráficos ─────────────────────────────────────────────────
  const tip = { titleFont: { family: FT }, bodyFont: { family: FT } };
  const leyenda = { position: 'bottom', labels: { boxWidth: 10, font: { family: FT, size: 10 } } };
  // Total sobre cada barra apilada (sólo en el modo monto)
  const totalesArriba = vals => ({
    id: 'p27Totales',
    afterDatasetsDraw(ch) {
      if (!vals) return;
      const { ctx } = ch, meta = ch.getDatasetMeta(ch.data.datasets.length - 1);
      ctx.save(); ctx.font = `600 10px ${FT}`; ctx.fillStyle = '#333'; ctx.textAlign = 'center';
      meta.data.forEach((bar, i) => {
        let top = Infinity;
        ch.data.datasets.forEach((_, d) => { const b = ch.getDatasetMeta(d).data[i]; if (b && !ch.getDatasetMeta(d).hidden) top = Math.min(top, b.y); });
        if (isFinite(top)) ctx.fillText(nf(vals[i], 1), bar.x, top - 5);
      });
      ctx.restore();
    }
  });

  function graficos() {
    if (typeof Chart === 'undefined') return;
    const tiposV = TIPOS.filter(t => itemsDe(t.tipo).length);
    const porTipo = tiposV.map(t => mensual(itemsDe(t.tipo)));
    const totMes = MES.map((_, m) => sum(porTipo.map(a => a[m])));
    const pct = _modo === 'pct';

    // 1 · Barras apiladas por mes, en MM$ o en % de composición
    const c1 = document.getElementById('cP27Mes');
    if (c1) {
      if (_ch1) _ch1.destroy();
      _ch1 = new Chart(c1.getContext('2d'), {
        type: 'bar',
        data: { labels: MES.map(m => m + ' 27'), datasets: tiposV.map((t, i) => ({
          label: t.tipo, stack: 's', borderColor: '#fff', borderWidth: 1,
          backgroundColor: colT(t.tipo, TIPOS.indexOf(t)),
          data: porTipo[i].map((v, m) => pct ? (totMes[m] ? v / totMes[m] * 100 : 0) : v) })) },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 18 } },
          plugins: { legend: leyenda,
            tooltip: Object.assign({ mode: 'index', filter: x => porTipo[x.datasetIndex][x.dataIndex] > 0,
              callbacks: {
                title: x => MES_L[x[0].dataIndex] + ' 2027 · total MM$' + nf(totMes[x[0].dataIndex], 1),
                label: x => { const v = porTipo[x.datasetIndex][x.dataIndex], t = totMes[x.dataIndex];
                  return ' ' + x.dataset.label + ': MM$' + nf(v, 1) + ' (' + pcN(t ? v / t : 0) + ')'; } } }, tip) },
          scales: { y: { stacked: true, max: pct ? 100 : undefined, grid: { color: '#E2E6F0' },
                         ticks: { callback: v => pct ? v + '%' : 'MM$' + v, font: { family: FT, size: 10 } } },
                    x: { stacked: true, grid: { display: false }, ticks: { font: { family: FT, size: 10 } } } } },
        plugins: [totalesArriba(pct ? null : totMes)]
      });
    }

    // 2 · Composición anual por tipo (barras horizontales)
    const c2 = document.getElementById('cP27Tipo');
    if (c2) {
      if (_ch2) _ch2.destroy();
      const tt = tiposV.map(t => total(itemsDe(t.tipo))), T = sum(tt);
      const orden = tt.map((v, i) => i).sort((a, b) => tt[b] - tt[a]);
      _ch2 = new Chart(c2.getContext('2d'), {
        type: 'bar',
        data: { labels: orden.map(i => tiposV[i].tipo), datasets: [{
          data: orden.map(i => tt[i]), borderRadius: 3,
          backgroundColor: orden.map(i => colT(tiposV[i].tipo, TIPOS.indexOf(tiposV[i]))) }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 70 } },
          plugins: { legend: { display: false },
            tooltip: Object.assign({ callbacks: { label: x => ' MM$' + nf(x.raw, 1) + ' · ' + pcN(T ? x.raw / T : 0) } }, tip) },
          scales: { x: { grid: { color: '#E2E6F0' }, ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { family: FT, size: 10 } } } } },
        plugins: [{ id: 'p27Lbl', afterDatasetsDraw(ch) {
          const { ctx } = ch; ctx.save(); ctx.font = `600 10px ${FT}`; ctx.fillStyle = '#333'; ctx.textBaseline = 'middle';
          ch.getDatasetMeta(0).data.forEach((b, i) => ctx.fillText(nf(ch.data.datasets[0].data[i], 1) + ' · ' +
            pcN(T ? ch.data.datasets[0].data[i] / T : 0), b.x + 5, b.y));
          ctx.restore(); } }]
      });
    }

    // 3 · Ingreso mensual según contrato (vigente / nuevo / sin contrato)
    const c3 = document.getElementById('cP27Origen');
    if (c3) {
      if (_ch3) _ch3.destroy();
      const all = todos();
      const ors = ['Contrato vigente', 'Contrato nuevo', 'Sin contrato'].filter(o => all.some(it => it.origen === o));
      const series = ors.map(o => mensual(all.filter(it => it.origen === o)));
      _ch3 = new Chart(c3.getContext('2d'), {
        type: 'bar',
        data: { labels: MES, datasets: ors.map((o, i) => ({ label: LBL_ORIGEN[o], stack: 's',
          backgroundColor: COL_ORIGEN[o], borderColor: '#fff', borderWidth: 1, data: series[i] })) },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: leyenda,
            tooltip: Object.assign({ mode: 'index', callbacks: {
              label: x => { const t = sum(series.map(s => s[x.dataIndex]));
                return ' ' + x.dataset.label + ': MM$' + nf(x.raw, 1) + ' (' + pcN(t ? x.raw / t : 0) + ')'; } } }, tip) },
          scales: { y: { stacked: true, grid: { color: '#E2E6F0' }, ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    x: { stacked: true, grid: { display: false }, ticks: { font: { family: FT, size: 10 } } } } }
      });
    }
  }

  // ── Contratos que terminan antes de fin de 2027 ──────────────
  // Los que vencen el 31-12-2027 facturan el año completo: no restan ingreso
  // al presupuesto, así que no se listan (se cuentan aparte en la nota).
  const conTipo = () => TIPOS.reduce((a, t) => a.concat(t.items.map(it => Object.assign({ tipo: t.tipo }, it))), []);
  function vencen() {
    return conTipo().filter(it => vigencia(it).startsWith('2027') && vigencia(it) < '2027-12-31');
  }
  const vencenDic = () => conTipo().filter(it => vigencia(it) === '2027-12-31');
  function tablaVence() {
    const box = document.getElementById('p27-vence');
    if (!box) return;
    const l = vencen().sort((a, b) => vigencia(a).localeCompare(vigencia(b)) || b.tot - a.tot);
    if (!l.length) { box.innerHTML = '<div style="padding:.6rem;color:var(--mut);font-size:.68rem">Ningún contrato vence durante 2027.</div>'; return; }
    const TDD = 'padding:.28rem .55rem;font-size:.63rem;white-space:nowrap';
    const th = (t, al) => `<th style="${TH};text-align:${al || 'left'}">${t}</th>`;
    // último mes con ingreso: desde ahí el presupuesto ya no considera la renovación
    const ultimo = it => { for (let m = 11; m >= 0; m--) if (it.m[m]) return MES[m]; return '—'; };
    box.innerHTML = `<div style="overflow:auto;max-height:50vh"><table class="p27t" style="width:100%;border-collapse:separate;border-spacing:0">
      <thead><tr>${th('VENCE')}${th('CLIENTE')}${th('N° CONTRATO')}${th('TIPO')}${th('ÚLTIMO MES CON INGRESO')}${th('MM$ 2027', 'right')}</tr></thead>
      <tbody>${l.map((it, i) => `<tr style="background:${i % 2 ? 'var(--bg)' : 'var(--bg2)'}">
        <td style="${TDD};font-weight:700;color:#C00000">${fmtFecha(vigencia(it))}</td>
        <td style="${TDD};font-weight:600">${esc(it.cli)}</td>
        <td style="${TDD}">${esc(it.n || '—')}</td>
        <td style="${TDD}">${esc(it.tipo)}</td>
        <td style="${TDD}">${ultimo(it)}</td>
        <td style="${TDD};text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${nf(it.tot, 2)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  // ── Comparativo PPTO 2026 · Real 2026 · PPTO 2027 ────────────
  // El «Real» trae los meses cerrados y el resto con el presupuesto 2026. Los
  // porcentajes se recalculan sobre ingresos en cada columna: sumarlos no da.
  const COMP = P.comp || {};
  const nReal = COMP.n_real || 0;
  const LBL_ACUM = nReal ? 'Ene–' + MES[nReal - 1] : '';
  const compFila = k => (COMP.filas || []).find(f => f.k === k);
  const PCT_TRAS = { margen_mm: '% Margen', ebitda_directo: '% EBITDA Directo', ebitda_empresa: '% EBITDA Empresa' };
  const CEL_C = new Set(['margen_mm', 'ebitda_directo', 'ebitda_indirecto', 'total_gastos_adicionales',
                         'ebitda_empresa', 'resultado_operacional', 'resultado_no_operacional', 'resultado_antes_imp']);
  const hasta = (a, n) => sum(a.slice(0, n));
  // Qué se compara: la variación es siempre a − b, en el acumulado y en el año.
  const PARES = {
    rp:   { t: 'Real 2026 vs PPTO 2026', col: 'Real vs PPTO 26', a: 'r26', b: 'p26' },
    p27r: { t: 'PPTO 2027 vs Real 2026', col: 'PPTO 27 vs Real',    a: 'p27', b: 'r26' },
    p27p: { t: 'PPTO 2027 vs PPTO 2026', col: 'PPTO 27 vs PPTO 26', a: 'p27', b: 'p26' },
  };
  const ALTO_TH = '1.7rem';          // alto de la 1ª fila de encabezado: la 2ª se fija bajo ella
  // Variación: positivo siempre es favorable (más ingreso o menos gasto).
  const colVar = v => v > 0.05 ? '#00832F' : v < -0.05 ? '#C00000' : 'var(--mut)';

  function tablaComparativo() {
    const box = document.getElementById('p27-comp');
    if (!box) return;
    const F = COMP.filas || [];
    if (!F.length) { box.innerHTML = '<div style="padding:.6rem;color:var(--mut);font-size:.68rem">Sin datos para comparar: falta la hoja «PPTO TS Consolidado» o «EERR Directorio».</div>'; return; }
    const lbl = document.getElementById('p27-comp-sub');
    if (lbl) lbl.textContent = 'Real a ' + MES_L[nReal - 1].toLowerCase() + '; ' +
      (nReal < 12 ? MES[nReal] + '–Dic completados con PPTO 2026' : 'año completo') + ' · MM$';
    const sg = document.getElementById('p27-seg-comp');
    if (sg) sg.innerHTML = Object.keys(PARES).map(k => {
      const on = _compPar.has(k);
      return `<button onclick="window.p27CompPar('${k}')" aria-pressed="${on}" style="${BTN};border:1px solid ${on ? 'var(--az2)' : 'var(--brd)'};
        background:${on ? 'var(--az2)' : 'var(--bg2)'};color:${on ? '#fff' : 'var(--txt)'};font-weight:${on ? 700 : 400}">${PARES[k].t}</button>`;
    }).join('');
    const PARS = Object.keys(PARES).filter(k => _compPar.has(k)).map(k => PARES[k]);  // en orden fijo
    const bt = document.getElementById('p27-comp-btn');
    if (bt) bt.textContent = _compMes ? 'Ver acumulado y año' : 'Ver mes a mes';
    const TD = 'padding:.3rem .5rem;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;font-size:.64rem';
    const SL = bg => `position:sticky;left:0;z-index:1;background:${bg};${SEP}`;
    const ING = compFila('ingresos_totales');
    const estilo = f => {
      const azul = f.k === 'resultado_ejercicio', cel = CEL_C.has(f.k);
      return { azul, bg: azul ? 'var(--az3)' : cel ? '#def3fa' : 'var(--bg,#fff)',
               col: azul ? '#fff' : '#111', fw: azul || cel || f.k === 'ingresos_totales' ? 700 : 400 };
    };
    const etiq = (t, e, pct) => `<td style="${SL(e.bg)};padding:.3rem .6rem;font-size:.64rem;white-space:nowrap;
      font-weight:${e.fw};color:${pct ? 'var(--mut)' : e.col};${pct ? 'font-style:italic;padding-left:1.2rem' : ''}">${esc(t)}</td>`;
    let thead, rows = '';

    if (_compMes) {
      thead = `<tr><th style="${TH};text-align:left;left:0;z-index:3;min-width:230px">Real 2026 + PPTO</th>
        ${MES.map((m, i) => `<th style="${TH};text-align:right;${i >= nReal ? 'background:#8A6D00' : ''}">${m} 26${i >= nReal ? ' *' : ''}</th>`).join('')}
        <th style="${TH};text-align:right;background:#1a3a6b">Total 2026</th></tr>`;
      F.forEach(f => {
        const e = estilo(f);
        const cel = (v, i) => `<td style="${TD};color:${e.col};font-weight:${e.fw};${i >= nReal && !e.azul ? 'background:#FFF2CC' : ''}">${fMM(v)}</td>`;
        rows += `<tr style="background:${e.bg}">${etiq(f.lbl, e)}${f.r26.map(cel).join('')}
          <td style="${TD};color:${e.col};font-weight:700">${fMM(sum(f.r26))}</td></tr>`;
        if (PCT_TRAS[f.k]) rows += `<tr>${etiq(PCT_TRAS[f.k], { bg: 'var(--bg,#fff)', fw: 400 }, true)}
          ${f.r26.map((v, i) => `<td style="${TD};color:var(--mut);font-style:italic">${ING.r26[i] ? pcN(v / ING.r26[i]) : ''}</td>`).join('')}
          <td style="${TD};color:var(--mut);font-style:italic">${pcN(sum(f.r26) / sum(ING.r26))}</td></tr>`;
      });
    } else {
      const sepG = 'border-left:2px solid var(--az1)';
      const sepV = 'border-left:1px solid var(--brd)';   // separa cada comparación
      const nCol = 3 + PARS.length * 2;
      const thBase = (t, st) => `<th style="${TH};top:${ALTO_TH};text-align:right;${st}">${t}</th>`;
      const thVar = PARS.map(p => thBase(p.col, sepV) + thBase('Var. %', '')).join('');
      thead = `<tr>
          <th rowspan="2" style="${TH};text-align:left;left:0;z-index:4;min-width:230px;vertical-align:bottom">Concepto</th>
          <th colspan="${nCol}" style="${TH};height:${ALTO_TH};text-align:center;background:#1a3a6b">Acumulado a la fecha (${LBL_ACUM})</th>
          <th colspan="${nCol}" style="${TH};height:${ALTO_TH};text-align:center;background:#0E2D55">Total del año</th></tr>
        <tr>${['PPTO 2026', 'Real 2026', 'PPTO 2027'].map((t, i) => thBase(t, i ? '' : sepG)).join('')}${thVar}
          ${['PPTO 2026', 'Real + PPTO 2026', 'PPTO 2027'].map((t, i) => thBase(t, i ? '' : sepG)).join('')}${thVar}</tr>`;
      const fv = v => (Math.abs(v) < 0.05 ? '–' : nf(v, 1));
      const pv = (a, b) => Math.abs(b) > 1e-9 ? pcN(a / Math.abs(b)) : '–';
      F.forEach(f => {
        const e = estilo(f);
        const a26 = hasta(f.p26, nReal), aR = hasta(f.r26, nReal), a27 = hasta(f.p27, nReal);
        const y26 = sum(f.p26), yR = sum(f.r26), y27 = sum(f.p27);
        const AC = { p26: a26, r26: aR, p27: a27 }, AN = { p26: y26, r26: yR, p27: y27 };
        const cVar = v => e.azul ? '#fff' : colVar(v);
        const c = (txt, st) => `<td style="${TD};color:${e.col};font-weight:${e.fw};${st || ''}">${txt}</td>`;
        const vars = V => PARS.map(p => {
          const v = V[p.a] - V[p.b];
          return c(fv(v), `${sepV};color:${cVar(v)}`) + c(pv(v, V[p.b]), 'color:' + cVar(v));
        }).join('');
        rows += `<tr style="background:${e.bg}">${etiq(f.lbl, e)}
          ${c(fMM(a26), sepG)}${c(fMM(aR), 'font-weight:700')}${c(fMM(a27), 'font-weight:700')}${vars(AC)}
          ${c(fMM(y26), sepG)}${c(fMM(yR), 'font-weight:700')}${c(fMM(y27), 'font-weight:700')}${vars(AN)}</tr>`;
        if (PCT_TRAS[f.k]) {
          const pc = (a, n) => { const d = n === 12 ? sum(ING[a]) : hasta(ING[a], n); return d ? (n === 12 ? sum(f[a]) : hasta(f[a], n)) / d : 0; };
          const P1 = pc('p26', nReal), P2 = pc('r26', nReal), P3 = pc('p27', nReal),
                P4 = pc('p26', 12), P5 = pc('r26', 12), P6 = pc('p27', 12);
          const m = (txt, st) => `<td style="${TD};color:var(--mut);font-style:italic;${st || ''}">${txt}</td>`;
          const pts = v => (v >= 0 ? '+' : '') + nf(v * 100, 1) + ' pp';
          const dif = n => PARS.map(p => m(pts(pc(p.a, n) - pc(p.b, n)), sepV) + m('')).join('');
          rows += `<tr>${etiq(PCT_TRAS[f.k], { bg: 'var(--bg,#fff)', fw: 400 }, true)}
            ${m(pcN(P1), sepG)}${m(pcN(P2))}${m(pcN(P3))}${dif(nReal)}
            ${m(pcN(P4), sepG)}${m(pcN(P5))}${m(pcN(P6))}${dif(12)}</tr>`;
        }
      });
    }
    box.innerHTML = `<div style="overflow:auto;max-height:62vh">
      <table class="p27t" style="width:100%;border-collapse:separate;border-spacing:0">
        <thead>${thead}</thead><tbody>${rows}</tbody></table></div>
      <div style="font-size:.6rem;color:var(--mut);margin-top:.4rem;line-height:1.5">
        ${nReal < 12 ? `<b>Real + PPTO 2026:</b> ${LBL_ACUM} es Real; ${MES[nReal]}–Dic (*) sale del presupuesto 2026, sólo en el panel. ` : ''}
        Variaciones: positivo es favorable (más ingreso o menos gasto). Real 2026: columnas Real de la hoja «EERR Directorio»; ahí el personal indirecto va dentro de GAV Indirecto, y aquí se separa como % TS × «Gastos por beneficios a los empleados Indirectos» de «EERR GEMCO Consolidado» (GAV queda con el resto). EBITDA Directo no incluye el personal indirecto. PPTO 2026: hoja «PPTO TS Consolidado». PPTO 2027: hoja «P&amp;L TECSERVICE» de «PPTO 2027 TS.xlsx».</div>`;
  }

  // ── Top de clientes ──────────────────────────────────────────
  // «Clientes Varios» junta las reparaciones del año: no es un cliente, así
  // que va al pie y fuera del ranking.
  const esVarios = c => /^CLIENTES VARIOS/.test(norm(c));
  const COL_TOP = [
    { t: 'Mant. Esterilización', f: it => /^mantenimiento est/i.test(it.tipo) },
    { t: 'Mant. Dental',         f: it => /^mantenimiento den/i.test(it.tipo) },
    { t: 'Mant. Endoscopía',     f: it => /^mantenimiento end/i.test(it.tipo) },
    { t: 'Trazabilidad',         f: it => /^trazab/i.test(it.tipo) },
    { t: 'Reparaciones',         f: it => /^reparaci/i.test(it.tipo) },
  ];
  const prog = p => String(p || '').replace(/ CARE PROGRAM$/, '').replace(/^\w+/, w => w[0] + w.slice(1).toLowerCase());
  const esContrato = it => it.origen !== 'Sin contrato';

  // Facturación real 2026 abierta en contrato y otros (hoja FACTURACION). El
  // contrato se topa al total, igual que en Brechas: lo devengado puede
  // superar lo facturado y ahí «otros» saldría negativo.
  const _fact = A.fact_desglose || {};
  const abre26 = d => { const t = +d.t26 || 0, c = Math.max(0, Math.min(+d.c26 || 0, t)); return { t, c, o: t - c }; };

  function clientesTop() {
    const G = {};
    conTipo().forEach(it => {
      const k = norm(it.cli);
      (G[k] = G[k] || { cli: it.cli, it: [] }).it.push(it);
    });
    return Object.values(G).map(g => {
      g.tot = total(g.it);
      g.cont = total(g.it.filter(esContrato));
      g.nc = new Set(g.it.filter(esContrato).map(i => i.n === 'Nuevo' ? 'N' + i.tipo : i.n)).size;
      g.progs = [...new Set(g.it.filter(esContrato).map(i => prog(i.prog)))];
      g.mg = sum(g.it.filter(esContrato).map(i => i.tot * ((P.margenes || {})[i.prog] || 0)));
      return g;
    }).sort((a, b) => b.tot - a.tot);
  }

  function kpisTop() {
    const el = document.getElementById('p27-top-kpi');
    if (!el) return;
    const all = conTipo(), T = total(all) || 1, c = total(all.filter(esContrato)), o = T - c;
    const R = Object.values(_fact).reduce((s, d) => { const a = abre26(d); s.c += a.c; s.o += a.o; return s; }, { c: 0, o: 0 });
    const RT = (R.c + R.o) || 1;
    el.innerHTML =
      kpiHTML('PPTO 2027 · % Facturación Contratos', pcN(c / T), 'MM$' + nf(c, 1) + ' vigentes y nuevos', '#002D73') +
      kpiHTML('PPTO 2027 · % Facturación Otros', pcN(o / T), 'MM$' + nf(o, 1) + ' reparaciones y trazabilidad', '#D46000') +
      kpiHTML('Real 2026 · % Facturación Contratos', pcN(R.c / RT), 'MM$' + nf(R.c / 1e6, 1) + ' a la fecha', '#0A7D74') +
      kpiHTML('Real 2026 · % Facturación Otros', pcN(R.o / RT), 'MM$' + nf(R.o / 1e6, 1) + ' a la fecha', '#8B8200');
  }

  function tablaTop() {
    const box = document.getElementById('p27-top');
    if (!box) return;
    const seg = document.getElementById('p27-seg-top');
    if (seg) seg.innerHTML = [[10, 'Top 10'], [20, 'Top 20'], [0, 'Todos']].map(([v, t]) => {
      const on = _topN === v;
      return `<button onclick="window.p27Top(${v})" style="${BTN};border:1px solid ${on ? 'var(--az2)' : 'var(--brd)'};
        background:${on ? 'var(--az2)' : 'var(--bg2)'};color:${on ? '#fff' : 'var(--txt)'};font-weight:${on ? 700 : 400}">${t}</button>`;
    }).join('');
    const todosC = clientesTop(), TT = sum(todosC.map(g => g.tot)) || 1;
    const reales = todosC.filter(g => !esVarios(g.cli)), varios = todosC.filter(g => esVarios(g.cli));
    const lista = _topN ? reales.slice(0, _topN) : reales;
    const TD = 'padding:.3rem .5rem;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;font-size:.63rem';
    const pc = (a, b) => b ? pcN(a / b) : '–';
    const porCol = g => COL_TOP.map(c => total(g.it.filter(c.f)));
    const THG = (t, n, bg) => `<th colspan="${n}" style="${TH};text-align:center;background:${bg}">${t}</th>`;
    const TH2 = (t, al) => `<th style="${TH};top:1.45rem;text-align:${al || 'right'}">${t}</th>`;
    let acu = 0, rows = '';
    const fila = (g, i, bg) => {
      acu += g.tot;
      const k = norm(g.cli), abierto = _topOpen.has(k);
      let h = `<tr style="background:${bg};cursor:pointer" onclick="window.p27TopTog(${JSON.stringify(k).replace(/"/g, '&quot;')})">
        <td style="${TD};text-align:center;color:var(--mut)">${i == null ? '' : i + 1}</td>
        <td style="padding:.3rem .55rem;font-size:.64rem;font-weight:600;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${SEP}" title="${esc(g.cli)}">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);transform:rotate(${abierto ? 90 : 0}deg)">&#9654;</span>${esc(g.cli)}</td>
        <td style="${TD};text-align:left">${esc(g.progs.join(' / ') || '–')}</td>
        <td style="${TD}">${g.nc || '–'}</td>
        ${porCol(g).map(v => `<td style="${TD}">${fMM(v)}</td>`).join('')}
        <td style="${TD};font-weight:700;${SEP}">${fMM(g.tot)}</td>
        <td style="${TD}">${pc(g.tot, TT)}</td><td style="${TD};color:var(--mut);${SEP}">${pc(acu, TT)}</td>
        <td style="${TD};font-weight:700">${g.mg ? nf(g.mg, 1) : '–'}</td><td style="${TD}">${g.mg ? pc(g.mg, g.cont) : '–'}</td></tr>`;
      if (abierto) h += `<tr><td colspan="${COL_TOP.length + 9}" style="padding:.35rem .6rem .55rem 2.2rem;background:var(--bg2)">
        ${g.it.slice().sort((a, b) => b.tot - a.tot).map(it => `<div style="font-size:.62rem;padding:.1rem 0">
          <b>${esc(it.tipo)}</b> · ${it.n ? (/^\d+$/.test(it.n) ? 'contrato #' + esc(it.n) : 'contrato nuevo') : 'sin contrato'}
          ${it.prog ? ' · ' + esc(prog(it.prog)) + (it.prog_fte === 'Asignado' ? ' (asignado)' : '') : ''}
          · MM$${nf(it.tot, 2)}</div>`).join('')}</td></tr>`;
      return h;
    };
    lista.forEach((g, i) => { rows += fila(g, i, i % 2 ? 'var(--bg)' : 'var(--bg2)'); });
    if (_topN && reales.length > lista.length) {
      const resto = reales.slice(lista.length), tr = sum(resto.map(g => g.tot));
      acu += tr;
      rows += `<tr style="background:var(--bg2);color:var(--mut)"><td></td>
        <td style="padding:.3rem .55rem;font-size:.63rem;font-style:italic;${SEP}">Otros ${resto.length} clientes</td><td></td><td></td>
        ${COL_TOP.map(c => `<td style="${TD}">${fMM(sum(resto.map(g => total(g.it.filter(c.f)))))}</td>`).join('')}
        <td style="${TD};font-weight:700;${SEP}">${fMM(tr)}</td><td style="${TD}">${pc(tr, TT)}</td><td style="${TD};${SEP}">${pc(acu, TT)}</td>
        <td style="${TD};font-weight:700">${nf(sum(resto.map(g => g.mg)), 1)}</td><td style="${TD}">${pc(sum(resto.map(g => g.mg)), sum(resto.map(g => g.cont)))}</td></tr>`;
    }
    varios.forEach(g => { rows += fila(g, null, '#FFF8E5'); });
    rows += `<tr style="background:var(--az3);color:#fff;font-weight:700"><td></td>
      <td style="padding:.38rem .55rem;font-size:.66rem;${SEP}">Total ingresos</td><td></td><td></td>
      ${COL_TOP.map(c => `<td style="${TD}">${fMM(total(conTipo().filter(c.f)))}</td>`).join('')}
      <td style="${TD};${SEP}">${fMM(TT)}</td><td style="${TD}">100,0%</td><td style="${TD};${SEP}"></td>
      <td style="${TD}">${nf(sum(todosC.map(g => g.mg)), 1)}</td><td style="${TD}">${pc(sum(todosC.map(g => g.mg)), sum(todosC.map(g => g.cont)))}</td></tr>`;
    box.innerHTML = `<div style="overflow:auto;max-height:78vh">
      <table class="p27t" style="width:100%;border-collapse:separate;border-spacing:0">
        <thead><tr>${THG('Cliente', 4, 'var(--az1)')}${THG('Desglose PPTO 2027 (MM$)', COL_TOP.length + 1, '#1a3a6b')}
          ${THG('Peso', 2, '#0E2D55')}${THG('Margen', 2, '#0A5C8C')}</tr>
          <tr>${TH2('#', 'center')}${TH2('Cliente', 'left')}${TH2('Tipo de contrato', 'left')}${TH2('Contratos')}
          ${COL_TOP.map(c => TH2(c.t)).join('')}${TH2('Total')}${TH2('% total')}${TH2('% acum.')}${TH2('MM$')}${TH2('% s/ contratos')}</tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div style="font-size:.6rem;color:var(--mut);margin-top:.4rem;line-height:1.5">
        Las reparaciones del PPTO están en una sola bolsa («Clientes Varios»), que va al pie y fuera del ranking. El margen es el del programa de cada contrato, sólo sobre lo facturado por contrato: reparaciones y trazabilidad no tienen margen por programa («–»). Los % de arriba vienen de la hoja FACTURACION (contratos y correctiva) para el Real 2026.</div>`;
  }

  // ── Resumen por tipo de contrato ─────────────────────────────
  const ORD_PROG = ['BASIC CARE PROGRAM', 'ADVANCED CARE PROGRAM', 'PROFESIONAL CARE PROGRAM'];
  const claveCt = it => it.n === 'Nuevo' ? 'N|' + norm(it.cli) + '|' + it.tipo : it.n;

  function tablaProg() {
    const box = document.getElementById('p27-prog');
    if (!box) return;
    const MG = P.margenes || {};
    const all = conTipo(), ctr = all.filter(esContrato);
    const res = l => ({ l, c: new Set(l.map(claveCt)).size, cli: new Set(l.map(i => norm(i.cli))).size, m: total(l) });
    const F = ORD_PROG.map(p => {
      const r = res(ctr.filter(i => i.prog === p));
      r.p = p; r.pct = MG[p] || 0; r.mg = r.m * r.pct;
      r.asig = r.l.filter(i => i.prog_fte === 'Asignado');
      return r;
    });
    const T = res(ctr), TMG = sum(F.map(r => r.mg)), sin = res(all.filter(i => !esContrato(i))), TG = T.m + sin.m;
    const TD = 'padding:.34rem .55rem;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;font-size:.65rem';
    const th = (t, al) => `<th style="${TH};text-align:${al || 'right'}">${t}</th>`;
    let rows = '';
    F.forEach((r, i) => {
      const ab = _progOpen.has(r.p);
      rows += `<tr style="background:${i % 2 ? 'var(--bg)' : 'var(--bg2)'};cursor:pointer" onclick="window.p27ProgTog('${r.p}')">
        <td style="padding:.34rem .6rem;font-size:.66rem;font-weight:700;white-space:nowrap;${SEP}">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);transform:rotate(${ab ? 90 : 0}deg)">&#9654;</span>${esc(r.p)}
          ${r.asig.length ? `<span style="font-size:.56rem;color:#8A6D00;font-weight:400"> · ${r.asig.length} asignados</span>` : ''}</td>
        <td style="${TD}">${r.c}</td><td style="${TD}">${r.cli}</td>
        <td style="${TD};font-weight:700">${nf(r.m, 1)}</td><td style="${TD};color:var(--mut)">${pcN(TG ? r.m / TG : 0)}</td>
        <td style="${TD}">${nf(r.c ? r.m / r.c : 0, 1)}</td><td style="${TD};${SEP}">${nf(r.cli ? r.m / r.cli : 0, 1)}</td>
        <td style="${TD}">${pcN(r.pct)}</td><td style="${TD};font-weight:700">${nf(r.mg, 1)}</td><td style="${TD}">${nf(r.c ? r.mg / r.c : 0, 1)}</td></tr>`;
      if (ab) rows += `<tr><td colspan="10" style="padding:.35rem .6rem .55rem 2.2rem;background:var(--bg2)">
        <table style="border-collapse:collapse;width:100%"><thead><tr>${['CLIENTE', 'N° CONTRATO', 'INGRESO', 'CÓMO SE DEFINIÓ EL TIPO', 'MM$ 2027'].map((t, j) =>
          `<th style="font-size:.56rem;color:var(--az1);padding:.2rem .5rem;text-align:${j === 4 ? 'right' : 'left'}">${t}</th>`).join('')}</tr></thead>
        <tbody>${r.l.slice().sort((a, b) => b.tot - a.tot).map(it => `<tr>
          <td style="font-size:.62rem;padding:.16rem .5rem;font-weight:600">${esc(it.cli)}</td>
          <td style="font-size:.62rem;padding:.16rem .5rem">${esc(it.n)}</td>
          <td style="font-size:.62rem;padding:.16rem .5rem">${esc(it.tipo)}</td>
          <td style="font-size:.62rem;padding:.16rem .5rem;${it.prog_fte === 'Asignado' ? 'color:#8A6D00;font-weight:600' : ''}">${it.prog_fte === 'Asignado' ? 'Asignado (sin tipo en contratos)' : esc(it.prog_fte)}</td>
          <td style="font-size:.62rem;padding:.16rem .5rem;text-align:right;font-weight:700">${nf(it.tot, 2)}</td></tr>`).join('')}</tbody></table></td></tr>`;
    });
    rows += `<tr style="background:var(--az3);color:#fff;font-weight:700">
      <td style="padding:.38rem .6rem;font-size:.66rem;${SEP}">Total contratos</td>
      <td style="${TD}">${T.c}</td><td style="${TD}">${T.cli}</td><td style="${TD}">${nf(T.m, 1)}</td><td style="${TD}">${pcN(TG ? T.m / TG : 0)}</td>
      <td style="${TD}">${nf(T.c ? T.m / T.c : 0, 1)}</td><td style="${TD};${SEP}">${nf(T.cli ? T.m / T.cli : 0, 1)}</td>
      <td style="${TD}">${pcN(T.m ? TMG / T.m : 0)}</td><td style="${TD}">${nf(TMG, 1)}</td><td style="${TD}">${nf(T.c ? TMG / T.c : 0, 1)}</td></tr>
    <tr style="background:var(--bg2);color:var(--mut)">
      <td style="padding:.3rem .6rem;font-size:.63rem;font-style:italic;${SEP}">Sin contrato (reparaciones y trazabilidad)</td>
      <td style="${TD}">–</td><td style="${TD}">–</td><td style="${TD}">${nf(sin.m, 1)}</td><td style="${TD}">${pcN(TG ? sin.m / TG : 0)}</td>
      <td style="${TD}">–</td><td style="${TD};${SEP}">–</td><td style="${TD}">–</td><td style="${TD}">–</td><td style="${TD}">–</td></tr>`;
    const nAs = sum(F.map(r => r.asig.length)), mAs = sum(F.map(r => total(r.asig)));
    box.innerHTML = `<div style="overflow:auto"><table class="p27t" style="width:100%;border-collapse:separate;border-spacing:0">
      <thead><tr>${th('TIPO DE CONTRATO', 'left')}${th('CONTRATOS')}${th('CLIENTES')}${th('MONTO TOTAL')}${th('% PPTO')}
        ${th('PROM. X CONTRATO')}${th('PROM. X CLIENTE')}${th('% MARGEN')}${th('MARGEN TOTAL')}${th('MARGEN PROM. X CONTRATO')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
      <div style="font-size:.6rem;color:var(--mut);margin-top:.4rem;line-height:1.5">
        Cifras en MM$. El tipo sale de cruzar el N° de contrato del PPTO con CONTRATOS TODOS (columna «Tipo de Contrato» y, si está vacía o «SIN PROGRAMA», «Tipo de Contrato 2»).
        <b style="color:#8A6D00">${nAs} filas (MM$${nf(mAs, 1)})</b> no tienen tipo, incluidos los contratos nuevos, y quedaron en Advanced, el programa intermedio.
        El % de margen de cada programa viene de «Resumen Tipos Programas». El % del total es el margen ponderado por monto. Un cliente con dos programas cuenta en ambos, por eso el total de clientes es menor que la suma.</div>`;
  }

  // ── Notas ────────────────────────────────────────────────────
  function notas() {
    const el = document.getElementById('p27-notas');
    if (!el) return;
    const all = TIPOS.reduce((a, t) => a.concat(t.items.map(it => Object.assign({ tipo: t.tipo }, it))), []);
    // Mismo cliente con exactamente los mismos montos mes a mes en dos filas: posible doble registro
    const vistos = {}, dup = [];
    all.forEach(it => {
      const k = norm(it.cli) + '|' + it.m.map(v => v.toFixed(3)).join(',');
      if (vistos[k]) dup.push([vistos[k], it]); else vistos[k] = it;
    });
    const nro = it => !it.n ? '' : /^\d+$/.test(it.n) ? '#' + esc(it.n) : '(contrato ' + esc(it.n.toLowerCase()) + ')';
    const ing = fila('Ingresos de actividades');
    const cuadra =ing && Math.abs(ing.tot - total(all)) < 0.5;
    const li = t => `<li style="margin-bottom:.2rem">${t}</li>`;
    el.innerHTML = `<div style="font-weight:700;color:var(--az1);margin-bottom:.3rem">Notas</div><ul style="margin:0;padding-left:1.1rem">
      ${li('<b>Fuente:</b> ' + esc(P.archivo || 'PPTO 2027 TS.xlsx') + ' — hoja «P&amp;L TECSERVICE» (EERR, en MM$) y hoja «Ingresos SS» (ingresos por tipo y cliente, en M$, que acá se muestran en MM$). El detalle de cada cliente (contrato, vigencia, clasificación) es el de esa planilla; el tipo de contrato se cruza con CONTRATOS TODOS.')}
      ${li('<b>Cuadratura:</b> la suma de los ingresos por cliente es MM$' + nf(total(all), 1) + (ing ? ' y el EERR trae MM$' + nf(ing.tot, 1) + (cuadra ? ' — cuadran.' : ' — <b style="color:#C00000">no cuadran</b>.') : '.'))}
      ${li('<b>Contrato:</b> «vigente» = la fila trae N° de contrato; «nuevo» = la planilla lo marca como Nuevo/NVO (contrato que aún no existe); «sin contrato» = reparaciones a clientes varios y trazabilidad. La <b>clasificación</b> (Backlog / Nuevos Negocios) es la columna «Clasificación Ventas».')}
      ${li('<b>Vencimientos:</b> ' + vencen().length + ' contratos terminan antes de diciembre 2027 y tienen ingreso sólo hasta su término; su renovación no está incluida en el presupuesto. Otros ' + vencenDic().length + ' vencen el 31-12-2027 (MM$' + nf(total(vencenDic()), 1) + ' en el año): facturan el año completo, pero su renovación condiciona el 2028.')}
      ${(P.vacios || []).length ? li('<b>Sin ingresos presupuestados:</b> ' + P.vacios.map(esc).join(', ') + '.') : ''}
      ${dup.length ? li('<b>Posible doble registro</b> (mismo cliente con los mismos montos mes a mes en dos filas): ' +
        dup.map(([a, b]) => esc(a.cli) + ' — ' + esc(a.tipo) + ' ' + nro(a) + ' y ' + esc(b.tipo) + ' ' + nro(b) +
          ' (MM$' + nf(a.tot, 1) + ' c/u)').join('; ') + '. Revisar en la planilla.') : ''}
    </ul>`;
  }

  function render() { segmentadores(); kpis(); tablaIngresos(); graficos(); }

  window.initPpto2027 = function () {
    const w = document.getElementById('view-ppto27');
    if (!w) return;
    if (!TIPOS.length && !EERR.length) {
      w.innerHTML = '<div class="sh"><h2>Presupuesto 2027 · Servicio Técnico</h2><div class="sh-line"></div></div>' +
        '<div style="padding:2rem;color:var(--mut);font-size:.7rem">No se encontró la planilla «PPTO 2027 TS.xlsx».</div>';
      return;
    }
    if (!w.dataset.init) {
      w.dataset.init = '1';
      w.innerHTML = esqueleto();
      tablaEERR(); tablaComparativo(); kpisTop(); tablaTop(); tablaProg(); tablaVence(); notas();
    }
    render();
  };

  // ── HOOK sv() ────────────────────────────────────────────────
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig(name, btn);
      if (name === 'ppto27') setTimeout(window.initPpto2027, 80);
    };
  }
})();
