// ═══════════════════════════════════════════════════════════════
// hoja_desglose.js — Desglose de Ingresos (Contratos por línea + Otros Ingresos)
// Depende de: datos.js (APP_DATA.desglose_ingresos), utils.js
// ═══════════════════════════════════════════════════════════════
(function(){
  const D = (APP_DATA && APP_DATA.desglose_ingresos) || {};
  if(!D.meses || !D.meses.length){
    const el = document.getElementById('desg-empty');
    if(el) el.style.display='block';
    return;
  }

  const meses = D.meses;
  const n = meses.length;

  const mesLbl = document.getElementById('desg-mes-lbl');
  if(mesLbl) mesLbl.textContent = meses[n-1];
  const anoLbl = document.getElementById('desg-ano-lbl');
  if(anoLbl) anoLbl.textContent = ANO_ACTUAL;

  const fN1 = v => (v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fmm = v => { const a=Math.abs(v||0); return (v<0?'−':'')+fN1(a); };

  const contratosTotal = D.contratos.total[n];
  const otrosTotal     = D.otros.total[n];
  const grandTotal     = D.total_general[n];

  const k1=document.getElementById('desg-k1'), k2=document.getElementById('desg-k2'), k3=document.getElementById('desg-k3');
  if(k1) k1.textContent = 'MM$'+fmm(grandTotal);
  if(k2) k2.textContent = 'MM$'+fmm(contratosTotal);
  if(k3) k3.textContent = 'MM$'+fmm(otrosTotal);

  // Evita que hover del .tbl borre el fondo en la fila azul de total (texto blanco)
  if(!document.getElementById('desg-azul-style')){
    const s = document.createElement('style');
    s.id = 'desg-azul-style';
    s.textContent = `
      #desg-table tr.desg-azul:hover { background: var(--az3) !important; }
      #desg-table tr.desg-azul:hover td { background-color: transparent; }
    `;
    document.head.appendChild(s);
  }

  // ── TABLA ────────────────────────────────────────────────────
  const tblEl = document.getElementById('desg-table');
  if(tblEl){
    const colHdr    = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrTot = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const SL  = 'position:sticky;left:0;top:0;z-index:2';
    const NW  = 'white-space:nowrap';
    const BG_CEL = '#def3fa';
    const BG_SEP = '#edf0f5';
    const SLC = bg => `position:sticky;left:0;z-index:1;background:${bg};border-right:1px solid rgba(0,0,0,.08)`;

    const thMeses = meses.map(m=>`<th style="position:sticky;top:0;z-index:2;${colHdr}">${m.slice(0,3)}</th>`).join('');

    const sepRow = lbl => `<tr style="background:rgba(0,45,115,.07)">
      <td style="${SLC(BG_SEP)};font-size:.58rem;font-weight:700;color:var(--mut);padding:.22rem .6rem;letter-spacing:.05em">${lbl.toUpperCase()}</td>
      <td colspan="${n+2}" style="background:rgba(0,45,115,.07)"></td>
    </tr>`;

    const cellsRow = (valores,fw,color) => {
      const c = color||'#111';
      const mesesTd = Array.from({length:n},(_,i)=>`<td class="num" style="${NW};${fw?'font-weight:700;':''}color:${c}">${fmm(valores[i])}</td>`).join('');
      const totTd   = `<td class="num" style="${NW};font-weight:700;color:${c}">${fmm(valores[n])}</td>`;
      const pctTd   = `<td class="num" style="${NW};color:${color?'rgba(255,255,255,.6)':'var(--mut)'}">${grandTotal>0?((valores[n]/grandTotal)*100).toFixed(1).replace('.',','):'0,0'}%</td>`;
      return mesesTd+totTd+pctTd;
    };

    const dataRow = (lbl,valores) => `<tr>
      <td style="${SLC('var(--bg,#fff)')};font-size:.62rem;white-space:nowrap;padding:.3rem .6rem .3rem 1.4rem">${lbl}</td>
      ${cellsRow(valores,false)}
    </tr>`;

    const subtotalRow = (lbl,valores) => `<tr style="background:rgba(0,160,220,.13)">
      <td style="${SLC(BG_CEL)};font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;font-weight:700">${lbl}</td>
      ${cellsRow(valores,true)}
    </tr>`;

    const totalRow = (lbl,valores) => `<tr class="desg-azul" style="background:var(--az3)">
      <td style="${SLC('var(--az3)')};font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;font-weight:700;color:#fff">${lbl}</td>
      ${cellsRow(valores,true,'#fff')}
    </tr>`;

    tblEl.innerHTML = `
      <div style="overflow-x:auto;overflow-y:auto;max-height:60vh">
        <table class="tbl" style="font-size:.62rem;width:100%;min-width:640px;border-collapse:separate;border-spacing:0">
          <thead>
            <tr>
              <th style="${SL};${colHdr};text-align:left;min-width:200px">Concepto</th>
              ${thMeses}
              <th style="position:sticky;top:0;z-index:2;${colHdrTot}">TOTAL</th>
              <th style="position:sticky;top:0;z-index:2;${colHdrTot}">% TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${sepRow('Ingreso por Contratos')}
            ${D.contratos.lineas.map(l=>dataRow(l.label,l.valores)).join('')}
            ${subtotalRow('Total Ingreso por Contratos',D.contratos.total)}
            ${sepRow('Otros Ingresos')}
            ${D.otros.categorias.map(c=>dataRow(c.label,c.valores)).join('')}
            ${subtotalRow('Total Otros Ingresos',D.otros.total)}
            ${totalRow('TOTAL FACTURACIÓN',D.total_general)}
          </tbody>
        </table>
      </div>`;
  }

  // ── REGIÓN ───────────────────────────────────────────────────
  // Misma base que la tabla de desglose: contr_meses_2026 + otros proporcional
  const PR = D.por_region || {};
  const regiones = PR.regiones || [];
  const regData  = PR.data    || {};

  const PALETTE_MAP = {
    'Esterilización':'#002D73','Endoscopía':'#28D2C3','Dental':'#FFC000',
    'Trazabilidad':'#7A1FAA','REAS':'#E87722',
    'Reparación Esterilización':'#0A5C8C','Reparación Endoscopía':'#00832F','Reparación Dental':'#D46000',
  };
  const PALETTE_REG = ['#002D73','#28D2C3','#FFC000','#E87722','#7A1FAA',
                       '#0A5C8C','#00832F','#D46000','#8B008B','#5a7da8',
                       '#c44569','#574b90','#3c9d4e','#b5451b','#888','#333','#aaa'];

  if(regiones.length > 0){
    // Conjunto vacío = todas. Comparar dos o tres regiones entre sí es la
    // pregunta natural de esta hoja y con selección única había que ir
    // alternando y recordar lo anterior de memoria.
    const selRegs   = new Set();
    let chartReg    = null;
    let _regMapL    = null;
    let _regMapLyr  = null;

    const regSub  = document.getElementById('desg-reg-sub');
    const regBtns = document.getElementById('desg-reg-btns');

    // Las regiones activas, en el orden en que vienen: así la tabla y el
    // gráfico no cambian de orden según el orden en que se hizo clic.
    const regsSel = () => selRegs.size ? regiones.filter(r=>selRegs.has(r)) : regiones;
    const etqSel  = () => selRegs.size===1 ? regsSel()[0]
                        : selRegs.size ? selRegs.size+' regiones' : null;

    // r null limpia la selección; cualquier otra la agrega o la quita.
    function setRegion(r){
      if(r===null) selRegs.clear();
      else if(selRegs.has(r)) selRegs.delete(r);
      else selRegs.add(r);
      pintarBtns();
      renderRegTable();
      renderRegChart();
      renderRegMap();
    }

    // Excel con la misma información que la tabla: por cada región elegida sus
    // tres líneas, el total de contratos, los otros ingresos y el total, mes a
    // mes, con el total del año y la comparación con los dos años anteriores;
    // al final el total de la selección. Los montos van como número (MM$) y
    // las variaciones como porcentaje, para que se puedan seguir trabajando.
    window._desgRegExport = function(){
      if (typeof XLSX === 'undefined') {
        alert('Librería Excel no cargada. Verifique conexión a internet e intente de nuevo.');
        return;
      }
      const list = regsSel();
      const LINEAS = ['Esterilización','Endoscopía','Dental'];
      const A1 = ANO_ACTUAL - 1, A2 = ANO_ACTUAL - 2;
      const cab = ['Concepto'].concat(meses.map(m => m.slice(0,3)),
        ['Total ' + ANO_ACTUAL, 'Acum. ' + A1, 'Var. vs ' + A1, 'Acum. ' + A2, 'Var. vs ' + A2]);
      const NC = cab.length;
      const var_ = (act, ant) => ant ? (act - ant) / ant : '';
      const filas = [];   // { tipo, color, v: [...] }
      const fila = (tipo, lbl, arr, a25, a24, color) => {
        const act = (arr || [])[n] || 0;
        filas.push({ tipo: tipo, color: color, v: [lbl].concat(
          Array.from({ length: n + 1 }, (_, k) => +(((arr || [])[k] || 0).toFixed(3))),
          [a25 || '', var_(act, a25), a24 || '', var_(act, a24)]) });
      };

      list.forEach(r => {
        const rd  = regData[r] || { contratos:[], otros:[], total:[], lineas:{}, aa_2025:{}, aa_2024:{} };
        const clr = PALETTE_REG[regiones.indexOf(r) % PALETTE_REG.length];
        const L = rd.lineas || {}, a25 = rd.aa_2025 || {}, a24 = rd.aa_2024 || {};
        filas.push({ tipo: 'region', color: clr, v: [r] });
        LINEAS.forEach(ln => fila('linea', '   ' + ln, L[ln], (a25.lineas||{})[ln], (a24.lineas||{})[ln]));
        fila('contratos', 'Total Contratos', rd.contratos, a25.contratos, a24.contratos);
        fila('otros', 'Otros Ingresos', rd.otros, a25.otros, a24.otros);
        fila('total', 'TOTAL FACTURACIÓN', rd.total, rd.acum_2025, rd.acum_2024);
        filas.push({ tipo: 'vacia', v: [] });
      });
      // Total de la selección
      const suma = k => list.reduce((s2, r) => s2 + ((regData[r] && regData[r].total[k]) || 0), 0);
      const g26 = suma(n);
      const g25 = list.reduce((s2, r) => s2 + ((regData[r] && regData[r].acum_2025) || 0), 0);
      const g24 = list.reduce((s2, r) => s2 + ((regData[r] && regData[r].acum_2024) || 0), 0);
      filas.push({ tipo: 'gran', v: [(etqSel() ? etqSel() + ' · TOTAL' : 'TOTAL GENERAL')].concat(
        Array.from({ length: n + 1 }, (_, k) => +suma(k).toFixed(3)), [g25 || '', var_(g26, g25), g24 || '', var_(g26, g24)]) });

      const titulo = 'Facturación por Región (MM$) · ' +
        (!selRegs.size ? 'todas las regiones (' + regiones.length + ')' : list.join(', '));
      const aoa = [[titulo], [], cab].concat(filas.map(f => f.v));
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      const BORDE = { style: 'thin', color: { rgb: 'D4D5E8' } };
      const BOX = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
      const hex = c => { let h = String(c).replace('#', '').toUpperCase();
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        return h.padEnd(6, '0').slice(0, 6); };
      // Texto oscuro sobre los colores claros de región (amarillo, turquesa, gris).
      const tinta = c => { const h = hex(c); const lum = (parseInt(h.slice(0,2),16)*299 +
        parseInt(h.slice(2,4),16)*587 + parseInt(h.slice(4,6),16)*114) / 1000;
        return lum > 150 ? '1A1A1A' : 'FFFFFF'; };
      const estilo = (f, ci) => {
        const der = ci > 0;
        const base = { font: { sz: 9 }, border: BOX, alignment: { horizontal: der ? 'right' : 'left', vertical: 'center' } };
        if (f.tipo === 'region') return { font: { bold: true, sz: 10, color: { rgb: tinta(f.color) } },
          fill: { patternType: 'solid', fgColor: { rgb: hex(f.color) } }, border: BOX };
        if (f.tipo === 'contratos') return Object.assign(base, { font: { bold: true, sz: 9, color: { rgb: '1A5FA8' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'E6F4FA' } } });
        if (f.tipo === 'otros') return Object.assign(base, { font: { sz: 9, color: { rgb: '666666' } } });
        if (f.tipo === 'total' || f.tipo === 'gran') return Object.assign(base, { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: f.tipo === 'gran' ? '0E2D55' : '1F3F75' } } });
        if (f.tipo === 'vacia') return {};
        return base;
      };
      const R0 = 3;   // primera fila de datos (0-based): título, vacía, cabecera
      ws['A1'].s = { font: { bold: true, sz: 12, color: { rgb: '002D73' } } };
      cab.forEach((c, ci) => {
        ws[XLSX.utils.encode_cell({ r: 2, c: ci })].s = { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: ci > n ? '1A3A6B' : '002D73' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: BOX };
      });
      const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } }];
      filas.forEach((f, ri) => {
        const r = R0 + ri;
        if (f.tipo === 'region') merges.push({ s: { r: r, c: 0 }, e: { r: r, c: NC - 1 } });
        if (f.tipo === 'vacia') return;
        for (let ci = 0; ci < NC; ci++) {
          const ref = XLSX.utils.encode_cell({ r: r, c: ci });
          if (!ws[ref]) ws[ref] = { t: 's', v: '' };
          ws[ref].s = estilo(f, ci);
          if (f.tipo === 'region' || ci === 0) continue;
          const esVar = ci === NC - 3 || ci === NC - 1;
          if (typeof ws[ref].v === 'number') ws[ref].z = esVar ? '+0.0%;-0.0%' : '#,##0.0';
          // Las variaciones se pintan como en la tabla: verde si crece, rojo si cae.
          if (esVar && typeof ws[ref].v === 'number' && f.tipo !== 'total' && f.tipo !== 'gran') {
            ws[ref].s = Object.assign({}, ws[ref].s, { font: { bold: true, sz: 9, color: { rgb: ws[ref].v >= 0 ? '00832F' : 'C00000' } } });
          }
          if (esVar && ws[ref].v === '') ws[ref].v = 's/d';
        }
      });
      ws['!merges'] = merges;
      ws['!cols'] = [{ wch: 26 }].concat(meses.map(() => ({ wch: 8 })), [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]);
      ws['!rows'] = [{ hpt: 20 }, { hpt: 6 }, { hpt: 28 }];
      ws['!freeze'] = { xSplit: 1, ySplit: 3 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Facturación por región');
      const hoy = ((window.APP_DATA || {}).hoy || '').replace(/[\s/]+/g, '-');
      const sufijo = !selRegs.size ? 'todas' : (list.length === 1 ? list[0] : list.length + '_regiones');
      XLSX.writeFile(wb, 'Facturacion_por_region_' + sufijo.replace(/[^\wÁÉÍÓÚáéíóúÑñ]+/g, '_') + '_' + hoy + '.xlsx');
    };

    function pintarBtns(){
      if(!regBtns) return;
      regBtns.querySelectorAll('.btn').forEach(x=>{
        const r = x.dataset.reg;
        x.classList.toggle('on', r==='__todas__' ? !selRegs.size : selRegs.has(r));
      });
    }

    // ── Botones de filtro ───────────────────────────────────
    if(regBtns){
      const allBtn = document.createElement('button');
      allBtn.className='btn on'; allBtn.textContent='Todas';
      allBtn.dataset.reg='__todas__';
      allBtn.title='Quitar el filtro y volver a las '+regiones.length+' regiones';
      allBtn.addEventListener('click',()=>setRegion(null));
      regBtns.appendChild(allBtn);

      regiones.forEach((r,i)=>{
        const b=document.createElement('button');
        b.className='btn'; b.textContent=r;
        b.dataset.reg=r;
        b.style.cssText=`font-size:.57rem;border-left:3px solid ${PALETTE_REG[i%PALETTE_REG.length]}`;
        b.title='Clic para sumar o quitar esta región de la comparación';
        b.addEventListener('click',()=>setRegion(r));
        regBtns.appendChild(b);
      });
      const pista = document.createElement('span');
      pista.style.cssText='font-size:.54rem;color:var(--mut);margin-left:.4rem;align-self:center';
      pista.textContent='se pueden combinar varias';
      regBtns.appendChild(pista);
    }

    // ── Tabla detallada por región (espeja estructura de tabla global) ─────────
    function renderRegTable(){
      const el = document.getElementById('desg-reg-table');
      if(!el) return;

      const H  = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.57rem;font-weight:700;text-align:center;padding:.26rem .38rem;white-space:nowrap';
      const Ht = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.57rem;font-weight:700;text-align:center;padding:.26rem .38rem';
      const thM = meses.map(m=>`<th style="${H}">${m.slice(0,3)}</th>`).join('');
      const list = regsSel();

      const LINEAS = ['Esterilización','Endoscopía','Dental'];
      const LCLR   = {'Esterilización':'#002D73','Endoscopía':'#28D2C3','Dental':'#FFC000'};

      function cell(arr, j, opts={}){
        return `<td class="num" style="font-size:.56rem;${opts.bold?'font-weight:700;':''}color:${opts.color||'inherit'};padding:.2rem .38rem">${fmm((arr||[])[j]||0)}</td>`;
      }
      // 4 columnas de comparación anual. Sólo se llenan en la fila de total
      // de cada región; en el resto van vacías para mantener la grilla.
      const EXTRA = 4;
      const vacias = (bg) => Array.from({length:EXTRA},()=>
        `<td style="padding:.2rem .38rem;${bg?'background:'+bg+';':''}"></td>`).join('');
      const celdaAA = (v, opts={}) =>
        `<td class="num" style="font-size:.56rem;${opts.bold?'font-weight:700;':''}color:${opts.color||'var(--mut)'};padding:.2rem .38rem">${v?fmm(v):'—'}</td>`;
      const celdaVar = (act, ant, opts={}) => {
        if(!ant) return `<td class="num" style="font-size:.54rem;color:${opts.mut||'var(--mut)'};padding:.2rem .38rem">s/d</td>`;
        const d = (act-ant)/ant*100;
        const c = opts.blanco ? (d>=0?'#7BFFB0':'#FFB0B0') : (d>=0?'var(--gn)':'var(--rd)');
        return `<td class="num" style="font-size:.55rem;font-weight:700;color:${c};padding:.2rem .38rem">${d>=0?'+':''}${fN1(d)}%</td>`;
      };

      // Las 4 celdas de comparacion anual para una fila cualquiera.
      // act = valor del ano en curso, a25/a24 = acumulados de los anos previos.
      const cuatroAA = (act, a25, a24, opts={}) =>
        celdaAA(a25, opts) + celdaVar(act, a25, opts) +
        celdaAA(a24, opts) + celdaVar(act, a24, opts);

      function dataRow(lbl, arr, opts={}){
        const cells = Array.from({length:n+1},(_,j)=>cell(arr,j,opts)).join('');
        return `<tr style="${opts.bg?'background:'+opts.bg:''};${opts.rowX||''}">
          <td style="font-size:${opts.sz||'.56rem'};${opts.bold?'font-weight:700;':''}color:${opts.color||'inherit'};padding:.2rem .5rem;white-space:nowrap;${opts.bgL?'background:'+opts.bgL+';':''}">${lbl}</td>
          ${cells}${opts.aa || vacias(opts.bg)}
        </tr>`;
      }

      const rows = list.map(r=>{
        const rd  = regData[r] || {contratos:[],otros:[],total:[],lineas:{},aa_2025:{},aa_2024:{}};
        const clr = PALETTE_REG[regiones.indexOf(r)%PALETTE_REG.length];
        const L   = rd.lineas || {};
        const a25 = rd.aa_2025 || {};
        const a24 = rd.aa_2024 || {};
        return [
          `<tr style="background:${clr}18">
            <td colspan="${n+2+4}" style="font-size:.61rem;font-weight:700;color:${clr};padding:.3rem .55rem .26rem;border-top:2px solid ${clr}30;border-left:4px solid ${clr}">${r}</td>
          </tr>`,
          ...LINEAS.map(ln=>dataRow('  '+ln, L[ln]||[], {color:LCLR[ln]||'var(--mut)',
            aa: cuatroAA((L[ln]||[])[n]||0, (a25.lineas||{})[ln]||0, (a24.lineas||{})[ln]||0)})),
          dataRow('Total Contratos', rd.contratos, {bold:true, color:'var(--az2)', bg:'rgba(0,160,220,.07)', sz:'.57rem',
            aa: cuatroAA(rd.contratos[n]||0, a25.contratos||0, a24.contratos||0, {bold:true})}),
          dataRow('Otros Ingresos',  rd.otros,     {color:'#888',
            aa: cuatroAA(rd.otros[n]||0, a25.otros||0, a24.otros||0)}),
          dataRow('TOTAL FACTURACIÓN', rd.total,   {bold:true, color:'#fff', bg:'var(--az3)', bgL:'var(--az3)', sz:'.58rem',
            aa: cuatroAA(rd.total[n]||0, rd.acum_2025, rd.acum_2024, {bold:true, color:'#B8C1D8', blanco:true})}),
          `<tr style="height:4px"><td colspan="${n+2+4}"></td></tr>`,
        ].join('');
      });

      const grandCells = Array.from({length:n+1},(_,j)=>{
        const v = list.reduce((s,r)=>s+(regData[r]&&regData[r].total[j]||0),0);
        return `<td class="num" style="font-weight:700;font-size:.58rem;color:#fff;padding:.24rem .38rem">${fmm(v)}</td>`;
      }).join('');

      el.innerHTML=`<div style="overflow-x:auto;overflow-y:auto;max-height:480px">
        <table class="tbl" style="font-size:.58rem;width:100%;min-width:420px;border-collapse:separate;border-spacing:0">
          <thead><tr>
            <th style="${H};text-align:left;min-width:140px;position:sticky;left:0;top:0;z-index:3">Concepto</th>
            ${thM}
            <th style="${Ht};position:sticky;top:0;z-index:2">TOTAL<br><span style="font-weight:400;font-size:.5rem">${ANO_ACTUAL}</span></th>
            <th style="${Ht};position:sticky;top:0;z-index:2" title="Acumulado Ene–${meses[n-1]} ${ANO_ACTUAL-1}">ACUM.<br><span style="font-weight:400;font-size:.5rem">${ANO_ACTUAL-1}</span></th>
            <th style="${Ht};position:sticky;top:0;z-index:2" title="Variación ${ANO_ACTUAL} vs ${ANO_ACTUAL-1}">VAR.<br><span style="font-weight:400;font-size:.5rem">vs ${ANO_ACTUAL-1}</span></th>
            <th style="${Ht};position:sticky;top:0;z-index:2" title="Acumulado Ene–${meses[n-1]} ${ANO_ACTUAL-2}">ACUM.<br><span style="font-weight:400;font-size:.5rem">${ANO_ACTUAL-2}</span></th>
            <th style="${Ht};position:sticky;top:0;z-index:2" title="Variación ${ANO_ACTUAL} vs ${ANO_ACTUAL-2}">VAR.<br><span style="font-weight:400;font-size:.5rem">vs ${ANO_ACTUAL-2}</span></th>
          </tr></thead>
          <tbody>
            ${rows.join('')}
            <tr class="desg-azul" style="background:var(--az3)">
              <td style="font-size:.6rem;font-weight:700;color:#fff;padding:.3rem .55rem;position:sticky;left:0;background:var(--az3);white-space:nowrap">${etqSel()?etqSel()+' · TOTAL':'TOTAL GENERAL'}</td>
              ${grandCells}
              ${(function(){
                const g26 = list.reduce((s2,r)=>s2+((regData[r]&&regData[r].total[n])||0),0);
                const g25 = list.reduce((s2,r)=>s2+((regData[r]&&regData[r].acum_2025)||0),0);
                const g24 = list.reduce((s2,r)=>s2+((regData[r]&&regData[r].acum_2024)||0),0);
                return celdaAA(g25,{bold:true,color:'#B8C1D8'}) + celdaVar(g26,g25,{blanco:true}) +
                       celdaAA(g24,{bold:true,color:'#B8C1D8'}) + celdaVar(g26,g24,{blanco:true});
              })()}
            </tr>
          </tbody>
        </table>
      </div>`;
    }

    // ── Gráfico mensual por región ──────────────────────────
    function renderRegChart(){
      const ctx2 = document.getElementById('cDesgRegion');
      if(!ctx2||!window.Chart) return;
      if(chartReg){chartReg.destroy();chartReg=null;}
      const labels = meses.map(m=>m.slice(0,3));
      let datasets, title;

      // Con una sola región se abre por línea de negocio, que es el detalle que
      // interesa; con varias se apilan las regiones entre sí, que es la
      // comparación que se buscaba al seleccionarlas.
      if(selRegs.size!==1){
        const list=regsSel();
        datasets=list.map(r=>({
          label:r,
          data:(regData[r]||{contratos:[]}).contratos.slice(0,n),
          backgroundColor:PALETTE_REG[regiones.indexOf(r)%PALETTE_REG.length],
          stack:'s1',borderRadius:2,
        }));
        title='Contratos por Región (MM$)';
        if(regSub){
          const ytd=list.reduce((s2,r)=>s2+((regData[r]&&regData[r].total[n])||0),0);
          regSub.textContent = selRegs.size
            ? list.length+' regiones seleccionadas · YTD MM$'+fmm(ytd)
            : regiones.length+' regiones';
        }
      } else {
        const selReg=regsSel()[0];
        const rd=regData[selReg]||{};
        const lineas=rd.lineas||{};
        datasets=[
          {label:'Esterilización',data:(lineas['Esterilización']||[]).slice(0,n),backgroundColor:PALETTE_MAP['Esterilización'],stack:'s1',borderRadius:2},
          {label:'Endoscopía',    data:(lineas['Endoscopía']||[]).slice(0,n),    backgroundColor:PALETTE_MAP['Endoscopía'],    stack:'s1',borderRadius:2},
          {label:'Dental',        data:(lineas['Dental']||[]).slice(0,n),        backgroundColor:PALETTE_MAP['Dental'],        stack:'s1',borderRadius:2},
          {label:'Otros',         data:(rd.otros||[]).slice(0,n),                backgroundColor:'#C0C0C0',                    stack:'s1',borderRadius:2},
        ];
        title=selReg;
        if(regSub) regSub.textContent=selReg+' · YTD MM$'+fmm((rd.total||[])[n]||0);
      }

      chartReg=new Chart(ctx2.getContext('2d'),{
        type:'bar',data:{labels,datasets},
        options:{
          responsive:true,maintainAspectRatio:false,
          interaction:{mode:'index',intersect:false},
          plugins:{
            title:{display:true,text:title,font:{size:9},color:'var(--mut)',padding:{bottom:3}},
            legend:{position:'bottom',labels:{boxWidth:9,font:{size:8},padding:5}},
            tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${fN1(c.raw||0)}`}}
          },
          scales:{
            x:{stacked:true,grid:{display:false},ticks:{font:{size:9}}},
            y:{stacked:true,grid:{color:'#E2E6F0'},
               ticks:{font:{size:9},callback:v=>'MM$'+(v||0).toLocaleString('es-CL',{maximumFractionDigits:0})}}
          }
        }
      });
    }

    // ── Mapa Leaflet con burbujas por región ───────────────
    const GEO_CL = {
      'Arica y Parinacota':                 {lat:-18.5,lon:-70.3},
      'Tarapacá':                            {lat:-20.2,lon:-69.3},
      'Antofagasta':                         {lat:-23.7,lon:-69.7},
      'Atacama':                             {lat:-27.4,lon:-70.3},
      'Coquimbo':                            {lat:-30.0,lon:-71.3},
      'Valparaíso':                          {lat:-33.0,lon:-71.6},
      'Metropolitana de Santiago':           {lat:-33.5,lon:-70.6},
      'Metropolitana':                       {lat:-33.5,lon:-70.6},
      "O'Higgins":                           {lat:-34.6,lon:-71.0},
      'Maule':                               {lat:-35.4,lon:-71.7},
      'Ñuble':                               {lat:-36.7,lon:-71.8},
      'Bío Bío':                             {lat:-37.5,lon:-72.4},
      'Biobío':                              {lat:-37.5,lon:-72.4},
      'Araucanía':                           {lat:-38.9,lon:-72.3},
      'Los Ríos':                            {lat:-39.8,lon:-73.2},
      'Los Lagos':                           {lat:-41.5,lon:-73.0},
      'Aysén':                               {lat:-45.6,lon:-72.1},
      'Magallanes y la Antártica Chilena':   {lat:-53.2,lon:-70.9},
      'Magallanes':                          {lat:-53.2,lon:-70.9},
    };

    function renderRegMap(){
      if(!window.L) return;
      const div = document.getElementById('cDesgMap');
      if(!div) return;

      if(!_regMapL){
        _regMapL = L.map('cDesgMap',{zoomControl:true,scrollWheelZoom:false})
                    .setView([-35.5,-70.5],4);
        mapaTiles(_regMapL);
      }
      if(!_regMapLyr){ _regMapLyr=L.layerGroup().addTo(_regMapL); }
      _regMapLyr.clearLayers();

      const maxV = Math.max(...regiones.map(r=>(regData[r]||{total:[]}).total[n]||0),1);

      regiones.forEach((r,i)=>{
        const rd  = regData[r]||{total:[]};
        const geo = GEO_CL[r];
        if(!geo) return;
        const val = rd.total[n]||0;
        const clr = PALETTE_REG[i%PALETTE_REG.length];
        const isSel = selRegs.has(r);
        const radius = Math.max(8, Math.sqrt(val/maxV)*36);

        const circ = L.circleMarker([geo.lat,geo.lon],{
          radius, fillColor:clr,
          color: isSel?'#fff':clr,
          weight: isSel?2.5:1.5,
          opacity:1, fillOpacity: isSel?0.95:0.78,
        });
        circ.bindTooltip(
          `<strong style="font-size:.7rem">${r}</strong><br>`+
          `<span style="font-size:.62rem">Total YTD: <strong>MM$${fN1(val)}</strong></span><br>`+
          `<span style="font-size:.62rem">Contratos: <strong>MM$${fN1((rd.contratos||[])[n]||0)}</strong></span>`,
          {sticky:true,opacity:.95}
        );
        circ.on('click',()=>setRegion(r));
        _regMapLyr.addLayer(circ);
      });

      // Una región se centra; varias se encuadran juntas, que para eso se
      // seleccionaron. Chile es largo y con dos extremos el encuadre es la
      // única forma de ver las dos a la vez.
      const geos = regsSel().map(r=>GEO_CL[r]).filter(Boolean);
      if(!selRegs.size || !geos.length){
        _regMapL.setView([-35.5,-70.5],4,{animate:true});
      } else if(geos.length===1){
        _regMapL.setView([geos[0].lat,geos[0].lon],6,{animate:true});
      } else {
        _regMapL.fitBounds(L.latLngBounds(geos.map(g=>[g.lat,g.lon])),
                           {padding:[40,40],maxZoom:7,animate:true});
      }
    }

    renderRegTable();
    renderRegChart();
    renderRegMap();

    // Permite que sv() llame invalidateSize cuando la vista se hace visible
    window._desgMapRefresh = function(){
      if(_regMapL){ _regMapL.invalidateSize(); renderRegMap(); }
    };
  }

  // ── GRÁFICO APILADO ──────────────────────────────────────────
  const ctx = document.getElementById('cDesglose');
  if(ctx && window.Chart){
    const PALETTE = {
      'Esterilización':'#002D73', 'Endoscopía':'#28D2C3', 'Dental':'#FFC000',
      'Trazabilidad':'#7A1FAA', 'REAS':'#E87722',
      'Reparación Esterilización':'#0A5C8C', 'Reparación Endoscopía':'#00832F', 'Reparación Dental':'#D46000',
    };
    const datasets = [
      ...D.contratos.lineas.map(l=>({label:l.label, data:l.valores.slice(0,n), backgroundColor:PALETTE[l.label]||'#999', stack:'s1'})),
      ...D.otros.categorias.map(c=>({label:c.label, data:c.valores.slice(0,n), backgroundColor:PALETTE[c.label]||'#999', stack:'s1'})),
    ];
    new Chart(ctx.getContext('2d'),{
      type:'bar',
      data:{ labels: meses.map(m=>m.slice(0,3)), datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{position:'bottom',labels:{boxWidth:10,font:{size:8},padding:8}},
          tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${fN1(c.raw||0)}`}}
        },
        scales:{
          x:{stacked:true,grid:{display:false},ticks:{font:{size:9}}},
          y:{stacked:true,grid:{color:'#E2E6F0'},
             ticks:{font:{size:9},callback:v=>'MM$'+(v||0).toLocaleString('es-CL',{maximumFractionDigits:0})}}
        }
      }
    });
  }
})();
