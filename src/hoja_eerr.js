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

  // Mes etiqueta header
  const mesLbl = document.getElementById('eerr-mes-lbl');
  if(mesLbl) mesLbl.textContent = meses[n-1] + ' ' + ANO_ACTUAL;

  // ── Helpers ──────────────────────────────────────────────────
  const fN1  = v => (v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fmm  = v => { const a=Math.abs(v||0); return (v<0?'−':'')+fN1(a); };
  const fpct = v => ((v||0)*100).toFixed(1).replace('.',',')+'%';
  const sumArr = arr => (arr||[]).slice(0,n).reduce((s,v)=>s+(v||0),0);

  // ── EERR TABLE ────────────────────────────────────────────────
  const eerrEl = document.getElementById('eerr-table');
  if(eerrEl){
    const colHdr    = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrSub = 'background:#1e4080;color:rgba(255,255,255,.7);font-size:.55rem;font-weight:600;text-align:center;padding:.2rem .3rem';
    // 2 columnas por mes (REAL + PTTO) + 2 totales (Total R + Total P)
    const totalCols = n * 2 + 3; // label + n*2 + totalR + totalP
    const thMeses1  = meses.map(m=>`<th colspan="2" style="${colHdr}">${m.slice(0,3)}</th>`).join('');
    const thMeses2  = meses.map(()=>`<th style="${colHdrSub}">REAL</th><th style="${colHdrSub}">PTTO</th>`).join('');

    const tdR  = v => `<td class="num" style="color:#111">MM$${fmm(v)}</td>`;
    const tdP  = v => `<td class="num" style="color:var(--mut)">MM$${fmm(v)}</td>`;
    const tdRb = v => `<td class="num" style="font-weight:700;color:#111">MM$${fmm(v)}</td>`;
    const tdPb = v => `<td class="num" style="font-weight:700;color:var(--mut)">MM$${fmm(v)}</td>`;
    const tdRW = v => `<td class="num" style="font-weight:700;color:#fff">MM$${fmm(v)}</td>`;
    const tdPW = v => `<td class="num" style="font-weight:700;color:rgba(255,255,255,.65)">MM$${fmm(v)}</td>`;
    const tdRP = (vr, vp, style) => style==='bold'?tdRb(vr)+tdPb(vp):style==='white'?tdRW(vr)+tdPW(vp):tdR(vr)+tdP(vp);
    const tdRPpct = (vr, vp, style) => {
      const sr = `<td class="num" style="${style==='bold'?'font-weight:700;':''}color:#111">${fpct(vr)}</td>`;
      const sp = `<td class="num" style="${style==='bold'?'font-weight:700;':''}color:var(--mut)">${fpct(vp)}</td>`;
      return sr+sp;
    };

    const pairCells = (ar, ap, style) =>
      Array.from({length:n},(_,i)=>tdRP((ar||[])[i]||0,(ap||[])[i]||0,style)).join('');
    const pairPctCells = (ar, ap, style) =>
      Array.from({length:n},(_,i)=>tdRPpct((ar||[])[i]||0,(ap||[])[i]||0,style)).join('');

    const LBL  = (txt,indent) => `<td style="font-size:.62rem;white-space:nowrap;padding:.3rem .6rem .3rem ${indent||'.6rem'}">${txt}</td>`;
    const LBLb = (txt,clr)    => `<td style="font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;font-weight:700;color:${clr||'inherit'}">${txt}</td>`;

    const rowBase = (label, ar, ap) => `<tr>
      ${LBL(label)}${pairCells(ar,ap,'')}
      <td class="num" style="font-weight:700;color:#111">MM$${fmm(sumArr(ar))}</td>
      <td class="num" style="font-weight:700;color:var(--mut)">MM$${fmm(sumArr(ap))}</td></tr>`;

    const rowSub = (label, ar, ap) => `<tr>
      ${LBL('↳ '+label,'1.4rem')}${pairCells(ar,ap,'')}
      <td class="num" style="font-weight:700;color:#555">MM$${fmm(sumArr(ar))}</td>
      <td class="num" style="font-weight:700;color:var(--mut)">MM$${fmm(sumArr(ap))}</td></tr>`;

    const rowPct = (label, ar, ap, totR, totP) => `<tr>
      ${LBL(label)}${pairPctCells(ar,ap,'')}
      <td class="num" style="font-weight:700;color:#111">${fpct(totR)}</td>
      <td class="num" style="font-weight:700;color:var(--mut)">${fpct(totP)}</td></tr>`;

    const rowResultCeleste = (label, ar, ap) => `<tr style="background:rgba(0,160,220,.13)">
      ${LBLb(label)}${pairCells(ar,ap,'bold')}
      <td class="num" style="font-weight:700;color:#111">MM$${fmm(sumArr(ar))}</td>
      <td class="num" style="font-weight:700;color:var(--mut)">MM$${fmm(sumArr(ap))}</td></tr>`;

    const rowResultAzul = (label, ar, ap) => `<tr style="background:var(--az3)">
      ${LBLb(label,'#fff')}${pairCells(ar,ap,'white')}
      <td class="num" style="font-weight:700;color:#fff">MM$${fmm(sumArr(ar))}</td>
      <td class="num" style="font-weight:700;color:rgba(255,255,255,.65)">MM$${fmm(sumArr(ap))}</td></tr>`;

    const sepRow = label =>
      `<tr style="background:rgba(0,45,115,.07)"><td colspan="${totalCols}" style="font-size:.58rem;font-weight:700;color:var(--mut);padding:.22rem .6rem;letter-spacing:.05em">${label.toUpperCase()}</td></tr>`;

    // Totales % Real acumulado
    const totIng     = Math.abs(sumArr(R2.ingresos_totales)) || 1;
    const totMargenPct = sumArr(R2.margen_mm) / totIng;
    const totEbitDPct  = sumArr(R2.ebitda_directo) / totIng;
    const totRejPct    = sumArr(R2.resultado_ejercicio) / totIng;

    // % por mes para filas calculadas (no vienen directas del excel para EBITDA Empresa)
    const ebitEmpPctArr  = (R2.ebitda_empresa||[]).map((v,i)=>Math.abs((R2.ingresos_totales||[])[i]||0)>0?v/Math.abs((R2.ingresos_totales||[])[i]):0);
    const ebitEmpPctArrP = (R2.ebitda_empresa_p||[]).map((v,i)=>Math.abs((R2.ingresos_totales_p||[])[i]||0)>0?v/Math.abs((R2.ingresos_totales_p||[])[i]):0);
    const rejPctArr      = (R2.resultado_ejercicio||[]).map((v,i)=>Math.abs((R2.ingresos_totales||[])[i]||0)>0?v/Math.abs((R2.ingresos_totales||[])[i]):0);
    const rejPctArrP     = (R2.resultado_ejercicio_p||[]).map((v,i)=>Math.abs((R2.ingresos_totales_p||[])[i]||0)>0?v/Math.abs((R2.ingresos_totales_p||[])[i]):0);
    const totEbitEPct    = sumArr(R2.ebitda_empresa) / totIng;

    const hasGaAd = [R2.finiquitos, R2.multas, R2.prov_obsolescencias, R2.prov_incobrables, R2.prov_habilitacion]
      .some(a=>(a||[]).some(v=>v!==0));

    eerrEl.innerHTML = `
      <div style="overflow-x:auto">
        <table class="tbl" style="font-size:.62rem;width:100%;min-width:600px">
          <thead>
            <tr>
              <th style="${colHdr};text-align:left;min-width:220px" rowspan="2">Concepto</th>
              ${thMeses1}
              <th style="${colHdr};background:#1a3a6b" rowspan="2">Total R</th>
              <th style="${colHdr};background:#233060" rowspan="2" style="color:rgba(255,255,255,.7)">Total P</th>
            </tr>
            <tr>${thMeses2}</tr>
          </thead>
          <tbody>
            ${sepRow('Ingresos')}
            ${rowBase('Ingresos de actividades ordinarias (MM$)', R2.ingresos_totales, R2.ingresos_totales_p)}
            ${rowSub('Ingresos por contratos (MM$)', R2.ingresos_contratos, R2.ingresos_contratos_p)}
            ${rowSub('Ingresos por otras actividades (MM$)', R2.ingresos_otras, R2.ingresos_otras_p)}
            ${rowBase('(−) Costo de ventas (MM$)', R2.costo_ventas, R2.costo_ventas_p)}
            ${rowResultCeleste('= Margen del Producto (MM$)', R2.margen_mm, R2.margen_mm_p)}
            ${rowPct('Margen %', R2.margen_pct, R2.margen_pct_p, totMargenPct, sumArr(R2.margen_mm_p)/(Math.abs(sumArr(R2.ingresos_totales_p))||1))}
            ${sepRow('Gastos Operacionales Directos')}
            ${rowBase('(−) Gasto beneficios empleados Directos (MM$)', R2.gastos_empleados, R2.gastos_empleados_p)}
            ${rowBase('(−) Otros gastos por naturaleza Directos (MM$)', R2.otros_gastos, R2.otros_gastos_p)}
            ${rowResultCeleste('= EBITDA Directo (MM$)', R2.ebitda_directo, R2.ebitda_directo_p)}
            ${rowPct('%  EBITDA Directo', R2.ebitda_directo_pct, R2.ebitda_directo_pct_p, totEbitDPct, sumArr(R2.ebitda_directo_p)/(Math.abs(sumArr(R2.ingresos_totales_p))||1))}
            ${sepRow('GAV Indirecto')}
            ${rowBase('(−) GAV Indirecto (MM$)', R2.gav_indirecto, R2.gav_indirecto_p)}
            ${rowResultCeleste('= EBITDA Indirecto (MM$)', R2.ebitda_indirecto, R2.ebitda_indirecto_p)}
            ${hasGaAd ? sepRow('Gastos Adicionales') : ''}
            ${hasGaAd ? rowBase('Finiquitos (MM$)', R2.finiquitos, R2.finiquitos_p) : ''}
            ${hasGaAd ? rowBase('Multas (MM$)', R2.multas, R2.multas_p) : ''}
            ${hasGaAd ? rowBase('Prov. Obsolescencias Inventarios (MM$)', R2.prov_obsolescencias, R2.prov_obsolescencias_p) : ''}
            ${hasGaAd ? rowBase('Prov. Incobrables (MM$)', R2.prov_incobrables, R2.prov_incobrables_p) : ''}
            ${hasGaAd ? rowBase('Prov. Habilitación Oficinas (MM$)', R2.prov_habilitacion, R2.prov_habilitacion_p) : ''}
            ${hasGaAd ? rowBase('Total Gastos Adicionales (MM$)', R2.total_gastos_adicionales, R2.total_gastos_adicionales_p) : ''}
            ${rowResultAzul('= EBITDA Empresa (MM$)', R2.ebitda_empresa, R2.ebitda_empresa_p)}
            ${rowPct('%  EBITDA Empresa', ebitEmpPctArr, ebitEmpPctArrP, totEbitEPct, sumArr(R2.ebitda_empresa_p)/(Math.abs(sumArr(R2.ingresos_totales_p))||1))}
            ${sepRow('Resultado Operacional')}
            ${rowBase('(−) Depreciación y amortización (MM$)', R2.depreciacion, R2.depreciacion_p)}
            ${rowResultCeleste('= Resultado Operacional (MM$)', R2.resultado_operacional, R2.resultado_operacional_p)}
            ${sepRow('Resultado No Operacional')}
            ${rowBase('Otros ingresos por función (MM$)', R2.otros_ingresos_funcion, R2.otros_ingresos_funcion_p)}
            ${rowBase('Ingreso financiero (MM$)', R2.ingreso_financiero, R2.ingreso_financiero_p)}
            ${rowBase('Costo financiero (MM$)', R2.costo_financiero, R2.costo_financiero_p)}
            ${rowBase('Otros gastos por función (MM$)', R2.otros_gastos_funcion, R2.otros_gastos_funcion_p)}
            ${rowBase('Diferencia de cambio (MM$)', R2.diferencia_cambio, R2.diferencia_cambio_p)}
            ${rowResultCeleste('= Resultado no operacional (MM$)', R2.resultado_no_operacional, R2.resultado_no_operacional_p)}
            ${sepRow('Resultado Final')}
            ${rowResultCeleste('= Resultado antes de impuestos (MM$)', R2.resultado_antes_imp, R2.resultado_antes_imp_p)}
            ${rowBase('(−) Impuesto a la renta (MM$)', R2.impuesto_renta, R2.impuesto_renta_p)}
            ${rowResultAzul('= Resultado del ejercicio Empresa (MM$)', R2.resultado_ejercicio, R2.resultado_ejercicio_p)}
            ${rowPct('%  Resultado / Ingresos', rejPctArr, rejPctArrP, totRejPct, sumArr(R2.resultado_ejercicio_p)/(Math.abs(sumArr(R2.ingresos_totales_p))||1))}
          </tbody>
        </table>
      </div>`;
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
    const ingOpt    = getIngOpt();
    const totalColsR = n * 2 + 2;
    const thMeses1  = meses.map(m=>`<th colspan="2" style="${colHdr}">${m.slice(0,3)}</th>`).join('');
    const thMeses2  = meses.map(()=>`<th style="${colHdrSub}">REAL</th><th style="${colHdrSub}">PTTO</th>`).join('');
    const thTot     = `<th style="${colHdr};background:#1a3a6b">Total R</th>`;

    const fpR = v => `${((v||0)*100).toFixed(1).replace('.',',')}%`;

    const rows = COSTO_OPTS.map(cOpt=>{
      const ratiosR = computeRatio(cOpt.arr,  ingOpt.arr);
      const ratiosP = computeRatio(cOpt.arrP, ingOpt.arrP);
      const totR    = computeRatioTotal(cOpt.arr, ingOpt.arr);
      const active  = cOpt.key === _costoKey;
      const bg      = active ? 'background:rgba(255,140,0,.07)' : '';
      const fw      = active ? 'font-weight:700' : 'font-weight:400';
      const clrR    = active ? 'color:var(--or);font-weight:700' : 'color:#111';
      const clrP    = 'color:var(--mut)';
      const tds = Array.from({length:n},(_,i)=>`
        <td class="num" style="${clrR}">${fpR(ratiosR[i])}</td>
        <td class="num" style="${clrP}">${fpR(ratiosP[i])}</td>`).join('');
      return `<tr style="${bg}">
        <td style="font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;${fw}">${cOpt.label}<span style="color:var(--mut);font-weight:400"> / ${ingOpt.label}</span></td>
        ${tds}
        <td class="num" style="font-weight:700${active?';color:var(--or)':''}">${fpR(totR)}</td>
      </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="tbl" style="font-size:.63rem;width:100%;min-width:500px">
          <thead>
            <tr>
              <th style="${colHdr};text-align:left;min-width:220px" rowspan="2">Indicador</th>
              ${thMeses1}
              <th style="${colHdr};background:#1a3a6b" rowspan="2">Total R</th>
            </tr>
            <tr>${thMeses2}</tr>
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
