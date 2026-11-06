// ═══════════════════════════════════════════════════════════════
// hoja_eerr_dir.js — EERR Directorio
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════
// La hoja «EERR Directorio» se muestra tal cual está en el Excel: el
// extractor trae el texto ya formateado por Excel (miles, paréntesis, %),
// los colores, negritas y bordes de cada celda, y deja fuera las filas y
// columnas ocultas. Aquí sólo se pinta; no hay filtros ni cálculos.
(function(){
  const D = (window.APP_DATA && APP_DATA.eerr_dir) || {};
  const F = D.filas || [];
  const E = D.estilos || [];

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Ancho de columna de Excel (en caracteres) a píxeles, y alto en puntos.
  const ESC = 0.82;
  const pxAncho = w => Math.round((w * 7 + 5) * ESC);
  const pxAlto  = h => Math.round(h * 4 / 3 * ESC);
  const borde = b => b ? ((b[0] >= 4 ? 3 : b[0] === -4138 ? 2 : 1) + 'px solid ' + b[1]) : '';

  function css(st){
    const s = [];
    if (st.bg) s.push('background:' + st.bg);
    if (st.fg) s.push('color:' + st.fg);
    if (st.b)  s.push('font-weight:700');
    if (st.i)  s.push('font-style:italic');
    // Sólo los títulos con fondo van centrados y en dos líneas, como en Excel;
    // una nota centrada sobre celdas vacías se lee desde su inicio.
    const al = st.al === 'c' && !st.bg ? 'l' : st.al;
    if (al) s.push('text-align:' + ({l:'left', c:'center', r:'right'})[al]);
    if (st.al === 'c' && st.bg) s.push('white-space:normal');
    if (st.ind) s.push('padding-left:' + (4 + st.ind * 9) + 'px');
    if (st.bt) s.push('border-top:' + borde(st.bt));
    if (st.bb) s.push('border-bottom:' + borde(st.bb));
    return s.join(';');
  }

  // Arma la tabla con las columnas pedidas (índices de la grilla visible).
  function tabla(cols, desde){
    const tapa = {};      // celdas cubiertas por una combinada
    const span = {};
    (D.merges || []).forEach(([r, c, nr, nc]) => {
      const cc = cols.filter(x => x >= c && x < c + nc);
      if (!cc.length) return;
      span[r + ',' + cc[0]] = [nr, cc.length];
      for (let i = r; i < r + nr; i++) cc.forEach(x => {
        if (i !== r || x !== cc[0]) tapa[i + ',' + x] = 1;
      });
    });
    const ancho = cols.reduce((s, c) => s + pxAncho((D.ancho || [])[c] || 10), 0);
    let h = '<table class="eerrd-t" style="width:' + ancho + 'px"><colgroup>' +
      cols.map(c => '<col style="width:' + pxAncho((D.ancho || [])[c] || 10) + 'px">').join('') +
      '</colgroup><tbody>';
    F.forEach((fila, r) => {
      if (r < (desde || 0)) return;
      h += '<tr style="height:' + pxAlto((D.alto || [])[r] || 15) + 'px">';
      cols.forEach(c => {
        const k = r + ',' + c;
        if (tapa[k]) return;
        const [txt, si] = fila[c] || ['', 0];
        const sp = span[k];
        // data-exp-ajuste: exportarPanel no parte estas celdas; aquí el texto
        // largo pasa sobre las vacías, como en Excel.
        h += '<td data-exp-ajuste="1"' + (sp ? ' rowspan="' + sp[0] + '" colspan="' + sp[1] + '"' : '') +
             ' style="' + css(E[si] || {}) + '">' + esc(txt) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }

  // Bloques de columnas: la fila con «Real» marca dónde parte cada bloque y
  // la de abajo trae el período (ene-26 … dic-26, Periodo Actual 2026).
  const rReal = F.findIndex(f => f.some(x => /^real$/i.test(x[0])));
  const nCol  = F.length ? F[0].length : 0;
  const todas = Array.from({length: nCol}, (_, i) => i);
  const bloques = [];
  if (rReal >= 0) {
    F[rReal].forEach((x, c) => {
      if (/^real$/i.test(x[0])) bloques.push({ c0: c, cols: [], per: (F[rReal + 1] || [])[c][0] || '' });
      else if (bloques.length && x[0]) bloques[bloques.length - 1].cols.push(c);
    });
    bloques.forEach(b => b.cols.unshift(b.c0));
  }
  const etiq = rReal >= 0 ? todas.filter(c => c < (bloques[0] ? bloques[0].c0 : 0)) : todas;
  // Un bloque tiene datos si su columna Real trae alguna cifra bajo los títulos.
  const conDatos = b => F.slice(rReal + 2).some(f => /\d/.test((f[b.c0] || [''])[0]));
  const mensuales = bloques.filter(b => /\d/.test(b.per) && !/periodo|acum/i.test(b.per));
  const ultMes = mensuales.filter(conDatos).pop();
  const acum   = bloques.find(b => /periodo|acum/i.test(b.per));

  const view = document.getElementById('view-eerrdir');
  if (!view) return;
  if (!F.length) {
    const v = document.getElementById('eerrd-empty');
    if (v) v.style.display = 'block';
    return;
  }

  if (!document.getElementById('eerrd-style')) {
    const s = document.createElement('style');
    s.id = 'eerrd-style';
    s.textContent =
      '.eerrd-t{border-collapse:collapse;table-layout:fixed;background:#fff;' +
      'font-family:Calibri,Arial,sans-serif;font-size:' + (12 * 4 / 3 * ESC).toFixed(1) + 'px;color:#000}' +
      // overflow visible: el texto largo pasa sobre las celdas vacías de al lado, igual que en Excel
      '.eerrd-t td{padding:0 4px;white-space:nowrap;overflow:visible;' +
      'font-variant-numeric:tabular-nums;vertical-align:middle}';
    document.head.appendChild(s);
  }

  document.getElementById('eerrd-tabla').innerHTML = tabla(todas);
  const lbl = document.getElementById('eerrd-lbl');
  if (lbl) lbl.textContent = ultMes ? ultMes.per : '—';
  const rb = document.getElementById('eerrd-res-btn');
  if (rb && (!ultMes || !acum)) rb.style.display = 'none';

  // La tabla completa, tal como se ve en pantalla.
  window.eerrDirExportar = function(){
    exportarPanel({
      ids: ['eerrd-tabla'], titulo: 'EERR Directorio',
      sub: 'Hoja «' + (D.hoja || 'EERR Directorio') + '» · Cifras en MM$',
      archivo: 'EERR_Directorio', btn: 'eerrd-pdf-btn',
    });
  };

  // Igual que el resumen del EERR: el último mes con datos y el acumulado
  // del año, cada uno con su real, presupuesto y variaciones.
  window.eerrDirResumen = async function(){
    if (!ultMes || !acum) return;
    const tmp = document.createElement('div');
    tmp.id = 'eerrd-res-tmp';
    tmp.style.cssText = 'position:absolute;left:-99999px;top:0';
    tmp.innerHTML = tabla(etiq.concat(ultMes.cols, acum.cols), rReal);
    document.body.appendChild(tmp);
    try {
      await exportarPanel({
        ids: ['eerrd-res-tmp'], titulo: 'EERR Directorio',
        sub: ultMes.per + ' y ' + acum.per.trim() + ' · Cifras en MM$',
        archivo: 'EERR_Directorio_Resumen_' + ultMes.per.replace(/[\s/]+/g, '_'),
        btn: 'eerrd-res-btn',
      });
    } finally { tmp.remove(); }
  };
})();
