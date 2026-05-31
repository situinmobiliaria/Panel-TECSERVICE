// ═══════════════════════════════════════════════════════════════
// hoja_matriz.js — Matriz Base Instalada · Contratos · Potencial
// Gráficos: Potencial vs Satisfacción · Potencial vs Equipos BI
// Foco = potencial × 60% + (5 - satisfacción) × 40%
// Depende de: MAPA_DATA (hoja_mapa.js), Chart.js (CDN)
// ═══════════════════════════════════════════════════════════════

let _mtzSortCol='pot',_mtzSortAsc=false;
let _mtzReg='todas',_mtzCC='todas',_mtzTipo='todos';
let _mtzFocoF='todos';
let _chScatSat=null,_chScatEq=null;

const REGIONES_MTZ=['todas','Metropolitana','Valparaíso',"O'Higgins",'Maule','Biobío',
  'Ñuble','Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
  'Antofagasta','Atacama','Coquimbo','Arica y Parinacota','Tarapacá'];

// ── FOCO: Potencial 60% + Satisfacción inversa 40% ───────────────
function _focoScore(c){
  const potNorm=(c.pot/500000000);
  const satInv=(5-(c.sat??3))/4;
  return potNorm*0.6+satInv*0.4;
}
function _focoLabel(score,p80,p60){
  if(score>=p80)return '<span class="badge brd2" title="Alto potencial + baja satisfacción">Foco A</span>';
  if(score>=p60)return '<span class="badge bwn">Foco B</span>';
  return '<span class="badge bgy">—</span>';
}
function _fMMz(v){if(!v||v===0)return 'MM$0';return 'MM$'+(v/1e6).toFixed(1).replace('.',',');}

// ── INIT ──────────────────────────────────────────────────────────
function initMatriz(){
  const wrap=document.getElementById('view-matriz');
  if(!wrap||wrap.dataset.init)return;
  wrap.dataset.init='1';
  wrap.innerHTML=_matrizHTML();
  _bindMatrizCtrl();
  renderMatriz();
}

function _regOptsM(){
  return REGIONES_MTZ.map(r=>`<option value="${r}">${r==='todas'?'Todas las regiones':r}</option>`).join('');
}

