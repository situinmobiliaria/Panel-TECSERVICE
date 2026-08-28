// ═══════════════════════════════════════════════════════════════
// utils.js — Constantes de cálculo, helpers, sv(), tooltip, filtros
// Depende de: datos.js (DATA, APP_DATA, MES_CORTE, etc.)
// ═══════════════════════════════════════════════════════════════

const TOTAL_PRESUP=window.PPTO_ANUAL;
const PPTO_CONTRATOS=TOTAL_PRESUP*0.50;
const TOTAL_COM_VAL=DATA.filter(d=>d.tipo==='Comercial').reduce((s,d)=>s+d.val,0);
const TOTAL_GAR_VAL=DATA.filter(d=>d.tipo==='Garantia').reduce((s,d)=>s+d.val,0);
const TOTAL_CARTERA_VAL=TOTAL_COM_VAL+TOTAL_GAR_VAL;
const C={az1:'#002D73',az2:'#33448D',az3:'#0E2D55',te:'#28D2C3',am:'#FFC000',rd:'#C00000',gn:'#00832F',or:'#D46000',gy:'#E2E6F0',mut:'#B8C1D8'};
// Si el CDN de Chart.js no cargó (red bloqueada, CDN caído), que el panel
// siga funcionando igual: sólo los gráficos quedan sin dibujar, en vez de
// que este ReferenceError tumbe TODO utils.js (incluida mm() y la pantalla
// de carga, que van después en este mismo archivo).
if(typeof Chart!=='undefined'){
  Chart.defaults.font.family="'Roboto',sans-serif";
  Chart.defaults.color='#6B7BA8';
}

// ─── HELPERS ──────────────────────────────────────────────────
const mm=v=>(v===null||v===undefined||isNaN(v))?'—':'MM$'+fN1(v/1e6);
const pctOf=(v,t)=>t>0&&!isNaN(v)?((v/t)*100).toFixed(1)+'%':'—';
const shortN=s=>s.length>35?s.slice(0,34)+'…':s;
const shortC=s=>s.split(' ')[0];
const urgC=d=>isNaN(d)?C.mut:d<0?C.rd:d<=30?C.rd:d<=60?C.or:d<=90?'#8B8200':d<=180?C.az2:C.gn;
const urgP=d=>{
  if(isNaN(d)||d===null||d===undefined)return`<span class="pill pgr">—</span>`;
  if(d<0)return`<span class="pill pd">Vencido</span>`;
  if(d<=30)return`<span class="pill pd">${d}d</span>`;
  if(d<=60)return`<span class="pill py">${d}d</span>`;
  if(d<=90)return`<span class="pill py">${d}d</span>`;
  if(d<=180)return`<span class="pill pb">${d}d</span>`;
  return`<span class="pill pg">${d}d</span>`;
};
const tipoBadge=t=>t==='Comercial'?`<span class="tipo-c">COM</span>`:`<span class="tipo-g">GAR</span>`;
const nueBadge=n=>n?`<span class="pill pg" title="Nuevo cliente">🆕</span>`:`<span class="pill pgr">—</span>`;
const pbarHTML=(p,c)=>{const pct=(!isNaN(p)&&p!=null)?Math.min(p,100):0;return`<div class="pbar-inline"><div class="pbar-fill" style="width:${pct}%;background:${c}"></div></div>`;};

// ─── VIEW SWITCHER ─────────────────────────────────────────────
function sv(name,btn){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'));
  document.getElementById('view-'+name).classList.add('on');
  btn.classList.add('on');
  window.scrollTo({top:0,behavior:'instant'});
  const inits={
    tipos:initTipos,
    nuevos:initNuevos,
    vencimientos:initVenc,
    vision:initVision,
    presupuesto:initPresupuesto,
    facturacion:initFacturacion,
    panelfact:initPanelFact,
    base:initBaseInstalada,
    satisfaccion:initSatisfaccion,
    visitas:initVisitas,
    alertas:initAlertas,
    brechas:()=>{ if(window.initBrechas) window.initBrechas(); },
    invts:()=>{ if(window.initInvTS) window.initInvTS(); if(window.initRepVend) window.initRepVend(); }
  };
  const k='_i_'+name;
  if(inits[name]&&!window[k]){inits[name]();window[k]=true;}
  if(name==='vencimientos')renderHz();
  if(name==='vision')renderVG();
  if(name==='nuevos')renderNC();
  if(name==='facturacion') setTimeout(renderFcGraficos, 100);
  if(name==='desglose') setTimeout(()=>{ if(window._desgMapRefresh) window._desgMapRefresh(); }, 80);
  if(name==='base')     setTimeout(()=>{ if(window._biMapRefresh) window._biMapRefresh(); }, 80);
  // 150ms: mapa/matriz/casos interceptan sv() y pintan su contenido recién a
  // los 80ms (lazy render), así que hay que esperar más que eso para
  // encontrar su .sh y no perderse el badge en esas 3 vistas.
  setTimeout(_injectUpdateBadges, 150);
}

