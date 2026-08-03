// ═══════════════════════════════════════════════════════════════
// hoja_eerr.js — EERR S&S y Análisis de Ratios
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════
(function(){
  const R2 = (APP_DATA && APP_DATA.ratios2) || {};
  if(!R2.meses || !R2.meses.length){
    const el = document.getElementById('view-eerr');
    if(el){
      const note = el.querySelector('#eerr-empty');
      if(note) note.style.display='block';
    }
    return;
  }

  const meses = R2.meses;
  const n = meses.length;

  // Evita que hover del .tbl borre el fondo en filas azules (texto blanco)
  if(!document.getElementById('eerr-azul-style')){
    const s = document.createElement('style');
    s.id = 'eerr-azul-style';
    s.textContent = `
      #eerr-table tr.eerr-azul:hover { background: var(--az3) !important; }
      #eerr-table tr.eerr-azul:hover td { background-color: transparent; }
    `;
    document.head.appendChild(s);
  }

  // Mes etiqueta header
  const mesLbl = document.getElementById('eerr-mes-lbl');
  if(mesLbl) mesLbl.textContent = meses[n-1] + ' ' + ANO_ACTUAL;

  // ── Helpers ──────────────────────────────────────────────────
  const fN1  = v => (v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fmm  = v => { const a=Math.abs(v||0); return (v<0?'−':'')+fN1(a); };
  const fpct = v => ((v||0)*100).toFixed(1).replace('.',',')+'%';
  const sumArr = arr => (arr||[]).slice(0,n).reduce((s,v)=>s+(v||0),0);

  // ── EERR TABLE ────────────────────────────────────────────────
  const eerrEl  = document.getElementById('eerr-table');
  const segEl   = document.getElementById('eerr-mes-seg');
  let _selMonths = Array.from({length:n},(_,i)=>i); // todos seleccionados por defecto

  const hasGaAd = [R2.finiquitos,R2.multas,R2.prov_obsolescencias,R2.prov_incobrables,R2.prov_habilitacion]
    .some(a=>(a||[]).some(v=>v!==0));

  function renderEERR(){
    if(!eerrEl) return;
    const sm = _selMonths;
    const ns = sm.length;
    if(ns===0){ eerrEl.innerHTML='<p style="padding:1rem;color:var(--mut)">Selecciona al menos un mes.</p>'; return; }

    const colHdr    = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrSub = 'background:#1e4080;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    const colHdrTot = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrVar = 'background:#2a4a2a;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    // label + ns*4 (REAL,PTTO,VAR,VAR%) + 4 totales
    const totalCols = 1 + ns*4 + 4;

    const g = (arr,i) => (arr||[])[i]||0;
    const sumSel = arr => sm.reduce((s,i)=>s+g(arr,i),0);

    const ST1 = 'position:sticky;top:0;z-index:2';       // sticky fila 1 header
    const ST2 = 'position:sticky;top:26px;z-index:2';   // sticky fila 2 header
    const SL  = 'position:sticky;left:0;z-index:3';      // sticky columna + header (esquina)
    const SLC = (bg) => `position:sticky;left:0;z-index:1;background:${bg};border-right:1px solid rgba(0,0,0,.08)`;

    const thMes1 = sm.map(i=>`<th colspan="4" style="${ST1};${colHdr}">${meses[i].slice(0,3)}</th>`).join('');
    const thMes2 = sm.map(()=>`<th style="${ST2};${colHdrSub}">REAL</th><th style="${ST2};${colHdrSub}">PTTO</th><th style="${ST2};${colHdrVar}">VAR</th><th style="${ST2};${colHdrVar}">VAR%</th>`).join('');

    // célula helpers — white-space:nowrap en todas para evitar salto de línea
    const NW = 'white-space:nowrap';
    const cx = (v,fw,cl,pre) => `<td class="num" style="${NW};${fw?'font-weight:700;':''}color:${cl}">${pre||'MM$'}${pre?fpct(v):fmm(v)}</td>`;
    const cN  = (v,fw) => cx(v,fw,'#111','');
    const cP  = (v,fw) => cx(v,fw,'var(--mut)','');
    const cVmm= v => cx(v,false,'#555','');
    const cVpct=v => `<td class="num" style="${NW};color:#555">${fpct(v)}</td>`;
    const cNW = (v,fw) => cx(v,fw,'#fff','');
    const cPW = (v,fw) => cx(v,fw,'rgba(255,255,255,.6)','');
    const cVW = v => `<td class="num" style="${NW};color:rgba(255,255,255,.5)">MM$${fmm(v)}</td>`;
    const cVpW= v => `<td class="num" style="${NW};color:rgba(255,255,255,.5)">${fpct(v)}</td>`;

    // 4 celdas por mes para filas MM$
    const cells4mm = (ar,ap,av,avp, style) => sm.map(i=>{
      if(style==='white') return cNW(g(ar,i),false)+cPW(g(ap,i),false)+cVW(g(av,i))+cVpW(g(avp,i));
      if(style==='bold')  return cN(g(ar,i),true)+cP(g(ap,i),true)+cVmm(g(av,i))+cVpct(g(avp,i));
      return cN(g(ar,i),false)+cP(g(ap,i),false)+cVmm(g(av,i))+cVpct(g(avp,i));
    }).join('');

    // 4 celdas por mes para filas %
    const cells4pct = (ar,ap,av,avp) => sm.map(i=>`
      <td class="num" style="color:#111">${fpct(g(ar,i))}</td>
      <td class="num" style="color:var(--mut)">${fpct(g(ap,i))}</td>
      <td class="num" style="color:#555">${fpct(g(av,i))}</td>
      <td class="num" style="color:#888">${fpct(g(avp,i))}</td>`).join('');

    // totales 4 cols para filas MM$
    const tot4mm = (ar,ap, style) => {
      const tR=sumSel(ar), tP=sumSel(ap), tV=tR-tP, tVp=Math.abs(tP)>0?tV/Math.abs(tP):0;
      if(style==='white') return cNW(tR,true)+cPW(tP,true)+cVW(tV)+cVpW(tVp);
      if(style==='bold')  return cN(tR,true)+cP(tP,true)+cVmm(tV)+cVpct(tVp);
      return cN(tR,true)+cP(tP,true)+cVmm(tV)+cVpct(tVp);
    };
    // totales 4 cols para filas % (promedio ponderado)
    const tot4pct = (numR,numP,denR,denP) => {
      const tR=Math.abs(sumSel(denR))||1, tP=Math.abs(sumSel(denP))||1;
      const vR=sumSel(numR)/tR, vP=sumSel(numP)/tP, vV=vR-vP, vVp=Math.abs(vP)>0?vV/Math.abs(vP):0;
      return `<td class="num" style="font-weight:700;color:#111">${fpct(vR)}</td>
              <td class="num" style="font-weight:700;color:var(--mut)">${fpct(vP)}</td>
              <td class="num" style="color:#555">${fpct(vV)}</td>
              <td class="num" style="color:#888">${fpct(vVp)}</td>`;
    };

    const LBL  = (txt,indent,bg) => `<td style="${SLC(bg||'var(--bg,#fff)')};font-size:.62rem;white-space:nowrap;padding:.3rem .6rem .3rem ${indent||'.6rem'}">${txt}</td>`;
    const LBLb = (txt,clr,bg)   => `<td style="${SLC(bg||'var(--bg,#fff)')};font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;font-weight:700;color:${clr||'inherit'}">${txt}</td>`;
    // Fondos opacos para celdas sticky (evitar transparencia al scrollear)
    const BG_CEL = '#def3fa'; // equivalente opaco de rgba(0,160,220,.13) sobre blanco
    const BG_SEP = '#edf0f5'; // equivalente opaco de rgba(0,45,115,.07) sobre blanco

    const sepRow = lbl => `<tr style="background:rgba(0,45,115,.07)">
      <td style="${SLC(BG_SEP)};font-size:.58rem;font-weight:700;color:var(--mut);padding:.22rem .6rem;letter-spacing:.05em">${lbl.toUpperCase()}</td>
      <td colspan="${totalCols-1}" style="background:rgba(0,45,115,.07)"></td>
    </tr>`;

    const rowBase    = (lbl,ar,ap,av,avp) => `<tr>${LBL(lbl,'.6rem')}${cells4mm(ar,ap,av,avp,'')}${tot4mm(ar,ap,'')}</tr>`;
    const rowSub     = (lbl,ar,ap,av,avp) => `<tr>${LBL('↳ '+lbl,'1.4rem')}${cells4mm(ar,ap,av,avp,'')}${tot4mm(ar,ap,'')}</tr>`;
    const rowPct     = (lbl,ar,ap,av,avp,numR,numP,denR,denP) =>
      `<tr>${LBL(lbl,'.6rem')}${cells4pct(ar,ap,av,avp)}${tot4pct(numR||ar,numP||ap,denR||R2.ingresos_totales,denP||R2.ingresos_totales_p)}</tr>`;
    const rowCeleste = (lbl,ar,ap,av,avp) => `<tr style="background:rgba(0,160,220,.13)">${LBLb(lbl,undefined,BG_CEL)}${cells4mm(ar,ap,av,avp,'bold')}${tot4mm(ar,ap,'bold')}</tr>`;
    const rowAzul    = (lbl,ar,ap,av,avp) => `<tr class="eerr-azul" style="background:var(--az3)">${LBLb(lbl,'#fff','var(--az3)')}${cells4mm(ar,ap,av,avp,'white')}${tot4mm(ar,ap,'white')}</tr>`;

    eerrEl.innerHTML = `
      <div style="overflow-x:auto;overflow-y:auto;max-height:68vh">
        <table class="tbl" style="font-size:.62rem;width:100%;min-width:600px;border-collapse:separate;border-spacing:0">
          <thead>
            <tr>
              <th style="${SL};${ST1};${colHdr};text-align:left;min-width:200px" rowspan="2">Concepto</th>
              ${thMes1}
              <th colspan="4" style="${ST1};${colHdrTot}">TOTAL</th>
            </tr>
            <tr>${thMes2}<th style="${ST2};${colHdrSub}">REAL</th><th style="${ST2};${colHdrSub}">PTTO</th><th style="${ST2};${colHdrVar}">VAR</th><th style="${ST2};${colHdrVar}">VAR%</th></tr>
          </thead>
          <tbody>
            ${sepRow('Ingresos')}
            ${rowBase('Ingresos de actividades ordinarias (MM$)',R2.ingresos_totales,R2.ingresos_totales_p,R2.ingresos_totales_v,R2.ingresos_totales_vp)}
            ${rowSub('Ingresos por contratos (MM$)',R2.ingresos_contratos,R2.ingresos_contratos_p,R2.ingresos_contratos_v,R2.ingresos_contratos_vp)}
            ${rowSub('Ingresos por otras actividades (MM$)',R2.ingresos_otras,R2.ingresos_otras_p,R2.ingresos_otras_v,R2.ingresos_otras_vp)}
            ${rowBase('(−) Costo de ventas (MM$)',R2.costo_ventas,R2.costo_ventas_p,R2.costo_ventas_v,R2.costo_ventas_vp)}
            ${rowCeleste('= Margen del Producto (MM$)',R2.margen_mm,R2.margen_mm_p,R2.margen_mm_v,R2.margen_mm_vp)}
            ${rowPct('Margen %',R2.margen_pct,R2.margen_pct_p,R2.margen_pct_v,R2.margen_pct_vp, R2.margen_mm,R2.margen_mm_p,R2.ingresos_totales,R2.ingresos_totales_p)}
            ${sepRow('Gastos Operacionales Directos')}
            ${rowBase('(−) Gasto beneficios empleados Directos (MM$)',R2.gastos_empleados,R2.gastos_empleados_p,R2.gastos_empleados_v,R2.gastos_empleados_vp)}
            ${rowBase('(−) Otros gastos por naturaleza Directos (MM$)',R2.otros_gastos,R2.otros_gastos_p,R2.otros_gastos_v,R2.otros_gastos_vp)}
            ${rowCeleste('= EBITDA Directo (MM$)',R2.ebitda_directo,R2.ebitda_directo_p,R2.ebitda_directo_v,R2.ebitda_directo_vp)}
            ${rowPct('%  EBITDA Directo',R2.ebitda_directo_pct,R2.ebitda_directo_pct_p,R2.ebitda_directo_pct_v,R2.ebitda_directo_pct_vp, R2.ebitda_directo,R2.ebitda_directo_p,R2.ingresos_totales,R2.ingresos_totales_p)}
            ${sepRow('GAV Indirecto')}
            ${rowBase('(−) GAV Indirecto (MM$)',R2.gav_indirecto,R2.gav_indirecto_p,R2.gav_indirecto_v,R2.gav_indirecto_vp)}
            ${rowCeleste('= EBITDA Indirecto (MM$)',R2.ebitda_indirecto,R2.ebitda_indirecto_p,R2.ebitda_indirecto_v,R2.ebitda_indirecto_vp)}
            ${hasGaAd?sepRow('Gastos Adicionales'):''}
            ${hasGaAd?rowBase('Finiquitos (MM$)',R2.finiquitos,R2.finiquitos_p,R2.finiquitos_v,R2.finiquitos_vp):''}
            ${hasGaAd?rowBase('Multas (MM$)',R2.multas,R2.multas_p,R2.multas_v,R2.multas_vp):''}
            ${hasGaAd?rowBase('Prov. Obsolescencias Inventarios (MM$)',R2.prov_obsolescencias,R2.prov_obsolescencias_p,R2.prov_obsolescencias_v,R2.prov_obsolescencias_vp):''}
            ${hasGaAd?rowBase('Prov. Incobrables (MM$)',R2.prov_incobrables,R2.prov_incobrables_p,R2.prov_incobrables_v,R2.prov_incobrables_vp):''}
            ${hasGaAd?rowBase('Prov. Habilitación Oficinas (MM$)',R2.prov_habilitacion,R2.prov_habilitacion_p,R2.prov_habilitacion_v,R2.prov_habilitacion_vp):''}
            ${hasGaAd?rowBase('Total Gastos Adicionales (MM$)',R2.total_gastos_adicionales,R2.total_gastos_adicionales_p,R2.total_gastos_adicionales_v,R2.total_gastos_adicionales_vp):''}
            ${rowAzul('= EBITDA Empresa (MM$)',R2.ebitda_empresa,R2.ebitda_empresa_p,R2.ebitda_empresa_v,R2.ebitda_empresa_vp)}
            ${rowPct('%  EBITDA Empresa',R2.ebitda_directo_pct,R2.ebitda_directo_pct_p,R2.ebitda_directo_pct_v,R2.ebitda_directo_pct_vp, R2.ebitda_empresa,R2.ebitda_empresa_p,R2.ingresos_totales,R2.ingresos_totales_p)}
            ${sepRow('Resultado Operacional')}
            ${rowBase('(−) Depreciación y amortización (MM$)',R2.depreciacion,R2.depreciacion_p,R2.depreciacion_v,R2.depreciacion_vp)}
            ${rowCeleste('= Resultado Operacional (MM$)',R2.resultado_operacional,R2.resultado_operacional_p,R2.resultado_operacional_v,R2.resultado_operacional_vp)}
            ${sepRow('Resultado No Operacional')}
            ${rowBase('Otros ingresos por función (MM$)',R2.otros_ingresos_funcion,R2.otros_ingresos_funcion_p,R2.otros_ingresos_funcion_v,R2.otros_ingresos_funcion_vp)}
            ${rowBase('Ingreso financiero (MM$)',R2.ingreso_financiero,R2.ingreso_financiero_p,R2.ingreso_financiero_v,R2.ingreso_financiero_vp)}
            ${rowBase('Costo financiero (MM$)',R2.costo_financiero,R2.costo_financiero_p,R2.costo_financiero_v,R2.costo_financiero_vp)}
            ${rowBase('Otros gastos por función (MM$)',R2.otros_gastos_funcion,R2.otros_gastos_funcion_p,R2.otros_gastos_funcion_v,R2.otros_gastos_funcion_vp)}
            ${rowBase('Diferencia de cambio (MM$)',R2.diferencia_cambio,R2.diferencia_cambio_p,R2.diferencia_cambio_v,R2.diferencia_cambio_vp)}
            ${rowCeleste('= Resultado no operacional (MM$)',R2.resultado_no_operacional,R2.resultado_no_operacional_p,R2.resultado_no_operacional_v,R2.resultado_no_operacional_vp)}
            ${sepRow('Resultado Final')}
            ${rowCeleste('= Resultado antes de impuestos (MM$)',R2.resultado_antes_imp,R2.resultado_antes_imp_p,R2.resultado_antes_imp_v,R2.resultado_antes_imp_vp)}
            ${rowBase('(−) Impuesto a la renta (MM$)',R2.impuesto_renta,R2.impuesto_renta_p,R2.impuesto_renta_v,R2.impuesto_renta_vp)}
            ${rowAzul('= Resultado del ejercicio Empresa (MM$)',R2.resultado_ejercicio,R2.resultado_ejercicio_p,R2.resultado_ejercicio_v,R2.resultado_ejercicio_vp)}
            ${rowPct('%  Resultado / Ingresos',R2.resultado_ejercicio,R2.resultado_ejercicio_p,R2.resultado_ejercicio_v,R2.resultado_ejercicio_vp, R2.resultado_ejercicio,R2.resultado_ejercicio_p,R2.ingresos_totales,R2.ingresos_totales_p)}
          </tbody>
        </table>
      </div>`;
  }

  // Segmentador de meses
  if(segEl){
    meses.forEach((m,i)=>{
      const b = document.createElement('button');
      b.className = 'btn on';
      b.textContent = m.slice(0,3);
      b.style.cssText = 'font-size:.55rem;padding:.15rem .45rem';
      b.addEventListener('click',()=>{
        b.classList.toggle('on');
        if(_selMonths.includes(i)) _selMonths = _selMonths.filter(x=>x!==i);
        else _selMonths = [..._selMonths,i].sort((a,b)=>a-b);
        renderEERR();
      });
      segEl.appendChild(b);
    });
  }
  renderEERR();

  // ── RATIO ANALYSIS ────────────────────────────────────────────
  const absArr = arr => (arr||[]).slice(0,n).map(v=>Math.abs(v||0));

  // Real
  const cdvArr      = absArr(R2.costo_ventas);
  const empArr      = absArr(R2.gastos_empleados);
  const otrArr      = absArr(R2.otros_gastos);
  const gavArr      = absArr(R2.gav_indirecto);
  const gavTotArr   = Array.from({length:n},(_,i)=>empArr[i]+otrArr[i]+gavArr[i]);
  const costoTotArr = Array.from({length:n},(_,i)=>cdvArr[i]+empArr[i]+otrArr[i]+gavArr[i]);
  const ingTotArr   = absArr(R2.ingresos_totales);
  const ingConArr   = absArr(R2.ingresos_contratos);
  const ingOtrArr   = absArr(R2.ingresos_otras);

  // Presupuesto
  const cdvArrP      = absArr(R2.costo_ventas_p);
  const empArrP      = absArr(R2.gastos_empleados_p);
  const otrArrP      = absArr(R2.otros_gastos_p);
  const gavArrP      = absArr(R2.gav_indirecto_p);
  const gavTotArrP   = Array.from({length:n},(_,i)=>empArrP[i]+otrArrP[i]+gavArrP[i]);
  const costoTotArrP = Array.from({length:n},(_,i)=>cdvArrP[i]+empArrP[i]+otrArrP[i]+gavArrP[i]);
  const ingTotArrP   = absArr(R2.ingresos_totales_p);
  const ingConArrP   = absArr(R2.ingresos_contratos_p);
  const ingOtrArrP   = absArr(R2.ingresos_otras_p);

  const COSTO_OPTS = [
    {key:'costo_total', label:'Costo Total',                   arr:costoTotArr, arrP:costoTotArrP, color:'#8B0000'},
    {key:'costo_venta', label:'Costo de Venta',                arr:cdvArr,      arrP:cdvArrP,      color:'#C00000'},
    {key:'empleados',   label:'Gasto x Beneficios Empleados',  arr:empArr,      arrP:empArrP,      color:'#7A1FAA'},
    {key:'otros',       label:'Otros Gastos por Naturaleza',   arr:otrArr,      arrP:otrArrP,      color:'#E87722'},
    {key:'gav_ind',     label:'GAV Indirecto',                 arr:gavArr,      arrP:gavArrP,      color:'#C05000'},
    {key:'gav_tot',     label:'GAV Totales',                   arr:gavTotArr,   arrP:gavTotArrP,   color:'#6B3A2A'},
  ];

  const ING_OPTS = [
    {key:'totales',   label:'Ingresos Totales',         arr:ingTotArr, arrP:ingTotArrP, color:'#002D73'},
    {key:'contratos', label:'Ingresos Contratos',       arr:ingConArr, arrP:ingConArrP, color:'#0A5C8C'},
    {key:'otras',     label:'Ing. Otras Facturaciones', arr:ingOtrArr, arrP:ingOtrArrP, color:'#D46000'},
  ];

  let _costoKey = 'costo_total';
  let _ingKey   = 'totales';
  let _chart    = null;

  function getCostoOpt(){ return COSTO_OPTS.find(o=>o.key===_costoKey)||COSTO_OPTS[0]; }
  function getIngOpt(){   return ING_OPTS.find(o=>o.key===_ingKey)||ING_OPTS[0]; }

  function makeSeg(el, opts, setKey, refresh){
    if(!el) return;
    opts.forEach((opt,idx)=>{
      const b = document.createElement('button');
      b.className = 'btn'+(idx===0?' on':'');
      b.textContent = opt.label;
      b.style.cssText = 'font-size:.58rem;padding:.18rem .5rem';
      b.addEventListener('click',()=>{
        el.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        setKey(opt.key);
        refresh();
      });
      el.appendChild(b);
    });
  }

  makeSeg(document.getElementById('eerr-ing-seg'),   ING_OPTS,   k=>{_ingKey=k;},   ()=>{ _renderRatioTable(); _renderChart(); });
  makeSeg(document.getElementById('eerr-costo-seg'), COSTO_OPTS, k=>{_costoKey=k;}, ()=>{ _renderRatioTable(); _renderChart(); });

  function computeRatio(costoArr, ingArr){
    return Array.from({length:n},(_,i)=>ingArr[i]>0 ? +(costoArr[i]/ingArr[i]).toFixed(4) : null);
  }

  function computeRatioTotal(costoArr, ingArr){
    const sN = costoArr.reduce((s,v)=>s+v,0);
    const sD = ingArr.reduce((s,v)=>s+v,0);
    return sD>0 ? sN/sD : 0;
  }

  function _renderRatioTable(){
    const el = document.getElementById('eerr-ratio-table');
    if(!el) return;
    const colHdr    = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrSub = 'background:#1e4080;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    const ingOpt   = getIngOpt();
    const colHdrV  = 'background:#2a4a2a;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    const colHdrTt = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const thMeses1 = meses.map(m=>`<th colspan="3" style="${colHdr}">${m.slice(0,3)}</th>`).join('');
    const thMeses2 = meses.map(()=>`<th style="${colHdrSub}">REAL</th><th style="${colHdrSub}">PTTO</th><th style="${colHdrV}">VAR</th>`).join('');
    const fpR = v => `${((v||0)*100).toFixed(1).replace('.',',')}%`;

    const rows = COSTO_OPTS.map(cOpt=>{
      const ratiosR = computeRatio(cOpt.arr,  ingOpt.arr);
      const ratiosP = computeRatio(cOpt.arrP, ingOpt.arrP);
      const totR    = computeRatioTotal(cOpt.arr,  ingOpt.arr);
      const totP    = computeRatioTotal(cOpt.arrP, ingOpt.arrP);
      const totV    = totR - totP;
      const active  = cOpt.key === _costoKey;
      const bg      = active ? 'background:rgba(255,140,0,.07)' : '';
      const fw      = active ? 'font-weight:700' : 'font-weight:400';
      const clrR    = active ? 'color:var(--or);font-weight:700' : 'color:#111';
      const tds = Array.from({length:n},(_,i)=>`
        <td class="num" style="${clrR}">${fpR(ratiosR[i])}</td>
        <td class="num" style="color:var(--mut)">${fpR(ratiosP[i])}</td>
        <td class="num" style="color:#777">${fpR((ratiosR[i]||0)-(ratiosP[i]||0))}</td>`).join('');
      return `<tr style="${bg}">
        <td style="font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;${fw}">${cOpt.label}<span style="color:var(--mut);font-weight:400"> / ${ingOpt.label}</span></td>
        ${tds}
        <td class="num" style="font-weight:700${active?';color:var(--or)':''}">${fpR(totR)}</td>
        <td class="num" style="font-weight:700;color:var(--mut)">${fpR(totP)}</td>
        <td class="num" style="font-weight:700;color:#777">${fpR(totV)}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="tbl" style="font-size:.63rem;width:100%;min-width:500px">
          <thead>
            <tr>
              <th style="${colHdr};text-align:left;min-width:220px" rowspan="2">Indicador</th>
              ${thMeses1}
              <th colspan="3" style="${colHdrTt}">TOTAL</th>
            </tr>
            <tr>${thMeses2}<th style="${colHdrSub}">REAL</th><th style="${colHdrSub}">PTTO</th><th style="${colHdrV}">VAR</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function _renderChart(){
    const ctx = document.getElementById('cEerr');
    if(!ctx) return;
    if(_chart){ _chart.destroy(); _chart=null; }
    const cOpt    = getCostoOpt();
    const iOpt    = getIngOpt();
    const ratiosR = computeRatio(cOpt.arr,  iOpt.arr);
    const ratiosP = computeRatio(cOpt.arrP, iOpt.arrP);

    _chart = new Chart(ctx.getContext('2d'),{
      type:'bar',
      data:{
        labels: meses,
        datasets:[
          {label:iOpt.label,       data:iOpt.arr,  backgroundColor:iOpt.color+'BB', borderColor:iOpt.color, borderWidth:2, borderRadius:4, yAxisID:'y', order:3},
          {label:cOpt.label,       data:cOpt.arr,  backgroundColor:cOpt.color+'BB', borderColor:cOpt.color, borderWidth:2, borderRadius:4, yAxisID:'y', order:4},
          {label:'Ratio Real',     data:ratiosR, type:'line', borderColor:'#FFC000', backgroundColor:'transparent', borderWidth:2.5, tension:0.4, pointRadius:5, pointBackgroundColor:'#FFC000', fill:false, yAxisID:'yRatio', order:1},
          {label:'Ratio PTTO',     data:ratiosP, type:'line', borderColor:'#FFC000', backgroundColor:'transparent', borderWidth:1.5, tension:0.4, pointRadius:4, pointBackgroundColor:'#fff', pointBorderColor:'#FFC000', fill:false, yAxisID:'yRatio', order:2, borderDash:[5,4]}
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{position:'bottom',labels:{boxWidth:12,font:{size:9},padding:10}},
          tooltip:{
            callbacks:{
              label:c=>{
                if(c.dataset.yAxisID==='yRatio') return ` ${c.dataset.label}: ${((c.raw||0)*100).toFixed(1).replace('.',',')}%`;
                return ` ${c.dataset.label}: MM$${fN1(c.raw||0)}`;
              }
            }
          }
        },
        scales:{
          x:{grid:{display:false},ticks:{font:{size:9}}},
          y:{beginAtZero:true,grid:{color:'#E2E6F0'},
             ticks:{font:{size:9},callback:v=>'MM$'+(v||0).toLocaleString('es-CL',{maximumFractionDigits:0})},
             title:{display:true,text:'MM$',font:{size:8},color:'var(--mut)'}},
          yRatio:{position:'right',beginAtZero:true,grid:{display:false},
                  ticks:{font:{size:9},callback:v=>((v||0)*100).toFixed(1).replace('.',',')+'%'},
                  title:{display:true,text:'% Costo / Ingreso',font:{size:8},color:'#B8860B'}}
        }
      }
    });
  }

  _renderRatioTable();
  _renderChart();
})();

async function eerrExportPDF() {
  const eerrTbl  = document.getElementById('eerr-table');
  const ratioTbl = document.getElementById('eerr-ratio-table');
  if (!eerrTbl && !ratioTbl) return;

  const btn = document.getElementById('eerr-pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  const mesLbl = (document.getElementById('eerr-mes-lbl') || {}).textContent || '';
  const ANO = (window.APP_DATA || {}).ano_actual || new Date().getFullYear();

  function cleanClone(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('*').forEach(n => {
      n.style.position  = 'static';
      n.style.maxHeight = 'none';
      n.style.overflow  = 'visible';
      n.style.maxWidth  = 'none';
    });
    c.querySelectorAll('td,th').forEach(n => {
      n.style.fontSize   = '9px';
      n.style.padding    = '3px 5px';
      n.style.lineHeight = '1.3';
      n.style.whiteSpace = 'nowrap';
    });
    c.querySelectorAll('table').forEach(t => {
      t.style.borderCollapse = 'collapse';
      t.style.tableLayout    = 'auto';
      t.style.width          = 'auto';
    });
    return c;
  }

  // Build off-screen container at 99999px wide so nothing wraps
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff;' +
    'padding:14px 20px 20px;font-family:Arial,sans-serif;color:#111;' +
    'width:99999px;box-sizing:border-box';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:10px;border-bottom:2.5px solid #002D73;padding-bottom:6px;display:flex;align-items:baseline;gap:16px';
  hdr.innerHTML = `<span style="font-size:12px;font-weight:700;color:#002D73">TECSERVICE — Estado de Resultado y Análisis de Ratios</span>` +
    `<span style="font-size:10px;color:#555">Período: ${mesLbl} &nbsp;·&nbsp; Cifras en MM$</span>`;
  wrap.appendChild(hdr);

  function makeSection(label, srcEl) {
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-bottom:14px';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;font-weight:700;color:#002D73;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px';
    lbl.textContent = label;
    sec.appendChild(lbl);
    sec.appendChild(cleanClone(srcEl));
    return sec;
  }

  if (eerrTbl)  wrap.appendChild(makeSection('Estado de Resultado', eerrTbl));
  if (ratioTbl) wrap.appendChild(makeSection('Análisis de Ratios',  ratioTbl));

  document.body.appendChild(wrap);
  try {
    // Shrink container to actual content size before capture
    const realW = wrap.scrollWidth;
    const realH = wrap.scrollHeight;
    wrap.style.width = realW + 'px';

    const SCALE = 2;
    const canvas = await html2canvas(wrap, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width:  realW,
      height: realH,
      windowWidth:  realW,
      windowHeight: realH,
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;

    // Create a PDF whose page dimensions match the content exactly at 96 DPI
    // → content always fills the full page, never scaled down
    const MM_PER_PX = 25.4 / 96;
    const pageW_mm  = realW  * MM_PER_PX;
    const pageH_mm  = realH  * MM_PER_PX;

    const pdf = new jsPDF({
      orientation: pageW_mm > pageH_mm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageW_mm, pageH_mm],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, pageW_mm, pageH_mm);
    pdf.save(`EERR_TS_${mesLbl.replace(/[\s/]+/g, '_')}_${ANO}.pdf`);
  } finally {
    document.body.removeChild(wrap);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF';
    }
  }
}
