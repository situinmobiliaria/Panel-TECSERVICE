// ═══════════════════════════════════════════════════════════════
// hoja_eerr.js — EERR S&S y Análisis de Ratios
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════
(function(){
  const R2 = (APP_DATA && APP_DATA.ratios2) || {};

  // «Otros gastos por naturaleza» quedó en cero en la hoja Ratio Costos 2,
  // así que su fila y su opción de ratio se ocultan. Se evalúa el dato en vez
  // de borrar el código: si el Excel vuelve a poblar la línea, reaparece sola.
  const _eerrHay = arr =>
    Array.isArray(arr) && arr.some(v => Math.abs(v || 0) > 0.0005);
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
      #eerr-table tr.eerr-azul:hover,
      #eerr-limpio-table tr.eerr-azul:hover { background: var(--az3) !important; }
      #eerr-table tr.eerr-azul:hover td,
      #eerr-limpio-table tr.eerr-azul:hover td { background-color: transparent; }
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

  // ── AJUSTES DEL EERR LIMPIO ───────────────────────────────────
  // El EERR limpio saca el Arriendo Piso 1 de la depreciación: es un gasto de
  // la oficina, no del giro del servicio técnico. Como esa línea desaparece,
  // hay que rehacer todo lo que venía después: la depreciación pasa a ser
  // sólo S&S más el Arriendo Bodega 50%, y el resultado operacional, el
  // resultado antes de impuestos y el resultado del ejercicio mejoran en
  // exactamente lo que se sacó. El EBITDA no se toca: va antes de depreciación.
  // El presupuesto se deja como viene, porque la apertura no lo distingue.
  const _sum = (...as) => Array.from({length:n},(_,i)=>
    as.reduce((t,a)=>t+((a||[])[i]||0),0));

  // Costo de las garantías ya consumido en el año. Sale de la misma tabla de
  // la hoja Visión General —«Contratos de Garantía · Costo Estimado»—: costo
  // estimado total menos costo estimado remanente. Entran los contratos que
  // estuvieron vigentes en algún momento del año, no sólo los de hoy: una
  // garantía que terminó en agosto igual consumió costo entre enero y agosto,
  // y ese costo está dentro del costo de ventas del período. El costo estimado
  // de cada contrato es anual —su valor por el complemento del margen de su
  // plan CARE—, así que lo consumido no arrastra años anteriores; los que no
  // tienen plan asignado usan 50%, el mismo supuesto de esa hoja.
  const _GAR_MG = {BASIC:0.55, ADVANCED:0.60, PROFESIONAL:0.65, INTEGRAL:0.65};
  function _garCostoFecha(){
    const hoy = (APP_DATA && APP_DATA.hoy) || '';
    const eneroAno = String(ANO_ACTUAL) + '-01-01';
    const lista = (typeof DATA !== 'undefined' ? DATA : []).filter(d =>
      d.tipo === 'Garantia' && (d.inicio || '') <= hoy && (d.fin || '') >= eneroAno);
    let total = 0, rem = 0;
    lista.forEach(d => {
      const t = String(d.programa || '').toUpperCase();
      const k = Object.keys(_GAR_MG).find(x => t.indexOf(x) >= 0);
      const costoT = (d.val || 0) * (1 - (k ? _GAR_MG[k] : 0.50));
      const pct = Math.max(0, Math.min(100, d.pct_consumido || 0));
      total += costoT;
      rem   += costoT * (1 - pct/100);
    });
    return {n: lista.length, total: total/1e6, rem: rem/1e6, fecha: (total-rem)/1e6};
  }
  const GAR = _garCostoFecha();
  // Se reparte lineal entre los meses cargados y se descuenta del costo de
  // ventas, que viene negativo: por eso se suma.
  const _garMes = n ? GAR.fecha / n : 0;
  // El resumen A4 vive fuera de este bloque y necesita el mismo ajuste.
  window._eerrGarMes = _garMes;
  window._eerrGar = GAR;
  const _mas = (a,b) => Array.from({length:n},(_,i)=>((a||[])[i]||0)-((b||[])[i]||0));
  const _piso = R2.dep_arr_piso || [];
  const _conGar = a => Array.from({length:n},(_,i)=>((a||[])[i]||0) + _garMes);
  // Tasa de impuesto a la renta con la que se recalcula el EERR limpio: al
  // cambiar el resultado antes de impuestos, el impuesto contabilizado ya no
  // corresponde. Se aplica sobre el resultado del mes, así que un mes con
  // pérdida genera crédito, igual que en la hoja.
  const EERR_TASA_IMP = 0.27;
  const LIMPIO = {
    // El costo de ventas baja en el costo de garantías del mes; todo lo que
    // viene después sube en lo mismo, porque es un costo menos.
    costo_ventas:        _conGar(R2.costo_ventas),
    margen_mm:           _conGar(R2.margen_mm),
    ebitda_directo:      _conGar(R2.ebitda_directo),
    ebitda_indirecto:    _conGar(R2.ebitda_indirecto),
    ebitda_empresa:      _conGar(R2.ebitda_empresa),
    // La depreciación queda sólo con S&S: el arriendo de bodega pasa a su
    // propia línea, entre el EBITDAR y el EBITDA.
    depreciacion:        Array.from({length:n},(_,i)=>((R2.dep_ss||[])[i]||0)),
    resultado_operacional: _conGar(_mas(R2.resultado_operacional, _piso)),
    resultado_antes_imp:   _conGar(_mas(R2.resultado_antes_imp, _piso)),
  };
  // EBITDAR: resultado antes de intereses, impuestos, depreciación,
  // amortización y arriendo. En esta hoja el arriendo no está dentro del
  // EBITDA —viene más abajo, junto a la depreciación—, así que el EBITDAR es
  // el mismo EBITDA Empresa, y al restarle el arriendo de bodega se llega al
  // EBITDA ya con el costo de ocupar la bodega adentro.
  LIMPIO.ebitdar      = LIMPIO.ebitda_empresa.slice();
  LIMPIO.ebitda_arr   = Array.from({length:n},(_,i)=>
    LIMPIO.ebitdar[i] + ((R2.dep_arr_bodega||[])[i]||0));
  LIMPIO.impuesto_renta     = LIMPIO.resultado_antes_imp.map(v => -v * EERR_TASA_IMP);
  LIMPIO.resultado_ejercicio = LIMPIO.resultado_antes_imp.map(v => v * (1 - EERR_TASA_IMP));

  // ── EERR TABLE ────────────────────────────────────────────────
  const eerrEl  = document.getElementById('eerr-table');
  const segEl   = document.getElementById('eerr-mes-seg');
  let _selMonths = Array.from({length:n},(_,i)=>i); // todos seleccionados por defecto

  const hasGaAd = [R2.finiquitos,R2.multas,R2.prov_obsolescencias,R2.prov_incobrables,R2.prov_habilitacion]
    .some(a=>(a||[]).some(v=>v!==0));

  // La misma tabla se pinta dos veces: arriba el EERR de la hoja Ratio Costos
  // 2 tal cual, y más abajo el «EERR Limpio», que se irá ajustando. Por eso
  // recibe el contenedor y los meses elegidos en vez de usar los de arriba.
  function renderEERR(destino, sm, limpio){
    const el = destino || eerrEl;
    if(!el) return;
    sm = sm || _selMonths;
    const ns = sm.length;
    if(ns===0){ el.innerHTML='<p style="padding:1rem;color:var(--mut)">Selecciona al menos un mes.</p>'; return; }

    const colHdr    = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrSub = 'background:#1e4080;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    const colHdrTot = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrVar = 'background:#2a4a2a;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    // label + ns*4 (REAL,PTTO,VAR,VAR%) + 4 totales
    const totalCols = 1 + ns*4 + 4;

    // En la versión limpia, estas líneas vienen recalculadas; el resto sale
    // tal cual de la hoja Ratio Costos 2.
    const V = k => (limpio && LIMPIO[k]) ? LIMPIO[k] : R2[k];
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

    // 4 celdas por mes para filas MM$. La variación se calcula acá como
    // real − ptto, igual que en el total y en el PDF: la hoja la trae como
    // |real|−|ptto|, con el signo invertido en las líneas de costo, y en el
    // último mes viene en blanco.
    const cells4mm = (ar,ap,av,avp, style) => sm.map(i=>{
      const r=g(ar,i), p=g(ap,i), v=r-p, vp=Math.abs(p)>0?v/Math.abs(p):0;
      if(style==='white') return cNW(r,false)+cPW(p,false)+cVW(v)+cVpW(vp);
      if(style==='bold')  return cN(r,true)+cP(p,true)+cVmm(v)+cVpct(vp);
      return cN(r,false)+cP(p,false)+cVmm(v)+cVpct(vp);
    }).join('');

    // 4 celdas por mes para filas %: numerador / ingresos del mes, con la
    // misma fórmula que la columna total. No se usan los % de la hoja porque
    // vienen en blanco en el último mes.
    const cells4pct = (numR,numP,denR,denP) => sm.map(i=>{
      const dR=Math.abs(g(denR,i)), dP=Math.abs(g(denP,i));
      const r=dR?g(numR,i)/dR:0, p=dP?g(numP,i)/dP:0, v=r-p, vp=Math.abs(p)>0?v/Math.abs(p):0;
      return `
      <td class="num" style="color:#111">${fpct(r)}</td>
      <td class="num" style="color:var(--mut)">${fpct(p)}</td>
      <td class="num" style="color:#555">${fpct(v)}</td>
      <td class="num" style="color:#888">${fpct(vp)}</td>`;
    }).join('');

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
    // Apertura del Costo de ventas (técnicos/personal vs. repuestos y otros):
    // el Excel sólo trae Real para esta apertura, sin presupuesto, así que
    // las columnas PTTO/VAR/VAR% quedan en "—" en vez de mostrar un dato falso.
    const dashCell = '<td class="num" style="color:var(--mut)">—</td>';
    const rowSubReal = (lbl, ar) => `<tr>${LBL('↳ '+lbl,'1.4rem')}${
      sm.map(i => cN(g(ar,i),false) + dashCell + dashCell + dashCell).join('')
    }${cN(sumSel(ar),true) + dashCell + dashCell + dashCell}</tr>`;
    const rowPct     = (lbl,ar,ap,av,avp,numR,numP,denR,denP) => {
      const nR=numR||ar, nP=numP||ap, dR=denR||R2.ingresos_totales, dP=denP||R2.ingresos_totales_p;
      return `<tr>${LBL(lbl,'.6rem')}${cells4pct(nR,nP,dR,dP)}${tot4pct(nR,nP,dR,dP)}</tr>`;
    };
    const rowCeleste = (lbl,ar,ap,av,avp) => `<tr style="background:rgba(0,160,220,.13)">${LBLb(lbl,undefined,BG_CEL)}${cells4mm(ar,ap,av,avp,'bold')}${tot4mm(ar,ap,'bold')}</tr>`;
    const rowAzul    = (lbl,ar,ap,av,avp) => `<tr class="eerr-azul" style="background:var(--az3)">${LBLb(lbl,'#fff','var(--az3)')}${cells4mm(ar,ap,av,avp,'white')}${tot4mm(ar,ap,'white')}</tr>`;

    el.innerHTML = `
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
            ${rowBase('(−) Costo de ventas (MM$)',V('costo_ventas'),R2.costo_ventas_p,R2.costo_ventas_v,R2.costo_ventas_vp)}
            ${(!limpio && R2.costo_tecnicos)?rowSubReal('Costo Técnicos y Personal (MM$, sólo Real)',R2.costo_tecnicos):''}
            ${(!limpio && R2.costo_repuestos)?rowSubReal('Costo Repuestos y Otros (MM$, sólo Real)',R2.costo_repuestos):''}
            ${rowCeleste('= Margen del Producto (MM$)',V('margen_mm'),R2.margen_mm_p,R2.margen_mm_v,R2.margen_mm_vp)}
            ${rowPct('Margen %',R2.margen_pct,R2.margen_pct_p,R2.margen_pct_v,R2.margen_pct_vp, V('margen_mm'),R2.margen_mm_p,R2.ingresos_totales,R2.ingresos_totales_p)}
            ${sepRow('Gastos Operacionales Directos')}
            ${rowBase('(−) Gasto beneficios empleados Directos (MM$)',R2.gastos_empleados,R2.gastos_empleados_p,R2.gastos_empleados_v,R2.gastos_empleados_vp)}
            ${_eerrHay(R2.otros_gastos)||_eerrHay(R2.otros_gastos_p)?rowBase('(−) Otros gastos por naturaleza Directos (MM$)',R2.otros_gastos,R2.otros_gastos_p,R2.otros_gastos_v,R2.otros_gastos_vp):''}
            ${rowCeleste('= EBITDA Directo (MM$)',V('ebitda_directo'),R2.ebitda_directo_p,R2.ebitda_directo_v,R2.ebitda_directo_vp)}
            ${rowPct('%  EBITDA Directo',R2.ebitda_directo_pct,R2.ebitda_directo_pct_p,R2.ebitda_directo_pct_v,R2.ebitda_directo_pct_vp, V('ebitda_directo'),R2.ebitda_directo_p,R2.ingresos_totales,R2.ingresos_totales_p)}
            ${sepRow('GAV Indirecto')}
            ${rowBase('(−) GAV Indirecto (MM$)',R2.gav_indirecto,R2.gav_indirecto_p,R2.gav_indirecto_v,R2.gav_indirecto_vp)}
            ${rowCeleste('= EBITDA Indirecto (MM$)',V('ebitda_indirecto'),R2.ebitda_indirecto_p,R2.ebitda_indirecto_v,R2.ebitda_indirecto_vp)}
            ${hasGaAd?sepRow('Gastos Adicionales'):''}
            ${hasGaAd?rowBase('Finiquitos (MM$)',R2.finiquitos,R2.finiquitos_p,R2.finiquitos_v,R2.finiquitos_vp):''}
            ${hasGaAd?rowBase('Multas (MM$)',R2.multas,R2.multas_p,R2.multas_v,R2.multas_vp):''}
            ${hasGaAd?rowBase('Prov. Obsolescencias Inventarios (MM$)',R2.prov_obsolescencias,R2.prov_obsolescencias_p,R2.prov_obsolescencias_v,R2.prov_obsolescencias_vp):''}
            ${hasGaAd?rowBase('Prov. Incobrables (MM$)',R2.prov_incobrables,R2.prov_incobrables_p,R2.prov_incobrables_v,R2.prov_incobrables_vp):''}
            ${hasGaAd?rowBase('Prov. Habilitación Oficinas (MM$)',R2.prov_habilitacion,R2.prov_habilitacion_p,R2.prov_habilitacion_v,R2.prov_habilitacion_vp):''}
            ${hasGaAd?rowBase('Total Gastos Adicionales (MM$)',R2.total_gastos_adicionales,R2.total_gastos_adicionales_p,R2.total_gastos_adicionales_v,R2.total_gastos_adicionales_vp):''}
            ${rowAzul('= EBITDAR Empresa · antes de arriendo (MM$)'.replace('EBITDAR Empresa · antes de arriendo', limpio?'EBITDAR Empresa · antes de arriendo':'EBITDA Empresa'),V('ebitda_empresa'),R2.ebitda_empresa_p,R2.ebitda_empresa_v,R2.ebitda_empresa_vp)}
            ${rowPct(limpio?'%  EBITDAR Empresa':'%  EBITDA Empresa',R2.ebitda_directo_pct,R2.ebitda_directo_pct_p,R2.ebitda_directo_pct_v,R2.ebitda_directo_pct_vp, V('ebitda_empresa'),R2.ebitda_empresa_p,R2.ingresos_totales,R2.ingresos_totales_p)}
            ${limpio?sepRow('Arriendo'):''}
            ${limpio?rowSubReal('(−) Arriendo Bodega 50% (MM$, sólo Real)',R2.dep_arr_bodega):''}
            ${limpio?rowCeleste('= EBITDA Empresa · con arriendo (MM$)',LIMPIO.ebitda_arr,R2.ebitda_empresa_p,R2.ebitda_empresa_v,R2.ebitda_empresa_vp):''}
            ${limpio?rowPct('%  EBITDA Empresa',R2.ebitda_directo_pct,R2.ebitda_directo_pct_p,R2.ebitda_directo_pct_v,R2.ebitda_directo_pct_vp, LIMPIO.ebitda_arr,R2.ebitda_empresa_p,R2.ingresos_totales,R2.ingresos_totales_p):''}
            ${sepRow('Resultado Operacional')}
            ${rowBase('(−) Depreciación y amortización'+(limpio?' S&S':'')+' (MM$)',V('depreciacion'),R2.depreciacion_p,R2.depreciacion_v,R2.depreciacion_vp)}
            ${(!limpio && _eerrHay(R2.dep_ss))?rowSubReal('Depreciación y amortización S&S (MM$, sólo Real)',R2.dep_ss):''}
            ${(!limpio && _eerrHay(R2.dep_arr_piso))?rowSubReal('Arriendo Piso 1 (MM$, sólo Real)',R2.dep_arr_piso):''}
            ${(!limpio && _eerrHay(R2.dep_arr_bodega))?rowSubReal('Arriendo Bodega 50% (MM$, sólo Real)',R2.dep_arr_bodega):''}
            ${rowCeleste('= Resultado Operacional (MM$)',V('resultado_operacional'),R2.resultado_operacional_p,R2.resultado_operacional_v,R2.resultado_operacional_vp)}
            ${sepRow('Resultado No Operacional')}
            ${rowBase('Otros ingresos por función (MM$)',R2.otros_ingresos_funcion,R2.otros_ingresos_funcion_p,R2.otros_ingresos_funcion_v,R2.otros_ingresos_funcion_vp)}
            ${rowBase('Ingreso financiero (MM$)',R2.ingreso_financiero,R2.ingreso_financiero_p,R2.ingreso_financiero_v,R2.ingreso_financiero_vp)}
            ${rowBase('Costo financiero (MM$)',R2.costo_financiero,R2.costo_financiero_p,R2.costo_financiero_v,R2.costo_financiero_vp)}
            ${rowBase('Otros gastos por función (MM$)',R2.otros_gastos_funcion,R2.otros_gastos_funcion_p,R2.otros_gastos_funcion_v,R2.otros_gastos_funcion_vp)}
            ${rowBase('Diferencia de cambio (MM$)',R2.diferencia_cambio,R2.diferencia_cambio_p,R2.diferencia_cambio_v,R2.diferencia_cambio_vp)}
            ${rowCeleste('= Resultado no operacional (MM$)',R2.resultado_no_operacional,R2.resultado_no_operacional_p,R2.resultado_no_operacional_v,R2.resultado_no_operacional_vp)}
            ${sepRow('Resultado Final')}
            ${rowCeleste('= Resultado antes de impuestos (MM$)',V('resultado_antes_imp'),R2.resultado_antes_imp_p,R2.resultado_antes_imp_v,R2.resultado_antes_imp_vp)}
            ${rowBase('(−) Impuesto a la renta (MM$)'+(limpio?' · 27%':''),V('impuesto_renta'),R2.impuesto_renta_p,R2.impuesto_renta_v,R2.impuesto_renta_vp)}
            ${rowAzul('= Resultado del ejercicio Empresa (MM$)',V('resultado_ejercicio'),R2.resultado_ejercicio_p,R2.resultado_ejercicio_v,R2.resultado_ejercicio_vp)}
            ${rowPct('%  Resultado / Ingresos',V('resultado_ejercicio'),R2.resultado_ejercicio_p,R2.resultado_ejercicio_v,R2.resultado_ejercicio_vp, V('resultado_ejercicio'),R2.resultado_ejercicio_p,R2.ingresos_totales,R2.ingresos_totales_p)}
          </tbody>
        </table>
      </div>`;
  }

  // Segmentador de meses. Cada tabla lleva el suyo: se pueden comparar meses
  // distintos en el EERR de arriba y en el limpio.
  function montarSeg(cont, sel, destino, limpio){
    if(!cont) return;
    meses.forEach((m,i)=>{
      const b = document.createElement('button');
      b.className = 'btn on';
      b.textContent = m.slice(0,3);
      b.style.cssText = 'font-size:.55rem;padding:.15rem .45rem';
      b.addEventListener('click',()=>{
        b.classList.toggle('on');
        const k = sel.v.indexOf(i);
        if(k >= 0) sel.v.splice(k,1); else sel.v = [...sel.v,i].sort((a,b)=>a-b);
        renderEERR(destino, sel.v, limpio);
      });
      cont.appendChild(b);
    });
  }

  const selArriba = { v: _selMonths };
  montarSeg(segEl, selArriba, eerrEl);
  renderEERR(eerrEl, selArriba.v);

  // ── EERR LIMPIO ───────────────────────────────────────────────
  // Por ahora es el mismo estado de resultado; queda como base para los
  // ajustes que se le harán después (normalizaciones, gastos por única vez).
  // Nota del EERR Limpio: deja a la vista de dónde sale el descuento, ya que
  // la línea de costo de ventas se muestra neta. Se arma una sola vez y la
  // reutilizan los dos exportables, para que el PDF explique lo mismo que la
  // pantalla y no haya que mantener dos textos.
  window._eerrNotaLimpio = function(chico){
    const _mm = v => 'MM$' + fN1(v);
    const esc = chico ? 'font-size:7.5px;line-height:1.45' : '';
    const punto = (t, d) => '<li style="margin-bottom:' + (chico ? '.12rem' : '.3rem') + '"><strong>' + t +
      '</strong> ' + d + '</li>';
    return '<div style="' + esc + '">' +
      '<div style="margin-bottom:.35rem">Este estado de resultado es el mismo de arriba con <strong>tres ' +
      'ajustes</strong>, pensados para ver el resultado del negocio sin partidas que no son del giro del ' +
      'período:</div>' +
      '<ol style="margin:0 0 .35rem 1.1rem;padding:0">' +
      punto('Costo de ventas en una sola línea.',
            'No se abre en Técnicos y Repuestos, porque esa apertura existe sólo en Real y no tiene presupuesto ' +
            'contra el cual compararse.') +
      punto('Costo de ventas neto de garantías.',
            'A ese costo se le descuenta lo que ya se gastó en atender las garantías vigentes: ' +
            '<strong>' + _mm(GAR.fecha) + '</strong>, repartidos en partes iguales entre los ' + n + ' meses ' +
            'cargados (<strong>' + _mm(_garMes) + ' por mes</strong>). El monto sale de la tabla «Contratos de ' +
            'Garantía · Costo Estimado» de Visión General: de los ' + GAR.n + ' contratos que estuvieron vigentes ' +
            'en algún momento del año —incluidos los que ya terminaron, porque su costo igual se incurrió—, su ' +
            'costo estimado total del año (' + _mm(GAR.total) + ') menos el costo que queda por delante (' +
            _mm(GAR.rem) + ').') +
      punto('Depreciación sin el Arriendo Piso 1.',
            'Ese arriendo es de la oficina, no del giro, y sale del estado de resultado.') +
      punto('EBITDAR y arriendo de bodega separados.',
            'En la hoja el arriendo no está dentro del EBITDA —viene más abajo, junto a la depreciación—, así que ' +
            'ese EBITDA es en realidad un <strong>EBITDAR</strong>: resultado antes de intereses, impuestos, ' +
            'depreciación, amortización y arriendo. Por eso la línea se rotula así y debajo va el arriendo de ' +
            'bodega y el <strong>EBITDA Empresa con arriendo</strong>. La depreciación queda sólo con S&amp;S, de ' +
            'modo que el resultado operacional no cambia.') +
      '</ol>' +
      '<div>Los dos primeros ajustes bajan el costo y el tercero baja la depreciación, así que <strong>suben el ' +
      'margen, los tres EBITDA y los resultados</strong>. El <strong>impuesto a la renta se recalcula al 27%</strong> ' +
      'del nuevo resultado antes de impuestos —en un mes con pérdida queda como crédito, igual que en la hoja—, ' +
      'de modo que no es el impuesto contabilizado. Los <strong>ingresos, los gastos de personal, el GAV, los ' +
      'gastos adicionales y el resultado no operacional</strong> no se tocan, y las columnas de presupuesto se ' +
      'muestran tal como vienen en la hoja Ratio Costos 2.</div>' +
      '</div>';
  };

  const notaLimpio = document.getElementById('eerr-limpio-nota');
  if(notaLimpio) notaLimpio.innerHTML = window._eerrNotaLimpio();

  const limpioEl = document.getElementById('eerr-limpio-table');
  if(limpioEl){
    const selLimpio = { v: Array.from({length:n},(_,i)=>i) };
    montarSeg(document.getElementById('eerr-limpio-seg'), selLimpio, limpioEl, true);
    renderEERR(limpioEl, selLimpio.v, true);
  }

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
    ...(_eerrHay(otrArr)||_eerrHay(otrArrP) ? [{key:'otros', label:'Otros Gastos por Naturaleza', arr:otrArr, arrP:otrArrP, color:'#E87722'}] : []),
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

// ── EXPORTAR RESUMEN: último mes + acumulado ──────────────────────
// Mismo formato y mismas filas que el EERR de pantalla, pero condensado a
// dos bloques de columnas: el último mes cerrado y el acumulado del año,
// cada uno contra presupuesto con su variación en monto y en %. La tabla se
// arma desde los datos y no clonando la de pantalla, porque esa trae una
// columna por mes.
async function eerrExportResumenPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const R2 = (window.APP_DATA && window.APP_DATA.ratios2) || {};
  const M  = R2.meses || [];
  if (!M.length) { alert('No hay datos EERR para exportar.'); return; }

  // Con 'limpio' sale la misma hoja A4 pero sin abrir el costo de ventas,
  // igual que la tabla del EERR Limpio en pantalla.
  const _limpio = arguments[0] === 'limpio';
  // Las líneas que el EERR limpio recalcula, para que el A4 muestre lo mismo
  // que la tabla: depreciación sin Arriendo Piso 1 y los resultados corregidos.
  const _nL = M.length;
  const _restaPiso = a => Array.from({length:_nL},(_,i)=>((a||[])[i]||0)-((R2.dep_arr_piso||[])[i]||0));
  const _garMesA4 = (window._eerrGarMes || 0);
  const _conGarA4 = a => Array.from({length:_nL},(_,i)=>((a||[])[i]||0) + _garMesA4);
  const _LIM = {
    costo_ventas:     _conGarA4(R2.costo_ventas),
    margen_mm:        _conGarA4(R2.margen_mm),
    ebitda_directo:   _conGarA4(R2.ebitda_directo),
    ebitda_indirecto: _conGarA4(R2.ebitda_indirecto),
    ebitda_empresa:   _conGarA4(R2.ebitda_empresa),
    depreciacion: Array.from({length:_nL},(_,i)=>((R2.dep_ss||[])[i]||0)),
    resultado_operacional: _conGarA4(_restaPiso(R2.resultado_operacional)),
    resultado_antes_imp:   _conGarA4(_restaPiso(R2.resultado_antes_imp)),
  };
  _LIM.ebitdar    = _LIM.ebitda_empresa.slice();
  _LIM.ebitda_arr = Array.from({length:_nL},(_,i)=>_LIM.ebitdar[i] + ((R2.dep_arr_bodega||[])[i]||0));
  _LIM.impuesto_renta      = _LIM.resultado_antes_imp.map(v => -v * 0.27);
  _LIM.resultado_ejercicio = _LIM.resultado_antes_imp.map(v => v * 0.73);
  const _vL = k => (_limpio && _LIM[k]) ? _LIM[k] : R2[k];
  const btn  = document.getElementById(_limpio ? 'eerr-limpio-res-btn' : 'eerr-pdf-res-btn');
  const ICON = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  const n  = M.length, ult = n - 1;
  const gg = a => Array.isArray(a) ? a : [];
  const v  = (a, i) => { const x = gg(a)[i]; return (typeof x === 'number' && isFinite(x)) ? x : 0; };
  const ac = a => gg(a).slice(0, n).reduce((s, x) => s + ((typeof x === 'number' && isFinite(x)) ? x : 0), 0);
  const fM = x => (Math.abs(x) < 0.05 ? '—' : x.toLocaleString('es-CL',
                   { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const fP = x => (!isFinite(x) || Math.abs(x) < 0.0005 ? '—'
                   : (x * 100).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%');
  const col = x => x < -0.05 ? '#C00000' : x > 0.05 ? '#00832F' : '#555';

  let wrap = null;
  try {
    const BRD = 'border-bottom:1px solid #E6EAF2';
    const td  = (txt, extra) => '<td style="' + BRD + ';padding:2.6px 7px;font-size:8.5px;text-align:right;' +
      'font-variant-numeric:tabular-nums;white-space:nowrap;' + (extra || '') + '">' + txt + '</td>';
    // Cuatro celdas de un bloque: real, ptto, variación y variación %.
    // La variación se calcula siempre como real − presupuesto, tanto en el mes
    // como en el acumulado, para que ambos bloques signifiquen lo mismo: la
    // hoja trae la variación mensual como |real|−|ptto|, que en las líneas de
    // costo sale con el signo opuesto al del acumulado y confundía al leerlos
    // uno al lado del otro. Con este criterio, positivo siempre es favorable:
    // más ingresos o menos costo que lo presupuestado.
    const blq = (ar, ap, av, avp, i, neg, bold) => {
      const r  = i === null ? ac(ar) : v(ar, i);
      const p  = i === null ? ac(ap) : v(ap, i);
      const va = r - p;
      const vp = Math.abs(p) > 0 ? va / Math.abs(p) : 0;
      const st = bold ? 'font-weight:700;' : '';
      return td(fM(r), st + 'color:#111') + td(fM(p), st + 'color:#6B7BA8') +
             td(fM(va), 'color:' + col(va)) + td(fP(vp), 'color:#888');
    };
    const blqPct = (numR, numP, denR, denP, i, bold) => {
      const dR = i === null ? Math.abs(ac(denR)) : Math.abs(v(denR, i));
      const dP = i === null ? Math.abs(ac(denP)) : Math.abs(v(denP, i));
      const r  = dR ? (i === null ? ac(numR) : v(numR, i)) / dR : 0;
      const p  = dP ? (i === null ? ac(numP) : v(numP, i)) / dP : 0;
      const st = bold ? 'font-weight:700;' : '';
      return td(fP(r), st + 'color:#111') + td(fP(p), st + 'color:#6B7BA8') +
             td(fP(r - p), 'color:' + col(r - p)) +
             td(fP(Math.abs(p) > 0 ? (r - p) / Math.abs(p) : 0), 'color:#888');
    };
    const lbl = (t2, ind, st) => '<td style="' + BRD + ';padding:2.6px 7px 2.6px ' + (ind || '7px') +
      ';font-size:8.5px;white-space:nowrap;' + (st || '') + '">' + t2 + '</td>';

    const fila     = (t2, ar, ap, av, avp, neg) =>
      '<tr>' + lbl(t2) + blq(ar, ap, av, avp, ult, neg) + blq(ar, ap, av, avp, null, neg) + '</tr>';
    const filaSub  = (t2, ar, ap, av, avp, neg) =>
      '<tr>' + lbl('↳ ' + t2, '18px', 'color:#555') + blq(ar, ap, av, avp, ult, neg) +
      blq(ar, ap, av, avp, null, neg) + '</tr>';
    const guion    = '<td style="' + BRD + ';padding:2.6px 7px;text-align:right;font-size:8.5px;color:#B8C1D8">—</td>';
    const filaReal = (t2, ar) =>
      '<tr>' + lbl('↳ ' + t2, '18px', 'color:#555') +
      td(fM(v(ar, ult)), 'color:#111') + guion + guion + guion +
      td(fM(ac(ar)), 'color:#111') + guion + guion + guion + '</tr>';
    const filaCel  = (t2, ar, ap, av, avp, neg) =>
      '<tr style="background:#def3fa">' + lbl(t2, '7px', 'font-weight:700') +
      blq(ar, ap, av, avp, ult, neg, true) + blq(ar, ap, av, avp, null, neg, true) + '</tr>';
    const filaAzul = (t2, ar, ap, av, avp, neg) =>
      '<tr style="background:#0E2D55;color:#fff">' +
      '<td style="padding:3.4px 7px;font-size:8.5px;font-weight:700;white-space:nowrap">' + t2 + '</td>' +
      blq(ar, ap, av, avp, ult, neg, true).replace(/color:#111/g, 'color:#fff')
        .replace(/color:#6B7BA8/g, 'color:#B8C1D8').replace(/color:#888/g, 'color:#B8C1D8') +
      blq(ar, ap, av, avp, null, neg, true).replace(/color:#111/g, 'color:#fff')
        .replace(/color:#6B7BA8/g, 'color:#B8C1D8').replace(/color:#888/g, 'color:#B8C1D8') + '</tr>';
    const filaPct  = (t2, numR, numP, denR, denP) =>
      '<tr>' + lbl(t2) + blqPct(numR, numP, denR, denP, ult) +
      blqPct(numR, numP, denR, denP, null) + '</tr>';
    const sep = t2 => '<tr style="background:#edf0f5"><td colspan="9" style="padding:2.6px 7px;font-size:7.5px;' +
      'font-weight:700;color:#6B7BA8;letter-spacing:.06em">' + t2.toUpperCase() + '</td></tr>';

    const hay = a => Array.isArray(a) && a.some(x => Math.abs(x || 0) > 0.0005);
    const hasGaAd = hay(R2.total_gastos_adicionales) || hay(R2.finiquitos) || hay(R2.multas);
    const IT = R2.ingresos_totales, ITP = R2.ingresos_totales_p;

    const cuerpo =
      sep('Ingresos') +
      fila('Ingresos de actividades ordinarias (MM$)', R2.ingresos_totales, R2.ingresos_totales_p, R2.ingresos_totales_v, R2.ingresos_totales_vp) +
      filaSub('Ingresos por contratos (MM$)', R2.ingresos_contratos, R2.ingresos_contratos_p, R2.ingresos_contratos_v, R2.ingresos_contratos_vp) +
      filaSub('Ingresos por otras actividades (MM$)', R2.ingresos_otras, R2.ingresos_otras_p, R2.ingresos_otras_v, R2.ingresos_otras_vp) +
      fila('(−) Costo de ventas (MM$)', _vL('costo_ventas'), R2.costo_ventas_p, R2.costo_ventas_v, R2.costo_ventas_vp, true) +
      (!_limpio && hay(R2.costo_tecnicos)  ? filaReal('Costo Técnicos y Personal (MM$, sólo Real)', R2.costo_tecnicos) : '') +
      (!_limpio && hay(R2.costo_repuestos) ? filaReal('Costo Repuestos y Otros (MM$, sólo Real)', R2.costo_repuestos) : '') +
      filaCel('= Margen del Producto (MM$)', _vL('margen_mm'), R2.margen_mm_p, R2.margen_mm_v, R2.margen_mm_vp) +
      filaPct('Margen %', _vL('margen_mm'), R2.margen_mm_p, IT, ITP) +
      sep('Gastos Operacionales Directos') +
      fila('(−) Gasto beneficios empleados Directos (MM$)', R2.gastos_empleados, R2.gastos_empleados_p, R2.gastos_empleados_v, R2.gastos_empleados_vp, true) +
      (hay(R2.otros_gastos) || hay(R2.otros_gastos_p)
        ? fila('(−) Otros gastos por naturaleza Directos (MM$)', R2.otros_gastos, R2.otros_gastos_p, R2.otros_gastos_v, R2.otros_gastos_vp, true) : '') +
      filaCel('= EBITDA Directo (MM$)', _vL('ebitda_directo'), R2.ebitda_directo_p, R2.ebitda_directo_v, R2.ebitda_directo_vp) +
      filaPct('%  EBITDA Directo', _vL('ebitda_directo'), R2.ebitda_directo_p, IT, ITP) +
      sep('GAV Indirecto') +
      fila('(−) GAV Indirecto (MM$)', R2.gav_indirecto, R2.gav_indirecto_p, R2.gav_indirecto_v, R2.gav_indirecto_vp, true) +
      filaCel('= EBITDA Indirecto (MM$)', _vL('ebitda_indirecto'), R2.ebitda_indirecto_p, R2.ebitda_indirecto_v, R2.ebitda_indirecto_vp) +
      (hasGaAd ? sep('Gastos Adicionales') +
        fila('Finiquitos (MM$)', R2.finiquitos, R2.finiquitos_p, R2.finiquitos_v, R2.finiquitos_vp, true) +
        fila('Multas (MM$)', R2.multas, R2.multas_p, R2.multas_v, R2.multas_vp, true) +
        fila('Prov. Obsolescencias Inventarios (MM$)', R2.prov_obsolescencias, R2.prov_obsolescencias_p, R2.prov_obsolescencias_v, R2.prov_obsolescencias_vp, true) +
        fila('Prov. Incobrables (MM$)', R2.prov_incobrables, R2.prov_incobrables_p, R2.prov_incobrables_v, R2.prov_incobrables_vp, true) +
        fila('Prov. Habilitación Oficinas (MM$)', R2.prov_habilitacion, R2.prov_habilitacion_p, R2.prov_habilitacion_v, R2.prov_habilitacion_vp, true) +
        fila('Total Gastos Adicionales (MM$)', R2.total_gastos_adicionales, R2.total_gastos_adicionales_p, R2.total_gastos_adicionales_v, R2.total_gastos_adicionales_vp, true) : '') +
      filaAzul('= ' + (_limpio ? 'EBITDAR Empresa · antes de arriendo' : 'EBITDA Empresa') + ' (MM$)', _vL('ebitda_empresa'), R2.ebitda_empresa_p, R2.ebitda_empresa_v, R2.ebitda_empresa_vp) +
      filaPct('%  ' + (_limpio ? 'EBITDAR Empresa' : 'EBITDA Empresa'), _vL('ebitda_empresa'), R2.ebitda_empresa_p, IT, ITP) +
      (_limpio ? sep('Arriendo') +
        filaReal('(−) Arriendo Bodega 50% (MM$, sólo Real)', R2.dep_arr_bodega) +
        filaCel('= EBITDA Empresa · con arriendo (MM$)', _LIM.ebitda_arr, R2.ebitda_empresa_p, R2.ebitda_empresa_v, R2.ebitda_empresa_vp) +
        filaPct('%  EBITDA Empresa', _LIM.ebitda_arr, R2.ebitda_empresa_p, IT, ITP) : '') +
      sep('Resultado Operacional') +
      fila('(−) Depreciación y amortización' + (_limpio ? ' S&S' : '') + ' (MM$)', _vL('depreciacion'), R2.depreciacion_p, R2.depreciacion_v, R2.depreciacion_vp, true) +
      (!_limpio && hay(R2.dep_ss)         ? filaReal('Depreciación y amortización S&S (MM$, sólo Real)', R2.dep_ss) : '') +
      (!_limpio && hay(R2.dep_arr_piso)   ? filaReal('Arriendo Piso 1 (MM$, sólo Real)', R2.dep_arr_piso) : '') +
      (!_limpio && hay(R2.dep_arr_bodega) ? filaReal('Arriendo Bodega 50% (MM$, sólo Real)', R2.dep_arr_bodega) : '') +
      filaCel('= Resultado Operacional (MM$)', _vL('resultado_operacional'), R2.resultado_operacional_p, R2.resultado_operacional_v, R2.resultado_operacional_vp) +
      sep('Resultado No Operacional') +
      fila('Otros ingresos por función (MM$)', R2.otros_ingresos_funcion, R2.otros_ingresos_funcion_p, R2.otros_ingresos_funcion_v, R2.otros_ingresos_funcion_vp) +
      fila('Ingreso financiero (MM$)', R2.ingreso_financiero, R2.ingreso_financiero_p, R2.ingreso_financiero_v, R2.ingreso_financiero_vp) +
      fila('Costo financiero (MM$)', R2.costo_financiero, R2.costo_financiero_p, R2.costo_financiero_v, R2.costo_financiero_vp, true) +
      fila('Otros gastos por función (MM$)', R2.otros_gastos_funcion, R2.otros_gastos_funcion_p, R2.otros_gastos_funcion_v, R2.otros_gastos_funcion_vp, true) +
      fila('Diferencia de cambio (MM$)', R2.diferencia_cambio, R2.diferencia_cambio_p, R2.diferencia_cambio_v, R2.diferencia_cambio_vp) +
      filaCel('= Resultado no operacional (MM$)', R2.resultado_no_operacional, R2.resultado_no_operacional_p, R2.resultado_no_operacional_v, R2.resultado_no_operacional_vp) +
      sep('Resultado Final') +
      filaCel('= Resultado antes de impuestos (MM$)', _vL('resultado_antes_imp'), R2.resultado_antes_imp_p, R2.resultado_antes_imp_v, R2.resultado_antes_imp_vp) +
      fila('(−) Impuesto a la renta (MM$)' + (_limpio ? ' · 27%' : ''), _vL('impuesto_renta'), R2.impuesto_renta_p, R2.impuesto_renta_v, R2.impuesto_renta_vp, true) +
      filaAzul('= Resultado del ejercicio (MM$)', _vL('resultado_ejercicio'), R2.resultado_ejercicio_p, R2.resultado_ejercicio_v, R2.resultado_ejercicio_vp);

    const thG = (t2, span) => '<th colspan="' + span + '" style="background:#002D73;color:#fff;font-size:9px;' +
      'padding:4px 7px;letter-spacing:.05em;border-right:1px solid rgba(255,255,255,.25)">' + t2 + '</th>';
    const thC = t2 => '<th style="background:#33448D;color:#fff;font-size:7.5px;padding:3px 7px;text-align:right;' +
      'letter-spacing:.03em;white-space:nowrap">' + t2 + '</th>';
    const hoy = (window.APP_DATA || {}).hoy || '';
    const acumLbl = 'Acumulado ' + M[0] + '–' + M[ult];

    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:940px;' +
      'padding:18px 24px 22px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
    wrap.innerHTML =
      '<div style="border-bottom:2.5px solid #002D73;padding-bottom:7px;margin-bottom:12px">' +
        '<span style="font-size:15px;font-weight:700;color:#002D73">TECSERVICE — ' +
      (_limpio ? 'EERR Limpio · Servicio Técnico S&amp;S' : 'Estado de Resultado · Servicio Técnico S&amp;S') + '</span>' +
        '&emsp;<span style="font-size:10px;color:#555">' + M[ult] + ' y acumulado del año' +
        (hoy ? ' &nbsp;·&nbsp; Datos al ' + hoy : '') + '</span></div>' +
      '<table style="border-collapse:collapse;width:100%">' +
        '<thead><tr>' +
          '<th rowspan="2" style="background:#002D73;color:#fff;font-size:9px;padding:4px 7px;text-align:left;' +
            'border-right:1px solid rgba(255,255,255,.25)">CONCEPTO</th>' +
          thG(M[ult].toUpperCase(), 4) + thG(acumLbl.toUpperCase(), 4) +
        '</tr><tr>' +
          thC('REAL') + thC('PTTO') + thC('VAR') + thC('VAR %') +
          thC('REAL') + thC('PTTO') + thC('VAR') + thC('VAR %') +
        '</tr></thead><tbody>' + cuerpo + '</tbody></table>' +
      '<div style="font-size:7.5px;color:#8892a8;margin-top:7px;line-height:1.5">' +
        'Cifras en MM$. El acumulado suma los ' + n + ' meses cerrados del año (' + M[0] + '–' + M[ult] + ') y ' +
        'se compara contra el presupuesto acumulado del mismo período. La variación es real − presupuesto en ' +
        'ambos bloques, así que positivo y verde es siempre favorable —más ingreso o menos costo que lo ' +
        'presupuestado— y negativo y rojo, desfavorable. ' +
        (_limpio
          ? 'El costo de ventas va en una sola línea, ya neto del costo de garantías.'
          : 'El costo de ventas se abre en técnicos/personal y repuestos, apertura que el Excel sólo trae en ' +
            'Real, por eso sus columnas de presupuesto van en «—».') + '</div>' +
      (_limpio && window._eerrNotaLimpio
        ? '<div style="margin-top:9px;border-top:1px solid #E6EAF2;padding-top:7px;color:#444">' +
          window._eerrNotaLimpio(true) + '</div>' : '');

    document.body.appendChild(wrap);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const realW = Math.ceil(wrap.getBoundingClientRect().width)  || wrap.offsetWidth;
    const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
    if (!realW || !realH) throw new Error('No se pudo medir el contenido');
    const canvas = await html2canvas(wrap, {
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });
    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, (_limpio ? 'EERR_Limpio_Resumen_' : 'EERR_Resumen_TS_') + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);
  } catch (err) {
    console.error('eerrExportResumenPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = ICON; }
  }
}

// Exporta a PDF el EERR de arriba con sus ratios, o el EERR Limpio solo. Es
// la misma rutina: cambian las tablas, el título y el nombre del archivo.
async function eerrExportPDF(cual) {
  // Verificar librerías antes de todo
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }

  const limpio   = cual === 'limpio';
  const eerrTbl  = document.getElementById(limpio ? 'eerr-limpio-table' : 'eerr-table');
  const ratioTbl = limpio ? null : document.getElementById('eerr-ratio-table');
  if (!eerrTbl && !ratioTbl) { alert('No hay datos EERR para exportar.'); return; }

  const btn = document.getElementById(limpio ? 'eerr-limpio-pdf-btn' : 'eerr-pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  const mesLbl = (document.getElementById('eerr-mes-lbl') || {}).textContent || '';
  const ANO = (window.APP_DATA || {}).ano_actual || new Date().getFullYear();

  const SVG_ICON = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF';

  let wrap = null;
  try {
    // Clona preservando el mismo tamaño de fuente, padding y colores que la
    // tabla en pantalla: antes se forzaba todo a 9px con 3px/6px de padding,
    // lo que aplastaba la jerarquía tipográfica original y hacía que el PDF
    // se viera distinto a lo que la tabla realmente muestra. Sólo se quita
    // lo que impediría capturar el contenido completo (sticky/overflow).
    function cleanClone(el) {
      const c = el.cloneNode(true);
      c.querySelectorAll('*').forEach(n => {
        n.style.position  = 'static';
        n.style.maxHeight = 'none';
        n.style.overflow  = 'visible';
        n.style.maxWidth  = 'none';
      });
      c.querySelectorAll('td,th').forEach(n => { n.style.whiteSpace = 'nowrap'; });
      c.querySelectorAll('table').forEach(t => { t.style.width = 'auto'; });
      return c;
    }

    // Contenedor inline-block para que el ancho se ajuste al contenido
    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;' +
      'padding:14px 20px 20px;font-family:Arial,sans-serif;color:#111;' +
      'display:inline-block;box-sizing:border-box';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'margin-bottom:10px;border-bottom:2.5px solid #002D73;padding-bottom:6px';
    hdr.innerHTML = '<span style="font-size:13px;font-weight:700;color:#002D73">TECSERVICE — ' +
      (limpio ? 'EERR Limpio' : 'Estado de Resultado y Análisis de Ratios') + '</span>' +
      '&emsp;<span style="font-size:10px;color:#555">Período: ' + mesLbl + ' &nbsp;·&nbsp; Cifras en MM$</span>';
    wrap.appendChild(hdr);

    function makeSection(label, srcEl) {
      const sec = document.createElement('div');
      sec.style.marginBottom = '14px';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:9.5px;font-weight:700;color:#002D73;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px';
      lbl.textContent = label;
      sec.appendChild(lbl);
      sec.appendChild(cleanClone(srcEl));
      return sec;
    }

    if (eerrTbl)  wrap.appendChild(makeSection(limpio ? 'EERR Limpio' : 'Estado de Resultado', eerrTbl));
    if (ratioTbl) wrap.appendChild(makeSection('Análisis de Ratios',  ratioTbl));

    // Misma nota que va al pie de la tabla en pantalla
    const nota = document.createElement('div');
    nota.style.cssText = 'font-size:8px;color:#555;line-height:1.5;margin-top:2px';
    nota.innerHTML = limpio
      ? (window._eerrNotaLimpio ? window._eerrNotaLimpio(true) : '')
      : 'El <strong>Costo de Ventas</strong> se abre en <strong>Costo Técnicos y Personal</strong> ' +
        '(gasto por beneficios a los empleados técnicos) y <strong>Costo Repuestos y Otros</strong> ' +
        '(el resto, por diferencia). Esa apertura sólo existe en Real: el presupuesto no la distingue.';
    wrap.appendChild(nota);

    document.body.appendChild(wrap);

    // Esperar un frame para que el layout se calcule
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Medir ancho real del contenido (inline-block lo expande al contenido)
    const realW = Math.ceil(wrap.getBoundingClientRect().width) || wrap.offsetWidth;
    const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;

    if (!realW || !realH) throw new Error('No se pudo medir el contenido (w=' + realW + ' h=' + realH + ')');

    // Convertir a block con ancho fijo para que html2canvas capture correctamente
    wrap.style.display = 'block';
    wrap.style.width   = realW + 'px';

    const canvas = await html2canvas(wrap, {
      scale:        hdEscala(realW, realH),
      backgroundColor: '#ffffff',
      useCORS:      true,
      logging:      false,
      width:        realW,
      height:       realH,
      windowWidth:  realW,
      windowHeight: realH,
    });

    const MM = 25.4 / 96;
    await hdEntregar(canvas, (limpio ? 'EERR_Limpio_' : 'EERR_TS_') + mesLbl.replace(/[\s/]+/g, '_') + '_' + ANO,
                     realW * MM, realH * MM);

  } catch (err) {
    console.error('eerrExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = SVG_ICON; }
  }
}