// ─── TOOLTIP ──────────────────────────────────────────────────
const ttip=document.getElementById('ttip');
document.querySelectorAll('[data-tip]').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ttip.textContent=el.dataset.tip;ttip.style.opacity='1'});
  el.addEventListener('mousemove',e=>{ttip.style.left=(e.clientX+12)+'px';ttip.style.top=(e.clientY-30)+'px'});
  el.addEventListener('mouseleave',()=>ttip.style.opacity='0');
});

// ─── GENERIC TABLE HELPERS ────────────────────────────────────
function filterT(id,q){document.getElementById(id).querySelectorAll('tr').forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none');}
let _sd={};
function sortT(id,col,th){
  const tb=document.getElementById(id);
  const rows=[...tb.querySelectorAll('tr')];
  const k=id+col;_sd[k]=!_sd[k];
  if(th){const tbl=th.closest('table');tbl.querySelectorAll('th').forEach(h=>h.classList.remove('th-asc','th-desc'));th.classList.add(_sd[k]?'th-asc':'th-desc');}
  rows.sort((a,b)=>{
    const va=a.cells[col]?.textContent.trim()||'';
    const vb=b.cells[col]?.textContent.trim()||'';
    const sva=va.replace(/[^0-9.\-]/g,''),svb=vb.replace(/[^0-9.\-]/g,'');
    const na=parseFloat(sva),nb=parseFloat(svb);
    if(!isNaN(na)&&!isNaN(nb))return _sd[k]?na-nb:nb-na;
    return _sd[k]?va.localeCompare(vb,'es'):vb.localeCompare(va,'es');
  });
  rows.forEach(r=>tb.appendChild(r));
}
function filterColT(tbodyId,q,col){
  const tb=document.getElementById(tbodyId);
  tb.querySelectorAll('tr').forEach(r=>{
    const cell=r.cells[col];
    r.style.display=(!q||cell&&cell.textContent.toLowerCase().includes(q.toLowerCase()))?'':'none';
  });
  updateTfoot(tbodyId);
}
function updateTfoot(tbodyId){
  const footMap={
    'tb-tc-com':'tfoot-tc-com','tb-tc-gar':'tfoot-tc-gar',
    'tb-hz':'tfoot-hz','tb-vg':'tfoot-vg','tb-nc':'tfoot-nc'
  };
  const fid=footMap[tbodyId]; if(!fid)return;
  const tbody=document.getElementById(tbodyId);
  const rows=[...tbody.querySelectorAll('tr')].filter(r=>r.style.display!=='none');
  const foot=document.getElementById(fid);
  if(!foot)return;
  const count=rows.length;
  const clients=new Set(rows.map(r=>r.cells[1]?.textContent.trim()||'')).size;
  const mmCols={'tb-tc-com':5,'tb-tc-gar':5,'tb-hz':8,'tb-vg':9,'tb-nc':7};
  const pctCols={'tb-tc-com':7,'tb-tc-gar':7,'tb-hz':9,'tb-vg':13,'tb-nc':null};
  const mmCol=mmCols[tbodyId], pctCol=pctCols[tbodyId];
  let totalMM=0, totalPct=0, pctCount=0;
  rows.forEach(r=>{
    if(mmCol!=null){const v=parseFloat((r.cells[mmCol]?.textContent||'').replace(/[^0-9.]/g,''));if(!isNaN(v))totalMM+=v;}
    if(pctCol!=null){const v=parseFloat((r.cells[pctCol]?.textContent||'').replace(/[^0-9.]/g,''));if(!isNaN(v)){totalPct+=v;pctCount++;}}
  });
  let txt=`${count} contratos · ${clients} clientes`;
  if(mmCol!=null&&totalMM>0) txt+=` · MM$${totalMM.toFixed(1)} total`;
  if(pctCol!=null&&pctCount>0) txt+=` · ${(totalPct/pctCount).toFixed(1)}% prom. consumido`;
  foot.innerHTML=`<td class="flab" colspan="20" style="background:var(--az3);color:rgba(255,255,255,.85);padding:.5rem .7rem;font-size:.64rem">${txt}</td>`;
}

// ─── TFOOT OBSERVER ───────────────────────────────────────────
const _obs=new MutationObserver((muts)=>{
  muts.forEach(m=>{
    const id=m.target.id;
    if(['tb-tc-com','tb-tc-gar','tb-hz','tb-vg','tb-nc'].includes(id)) updateTfoot(id);
  });
});
document.addEventListener('DOMContentLoaded',()=>{
  // Fecha real de generación de los datos (NO la fecha del navegador de quien
  // mira el panel) — para que "Datos al" sea siempre la misma fecha que
  // "Última actualización" en cada sección, sin importar cuándo se abra esto.
  const _h=(window.APP_DATA&&APP_DATA.actualizado_iso)?new Date(APP_DATA.actualizado_iso):new Date();
  const _f=String(_h.getDate()).padStart(2,'0')+'/'+String(_h.getMonth()+1).padStart(2,'0')+'/'+_h.getFullYear();
  const elD=document.getElementById('hd-date');if(elD)elD.textContent='📅 '+_f;
  const elT=document.getElementById('rs-tag');if(elT)elT.textContent='Facturación real del área · Servicios de mantención preventiva y correctiva · Datos al '+_f;
  const elF=document.getElementById('ft-main');if(elF)elF.textContent='GEMCO S.A. · TECSERVICE · Panel de Contratos '+ANO_ACTUAL+' · CONFIDENCIAL · Datos al '+_f;
  ['tb-tc-com','tb-tc-gar','tb-hz','tb-vg','tb-nc'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) _obs.observe(el,{childList:true,subtree:true});
  });
});