function _matrizHTML(){
  return `
  <div class="sh"><h2>Matriz · Base Instalada, Contratos y Potencial</h2><div class="sh-line"></div>
    <span class="sh-tag" id="mtz-tag">Clientes foco = mayor potencial + menor satisfacción</span>
  </div>

  <!-- Explicación Foco -->
  <div class="hz-box" style="margin-bottom:.75rem">
    <div class="hz-title"><span>Clasificación Foco · Lógica</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.55rem;margin-bottom:.45rem">
      <div style="background:rgba(255,255,255,.07);border-radius:6px;padding:.55rem .8rem;border-left:3px solid var(--rd)">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.78rem;color:var(--rd2)">Foco A · Top 20%</div>
        <div style="font-size:.6rem;color:rgba(255,255,255,.65);margin-top:.18rem;line-height:1.5">Alto potencial + baja satisfacción → máxima urgencia</div>
      </div>
      <div style="background:rgba(255,255,255,.07);border-radius:6px;padding:.55rem .8rem;border-left:3px solid var(--am)">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.78rem;color:var(--am2)">Foco B · Top 40%</div>
        <div style="font-size:.6rem;color:rgba(255,255,255,.65);margin-top:.18rem;line-height:1.5">Potencial medio o satisfacción media → seguimiento activo</div>
      </div>
      <div style="background:rgba(255,255,255,.07);border-radius:6px;padding:.55rem .8rem;border-left:3px solid var(--gy3)">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.78rem;color:rgba(255,255,255,.5)">Sin Foco</div>
        <div style="font-size:.6rem;color:rgba(255,255,255,.65);margin-top:.18rem;line-height:1.5">Bajo potencial y satisfacción aceptable → mantenimiento</div>
      </div>
    </div>
    <div style="font-size:.58rem;color:rgba(255,255,255,.38);font-family:'Roboto Mono',monospace">Score = Potencial × 60% + (5 − Satisfacción) × 40% · Sin satisfacción = neutro 3/5</div>
  </div>

  <!-- KPIs -->
  <div class="sumstrip" style="margin-bottom:.75rem">
    <div><div class="ss-v" id="mtz-k-tot">—</div><div class="ss-l">Clientes</div></div>
    <div><div class="ss-v" id="mtz-k-fa" style="color:var(--rd2)">—</div><div class="ss-l">Foco A</div></div>
    <div><div class="ss-v" id="mtz-k-fb" style="color:var(--am)">—</div><div class="ss-l">Foco B</div></div>
    <div><div class="ss-v" id="mtz-k-pot">—</div><div class="ss-l">Potencial Total</div></div>
    <div><div class="ss-v" id="mtz-k-bi">—</div><div class="ss-l">Equipos BI</div></div>
    <div><div class="ss-v" id="mtz-k-cc">—</div><div class="ss-l">Con Contrato</div></div>
  </div>

  <!-- Filtros -->
  <div class="card" style="margin-bottom:.75rem">
    <div class="ctrl" style="gap:.55rem;flex-wrap:wrap">
      <span class="ctrl-lbl">Región</span>
      <select id="mtz-sel-reg" style="font-size:.65rem;border:1px solid var(--brd);border-radius:5px;padding:.28rem .55rem;background:#fff;color:var(--txt);font-family:'Roboto',sans-serif">${_regOptsM()}</select>
      <span class="ctrl-lbl" style="margin-left:.35rem">Contrato</span>
      <div class="btn-g" id="mtz-btn-cc">
        <button class="btn on" data-mcc="todas">Todos</button>
        <button class="btn" data-mcc="con">Con Contrato</button>
        <button class="btn" data-mcc="sin">Sin Contrato</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.35rem">Tipo</span>
      <div class="btn-g" id="mtz-btn-tipo">
        <button class="btn on" data-mt="todos">Todos</button>
        <button class="btn" data-mt="Privado">Privado</button>
        <button class="btn" data-mt="Público">Público</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.35rem">Foco</span>
      <div class="btn-g" id="mtz-btn-foco">
        <button class="btn on" data-mf="todos">Todos</button>
        <button class="btn" data-mf="A">Solo Foco A</button>
        <button class="btn" data-mf="B">Solo Foco B</button>
      </div>
    </div>
  </div>

  <!-- Resumen región (visible solo cuando hay región seleccionada) -->
  <div id="mtz-reg-summary" style="display:none" class="card" style="margin-bottom:.75rem">
    <div class="ch"><span class="ct" id="mtz-reg-title">Resumen Región</span></div>
    <div class="cb" id="mtz-reg-body" style="padding:.65rem 1rem"></div>
  </div>

  <!-- Gráficos scatter -->
  <div class="g2" style="margin-bottom:.75rem">
    <div class="card">
      <div class="ch">
        <span class="ct">Potencial vs Satisfacción</span>
        <span style="font-size:.58rem;color:var(--mut)">Y = Potencial · X = Satisfacción (1–5)</span>
      </div>
      <div class="cb" style="padding:.6rem .7rem">
        <canvas id="mtz-scat-sat" height="290" style="display:block;width:100%"></canvas>
        <div style="font-size:.57rem;color:var(--mut);text-align:right;margin-top:.3rem">🔴 Foco A · 🟡 Foco B · ⚫ Sin foco · Tamaño = equipos BI</div>
      </div>
    </div>
    <div class="card">
      <div class="ch">
        <span class="ct">Potencial vs Equipos Instalados</span>
        <span style="font-size:.58rem;color:var(--mut)">Y = Potencial · X = Equipos BI</span>
      </div>
      <div class="cb" style="padding:.6rem .7rem">
        <canvas id="mtz-scat-eq" height="290" style="display:block;width:100%"></canvas>
        <div style="font-size:.57rem;color:var(--mut);text-align:right;margin-top:.3rem">🔴 Foco A · 🟡 Foco B · ⚫ Sin foco · Tamaño = ingreso</div>
      </div>
    </div>
  </div>

  <!-- Tabla -->
  <div class="card">
    <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .95rem;border-bottom:1px solid var(--brd);background:var(--gy);flex-wrap:wrap">
      <span style="font-size:.6rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.06em">Buscar</span>
      <input type="text" id="mtz-search" class="search-inp" placeholder="🔍 Nombre cliente..." style="width:200px;font-size:.65rem;padding:.28rem .55rem" oninput="renderMatriz()">
    </div>
    <div style="overflow-x:auto">
      <table class="tbl" id="mtz-table" style="min-width:1020px">
        <thead><tr>
          <th data-ms="n" style="min-width:200px">Cliente</th>
          <th data-ms="region">Región</th>
          <th data-ms="tipo">Tipo</th>
          <th data-ms="bi">Equipos BI</th>
          <th data-ms="contratos">Contratos</th>
          <th data-ms="ingreso">Ingreso</th>
          <th data-ms="pot">Potencial ↓</th>
          <th data-ms="margen">Margen</th>
          <th data-ms="sat" title="Menor = mayor urgencia">Satisf. ↑</th>
          <th data-ms="_score">Score</th>
          <th>Foco</th>
        </tr></thead>
        <tbody id="mtz-tbody"></tbody>
        <tfoot><tr id="mtz-foot"></tr></tfoot>
      </table>
    </div>
    <div style="padding:.4rem .9rem;background:var(--gy);border-top:1px solid var(--brd);font-size:.58rem;color:var(--mut)" id="mtz-nota">—</div>
  </div>`;
}

