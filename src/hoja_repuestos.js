// ═══════════════════════════════════════════════════════════════
// hoja_repuestos.js — Repuestos Solicitados
// Fuente: window.REPUESTOS_DATA (Excel "Detalle de repuestos vendidos")
// Equipo (Marca + Familia) → Repuesto → Año, con # casos, $ monto, % monto
// ═══════════════════════════════════════════════════════════════

function initRepuestos() {
  const wrap = document.getElementById('view-repuestos');
  if (!wrap || wrap.dataset.init) return;
  wrap.dataset.init = '1';
  wrap.innerHTML = _repHTML();
  _bindRepCtrl();
  renderRepuestos();
}

function _repHTML() {
  return `
  <div class="sh">
    <h2>Repuestos Solicitados</h2>
    <div class="sh-line"></div>
    <span class="sh-tag" id="rep-tag">Información actualizada desde Excel · Hoja "Detalle de SKU vendidos"</span>
  </div>

  <!-- KPIs strip -->
  <div class="sumstrip" style="margin-bottom:.75rem">
    <div><div class="ss-v" id="rep-k-filas" style="color:var(--az2)">—</div><div class="ss-l">Líneas analizadas</div></div>
    <div><div class="ss-v" id="rep-k-id" style="color:var(--teal)">—</div><div class="ss-l">% Equipo identificado</div></div>
    <div><div class="ss-v" id="rep-k-eq" style="color:var(--am)">—</div><div class="ss-l">Equipos distintos</div></div>
    <div><div class="ss-v" id="rep-k-25" style="color:var(--mut)">—</div><div class="ss-l">Monto 2025</div></div>
    <div><div class="ss-v" id="rep-k-26" style="color:var(--rd)">—</div><div class="ss-l">Monto 2026</div></div>
  </div>

  <div class="card" style="padding:.5rem .7rem;margin-bottom:.6rem;font-size:.58rem;color:var(--mut)" id="rep-nota-match">—</div>

  <!-- Buscador + filtro marca -->
  <div class="card" style="margin-bottom:.75rem">
    <div class="ctrl" style="gap:.55rem;flex-wrap:wrap">
      <span class="ctrl-lbl">Buscar</span>
      <input type="text" id="rep-search" class="search-inp" placeholder="🔍 Equipo, familia, repuesto…"
        style="width:260px;font-size:.65rem;padding:.28rem .55rem" oninput="renderRepuestos()">
      <span class="ctrl-lbl" style="margin-left:.4rem">Marca</span>
      <select id="rep-sel-marca" style="font-size:.62rem;border:1px solid var(--brd);border-radius:5px;padding:.25rem .5rem;background:#fff;color:var(--txt);font-family:'Roboto',sans-serif" onchange="renderRepuestos()">
        <option value="">Todas</option>
      </select>
    </div>
  </div>

  <!-- Tabla: Repuestos por Equipo -->
  <div class="card">
    <div class="ch" style="background:linear-gradient(135deg,rgba(192,0,0,.18),rgba(192,0,0,.06));flex-wrap:wrap;gap:.4rem">
      <span class="ct" style="color:var(--rd)">Repuestos por Equipo</span>
      <span style="font-size:.58rem;color:var(--mut)" id="rep-t-count">—</span>
    </div>
    <div style="overflow-x:auto;overflow-y:auto;max-height:65vh">
      <table class="tbl" id="rep-table" style="min-width:1300px">
        <thead><tr>
          <th style="min-width:100px;position:sticky;top:0;z-index:2">Marca</th>
          <th style="min-width:140px;position:sticky;top:0;z-index:2">Familia de Equipo</th>
          <th style="min-width:220px;position:sticky;top:0;z-index:2">Repuesto</th>
          <th style="min-width:80px;position:sticky;top:0;z-index:2">2025 · # Casos</th>
          <th style="min-width:100px;position:sticky;top:0;z-index:2">2025 · $ Monto</th>
          <th style="min-width:80px;position:sticky;top:0;z-index:2">2025 · % Monto</th>
          <th style="min-width:80px;position:sticky;top:0;z-index:2">2026 · # Casos</th>
          <th style="min-width:100px;position:sticky;top:0;z-index:2">2026 · $ Monto</th>
          <th style="min-width:80px;position:sticky;top:0;z-index:2">2026 · % Monto</th>
          <th style="min-width:80px;position:sticky;top:0;z-index:2">Total Casos</th>
          <th style="min-width:100px;position:sticky;top:0;z-index:2">Total Monto</th>
        </tr></thead>
        <tbody id="rep-tbody"></tbody>
        <tfoot id="rep-tfoot"></tfoot>
      </table>
    </div>
  </div>`;
}