// ─── PROGRESS BARS ANIMATE ────────────────────────────────────
setTimeout(()=>{document.querySelectorAll('.prf').forEach(el=>{const w=el.style.width;el.style.width='0';setTimeout(()=>el.style.width=w,150);});},200);

// ─── PANTALLA DE CARGA ──────────────────────────────────────────
// Se muestra desde que arranca el HTML (cubre el parseo de ~1.7MB de datos +
// render inicial de gráficos) y se oculta cuando el documento está listo,
// con un mínimo de 500ms para evitar un parpadeo si carga muy rápido.
(function(){
  const ls=document.getElementById('loading-screen');
  if(!ls)return;
  const MIN_MS=500;
  const t0=performance.now();
  const hide=()=>{
    const wait=Math.max(0,MIN_MS-(performance.now()-t0));
    setTimeout(()=>{
      ls.classList.add('hidden');
      setTimeout(()=>ls.remove(),450);
    },wait);
  };
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',hide);}
  else{hide();}
})();

// ─── ÚLTIMA ACTUALIZACIÓN (anotación en cada sección) ─────────
// Algunas vistas (Mapa/Matriz/Casos/Base) sólo pintan su contenido cuando el
// usuario abre esa pestaña (lazy render vía sv()), así que además de correr
// esto en DOMContentLoaded hay que reintentar cada vez que se cambia de vista.
function _injectUpdateBadges(){
  const LABEL=(window.APP_DATA&&APP_DATA.actualizado_label)||'Última actualización: —';
  document.querySelectorAll('.view').forEach(view=>{
    const sh=view.querySelector('.sh');
    if(!sh||(sh.nextElementSibling&&sh.nextElementSibling.classList.contains('sh-updated')))return;
    const badge=document.createElement('div');
    badge.className='sh-updated';
    badge.textContent=LABEL;
    sh.insertAdjacentElement('afterend',badge);
  });
}
document.addEventListener('DOMContentLoaded',_injectUpdateBadges);

