// ═══════════════════════════════════════════════════════════════
// hoja_vencimientos.js — Vencimientos de Contratos
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════

let hzDays=90, hzChart=null, hzSrch='', hzTip='todos', hzRelF='todos';

function initVenc(){
  document.getElementById('hz-sl').addEventListener('input',e=>{hzDays=+e.target.value;document.getElementById('hz-lv').textContent=hzDays+'d';document.getElementById('hz-badge').textContent=hzDays+'d';document.getElementById('hz-tag').textContent='Horizonte: '+hzDays+' días';renderHz();});
  document.getElementById('hz-srch').oninput=e=>{hzSrch=e.target.value.toLowerCase();renderHz();};
  document.querySelectorAll('#hz-tip .btn').forEach(b=>{b.addEventListener('click',()=>{hzTip=b.dataset.ht;document.querySelectorAll('#hz-tip .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderHz();});});
  document.querySelectorAll('#hz-rel .btn').forEach(b=>{b.addEventListener('click',()=>{hzRelF=b.dataset.hr;document.querySelectorAll('#hz-rel .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderHz();});});
  renderSemaforo();
  renderHz();
}

function setHz(d,btn){hzDays=d;document.getElementById('hz-sl').value=Math.min(d,730);document.getElementById('hz-lv').textContent=d>=9999?'Todos':d+'d';document.getElementById('hz-badge').textContent=d>=9999?'Todos':d+'d';document.querySelectorAll('.hbtn').forEach(b=>{b.classList.remove('on');b.style.cssText='';});btn.classList.add('on');renderHz();}

function renderHz(){
  const data=DATA.filter(d=>{
    const dOk=hzDays>=9999?true:d.dias_vence<=hzDays;
    const tOk=hzTip==='todos'||d.tipo===hzTip;
    const rOk=hzRelF==='todos'||(d.estado_relacion||'N/D')===hzRelF;
    const sOk=!hzSrch||d.cliente.toLowerCase().includes(hzSrch)||d.coord.toLowerCase().includes(hzSrch);
    return dOk&&tOk&&rOk&&sOk;
  }).sort((a,b)=>a.dias_vence-b.dias_vence);
  const totalHzVal=data.reduce((s,d)=>s+d.val,0);
  // Cartera en riesgo: sólo contratos Comerciales. Las garantías no son
  // ingreso a renovar, y mezclarlas descuadraba el KPI con el total del pie.
  const totalHzCom=data.filter(d=>d.tipo==='Comercial').reduce((s,d)=>s+d.val,0);

  document.getElementById('hk1').textContent=data.length;
  document.getElementById('hk2').textContent=new Set(data.map(d=>d.cliente)).size;
  document.getElementById('hk3').textContent=mm(totalHzCom);
  document.getElementById('hk4').textContent=data.filter(d=>d.tipo==='Comercial').length;
  document.getElementById('hk5').textContent=data.filter(d=>d.tipo==='Garantia').length;

  document.getElementById('tb-hz').innerHTML=data.map(d=>{
    const rel=d.estado_relacion||'N/D';
    const relCol={Nuevo:'#28d2c3',Renovado:'#FFC000',Perdido:'#FF6B6B'}[rel]||'#999';
    const relIco={Nuevo:'🆕',Renovado:'🔄',Perdido:'📉'}[rel]||'—';
    return`<tr>
    <td class="num">${d.n}</td>
    <td style="font-size:.67rem">${shortN(d.cliente)}</td>
    <td><span style="background:${relCol};color:#fff;padding:.12rem .35rem;border-radius:3px;font-size:.55rem;font-weight:700;white-space:nowrap">${relIco} ${rel}</span></td>
    <td style="font-size:.62rem;color:var(--mut)">${shortC(d.coord)}</td>
    <td style="font-size:.62rem;color:var(--mut)">${d.vendedor||'—'}</td>
    <td>${tipoBadge(d.tipo)}</td>
    <td style="text-align:center">${_progBadge(d.programa||'')}</td>
    <td style="font-size:.67rem">${d.fin_fmt}</td>
    <td>${urgP(d.dias_vence)}</td>
    <td class="num" style="color:${d.val>0?'var(--az2)':'var(--mut)'}">${d.val>0?mm(d.val):'—'}</td>
    <td class="num" style="color:var(--mut)">${pctOf(d.val,totalHzVal)}</td>
    <td style="min-width:75px">${pbarHTML(d.pct_consumido,urgC(d.dias_vence))}<span style="font-size:.6rem;color:var(--mut)">${d.pct_consumido}%</span></td>
  </tr>`;}).join('')||`<tr><td colspan="12" style="text-align:center;padding:2rem;color:var(--mut)">Sin contratos en este horizonte</td></tr>`;

  document.getElementById('hz-ft').textContent=`${data.length} contratos · ${data.filter(d=>d.tipo==='Comercial').length} Comercial · ${data.filter(d=>d.tipo==='Garantia').length} Garantía`;
  document.getElementById('hz-tot').textContent=mm(data.filter(d=>d.tipo==='Comercial').reduce((s,d)=>s+d.val,0))+' Comercial en riesgo';

  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const buckets={};
  data.forEach(d=>{
    let label;
    if(d.dias_vence<0)label='Vencido';
    else{
      const f=new Date(d.fin);
      label=MESES[f.getMonth()]+' '+String(f.getFullYear()).slice(-2);
    }
    buckets[label]=(buckets[label]||{com:0,gar:0,sortKey:label==='Vencido'?-1:(new Date(d.fin)).getTime()});
    if(d.tipo==='Comercial')buckets[label].com+=d.val/1e6;
    else buckets[label].gar+=d.val/1e6;
  });
  const bkeys=Object.keys(buckets).sort((a,b)=>buckets[a].sortKey-buckets[b].sortKey);

  if(hzChart)hzChart.destroy();
  hzChart=new Chart(document.getElementById('cHzBar').getContext('2d'),{
    type:'bar',
    data:{labels:bkeys,datasets:[
      {label:'Comercial (MM$)',data:bkeys.map(k=>buckets[k].com),backgroundColor:C.az2,borderRadius:4,stack:'s',borderSkipped:false},
      {label:'Garantía',data:bkeys.map(k=>buckets[k].gar),backgroundColor:C.te,borderRadius:4,stack:'s',borderSkipped:false}
    ]},
    options:{responsive:true,plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}},tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${fN1(c.raw)}`}}},
      scales:{y:{stacked:true,grid:{color:'#E2E6F0'},ticks:{callback:v=>'MM$'+fN0(v)}},x:{stacked:true,grid:{display:false},ticks:{font:{size:9}}}}}
  });
}
function hzSort(f){renderHz();}

// ═══════════════════════════════════════════════════════════════
// EXPORTAR PDF — 4 hojas: 30d, 90d, 1 año y detalle de Perdidos.
// Cada página se arma aparte, se mide y se agrega al PDF con su propio
// tamaño, igual que el exportable del EERR: así ninguna tabla se achica.
// El contenido no depende de los filtros de pantalla: siempre va completo.
// ═══════════════════════════════════════════════════════════════
const _VP_ICON = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF';

function _vpEsc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function _vpMM(v){return 'MM$'+((v||0)/1e6).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});}
const _VP_REL={Nuevo:'#0A7D74',Renovado:'#B8860B',Perdido:'#C00000'};
function _vpUrg(d){return d<0?'#7A0000':d<=30?'#C00000':d<=60?'#D46000':d<=90?'#8B8200':'#00832F';}

function _vpPagina(titulo, subtitulo, filas, opt){
  opt = opt || {};
  const com = filas.filter(d=>d.tipo==='Comercial');
  const gar = filas.filter(d=>d.tipo==='Garantia');
  const valCom = com.reduce((s,d)=>s+d.val,0);
  const valGar = gar.reduce((s,d)=>s+d.val,0);

  const kpi=(lbl,val,sub,col)=>
    '<div style="flex:1;min-width:105px;background:#F4F6FB;border-top:3px solid '+col+
    ';border-radius:5px;padding:7px 10px">'+
    '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#6B7BA8">'+lbl+'</div>'+
    '<div style="font-size:19px;font-weight:900;color:'+col+';line-height:1.1">'+val+'</div>'+
    '<div style="font-size:8px;color:#8892a8;margin-top:1px">'+sub+'</div></div>';

  const kpis =
    kpi('Contratos', filas.length, new Set(filas.map(d=>d.cliente)).size+' clientes', '#002D73')+
    kpi('Comercial en riesgo', _vpMM(valCom), com.length+' contratos', '#C00000')+
    kpi('Garantía', _vpMM(valGar), gar.length+' contratos', '#0A7D74')+
    kpi('Vencidos', filas.filter(d=>d.dias_vence<0).length, 'a la fecha de corte', '#7A0000')+
    kpi('Vencen ≤30d', filas.filter(d=>d.dias_vence>=0&&d.dias_vence<=30).length, 'acción inmediata', '#D46000');

  // Resumen por mes de vencimiento, en texto: imprime mejor que el gráfico
  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const bk={};
  filas.forEach(d=>{
    let lbl,ord;
    if(d.dias_vence<0){lbl='Vencido';ord=-1;}
    else{const f=new Date(d.fin);lbl=MESES[f.getMonth()]+' '+String(f.getFullYear()).slice(-2);ord=f.getTime();}
    if(!bk[lbl])bk[lbl]={n:0,com:0,gar:0,ord:ord};
    bk[lbl].n++; if(d.tipo==='Comercial')bk[lbl].com+=d.val; else bk[lbl].gar+=d.val;
  });
  const bkeys=Object.keys(bk).sort((a,b)=>bk[a].ord-bk[b].ord);
  const mesHTML = bkeys.length ?
    '<table style="border-collapse:collapse;width:100%;margin-bottom:10px">'+
    '<thead><tr>'+['MES DE VENCIMIENTO','N°','COMERCIAL','GARANTÍA','TOTAL'].map((t,i)=>
      '<th style="background:#002D73;color:#fff;font-size:7.5px;padding:3px 6px;text-align:'+
      (i?'right':'left')+';letter-spacing:.04em">'+t+'</th>').join('')+'</tr></thead><tbody>'+
    bkeys.map((k,i)=>'<tr style="background:'+(i%2?'#fff':'#F7F9FC')+'">'+
      '<td style="font-size:8px;padding:2px 6px;border-bottom:1px solid #E6EAF2;font-weight:'+(k==='Vencido'?700:400)+
      ';color:'+(k==='Vencido'?'#C00000':'#111')+'">'+k+'</td>'+
      '<td style="font-size:8px;padding:2px 6px;text-align:right;border-bottom:1px solid #E6EAF2">'+bk[k].n+'</td>'+
      '<td style="font-size:8px;padding:2px 6px;text-align:right;border-bottom:1px solid #E6EAF2">'+_vpMM(bk[k].com)+'</td>'+
      '<td style="font-size:8px;padding:2px 6px;text-align:right;border-bottom:1px solid #E6EAF2;color:#0A7D74">'+_vpMM(bk[k].gar)+'</td>'+
      '<td style="font-size:8px;padding:2px 6px;text-align:right;border-bottom:1px solid #E6EAF2;font-weight:700">'+_vpMM(bk[k].com+bk[k].gar)+'</td>'+
      '</tr>').join('')+
    '<tr style="background:#EDF1F8;font-weight:800"><td style="font-size:8px;padding:3px 6px">TOTAL</td>'+
      '<td style="font-size:8px;padding:3px 6px;text-align:right">'+filas.length+'</td>'+
      '<td style="font-size:8px;padding:3px 6px;text-align:right">'+_vpMM(valCom)+'</td>'+
      '<td style="font-size:8px;padding:3px 6px;text-align:right;color:#0A7D74">'+_vpMM(valGar)+'</td>'+
      '<td style="font-size:8px;padding:3px 6px;text-align:right">'+_vpMM(valCom+valGar)+'</td></tr>'+
    '</tbody></table>' : '';

  const COLS=['#','CLIENTE','ESTADO REL.','COORDINADORA','VENDEDOR TÉC.','TIPO','PROGRAMA',
              'INICIO','VENCE','DÍAS','MM$ ANUAL','% S/TOTAL','% CONSUM.'];
  const der=[0,9,10,11,12];
  const detHTML = filas.length ?
    '<table style="border-collapse:collapse;width:100%">'+
    '<thead><tr>'+COLS.map((t,i)=>
      '<th style="background:#002D73;color:#fff;font-size:7px;padding:3px 5px;text-align:'+
      (der.indexOf(i)>=0?'right':'left')+';letter-spacing:.03em;white-space:nowrap">'+t+'</th>').join('')+
    '</tr></thead><tbody>'+
    filas.map((d,i)=>{
      const rel=d.estado_relacion||'N/D';
      const bd='border-bottom:1px solid #E6EAF2;padding:2px 5px;font-size:7.5px;white-space:nowrap';
      return '<tr style="background:'+(i%2?'#fff':'#F7F9FC')+'">'+
        '<td style="'+bd+';text-align:right;color:#8892a8">'+d.n+'</td>'+
        '<td style="'+bd+';font-weight:600">'+_vpEsc(d.cliente)+'</td>'+
        '<td style="'+bd+';color:'+(_VP_REL[rel]||'#666')+';font-weight:700">'+rel+'</td>'+
        '<td style="'+bd+';color:#555">'+_vpEsc(d.coord)+'</td>'+
        '<td style="'+bd+';color:#555">'+_vpEsc(d.vendedor||'—')+'</td>'+
        '<td style="'+bd+'">'+(d.tipo==='Garantia'?'Garantía':'Comercial')+'</td>'+
        '<td style="'+bd+';color:#555">'+_vpEsc(d.programa||'—')+'</td>'+
        '<td style="'+bd+';color:#555">'+_vpEsc(d.inicio_fmt||'—')+'</td>'+
        '<td style="'+bd+'">'+_vpEsc(d.fin_fmt)+'</td>'+
        '<td style="'+bd+';text-align:right;font-weight:700;color:'+_vpUrg(d.dias_vence)+'">'+
          (d.dias_vence<0?'vencido '+Math.abs(d.dias_vence):d.dias_vence)+'</td>'+
        '<td style="'+bd+';text-align:right;font-weight:600">'+(d.val>0?_vpMM(d.val):'—')+'</td>'+
        '<td style="'+bd+';text-align:right;color:#8892a8">'+
          ((valCom+valGar)>0?(d.val/(valCom+valGar)*100).toFixed(1).replace('.',',')+'%':'—')+'</td>'+
        '<td style="'+bd+';text-align:right;color:#555">'+(d.pct_consumido||0)+'%</td></tr>';
    }).join('')+
    '<tr style="background:#002D73;color:#fff;font-weight:800">'+
      '<td colspan="10" style="font-size:8px;padding:4px 5px">TOTAL · '+filas.length+' contratos · '+
        com.length+' Comercial · '+gar.length+' Garantía</td>'+
      '<td style="font-size:8px;padding:4px 5px;text-align:right">'+_vpMM(valCom+valGar)+'</td>'+
      '<td colspan="2" style="font-size:8px;padding:4px 5px;text-align:right">100%</td></tr>'+
    '</tbody></table>' :
    '<div style="font-size:9px;color:#8892a8;padding:14px 0">Sin contratos en este horizonte.</div>';

  const secLbl=t=>'<div style="font-size:9px;font-weight:700;color:#002D73;text-transform:uppercase;'+
                  'letter-spacing:.06em;margin:0 0 4px">'+t+'</div>';

  return '<div style="border-bottom:2.5px solid #002D73;padding-bottom:6px;margin-bottom:10px">'+
      '<span style="font-size:13px;font-weight:700;color:#002D73">TECSERVICE — Control de Vencimientos</span>'+
      '&emsp;<span style="font-size:11px;font-weight:700;color:#C00000">'+titulo+'</span>'+
      '&emsp;<span style="font-size:10px;color:#555">'+subtitulo+'</span>'+
    '</div>'+
    '<div style="display:flex;gap:8px;margin-bottom:11px">'+kpis+'</div>'+
    (opt.sinMes?'':secLbl('Distribución por mes de vencimiento')+mesHTML)+
    secLbl(opt.tituloTabla||'Detalle de contratos')+detHTML+
    (opt.nota?'<div style="font-size:7.5px;color:#8892a8;margin-top:6px;line-height:1.5">'+opt.nota+'</div>':'');
}

async function vencExportPDF(){
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('hz-pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  const hoy = (window.APP_DATA || {}).hoy || '';
  const enHz = h => DATA.filter(d=>d.dias_vence<=h).sort((a,b)=>a.dias_vence-b.dias_vence);
  const perdidos = DATA.filter(d=>(d.estado_relacion||'')==='Perdido')
                       .sort((a,b)=>b.val-a.val);

  const paginas = [
    { t:'Horizonte 30 días',  s:'Contratos que vencen dentro de los próximos 30 días'+(hoy?' · Datos al '+hoy:''),
      f:enHz(30) },
    { t:'Horizonte 90 días',  s:'Contratos que vencen dentro de los próximos 90 días'+(hoy?' · Datos al '+hoy:''),
      f:enHz(90) },
    { t:'Horizonte 1 año',    s:'Contratos que vencen dentro de los próximos 365 días'+(hoy?' · Datos al '+hoy:''),
      f:enHz(365) },
    { t:'Contratos Perdidos', s:'Relaciones terminadas: el cliente no renovó'+(hoy?' · Datos al '+hoy:''),
      f:perdidos, o:{ tituloTabla:'Detalle de contratos perdidos',
        nota:'«Perdido» marca al cliente cuya relación contractual terminó y no fue renovada. '+
             'El monto anual es el valor del último contrato vigente y representa la facturación '+
             'recurrente que ya no se percibe.' } },
  ];

  let pdf = null, wrap = null;
  try {
    const { jsPDF } = window.jspdf;
    const MM_PX = 25.4 / 96;

    for (let i = 0; i < paginas.length; i++) {
      const p = paginas[i];
      wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1320px;'+
        'padding:16px 22px 20px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';
      wrap.innerHTML = _vpPagina(p.t, p.s, p.f, p.o);
      document.body.appendChild(wrap);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const realW = Math.ceil(wrap.getBoundingClientRect().width)  || wrap.offsetWidth;
      const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
      if (!realW || !realH) throw new Error('No se pudo medir la página '+(i+1));

      const canvas = await html2canvas(wrap, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        width: realW, height: realH, windowWidth: realW, windowHeight: realH,
      });
      wrap.parentNode.removeChild(wrap); wrap = null;

      const pageW = realW * MM_PX, pageH = realH * MM_PX;
      const orient = pageW >= pageH ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'mm', format: [pageW, pageH] });
      else      pdf.addPage([pageW, pageH], orient);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageW, pageH);
    }

    pdf.save('Vencimientos_Contratos_TS_' + (hoy || '').replace(/[\s/]+/g, '-') + '.pdf');
  } catch (err) {
    console.error('vencExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = _VP_ICON; }
  }
}

function renderSemaforo(){
  const bins=[
    {ns:'sn1',vs:'sv1',t:d=>d.dias_vence<0},
    {ns:'sn2',vs:'sv2',t:d=>d.dias_vence>=0&&d.dias_vence<=30},
    {ns:'sn3',vs:'sv3',t:d=>d.dias_vence>30&&d.dias_vence<=60},
    {ns:'sn4',vs:'sv4',t:d=>d.dias_vence>60&&d.dias_vence<=90},
    {ns:'sn5',vs:'sv5',t:d=>d.dias_vence>90&&d.dias_vence<=180},
    {ns:'sn6',vs:'sv6',t:d=>d.dias_vence>180},
  ];
  bins.forEach(b=>{
    const sub=DATA.filter(b.t);
    const com=sub.filter(d=>d.tipo==='Comercial');
    const gar=sub.filter(d=>d.tipo==='Garantia');
    document.getElementById(b.ns).textContent=sub.length;
    document.getElementById(b.vs).textContent=`COM:${com.length} GAR:${gar.length}`;
  });
}
