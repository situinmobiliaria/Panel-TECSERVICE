// ═══════════════════════════════════════════════════════════════
// hoja_eerr_dir.js — EERR Directorio
// La hoja «EERR Directorio» del Excel tal cual: mismas filas y mismos números
// (Real / PTTO / Variación / Variación % por mes y el bloque «Periodo Actual»),
// sin las filas ocultas. Exportables iguales a los de la hoja EERR: el
// mensualizado (la tabla con los meses elegidos) y el resumen (último mes
// cerrado y acumulado del período).
// Depende de: APP_DATA.eerr_dir, html2canvas, jspdf, hdEntregar, hdEscala
// ═══════════════════════════════════════════════════════════════
(function () {
  const D = (window.APP_DATA || {}).eerr_dir || {};
  const M = D.meses || [], FIL = D.filas || [], NC = D.n_cerrados || 0;
  let _sel = M.map((_, i) => i).filter(i => i < NC);

  const ICON = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>';
  const nf = (v, d) => v.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fM = v => v == null ? '' : Math.abs(v) < 0.05 ? '—' : nf(v, 1);
  const fP = v => v == null ? '' : Math.abs(v) < 0.0005 ? '—' : nf(v * 100, 1) + '%';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  // Mismo estilo de filas que la hoja EERR: totales en celeste, EBITDA Empresa
  // y Resultado del ejercicio en azul
  const AZUL = /^(EBITDA EMPRESA|RESULTADO DEL EJERCICIO)/;
  const CEL = /^(MARGEN DEL PRODUCTO|EBITDA|RESULTADO OPERACIONAL|RESULTADO NO OPERACIONAL|RESULTADO ANTES|TOTAL GASTOS)/;
  const estilo = f => { const L = norm(f.lbl); return AZUL.test(L) ? 'azul' : CEL.test(L) ? 'cel' : f.pct ? 'pct' : ''; };
  // 4 valores de un bloque: real, ptto, var, var% (en las filas % sólo real y ptto)
  const val4 = (f, b) => (b || []).map((v, j) => (f.pct || j === 3) ? fP(v) : fM(v));
  const acumLbl = () => (D.acum && D.acum[0]) || 'Periodo Actual';

  // ── Tabla en pantalla ────────────────────────────────────────
  function tabla(sel) {
    const ST1 = 'position:sticky;top:0;z-index:2', ST2 = 'position:sticky;top:26px;z-index:2';
    const h1 = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const h2 = 'background:#1e4080;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    const hT = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const hV = 'background:#2a4a2a;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    const sub = () => `<th style="${ST2};${h2}">REAL</th><th style="${ST2};${h2}">PTTO</th><th style="${ST2};${hV}">VAR</th><th style="${ST2};${hV}">VAR%</th>`;
    const nA = (D.acum || []).length;
    const BG = { azul: 'var(--az3)', cel: '#def3fa', pct: '#fff', '': '#fff' };
    const celdas = (f, b, tot) => {
      const e = estilo(f), v = val4(f, b);
      const c = ['#111', 'var(--mut)', '#555', '#888'];
      return v.map((t, j) => `<td class="num" style="white-space:nowrap;${(e === 'azul' || e === 'cel' || tot) && j < 2 ? 'font-weight:700;' : ''}color:${e === 'azul' ? (j ? 'rgba(255,255,255,.6)' : '#fff') : c[j]}">${t}</td>`).join('');
    };
    const filas = FIL.map(f => {
      const e = estilo(f), bg = BG[e];
      return `<tr style="background:${bg}">
        <td style="position:sticky;left:0;z-index:1;background:${bg};border-right:1px solid rgba(0,0,0,.08);font-size:.62rem;white-space:nowrap;
          padding:.3rem .6rem;${e === 'azul' || e === 'cel' ? 'font-weight:700;' : ''}${e === 'azul' ? 'color:#fff;' : ''}${e === 'pct' ? 'font-style:italic;color:var(--mut);padding-left:1.2rem;' : ''}">${esc(f.lbl)}</td>
        ${sel.map(i => celdas(f, f.m[i])).join('')}${(f.a || []).map(b => celdas(f, b, true)).join('')}</tr>`;
    }).join('');
    return `<table class="tbl" style="font-size:.62rem;width:100%;min-width:600px;border-collapse:separate;border-spacing:0">
      <thead><tr><th style="position:sticky;left:0;top:0;z-index:3;${h1};text-align:left;min-width:230px" rowspan="2">ESTADO RESULTADO TS</th>
        ${sel.map(i => `<th colspan="4" style="${ST1};${h1}">${M[i].slice(0, 3)}</th>`).join('')}
        ${(D.acum || []).map(a => `<th colspan="4" style="${ST1};${hT}">${esc(a.toUpperCase())}</th>`).join('')}</tr>
        <tr>${sel.map(sub).join('')}${Array(nA).fill(0).map(sub).join('')}</tr></thead>
      <tbody>${filas}</tbody></table>`;
  }

  function seg() {
    const el = document.getElementById('edir-mes-seg');
    if (!el) return;
    const b = (t, on, fn, ttl) => `<button onclick="${fn}" title="${ttl || ''}" style="font-size:.58rem;padding:.18rem .5rem;border-radius:4px;cursor:pointer;
      border:1px solid ${on ? 'var(--az2)' : 'var(--brd)'};background:${on ? 'var(--az2)' : 'var(--bg2)'};color:${on ? '#fff' : 'var(--txt)'}">${t}</button>`;
    el.innerHTML = b('Cerrados', _sel.length === NC && _sel.every(i => i < NC), 'edirMeses(\'c\')', 'Meses con real') +
      b('Todos', _sel.length === M.length, 'edirMeses(\'t\')') +
      M.map((m, i) => b(m.slice(0, 3), _sel.includes(i), 'edirMeses(' + i + ')')).join('');
  }
  window.edirMeses = k => {
    if (k === 'c') _sel = M.map((_, i) => i).filter(i => i < NC);
    else if (k === 't') _sel = M.map((_, i) => i);
    else _sel = _sel.includes(k) ? _sel.filter(i => i !== k) : _sel.concat([k]).sort((a, b) => a - b);
    render();
  };

  function render() {
    seg();
    const t = document.getElementById('edir-table');
    if (t) t.innerHTML = '<div style="overflow:auto;max-height:70vh">' + tabla(_sel) + '</div>';
  }

  function esqueleto() {
    const btn = (id, fn, txt, bg, ttl) => `<button id="${id}" onclick="${fn}" title="${ttl}" style="font-size:.58rem;padding:.22rem .7rem;background:${bg};color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:.3rem">${ICON}${txt}</button>`;
    const notas = (D.notas || []).map(n => `<div><strong>${esc(n[0])}</strong>${n.slice(1).map(x => ' · ' + esc(typeof x === 'number' ? nf(x, 1) : x)).join('')}</div>`).join('');
    return `<div class="sh"><h2>EERR Directorio</h2><div class="sh-line"></div>
        <span class="sh-tag">Estado de Resultado TS · hoja «${esc(D.hoja || 'EERR Directorio')}» del Excel · cifras en MM$ · cerrado a ${esc(M[NC - 1] || '—')}</span></div>
      <div class="card">
        <div class="ch" style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem">
          <span class="ct">Estado de Resultado TS · Directorio</span>
          <div style="display:flex;align-items:center;gap:.5rem;margin-left:auto;flex-wrap:wrap">
            <div id="edir-mes-seg" style="display:flex;flex-wrap:wrap;gap:.25rem"></div>
            ${btn('edir-pdf-btn', 'edirExportar()', 'Exportar', '#002D73', 'La tabla con los meses seleccionados')}
            ${btn('edir-res-btn', 'edirExportarResumen()', 'Exportar Resumen', '#0A5C8C', 'Último mes cerrado y ' + acumLbl() + ', contra presupuesto')}
          </div></div>
        <div class="cb"><div id="edir-table"></div></div>
        ${notas ? `<div style="padding:.5rem .95rem;background:var(--gy);border-top:1px solid var(--brd);font-size:.6rem;color:var(--mut);line-height:1.6">${notas}</div>` : ''}
      </div>`;
  }

  // ── Exportables ──────────────────────────────────────────────
  async function capturar(wrap, nombre, btn, txt) {
    const b = document.getElementById(btn), ini = b ? b.innerHTML : '';
    if (b) { b.disabled = true; b.textContent = 'Generando…'; }
    try {
      document.body.appendChild(wrap);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const W = Math.ceil(wrap.getBoundingClientRect().width), H = Math.ceil(wrap.getBoundingClientRect().height);
      wrap.style.display = 'block'; wrap.style.width = W + 'px';
      const canvas = await html2canvas(wrap, { scale: hdEscala(W, H), backgroundColor: '#ffffff', useCORS: true,
        logging: false, width: W, height: H, windowWidth: W, windowHeight: H });
      const MM = 25.4 / 96;
      await hdEntregar(canvas, nombre, W * MM, H * MM);
    } catch (err) {
      console.error('EERR Directorio:', err); alert('Error al generar: ' + err.message);
    } finally {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (b) { b.disabled = false; b.innerHTML = ini || (ICON + txt); }
    }
  }
  const libs = () => {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.'); return false;
    }
    return true;
  };
  const cabecera = (tit, sub) => '<div style="border-bottom:2.5px solid #002D73;padding-bottom:6px;margin-bottom:10px">' +
    '<span style="font-size:13px;font-weight:700;color:#002D73">TECSERVICE — ' + tit + '</span>&emsp;' +
    '<span style="font-size:10px;color:#555">' + sub + '</span></div>';
  const hoy = () => (window.APP_DATA || {}).hoy || '';

  // Mensualizado: la tabla de pantalla con los meses elegidos, sin sticky ni scroll
  window.edirExportar = async function () {
    if (!libs()) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;padding:14px 20px 20px;font-family:Arial,sans-serif;color:#111;display:inline-block;box-sizing:border-box';
    const per = _sel.length ? M[_sel[0]].slice(0, 3) + '–' + M[_sel[_sel.length - 1]].slice(0, 3) : '';
    wrap.innerHTML = cabecera('EERR Directorio', 'Período: ' + per + ' · Cifras en MM$' + (hoy() ? ' · Datos al ' + hoy() : '')) + tabla(_sel);
    wrap.querySelectorAll('*').forEach(n => { n.style.position = 'static'; n.style.maxHeight = 'none'; n.style.overflow = 'visible'; });
    wrap.querySelectorAll('table').forEach(t => { t.style.width = 'auto'; });
    await capturar(wrap, 'EERR_Directorio_' + per.replace(/[^\wÁ-ú]+/g, '-') + '_' + (hoy() || ''), 'edir-pdf-btn', 'Exportar');
  };

  // Resumen: último mes cerrado y el bloque acumulado del Excel, tal cual
  window.edirExportarResumen = async function () {
    if (!libs() || !NC) return;
    const ult = NC - 1;
    const BRD = 'border-bottom:1px solid #E6EAF2';
    const td = (t, ex) => '<td style="' + BRD + ';padding:2.6px 7px;font-size:8.5px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;' + (ex || '') + '">' + t + '</td>';
    const colV = v => v == null ? '#555' : v < -0.05 ? '#C00000' : v > 0.05 ? '#00832F' : '#555';
    const blq = (f, b, st) => {
      const v = val4(f, b), raw = b || [];
      return td(v[0], st + 'color:#111') + td(v[1], st + 'color:#6B7BA8') + td(v[2], 'color:' + colV(raw[2])) + td(v[3], 'color:#888');
    };
    const cuerpo = FIL.map(f => {
      const e = estilo(f), st = e === 'azul' || e === 'cel' ? 'font-weight:700;' : '';
      let h = '<tr style="' + (e === 'azul' ? 'background:#0E2D55;color:#fff' : e === 'cel' ? 'background:#def3fa' : '') + '">' +
        '<td style="' + BRD + ';padding:2.6px 7px;font-size:8.5px;white-space:nowrap;' + st +
        (e === 'pct' ? 'font-style:italic;color:#555;padding-left:16px;' : '') + '">' + esc(f.lbl) + '</td>' +
        blq(f, f.m[ult], st) + blq(f, (f.a || [])[0], st) + '</tr>';
      if (e === 'azul') h = h.replace(/color:#111/g, 'color:#fff').replace(/color:#6B7BA8/g, 'color:#B8C1D8').replace(/color:#888/g, 'color:#B8C1D8');
      return h;
    }).join('');
    const thG = t => '<th colspan="4" style="background:#002D73;color:#fff;font-size:9px;padding:4px 7px;letter-spacing:.05em;border-right:1px solid rgba(255,255,255,.25)">' + t + '</th>';
    const thC = t => '<th style="background:#33448D;color:#fff;font-size:7.5px;padding:3px 7px;text-align:right;letter-spacing:.03em;white-space:nowrap">' + t + '</th>';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:940px;padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    wrap.innerHTML = cabecera('EERR Directorio · Estado de Resultado TS', M[ult] + ' y ' + esc(acumLbl()) + (hoy() ? ' &nbsp;·&nbsp; Datos al ' + hoy() : '')) +
      '<table style="border-collapse:collapse;width:100%"><thead><tr>' +
      '<th rowspan="2" style="background:#002D73;color:#fff;font-size:9px;padding:4px 7px;text-align:left;border-right:1px solid rgba(255,255,255,.25)">CONCEPTO</th>' +
      thG(M[ult].toUpperCase()) + thG(esc(acumLbl().toUpperCase())) + '</tr><tr>' +
      ['REAL', 'PTTO', 'VAR', 'VAR %', 'REAL', 'PTTO', 'VAR', 'VAR %'].map(thC).join('') +
      '</tr></thead><tbody>' + cuerpo + '</tbody></table>' +
      '<div style="font-size:7.5px;color:#8892a8;margin-top:7px;line-height:1.5">Cifras en MM$, tal cual la hoja «' + esc(D.hoja || 'EERR Directorio') +
      '» del Excel (variaciones incluidas). ' + esc(acumLbl()) + ' es el bloque acumulado de esa misma hoja.</div>';
    await capturar(wrap, 'EERR_Directorio_Resumen_' + (hoy() || ''), 'edir-res-btn', 'Exportar Resumen');
  };

  window.initEerrDir = function () {
    const w = document.getElementById('view-eerrdir');
    if (!w) return;
    if (!FIL.length) {
      w.innerHTML = '<div class="sh"><h2>EERR Directorio</h2><div class="sh-line"></div></div>' +
        '<div style="padding:2rem;color:var(--mut);font-size:.7rem">El Excel no trae la hoja «EERR Directorio».</div>';
      return;
    }
    if (!w.dataset.init) { w.dataset.init = '1'; w.innerHTML = esqueleto(); }
    render();
  };

  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig(name, btn);
      if (name === 'eerrdir') setTimeout(window.initEerrDir, 80);
    };
  }
})();