// ─── CALIDAD DE LOS EXPORTABLES PDF ──────────────────────────────
// Todos los exportables del panel son una captura de la pantalla hecha con
// html2canvas y pegada dentro de un PDF, así que la nitidez depende de dos
// cosas: a cuántos píxeles se rasteriza el HTML (escala) y con qué formato
// se guarda esa imagen. Para subir o bajar la calidad de golpe, tocar sólo
// estos números: son los que usan las nueve funciones de exportación.
window.PDF_HD = {
  escala:       4,      // objetivo: 4x el tamaño en pantalla (~384 DPI)
  ladoMax:   14000,     // px por lado que aguanta un canvas sin fallar
  areaMax:     5e7,     // px totales; por sobre esto el navegador se queda sin memoria
  pxPng:     3.2e7,     // hasta este tamaño se usa PNG sin pérdida
  calidadJpeg: 0.96,    // calidad del JPEG cuando el canvas es demasiado grande para PNG
};

// Escala segura para un bloque de w x h px CSS. Parte del objetivo y la baja
// hasta que el canvas resultante entre en los límites del navegador; nunca
// baja de 1 (a esa altura el bloque ya es impresentable de todas formas).
window.hdEscala = function (w, h) {
  const C = window.PDF_HD;
  if (!w || !h) return C.escala;
  const s = Math.min(C.escala, C.ladoMax / w, C.ladoMax / h,
                     Math.sqrt(C.areaMax / (w * h)));
  return Math.max(1, Math.round(s * 100) / 100);
};

// Serializa el canvas para jsPDF. PNG es sin pérdida y comprime muy bien
// texto y tablas (colores planos), pero en canvas enormes la cadena base64
// se vuelve inmanejable: ahí se cae a JPEG de calidad casi máxima.
// forzarJpeg sirve para los informes de muchas páginas, donde el peso total
// importa más que el último gramo de nitidez.
window.hdImagen = function (cv, forzarJpeg) {
  const C = window.PDF_HD;
  if (!forzarJpeg && cv.width * cv.height <= C.pxPng)
    return { data: cv.toDataURL('image/png'), fmt: 'PNG' };
  return { data: cv.toDataURL('image/jpeg', C.calidadJpeg), fmt: 'JPEG' };
};

// Foto de un gráfico de Chart.js a la misma resolución que el resto del
// exportable. El canvas de pantalla está dibujado al devicePixelRatio del
// monitor (normalmente 1), así que al estirarlo dentro de una captura 4x se
// veía borroso justo al lado de un texto nítido. Acá se sube el DPR del
// gráfico vivo, se redibuja, se serializa y se deja como estaba: el usuario
// no alcanza a ver el parpadeo y la imagen entra con todo su detalle.
window.hdChartImg = function (id) {
  const cv = typeof id === 'string' ? document.getElementById(id) : id;
  if (!cv || !cv.toDataURL) return null;
  const dpr = window.PDF_HD ? window.PDF_HD.escala : 2;
  let ch = null;
  try {
    ch = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(cv) : null;
  } catch (e) { ch = null; }
  if (!ch) { try { return cv.toDataURL('image/png'); } catch (e) { return null; } }
  const prev = ch.options.devicePixelRatio;
  try {
    ch.options.devicePixelRatio = dpr;
    ch.resize();
    return cv.toDataURL('image/png');
  } catch (e) {
    try { return cv.toDataURL('image/png'); } catch (e2) { return null; }
  } finally {
    try { ch.options.devicePixelRatio = prev; ch.resize(); } catch (e) {}
  }
};

