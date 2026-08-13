// ═══════════════════════════════════════════════════════════════
// hoja_vision.js — Visión General de Contratos
// Depende de: datos.js (DATA, PERDIDOS_VG, FAC_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let vgSortF='val', vgFilt='todos', vgRelF='todos', vgSrch='', vgSortA=false;
let vgSortCF='', vgSortCA=true;
let vgProgF='todos';
const PROG_MARGIN={BASIC:0.55,ADVANCED:0.60,PROFESIONAL:0.65,INTEGRAL:0.65};

function _getRel(cli){
  const r=DATA.find(d=>d.cliente===cli);
  return r?(r.estado_relacion||'N/D'):'N/D';
}

function vgData(){
  let d;
  if(vgRelF==='Perdido'){
    const dActivos=DATA.filter(x=>x.estado_relacion==='Perdido');
    d=[...dActivos,...PERDIDOS_VG];
  } else {
    d=[...DATA];
    if(vgFilt==='Comercial')d=d.filter(x=>x.tipo==='Comercial');
    else if(vgFilt==='Garantia')d=d.filter(x=>x.tipo==='Garantia');
    else if(vgFilt==='urgente')d=d.filter(x=>x.dias_vence<=90&&x.dias_vence>=0);
    else if(vgFilt==='nuevo')d=d.filter(x=>x.es_nuevo);
    if(vgRelF!=='todos')d=d.filter(x=>(x.estado_relacion||'N/D')===vgRelF);
  }
  if(vgSrch)d=d.filter(x=>x.cliente.toLowerCase().includes(vgSrch)||x.coord.toLowerCase().includes(vgSrch));
  if(vgProgF!=='todos')d=d.filter(x=>(_progKey(x.programa)||'')===vgProgF);
  if(window.vgCliFilter)d=d.filter(x=>x.cliente.toLowerCase().includes(vgCliFilter.toLowerCase()));
  d.sort((a,b)=>{
    if(vgSortCF){let va=a[vgSortCF],vb=b[vgSortCF];if(typeof va==='string'){va=va.toLowerCase();vb=vb.toLowerCase();}return vgSortCA?(va>vb?1:-1):(va<vb?1:-1);}
    return vgSortF==='dias_vence'?(a.val-b.val):(b[vgSortF]-a[vgSortF]);
  });
  return d;
}
function vgSortCol(f){vgSortCF=f;vgSortCA=vgSortCF===f?!vgSortCA:true;vgSortCF=f;renderVG();}

