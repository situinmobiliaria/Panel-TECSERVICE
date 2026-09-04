// ═══════════════════════════════════════════════════════════════
// hoja_mapa.js — Mapa Interactivo de Clientes · Chile
// Depende de: Leaflet.js (CDN en template.html)
// ═══════════════════════════════════════════════════════════════

const MAPA_DATA = window.MAPA_DATA || [];

let _mapaInited=false,_mapaLeaflet=null,_mapaLayer=null;
let _mapaMetrica='ingreso',_mapaFiltroCC='todos',_mapaFiltroReg='todas';
let _mapaIngrYear='2026';
let _drawMode=false,_drawPts=[],_drawLine=null,_drawMarkers=[],_drawPoly=null;

const REGIONES_MAPA=['todas','Metropolitana','Valparaíso',"O'Higgins",'Maule','Biobío',
  'Ñuble','Araucanía','Los Ríos','Los Lagos','Aysén','Magallanes',
  'Antofagasta','Atacama','Coquimbo','Arica y Parinacota','Tarapacá'];

function _fMM(v){if(!v||v===0)return 'MM$0';return 'MM$'+fN1(v/1e6);}
// Formato con separador de miles para tabla de regiones
function _fT(v){if(!v||v===0)return '—';return 'MM$'+Math.round(v/1e6).toLocaleString('es-CL');}

function _getIngreso(c){
  if(_mapaIngrYear==='2025')return c.ingreso_2025||0;
  if(_mapaIngrYear==='ambos')return (c.ingreso_2025||0)+(c.ingreso_2026||0);
  return c.ingreso_2026||c.ingreso||0;
}