// ── BIND CONTROLES ────────────────────────────────────────────────
function _bindMatrizCtrl(){
  document.getElementById('mtz-sel-reg').addEventListener('change',e=>{
    _mtzReg=e.target.value;renderMatriz();
  });
  document.querySelectorAll('#mtz-btn-cc .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mtz-btn-cc .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mtzCC=b.dataset.mcc;renderMatriz();
  }));
  document.querySelectorAll('#mtz-btn-tipo .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mtz-btn-tipo .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mtzTipo=b.dataset.mt;renderMatriz();
  }));
  document.querySelectorAll('#mtz-btn-foco .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mtz-btn-foco .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mtzFocoF=b.dataset.mf;renderMatriz();
  }));
  document.querySelectorAll('#mtz-table th[data-ms]').forEach(th=>th.addEventListener('click',()=>{
    const col=th.dataset.ms;
    _mtzSortAsc=(_mtzSortCol===col)?!_mtzSortAsc:false;
    _mtzSortCol=col;renderMatriz();
  }));
}

// ── RENDER PRINCIPAL ─────────────────────────────────────────────
function renderMatriz(){
  if(typeof MAPA_DATA==='undefined')return;
  const tbody=document.getElementById('mtz-tbody');
  if(!tbody)return;

  const busq=(document.getElementById('mtz-search')?.value||'').toLowerCase().trim();
  const allScores=MAPA_DATA.map(c=>_focoScore(c)).sort((a,b)=>b-a);
  const p80=allScores[Math.floor(allScores.length*0.20)]||0;
  const p60=allScores[Math.floor(allScores.length*0.40)]||0;

  let data=MAPA_DATA.map(c=>({...c,_score:_focoScore(c)})).filter(c=>{
    if(_mtzReg!=='todas'&&c.region!==_mtzReg)return false;
    if(_mtzCC==='con'&&!c.cc)return false;
    if(_mtzCC==='sin'&&c.cc)return false;
    if(_mtzTipo!=='todos'&&c.tipo!==_mtzTipo)return false;
    if(busq&&!c.n.toLowerCase().includes(busq))return false;
    if(_mtzFocoF==='A'&&c._score<p80)return false;
    if(_mtzFocoF==='B'&&(c._score<p60||c._score>=p80))return false;
    return true;
  });

  data.sort((a,b)=>{
    let va=a[_mtzSortCol],vb=b[_mtzSortCol];
    if(typeof va==='string')return _mtzSortAsc?va.localeCompare(vb,'es'):vb.localeCompare(va,'es');
    return _mtzSortAsc?((va||0)-(vb||0)):((vb||0)-(va||0));
  });

  document.querySelectorAll('#mtz-table th[data-ms]').forEach(th=>{
    th.classList.remove('th-asc','th-desc');
    if(th.dataset.ms===_mtzSortCol)th.classList.add(_mtzSortAsc?'th-asc':'th-desc');
  });

  tbody.innerHTML=data.map(c=>{
    const fl=_focoLabel(c._score,p80,p60);
    const scoreBar=Math.round(c._score*100);
    const satColor=c.sat===null?'var(--mut)':c.sat<=2?'var(--rd)':c.sat<=3?'var(--am)':'var(--gn)';
    const satStr=c.sat!==null
      ?`<span style="font-weight:700;color:${satColor}">${c.sat}</span><span style="font-size:.55rem;color:var(--mut)">/5</span>`
      :'<span style="color:var(--mut);font-size:.6rem">S/D</span>';
    return `<tr>
      <td><strong style="font-size:.67rem">${c.n}</strong><br><span style="font-size:.57rem;color:var(--mut)">${c.region} · ${c.comuna}</span></td>
      <td><span class="badge bgy" style="font-size:.52rem">${c.region}</span></td>
      <td><span class="badge ${c.tipo==='Privado'?'baz':'bwn'}" style="font-size:.52rem">${c.tipo}</span></td>
      <td class="num">${c.bi}</td>
      <td class="num">${c.contratos>0?'<span class="pill pte">'+c.contratos+'</span>':'<span class="pill pgr">0</span>'}</td>
      <td class="num" style="color:var(--az2)">${_fMMz(c.ingreso)}</td>
      <td class="num" style="color:var(--am);font-weight:700">${_fMMz(c.pot)}</td>
      <td class="num" style="color:${c.margen>0?'var(--gn)':'var(--rd)'}">${_fMMz(c.margen)}</td>
      <td class="num" style="text-align:center">${satStr}</td>
      <td>
        <div style="display:flex;align-items:center;gap:.35rem">
          <div style="flex:1;height:5px;background:var(--gy2);border-radius:3px;overflow:hidden;min-width:32px">
            <div style="height:100%;width:${scoreBar}%;background:${c._score>=p80?'var(--rd)':c._score>=p60?'var(--am)':'var(--gy3)'};border-radius:3px"></div>
          </div>
          <span style="font-family:'Roboto Mono',monospace;font-size:.58rem;color:var(--mut);min-width:22px">${scoreBar}</span>
        </div>
      </td>
      <td>${fl}</td>
    </tr>`;
  }).join('');

  const totBi=data.reduce((s,c)=>s+c.bi,0);
  const totIng=data.reduce((s,c)=>s+c.ingreso,0);
  const totPot=data.reduce((s,c)=>s+c.pot,0);
  const totMarg=data.reduce((s,c)=>s+c.margen,0);
  const totCC=data.filter(c=>c.cc).length;
  const fa=data.filter(c=>c._score>=p80).length;
  const fb=data.filter(c=>c._score>=p60&&c._score<p80).length;

  const foot=document.getElementById('mtz-foot');
  if(foot)foot.innerHTML=`
    <td class="flab">TOTAL · ${data.length} clientes</td><td></td><td></td>
    <td class="num">${totBi}</td><td class="num">${totCC}</td>
    <td class="num" style="color:var(--teal)">${_fMMz(totIng)}</td>
    <td class="num" style="color:var(--teal)">${_fMMz(totPot)}</td>
    <td class="num" style="color:var(--teal)">${_fMMz(totMarg)}</td>
    <td></td><td></td><td></td>`;

  ['mtz-k-tot','mtz-k-fa','mtz-k-fb','mtz-k-pot','mtz-k-bi','mtz-k-cc'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.textContent=id==='mtz-k-tot'?data.length:id==='mtz-k-fa'?fa:id==='mtz-k-fb'?fb
      :id==='mtz-k-pot'?_fMMz(totPot):id==='mtz-k-bi'?totBi:totCC;
  });

  const nota=document.getElementById('mtz-nota');
  if(nota)nota.textContent=`${data.length} clientes · Foco A: ${fa} · Foco B: ${fb} · Score = potencial 60% + satisfacción inversa 40%`;
  const stag=document.getElementById('mtz-tag');
  if(stag)stag.textContent=`${data.length} clientes filtrados · Foco A: ${fa} · clic en columna para ordenar`;

  _renderResumenRegion(data,totCC,totBi,totIng,totPot);
  setTimeout(()=>_renderScatters(data,p80,p60),50);
}