function renderVG(){
  const d=vgData();
  const totalVal=d.reduce((s,x)=>s+x.val,0);
  const avgPct=d.length?d.reduce((s,x)=>s+x.pct_consumido,0)/d.length:0;
  const urgentes=d.filter(x=>x.dias_vence<=90&&x.dias_vence>=0).length;
  const carteraVG=vgFilt==='Comercial'?TOTAL_COM_VAL:vgFilt==='Garantia'?TOTAL_GAR_VAL:TOTAL_CARTERA_VAL;
  document.getElementById('vg-k1').textContent=d.length;
  document.getElementById('vg-k2').textContent=mm(carteraVG);
  document.getElementById('vg-k3').textContent=d.filter(x=>x.tipo==='Garantia').length;
  document.getElementById('vg-k4').textContent=avgPct.toFixed(1)+'%';
  document.getElementById('vg-k5').textContent=urgentes;

  document.getElementById('tb-vg').innerHTML=d.map(x=>{
    const esPerdidoFac=x._es_perdido_fac===true;
    const valMostrar=esPerdidoFac?(x.fac_total||0):x.val;
    const pPres=valMostrar>0?(valMostrar/PPTO_CONTRATOS*100).toFixed(3)+'%':'—';
    const pTab=esPerdidoFac?'—':pctOf(x.val,totalVal);
    const long=esPerdidoFac?'Expirado':(x.long_dias>365?Math.round(x.long_dias/365)+'a '+(x.long_dias%365)+'d':x.long_dias+'d');
    const rel=x.estado_relacion||'N/D';
    const relCol={Nuevo:'#28d2c3',Renovado:'#FFC000',Perdido:'#FF6B6B'}[rel]||'#999';
    const relIco={Nuevo:'🆕',Renovado:'🔄',Perdido:'📉'}[rel]||'—';
    const pctBar=esPerdidoFac?100:x.pct_consumido;
    const diasVenceLabel=esPerdidoFac?'<span style="font-size:.6rem;color:#FF6B6B;font-weight:700">Expirado</span>':urgP(x.dias_vence);
    const nLabel=esPerdidoFac?'<span style="color:#FF6B6B">📉</span>':x.n;
    return`<tr style="${esPerdidoFac?'opacity:.75;background:rgba(255,107,107,.04)':''}">
      <td class="num">${nLabel}</td>
      <td style="font-size:.67rem;line-height:1.3">${shortN(x.cliente)}</td>
      <td style="font-size:.62rem;color:var(--mut)">${shortC(x.coord)}</td>
      <td style="font-size:.62rem;color:var(--mut)">${x.vendedor||'—'}</td>
      <td>${esPerdidoFac?'<span style="font-size:.6rem;color:var(--mut)">Expirado</span>':tipoBadge(x.tipo)}</td>
      <td style="text-align:center">${esPerdidoFac?'—':_progBadge(x.programa||'')}</td>
      <td style="text-align:center">${_lineaBadge(x.linea_negocio)}</td>
      <td style="text-align:center;font-family:'Roboto Mono',monospace;font-size:.63rem;font-weight:700;color:${(()=>{const k=_progKey(x.programa);return k?_PROG_FEATURES[k].color:'var(--mut)';})()}">${(()=>{const p=PROG_MARGIN[_progKey(x.programa)];return p?Math.round(p*100)+'%':'—';})()}</td>
      <td style="text-align:right;font-size:.63rem;font-weight:700;color:var(--teal)">${(()=>{const p=PROG_MARGIN[_progKey(x.programa)];if(!p||!x.val||esPerdidoFac)return'—';const fa=x.long_dias>0?x.val/(x.long_dias/365):x.val;return mm(fa*p);})()}</td>
      <td><span style="background:${relCol};color:#fff;padding:.14rem .35rem;border-radius:3px;font-size:.55rem;font-weight:700;white-space:nowrap" title="${rel}">${relIco} ${rel}</span></td>
      <td>${esPerdidoFac?'—':nueBadge(x.es_nuevo)}</td>
      <td style="font-size:.67rem">${x.inicio_fmt}</td>
      <td style="font-size:.67rem">${x.fin_fmt||'—'}</td>
      <td class="num" style="color:${valMostrar>0?'var(--az2)':'var(--mut)'}" title="${esPerdidoFac?'Facturación histórica total':'Cartera contrato'}">${valMostrar>0?mm(valMostrar):'—'}${esPerdidoFac?'<sup style="font-size:.5rem;color:var(--mut)">hist</sup>':''}</td>
      <td class="num" style="color:var(--mut)">${pTab}</td>
      <td style="font-size:.62rem;color:var(--mut)">${pPres}</td>
      <td style="font-size:.65rem">${long}</td>
      <td style="min-width:75px">${esPerdidoFac?'<div class="prf" style="height:6px;background:#FF6B6B;border-radius:3px;width:100%"></div>':pbarHTML(x.pct_consumido,urgC(x.dias_vence))}<span style="font-size:.6rem;color:var(--mut)">${pctBar}%</span></td>
      <td>${diasVenceLabel}</td>
    </tr>`;
  }).join('')||`<tr><td colspan="18" style="text-align:center;padding:2rem;color:var(--mut)">Sin resultados</td></tr>`;

  // ── Resumen por programa (clientes, facturación, margen) ────
  const progKeys=['BASIC','ADVANCED','PROFESIONAL','INTEGRAL',''];
  const progLabels={BASIC:'Basic Care Program',ADVANCED:'Advanced Care Program',PROFESIONAL:'Profesional Care Program',INTEGRAL:'Integral Care Program','':'Sin programa'};
  const progByKey={};
  progKeys.forEach(k=>progByKey[k]={clientes:new Set(),n:0,fa:0});
  const dActivosProg=d.filter(x=>!x._es_perdido_fac);
  dActivosProg.forEach(x=>{
    const k=_progKey(x.programa)||'';
    if(!progByKey[k])progByKey[k]={clientes:new Set(),n:0,fa:0};
    progByKey[k].clientes.add(x.cliente);
    progByKey[k].n++;
    const fa=x.long_dias>0?x.val/(x.long_dias/365):x.val;
    progByKey[k].fa+=fa;
  });
  const progSummaryBody=document.getElementById('tb-vg-prog-summary');
  if(progSummaryBody){
    const totalFaAll=Object.values(progByKey).reduce((s,v)=>s+v.fa,0);
    // Las 4 categorías oficiales siempre se muestran (aunque tengan 0 clientes); "Sin programa" solo si hay datos
    const rows=progKeys.filter(k=>k!==''||progByKey[k].n>0).map(k=>{
      const g=progByKey[k]; const mg=PROG_MARGIN[k]||null;
      const nCli=g.clientes.size;
      const promCli=nCli>0?g.fa/nCli:0;
      const margenT=mg?g.fa*mg:null; const margenPromCli=mg&&nCli>0?promCli*mg:null;
      const pctShare=totalFaAll>0?(g.fa/totalFaAll*100):0;
      const col=k?(_PROG_FEATURES[k]?_PROG_FEATURES[k].color:'#888'):'#888';
      return `<tr>
        <td><strong style="font-size:.67rem;color:${col}">${progLabels[k]}</strong></td>
        <td style="text-align:center;font-weight:700">${nCli}</td>
        <td style="text-align:center;color:var(--mut)">${g.n}</td>
        <td style="text-align:right;font-weight:700;color:var(--az2)">${mm(g.fa)}</td>
        <td style="text-align:center;color:var(--mut)">${pctShare.toFixed(1)}%</td>
        <td style="text-align:right;color:var(--mut)">${nCli>0?mm(promCli):'—'}</td>
        <td style="text-align:center;font-weight:700;color:${col}">${mg?Math.round(mg*100)+'%':'—'}</td>
        <td style="text-align:right;font-weight:700;color:var(--teal)">${margenT!=null?mm(margenT):'—'}</td>
        <td style="text-align:right;color:var(--mut)">${margenPromCli!=null?mm(margenPromCli):'—'}</td>
      </tr>`;
    });
    // Fila de totales (clientes únicos deduplicados a través de todos los programas)
    const totalClientesSet=new Set(dActivosProg.map(x=>x.cliente));
    const totalN=Object.values(progByKey).reduce((s,v)=>s+v.n,0);
    const totalFa=totalFaAll;
    const totalMg=progKeys.reduce((s,k)=>{const g=progByKey[k];const mg=PROG_MARGIN[k];return s+(g&&mg?g.fa*mg:0);},0);
    const totalCli=totalClientesSet.size;
    rows.push(`<tr style="background:rgba(30,90,200,.07);font-weight:800">
      <td>TOTAL</td>
      <td style="text-align:center">${totalCli}</td>
      <td style="text-align:center">${totalN}</td>
      <td style="text-align:right;color:var(--az2)">${mm(totalFa)}</td>
      <td style="text-align:center">100%</td>
      <td style="text-align:right;color:var(--mut)">${totalCli?mm(totalFa/totalCli):'—'}</td>
      <td style="text-align:center">—</td>
      <td style="text-align:right;color:var(--teal)">${mm(totalMg)}</td>
      <td style="text-align:right;color:var(--mut)">${totalCli?mm(totalMg/totalCli):'—'}</td>
    </tr>`);
    progSummaryBody.innerHTML=rows.join('');
  }

  // ── Resumen y detalle por Línea de Negocio y por Dueño de Cuenta ────────
  const lineaKeys=['Esterilización','Endoscopía','Dental'];
  const dActivosLinea=d.filter(x=>!x._es_perdido_fac);
  const lineaKeyFn=x=>lineaKeys.includes(x.linea_negocio)?x.linea_negocio:'Esterilización';
  // Dueño de cuenta = Vendedor Técnico (Cristian Perez / Eglys Ramirez), no la coordinadora
  const duenoKeyFn=x=>x.vendedor||'Sin dueño de cuenta';
  // Tipo de programa CARE (Basic/Advanced/Profesional/Integral/Sin programa)
  const progGrupoKeys=['BASIC','ADVANCED','PROFESIONAL','INTEGRAL','Sin programa'];
  const progGrupoLabels={BASIC:'Basic Care',ADVANCED:'Advanced Care',PROFESIONAL:'Profesional Care',INTEGRAL:'Integral Care'};
  const progGrupoKeyFn=x=>_progKey(x.programa)||'Sin programa';
  const progGrupoRenderLabel=k=>{
    if(k==='Sin programa')return `<span style="font-size:.62rem;color:var(--mut)">Sin programa</span>`;
    const feat=_PROG_FEATURES[k];
    return `<span style="display:inline-block;padding:.15rem .45rem;border-radius:4px;font-weight:800;font-size:.62rem;font-family:'Roboto Condensed',sans-serif;background:${feat.solidBg};color:#111;white-space:nowrap">${progGrupoLabels[k]}</span>`;
  };

  _renderGrupoResumen('tb-vg-linea-summary', dActivosLinea, lineaKeyFn, lineaKeys, k=>_lineaBadge(k));
  _renderGrupoResumen('tb-vg-coord-summary', dActivosLinea, duenoKeyFn, null, k=>`<strong style="font-size:.65rem">${k}</strong>`);
  _renderGrupoResumen('tb-vg-programa-summary', dActivosLinea, progGrupoKeyFn, progGrupoKeys, progGrupoRenderLabel);
  _renderGrupoDetalle('vg-linea-detalle', dActivosLinea, lineaKeyFn, lineaKeys, 'Coordinadora', x=>shortC(x.coord));
  _renderGrupoDetalle('vg-coord-detalle', dActivosLinea, duenoKeyFn, null, 'Línea Negocio', x=>_lineaBadge(x.linea_negocio));

  const esFiltPerdido=vgRelF==='Perdido';
  const nActivosMostrados=d.filter(x=>!x._es_perdido_fac).length;
  const nPerdidosFac=d.filter(x=>x._es_perdido_fac).length;
  const nUniqueClientes=new Set(d.map(x=>x.cliente)).size;
  const facCnts={Nuevo:FAC_DATA.filter(x=>x.estado_relacion==='Nuevo').length,Renovado:FAC_DATA.filter(x=>x.estado_relacion==='Renovado').length,Perdido:FAC_DATA.filter(x=>x.estado_relacion==='Perdido').length};
  const relNote=vgRelF!=='todos'&&vgRelF!==''?` · ${facCnts[vgRelF]||nUniqueClientes} clientes únicos en Tipos de Contrato`:'';
  const notaVGEl=document.getElementById('vg-rel-nota');
  if(notaVGEl)notaVGEl.style.display=(vgRelF!=='todos'&&!esFiltPerdido)?'block':'none';
  document.getElementById('vg-ftl').textContent=esFiltPerdido
    ?`${d.length} clientes perdidos · ${nPerdidosFac} expirados sin contrato activo · ${nActivosMostrados} con contrato vencido`
    :`${d.length} contratos · ${nUniqueClientes} clientes únicos${relNote} · ${d.filter(x=>x.tipo==='Comercial').length} Comercial · ${d.filter(x=>x.tipo==='Garantia').length} Garantía`;
  document.getElementById('vg-ftr').textContent=esFiltPerdido
    ?(mm(d.filter(x=>x._es_perdido_fac).reduce((s,x)=>s+(x.fac_total||0),0))+' facturado histórico (perdidos)')
    :(mm(totalVal)+' cartera total filtrada');
}