function _bindRepCtrl() {
  // sin controles adicionales por ahora (búsqueda y select ya tienen oninput/onchange inline)
}

function _fmtRep(v) {
  return v > 0 ? 'MM$' + fN1(v / 1e6) : '—';
}

function renderRepuestos() {
  if (typeof REPUESTOS_DATA === 'undefined') return;
  const D = REPUESTOS_DATA;
  const equipos = D.equipos || [];
  const ms = D.match_stats || {};

  // Poblar select de marcas
  const marcas0 = [...new Set(equipos.map(e => e.marca))].sort();
  const selMarca = document.getElementById('rep-sel-marca');
  if (selMarca) {
    const current = selMarca.value;
    const opts = ['<option value="">Todas</option>', ...marcas0.map(m => `<option value="${_escH(m)}"${current === m ? ' selected' : ''}>${_escH(m)}</option>`)].join('');
    if (selMarca.innerHTML !== opts) selMarca.innerHTML = opts;
  }

  const busq   = (document.getElementById('rep-search')?.value || '').toLowerCase().trim();
  const marcaF = document.getElementById('rep-sel-marca')?.value || '';

  // KPIs (sobre el universo completo, no filtrado)
  const totMonto25 = equipos.reduce((s, e) => s + (e.anios_total?.['2025'] || 0), 0);
  const totMonto26 = equipos.reduce((s, e) => s + (e.anios_total?.['2026'] || 0), 0);
  const pctId = ms.total_filas > 0 ? ((ms.con_modelo + ms.con_marca + ms.con_cliente) / ms.total_filas * 100) : 0;

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('rep-k-filas', (ms.total_filas || 0).toLocaleString('es-CL'));
  s('rep-k-id', fN1(pctId) + '%');
  s('rep-k-eq', equipos.length);
  s('rep-k-25', _fmtRep(totMonto25));
  s('rep-k-26', _fmtRep(totMonto26));

  const notaMatch = document.getElementById('rep-nota-match');
  if (notaMatch) notaMatch.textContent =
    `Identificación de equipo: ${ms.con_modelo || 0} por modelo explícito · ${ms.con_marca || 0} solo por marca · ${ms.con_cliente || 0} por cruce con Casos Relevantes (Equipos Detenidos) · ${ms.sin_identificar || 0} sin identificar`;

  // Filtrar equipos
  let equiposFilt = equipos;
  if (marcaF) equiposFilt = equiposFilt.filter(e => e.marca === marcaF);
  if (busq) {
    equiposFilt = equiposFilt.map(e => {
      const eMatch = (e.marca + ' ' + e.familia).toLowerCase().includes(busq);
      const productos = eMatch ? e.productos : e.productos.filter(p => p.repuesto.toLowerCase().includes(busq));
      return productos.length ? { ...e, productos } : null;
    }).filter(Boolean);
  }

  // Agrupar por marca para el rowspan
  const porMarca = {};
  equiposFilt.forEach(e => {
    if (!porMarca[e.marca]) porMarca[e.marca] = [];
    porMarca[e.marca].push(e);
  });
  const marcas = Object.keys(porMarca);

  const tbody = document.getElementById('rep-tbody');
  const tfoot = document.getElementById('rep-tfoot');
  const html = [];
  let granCasos25 = 0, granMonto25 = 0, granCasos26 = 0, granMonto26 = 0, granCasosTot = 0, granMontoTot = 0;
  let totalRepuestos = 0;

  const MAX_PRODUCTOS = 20; // límite de filas de repuesto individuales por equipo (el resto se resume en 1 fila)

  marcas.forEach(marca => {
    const eqs = porMarca[marca];
    const rowCounts = eqs.map(e => Math.min(Math.max(e.productos.length, 1), MAX_PRODUCTOS) + (e.productos.length > MAX_PRODUCTOS ? 1 : 0));
    const totalRowsMarca = rowCounts.reduce((a, b) => a + b, 0);
    let firstMarcaRow = true;

    eqs.forEach((e, idxEq) => {
      const allProductos = e.productos.length ? e.productos : [{ repuesto: '—', anios: { '2025': { casos: 0, monto: 0, pct: 0 }, '2026': { casos: 0, monto: 0, pct: 0 } }, total_casos: 0, total_monto: 0 }];
      const productos = allProductos.slice(0, MAX_PRODUCTOS);
      const resto = allProductos.slice(MAX_PRODUCTOS);
      const filasEquipo = productos.length + (resto.length ? 1 : 0);

      productos.forEach((p, idxP) => {
        totalRepuestos++;
        const marcaCell = firstMarcaRow
          ? `<td rowspan="${totalRowsMarca}" style="font-weight:700;font-size:.62rem;vertical-align:top;text-align:center;background:rgba(192,0,0,.06);padding-top:.4rem">${_escH(marca)}</td>`
          : '';
        firstMarcaRow = false;
        const familiaCell = idxP === 0
          ? `<td rowspan="${filasEquipo}" style="font-size:.62rem;font-weight:600;color:var(--am);vertical-align:top;padding-top:.4rem">${_escH(e.familia)}</td>`
          : '';
        const a25 = p.anios['2025'] || { casos: 0, monto: 0, pct: 0 };
        const a26 = p.anios['2026'] || { casos: 0, monto: 0, pct: 0 };

        html.push(`<tr>
          ${marcaCell}
          ${familiaCell}
          <td><span style="font-size:.6rem">${_escH(p.repuesto)}</span></td>
          <td style="text-align:center;font-size:.6rem">${a25.casos || '—'}</td>
          <td style="text-align:right;font-size:.6rem;color:var(--az2)">${_fmtRep(a25.monto)}</td>
          <td style="text-align:right;font-size:.6rem;color:var(--mut)">${a25.monto > 0 ? fN1(a25.pct) + '%' : '—'}</td>
          <td style="text-align:center;font-size:.6rem">${a26.casos || '—'}</td>
          <td style="text-align:right;font-size:.6rem;color:var(--az2)">${_fmtRep(a26.monto)}</td>
          <td style="text-align:right;font-size:.6rem;color:var(--mut)">${a26.monto > 0 ? fN1(a26.pct) + '%' : '—'}</td>
          <td style="text-align:center;font-size:.6rem;font-weight:700">${p.total_casos || '—'}</td>
          <td style="text-align:right;font-size:.6rem;font-weight:700;color:var(--teal)">${_fmtRep(p.total_monto)}</td>
        </tr>`);
      });

      if (resto.length) {
        totalRepuestos++;
        const marcaCell = firstMarcaRow
          ? `<td rowspan="${totalRowsMarca}" style="font-weight:700;font-size:.62rem;vertical-align:top;text-align:center;background:rgba(192,0,0,.06);padding-top:.4rem">${_escH(marca)}</td>`
          : '';
        firstMarcaRow = false;
        const familiaCell = productos.length === 0
          ? `<td rowspan="${filasEquipo}" style="font-size:.62rem;font-weight:600;color:var(--am);vertical-align:top;padding-top:.4rem">${_escH(e.familia)}</td>`
          : '';
        const restoCasos25 = resto.reduce((s, p) => s + (p.anios['2025']?.casos || 0), 0);
        const restoMonto25 = resto.reduce((s, p) => s + (p.anios['2025']?.monto || 0), 0);
        const restoCasos26 = resto.reduce((s, p) => s + (p.anios['2026']?.casos || 0), 0);
        const restoMonto26 = resto.reduce((s, p) => s + (p.anios['2026']?.monto || 0), 0);
        const restoCasosTot = resto.reduce((s, p) => s + (p.total_casos || 0), 0);
        const restoMontoTot = resto.reduce((s, p) => s + (p.total_monto || 0), 0);
        html.push(`<tr style="background:rgba(0,0,0,.02)">
          ${marcaCell}
          ${familiaCell}
          <td><span style="font-size:.58rem;font-style:italic;color:var(--mut)">+ ${resto.length} repuesto${resto.length !== 1 ? 's' : ''} adicional${resto.length !== 1 ? 'es' : ''} (menor monto)</span></td>
          <td style="text-align:center;font-size:.58rem;color:var(--mut)">${restoCasos25 || '—'}</td>
          <td style="text-align:right;font-size:.58rem;color:var(--mut)">${_fmtRep(restoMonto25)}</td>
          <td></td>
          <td style="text-align:center;font-size:.58rem;color:var(--mut)">${restoCasos26 || '—'}</td>
          <td style="text-align:right;font-size:.58rem;color:var(--mut)">${_fmtRep(restoMonto26)}</td>
          <td></td>
          <td style="text-align:center;font-size:.58rem;color:var(--mut)">${restoCasosTot}</td>
          <td style="text-align:right;font-size:.58rem;color:var(--mut)">${_fmtRep(restoMontoTot)}</td>
        </tr>`);
      }

      // Subtotal por equipo (marca+familia)
      const a25tot = e.anios_total?.['2025'] || 0;
      const a26tot = e.anios_total?.['2026'] || 0;
      html.push(`<tr style="background:rgba(192,0,0,.1)">
        <td colspan="2" style="text-align:right;font-size:.6rem;font-style:italic;color:var(--txt);padding:.3rem .6rem">Subtotal ${_escH(e.familia)}</td>
        <td></td>
        <td style="text-align:right;font-size:.6rem;font-weight:800;color:var(--az2)">${_fmtRep(a25tot)}</td>
        <td></td>
        <td></td>
        <td style="text-align:right;font-size:.6rem;font-weight:800;color:var(--az2)">${_fmtRep(a26tot)}</td>
        <td></td>
        <td style="text-align:center;font-size:.6rem;font-weight:800">${e.total_casos}</td>
        <td style="text-align:right;font-size:.6rem;font-weight:800;color:var(--teal)">${_fmtRep(e.total_monto)}</td>
      </tr>`);

      granCasos25 += 0; // (los subtotales por año se acumulan abajo con anios_total)
      granMonto25 += a25tot;
      granMonto26 += a26tot;
      granCasosTot += e.total_casos;
      granMontoTot += e.total_monto;
    });
  });

  if (tbody) tbody.innerHTML = html.join('') || '<tr><td colspan="11" style="text-align:center;padding:1.2rem;color:var(--mut)">Sin resultados para los filtros seleccionados</td></tr>';

  if (tfoot) {
    tfoot.innerHTML = marcas.length ? `<tr>
      <td colspan="3" style="padding:.4rem .7rem;font-size:.62rem">Total General · ${marcas.length} marca${marcas.length !== 1 ? 's' : ''} · ${equiposFilt.length} equipo${equiposFilt.length !== 1 ? 's' : ''}</td>
      <td></td>
      <td style="text-align:right;font-size:.65rem">${_fmtRep(granMonto25)}</td>
      <td></td>
      <td></td>
      <td style="text-align:right;font-size:.65rem">${_fmtRep(granMonto26)}</td>
      <td></td>
      <td style="text-align:center;font-size:.65rem">${granCasosTot}</td>
      <td style="text-align:right;font-size:.65rem">${_fmtRep(granMontoTot)}</td>
    </tr>` : '';
  }

  const tCount = document.getElementById('rep-t-count');
  if (tCount) tCount.textContent = equiposFilt.length + ' equipo' + (equiposFilt.length !== 1 ? 's' : '') + ' · ' + totalRepuestos + ' repuesto' + (totalRepuestos !== 1 ? 's' : '');
}

// ── HOOK sv() ────────────────────────────────────────────────────
(function () {
  const orig = window.sv;
  if (typeof orig === 'function') {
    window.sv = function (name, btn) {
      orig(name, btn);
      if (name === 'repuestos') setTimeout(initRepuestos, 80);
    };
  }
})();