// ─── PROGRAMAS CARE (usado en todas las hojas de contratos) ───────
const _PROG_FEATURES={
  BASIC:{label:'Basic',color:'#4caf50',bg:'rgba(76,175,80,.15)',solidBg:'#81c784',
    objetivo:'Cobertura esencial para el mantenimiento preventivo de su equipo médico.',
    items:['Mantenimiento Preventivo según indicación del fabricante (2 visitas x año)','Atención técnica en terreno, con valor preferente','Hasta 2 actividades de capacitación sin costo, al año']},
  ADVANCED:{label:'Advanced',color:'#fbc02d',bg:'rgba(251,192,45,.15)',solidBg:'#fdd835',
    objetivo:'Servicio completo que incluye mantenimiento preventivo y correctivo (mano de obra).',
    items:['Mantenimiento Preventivo','Mantenimiento Correctivo (Solo Mano de obra)','Hasta 2 actividades de capacitación sin costo, al año','Precio preferente para repuestos (descuento 7%)']},
  PROFESIONAL:{label:'Profesional',color:'#42a5f5',bg:'rgba(66,165,245,.15)',solidBg:'#64b5f6',
    objetivo:'Atención prioritaria con monitoreo continuo y soporte técnico especializado, que considera mantenimiento preventivo y correctivo con bolsa de repuestos originales.',
    items:['Mantenimiento Preventivo','Mantenimiento Correctivo','Bolsa de repuestos incluidos','Hasta 4 actividades de capacitación sin costo, al año','Precio preferente para repuestos, fuera de la bolsa (descuento 10%)','Soporte técnico 24/7, según área de cobertura']},
  INTEGRAL:{label:'Integral',color:'#7986cb',bg:'rgba(121,134,203,.15)',solidBg:'#9fa8da',
    objetivo:'Servicio total con todas las coberturas anteriores, más actualizaciones de software, revisiones exhaustivas y servicios de soporte prioritario.',
    items:['Mantenimiento Preventivo','Mantenimiento Correctivo','Repuestos incluidos','Hasta 10 actividades de capacitación sin costo, al año','Soporte técnico 24/7, según área de cobertura','Servicio de Backup (según corresponda - ver archivo equipos)']}
};
function _progKey(p){const u=(p||'').toUpperCase();if(u.includes('BASIC'))return'BASIC';if(u.includes('ADVANCED'))return'ADVANCED';if(u.includes('PROFESIONAL')||u.includes('PROFESSIONAL'))return'PROFESIONAL';if(u.includes('INTEGRAL'))return'INTEGRAL';return null;}
function _ensureProgTip(){if(document.getElementById('_prog-tip'))return;const d=document.createElement('div');d.id='_prog-tip';d.style.cssText='position:fixed;z-index:99999;background:#1e2434;border:1px solid #3a4460;border-radius:8px;padding:.7rem .9rem;min-width:280px;max-width:360px;pointer-events:none;display:none;box-shadow:0 6px 24px rgba(0,0,0,.55);font-family:Roboto,sans-serif';document.body.appendChild(d);}
function _showProgTip(e,key){_ensureProgTip();const info=_PROG_FEATURES[key];if(!info)return;const tip=document.getElementById('_prog-tip');tip.innerHTML=`<div style="font-family:'Roboto Condensed',sans-serif;font-weight:700;font-size:.78rem;color:${info.color};margin-bottom:.4rem;padding-bottom:.3rem;border-bottom:1px solid ${info.color}44">${info.label} Care Program</div><ul style="margin:0;padding-left:1.1rem;font-size:.6rem;color:rgba(255,255,255,.88);line-height:1.75">${info.items.map(i=>`<li>${i}</li>`).join('')}</ul>`;tip.style.display='block';tip.style.left=Math.min(e.clientX+14,window.innerWidth-380)+'px';tip.style.top=Math.min(e.clientY+10,window.innerHeight-200)+'px';}
function _hideProgTip(){const t=document.getElementById('_prog-tip');if(t)t.style.display='none';}
function _progBadge(programa){const key=_progKey(programa);if(!key)return'<span style="color:var(--mut);font-size:.6rem">—</span>';const info=_PROG_FEATURES[key];return`<span style="cursor:help;display:inline-block;padding:.18rem .45rem;border-radius:4px;font-size:.53rem;font-weight:700;font-family:'Roboto Condensed',sans-serif;background:${info.bg};color:${info.color};border:1px solid ${info.color}55;white-space:nowrap" onmouseenter="_showProgTip(event,'${key}')" onmouseleave="_hideProgTip()">${info.label}</span>`;}

// ─── LÍNEA DE NEGOCIO (Esterilización / Endoscopía / Dental) ──────
const _LINEA_COLORS={'Esterilización':'#002D73','Endoscopía':'#28D2C3','Dental':'#FFC000'};
function _lineaBadge(linea){const l=linea||'Esterilización';const col=_LINEA_COLORS[l]||'#888';return`<span style="display:inline-block;padding:.16rem .42rem;border-radius:4px;font-size:.53rem;font-weight:700;font-family:'Roboto Condensed',sans-serif;background:${col}1c;color:${col};border:1px solid ${col}55;white-space:nowrap">${l}</span>`;}