// ── Resumen agrupado (contratos/clientes/cartera/ticket/duración) ────────
// groupOrder=null → grupos ordenados por cartera descendente
function _renderGrupoResumen(containerId,items,groupKeyFn,groupOrder,renderLabelFn){
  const el=document.getElementById(containerId);
  if(!el)return;
  const groups={};
  items.forEach(x=>{
    const k=groupKeyFn(x);
    if(!groups[k])groups[k]={clientes:new Set(),n:0,val:0,com:0,gar:0,diasSum:0,restanteSum:0};
    const g=groups[k];
    g.clientes.add(x.cliente);
    g.n++;
    g.val+=x.val;
    if(x.tipo==='Comercial')g.com++; else g.gar++;
    g.diasSum+=x.long_dias||0;
    g.restanteSum+=x.dias_vence||0;
  });
  const keys=groupOrder?groupOrder.filter(k=>groups[k]):Object.keys(groups).sort((a,b)=>groups[b].val-groups[a].val);
  const totalValAll=keys.reduce((s,k)=>s+groups[k].val,0);
  const rows=keys.map(k=>{
    const g=groups[k];
    const nCli=g.clientes.size;
    const ticketProm=g.n>0?g.val/g.n:0;
    const durProm=g.n>0?g.diasSum/g.n:0;
    const restanteProm=g.n>0?g.restanteSum/g.n:0;
    const pctShare=totalValAll>0?(g.val/totalValAll*100):0;
    return `<tr>
      <td>${renderLabelFn(k)}</td>
      <td class="num" style="font-weight:700">${g.n}</td>
      <td class="num">${nCli}</td>
      <td class="num" style="color:var(--mut)">${g.com}</td>
      <td class="num" style="color:var(--mut)">${g.gar}</td>
      <td class="num" style="font-weight:700;color:var(--az2)">${mm(g.val)}</td>
      <td class="num" style="color:var(--mut)">${pctShare.toFixed(1)}%</td>
      <td class="num">${g.n>0?mm(ticketProm):'—'}</td>
      <td class="num">${g.n>0?Math.round(durProm)+' días':'—'}</td>
      <td class="num" style="color:${restanteProm<0?'var(--rd)':'var(--mut)'}">${g.n>0?Math.round(restanteProm)+' días':'—'}</td>
    </tr>`;
  });
  const totalN=items.length;
  const totalCliSet=new Set(items.map(x=>x.cliente));
  const totalCom=items.filter(x=>x.tipo==='Comercial').length;
  const totalGar=totalN-totalCom;
  const totalDiasSum=items.reduce((s,x)=>s+(x.long_dias||0),0);
  const totalRestanteSum=items.reduce((s,x)=>s+(x.dias_vence||0),0);
  rows.push(`<tr style="background:rgba(30,90,200,.07);font-weight:800">
    <td>TOTAL</td>
    <td class="num">${totalN}</td>
    <td class="num">${totalCliSet.size}</td>
    <td class="num">${totalCom}</td>
    <td class="num">${totalGar}</td>
    <td class="num" style="color:var(--az2)">${mm(totalValAll)}</td>
    <td class="num">100%</td>
    <td class="num">${totalN>0?mm(totalValAll/totalN):'—'}</td>
    <td class="num">${totalN>0?Math.round(totalDiasSum/totalN)+' días':'—'}</td>
    <td class="num">${totalN>0?Math.round(totalRestanteSum/totalN)+' días':'—'}</td>
  </tr>`);
  el.innerHTML=rows.join('');
}

