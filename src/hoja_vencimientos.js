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

  document.getElementById('hk1').textContent=data.length;
  document.getElementById('hk2').textContent=new Set(data.map(d=>d.cliente)).size;
  document.getElementById('hk3').textContent=mm(totalHzVal);
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
    <td>${tipoBadge(d.tipo)}</td>
    <td style="text-align:center">${_progBadge(d.programa||'')}</td>
    <td style="font-size:.67rem">${d.fin_fmt}</td>
    <td>${urgP(d.dias_vence)}</td>
    <td class="num" style="color:${d.val>0?'var(--az2)':'var(--mut)'}">${d.val>0?mm(d.val):'—'}</td>
    <td class="num" style="color:var(--mut)">${pctOf(d.val,totalHzVal)}</td>
    <td style="min-width:75px">${pbarHTML(d.pct_consumido,urgC(d.dias_vence))}<span style="font-size:.6rem;color:var(--mut)">${d.pct_consumido}%</span></td>
  </tr>`;}).join('')||`<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--mut)">Sin contratos en este horizonte</td></tr>`;

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
