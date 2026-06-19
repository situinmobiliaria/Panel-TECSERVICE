// ═══════════════════════════════════════════════════════════════
// hoja_vision.js — Visión General de Contratos
// Depende de: datos.js (DATA, PERDIDOS_VG, FAC_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let vgSortF='val', vgFilt='todos', vgRelF='todos', vgSrch='', vgSortA=false;
let vgSortCF='', vgSortCA=true;

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
      <td>${esPerdidoFac?'<span style="font-size:.6rem;color:var(--mut)">Expirado</span>':tipoBadge(x.tipo)}</td>
      <td style="text-align:center">${esPerdidoFac?'—':_progBadge(x.programa||'')}</td>
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
  }).join('')||`<tr><td colspan="15" style="text-align:center;padding:2rem;color:var(--mut)">Sin resultados</td></tr>`;

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

function initVision(){
  document.querySelectorAll('#vg-sort .btn').forEach(b=>{b.addEventListener('click',()=>{vgSortF=b.dataset.vs;vgSortCF='';document.querySelectorAll('#vg-sort .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.querySelectorAll('#vg-filt .btn').forEach(b=>{b.addEventListener('click',()=>{vgFilt=b.dataset.vf;document.querySelectorAll('#vg-filt .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.querySelectorAll('#vg-rel-filt .btn').forEach(b=>{b.addEventListener('click',()=>{vgRelF=b.dataset.vrf;document.querySelectorAll('#vg-rel-filt .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderVG();});});
  document.getElementById('vg-srch').oninput=e=>{vgSrch=e.target.value.toLowerCase();renderVG();};
  renderVG();
  _renderProgTable();
}