// ── Detalle de contratos agrupados, cada grupo con su fila de subtotal ───
// groupOrder=null → grupos ordenados por cartera descendente
function _renderGrupoDetalle(containerId,items,groupKeyFn,groupOrder,extraLabel,extraFn){
  const el=document.getElementById(containerId);
  if(!el)return;
  const groups={};
  items.forEach(x=>{
    const k=groupKeyFn(x);
    if(!groups[k])groups[k]=[];
    groups[k].push(x);
  });
  const keys=groupOrder?groupOrder.filter(k=>groups[k]&&groups[k].length):Object.keys(groups).sort((a,b)=>{
    const sa=groups[a].reduce((s,x)=>s+x.val,0),sb=groups[b].reduce((s,x)=>s+x.val,0);
    return sb-sa;
  });
  const grandTotal=items.reduce((s,x)=>s+x.val,0);
  const SLC=bg=>`position:sticky;left:0;z-index:1;background:${bg};border-right:1px solid rgba(0,0,0,.08)`;
  const sepRow=(lbl,n,val)=>`<tr style="background:rgba(0,45,115,.07)">
    <td colspan="8" style="${SLC('#edf0f5')};font-size:.62rem;font-weight:700;color:var(--az1);padding:.32rem .6rem">
      ${lbl} <span style="color:var(--mut);font-weight:400">· ${n} contrato${n===1?'':'s'}</span>
      <span style="float:right;color:var(--az2)">${mm(val)}</span>
    </td>
  </tr>`;
  let body='',sumAll=0,nAll=0;
  keys.forEach(k=>{
    const rows=groups[k].slice().sort((a,b)=>b.val-a.val);
    const subtotal=rows.reduce((s,x)=>s+x.val,0);
    sumAll+=subtotal;nAll+=rows.length;
    body+=sepRow(k,rows.length,subtotal);
    body+=rows.map(x=>{
      const pct=grandTotal>0?(x.val/grandTotal*100).toFixed(2)+'%':'—';
      const long=x.long_dias>365?Math.round(x.long_dias/365)+'a '+(x.long_dias%365)+'d':x.long_dias+'d';
      return `<tr>
        <td style="font-size:.62rem;line-height:1.3">${shortN(x.cliente)}</td>
        <td>${tipoBadge(x.tipo)}</td>
        <td style="font-size:.6rem;color:var(--mut)">${extraFn(x)}</td>
        <td style="text-align:center">${_progBadge(x.programa||'')}</td>
        <td class="num" style="color:var(--az2)">${mm(x.val)}</td>
        <td class="num" style="color:var(--mut)">${pct}</td>
        <td style="font-size:.63rem">${long}</td>
        <td style="font-size:.63rem">${x.fin_fmt||'—'}</td>
      </tr>`;
    }).join('');
  });
  body+=`<tr style="background:var(--az3);font-weight:800">
    <td colspan="8" style="color:#fff;padding:.4rem .6rem;font-size:.64rem">
      TOTAL GENERAL <span style="opacity:.7;font-weight:400">· ${nAll} contratos</span>
      <span style="float:right">${mm(sumAll)}</span>
    </td>
  </tr>`;
  el.innerHTML=`<div class="scroll-t" style="max-height:460px">
    <table class="tbl" style="font-size:.63rem;width:100%;min-width:640px">
      <thead><tr>
        <th style="text-align:left">Cliente</th>
        <th>Tipo</th>
        <th>${extraLabel}</th>
        <th>Programa</th>
        <th class="num">MM$ Anual</th>
        <th class="num">% s/Total</th>
        <th>Duración</th>
        <th>Vence</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function _renderProgTable(){
  const KEYS=['BASIC','ADVANCED','PROFESIONAL','INTEGRAL'];
  const hdrStyle='padding:.42rem .7rem;font-size:.6rem;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,.7);background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.08)';

  // Actualizar encabezados fijos de columna (en thead)
  ['prog-th-basic','prog-th-advanced','prog-th-profesional','prog-th-integral'].forEach((id,i)=>{
    const el=document.getElementById(id);
    if(el)el.style.display='none'; // los ocultamos; usamos el thead del template
  });

  const rows=[];

  // Fila de encabezado de sección
  rows.push(`<tr>
    <td style="${hdrStyle}">PROGRAMA DE SERVICIO</td>
    <td style="${hdrStyle}">OBJETIVO</td>
    <td style="${hdrStyle}">SERVICIOS CONSIDERADOS</td>
  </tr>`);

  KEYS.forEach(k=>{
    const {label,objetivo,items,solidBg,textColor,color,bg}=_PROG_FEATURES[k];
    const n=items.length;
    const nameCell=`<td rowspan="${n}" style="font-weight:800;font-size:.72rem;font-family:'Roboto Condensed',sans-serif;letter-spacing:.04em;text-align:center;vertical-align:middle;background:${solidBg};color:#111;padding:.6rem .8rem;border-right:1px solid rgba(0,0,0,.12)">${label.toUpperCase()} CARE PROGRAM</td>`;
    const objCell=`<td rowspan="${n}" style="font-size:.7rem;color:#111;line-height:1.65;vertical-align:middle;padding:.55rem 1rem;border-right:1px solid rgba(0,0,0,.08);background:${solidBg}33">${objetivo}</td>`;
    items.forEach((svc,i)=>{
      rows.push(`<tr>
        ${i===0?nameCell:''}
        ${i===0?objCell:''}
        <td style="font-size:.7rem;padding:.38rem 1rem;background:${solidBg}55;color:#111;border-top:1px solid rgba(0,0,0,.07)">${svc}</td>
      </tr>`);
    });

    // Fila separadora entre programas (excepto el último)
    if(k!=='INTEGRAL'){
      rows.push(`<tr>
        <td style="${hdrStyle}">PROGRAMA DE SERVICIO</td>
        <td style="${hdrStyle}">OBJETIVO</td>
        <td style="${hdrStyle}">SERVICIOS CONSIDERADOS</td>
      </tr>`);
    }
  });

  const tb=document.getElementById('tb-prog-care');
  if(tb)tb.innerHTML=rows.join('');
}


// ═══════════════════════════════════════════════════════════════
// CONTRATOS DE GARANTÍA · COSTO ESTIMADO
// El margen por programa sale de la hoja "Resumen Tipos Programas"
// (col H, % Margen). El costo es el complemento: 1 − margen.
// ═══════════════════════════════════════════════════════════════
let _vgGarLinea = 'todas';
let _vgGarSort  = 'val';
let _vgGarAsc   = false;

// Margen para contratos sin programa asignado: 50%, un promedio entre los
// tres planes (55%, 60% y 65%). No se usa el 55% de "SIN PROGRAMA" de la
// hoja Resumen Tipos Programas porque no se sabe qué plan les corresponde.
const _VG_MG_SIN_PROG = 0.50;
const _VG_PLAN_LBL = {BASIC:'Basic', ADVANCED:'Advanced',
                      PROFESIONAL:'Profesional', INTEGRAL:'Integral'};

function _vgGarFilas(){
  // Reutiliza PROG_MARGIN y _progKey() que ya usa el resto de la hoja, para
  // no tener dos tablas de márgenes que puedan quedar desalineadas.
  return DATA.filter(d=>d.tipo==='Garantia').map(d=>{
    const k      = _progKey(d.programa);
    const margen = (k && PROG_MARGIN[k] != null) ? PROG_MARGIN[k] : _VG_MG_SIN_PROG;
    const costoT = d.val * (1 - margen);
    const pct    = Math.max(0, Math.min(100, d.pct_consumido||0));
    return {
      cliente: d.cliente, ejec: d.vendedor||'—',
      plan: k ? _VG_PLAN_LBL[k] : 'Sin programa',
      linea: d.linea_negocio||'—', margen,
      val: d.val, costoT, costoR: costoT * (1 - pct/100),
      inicio: d.inicio_fmt||'—', fin: d.fin_fmt||'—',
      pct, dias: d.dias_vence,
    };
  });
}

function vgGarSort(f){
  _vgGarAsc = (_vgGarSort===f) ? !_vgGarAsc : false;
  _vgGarSort = f;
  _vgRenderGar();
}
function vgGarLinea(l){ _vgGarLinea = l; _vgRenderGar(); }

function _vgRenderGar(){
  const box = document.getElementById('vg-gar-tabla');
  if(!box) return;
  let filas = _vgGarFilas();
  if(!filas.length){ box.innerHTML='<p style="padding:1.2rem;color:var(--mut);font-style:italic">Sin contratos de garantía.</p>'; return; }

  // Segmentador por línea
  const lineas = [...new Set(filas.map(f=>f.linea))].sort();
  const segBox = document.getElementById('vg-gar-linea');
  if(segBox){
    segBox.innerHTML = ['todas'].concat(lineas).map(l=>{
      const on = _vgGarLinea===l;
      return `<button onclick="vgGarLinea(${JSON.stringify(l).replace(/"/g,'&quot;')})"
        style="font-size:.58rem;padding:.2rem .55rem;border-radius:3px;cursor:pointer;
        border:1px solid ${on?'var(--az1)':'var(--brd)'};background:${on?'var(--az1)':'var(--bg2)'};
        color:${on?'#fff':'var(--txt)'};font-weight:${on?'700':'400'}">${l==='todas'?'Todas':l}</button>`;
    }).join('');
  }
  if(_vgGarLinea!=='todas') filas = filas.filter(f=>f.linea===_vgGarLinea);

  filas.sort((a,b)=>{
    const va=a[_vgGarSort], vb=b[_vgGarSort];
    if(typeof va==='string') return _vgGarAsc?va.localeCompare(vb,'es'):vb.localeCompare(va,'es');
    return _vgGarAsc?((va||0)-(vb||0)):((vb||0)-(va||0));
  });

  const tV=filas.reduce((s,f)=>s+f.val,0);
  const tT=filas.reduce((s,f)=>s+f.costoT,0);
  const tR=filas.reduce((s,f)=>s+f.costoR,0);
  const sinProg=filas.filter(f=>f.plan==='Sin programa');
  const nSin=sinProg.length;
  const valSin=sinProg.reduce((s,f)=>s+f.val,0);
  const SEP='border-right:1px solid var(--brd)';
  const th=(t,f,al)=>`<th onclick="vgGarSort('${f}')" style="position:sticky;top:0;z-index:2;background:var(--az1);
    color:#fff;padding:.35rem .5rem;font-size:.55rem;letter-spacing:.03em;text-align:${al};white-space:nowrap;
    cursor:pointer;border-right:1px solid rgba(255,255,255,.18)">${t}${_vgGarSort===f?(_vgGarAsc?' ▲':' ▼'):''}</th>`;
  // Días restantes con el mismo semáforo que el resto del panel
  const pillD=d=>{
    if(d==null||isNaN(d)) return '<span style="color:var(--mut)">—</span>';
    const c = d<0?'#7A0000' : d<=90?'#C00000' : d<=180?'#D46000' : d<=365?'#8B8200':'#00832F';
    return `<span style="color:${c};font-weight:700">${d.toLocaleString('es-CL')}</span>`;
  };

  box.innerHTML=`
    <div style="overflow-x:auto;max-height:520px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;min-width:1120px">
        <thead><tr>
          ${th('CLIENTE / INSTITUCIÓN','cliente','left')}${th('EJECUTIVO','ejec','left')}
          ${th('PLAN','plan','left')}${th('LÍNEA','linea','left')}
          ${th('MONTO TOTAL','val','right')}
          ${th('COSTO ESTIMADO TOTAL','costoT','right')}
          ${th('COSTO ESTIM. REMANENTE','costoR','right')}
          ${th('INICIO','inicio','left')}${th('TÉRMINO','fin','left')}
          ${th('% CONSUMIDO','pct','right')}${th('DÍAS REST.','dias','right')}
        </tr></thead>
        <tbody>${filas.map((f,i)=>`
          <tr style="background:${i%2===0?'var(--bg2)':'var(--bg)'}">
            <td style="padding:.26rem .5rem;font-size:.62rem;font-weight:600;${SEP}" title="${f.cliente}">${shortN(f.cliente)}</td>
            <td style="padding:.26rem .5rem;font-size:.6rem;color:var(--mut);white-space:nowrap;${SEP}">${f.ejec}</td>
            <td style="padding:.26rem .5rem;font-size:.6rem;${SEP}"
                title="Margen ${(f.margen*100).toFixed(0)}% · costo ${((1-f.margen)*100).toFixed(0)}%">${f.plan}</td>
            <td style="padding:.26rem .5rem;font-size:.6rem;color:var(--mut);${SEP}">${f.linea}</td>
            <td style="padding:.26rem .5rem;text-align:right;font-size:.63rem;font-weight:700;
                       font-variant-numeric:tabular-nums;${SEP}">${mm(f.val)}</td>
            <td style="padding:.26rem .5rem;text-align:right;font-size:.62rem;color:var(--or);
                       font-variant-numeric:tabular-nums;${SEP}">${mm(f.costoT)}</td>
            <td style="padding:.26rem .5rem;text-align:right;font-size:.62rem;color:var(--rd);font-weight:600;
                       font-variant-numeric:tabular-nums;${SEP}">${mm(f.costoR)}</td>
            <td style="padding:.26rem .5rem;font-size:.58rem;color:var(--mut);white-space:nowrap;${SEP}">${f.inicio}</td>
            <td style="padding:.26rem .5rem;font-size:.58rem;color:var(--mut);white-space:nowrap;${SEP}">${f.fin}</td>
            <td style="padding:.26rem .5rem;${SEP}">
              <div style="display:flex;align-items:center;gap:4px">
                <div style="flex:1;height:5px;background:var(--gy);border-radius:3px;overflow:hidden;min-width:34px">
                  <div style="height:100%;width:${f.pct}%;background:var(--az2)"></div></div>
                <span style="font-size:.55rem;color:var(--mut);min-width:30px;text-align:right">${f.pct.toFixed(1)}%</span>
              </div></td>
            <td style="padding:.26rem .5rem;text-align:right;font-size:.6rem;font-variant-numeric:tabular-nums">${pillD(f.dias)}</td>
          </tr>`).join('')}</tbody>
        <tfoot><tr style="position:sticky;bottom:0;background:var(--az3);color:#fff;font-weight:700">
          <td colspan="4" style="padding:.32rem .5rem;font-size:.62rem;${SEP}">TOTAL · ${filas.length} contratos${_vgGarLinea==='todas'?'':' · '+_vgGarLinea}</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.63rem;font-variant-numeric:tabular-nums;${SEP}">${mm(tV)}</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.62rem;font-variant-numeric:tabular-nums;${SEP}">${mm(tT)}</td>
          <td style="padding:.32rem .5rem;text-align:right;font-size:.62rem;font-variant-numeric:tabular-nums;${SEP}">${mm(tR)}</td>
          <td colspan="4"></td>
        </tr></tfoot>
      </table>
    </div>
    <p style="font-size:.55rem;color:var(--mut);margin:.5rem 0 0;line-height:1.5">
      <strong style="color:var(--az2)">Cómo se calcula el costo estimado.</strong>
      Se aplica el margen de cada programa según la hoja «Resumen Tipos Programas» —
      Basic 55%, Advanced 60%, Profesional 65% — y el costo es el complemento: 45%, 40% y 35%
      respectivamente. El costo remanente descuenta el porcentaje ya consumido del contrato.
      Los días restantes se cuentan desde la fecha de datos del panel hasta la fecha de término.
      <br>
      <strong style="color:var(--or)">Contratos sin programa asignado:</strong>
      se les aplica un margen promedio de <strong>50%</strong> (costo 50%), por no conocerse el plan
      que les corresponde. Son <strong>${nSin}</strong> de los ${filas.length} de esta vista
      (${mm(valSin)} de cartera); asignarles su programa real en el Excel ajustaría su costo.</p>`;

  const lbl=document.getElementById('vg-gar-lbl');
  if(lbl) lbl.textContent=`${filas.length} contratos · ${mm(tV)} cartera · ${mm(tR)} costo por ejecutar`;
}

