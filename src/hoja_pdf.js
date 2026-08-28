// hoja_pdf.js — Generador de Reporte PDF · Panel TECSERVICE
// Genera páginas estructuradas con los gráficos clave + indicadores + texto por sección.
// Requiere: jsPDF y html2canvas (CDN en <head>)

async function generarPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no disponibles. Verifique conexión a internet.');
    return;
  }
  const { jsPDF } = window.jspdf;

  // ─── Secciones: id vista, nav, título, canvas clave (1-2), función de KPIs ─
  const SECS = [
    { id:'view-resumen',      nav:'resumen',      lab:'Resumen Ejecutivo',
      charts:['cMes','cDonut1'],
      kpis:()=>{
        const af=APP_DATA.analisis_fac||{};
        const tsIng=af.ts_ingresos||0;
        const contr=APP_DATA.panel.reduce((s,p)=>s+(p.presup_contr_ytd||0),0);
        const pct=tsIng>0?(contr/tsIng*100).toFixed(1):0;
        return[
          {l:'Facturación TS YTD',v:fmtMM(tsIng),c:'#002D73'},
          {l:'Contratos '+pct+'%',v:fmtMM(contr),c:'#33448D'},
          {l:'Otras Facturaciones',v:fmtMM(Math.max(0,tsIng-contr)),c:'#FFC000'},
          {l:'Contratos Activos',v:DATA.length,c:'#28D2C3'},
        ];
      },
      txt:()=>{
        const af=APP_DATA.analisis_fac||{};
        const ts=af.ts_ingresos||0;
        const c=APP_DATA.panel.reduce((s,p)=>s+(p.presup_contr_ytd||0),0);
        const pct=ts>0?(c/ts*100).toFixed(1):0;
        const v90=DATA.filter(d=>d.dias_vence>=0&&d.dias_vence<=90).length;
        return`Facturación Servicio Técnico Ene–${MES_CORTE_NOMBRE} ${ANO_ACTUAL}: ${fmtMM(ts)} total · ${pct}% proviene de contratos. ${v90} contratos vencen en próximos 90 días.`;
      }
    },
    { id:'view-tipos',        nav:'tipos',        lab:'Tipos de Contratos',
      charts:['cTcStack','cTcCoord'],
      kpis:()=>{
        const com=DATA.filter(d=>d.tipo==='Comercial');
        const gar=DATA.filter(d=>d.tipo==='Garantia');
        const val=com.reduce((s,d)=>s+(d.val||0),0);
        return[
          {l:'Contratos Comerciales',v:com.length,c:'#33448D'},
          {l:'Contratos Garantía',v:gar.length,c:'#28D2C3'},
          {l:'Cartera Anual COM',v:fmtMM(val),c:'#002D73'},
          {l:'Clientes con Contrato',v:new Set(DATA.map(d=>d.cliente)).size,c:'#00832F'},
        ];
      },
      txt:()=>{
        const com=DATA.filter(d=>d.tipo==='Comercial');
        const gar=DATA.filter(d=>d.tipo==='Garantia');
        const val=com.reduce((s,d)=>s+(d.val||0),0);
        const garVal=gar.reduce((s,d)=>s+(d.val||0),0);
        return`${com.length} contratos comerciales con cartera anual de ${fmtMM(val)} y ${gar.length} contratos de garantía con cartera de ${fmtMM(garVal)}.`;
      }
    },
    { id:'view-nuevos',       nav:'nuevos',       lab:'Nuevos Clientes y Contratos',
      charts:['cRel','cRelCoord'],
      kpis:()=>{
        const nuevos=DATA.filter(d=>d.tipo==='Comercial'&&d.es_nuevo&&d.dias_inicio_cli>=0&&d.dias_inicio_cli<=90);
        const perdidos=(APP_DATA.panel||[]).filter(p=>p.estado_relacion==='Perdido');
        return[
          {l:'Nuevos (últ. 90d)',v:nuevos.length,c:'#28D2C3'},
          {l:'Clientes Perdidos',v:perdidos.length,c:'#C00000'},
          {l:'Clientes Panel',v:APP_DATA.panel.length,c:'#002D73'},
          {l:'% Renovación',v:APP_DATA.panel.length>0?((APP_DATA.panel.length-perdidos.length)/APP_DATA.panel.length*100).toFixed(0)+'%':'—',c:'#00832F'},
        ];
      },
      txt:()=>{
        const n=DATA.filter(d=>d.tipo==='Comercial'&&d.es_nuevo&&d.dias_inicio_cli>=0&&d.dias_inicio_cli<=90).length;
        return`${n} nuevos contratos comerciales iniciados en los últimos 90 días. Estado relación por cliente vs año anterior.`;
      }
    },
    { id:'view-vencimientos', nav:'vencimientos', lab:'Vencimientos de Contratos',
      charts:['cHzBar'],
      kpis:()=>{
        const v30=DATA.filter(d=>d.dias_vence>=0&&d.dias_vence<=30).length;
        const v60=DATA.filter(d=>d.dias_vence>30&&d.dias_vence<=60).length;
        const v90=DATA.filter(d=>d.dias_vence>60&&d.dias_vence<=90).length;
        const venc=DATA.filter(d=>d.dias_vence<0).length;
        return[
          {l:'Vencidos',v:venc,c:'#C00000'},
          {l:'≤30 días',v:v30,c:'#C00000'},
          {l:'31–60 días',v:v60,c:'#D46000'},
          {l:'61–90 días',v:v90,c:'#8B8200'},
        ];
      },
      txt:()=>{
        const v30=DATA.filter(d=>d.dias_vence>=0&&d.dias_vence<=30).length;
        const v90=DATA.filter(d=>d.dias_vence>=0&&d.dias_vence<=90);
        const val90=v90.filter(d=>d.tipo==='Comercial').reduce((s,d)=>s+(d.val||0),0);
        return`${v30} contratos vencen en ≤30 días. Total de ${v90.length} contratos en riesgo próximos 90 días (${fmtMM(val90)} en cartera comercial).`;
      }
    },
    { id:'view-vision',       nav:'vision',       lab:'Visión General de Cartera',
      charts:['cLong','cTipo'],
      kpis:()=>{
        const com=DATA.filter(d=>d.tipo==='Comercial');
        const cli=new Set(DATA.map(d=>d.cliente)).size;
        const avg=com.length>0?com.reduce((s,d)=>s+(d.long_dias||0),0)/com.length:0;
        const pub=(APP_DATA.panel||[]).filter(p=>p.tipo_cli==='Público').length;
        return[
          {l:'Clientes Únicos',v:cli,c:'#002D73'},
          {l:'Duración Prom.',v:Math.round(avg/30)+' meses',c:'#33448D'},
          {l:'Clientes Públicos',v:pub,c:'#28D2C3'},
          {l:'Clientes Privados',v:(APP_DATA.panel||[]).length-pub,c:'#FFC000'},
        ];
      },
      txt:()=>{
        const com=DATA.filter(d=>d.tipo==='Comercial');
        const avg=com.length>0?com.reduce((s,d)=>s+(d.long_dias||0),0)/com.length:0;
        return`Cartera de ${DATA.length} contratos activos distribuida en ${new Set(DATA.map(d=>d.cliente)).size} clientes. Duración promedio ${Math.round(avg/30)} meses.`;
      }
    },
    { id:'view-presupuesto',  nav:'presupuesto',  lab:'Cumplimiento Presupuesto',
      charts:['cPpto'],
      kpis:()=>{
        const anual=PPTO_CONTRATOS||0;
        const ytd=anual*MES_CORTE/12;
        const real=DATA.filter(d=>d.tipo==='Comercial').reduce((s,d)=>s+(d.val||0),0);
        const pct=ytd>0?(real/ytd*100).toFixed(1):0;
        return[
          {l:'Cartera Anual COM',v:fmtMM(real),c:'#33448D'},
          {l:'Ppto Contratos Anual',v:fmtMM(anual),c:'#002D73'},
          {l:'Ppto a la Fecha',v:fmtMM(ytd),c:'#28D2C3'},
          {l:'% Cumplimiento',v:pct+'%',c:pct>=100?'#00832F':pct>=70?'#FFC000':'#C00000'},
        ];
      },
      txt:()=>{
        const anual=PPTO_CONTRATOS||0;
        const real=DATA.filter(d=>d.tipo==='Comercial').reduce((s,d)=>s+(d.val||0),0);
        const pct=anual>0?(real/anual*100).toFixed(1):0;
        return`Cartera comercial ${fmtMM(real)} cubre el ${pct}% del presupuesto anual de contratos (${fmtMM(anual)}). Ppto calculado al ${MES_CORTE_NOMBRE}: ${fmtMM(anual*MES_CORTE/12)}.`;
      }
    },
    { id:'view-facturacion',  nav:'facturacion',  lab:'Facturación a la Fecha',
      charts:['cFcMensual','cFcTop'],
      kpis:()=>{
        const af=APP_DATA.analisis_fac||{};
        const ts=af.ts_ingresos||0;
        const ppto=TOTAL_PRESUP*MES_CORTE/12;
        const pct=ppto>0?(ts/ppto*100).toFixed(1):0;
        const contr=APP_DATA.panel.reduce((s,p)=>s+(p.presup_contr_ytd||0),0);
        return[
          {l:'Facturación TS YTD',v:fmtMM(ts),c:'#002D73'},
          {l:'Ppto Área a la Fecha',v:fmtMM(ppto),c:'#33448D'},
          {l:'% vs Ppto',v:pct+'%',c:pct>=100?'#00832F':pct>=85?'#28D2C3':'#FFC000'},
          {l:'F. Contratos YTD',v:fmtMM(contr),c:'#28D2C3'},
        ];
      },
      txt:()=>{
        const ts=(APP_DATA.analisis_fac||{}).ts_ingresos||0;
        const ppto=TOTAL_PRESUP*MES_CORTE/12;
        const pct=ppto>0?(ts/ppto*100).toFixed(1):0;
        return`Facturación Servicio Técnico ${fmtMM(ts)} YTD Ene–${MES_CORTE_NOMBRE}. Representa ${pct}% del presupuesto total del área a la fecha (${fmtMM(ppto)}).`;
      }
    },
    { id:'view-panelfact',    nav:'panelfact',    lab:'Panel Facturación Cliente',
      charts:['cPfBar','cPfDist'],
      kpis:()=>{
        const af=APP_DATA.analisis_fac||{};
        const real=af.ts_ingresos>0?af.ts_ingresos:APP_DATA.panel.reduce((s,p)=>s+(p.real_ytd||0),0);
        const ppto=TOTAL_PRESUP*MES_CORTE/12;
        const cump=ppto>0?(real/ppto*100).toFixed(1):0;
        const conCont=APP_DATA.panel.filter(p=>p.tiene_contrato).length;
        return[
          {l:'Clientes en Panel',v:APP_DATA.panel.length,c:'#002D73'},
          {l:'Con Contrato',v:conCont,c:'#00832F'},
          {l:'Facturación Real',v:fmtMM(real),c:'#33448D'},
          {l:'% Cumplim. Ppto',v:cump+'%',c:cump>=100?'#00832F':cump>=80?'#28D2C3':'#FFC000'},
        ];
      },
      txt:()=>{
        const n=APP_DATA.panel.length;
        const c=APP_DATA.panel.filter(p=>p.tiene_contrato).length;
        return`Panel de ${n} clientes · ${c} con contrato activo (${(c/n*100).toFixed(0)}%). Distribución de cumplimiento: % vs presupuesto contratos YTD por cliente.`;
      }
    },
    { id:'view-base',         nav:'base',         lab:'Base Instalada de Equipos',
      charts:['cBIRegion','cBITipos'],
      kpis:()=>{
        const bi=APP_DATA.base_instalada||{};
        const tot=bi.total||0;
        const cli=(bi.clientes||[]).length;
        const lin=Object.keys(bi.por_linea||{}).length;
        const tip=(bi.por_tipo||[]).length;
        return[
          {l:'Total Equipos',v:tot.toLocaleString('es-CL'),c:'#002D73'},
          {l:'Clientes BI',v:cli,c:'#33448D'},
          {l:'Líneas de Negocio',v:lin,c:'#28D2C3'},
          {l:'Tipos de Equipo',v:tip,c:'#D46000'},
        ];
      },
      txt:()=>{
        const bi=APP_DATA.base_instalada||{};
        const tot=bi.total||0;
        const pl=bi.por_linea||{};
        const top=Object.entries(pl).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k}: ${v.toLocaleString('es-CL')}`).join(', ');
        return`${tot.toLocaleString('es-CL')} equipos activos en servicio. Principales líneas: ${top}.`;
      }
    },
    { id:'view-satisfaccion', nav:'satisfaccion', lab:'Satisfacción Clientes',
      charts:['cSatNps','cSatBITramos'],
      kpis:()=>{
        const s=APP_DATA.satisf||{};
        const nps=s.nps||{};
        const gl=s.global||{};
        return[
          {l:'NPS',v:(nps.nps||0)>0?'+'+(nps.nps||0):(nps.nps||0),c:(nps.nps||0)>=50?'#00832F':(nps.nps||0)>=0?'#FFC000':'#C00000'},
          {l:'Calidad Prom.',v:(gl.calidad_avg||0).toFixed(2),c:'#33448D'},
          {l:'Tiempo Prom.',v:(gl.tiempo_avg||0).toFixed(2),c:'#33448D'},
          {l:'Recom. Prom.',v:(gl.recom_avg||0).toFixed(2),c:(gl.recom_avg||0)>=7?'#00832F':(gl.recom_avg||0)>=4?'#FFC000':'#C00000'},
        ];
      },
      txt:()=>{
        const s=APP_DATA.satisf||{};
        const nps=s.nps||{};
        const gl=s.global||{};
        const det=(s.comentarios||[]).filter(c=>+(c.recom||0)<7).length;
        return`NPS ${(nps.nps||0)>0?'+'+(nps.nps||0):(nps.nps||0)} · Promotores: ${nps.pro||0} · Pasivos: ${nps.pas||0} · Detractores: ${nps.det||0}. Recomendación promedio: ${(gl.recom_avg||0).toFixed(2)}/10. ${det} clientes detractores identificados.`;
      }
    },
    { id:'view-visitas',      nav:'visitas',      lab:'Visitas Ejecutivos',
      charts:['cVisExecMes','cVisTipo'],
      kpis:()=>{
        const v=APP_DATA.visitas||{};
        const res=v.resumen||{};
        const eg=res['Eglys Ramirez']||{};
        const cr=res['Cristian Perez']||{};
        const tot=(eg.tot_2026_ytd||0)+(cr.tot_2026_ytd||0);
        return[
          {l:'Visitas YTD Total',v:tot,c:'#002D73'},
          {l:'Eglys Ramírez',v:eg.tot_2026_ytd||0,c:'#7A1FAA'},
          {l:'Cristián Pérez',v:cr.tot_2026_ytd||0,c:'#002D73'},
          {l:'Clientes Únicos',v:(eg.clientes_unicos_2026||0)+(cr.clientes_unicos_2026||0),c:'#28D2C3'},
        ];
      },
      txt:()=>{
        const v=APP_DATA.visitas||{};
        const r=v.resumen||{};
        const eg=r['Eglys Ramirez']||{};
        const cr=r['Cristian Perez']||{};
        const tot=(eg.tot_2026_ytd||0)+(cr.tot_2026_ytd||0);
        return`${tot} visitas de terreno YTD Ene–${MES_CORTE_NOMBRE}. Eglys Ramírez: ${eg.tot_2026_ytd||0} visitas · Cristián Pérez: ${cr.tot_2026_ytd||0} visitas.`;
      }
    },
    { id:'view-matriz',       nav:'matriz',       lab:'Matriz BI · Contratos y Potencial',
      charts:['cSatBIScatter','cRsFacTop'],
      kpis:()=>{
        const bi=APP_DATA.base_instalada||{};
        const tot=bi.total||0;
        const conContr=DATA.length;
        const cli=(bi.clientes||[]).length;
        const pct=cli>0?((bi.clientes||[]).filter(()=>true).length/cli*100).toFixed(0):0;
        return[
          {l:'Equipos BI',v:tot.toLocaleString('es-CL'),c:'#002D73'},
          {l:'Contratos Activos',v:conContr,c:'#33448D'},
          {l:'Clientes Panel',v:APP_DATA.panel.length,c:'#28D2C3'},
          {l:'Top Facturación',v:fmtMM(Math.max(...APP_DATA.panel.map(p=>p.real_ytd||0))),c:'#00832F'},
        ];
      },
      txt:()=>`Matriz de posicionamiento: base instalada vs facturación vs contratos activos. Identifica potencial de crecimiento por cliente.`
    },
  ];

  // ─── Overlay progreso ────────────────────────────────────────────────────────
  const ov = document.createElement('div');
  ov.id = '_pdf_ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,45,115,.95);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;font-family:Roboto,sans-serif';
  ov.innerHTML = `<div style="font-family:'Roboto Condensed',sans-serif;font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:.07em">GENERANDO REPORTE PDF</div>
    <div id="_ppl" style="font-size:.76rem;color:rgba(255,255,255,.6);min-height:1.2em">Preparando...</div>
    <div style="width:340px;height:7px;background:rgba(255,255,255,.14);border-radius:4px;overflow:hidden">
      <div id="_ppb" style="height:100%;width:0%;background:#28D2C3;border-radius:4px;transition:width .4s"></div>
    </div>
    <div style="font-size:.58rem;color:rgba(255,255,255,.3);font-family:'Roboto Mono',monospace">Informe estructurado con gráficos seleccionados · ~30 segundos</div>`;
  document.body.appendChild(ov);
  const setP = (pct, msg) => {
    const b = document.getElementById('_ppb'), l = document.getElementById('_ppl');
    if (b) b.style.width = pct + '%'; if (l) l.textContent = msg;
  };
  await new Promise(r => setTimeout(r, 80));

  // ─── Guardar estado ──────────────────────────────────────────────────────────
  const prevView = document.querySelector('.view.on');
  const prevBtn  = document.querySelector('.nb.on');

  // ─── Configuración jsPDF (A4 horizontal) ────────────────────────────────────
  const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210, HDR = 14;
  let first = true;

  // Cabecera de página
  const drawHdr = (label, pg, tot) => {
    pdf.setFillColor(0, 45, 115); pdf.rect(0, 0, PW, HDR, 'F');
    pdf.setFillColor(40, 210, 195); pdf.rect(0, 0, 4, HDR, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
    pdf.text('TECSERVICE', 8, 5.5);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5);
    pdf.text('Panel de Contratos 2026  ·  CONFIDENCIAL', 8, 11);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
    pdf.text(label, PW / 2, 9, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5);
    pdf.setTextColor(160, 215, 222);
    const d = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    pdf.text(d + (tot > 1 ? `  ·  ${pg + 1}/${tot}` : ''), PW - 4, 9, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
  };

  // ─── Contenedor de informe (oculto, ancho fijo para html2canvas) ─────────────
  const rpt = document.createElement('div');
  rpt.id = '_pdf_rpt';
  rpt.style.cssText = 'position:fixed;top:-9999px;left:0;width:1260px;background:#fff;font-family:Roboto,sans-serif;overflow:hidden';
  document.body.appendChild(rpt);

  // ─── Función: capturar un canvas por su id → base64 ─────────────────────────
  const chartImg = (id) => {
    try {
      const c = document.getElementById(id);
      return c ? (hdChartImg(c) || c.toDataURL('image/png')) : null;
    } catch (e) { return null; }
  };

  // ─── Función: construir página del informe y capturarla ──────────────────────
  async function buildPage(sec) {
    const kpis   = sec.kpis();
    const txt    = sec.txt();
    const img1   = chartImg(sec.charts[0]);
    const img2   = sec.charts[1] ? chartImg(sec.charts[1]) : null;

    // ── Layout: KPIs | Gráfico1 ── Gráfico2 | Resumen ──────────────────────────
    const kpiHtml = kpis.map(k => `
      <div style="background:#F2F4FA;border-radius:6px;padding:.6rem .8rem;border-top:3px solid ${k.c};flex:1;min-width:0">
        <div style="font-size:.55rem;text-transform:uppercase;letter-spacing:.07em;color:#6B7BA8;margin-bottom:.35rem">${k.l}</div>
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.35rem;color:${k.c};line-height:1">${k.v}</div>
      </div>`).join('');

    const chartsHtml = [img1, img2].filter(Boolean).map(img =>
      `<img src="${img}" style="flex:1;min-width:0;max-width:${img2 ? '50%' : '100%'};height:260px;object-fit:contain;background:#F2F4FA;border-radius:6px;border:1px solid #E2E6F0">`
    ).join('');

    rpt.innerHTML = `
      <div style="padding:16px 20px;background:#fff;min-height:820px">
        <!-- KPIs row -->
        <div style="display:flex;gap:10px;margin-bottom:14px">${kpiHtml}</div>
        <!-- Charts row -->
        <div style="display:flex;gap:10px;margin-bottom:12px;height:260px;align-items:stretch">${chartsHtml || '<div style="flex:1;background:#F2F4FA;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#B8C1D8;font-size:.8rem">Sin gráfico disponible</div>'}</div>
        <!-- Resumen texto -->
        <div style="padding:.9rem 1.1rem;background:#EEF2FF;border-left:4px solid #002D73;border-radius:4px;font-size:.72rem;color:#020306;line-height:1.65">${txt}</div>
      </div>`;

    await new Promise(r => setTimeout(r, 80));

    const cv = await html2canvas(rpt, {
      scale: hdEscala(1260, Math.max(rpt.scrollHeight + 50, 860)),
      useCORS: true, allowTaint: true, logging: false,
      backgroundColor: '#fff', windowWidth: 1260,
      windowHeight: Math.max(rpt.scrollHeight + 50, 860),
    });
    return cv;
  }

  // ─── Mapa de inicialización (igual que sv()) ─────────────────────────────────
  const INITS = {
    tipos: window.initTipos, nuevos: window.initNuevos, vencimientos: window.initVenc,
    vision: window.initVision, presupuesto: window.initPresupuesto,
    facturacion: window.initFacturacion, panelfact: window.initPanelFact,
    base: window.initBaseInstalada, satisfaccion: window.initSatisfaccion,
    visitas: window.initVisitas,
  };

  // ─── Generar páginas ─────────────────────────────────────────────────────────
  for (let i = 0; i < SECS.length; i++) {
    const sec = SECS[i];
    const el  = document.getElementById(sec.id);
    if (!el) continue;

    setP(Math.round(5 + i / SECS.length * 85), `(${i + 1}/${SECS.length}) ${sec.lab}…`);

    // Activar vista e inicializar si es necesario
    document.querySelectorAll('.view').forEach(x => x.classList.remove('on'));
    el.classList.add('on');
    const fn = INITS[sec.nav];
    if (fn && !window['_i_' + sec.nav]) { try { fn(); } catch (e) {} window['_i_' + sec.nav] = true; }
    if (sec.nav === 'vencimientos' && typeof renderHz  === 'function') try { renderHz();  } catch(e) {}
    if (sec.nav === 'vision'       && typeof renderVG  === 'function') try { renderVG();  } catch(e) {}
    if (sec.nav === 'nuevos'       && typeof renderNC  === 'function') try { renderNC();  } catch(e) {}
    if (sec.nav === 'facturacion'  && typeof renderFcGraficos === 'function')
      setTimeout(() => { try { renderFcGraficos(); } catch(e) {} }, 60);

    await new Promise(r => setTimeout(r, 700)); // dejar que se pinten los charts

    try {
      const cv = await buildPage(sec);
      // informe de ~10 páginas: se fuerza JPEG de alta calidad, con PNG el
      // archivo completo se vuelve inmanejable para enviar por correo
      const imgData = hdImagen(cv, true).data;
      const rawH    = cv.height * PW / cv.width;
      const avail   = PH - HDR;

      if (!first) pdf.addPage(); first = false;

      if (rawH <= avail * 1.05) {
        drawHdr(sec.lab, 0, 1);
        pdf.addImage(imgData, 'JPEG', 0, HDR, PW, Math.min(rawH, avail), '', 'FAST');
      } else {
        const pxPerPg = Math.ceil(cv.width / PW * avail);
        const pages   = Math.ceil(cv.height / pxPerPg);
        for (let pg = 0; pg < pages; pg++) {
          const sy = pg * pxPerPg;
          const sh = Math.min(pxPerPg, cv.height - sy);
          const sl = document.createElement('canvas');
          sl.width = cv.width; sl.height = sh;
          sl.getContext('2d').drawImage(cv, 0, sy, cv.width, sh, 0, 0, cv.width, sh);
          if (pg > 0) pdf.addPage();
          drawHdr(sec.lab, pg, pages);
          pdf.addImage(hdImagen(sl, true).data, 'JPEG', 0, HDR, PW, sh * PW / cv.width, '', 'FAST');
        }
      }
    } catch (err) {
      console.warn('PDF error en', sec.id, err);
      if (!first) pdf.addPage(); first = false;
      drawHdr(sec.lab, 0, 1);
      pdf.setFontSize(9); pdf.setTextColor(160, 0, 0);
      pdf.text('No se pudo generar esta sección.', PW / 2, PH / 2, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
    }
  }

  // ─── Restaurar estado ─────────────────────────────────────────────────────────
  setP(96, 'Finalizando PDF…');
  await new Promise(r => setTimeout(r, 250));
  document.body.removeChild(rpt);
  document.querySelectorAll('.view').forEach(x => x.classList.remove('on'));
  if (prevView) prevView.classList.add('on');
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
  if (prevBtn) prevBtn.classList.add('on');

  setP(100, 'Guardando PDF…');
  await new Promise(r => setTimeout(r, 300));
  document.body.removeChild(ov);

  const fecha = new Date()
    .toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace(/\//g, '-');
  pdf.save(`TECSERVICE_Panel_Contratos_2026_${fecha}.pdf`);
}
