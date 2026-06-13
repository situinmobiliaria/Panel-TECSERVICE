// ═══════════════════════════════════════════════════════════════
// hoja_nuevos.js — Nuevos Clientes
// Depende de: datos.js (NC_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let ncDays=30, ncTip='todos', ncSF='n', ncSA=true, ncSrch='';

function ncFilter(){
  return NC_DATA.filter(d=>{
    const pOk=ncDays===9999||(d.dias_inicio_cli>=0&&d.dias_inicio_cli<=ncDays);
    const tOk=ncTip==='todos'||d.tipo===ncTip;
    const sOk=!ncSrch||d.cliente.toLowerCase().includes(ncSrch)||d.coord.toLowerCase().includes(ncSrch);
    return pOk&&tOk&&sOk;
  }).sort((a,b)=>{let va=a[ncSF],vb=b[ncSF];if(typeof va==='string'){va=va.toLowerCase();vb=vb.toLowerCase();}return ncSA?(va>vb?1:-1):(va<vb?1:-1);});
}

function renderNC(){
  const d=ncFilter();
  const totalVal=d.reduce((s,c)=>s+c.val,0);
  const clientes=new Set(d.map(c=>c.cliente)).size;
  const garN=d.filter(c=>c.tipo==='Garantia').length;
  document.getElementById('nc-k1').textContent=clientes;
  document.getElementById('nc-k2').textContent=d.length;
  document.getElementById('nc-k3').textContent=garN;
  document.getElementById('nc-k4').textContent=mm(totalVal);
  const oldest=d.filter(c=>c.dias_inicio_cli>=0);
  if(oldest.length){const mx=Math.max(...oldest.map(c=>c.dias_inicio_cli));const fr=new Date();fr.setDate(fr.getDate()-mx);document.getElementById('nc-k5').textContent=fr.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'2-digit'})+' → hoy';}
  document.getElementById('nc-tag').textContent=`Nuevos clientes · Período: ${ncDays===9999?'Histórico completo':ncDays+'d'} · ${d.length} contratos`;

  document.getElementById('tb-nc').innerHTML=d.length?d.map(r=>`<tr>
    <td class="num">${r.n}</td>
    <td style="font-size:.67rem">${shortN(r.cliente)}</td>
    <td style="font-size:.62rem;color:var(--mut)">${shortC(r.coord)}</td>
    <td>${tipoBadge(r.tipo)}</td>
    <td style="text-align:center">${_progBadge(r.programa||'')}</td>
    <td style="font-size:.67rem">${r.inicio_fmt}</td>
    <td style="font-size:.67rem">${r.fin_fmt}</td>
    <td class="num" style="color:${r.val>0?'var(--az2)':'var(--mut)'}">${r.val>0?mm(r.val):'—'}</td>
    <td class="num" style="color:var(--mut)">${pctOf(r.val,totalVal)}</td>
    <td>${urgP(r.dias_vence)}</td>
    <td><span class="pill pgr">${r.dias_inicio_cli<0?'Futuro':r.dias_inicio_cli+'d'}</span></td>
  </tr>`).join(''):`<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--mut);font-size:.75rem">Sin resultados para este período/filtro</td></tr>`;

  document.getElementById('nc-ftl').textContent=`${d.length} contratos · ${clientes} clientes nuevos · ${garN} tipo Garantía`;
  document.getElementById('nc-ftr').textContent=totalVal>0?'+ '+mm(totalVal):'Sin valor económico';
}
function ncSort(f){ncSA=ncSF===f?!ncSA:true;ncSF=f;renderNC();}

function initNuevos(){
  const sl=document.getElementById('nc-sl');
  const sv2=document.getElementById('nc-sv');
  sl.addEventListener('input',()=>{ncDays=+sl.value;sv2.textContent=ncDays+'d';document.querySelectorAll('#nc-pre .btn').forEach(b=>b.classList.toggle('on',+b.dataset.d===ncDays));renderNC();});
  document.querySelectorAll('#nc-pre .btn').forEach(b=>{b.addEventListener('click',()=>{ncDays=b.dataset.d==='9999'?9999:+b.dataset.d;sl.value=Math.min(ncDays===9999?730:ncDays,730);sv2.textContent=ncDays===9999?'Todo':ncDays+'d';document.querySelectorAll('#nc-pre .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderNC();});});
  document.querySelectorAll('#nc-tip .btn').forEach(b=>{b.addEventListener('click',()=>{ncTip=b.dataset.t;document.querySelectorAll('#nc-tip .btn').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderNC();});});
  document.getElementById('nc-srch').oninput=e=>{ncSrch=e.target.value.toLowerCase();renderNC();};
  renderNC();
}