// Exportar la tabla de garantías a PDF. Mismo enfoque que eerrExportPDF():
// se mide el ancho natural del contenido y se crea una página a esa medida,
// así la tabla nunca se corta ni se achica.
async function vgGarExportPDF(){
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const src = document.querySelector('#vg-gar-tabla table');
  if (!src) { alert('No hay tabla de garantías para exportar.'); return; }

  const btn = document.getElementById('vg-gar-pdf-btn');
  const SVG_ICON = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  let wrap = null;
  try {
    const c = src.cloneNode(true);
    c.querySelectorAll('*').forEach(n => {
      n.style.position  = 'static';
      n.style.maxHeight = 'none';
      n.style.overflow  = 'visible';
      n.style.maxWidth  = 'none';
      n.style.cursor    = 'default';
    });
    c.querySelectorAll('td,th').forEach(n => {
      n.style.fontSize   = '9px';
      n.style.padding    = '3px 6px';
      n.style.lineHeight = '1.35';
      n.style.whiteSpace = 'nowrap';
    });
    // Las flechas de orden y las barras de progreso no aportan en papel:
    // la barra se reemplaza por el porcentaje, que ya va al lado.
    c.querySelectorAll('th').forEach(n => { n.textContent = n.textContent.replace(/[▲▼]/g, '').trim(); });
    c.querySelectorAll('td > div > div').forEach(n => {
      if (n.parentElement && n.parentElement.style.display === 'flex' && !n.textContent.trim()) n.remove();
    });
    c.style.borderCollapse = 'collapse';
    c.style.tableLayout    = 'auto';
    c.style.width          = 'auto';
    c.style.minWidth       = '0';

    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;' +
      'padding:14px 20px 20px;font-family:Arial,sans-serif;color:#111;' +
      'display:inline-block;box-sizing:border-box';

    const filas = _vgGarFilas().filter(f => _vgGarLinea === 'todas' || f.linea === _vgGarLinea);
    const tV = filas.reduce((s, f) => s + f.val, 0);
    const hoy = (window.APP_DATA || {}).hoy || '';
    const hdr = document.createElement('div');
    hdr.style.cssText = 'margin-bottom:10px;border-bottom:2.5px solid #002D73;padding-bottom:6px';
    hdr.innerHTML =
      '<span style="font-size:13px;font-weight:700;color:#002D73">TECSERVICE — Contratos de Garantía · Costo Estimado</span>' +
      '&emsp;<span style="font-size:10px;color:#555">' +
      (_vgGarLinea === 'todas' ? 'Todas las líneas' : _vgGarLinea) +
      ' &nbsp;·&nbsp; ' + filas.length + ' contratos &nbsp;·&nbsp; ' + mm(tV) + ' de cartera' +
      (hoy ? ' &nbsp;·&nbsp; Datos al ' + hoy : '') + '</span>';
    wrap.appendChild(hdr);
    wrap.appendChild(c);

    const nota = document.createElement('div');
    nota.style.cssText = 'font-size:8px;color:#666;margin-top:8px;line-height:1.5;max-width:900px';
    nota.innerHTML =
      'Costo estimado según el margen de cada programa (Basic 55%, Advanced 60%, Profesional 65%); ' +
      'el costo es el complemento. Los contratos sin programa asignado usan un margen promedio de 50%. ' +
      'El costo remanente descuenta el porcentaje ya consumido. Los días restantes se cuentan desde la ' +
      'fecha de datos del panel hasta la fecha de término.';
    wrap.appendChild(nota);

    document.body.appendChild(wrap);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const realW = Math.ceil(wrap.getBoundingClientRect().width)  || wrap.offsetWidth;
    const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
    if (!realW || !realH) throw new Error('No se pudo medir el contenido (w=' + realW + ' h=' + realH + ')');

    wrap.style.display = 'block';
    wrap.style.width   = realW + 'px';

    const canvas = await html2canvas(wrap, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });

    const { jsPDF } = window.jspdf;
    const MM_PX = 25.4 / 96;
    const pageW = realW * MM_PX;
    const pageH = realH * MM_PX;
    const pdf = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'mm', format: [pageW, pageH],
    });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageW, pageH);
    const suf = _vgGarLinea === 'todas' ? '' : '_' + _vgGarLinea.replace(/[\s/]+/g, '_');
    pdf.save('Contratos_Garantia_TS' + suf + '_' + (hoy || '').replace(/[\s/]+/g, '-') + '.pdf');

  } catch (err) {
    console.error('vgGarExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = SVG_ICON; }
  }
}

function initVision(){
  document.querySelectorAll('#vg-sort .btn').forEach(b=>{b.addEventListener('click',()=>{vgSortF=b.dataset.vs;vgSortCF='';document.querySelectorAll('#vg-sort .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.querySelectorAll('#vg-filt .btn').forEach(b=>{b.addEventListener('click',()=>{vgFilt=b.dataset.vf;document.querySelectorAll('#vg-filt .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.querySelectorAll('#vg-rel-filt .btn').forEach(b=>{b.addEventListener('click',()=>{vgRelF=b.dataset.vrf;document.querySelectorAll('#vg-rel-filt .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.querySelectorAll('#vg-prog-filt .btn').forEach(b=>{b.addEventListener('click',()=>{vgProgF=b.dataset.vpf;document.querySelectorAll('#vg-prog-filt .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.getElementById('vg-srch').oninput=e=>{vgSrch=e.target.value.toLowerCase();renderVG();};
  renderVG();
  _vgRenderGar();
  _renderProgTable();
}