function _metVal(c){
  if(_mapaMetrica==='ingreso') return _getIngreso(c);
  if(_mapaMetrica==='equipos') return c.bi;
  if(_mapaMetrica==='pot_st')  return c.pot_st||0;
  if(_mapaMetrica==='pot_st_gar')   return c.pot_st_gar||0;
  if(_mapaMetrica==='pot_st_contr') return c.pot_st_contr||0;
  if(_mapaMetrica==='pot_eq')  return c.pot_eq||0;
  return c.pot;
}
function _metLbl(){
  if(_mapaMetrica==='ingreso') return _mapaIngrYear==='ambos'?'Ingreso 25+26':_mapaIngrYear==='2025'?'Ingreso 2025':'Ingreso 2026';
  if(_mapaMetrica==='equipos') return 'Equipos ST';
  if(_mapaMetrica==='pot_st')  return 'Potencial ST Total';
  if(_mapaMetrica==='pot_st_gar')   return 'Pot. ST · Garantías';
  if(_mapaMetrica==='pot_st_contr') return 'Pot. ST · BI Actual';
  if(_mapaMetrica==='pot_eq')  return 'Potencial Equipos';
  return 'Potencial';
}
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
  <div class="sh"><h2>Mapa Clientes Actuales</h2><div class="sh-line"></div>
    <span class="sh-tag" id="mapa-sh-tag">Clientes · base instalada, contratos y potencial</span></div>

  <div class="sumstrip" style="margin-bottom:.75rem">
    <div><div class="ss-v" id="mk-tot">—</div><div class="ss-l">Clientes</div></div>
    <div><div class="ss-v" id="mk-cc">—</div><div class="ss-l">Con Contrato</div></div>
    <div><div class="ss-v" id="mk-bi">—</div><div class="ss-l">Equipos ST</div></div>
    <div><div class="ss-v" id="mk-ing">—</div><div class="ss-l" id="mk-ing-lbl">Ingreso 2026</div></div>
    <div><div class="ss-v" id="mk-pot">—</div><div class="ss-l">Potencial Total</div></div>
  </div>

  <div class="card" style="margin-bottom:.75rem">
    <div class="ctrl" style="gap:.6rem;flex-wrap:wrap">
      <span class="ctrl-lbl">Métrica burbujas</span>
      <div class="btn-g" id="mp-m">
        <button class="btn on" data-m="ingreso">Ingreso</button>
        <button class="btn" data-m="equipos">Equipos ST</button>
        <button class="btn" data-m="pot_st">Pot. ST Total</button>
        <button class="btn" data-m="pot_st_gar">↳ Garantías</button>
        <button class="btn" data-m="pot_st_contr">↳ BI Actual</button>
        <button class="btn" data-m="pot_eq">Pot. Equipos</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.4rem">Año ingreso</span>
      <div class="btn-g" id="mp-ing-yr">
        <button class="btn on" data-iyr="2026">2026</button>
        <button class="btn" data-iyr="2025">2025</button>
        <button class="btn" data-iyr="ambos">Ambos</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.4rem">Contrato</span>
      <div class="btn-g" id="mp-cc">
        <button class="btn on" data-cc="todos">Todos</button>
        <button class="btn" data-cc="con">Con Contrato</button>
        <button class="btn" data-cc="sin">Sin Contrato</button>
      </div>
      <span class="ctrl-lbl" style="margin-left:.4rem">Región</span>
      <select id="mp-reg" style="font-size:.65rem;border:1px solid var(--brd);border-radius:5px;padding:.28rem .55rem;background:#fff;color:var(--txt);font-family:'Roboto',sans-serif">${_regOpts()}</select>
      <button id="mp-draw-btn" onclick="_iniciarPoligono()" style="background:var(--az2);border:none;color:#fff;font-family:'Roboto',sans-serif;font-size:.6rem;font-weight:700;padding:.25rem .7rem;border-radius:20px;cursor:pointer;letter-spacing:.04em;text-transform:uppercase;margin-left:.5rem">✏️ Dibujar Zona</button>
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

  <!-- Instrucción polígono -->
  <div id="mp-poly-hint" style="display:none;background:var(--am2);border:1px solid var(--am);border-radius:6px;padding:.5rem .85rem;margin-bottom:.6rem;font-size:.68rem;color:#7A5200">
    ✏️ <strong>Modo dibujo activo:</strong> haz clic en el mapa para agregar vértices · doble clic para cerrar el polígono
    <button onclick="_cancelarPoligono()" style="margin-left:.8rem;background:var(--am);border:none;border-radius:4px;padding:.15rem .55rem;font-size:.6rem;font-weight:700;cursor:pointer;font-family:'Roboto',sans-serif">✕ Cancelar</button>
  </div>

  <!-- Resumen polígono -->
  <div id="mp-poly-result" style="display:none" class="card" style="margin-bottom:.75rem">
    <div class="ch" style="justify-content:space-between">
      <span class="ct" id="mp-poly-title">Polígono seleccionado</span>
      <button onclick="_limpiarPoligono()" style="background:none;border:1px solid var(--brd);color:var(--mut);font-size:.58rem;font-family:'Roboto',sans-serif;padding:.18rem .5rem;border-radius:4px;cursor:pointer">✕ Limpiar</button>
    </div>
    <div class="cb" id="mp-poly-body"></div>
  </div>

  <div class="card">
    <div class="ch"><span class="ct">Resumen por Región · Clientes Visibles</span></div>
    <div style="overflow-x:auto">
      <table class="tbl" id="mp-reg-tbl">
        <thead><tr>
          <th>Región</th><th>Clientes</th><th>Con Contrato</th><th>% Contrato</th>
          <th>Equipos ST</th><th>Ingreso</th><th>Potencial Eq.</th>
          <th>Pot. ST<br><span style="font-weight:400;font-size:.55rem">Garantías</span></th>
          <th>Pot. ST<br><span style="font-weight:400;font-size:.55rem">BI Actual</span></th>
          <th>Pot. ST<br><span style="font-weight:400;font-size:.55rem">Total</span></th>
          <th>Pot. ST<br><span style="font-weight:400;font-size:.55rem">/ cliente</span></th>
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
  document.querySelectorAll('#mp-ing-yr .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mp-ing-yr .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mapaIngrYear=b.dataset.iyr;_renderMarkers();
  }));
  document.querySelectorAll('#mp-cc .btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#mp-cc .btn').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');_mapaFiltroCC=b.dataset.cc;_renderMarkers();
  }));
  document.getElementById('mp-reg').addEventListener('change',e=>{
    _mapaFiltroReg=e.target.value;_renderMarkers();
    if(_mapaLeaflet&&_mapaFiltroReg!=='todas'){
      const pts=_filtrados().filter(c=>c.lat!=null&&c.lon!=null);
      if(pts.length>0)_mapaLeaflet.fitBounds(L.latLngBounds(pts.map(c=>[c.lat,c.lon])),{padding:[30,30]});
    }
  });
}

