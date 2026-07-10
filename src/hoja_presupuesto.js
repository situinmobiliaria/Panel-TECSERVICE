// ═══════════════════════════════════════════════════════════════
// hoja_presupuesto.js — Cumplimiento Presupuesto + PDF
// Depende de: datos.js, utils.js
// ═══════════════════════════════════════════════════════════════

function showPdfDialog(){document.getElementById('pdf-overlay').style.display='flex';}

let ppFiltTipo='todos', ppFiltEstado='todos', ppSrch='';

function ppEstadoBadge(pct){
  if(pct>=100)return`<span class="ppto-semaforo ps-verde">✓ En Meta</span>`;
  if(pct>=90)return`<span class="ppto-semaforo ps-azul">~ Cerca</span>`;
  if(pct>=60)return`<span class="ppto-semaforo ps-amarillo">⚠ Parcial</span>`;
  return`<span class="ppto-semaforo ps-rojo">✗ Bajo</span>`;
}
function ppColor(pct){
  if(pct>=100)return C.gn;
  if(pct>=90)return C.az2;
  if(pct>=60)return C.am;
  return C.rd;
}
function ppEstadoKey(pct){
  if(pct>=100)return'sobre';
  if(pct>=90)return'cerca';
  return'bajo';
}

function renderPresupuesto(){
  const totalCom=TOTAL_CARTERA_VAL;
  const pctGlobal=(totalCom/PPTO_CONTRATOS*100);
  const brecha=Math.max(0,PPTO_CONTRATOS-totalCom);

  document.getElementById('pp-k1').textContent=mm(PPTO_CONTRATOS);
  const ppArea=document.getElementById('pp-k-area');if(ppArea)ppArea.textContent=mm(TOTAL_PRESUP);
  const ppTag=document.getElementById('pp-sh-tag');if(ppTag)ppTag.textContent='50% del presupuesto área ('+mm(TOTAL_PRESUP)+') asignado a contratos · Seguimiento por coordinadora y contrato';
  const k2=document.getElementById('pp-k2');
  k2.textContent=mm(totalCom);
  k2.style.color=pctGlobal>=100?C.gn:C.am;
  const k3=document.getElementById('pp-k3');
  k3.textContent=brecha>0?mm(brecha):'✓ Superado';
  k3.style.color=brecha>0?C.rd:C.gn;

  const barFill=document.getElementById('pp-bar-fill');
  const barPct=Math.min(pctGlobal,100);
  const barColor=pctGlobal>=100?'linear-gradient(90deg,#004f25,'+C.gn+')':'linear-gradient(90deg,#c88000,'+C.am+')';
  barFill.style.width=barPct+'%';
  barFill.style.background=barColor;
  barFill.textContent=pctGlobal.toFixed(1)+'%';
  document.getElementById('pp-bar-pct').textContent=pctGlobal.toFixed(1)+'%';
  document.getElementById('pp-bar-pct').style.color=pctGlobal>=100?C.gn:C.am;

  const badge=document.getElementById('pp-estado-badge');
  if(pctGlobal>=100){badge.textContent='✓ Meta Alcanzada';badge.style.color=C.gn;}
  else{badge.textContent='⚠ Progreso ('+pctGlobal.toFixed(1)+'%)';badge.style.color=C.am;}

  document.getElementById('pp-nota').innerHTML=
    `Presupuesto contratos: <strong style="color:var(--teal)">50%</strong> × ${mm(TOTAL_PRESUP)} = <strong style="color:var(--teal)">${mm(PPTO_CONTRATOS)}</strong>.
     Cartera real (COM+GAR): <strong style="color:rgba(255,255,255,.85)">${mm(totalCom)}</strong>
     (${pctGlobal.toFixed(1)}% del presupuesto de contratos · ${(totalCom/TOTAL_PRESUP*100).toFixed(1)}% del presupuesto área total).
     El presupuesto individual por contrato se calcula como: <strong style="color:var(--teal)">(valor contrato / cartera total COM+GAR) × ppto. contratos</strong>.`;

  const _PP_PALETTE=[C.az3,C.az2,'#4A6CC0','#6A8CDF','#8AAEF0','#28D2C3','#FFC000'];
  const coords=[...new Set(DATA.filter(d=>d.coord&&d.coord!=='Sin asignar').map(d=>d.coord))].sort();
  const coordLabels=coords.map(c=>c.split(' ')[0]);
  const coordColors=coords.map((_,i)=>_PP_PALETTE[i%_PP_PALETTE.length]);
  const grid=document.getElementById('pp-coord-grid');
  grid.innerHTML=coords.map((coord,ci)=>{
    const cData=DATA.filter(d=>d.coord===coord);
    const cCom=cData.filter(d=>d.tipo==='Comercial');
    const cGar=cData.filter(d=>d.tipo==='Garantia');
    const cVal=cData.reduce((s,d)=>s+d.val,0);
    const cPptoInd=totalCom>0?(cVal/totalCom)*PPTO_CONTRATOS:PPTO_CONTRATOS/5;
    const cPct=cPptoInd>0?(cVal/cPptoInd*100):0;
    const cBrecha=Math.max(0,cPptoInd-cVal);
    const avgPct=cData.length?cData.reduce((s,d)=>s+d.pct_consumido,0)/cData.length:0;
    const cColor=ppColor(cPct);
    const barW=Math.min(cPct,100);
    return`<div class="ppto-coord-card">
      <div class="ppto-coord-head" style="background:${coordColors[ci]}">
        <span>${coordLabels[ci]}</span>
        ${ppEstadoBadge(cPct)}
      </div>
      <div class="ppto-coord-body">
        <div class="ppto-cbar"><div class="ppto-cbar-fill" style="width:${barW}%;background:${cColor}"></div></div>
        <div class="ppto-coord-row">Cartera COM+GAR<strong>${mm(cVal)}</strong></div>
        <div class="ppto-coord-row">Ppto. asignado<strong>${mm(cPptoInd)}</strong></div>
        <div class="ppto-coord-row">% cumplimiento<strong style="color:${cColor}">${cPct.toFixed(1)}%</strong></div>
        <div class="ppto-coord-row">Brecha<strong style="color:${cBrecha>0?C.am:C.gn}">${cBrecha>0?mm(cBrecha):'✓'}</strong></div>
        <div class="ppto-coord-row">COM / GAR<strong>${cCom.length} / ${cGar.length}</strong></div>
        <div class="ppto-coord-row">% consumido prom.<strong>${avgPct.toFixed(1)}%</strong></div>
      </div>
    </div>`;
  }).join('');

  let d=[...DATA];
  if(ppFiltTipo==='Comercial')d=d.filter(x=>x.tipo==='Comercial');
  else if(ppFiltTipo==='Garantia')d=d.filter(x=>x.tipo==='Garantia');
  if(ppSrch)d=d.filter(x=>x.cliente.toLowerCase().includes(ppSrch)||x.coord.toLowerCase().includes(ppSrch));
  d=d.map(x=>{
    const pptoCont=totalCom>0?(x.val/totalCom)*PPTO_CONTRATOS:0;
    const pctPpto=pptoCont>0?(x.val/pptoCont*100):0;
    return{...x,ppto_ind:pptoCont,pct_ppto:pctPpto};
  });
  if(ppFiltEstado!=='todos'){
    d=d.filter(x=>{
      const k=ppEstadoKey(x.pct_ppto);
      if(ppFiltEstado==='sobre')return k==='sobre';
      if(ppFiltEstado==='cerca')return k==='cerca';
      if(ppFiltEstado==='bajo')return k==='bajo';
      return true;
    });
  }
  d.sort((a,b)=>b.val-a.val);

  document.getElementById('tb-pp').innerHTML=d.length?d.map(x=>{
    const pct=(x.val/PPTO_CONTRATOS*100).toFixed(3);
    const barW=Math.min(x.pct_ppto,100);
    const bColor=ppColor(x.pct_ppto);
    return`<tr>
      <td class="num">${x.n}</td>
      <td style="font-size:.66rem">${shortN(x.cliente)}</td>
      <td style="font-size:.61rem;color:var(--mut)">${shortC(x.coord)}</td>
      <td>${tipoBadge(x.tipo)}</td>
      <td class="num" style="color:${x.val>0?'var(--az2)':'var(--mut)'}">${x.val>0?mm(x.val):'—'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.35rem">
          <div style="flex:1;height:5px;background:var(--gy2);border-radius:3px;overflow:hidden;min-width:55px">
            <div style="height:100%;width:${Math.min(parseFloat(pct)*5,100)}%;background:var(--az2);border-radius:3px"></div>
          </div>
          <span class="num" style="font-size:.65rem;color:var(--mut)">${pct}%</span>
        </div>
      </td>
      <td class="num" style="color:var(--az1);font-size:.65rem">${x.val>0?mm(x.ppto_ind):'—'}</td>
      <td style="min-width:70px">
        <div style="height:5px;background:var(--gy2);border-radius:3px;overflow:hidden;margin-bottom:.18rem">
          <div style="height:100%;width:${Math.min(x.pct_consumido,100)}%;background:${urgC(x.dias_vence)};border-radius:3px"></div>
        </div>
        <span style="font-size:.6rem;color:var(--mut)">${x.pct_consumido}%</span>
      </td>
      <td>${x.val>0?ppEstadoBadge(x.pct_ppto):'<span class="pill pgr">GAR</span>'}</td>
      <td>${urgP(x.dias_vence)}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--mut)">Sin resultados</td></tr>`;

  const visibles=d.filter(x=>x.val>0);
  document.getElementById('pp-ft').textContent=`${d.length} contratos · ${visibles.length} con valor económico · ${d.filter(x=>x.tipo==='Comercial').length} Comercial · ${d.filter(x=>x.tipo==='Garantia').length} Garantía`;
  document.getElementById('pp-ftr').textContent=mm(d.reduce((s,x)=>s+x.val,0))+' cartera filtrada';
}

function initPresupuesto(){
  document.querySelectorAll('#pp-filt-tipo .btn').forEach(b=>{b.addEventListener('click',()=>{ppFiltTipo=b.dataset.pft;document.querySelectorAll('#pp-filt-tipo .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderPresupuesto();});});
  document.querySelectorAll('#pp-filt-estado .btn').forEach(b=>{b.addEventListener('click',()=>{ppFiltEstado=b.dataset.pfe;document.querySelectorAll('#pp-filt-estado .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderPresupuesto();});});
  document.getElementById('pp-srch').oninput=e=>{ppSrch=e.target.value.toLowerCase();renderPresupuesto();};
  renderPresupuesto();
  setTimeout(()=>{
    const barFill=document.getElementById('pp-bar-fill');
    if(barFill){const w=barFill.style.width;barFill.style.width='0';setTimeout(()=>barFill.style.width=w,100);}
  },100);
}

function generatePDF(){
  document.getElementById('pdf-overlay').style.display='none';
  const scr=document.createElement('script');
  scr.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  scr.onload=_buildPDF;
  document.head.appendChild(scr);
}

function _buildPDF(){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const com=DATA.filter(d=>d.tipo==='Comercial');
  const totalVal=com.reduce((s,d)=>s+d.val,0);
  const vence90=com.filter(d=>d.dias_vence>=0&&d.dias_vence<=90);

  doc.setFillColor(14,45,85);doc.rect(0,0,297,20,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(13);
  doc.text('TECSERVICE · Panel de Contratos '+ANO_ACTUAL,14,13);
  doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(160,190,220);
  const _hpdf=new Date();
  const _fpdf=String(_hpdf.getDate()).padStart(2,'0')+'/'+String(_hpdf.getMonth()+1).padStart(2,'0')+'/'+_hpdf.getFullYear();
  doc.text('Calidad, Servicio y Soluciones · '+_fpdf,230,13);

  const kpis=[
    ['Total Contratos',DATA.length],
    ['Com. Activos',com.length],
    ['Cartera Anual','MM$'+fN0(totalVal/1e6)],
    ['Garantías',DATA.filter(d=>d.tipo==='Garantia').length],
    ['Por Vencer 90d',vence90.length],
    ['Nuevos',DATA.filter(d=>d.es_nuevo).length],
  ];
  const kw=44; let kx=14;
  kpis.forEach(k=>{
    doc.setFillColor(242,244,250);doc.roundedRect(kx,23,kw-2,16,2,2,'F');
    doc.setFillColor(51,68,141);doc.rect(kx,23,kw-2,2,'F');
    doc.setTextColor(2,3,6);doc.setFont('helvetica','bold');doc.setFontSize(14);
    doc.text(String(k[1]),kx+(kw-2)/2,32,{align:'center'});
    doc.setFontSize(6);doc.setFont('helvetica','normal');doc.setTextColor(107,123,168);
    doc.text(k[0],kx+(kw-2)/2,27,{align:'center'});
    kx+=kw;
  });

  let y=44;
  doc.setFillColor(14,45,85);doc.rect(14,y,269,7,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('RESUMEN POR COORDINADORA',148,y+5,{align:'center'});y+=9;

  const coords=[...new Set(DATA.filter(d=>d.coord).map(d=>d.coord.split(' ')[0]))].sort();
  const th2=['Coordinadora','COM','GAR','MM$ Anual','% Consumido Prom','Urgentes 90d'];
  const tw2=[65,20,20,35,45,30];
  let tx=14;
  doc.setFillColor(51,68,141);doc.rect(14,y,269,6,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(7);
  th2.forEach((h,i)=>{doc.text(h,tx+2,y+4);tx+=tw2[i];});y+=6;

  let totCOM=0,totGAR=0,totMM=0,totUrg=0;
  coords.forEach((c,ri)=>{
    const cd=DATA.filter(d=>d.coord&&d.coord.startsWith(c));
    const ccom=cd.filter(d=>d.tipo==='Comercial');
    const cgar=cd.filter(d=>d.tipo==='Garantia');
    const val=ccom.reduce((s,d)=>s+d.val,0);
    const avgPct=ccom.length?ccom.reduce((s,d)=>s+d.pct_consumido,0)/ccom.length:0;
    const urg=ccom.filter(d=>d.dias_vence>=0&&d.dias_vence<=90).length;
    totCOM+=ccom.length;totGAR+=cgar.length;totMM+=val;totUrg+=urg;
    doc.setFillColor(ri%2===0?242:250,ri%2===0?244:251,ri%2===0?250:253);
    doc.rect(14,y,269,6,'F');
    doc.setTextColor(2,3,6);doc.setFont('helvetica','normal');doc.setFontSize(7);
    const row=[c,ccom.length,cgar.length,'MM$'+fN1(val/1e6),avgPct.toFixed(1)+'%',urg];
    tx=14;row.forEach((v,i)=>{doc.text(String(v),tx+2,y+4);tx+=tw2[i];});y+=6;
  });
  doc.setFillColor(14,45,85);doc.rect(14,y,269,6,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7);
  tx=14;[`TOTAL (${coords.length} coords)`,totCOM,totGAR,'MM$'+fN1(totMM/1e6),'—',totUrg].forEach((v,i)=>{doc.text(String(v),tx+2,y+4);tx+=tw2[i];});
  y+=10;

  doc.setFillColor(192,0,0);doc.rect(14,y,269,7,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text('CONTRATOS COMERCIALES POR VENCER ≤ 90 DÍAS (ordenados por urgencia)',148,y+5,{align:'center'});y+=9;

  const urg90=[...vence90].sort((a,b)=>a.dias_vence-b.dias_vence);
  const uth=['#','Cliente','Coordinadora','Vence','Días','MM$ Anual','% Cons.'];
  const utw=[12,105,40,25,18,32,22];
  tx=14;
  doc.setFillColor(51,68,141);doc.rect(14,y,269,6,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(7);
  uth.forEach((h,i)=>{doc.text(h,tx+2,y+4);tx+=utw[i];});y+=6;

  urg90.forEach((x,ri)=>{
    if(y>188){doc.addPage();y=14;}
    doc.setFillColor(ri%2===0?255:252,ri%2===0?242:246,ri%2===0?242:246);
    doc.rect(14,y,269,6,'F');
    doc.setTextColor(2,3,6);doc.setFont('helvetica','normal');doc.setFontSize(7);
    const row=[x.n,x.cliente.slice(0,52),x.coord.split(' ')[0],x.fin_fmt,x.dias_vence+'d','MM$'+fN1(x.val/1e6),x.pct_consumido+'%'];
    tx=14;row.forEach((v,i)=>{doc.text(String(v),tx+2,y+4);tx+=utw[i];});y+=6;
  });

  const pages=doc.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    doc.setFillColor(14,45,85);doc.rect(0,197,297,10,'F');
    doc.setTextColor(160,190,220);doc.setFontSize(6);doc.setFont('helvetica','normal');
    doc.text('TECSERVICE · Calidad, Servicio y Soluciones · Panel de Contratos '+ANO_ACTUAL+' · Pág '+i+' de '+pages,148,203,{align:'center'});
  }
  doc.save('TECSERVICE_Contratos_'+ANO_ACTUAL+'.pdf');
}
