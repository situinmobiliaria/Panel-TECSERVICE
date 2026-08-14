// ═══════════════════════════════════════════════════════════════
// hoja_cli_rel.js — Clientes Relevantes (venta de repuestos)
// Top de clientes por compra de repuestos en ventana móvil de 6 o 12
// meses, y dimensionamiento de stock objetivo por fill rate.
// Depende de: APP_DATA.cli_rel, APP_DATA.inv_ts, APP_DATA.back_order
// Tipografía y espaciados alineados con hoja_inv_ts.js.
// ═══════════════════════════════════════════════════════════════
(function () {
  const A  = window.APP_DATA || {};
  const CR = A.cli_rel || {};

  // ── Fill rate: cuánto stock hay que tener para cubrir a un cliente ──
  // 50% se cubre con lo consumido en 6 meses, 80% con lo de 12 meses y
  // 99% exige un colchón de 1,5x sobre esos 12 meses. La ventana de
  // referencia y el multiplicador son los dos parámetros del modelo.
  const FILL = {
    50: { vent: 6,  mult: 1,   lbl: '50%', col: '#8B8200',
          desc: 'lo consumido en los últimos 6 meses' },
    80: { vent: 12, mult: 1,   lbl: '80%', col: '#0A5C8C',
          desc: 'lo consumido en los últimos 12 meses' },
    99: { vent: 12, mult: 1.5, lbl: '99%', col: '#00832F',
          desc: 'lo consumido en los últimos 12 meses × 1,5' },
  };

  let _vent = 6;      // ventana del top de clientes: 6 o 12 meses
  let _fill = 80;     // fill rate objetivo de la tabla de abajo
  let _topN = 10;
  const _openTop  = new Set();
  const _openFill = new Set();
  let _ch1 = null, _ch2 = null, _ch3 = null, _ch4 = null;

  // ── Formato ──────────────────────────────────────────────────
  const nUn  = v => (v || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
  const nCLP = v => '$' + Math.round(v || 0).toLocaleString('es-CL');
  const nMM  = v => 'MM$' + ((v || 0) / 1e6).toLocaleString('es-CL',
                    { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc   = (a, b) => b ? ((a / b) * 100).toFixed(1).replace('.', ',') + '%' : '—';
  const esc  = s => String(s == null ? '' : s).replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SEP  = 'border-right:1px solid var(--brd)';
  const th   = (t, al) => `<th style="position:sticky;top:0;z-index:2;background:var(--az1);color:#fff;
    padding:.42rem .7rem;font-size:.6rem;letter-spacing:.04em;text-align:${al || 'left'};
    white-space:nowrap;${SEP}">${t}</th>`;
  const thd  = (t, al) => `<th style="background:var(--gy);color:var(--az1);padding:.3rem .7rem;
    font-size:.58rem;letter-spacing:.03em;text-align:${al || 'left'};white-space:nowrap;${SEP}">${t}</th>`;
  const BTN  = 'font-size:.62rem;padding:.22rem .6rem;border-radius:4px;cursor:pointer;white-space:nowrap';

  // Stock actual por SKU, desde la hoja Inventario Bodega
  const stockSku = {};
  Object.values((A.inv_ts || {}).data || {}).forEach(d => (d.items || []).forEach(i => {
    stockSku[i.sku] = (stockSku[i.sku] || 0) + i.st;
  }));
  const BO = A.back_order || {};

  const cliM = c => _vent === 6 ? c.m6  : c.m12;
  const cliQ = c => _vent === 6 ? c.q6  : c.q12;
  const cliN = c => _vent === 6 ? c.n6  : c.n12;
  const skuQ = (s, v) => v === 6 ? s.q6 : s.q12;
  const skuV = (s, v) => v === 6 ? s.v6 : s.v12;

  const ordenados = () => (CR.clientes || []).slice()
    .filter(c => cliM(c) > 0)
    .sort((a, b) => cliM(b) - cliM(a));
  const top = () => ordenados().slice(0, _topN);

  // ── Necesidad de stock de un SKU para el fill rate elegido ──────
  // Se valoriza al precio de venta promedio observado en la ventana,
  // que es el único precio disponible para todos los SKU.
  function nec(s, f) {
    const cf = FILL[f];
    const q  = skuQ(s, cf.vent) * cf.mult;
    const v  = skuV(s, cf.vent) * cf.mult;
    const st = stockSku[s.sku];
    const bo = BO[s.sku] || 0;
    const comprar = Math.max(q - (st || 0) - bo, 0);
    const pu = skuQ(s, cf.vent) > 0 ? skuV(s, cf.vent) / skuQ(s, cf.vent) : 0;
    return { q: q, v: v, st: st, bo: bo, comprar: comprar,
             vComprar: comprar * pu, enInv: st !== undefined };
  }

  // ═══════════════════════════════════════════════════════════════
  // La ventana y el top afectan a toda la hoja; el fill rate sólo a su
  // propio bloque, así que no rehace las tablas ni los gráficos de arriba.
  window.crVent = function (v) { _vent = v; render(); };
  window.crTopN = function (n) { _topN = n; _openTop.clear(); _openFill.clear(); render(); };
  window.crFill = function (f) {
    _fill = f; _openFill.clear();
    segmentadores(); frKPIs(); tablaFill();
  };
  window.crTogTop = function (c) {
    if (_openTop.has(c)) _openTop.delete(c); else _openTop.add(c);
    tablaTop();
  };
  window.crTogFill = function (c) {
    if (_openFill.has(c)) _openFill.delete(c); else _openFill.add(c);
    tablaFill();
  };

  // ── Esqueleto ────────────────────────────────────────────────
  function esqueleto() {
    const lbl = t => `<span style="font-size:.62rem;font-weight:700;color:var(--mut);
      letter-spacing:.05em;min-width:78px">${t}</span>`;
    return `
    <div class="sh"><h2>Clientes Relevantes</h2><div class="sh-line"></div>
      <span class="sh-tag" id="cr-tag">—</span></div>

    <div style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.75rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('VENTANA:')}<div style="display:flex;gap:.25rem" id="cr-seg-vent"></div>
        <span style="font-size:.63rem;color:var(--mut)" id="cr-per">—</span>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
        ${lbl('TOP:')}<div style="display:flex;gap:.25rem" id="cr-seg-top"></div>
      </div>
    </div>

    <div id="cr-kpi" class="g5" style="grid-template-columns:repeat(4,1fr)"></div>

    <div class="card" style="margin-bottom:.9rem">
      <div class="ch"><span class="ct">Top Clientes por Compra de Repuestos</span>
        <span style="font-size:.63rem;color:var(--mut);margin-left:auto">clic en un cliente para ver sus SKU</span></div>
      <div class="cb"><div id="cr-top"></div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:.9rem">
      <div class="card">
        <div class="ch"><span class="ct">Ranking por Monto</span></div>
        <div class="cb" style="position:relative;height:300px"><canvas id="cCrTop"></canvas></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Concentración de la Venta</span></div>
        <div class="cb" style="position:relative;height:300px"><canvas id="cCrConc"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1.4rem">
      <div class="card">
        <div class="ch"><span class="ct">Evolución Mensual</span>
          <span style="font-size:.63rem;color:var(--mut);margin-left:auto" id="cr-mes-lbl">—</span></div>
        <div class="cb" style="position:relative;height:290px"><canvas id="cCrMes"></canvas></div>
      </div>
      <div class="card">
        <div class="ch"><span class="ct">Marcas que Compran los Top Clientes</span></div>
        <div class="cb" style="position:relative;height:290px"><canvas id="cCrMarca"></canvas></div>
      </div>
    </div>

    <div class="sh"><h2>Fill Rate para Top Clientes</h2><div class="sh-line"></div>
      <span class="sh-tag" id="cr-fr-tag">—</span></div>

    <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.75rem">
      ${lbl('FILL RATE:')}<div style="display:flex;gap:.25rem" id="cr-seg-fill"></div>
      <span style="font-size:.63rem;color:var(--mut)" id="cr-fr-def">—</span>
    </div>

    <div id="cr-fr-kpi" class="g5" style="grid-template-columns:repeat(4,1fr)"></div>

    <div class="card">
      <div class="ch"><span class="ct">Stock Objetivo por Cliente</span>
        <span style="font-size:.63rem;color:var(--mut);margin-left:auto">clic en un cliente para ver el detalle por SKU</span></div>
      <div class="cb"><div id="cr-fr"></div></div>
    </div>`;
  }

  function segmentadores() {
    const seg = (cont, opts, actual, fn) => {
      const el = document.getElementById(cont);
      if (!el) return;
      el.innerHTML = opts.map(o => {
        const on = o.v === actual, c = o.c || 'var(--az2)';
        return `<button onclick="${fn}(${o.v})" style="${BTN};
          border:1px solid ${on ? c : 'var(--brd)'};background:${on ? c : 'var(--bg2)'};
          color:${on ? '#fff' : 'var(--txt)'};font-weight:${on ? 700 : 400}">${o.t}</button>`;
      }).join('');
    };
    seg('cr-seg-vent', [{ v: 6, t: '6 meses' }, { v: 12, t: '12 meses' }], _vent, 'window.crVent');
    seg('cr-seg-top',  [{ v: 10, t: 'Top 10' }, { v: 20, t: 'Top 20' }, { v: 9999, t: 'Todos' }], _topN, 'window.crTopN');
    seg('cr-seg-fill', [50, 80, 99].map(f => ({ v: f, t: FILL[f].lbl, c: FILL[f].col })), _fill, 'window.crFill');
  }

  // ── KPIs (mismas clases que Inventario TS y el Resumen) ────────
  const kpiHTML = (lbl, val, sub, kc) => `
    <div class="kpi" style="--kc:${kc}">
      <div class="kpi-lbl">${lbl}</div>
      <div class="kpi-val" style="color:${kc}">${val}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;

  function kpis() {
    const t = top(), tod = ordenados();
    const totM = tod.reduce((s, c) => s + cliM(c), 0);
    const topM = t.reduce((s, c) => s + cliM(c), 0);
    const topQ = t.reduce((s, c) => s + cliQ(c), 0);
    const skus = new Set();
    t.forEach(c => c.skus.forEach(s => { if (skuQ(s, _vent) > 0) skus.add(s.sku); }));
    const el = document.getElementById('cr-kpi');
    if (el) el.innerHTML =
      kpiHTML('Compra del Top', nMM(topM), t.length + ' de ' + tod.length + ' clientes', '#33448D') +
      kpiHTML('Concentración', pc(topM, totM), 'del total del período', '#C00000') +
      kpiHTML('Unidades', nUn(topQ), 'repuestos comprados', '#0A5C8C') +
      kpiHTML('SKU Distintos', nUn(skus.size), 'en el top seleccionado', '#00832F');
  }

  // ── Tabla 1: top de clientes, expandible al detalle de SKU ─────
  function tablaTop() {
    const box = document.getElementById('cr-top');
    if (!box) return;
    const t = top();
    if (!t.length) { box.innerHTML = '<div style="padding:1rem;color:var(--mut);font-size:.7rem">Sin datos.</div>'; return; }
    const totM = ordenados().reduce((s, c) => s + cliM(c), 0);
    const maxM = cliM(t[0]) || 1;
    const TD = 'padding:.4rem .7rem;white-space:nowrap';

    let rows = '';
    t.forEach((c, i) => {
      const open = _openTop.has(c.cliente);
      rows += `<tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'};cursor:pointer"
          onclick="window.crTogTop(${JSON.stringify(c.cliente).replace(/"/g, '&quot;')})">
        <td style="${TD};text-align:right;font-size:.66rem;color:var(--mut);${SEP}">${i + 1}</td>
        <td style="${TD};font-size:.73rem;font-weight:600;${SEP}">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
            transform:rotate(${open ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(c.cliente)}
        </td>
        <td style="${TD};text-align:right;font-size:.72rem;font-variant-numeric:tabular-nums;${SEP}">${nUn(cliQ(c))}</td>
        <td style="${TD};text-align:right;font-size:.73rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEP}">${nMM(cliM(c))}</td>
        <td style="${TD};text-align:right;font-size:.68rem;color:var(--mut);${SEP}">${pc(cliM(c), totM)}</td>
        <td style="${TD};text-align:right;font-size:.68rem;${SEP}">${cliN(c)}</td>
        <td style="padding:.4rem .7rem">
          <div style="height:8px;background:var(--gy);border-radius:4px;overflow:hidden;min-width:60px">
            <div style="height:100%;width:${cliM(c) / maxM * 100}%;background:#33448D"></div></div></td>
      </tr>`;

      if (open) {
        const sk = c.skus.filter(s => skuQ(s, _vent) > 0)
                         .sort((a, b) => skuV(b, _vent) - skuV(a, _vent));
        const TDD = 'padding:.25rem .7rem;font-size:.66rem;white-space:nowrap';
        rows += `<tr style="background:var(--bg)"><td colspan="7" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>${thd('SKU')}${thd('PRODUCTO')}${thd('MARCA')}${thd('FAMILIA')}
              ${thd('CANT', 'right')}${thd('MONTO', 'right')}${thd('% DEL CLIENTE', 'right')}</tr></thead>
            <tbody>${sk.map(s => `<tr>
              <td style="${TDD};padding-left:1.9rem;${SEP}">
                <span style="font-family:'Roboto Mono',monospace;font-size:.63rem;background:var(--bg2);
                  padding:.05rem .3rem;border-radius:3px">${esc(s.sku)}</span></td>
              <td style="${TDD};color:var(--mut);max-width:300px;overflow:hidden;
                         text-overflow:ellipsis;${SEP}" title="${esc(s.prod)}">${esc(s.prod)}</td>
              <td style="${TDD};color:var(--mut);${SEP}">${esc(s.marca)}</td>
              <td style="${TDD};color:var(--mut);${SEP}">${esc(s.fam)}</td>
              <td style="${TDD};text-align:right;font-variant-numeric:tabular-nums;${SEP}">${nUn(skuQ(s, _vent))}</td>
              <td style="${TDD};text-align:right;font-weight:600;
                         font-variant-numeric:tabular-nums;${SEP}">${nCLP(skuV(s, _vent))}</td>
              <td style="${TDD};text-align:right;font-size:.62rem;color:var(--mut)">
                ${pc(skuV(s, _vent), cliM(c))}</td>
            </tr>`).join('')}</tbody>
          </table></td></tr>`;
      }
    });

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:520px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:820px">
          <thead><tr>${th('#', 'right')}${th('CLIENTE')}${th('UNIDADES', 'right')}${th('MONTO', 'right')}
            ${th('% DEL TOTAL', 'right')}${th('SKU', 'right')}${th('')}</tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="2" style="padding:.45rem .7rem;font-size:.72rem;${SEP}">TOTAL TOP · ${t.length} clientes</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nUn(t.reduce((s, c) => s + cliQ(c), 0))}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(t.reduce((s, c) => s + cliM(c), 0))}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;${SEP}">${pc(t.reduce((s, c) => s + cliM(c), 0), totM)}</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
      </div>`;
  }

  // ── Tabla 2: stock objetivo por fill rate ──────────────────────
  function tablaFill() {
    const box = document.getElementById('cr-fr');
    if (!box) return;
    const cf = FILL[_fill];
    const t  = top();
    if (!t.length) { box.innerHTML = '<div style="padding:1rem;color:var(--mut);font-size:.7rem">Sin datos.</div>'; return; }
    const TD = 'padding:.4rem .7rem;white-space:nowrap';

    let rows = '', tQ = 0, tV = 0, tSt = 0, tBo = 0, tC = 0, tVC = 0, tSku = 0;
    t.forEach((c, i) => {
      const sk = c.skus.filter(s => skuQ(s, cf.vent) > 0)
                       .map(s => Object.assign({ _s: s }, nec(s, _fill)))
                       .sort((a, b) => b.v - a.v);
      const aQ  = sk.reduce((a, s) => a + s.q, 0);
      const aV  = sk.reduce((a, s) => a + s.v, 0);
      const aSt = sk.reduce((a, s) => a + (s.st || 0), 0);
      const aBo = sk.reduce((a, s) => a + s.bo, 0);
      const aC  = sk.reduce((a, s) => a + s.comprar, 0);
      const aVC = sk.reduce((a, s) => a + s.vComprar, 0);
      const cub = sk.filter(s => s.comprar === 0).length;
      tQ += aQ; tV += aV; tSt += aSt; tBo += aBo; tC += aC; tVC += aVC; tSku += sk.length;

      const open = _openFill.has(c.cliente);
      rows += `<tr style="background:${i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)'};cursor:pointer;
                          border-left:3px solid ${cf.col}"
          onclick="window.crTogFill(${JSON.stringify(c.cliente).replace(/"/g, '&quot;')})">
        <td style="${TD};text-align:right;font-size:.66rem;color:var(--mut);${SEP}">${i + 1}</td>
        <td style="${TD};font-size:.73rem;font-weight:600;${SEP}">
          <span style="display:inline-block;width:.85rem;font-size:.55rem;color:var(--mut);
            transform:rotate(${open ? 90 : 0}deg);transition:transform .15s">&#9654;</span>${esc(c.cliente)}
        </td>
        <td style="${TD};text-align:right;font-size:.68rem;${SEP}">${sk.length}</td>
        <td style="${TD};text-align:right;font-size:.73rem;font-weight:700;
                   font-variant-numeric:tabular-nums;${SEP}">${nUn(aQ)}</td>
        <td style="${TD};text-align:right;font-size:.72rem;
                   font-variant-numeric:tabular-nums;${SEP}">${nMM(aV)}</td>
        <td style="${TD};text-align:right;font-size:.68rem;color:var(--gn);${SEP}">${nUn(aSt)}</td>
        <td style="${TD};text-align:right;font-size:.68rem;color:#1F6FB2;${SEP}">${aBo > 0 ? nUn(aBo) : '—'}</td>
        <td style="${TD};text-align:right;font-size:.73rem;font-weight:700;font-variant-numeric:tabular-nums;
                   color:${aC > 0 ? '#C00000' : 'var(--gn)'};${SEP}">${nUn(aC)}</td>
        <td style="${TD};text-align:right;font-size:.72rem;font-weight:600;font-variant-numeric:tabular-nums;
                   color:${aVC > 0 ? '#C00000' : 'var(--gn)'};${SEP}">${nMM(aVC)}</td>
        <td style="${TD};text-align:right;font-size:.66rem;color:var(--mut)">
          ${sk.length ? cub + '/' + sk.length : '—'}</td>
      </tr>`;

      if (open) {
        const TDD = 'padding:.25rem .7rem;font-size:.66rem;white-space:nowrap';
        rows += `<tr style="background:var(--bg)"><td colspan="10" style="padding:0">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>${thd('SKU')}${thd('PRODUCTO')}${thd('MARCA')}${thd('NECESARIO', 'right')}
              ${thd('VALORIZADO', 'right')}${thd('STOCK', 'right')}${thd('BACK ORDER', 'right')}
              ${thd('POR COMPRAR', 'right')}${thd('$ POR COMPRAR', 'right')}</tr></thead>
            <tbody>${sk.map(s => `<tr>
              <td style="${TDD};padding-left:1.9rem;${SEP}">
                <span style="font-family:'Roboto Mono',monospace;font-size:.63rem;background:var(--bg2);
                  padding:.05rem .3rem;border-radius:3px">${esc(s._s.sku)}</span></td>
              <td style="${TDD};color:var(--mut);max-width:280px;overflow:hidden;
                         text-overflow:ellipsis;${SEP}" title="${esc(s._s.prod)}">${esc(s._s.prod)}</td>
              <td style="${TDD};color:var(--mut);${SEP}">${esc(s._s.marca)}</td>
              <td style="${TDD};text-align:right;font-weight:600;font-variant-numeric:tabular-nums;${SEP}"
                  title="${nUn(skuQ(s._s, cf.vent))} un. en ${cf.vent} meses × ${String(cf.mult).replace('.', ',')}">${nUn(s.q)}</td>
              <td style="${TDD};text-align:right;font-variant-numeric:tabular-nums;${SEP}">${nCLP(s.v)}</td>
              <td style="${TDD};text-align:right;font-variant-numeric:tabular-nums;${SEP};
                         color:${s.enInv ? (s.st > 0 ? 'var(--gn)' : 'var(--mut)') : 'var(--rd)'}">
                ${s.enInv ? nUn(s.st) : 'no está'}</td>
              <td style="${TDD};text-align:right;font-variant-numeric:tabular-nums;${SEP};
                         color:${s.bo > 0 ? '#1F6FB2' : 'var(--mut)'}">${s.bo > 0 ? nUn(s.bo) : '—'}</td>
              <td style="${TDD};text-align:right;font-weight:700;font-variant-numeric:tabular-nums;${SEP};
                         color:${s.comprar > 0 ? '#C00000' : 'var(--gn)'}">${nUn(s.comprar)}</td>
              <td style="${TDD};text-align:right;font-variant-numeric:tabular-nums;
                         color:${s.vComprar > 0 ? '#C00000' : 'var(--gn)'}">
                ${s.vComprar > 0 ? nCLP(s.vComprar) : '—'}</td>
            </tr>`).join('')}</tbody>
          </table></td></tr>`;
      }
    });

    box.innerHTML = `
      <div style="overflow-x:auto;max-height:560px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;min-width:1080px">
          <thead><tr>${th('#', 'right')}${th('CLIENTE')}${th('SKU', 'right')}${th('NECESARIO', 'right')}
            ${th('VALORIZADO', 'right')}${th('STOCK', 'right')}${th('BACK ORDER', 'right')}
            ${th('POR COMPRAR', 'right')}${th('$ POR COMPRAR', 'right')}${th('CUBIERTOS', 'right')}
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
            <td colspan="2" style="padding:.45rem .7rem;font-size:.72rem;${SEP}">TOTAL · ${t.length} clientes</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;${SEP}">${tSku}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nUn(tQ)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(tV)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;${SEP}">${nUn(tSt)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.68rem;${SEP}">${nUn(tBo)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nUn(tC)}</td>
            <td style="padding:.45rem .7rem;text-align:right;font-size:.72rem;
                       font-variant-numeric:tabular-nums;${SEP}">${nMM(tVC)}</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
      <p style="font-size:.62rem;color:var(--mut);margin:.55rem 0 0;line-height:1.6">
        <strong>Fill rate ${cf.lbl}</strong> = tener en stock ${cf.desc}. La cantidad necesaria de cada SKU es
        lo que ese cliente consumió en la ventana${cf.mult !== 1 ? ', multiplicado por ' + String(cf.mult).replace('.', ',') : ''};
        el valorizado usa el precio de venta promedio observado en el mismo período.
        <strong>Por Comprar = Necesario − Stock − Back Order</strong>, con piso en cero.
        «Stock» es la existencia actual en bodega (hoja Inventario Bodega) y «no está» significa que el código
        no aparece en el inventario, por lo que se computa como cero.
        «Back Order» es la Cantidad Solicitada de la hoja Back Order cruzada por SKU.
        Las cantidades no se suman entre clientes: un mismo SKU en stock puede servir a varios, así que el total
        por comprar es el techo del requerimiento y no una orden de compra consolidada.</p>`;
  }

  function frKPIs() {
    const cf = FILL[_fill], t = top();
    let nec_ = 0, val = 0, comp = 0, vcomp = 0;
    const skus = new Set();
    t.forEach(c => c.skus.forEach(s => {
      if (skuQ(s, cf.vent) <= 0) return;
      const r = nec(s, _fill);
      nec_ += r.q; val += r.v; comp += r.comprar; vcomp += r.vComprar; skus.add(s.sku);
    }));
    const el = document.getElementById('cr-fr-kpi');
    if (el) el.innerHTML =
      kpiHTML('Stock Objetivo', nUn(nec_), nUn(skus.size) + ' SKU distintos', cf.col) +
      kpiHTML('Valorizado', nMM(val), 'a precio de venta', '#33448D') +
      kpiHTML('Por Comprar', nUn(comp), pc(comp, nec_) + ' del objetivo', '#C00000') +
      kpiHTML('Inversión Estimada', nMM(vcomp), 'para cerrar la brecha', '#C00000');

    const d = document.getElementById('cr-fr-def');
    if (d) d.textContent = 'Objetivo: tener en stock ' + cf.desc + '.';
    const tg = document.getElementById('cr-fr-tag');
    if (tg) tg.textContent = 'Cuánto inventario hay que mantener para atender a los top ' + t.length +
      ' clientes sin quiebres, cruzado con el stock actual y las órdenes de compra en curso.';
  }

  // ── Gráficos ─────────────────────────────────────────────────
  const PAL = ['#33448D', '#00832F', '#C00000', '#0A5C8C', '#D46000', '#8B8200',
               '#7A1FAA', '#0A7D74', '#B8860B', '#4A6FA5', '#9C3D54', '#2E7D32'];
  const FT = "'Roboto', sans-serif";

  function graficos() {
    if (typeof Chart === 'undefined') return;
    const t = top(), tod = ordenados();
    const corto = s => s.length > 26 ? s.slice(0, 25) + '…' : s;

    // 1 · Ranking horizontal
    const c1 = document.getElementById('cCrTop');
    if (c1) {
      if (_ch1) _ch1.destroy();
      const d = t.slice(0, 12);
      _ch1 = new Chart(c1.getContext('2d'), {
        type: 'bar',
        data: { labels: d.map(c => corto(c.cliente)),
                datasets: [{ label: 'Compra de repuestos',
                             data: d.map(c => cliM(c) / 1e6), backgroundColor: '#33448D', borderRadius: 3 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' MM$' + x.raw.toFixed(1).replace('.', ',') +
              ' · ' + nUn(cliQ(d[x.dataIndex])) + ' un · ' + cliN(d[x.dataIndex]) + ' SKU' } } },
          scales: { x: { beginAtZero: true, grid: { color: '#E2E6F0' },
                         ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { family: FT, size: 9 } } } } }
      });
    }

    // 2 · Concentración: cada uno del top + el resto agregado
    const c2 = document.getElementById('cCrConc');
    if (c2) {
      if (_ch2) _ch2.destroy();
      const d = t.slice(0, 10);
      const restoM = tod.slice(d.length).reduce((s, c) => s + cliM(c), 0);
      const labels = d.map(c => corto(c.cliente)).concat(restoM > 0 ? ['Resto (' + (tod.length - d.length) + ')'] : []);
      const vals   = d.map(c => cliM(c)).concat(restoM > 0 ? [restoM] : []);
      const totAll = vals.reduce((a, b) => a + b, 0) || 1;
      _ch2 = new Chart(c2.getContext('2d'), {
        type: 'doughnut',
        data: { labels: labels,
                datasets: [{ data: vals,
                  backgroundColor: labels.map((_, i) => i < d.length ? PAL[i % PAL.length] : '#B8C1D8'),
                  borderWidth: 1, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '52%',
          plugins: { legend: { position: 'right',
              labels: { boxWidth: 9, font: { family: FT, size: 9 } } },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' ' + nMM(x.raw) + ' · ' +
              (x.raw / totAll * 100).toFixed(1).replace('.', ',') + '%' } } } }
      });
    }

    // 3 · Evolución mensual: sólo los meses de la ventana elegida
    const c3 = document.getElementById('cCrMes');
    if (c3) {
      if (_ch3) _ch3.destroy();
      const desde = _vent === 6 ? (CR.corte6 || 0) : 0;
      const meses = (CR.meses || []).slice(desde);
      const n = meses.length;
      const sTop = Array(n).fill(0), sRes = Array(n).fill(0);
      const setTop = new Set(t.map(c => c.cliente));
      (CR.clientes || []).forEach(c => {
        const dst = setTop.has(c.cliente) ? sTop : sRes;
        (c.serie_m || []).slice(desde).forEach((v, i) => { dst[i] += v / 1e6; });
      });
      _ch3 = new Chart(c3.getContext('2d'), {
        type: 'bar',
        data: { labels: meses, datasets: [
          { label: 'Top ' + t.length, data: sTop, backgroundColor: '#33448D', stack: 's', borderRadius: 2 },
          { label: 'Resto de clientes', data: sRes, backgroundColor: '#B8C1D8', stack: 's', borderRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { family: FT, size: 10 } } },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' ' + x.dataset.label + ': MM$' + x.raw.toFixed(1).replace('.', ',') } } },
          scales: { y: { stacked: true, grid: { color: '#E2E6F0' },
                         ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    x: { stacked: true, grid: { display: false }, ticks: { font: { family: FT, size: 9.5 } } } } }
      });
      const ml = document.getElementById('cr-mes-lbl');
      if (ml) ml.textContent = n + ' meses · top vs resto de clientes';
    }

    // 4 · Marcas que compran los top clientes
    const c4 = document.getElementById('cCrMarca');
    if (c4) {
      if (_ch4) _ch4.destroy();
      const g = {};
      t.forEach(c => c.skus.forEach(s => {
        const v = skuV(s, _vent);
        if (v > 0) g[s.marca] = (g[s.marca] || 0) + v;
      }));
      const d = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const totG = d.reduce((a, b) => a + b[1], 0) || 1;
      _ch4 = new Chart(c4.getContext('2d'), {
        type: 'bar',
        data: { labels: d.map(x => corto(x[0])),
                datasets: [{ data: d.map(x => x[1] / 1e6),
                  backgroundColor: d.map((_, i) => PAL[i % PAL.length]), borderRadius: 3 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { titleFont: { family: FT }, bodyFont: { family: FT },
              callbacks: { label: x => ' MM$' + x.raw.toFixed(1).replace('.', ',') + ' · ' +
              (x.raw * 1e6 / totG * 100).toFixed(1).replace('.', ',') + '%' } } },
          scales: { x: { beginAtZero: true, grid: { color: '#E2E6F0' },
                         ticks: { callback: v => 'MM$' + v, font: { family: FT, size: 10 } } },
                    y: { grid: { display: false }, ticks: { font: { family: FT, size: 9.5 } } } } }
      });
    }
  }

  function render() {
    segmentadores();
    const per = document.getElementById('cr-per');
    if (per) per.textContent = _vent === 6 ? CR.periodo6 : CR.periodo12;
    const tag = document.getElementById('cr-tag');
    if (tag) tag.textContent = 'Clientes que más repuestos compran · ventana móvil de ' + _vent +
      ' meses (' + (_vent === 6 ? CR.periodo6 : CR.periodo12) + ') · ' + CR.n_clientes + ' clientes con compra';
    kpis(); tablaTop(); graficos(); frKPIs(); tablaFill();
  }

  window.initCliRel = function () {
    const w = document.getElementById('view-clirel');
    if (!w) return;
    if (!CR.clientes || !CR.clientes.length) {
      w.innerHTML = '<div class="sh"><h2>Clientes Relevantes</h2><div class="sh-line"></div></div>' +
        '<div style="padding:2rem;color:var(--mut);font-size:.7rem">Sin datos de venta de repuestos.</div>';
      return;
    }
    if (!w.dataset.init) { w.dataset.init = '1'; w.innerHTML = esqueleto(); }
    render();
  };

  // ── HOOK sv() ────────────────────────────────────────────────
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig(name, btn);
      if (name === 'clirel') setTimeout(window.initCliRel, 80);
    };
  }
})();