// ── RESUMEN REGIÓN ────────────────────────────────────────────────
function _renderResumenRegion(data,totCC,totBi,totIng,totPot){
  const box=document.getElementById('mtz-reg-summary');
  const body=document.getElementById('mtz-reg-body');
  const title=document.getElementById('mtz-reg-title');
  if(!box||!body)return;
  if(_mtzReg==='todas'){box.style.display='none';return;}
  box.style.display='block';
  if(title)title.textContent='Resumen · '+_mtzReg;
  const privados=data.filter(c=>c.tipo==='Privado').length;
  const publicos=data.filter(c=>c.tipo==='Público').length;
  const sinSat=data.filter(c=>c.sat===null).length;
  const satProm=data.filter(c=>c.sat!==null).reduce((s,c,_,a)=>s+c.sat/a.filter(x=>x.sat!==null).length,0);
  const topFoco=data.filter(c=>{
    const allScores=MAPA_DATA.map(c=>_focoScore(c)).sort((a,b)=>b-a);
    return _focoScore(c)>=allScores[Math.floor(allScores.length*0.20)];
  }).slice(0,5);

  body.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.65rem">
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.2rem;color:var(--az3)">${data.length}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Clientes</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.2rem;color:var(--teal)">${totCC}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Con Contrato</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.2rem;color:var(--am)">${_fMMz(totPot)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Potencial</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.2rem;color:${satProm<=3?'var(--am)':'var(--gn)'}">${sinSat===data.length?'S/D':satProm.toFixed(1)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Satisf. prom.</div></div>
    </div>
    <div style="font-size:.62rem;margin-bottom:.35rem"><span style="color:var(--mut)">Tipo clientes:</span> <strong>${privados} privados</strong> · <strong>${publicos} públicos</strong> · Equipos BI: <strong>${totBi}</strong></div>
    <div style="font-size:.62rem;margin-bottom:.5rem"><span style="color:var(--mut)">Ingreso total región:</span> <strong style="color:var(--az2)">${_fMMz(totIng)}</strong></div>
    ${topFoco.length>0?`<div style="font-size:.6rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Top Foco A en la región</div>
    ${topFoco.map(c=>`<div style="display:flex;justify-content:space-between;font-size:.62rem;padding:.2rem 0;border-bottom:1px solid var(--gy)">
      <span style="font-weight:600">${c.n.length>40?c.n.slice(0,38)+'…':c.n}</span>
      <span style="color:var(--am)">${_fMMz(c.pot)}</span>
    </div>`).join('')}`:''}`;
}

// ── GRÁFICOS SCATTER ─────────────────────────────────────────────
function _renderScatters(data,p80,p60){
  _renderScatSat(data,p80,p60);
  _renderScatEq(data,p80,p60);
}

function _scatColor(c,p80,p60){
  const sc=_focoScore(c);
  if(sc>=p80)return 'rgba(192,0,0,.75)';
  if(sc>=p60)return 'rgba(255,192,0,.85)';
  return 'rgba(107,123,168,.5)';
}

function _renderScatSat(data,p80,p60){
  const canvas=document.getElementById('mtz-scat-sat');
  if(!canvas||typeof Chart==='undefined')return;
  canvas.width=canvas.parentElement?.clientWidth||600;
  const pts=data.filter(c=>c.sat!==null).map(c=>({
    x:c.sat,
    y:c.pot/1e6,
    r:Math.max(3,Math.min(16,3+c.bi/15)),
    label:c.n,
    foco:c._score>=p80?'A':c._score>=p60?'B':'—',
    cc:c.cc,
    ing:c.ingreso,
    eq:c.bi,
    region:c.region
  }));
  if(_chScatSat){_chScatSat.destroy();_chScatSat=null;}
  _chScatSat=new Chart(canvas.getContext('2d'),{
    type:'bubble',
    data:{datasets:[{
      label:'Clientes',
      data:pts,
      backgroundColor:pts.map(p=>{
        const sc=data.find(c=>c.n===p.label)?._score||0;
        return sc>=p80?'rgba(192,0,0,.72)':sc>=p60?'rgba(255,192,0,.8)':'rgba(107,123,168,.45)';
      }),
      borderColor:pts.map(p=>{
        const sc=data.find(c=>c.n===p.label)?._score||0;
        return sc>=p80?'#C00000':sc>=p60?'#FFC000':'#6B7BA8';
      }),
      borderWidth:1.2
    }]},
    options:{
      responsive:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          label:ctx=>{
            const d=ctx.raw;
            return [`${d.label.length>40?d.label.slice(0,38)+'…':d.label}`,
              `Potencial: MM$${d.y.toFixed(1)}`,
              `Satisfacción: ${d.x}/5`,
              `Equipos BI: ${d.eq}`,
              `Foco: ${d.foco} · ${d.cc?'Con contrato':'Sin contrato'}`];
          }
        }}
      },
      scales:{
        x:{title:{display:true,text:'Satisfacción actual (1-5)',font:{size:10}},
          min:0.5,max:5.5,ticks:{stepSize:1},
          grid:{color:'#E2E6F0'}},
        y:{title:{display:true,text:'Potencial (MM$)',font:{size:10}},
          beginAtZero:true,grid:{color:'#E2E6F0'},
          ticks:{callback:v=>v+'MM$'}}
      }
    }
  });
}

function _renderScatEq(data,p80,p60){
  const canvas=document.getElementById('mtz-scat-eq');
  if(!canvas||typeof Chart==='undefined')return;
  canvas.width=canvas.parentElement?.clientWidth||600;
  const maxIng=Math.max(...data.map(c=>c.ingreso),1);
  const pts=data.map(c=>({
    x:c.bi,
    y:c.pot/1e6,
    r:Math.max(3,Math.min(16,3+c.ingreso/maxIng*12)),
    label:c.n,
    foco:c._score>=p80?'A':c._score>=p60?'B':'—',
    cc:c.cc,
    sat:c.sat,
    region:c.region
  }));
  if(_chScatEq){_chScatEq.destroy();_chScatEq=null;}
  _chScatEq=new Chart(canvas.getContext('2d'),{
    type:'bubble',
    data:{datasets:[{
      label:'Clientes',
      data:pts,
      backgroundColor:pts.map(p=>{
        const sc=data.find(c=>c.n===p.label)?._score||0;
        return sc>=p80?'rgba(192,0,0,.72)':sc>=p60?'rgba(255,192,0,.8)':'rgba(107,123,168,.45)';
      }),
      borderColor:pts.map(p=>{
        const sc=data.find(c=>c.n===p.label)?._score||0;
        return sc>=p80?'#C00000':sc>=p60?'#FFC000':'#6B7BA8';
      }),
      borderWidth:1.2
    }]},
    options:{
      responsive:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          label:ctx=>{
            const d=ctx.raw;
            return [`${d.label.length>40?d.label.slice(0,38)+'…':d.label}`,
              `Potencial: MM$${d.y.toFixed(1)}`,
              `Equipos BI: ${d.x}`,
              `Satisfacción: ${d.sat??'S/D'}`,
              `Foco: ${d.foco} · ${d.region}`];
          }
        }}
      },
      scales:{
        x:{title:{display:true,text:'N° Equipos Instalados (BI)',font:{size:10}},
          beginAtZero:true,grid:{color:'#E2E6F0'}},
        y:{title:{display:true,text:'Potencial (MM$)',font:{size:10}},
          beginAtZero:true,grid:{color:'#E2E6F0'},
          ticks:{callback:v=>v+'MM$'}}
      }
    }
  });
}

// ── HOOK sv() ────────────────────────────────────────────────────
(function(){
  const orig=window.sv;
  if(typeof orig==='function'){
    window.sv=function(name,btn){
      orig(name,btn);
      if(name==='matriz')setTimeout(initMatriz,80);
    };
  }
})();
