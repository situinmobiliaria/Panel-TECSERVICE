import json, os

with open('mapa_data_clean.json', encoding='utf-8') as f:
    raw = f.read()

JS = """// ═══════════════════════════════════════════════════════════════
// hoja_mapa.js — Mapa Interactivo de Clientes · Chile
// Depende de: Leaflet.js (CDN en template.html)
// ═══════════════════════════════════════════════════════════════

const MAPA_DATA = """ + raw + """;

let _mapaInited=false,_mapaLeaflet=null,_mapaLayer=null;
let _mapaMetrica='ingreso',_mapaFiltroCC='todos',_mapaFiltroReg='todas';

const REGIONES_MAPA=['todas','Metropolitana','Valparaíso',"O'Higgins",'Maule','Biobío',
  'Ñuble','Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
  'Antofagasta','Atacama','Coquimbo','Arica y Parinacota','Tarapacá'];

function _fMM(v){if(!v||v===0)return 'MM$0';return 'MM$'+(v/1e6).toFixed(1).replace('.',',');}
function _metVal(c){return _mapaMetrica==='ingreso'?c.ingreso:_mapaMetrica==='equipos'?c.bi:c.pot;}
function _metLbl(){return _mapaMetrica==='ingreso'?'Ingreso':_mapaMetrica==='equipos'?'Equipos BI':'Potencial';}
function _mapaCol(c){if(c.cc)return '#28D2C3';if(c.pot>100e6)return '#FFC000';return '#6B7BA8';}
function _mapaR(c,mx){const v=_metVal(c);if(!v||mx===0)return 5;return Math.min(Math.max(5+26*Math.sqrt(v/mx),4),32);}
function _filtrados(){
  return MAPA_DATA.filter(c=>{
    if(_mapaFiltroCC==='con'&&!c.cc)return false;
    if(_mapaFiltroCC==='sin'&&c.cc)return false;
    if(_mapaFiltroReg!=='todas'&&c.region!==_mapaFiltroReg)return false;
    return true;
  });
}

/* ── INIT ── */
function initMapa(){
  const wrap=document.getElementById('view-mapa');
  if(!wrap||wrap.dataset.init)return;
  wrap.dataset.init='1';
  wrap.innerHTML=_mapaHTML();
  _bindMapaCtrl();
  _renderMapa();
}

function _regOpts(){
  return REGIONES_MAPA.map(r=>`<option value="${r}">${r==='todas'?'Todas las regiones':r}</option>`).join('');
}

function _mapaHTML(){
  return `
  <div class="sh"><h2>Mapa de Clientes · Chile</h2><div class="sh-line"></div>
    <span class="sh-tag" id="mapa-sh-tag">324 clientes · base instalada, contratos y potencial 2026</span></div>

  <div class="sumstrip" style="margin-bottom:.75rem">
    <div><div class="ss-v" id="mk-tot">—</div><div class="ss-l">Clientes</div></div>
    <div><div class="ss-v" id="mk-cc">—</div><div class="ss-l">Con Contrato</div></div>
    <div><div class="ss-v" id="mk-bi">—</div><div class="ss-l">Equipos BI</div></div>
    <div><div class="ss-v" id="mk-ing">—</div><div class="ss-l">Ingreso Total</div></div>
    <div><div class="ss-v" id="mk-pot">—</div><div class="ss-l">Potencial Total</div></div>
  </div>

  <div class="card" style="margin-bottom:.75rem">
    <div class="ctrl" style="gap:.6rem;flex-wrap:wrap">
      <span class="ctrl-lbl">Métrica burbujas</span>
      <div class="btn-g" id="mp-m">
        <button class="btn on" data-m="ingreso">Ingreso</button>
        <button class="btn" data-m="equipos">Equipos BI</button>
        <button class="btn" data-m="pot">Potencial</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.4rem">Contrato</span>
      <div class="btn-g" id="mp-cc">
        <button class="btn on" data-cc="todos">Todos</button>
        <button class="btn" data-cc="con">Con Contrato</button>
        <button class="btn" data-cc="sin">Sin Contrato</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.4rem">Región</span>
      <select id="mp-reg" style="font-size:.65rem;border:1px solid var(--brd);border-radius:5px;padding:.28rem .55rem;background:#fff;color:var(--txt);font-family:'Roboto',sans-serif">${_regOpts()}</select>
      <div style="display:flex;gap:.6rem;align-items:center;margin-left:auto">
        <span style="font-size:.58rem;font-weight:700;color:var(--mut);text-transform:uppercase">Leyenda:</span>
        <span style="font-size:.6rem;color:var(--mut);display:flex;align-items:center;gap:.28rem"><span style="width:9px;height:9px;border-radius:50%;background:#28D2C3;display:inline-block"></span>Con Contrato</span>
        <span style="font-size:.6rem;color:var(--mut);display:flex;align-items:center;gap:.28rem"><span style="width:9px;height:9px;border-radius:50%;background:#FFC000;display:inline-block"></span>Alto Potencial</span>
        <span style="font-size:.6rem;color:var(--mut);display:flex;align-items:center;gap:.28rem"><span style="width:9px;height:9px;border-radius:50%;background:#6B7BA8;display:inline-block"></span>Sin Contrato</span>
      </div>
    </div>
  </div>

  <div class="g6040" style="margin-bottom:.75rem;align-items:start">
    <div class="card">
      <div id="mp-leaflet" style="height:520px;border-radius:8px;overflow:hidden;z-index:1"></div>
    </div>
    <div class="card" style="display:flex;flex-direction:column">
      <div class="ch"><span class="ct" id="mp-panel-title">Resumen por Región</span></div>
      <div class="cb" style="padding:.65rem .85rem;max-height:520px;overflow-y:auto;flex:1" id="mp-panel">
        <div style="color:var(--mut);font-size:.72rem;text-align:center;padding:2rem 0">Haz clic en un cliente<br>para ver su detalle completo</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="ch"><span class="ct">Resumen por Región · Clientes Visibles</span></div>
    <div style="overflow-x:auto">
      <table class="tbl" id="mp-reg-tbl">
        <thead><tr>
          <th>Región</th><th>Clientes</th><th>Con Contrato</th>
          <th>Equipos BI</th><th>Ingreso</th><th>Potencial</th><th>Margen</th>
        </tr></thead>
        <tbody id="mp-reg-tbody"></tbody>
      </table>
    </div>
  </div>`;
}

/* ── BIND CONTROLES ── */
function _bindMapaCtrl(){
  document.querySelectorAll('#mp-m .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mp-m .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mapaMetrica=b.dataset.m;_renderMarkers();
  }));
  document.querySelectorAll('#mp-cc .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mp-cc .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mapaFiltroCC=b.dataset.cc;_renderMarkers();
  }));
  document.getElementById('mp-reg').addEventListener('change',e=>{
    _mapaFiltroReg=e.target.value;_renderMarkers();
    if(_mapaLeaflet&&_mapaFiltroReg!=='todas'){
      const pts=_filtrados();
      if(pts.length>0)_mapaLeaflet.fitBounds(L.latLngBounds(pts.map(c=>[c.lat,c.lon])),{padding:[30,30]});
    }
  });
}

/* ── RENDER MAPA ── */
function _renderMapa(){
  if(!_mapaLeaflet){
    _mapaLeaflet=L.map('mp-leaflet',{zoomControl:true}).setView([-35.5,-70.5],5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
      attribution:'© OpenStreetMap © CARTO',maxZoom:18
    }).addTo(_mapaLeaflet);
  }
  _renderMarkers();
  _renderRegTable();
  _kpis(MAPA_DATA);
}

function _renderMarkers(){
  if(!_mapaLeaflet)return;
  if(!_mapaLayer){_mapaLayer=L.layerGroup().addTo(_mapaLeaflet);}
  _mapaLayer.clearLayers();
  const filt=_filtrados();
  const mx=Math.max(...filt.map(c=>_metVal(c)),1);
  filt.forEach(c=>{
    const circ=L.circleMarker([c.lat,c.lon],{
      radius:_mapaR(c,mx),fillColor:_mapaCol(c),color:'#fff',
      weight:1.5,opacity:.9,fillOpacity:.82
    });
    circ.bindTooltip(
      `<strong style="font-size:.72rem">${c.n}</strong><br>`+
      `<span style="font-size:.62rem;color:#888">${c.region} · ${c.comuna}</span><br>`+
      `<span style="font-size:.62rem">${_metLbl()}: <strong>${_mapaMetrica==='equipos'?_metVal(c):_fMM(_metVal(c))}</strong></span>`,
      {sticky:true,opacity:.95}
    );
    circ.on('click',()=>_showPanel(c));
    _mapaLayer.addLayer(circ);
  });
  _kpis(filt);
  const tag=document.getElementById('mapa-sh-tag');
  if(tag)tag.textContent=filt.length+' clientes visibles · métrica: '+_metLbl();
  _renderRegTable();
}

function _showPanel(c){
  const pt=document.getElementById('mp-panel-title');
  const pb=document.getElementById('mp-panel');
  if(!pb)return;
  if(pt)pt.textContent='Detalle Cliente';
  const eqR=Object.entries(c.eq).filter(([,v])=>v>0)
    .map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:.18rem 0;border-bottom:1px solid var(--gy);font-size:.63rem"><span style="color:var(--mut)">${k}</span><strong>${v}</strong></div>`).join('');
  pb.innerHTML=`
    <div style="margin-bottom:.6rem">
      <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.82rem;color:var(--az1);line-height:1.3;margin-bottom:.3rem">${c.n}</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.35rem">
        <span class="badge ${c.cc?'bte':'bgy'}">${c.cc?'Con Contrato':'Sin Contrato'}</span>
        <span class="badge ${c.tipo==='Privado'?'baz':'bwn'}">${c.tipo}</span>
      </div>
      <div style="font-size:.62rem;color:var(--mut)">${c.region} · ${c.comuna}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.6rem">
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.1rem;color:var(--az3)">${_fMM(c.ingreso)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Ingreso</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.1rem;color:var(--am)">${_fMM(c.pot)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Potencial</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.1rem;color:var(--az2)">${c.bi}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Equipos BI</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.1rem;color:${c.margen>0?'var(--gn)':'var(--rd)'}">${_fMM(c.margen)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Margen</div></div>
    </div>
    ${c.contratos>0?`<div style="font-size:.62rem;margin-bottom:.3rem"><span style="color:var(--mut)">Contratos vigentes:</span> <strong>${c.contratos}</strong></div>`:''}
    ${c.pipe>0?`<div style="font-size:.62rem;margin-bottom:.3rem"><span style="color:var(--mut)">Pipeline 2026:</span> <strong style="color:var(--am)">${_fMM(c.pipe)}</strong></div>`:''}
    ${c.sat!==null?`<div style="font-size:.62rem;margin-bottom:.3rem"><span style="color:var(--mut)">Satisfacción:</span> <strong style="color:${c.sat<=2?'var(--rd)':c.sat<=3?'var(--am)':'var(--gn)'}">${c.sat}/5</strong></div>`:''}
    ${eqR?`<div style="margin-top:.5rem"><div style="font-size:.58rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.28rem">Equipos por línea</div>${eqR}</div>`:''}
    <button onclick="_showRegPanel()" style="width:100%;margin-top:.7rem;background:var(--gy2);border:1px solid var(--brd);color:var(--mut);font-size:.6rem;font-family:'Roboto',sans-serif;padding:.28rem;border-radius:5px;cursor:pointer">← Volver al resumen regional</button>`;
}

function _showRegPanel(){
  const pt=document.getElementById('mp-panel-title');
  const pb=document.getElementById('mp-panel');
  if(!pb)return;
  if(pt)pt.textContent='Resumen por Región';
  const filt=_filtrados();const byR={};
  filt.forEach(c=>{
    if(!byR[c.region])byR[c.region]={n:0,cc:0,bi:0,ing:0,pot:0};
    byR[c.region].n++;if(c.cc)byR[c.region].cc++;
    byR[c.region].bi+=c.bi;byR[c.region].ing+=c.ingreso;byR[c.region].pot+=c.pot;
  });
  pb.innerHTML=Object.entries(byR).sort((a,b)=>b[1].ing-a[1].ing).map(([reg,d])=>`
    <div style="padding:.42rem 0;border-bottom:1px solid var(--gy2);cursor:pointer" onclick="document.getElementById('mp-reg').value='${reg}';_mapaFiltroReg='${reg}';_renderMarkers();">
      <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.75rem;color:var(--az1)">${reg}</div>
      <div style="display:flex;gap:.5rem;margin-top:.1rem;font-size:.6rem;color:var(--mut)">
        <span>${d.n} clientes · <strong style="color:var(--teal)">${d.cc} contratos</strong></span>
        <span>${d.bi} equipos</span>
      </div>
      <div style="display:flex;gap:.5rem;font-size:.6rem;margin-top:.08rem">
        <span style="color:var(--az2)">${_fMM(d.ing)}</span>
        <span style="color:var(--am)">Pot: ${_fMM(d.pot)}</span>
      </div>
    </div>`).join('');
}

function _kpis(data){
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  s('mk-tot',data.length);
  s('mk-cc',data.filter(c=>c.cc).length);
  s('mk-bi',data.reduce((s,c)=>s+c.bi,0));
  s('mk-ing',_fMM(data.reduce((s,c)=>s+c.ingreso,0)));
  s('mk-pot',_fMM(data.reduce((s,c)=>s+c.pot,0)));
}

function _renderRegTable(){
  const tbody=document.getElementById('mp-reg-tbody');if(!tbody)return;
  const filt=_filtrados();const byR={};
  filt.forEach(c=>{
    if(!byR[c.region])byR[c.region]={n:0,cc:0,bi:0,ing:0,pot:0,marg:0};
    byR[c.region].n++;if(c.cc)byR[c.region].cc++;
    byR[c.region].bi+=c.bi;byR[c.region].ing+=c.ingreso;
    byR[c.region].pot+=c.pot;byR[c.region].marg+=c.margen;
  });
  tbody.innerHTML=Object.entries(byR).sort((a,b)=>b[1].ing-a[1].ing).map(([reg,d])=>`
    <tr>
      <td><strong>${reg}</strong></td>
      <td class="num">${d.n}</td>
      <td><span class="pill pte">${d.cc}</span> <span style="font-size:.57rem;color:var(--mut)">/ ${d.n}</span></td>
      <td class="num">${d.bi}</td>
      <td class="num" style="color:var(--az2)">${_fMM(d.ing)}</td>
      <td class="num" style="color:var(--am)">${_fMM(d.pot)}</td>
      <td class="num" style="color:${d.marg>0?'var(--gn)':'var(--rd)'}">${_fMM(d.marg)}</td>
    </tr>`).join('');
}

/* ── HOOK sv() ── */
(function(){
  const orig=window.sv;
  if(typeof orig==='function'){
    window.sv=function(name,btn){
      orig(name,btn);
      if(name==='mapa'){
        if(!_mapaInited){_mapaInited=true;setTimeout(initMapa,80);}
        else{setTimeout(()=>{if(_mapaLeaflet)_mapaLeaflet.invalidateSize();},100);}
      }
    };
  }
})();
"""

with open('hoja_mapa.js', 'w', encoding='utf-8') as f:
    f.write(JS)

size = os.path.getsize('hoja_mapa.js')
print(f'hoja_mapa.js limpio: {size:,} bytes ({size//1024} KB)')