/* ── RENDER MAPA ── */
function _renderMapa(){
  if(!_mapaLeaflet){
    _mapaLeaflet=L.map('mp-leaflet',{zoomControl:true,doubleClickZoom:false}).setView([-35.5,-70.5],5);
    mapaTiles(_mapaLeaflet);
    _mapaLeaflet.on('click',_onMapClick);
    _mapaLeaflet.on('dblclick',_onMapDblClick);
  }
  _renderMarkers();
  _renderRegTable();
  _kpis(MAPA_DATA);
  _showRegPanel();
}

function _renderMarkers(){
  if(!_mapaLeaflet)return;
  if(!_mapaLayer){_mapaLayer=L.layerGroup().addTo(_mapaLeaflet);}
  _mapaLayer.clearLayers();
  const filt=_filtrados();
  const mx=Math.max(...filt.map(c=>_metVal(c)),1);
  // Los clientes sin coordenadas cargadas no se dibujan, pero sí cuentan en
  // los KPI y en la tabla por región.
  filt.filter(c=>c.lat!=null&&c.lon!=null).forEach(c=>{
    const circ=L.circleMarker([c.lat,c.lon],{
      radius:_mapaR(c,mx),fillColor:_mapaCol(c),color:'#fff',
      weight:1.5,opacity:.9,fillOpacity:.82
    });
    circ.bindTooltip(
      `<strong style="font-size:.72rem">${c.n}</strong><br>`+
      `<span style="font-size:.62rem;color:#888">${c.region} · ${c.comuna}</span><br>`+
      `<span style="font-size:.62rem">Ing 2026: <strong>${_fMM(c.ingreso_2026||c.ingreso||0)}</strong> · 2025: <strong>${_fMM(c.ingreso_2025||0)}</strong></span><br>`+
      `<span style="font-size:.62rem">Pot.Eq: <strong>${_fMM(c.pot_eq||0)}</strong> · Pot.ST: <strong>${_fMM(c.pot_st||0)}</strong></span>`,
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

/* ── PANEL DETALLE CLIENTE ── */
function _showPanel(c){
  const pt=document.getElementById('mp-panel-title');
  const pb=document.getElementById('mp-panel');
  if(!pb)return;
  if(pt)pt.textContent='Detalle Cliente';

  // Equipos instalados por línea
  const eqR=Object.entries(c.eq||{}).filter(([,v])=>v>0)
    .map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:.18rem 0;border-bottom:1px solid var(--gy);font-size:.63rem"><span style="color:var(--mut)">${k}</span><strong>${v}</strong></div>`).join('');

  // Breakdown Potencial Equipos por línea (R+S+T)
  const peItems=[
    {l:'Esterilización',v:c.pot_eq_ester||0},
    {l:'Endoscopía',v:c.pot_eq_endo||0},
    {l:'Dental',v:c.pot_eq_dental||0},
  ].filter(x=>x.v>0);
  const peDetail=peItems.length>0
    ?`<div style="margin-top:.35rem">`+peItems.map(x=>
        `<div style="display:flex;justify-content:space-between;padding:.15rem 0;border-bottom:1px solid var(--gy);font-size:.6rem"><span style="color:var(--mut)">↳ ${x.l}</span><span style="color:var(--az2)">${_fMM(x.v)}</span></div>`
      ).join('')+`</div>`
    :'';

  // Breakdown Potencial ST
  const psItems=[
    {l:'Por Garantías',v:c.pot_st_gar||0,col:'var(--teal)'},
    {l:'Por Contratos BI Actual',v:c.pot_st_contr||0,col:'var(--az2)'},
  ].filter(x=>x.v>0);
  const psDetail=psItems.length>0
    ?`<div style="margin-top:.35rem">`+psItems.map(x=>
        `<div style="display:flex;justify-content:space-between;padding:.15rem 0;border-bottom:1px solid var(--gy);font-size:.6rem"><span style="color:var(--mut)">↳ ${x.l}</span><span style="color:${x.col}">${_fMM(x.v)}</span></div>`
      ).join('')+`</div>`
    :'';

  pb.innerHTML=`
    <div style="margin-bottom:.6rem">
      <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.82rem;color:var(--az1);line-height:1.3;margin-bottom:.3rem">${c.n}</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.35rem">
        <span class="badge ${c.cc?'bte':'bgy'}">${c.cc?'Con Contrato':'Sin Contrato'}</span>
        <span class="badge ${c.tipo==='Privado'?'baz':'bwn'}">${c.tipo}</span>
      </div>
      <div style="font-size:.62rem;color:var(--mut)">${c.region} · ${c.comuna}</div>
    </div>

    <!-- Ingreso + Equipos -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.55rem">
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.05rem;color:var(--az3)">${_fMM(c.ingreso_2026||c.ingreso||0)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Ingreso 2026</div>
      </div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.05rem;color:var(--az3)">${_fMM(c.ingreso_2025||0)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Ingreso 2025</div>
      </div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.05rem;color:var(--az2)">${c.bi}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Equipos ST</div>
      </div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.05rem;color:var(--teal)">${c.contratos}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Contratos</div>
      </div>
    </div>

    <!-- Potencial Equipos -->
    ${(c.pot_eq||0)>0?`
    <div style="background:var(--gy);border-radius:6px;padding:.5rem .7rem;margin-bottom:.4rem">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.6rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em">Potencial Equipos</span>
        <span style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:.92rem;color:var(--am)">${_fMM(c.pot_eq)}</span>
      </div>
      ${peDetail}
    </div>`:''}

    <!-- Potencial ST -->
    ${(c.pot_st||0)>0?`
    <div style="background:var(--gy);border-radius:6px;padding:.5rem .7rem;margin-bottom:.4rem">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.6rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em">Potencial ST</span>
        <span style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:.92rem;color:var(--am)">${_fMM(c.pot_st)}</span>
      </div>
      ${psDetail}
    </div>`:''}

    <!-- Satisfacción y equipos por línea -->
    ${c.sat!==null?`<div style="font-size:.62rem;margin-bottom:.3rem"><span style="color:var(--mut)">Satisfacción:</span> <strong style="color:${c.sat<=2?'var(--rd)':c.sat<=3?'var(--am)':'var(--gn)'}">${c.sat}/5</strong></div>`:''}
    ${eqR?`<div style="margin-top:.5rem"><div style="font-size:.58rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.28rem">Equipos instalados por línea</div>${eqR}</div>`:''}
    <button onclick="_showRegPanel()" style="width:100%;margin-top:.7rem;background:var(--gy2);border:1px solid var(--brd);color:var(--mut);font-size:.6rem;font-family:'Roboto',sans-serif;padding:.28rem;border-radius:5px;cursor:pointer">← Volver al resumen regional</button>`;
}

function _showRegPanel(){
  const pt=document.getElementById('mp-panel-title');
  const pb=document.getElementById('mp-panel');
  if(!pb)return;
  if(pt)pt.textContent='Resumen por Región';
  const filt=_filtrados();const byR={};
  filt.forEach(c=>{
    if(!byR[c.region])byR[c.region]={n:0,cc:0,bi:0,ing:0,pot_eq:0,pot_st:0};
    byR[c.region].n++;if(c.cc)byR[c.region].cc++;
    byR[c.region].bi+=c.bi;byR[c.region].ing+=_getIngreso(c);
    byR[c.region].pot_eq+=(c.pot_eq||0);byR[c.region].pot_st+=(c.pot_st||0);
  });
  pb.innerHTML=Object.entries(byR).sort((a,b)=>b[1].ing-a[1].ing).map(([reg,d])=>`
    <div style="padding:.42rem 0;border-bottom:1px solid var(--gy2);cursor:pointer" onclick="document.getElementById('mp-reg').value='${reg}';_mapaFiltroReg='${reg}';_renderMarkers();">
      <div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.75rem;color:var(--az1)">${reg}</div>
      <div style="display:flex;gap:.5rem;margin-top:.1rem;font-size:.6rem;color:var(--mut)">
        <span>${d.n} clientes · <strong style="color:var(--teal)">${d.cc} contratos</strong></span>
        <span>${d.bi} eq.ST</span>
      </div>
      <div style="display:flex;gap:.5rem;font-size:.6rem;margin-top:.08rem">
        <span style="color:var(--az2)">${_fMM(d.ing)}</span>
        <span style="color:var(--am)">Eq: ${_fMM(d.pot_eq)} · ST: ${_fMM(d.pot_st)}</span>
      </div>
    </div>`).join('');
}

// Clientes que facturan y no tienen fila en BASE MAPA: sin coordenadas no
// pueden ir en el mapa, así que su ingreso se agrega como «Otros clientes»
// para que el total cuadre con el del Resumen. El monto se calcula como
// residuo contra el total del panel, así el cuadre no depende de que los
// nombres coincidan letra por letra entre las dos fuentes.
function _mapaOtrosFac(){
  const fc=((window.APP_DATA||{}).fact_clientes)||[];
  if(!fc.length||!MAPA_DATA.length) return {n:0,monto:0,tot:0};
  const nrm=s=>String(s||'').trim().toUpperCase().replace(/\s+/g,' ')
    .normalize('NFD').replace(/[̀-ͯ]/g,'');
  const enMapa=new Set(MAPA_DATA.map(c=>nrm(c.n)));
  const tot=fc.reduce((s,c)=>s+(c.real||0),0);
  const totMapa=MAPA_DATA.reduce((s,c)=>s+(c.ingreso_2026||0),0);
  const fuera=fc.filter(c=>!enMapa.has(nrm(c.cliente))&&(c.real||0)>0);
  return {n:fuera.length, monto:tot-totMapa, tot:tot, clientes:fuera};
}
// Sólo aplica sobre el universo completo y cuando la métrica incluye 2026.
function _mapaResidual(data){
  if(_mapaIngrYear==='2025') return 0;
  if(data.length!==MAPA_DATA.length) return 0;
  return _mapaOtrosFac().monto;
}

function _kpis(data){
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  s('mk-tot',data.length);
  s('mk-cc',data.filter(c=>c.cc).length);
  s('mk-bi',data.reduce((s,c)=>s+c.bi,0));
  s('mk-ing',_fMM(data.reduce((s,c)=>s+_getIngreso(c),0)+_mapaResidual(data)));
  s('mk-pot',_fMM(data.reduce((s,c)=>s+c.pot,0)));
  const ingLbl=document.getElementById('mk-ing-lbl');
  if(ingLbl)ingLbl.textContent=_mapaIngrYear==='ambos'?'Ingreso 2025+2026':_mapaIngrYear==='2025'?'Ingreso 2025':'Ingreso 2026';
}

function _renderRegTable(){
  const tbody=document.getElementById('mp-reg-tbody');if(!tbody)return;
  const filt=_filtrados();const byR={};
  filt.forEach(c=>{
    if(!byR[c.region])byR[c.region]={n:0,cc:0,bi:0,ing:0,pot_eq:0,pot_st:0,pot_st_gar:0,pot_st_contr:0};
    byR[c.region].n++;if(c.cc)byR[c.region].cc++;
    byR[c.region].bi+=c.bi;byR[c.region].ing+=_getIngreso(c);
    byR[c.region].pot_eq+=(c.pot_eq||0);byR[c.region].pot_st+=(c.pot_st||0);
    byR[c.region].pot_st_gar+=(c.pot_st_gar||0);byR[c.region].pot_st_contr+=(c.pot_st_contr||0);
  });
  const sorted=Object.entries(byR).sort((a,b)=>b[1].ing-a[1].ing);
  const tot={n:0,cc:0,bi:0,ing:0,pot_eq:0,pot_st:0,pot_st_gar:0,pot_st_contr:0};
  sorted.forEach(([,d])=>{tot.n+=d.n;tot.cc+=d.cc;tot.bi+=d.bi;tot.ing+=d.ing;tot.pot_eq+=d.pot_eq;tot.pot_st+=d.pot_st;
    tot.pot_st_gar+=d.pot_st_gar;tot.pot_st_contr+=d.pot_st_contr;});
  // Fila de cierre con los clientes que facturan y no están en BASE MAPA
  const resid=_mapaResidual(filt);
  const otros=resid?_mapaOtrosFac():null;
  if(resid){tot.ing+=resid;tot.n+=otros.n;}
  const pctFmt=d=>d.n>0?(d.cc/d.n*100).toFixed(0)+'%':'—';
  tbody.innerHTML=sorted.map(([reg,d])=>`
    <tr>
      <td><strong>${reg}</strong></td>
      <td class="num">${d.n}</td>
      <td><span class="pill pte">${d.cc}</span> <span style="font-size:.57rem;color:var(--mut)">/ ${d.n}</span></td>
      <td class="num" style="color:${d.cc/d.n>=0.5?'var(--teal)':'var(--mut)'}">${pctFmt(d)}</td>
      <td class="num">${d.bi}</td>
      <td class="num" style="color:var(--az2)">${_fT(d.ing)}</td>
      <td class="num" style="color:var(--am)">${_fT(d.pot_eq)}</td>
      <td class="num" style="color:var(--teal)">${_fT(d.pot_st_gar)}</td>
      <td class="num" style="color:var(--az2)">${_fT(d.pot_st_contr)}</td>
      <td class="num" style="color:var(--teal);font-weight:700">${_fT(d.pot_st)}</td>
      <td class="num" style="color:var(--mut)">${d.n>0?_fT(d.pot_st/d.n):'—'}</td>
    </tr>`).join('')+(resid?`
    <tr style="background:var(--gy)" title="${otros.clientes.map(c=>c.cliente).join('\n').replace(/"/g,'&quot;')}">
      <td><strong style="color:var(--mut)">Otros clientes</strong>
        <span style="font-size:.57rem;color:var(--mut)"> · sin fila en Base Mapa</span></td>
      <td class="num" style="color:var(--mut)">${otros.n}</td>
      <td colspan="3" style="text-align:center;font-size:.57rem;color:var(--mut);font-style:italic">facturan pero no tienen ubicación cargada</td>
      <td class="num" style="color:var(--az2)">${_fT(resid)}</td>
      <td class="num" style="color:var(--mut)">—</td><td class="num" style="color:var(--mut)">—</td>
      <td class="num" style="color:var(--mut)">—</td><td class="num" style="color:var(--mut)">—</td>
      <td class="num" style="color:var(--mut)">—</td>
    </tr>`:'')+`
    <tr style="background:rgba(30,90,200,.08);font-weight:800;border-top:2px solid var(--az2)">
      <td><strong>TOTAL</strong></td>
      <td class="num">${tot.n}</td>
      <td class="num"><strong>${tot.cc}</strong> <span style="font-size:.57rem;color:var(--mut)">/ ${tot.n}</span></td>
      <td class="num" style="color:var(--az2)">${pctFmt(tot)}</td>
      <td class="num">${tot.bi}</td>
      <td class="num" style="color:var(--az2)">${_fT(tot.ing)}</td>
      <td class="num" style="color:var(--am)">${_fT(tot.pot_eq)}</td>
      <td class="num" style="color:var(--teal)">${_fT(tot.pot_st_gar)}</td>
      <td class="num" style="color:var(--az2)">${_fT(tot.pot_st_contr)}</td>
      <td class="num" style="color:var(--teal)">${_fT(tot.pot_st)}</td>
      <td class="num" style="color:var(--mut)">${tot.n>0?_fT(tot.pot_st/tot.n):'—'}</td>
    </tr>`;
}

/* ── POLÍGONO ── */
function _iniciarPoligono(){
  if(!_mapaLeaflet)return;
  _drawMode=true;_drawPts=[];
  _limpiarTempDraw();
  const h=document.getElementById('mp-poly-hint');if(h)h.style.display='block';
  const r=document.getElementById('mp-poly-result');if(r)r.style.display='none';
  _mapaLeaflet.getContainer().style.cursor='crosshair';
  const btn=document.getElementById('mp-draw-btn');
  if(btn){btn.style.background='var(--rd)';btn.textContent='Dibujando... (doble clic para cerrar)';}
}

function _onMapClick(e){
  if(!_drawMode)return;
  _drawPts.push(e.latlng);
  const m=L.circleMarker(e.latlng,{radius:5,color:'#002D73',fillColor:'#fff',fillOpacity:1,weight:2}).addTo(_mapaLeaflet);
  _drawMarkers.push(m);
  if(_drawLine)_mapaLeaflet.removeLayer(_drawLine);
  if(_drawPts.length>=2){
    _drawLine=L.polyline([..._drawPts,_drawPts[0]],{color:'#002D73',weight:2,dashArray:'6,4',opacity:.8}).addTo(_mapaLeaflet);
  }
}

function _onMapDblClick(e){
  if(!_drawMode||_drawPts.length<3)return;
  L.DomEvent.stopPropagation(e);
  _drawMode=false;
  _mapaLeaflet.getContainer().style.cursor='';
  const h=document.getElementById('mp-poly-hint');if(h)h.style.display='none';
  _limpiarTempDraw();
  if(_drawPoly)_mapaLeaflet.removeLayer(_drawPoly);
  _drawPoly=L.polygon(_drawPts,{color:'#002D73',fillColor:'#002D73',fillOpacity:.1,weight:2}).addTo(_mapaLeaflet);
  _mostrarResumenPoligono(_drawPts);
  const btn=document.getElementById('mp-draw-btn');
  if(btn){btn.style.background='var(--teal)';btn.style.color='var(--az3)';btn.textContent='✏️ Nueva Zona';}
}

function _limpiarTempDraw(){
  if(_drawLine){_mapaLeaflet.removeLayer(_drawLine);_drawLine=null;}
  _drawMarkers.forEach(m=>_mapaLeaflet.removeLayer(m));_drawMarkers=[];
}

function _cancelarPoligono(){
  _drawMode=false;
  _mapaLeaflet.getContainer().style.cursor='';
  _limpiarTempDraw();
  const h=document.getElementById('mp-poly-hint');if(h)h.style.display='none';
  const btn=document.getElementById('mp-draw-btn');
  if(btn){btn.style.background='var(--az2)';btn.style.color='#fff';btn.textContent='✏️ Dibujar Zona';}
}

function _limpiarPoligono(){
  if(_drawPoly){_mapaLeaflet.removeLayer(_drawPoly);_drawPoly=null;}
  _limpiarTempDraw();_drawPts=[];
  const r=document.getElementById('mp-poly-result');if(r)r.style.display='none';
  const btn=document.getElementById('mp-draw-btn');
  if(btn){btn.style.background='var(--az2)';btn.style.color='#fff';btn.textContent='✏️ Dibujar Zona';}
}

function _ptInPoly(lat,lon,latlngs){
  let inside=false;
  for(let i=0,j=latlngs.length-1;i<latlngs.length;j=i++){
    const xi=latlngs[i].lat,yi=latlngs[i].lng;
    const xj=latlngs[j].lat,yj=latlngs[j].lng;
    if(((yi>lon)!==(yj>lon))&&(lat<(xj-xi)*(lon-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}

function _geoArea(latlngs){
  const R=6371,toR=d=>d*Math.PI/180;
  let a=0;const n=latlngs.length;
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    const dLon=toR(latlngs[j].lng-latlngs[i].lng);
    a+=dLon*(2+Math.sin(toR(latlngs[i].lat))+Math.sin(toR(latlngs[j].lat)));
  }
  return Math.abs(a)/2*R*R;
}

function _mostrarResumenPoligono(latlngs){
  const area=_geoArea(latlngs);
  const dentro=MAPA_DATA.filter(c=>c.lat!=null&&c.lon!=null&&_ptInPoly(c.lat,c.lon,latlngs));
  const r=document.getElementById('mp-poly-result');
  const b=document.getElementById('mp-poly-body');
  const t=document.getElementById('mp-poly-title');
  if(!r||!b)return;
  r.style.display='block';
  if(t)t.textContent=`Zona seleccionada · ${dentro.length} clientes · ${area.toFixed(1)} km²`;
  if(dentro.length===0){b.innerHTML='<div style="padding:1rem;text-align:center;color:var(--mut);font-size:.72rem">No hay clientes dentro del polígono trazado.</div>';return;}
  const totBi=dentro.reduce((s,c)=>s+c.bi,0);
  const totIng=dentro.reduce((s,c)=>s+_getIngreso(c),0);
  const totPotEq=dentro.reduce((s,c)=>s+(c.pot_eq||0),0);
  const totPotSt=dentro.reduce((s,c)=>s+(c.pot_st||0),0);
  const totCC=dentro.filter(c=>c.cc).length;
  const byReg={};
  dentro.forEach(c=>{if(!byReg[c.region])byReg[c.region]=0;byReg[c.region]++;});
  const regStr=Object.entries(byReg).sort((a,b)=>b[1]-a[1]).map(([r,n])=>`${r} (${n})`).join(', ');
  b.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-bottom:.7rem">
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.3rem;color:var(--az3)">${dentro.length}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Clientes</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.3rem;color:var(--teal)">${totCC}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Con Contrato</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.3rem;color:var(--az2)">${totBi}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Equipos ST</div></div>
      <div style="background:var(--gy);border-radius:6px;padding:.5rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-weight:900;font-size:1.3rem;color:var(--am)">${_fMM(totPotEq+totPotSt)}</div>
        <div style="font-size:.52rem;color:var(--mut);text-transform:uppercase">Potencial</div></div>
    </div>
    <div style="font-size:.62rem;margin-bottom:.28rem"><span style="color:var(--mut)">Ingreso zona:</span> <strong style="color:var(--az2)">${_fMM(totIng)}</strong></div>
    <div style="font-size:.62rem;margin-bottom:.28rem"><span style="color:var(--mut)">Pot. Equipos:</span> <strong style="color:var(--am)">${_fMM(totPotEq)}</strong> · <span style="color:var(--mut)">Pot. ST:</span> <strong style="color:var(--teal)">${_fMM(totPotSt)}</strong></div>
    <div style="font-size:.62rem;margin-bottom:.6rem"><span style="color:var(--mut)">Regiones:</span> <span>${regStr}</span></div>
    <div style="font-size:.6rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Clientes en la zona</div>
    <div style="max-height:200px;overflow-y:auto">
    ${dentro.sort((a,b)=>_getIngreso(b)-_getIngreso(a)).map(c=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.22rem 0;border-bottom:1px solid var(--gy);font-size:.62rem">
        <div>
          <span style="font-weight:600">${c.n.length>38?c.n.slice(0,36)+'…':c.n}</span>
          <span class="badge ${c.cc?'bte':'bgy'}" style="font-size:.48rem;margin-left:.25rem">${c.cc?'Contrato':'—'}</span>
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0">
          <span style="color:var(--az2)">${_fMM(_getIngreso(c))}</span>
          <span style="color:var(--mut)">${c.bi} eq.</span>
        </div>
      </div>`).join('')}
    </div>
    <div style="margin-top:.5rem;font-size:.58rem;color:var(--mut);font-family:'Roboto Mono',monospace">Área ≈ ${area.toFixed(1)} km²  ·  ${latlngs.length} vértices</div>`;
  r.scrollIntoView({behavior:'smooth',block:'nearest'});
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
