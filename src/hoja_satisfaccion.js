// ═══════════════════════════════════════════════════════════════
// hoja_satisfaccion.js — Satisfacción Clientes
// Depende de: datos.js (APP_DATA), utils.js
// ═══════════════════════════════════════════════════════════════

let _chSatRes=null,_chSatNps=null,_chSatBITramos=null,_chSatBITipos=null,_chSatBIScatter=null;
let _chSatEvo=null,_chSatCatDet=null;
let _satDomUnif=[]; // dominio data unificado (promedio si hay duplicados)
let _satComUnif=[]; // comentarios unificados por institución
let _satTipoFilt='todos',_satComFiltDet=false,_satBIFiltTramo='todos';

// ─── Badge de categoría detractor (nivel módulo, usada en 2 tablas) ──
const _DET_CAT_PAL = ['#7A1FAA','#0A5C8C','#C05000','#007A72','#8B3A00','#1a6b2a'];
let _detCatColorMap = null;
function _buildDetCatMap(){
  if(_detCatColorMap) return;
  _detCatColorMap = {};
  const inst = (APP_DATA.satisf && APP_DATA.satisf.instituciones) || [];
  inst.filter(d => d.recom < 7).forEach(d => {
    const c = (d.cat_detractor||'').trim();
    if(c && !(c in _detCatColorMap))
      _detCatColorMap[c] = _DET_CAT_PAL[Object.keys(_detCatColorMap).length % _DET_CAT_PAL.length];
  });
}
function _catBadge(cat){
  _buildDetCatMap();
  const c = (cat||'').trim();
  if(!c) return `<span style="font-size:.57rem;color:var(--mut);font-style:italic">—</span>`;
  const bg = _detCatColorMap[c] || '#555';
  return `<span style="font-size:.57rem;font-weight:700;color:#fff;background:${bg};border-radius:4px;padding:.12rem .4rem;white-space:nowrap">${c}</span>`;
}

// ─── Constantes de tipo BI (compartidas entre gráficos) ──────────
const _BD_LABELS=['Esterilización','Endoscopía','Mobiliario Clínico','Dental','Incardia','MMQ','REAS','Otro'];
const _BD_KEYS  =['ester','endo','mob','dent','inc','mmq','reas','otro'];
const _BD_COLORS=['#002D73','#28D2C3','#7B2FBE','#FFC000','#D46000','#00832F','#C00000','#B8C1D8'];

function _unificarDominios(domArr){
  const map={};
  domArr.forEach(d=>{
    const k=(d.dominio||'').trim().toLowerCase();
    if(!map[k]){map[k]={dominio:(d.dominio||'').toUpperCase(),categoria:d.categoria,_cal:[],_tie:[],_rec:[],n:0};}
    const cnt=d.n||1;
    map[k]._cal.push({v:d.calidad,w:cnt});
    map[k]._tie.push({v:d.tiempo,w:cnt});
    map[k]._rec.push({v:d.recom,w:cnt});
    map[k].n+=cnt;
  });
  return Object.values(map).map(m=>{
    const wAvg=arr=>arr.reduce((s,x)=>s+x.v*x.w,0)/arr.reduce((s,x)=>s+x.w,0);
    return{dominio:m.dominio,categoria:m.categoria,n:m.n,calidad:wAvg(m._cal),tiempo:wAvg(m._tie),recom:wAvg(m._rec)};
  }).sort((a,b)=>b.n-a.n);
}

function _normInst(s){
  return (s||'—').trim().toUpperCase()
    .replace(/\s+/g,' ')
    .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E')
    .replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O')
    .replace(/[ÚÙÜÛ]/g,'U').replace(/Ñ/g,'N');
}

function _unificarCom(comArr){
  const map={};
  comArr.forEach(c=>{
    const k=_normInst(c.nombre_analisis||c.institucion);
    const nombre=(c.nombre_analisis||c.institucion||'—').toUpperCase();
    if(!map[k]){map[k]={institucion:nombre,recs:[],mejoras:[],_bi:null};}
    else if(nombre.length>map[k].institucion.length)map[k].institucion=nombre;
    map[k].recs.push(+(c.recom||0));
    if(c.mejora&&c.mejora.trim())map[k].mejoras.push(c.mejora.trim());
    // BI: tomar primer valor no-nulo (mismo cliente = mismo valor)
    if(map[k]._bi==null&&c.bi_total!=null)map[k]._bi=c.bi_total;
  });
  return Object.values(map).map(m=>{
    const n=m.recs.length;
    const recom=m.recs.reduce((s,v)=>s+v,0)/n;
    let nota='';
    if(n>1){
      const indiv=m.recs.map(r=>r.toFixed(1)).join(', ');
      nota='Promedio de '+n+' respuestas: ['+indiv+'] → '+recom.toFixed(2);
    }
    return{institucion:m.institucion,recom,n,nota,
      mejora:m.mejoras.join('\n'),biTotal:m._bi};
  }).sort((a,b)=>a.recom-b.recom);
}

function renderSatTabla(){
  const data=_satTipoFilt==='todos'?_satDomUnif:_satDomUnif.filter(d=>d.categoria===_satTipoFilt);
  const tb=document.getElementById('tb-sat-dom');
  if(tb){
    tb.innerHTML=data.map((d,i)=>{
      const cls=d.categoria==='Sector Público'?'pb':d.categoria==='Sector Privado'?'por':'pgr';
      const recCol=d.recom>=7?'var(--gn)':d.recom>=4?'var(--am)':'var(--rd)';
      return`<tr>
        <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
        <td><strong>${d.dominio}</strong></td>
        <td><span class="pill ${cls}">${d.categoria}</span></td>
        <td style="text-align:center;font-family:'Roboto Mono',monospace;font-weight:700">${d.n}</td>
        <td class="num" style="text-align:right">${d.calidad.toFixed(2).replace('.',',')}</td>
        <td class="num" style="text-align:right">${d.tiempo.toFixed(2).replace('.',',')}</td>
        <td class="num" style="text-align:right;color:${recCol}">${d.recom.toFixed(2).replace('.',',')}</td>
      </tr>`;
    }).join('');
  }
  const foot=document.getElementById('sat-tabla-foot');
  if(foot){
    const nResp=data.reduce((s,d)=>s+d.n,0);
    const wAvgRec=nResp>0?data.reduce((s,d)=>s+d.recom*d.n,0)/nResp:0;
    foot.textContent=data.length+' instituciones · '+nResp+' respuestas · Recom. prom: '+wAvgRec.toFixed(2);
  }
}

function satFiltrarTipo(btn){
  document.querySelectorAll('#sat-tipo-filt .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');_satTipoFilt=btn.dataset.stf;renderSatTabla();
}
function satFiltrarCom(btn){
  document.querySelectorAll('#sat-com-filt .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');_satComFiltDet=btn.dataset.scf==='detractor';renderSatCom();
}
// Helper: cruce con contratos activos
function _satTieneContr(nombre){
  return _satContrMonto(nombre).n > 0;
}

// Monto anual contratado de una institución encuestada.
// La columna de contratos de la hoja SATISFACCION viene en cero para varios
// clientes que sí tienen contrato vigente (Hospital San Camilo, Puerto Aysén),
// y la celda caía en un "Sí" sin cifra. Aquí se busca el contrato en DATA y se
// devuelve su valor anual; sólo queda sin monto quien de verdad no tiene.
// El cruce ignora los sufijos societarios, para que «Clínica Vespucio» calce
// con «Clínica Vespucio SPA».
const _SAT_SUF = /\s+(SPA|S\.?P\.?A\.?|S\.?A\.?|LTDA\.?|LIMITADA|E\.?I\.?R\.?L\.?)$/;
function _normContr(s){
  let t = _normInst(s).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim(), prev;
  do { prev = t; t = t.replace(_SAT_SUF, '').trim(); } while (t !== prev);
  return t;
}
function _satContrMonto(inst){
  const esObj = (typeof inst === 'object' && inst !== null);
  const nombre = esObj ? inst.institucion : inst;
  const hoja = (esObj && inst.contr_asociados > 0) ? inst.contr_asociados : 0;
  if(typeof DATA === 'undefined') return {monto: hoja, n: hoja ? 1 : 0, tipos: []};
  const claves = [_normContr(nombre)];
  if(esObj && inst.nombre_bi) claves.push(_normContr(inst.nombre_bi));
  const hit = DATA.filter(d => claves.indexOf(_normContr(d.cliente)) >= 0);
  const desdeData = hit.reduce((a, d) => a + (d.val || 0), 0);
  // Se prefiere el monto de la hoja cuando existe; DATA cubre los que vienen en cero
  const monto = hoja || desdeData;
  return {monto: monto, n: hit.length || (hoja ? 1 : 0),
          tipos: hit.map(d => d.tipo).filter((t, i, a) => a.indexOf(t) === i)};
}
function _satContrTag(nombre){
  const tiene=_satTieneContr(nombre);
  return tiene
    ?`<span style="font-size:.55rem;background:var(--gn2);color:var(--gn);border-radius:3px;padding:.1rem .35rem;margin-left:.35rem;font-weight:700">CON CONTRATO</span>`
    :`<span style="font-size:.55rem;background:var(--rd2);color:var(--rd);border-radius:3px;padding:.1rem .35rem;margin-left:.35rem;font-weight:700">SIN CONTRATO</span>`;
}

function renderSatCom(){
  const data=_satComFiltDet?_satComUnif.filter(c=>c.recom<7):_satComUnif;
  const coms=document.getElementById('sat-coment');
  if(!coms)return;
  if(data.length===0){coms.innerHTML='<div style="text-align:center;color:var(--mut);font-style:italic;padding:1rem">Sin comentarios registrados</div>';return;}
  coms.innerHTML=data.map(c=>{
    const rcol=c.recom>=7?'var(--gn)':c.recom>=4?'var(--am)':'var(--rd)';
    const nTag=c.n>1?`<span style="font-size:.58rem;background:#E0E4F0;border-radius:3px;padding:.1rem .35rem;margin-left:.35rem">${c.n} resp.</span>`:'';
    const biTag=c.biTotal!=null?`<span style="font-size:.58rem;background:#EAF0FB;color:#1558D6;border-radius:3px;padding:.1rem .35rem;margin-left:.35rem" title="Base Instalada total">BI: ${c.biTotal}</span>`:'';
    const contrTag=_satContrTag(c.institucion);
    const notaHtml=c.nota?`<div style="margin-bottom:.3rem;font-size:.58rem;color:var(--mut);font-style:italic;font-family:'Roboto Mono',monospace">${c.nota}</div>`:'';
    const mejoras=c.mejora?c.mejora.split('\n').filter(x=>x.trim()):[];
    const mejoraHtml=mejoras.length===1
      ?`<div style="font-size:.65rem;color:var(--txt);line-height:1.5">${mejoras[0]}</div>`
      :mejoras.length>1
        ?mejoras.map((m,i)=>`<div style="font-size:.65rem;color:var(--txt);line-height:1.5;padding:.2rem 0 .2rem .6rem;border-left:2px solid #ccc;margin-top:.25rem"><em style="font-size:.57rem;color:var(--mut)">Resp. ${i+1}:</em> ${m}</div>`).join('')
        :'<div style="font-size:.65rem;color:var(--mut);font-style:italic">—</div>';
    return`<div style="padding:.7rem .9rem;background:var(--gy);border-left:3px solid ${rcol};border-radius:4px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem">
        <strong style="font-size:.7rem;color:var(--az1)">${c.institucion}${nTag}${biTag}${contrTag}</strong>
        <span style="font-family:'Roboto Mono',monospace;font-size:.65rem;color:${rcol};font-weight:700">Recom: ${c.recom.toFixed(c.n>1?2:0)}/10</span>
      </div>
      ${notaHtml}${mejoraHtml}
    </div>`;
  }).join('');
}

// Helpers: base instalada filtrada por Potencial ST para cruce con satisfacción
function _satGetBICliPot(){
  return ((APP_DATA.base_instalada||{}).clientes||[]).filter(c=>c.potencial_st);
}
// Usa nombre_bi (col 16 de SATISFACCION) para cruce exacto con Base Instalada
// Si nombre_bi está vacío, cae a fuzzy matching por nombre normalizado
function _satLookupBICliente(inst, biCliPot){
  // inst puede ser el objeto institución (con .nombre_bi) o solo el string nombre
  const nombreBi = (typeof inst === 'object') ? (inst.nombre_bi||'') : '';
  const nombreFallback = (typeof inst === 'object') ? inst.institucion : inst;
  if(nombreBi){
    // Búsqueda exacta por NombreBI del Excel
    const f = biCliPot.find(c => _normBI(c.nombre) === _normBI(nombreBi));
    if(f) return f;
  }
  // Fallback: fuzzy por nombre institución
  const k = _normBI(nombreFallback);
  let f = biCliPot.find(c => _normBI(c.nombre) === k);
  if(!f && k.length >= 5) f = biCliPot.find(c=>{const ck=_normBI(c.nombre);return ck.includes(k)||k.includes(ck);});
  return f||null;
}

function renderSatBI(){
  const s=APP_DATA.satisf;
  const inst=s.instituciones||[];
  const bi=s.bi_resumen||{};

  // Lookup base instalada Potencial ST para instituciones encuestadas
  const _biCliPot = _satGetBICliPot();
  // Construir mapa bi para reutilizar en tabla y otros (evita múltiples lookups)
  const _biMap = {};
  inst.forEach(d=>{ const r=_satLookupBICliente(d,_biCliPot); if(r) _biMap[d.institucion]=r; });
  const _biSurveyN = Object.keys(_biMap).length;
  const _biSurveyTotals = {total: Object.values(_biMap).reduce((s,r)=>s+(r.total_si||0),0)};

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const kpis=document.getElementById('sat-bi-kpis');
  if(kpis){
    const items=[
      {val:bi.n_inst||0,                              lbl:'Instituciones encuestadas',               col:'var(--az1)'},
      {val:_biSurveyN,                                lbl:'Con BI (Potencial ST) en base instalada', col:'var(--az2)'},
      {val:_biSurveyTotals.total.toLocaleString('es-CL'), lbl:'Equipos BI · marcas representadas',  col:'var(--te)'},
    ];
    kpis.innerHTML=items.map(k=>`
      <div style="background:var(--gy);border-radius:6px;padding:.9rem 1rem;text-align:center;border-top:3px solid ${k.col}">
        <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.7rem;font-weight:900;color:${k.col}">${k.val}</div>
        <div style="font-size:.56rem;color:var(--mut);margin-top:.2rem;text-transform:uppercase;letter-spacing:.04em">${k.lbl}</div>
      </div>`).join('');
  }

  // ── Tabla instituciones ────────────────────────────────────────────────────
  const tb=document.getElementById('tb-sat-bi');
  if(tb){
    const conContr=inst.filter(d=>_satTieneContr(d.institucion)).length;
    tb.innerHTML=inst.map((d,i)=>{
      const rcol=d.recom>=7?'var(--gn)':d.recom>=4?'var(--am)':'var(--rd)';
      const cls=d.categoria==='Sector Público'?'pb':d.categoria==='Sector Privado'?'por':'pgr';
      // Usar base instalada real (Potencial ST=Sí, habilitado) en vez de dato survey
      const biRec=_biMap[d.institucion];
      const biVal=biRec?(biRec.total_si||0):'—';
      const biStyle=biRec?'color:#1558D6;font-weight:700':'color:var(--mut)';
      const nTag=d.n>1?`<span style="font-size:.58rem;background:#E0E4F0;border-radius:3px;padding:.1rem .3rem;margin-left:.3rem">${d.n} resp.</span>`:'';
      const tiene=_satTieneContr(d.institucion);
      const cBadge=tiene?`<span class="pill pg">CON</span>`:`<span class="pill pd">SIN</span>`;
      return`<tr>
        <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
        <td><strong>${d.institucion}</strong>${nTag}</td>
        <td><span class="pill ${cls}">${d.categoria}</span></td>
        <td style="text-align:center">${cBadge}</td>
        <td style="text-align:center;font-family:'Roboto Mono',monospace">${d.n}</td>
        <td style="text-align:right;font-family:'Roboto Mono',monospace;${biStyle}">${biVal}</td>
        <td class="num" style="text-align:right;color:var(--mut)">${d.calidad.toFixed(2).replace('.',',')}</td>
        <td class="num" style="text-align:right;color:var(--mut)">${d.tiempo.toFixed(2).replace('.',',')}</td>
        <td class="num" style="text-align:right;color:${rcol};font-weight:700">${d.recom.toFixed(2).replace('.',',')}</td>
      </tr>`;
    }).join('');
    const foot=document.getElementById('sat-bi-foot');
    if(foot)foot.textContent=`${inst.length} instituciones · ${_biSurveyN} con BI (Potencial ST) · ${_biSurveyTotals.total.toLocaleString('es-CL')} equipos · ${conContr} con contrato activo`;
  }
  if(!document.getElementById('tb-sat-bi')){}// foot handled above

  // ── Calcular tramos y tipos a partir de instituciones ─────────────────────
  const _biTramo=v=>v==null||v<=0?null:v<=10?'Pequeño (1-10)':v<=50?'Mediano (11-50)':v<=150?'Grande (51-150)':'Enterprise (150+)';
  const TRAMO_ORDER=['Pequeño (1-10)','Mediano (11-50)','Grande (51-150)','Enterprise (150+)'];
  // Tramos basados en BI Potencial ST (habilitado) de base instalada
  const tramoMap={};
  inst.forEach(d=>{
    const biRec=_biMap[d.institucion];
    const biReal=biRec?(biRec.total_si||0):0;
    const t=_biTramo(biReal);
    if(!t)return;
    if(!tramoMap[t])tramoMap[t]={n:0,recs:[]};
    tramoMap[t].n++;
    tramoMap[t].recs.push(d.recom);
  });
  const tramos=TRAMO_ORDER.filter(t=>tramoMap[t]).map(t=>({
    tramo:t,n:tramoMap[t].n,
    recom_avg:tramoMap[t].recs.reduce((a,b)=>a+b,0)/tramoMap[t].n
  }));

  // Composición BI por línea de negocio desde base instalada real (Potencial ST)
  // Solo considera instituciones encuestadas que tienen registro en base instalada
  const _BI_LINEAS=[
    {prop:'dental',        lbl:'Dental',            col:'#FFC000'},
    {prop:'esterilizacion',lbl:'Esterilización',    col:'#002D73'},
    {prop:'incardia',      lbl:'Incardia',           col:'#D46000'},
    {prop:'endoscopia',    lbl:'Endoscopía',         col:'#28D2C3'},
    {prop:'mobiliario',    lbl:'Mobiliario Clínico', col:'#7B2FBE'},
    {prop:'mmq_reas',      lbl:'MMQ / REAS',         col:'#00832F'},
    {prop:'otros',         lbl:'Otros',              col:'#B8C1D8'},
  ];
  const _biLineaSat={};
  _BI_LINEAS.forEach(l=>{ _biLineaSat[l.prop]=0; });
  inst.forEach(d=>{
    const biRec=_biMap[d.institucion];
    if(!biRec)return;
    // Usar conteos _si (solo equipos con Potencial ST=Sí, habilitados)
    _BI_LINEAS.forEach(l=>{ _biLineaSat[l.prop]+=(biRec[l.prop+'_si']||0); });
  });

  // ── Gráfico 1: Recom promedio por tramo de BI ─────────────────────────────
  const ctxT=document.getElementById('cSatBITramos');
  if(ctxT){
    if(_chSatBITramos)_chSatBITramos.destroy();
    const tColors=tramos.map(t=>t.recom_avg>=7?C.gn:t.recom_avg>=4?C.am:C.rd);
    _chSatBITramos=safeChart(ctxT.getContext('2d'),{
      type:'bar',
      data:{
        labels:tramos.map(t=>`${t.tramo}\n(${t.n} inst.)`),
        datasets:[{
          label:'Recomendación promedio',
          data:tramos.map(t=>+t.recom_avg.toFixed(2)),
          backgroundColor:tColors,
          borderRadius:6,
        }]
      },
      options:{
        indexAxis:'y',responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:c=>`Recom: ${c.raw.toFixed(2)} / 10 · ${tramos[c.dataIndex].n} instituciones`}}
        },
        scales:{
          x:{min:0,max:10,grid:{color:'#E2E6F0'},ticks:{stepSize:2},
            title:{display:true,text:'Recomendación promedio (0–10)',font:{size:10}}},
          y:{grid:{display:false}}
        }
      }
    });
  }

  // ── Gráfico 2: Composición BI por línea de negocio (base instalada real) ───
  const ctxP=document.getElementById('cSatBITipos');
  if(ctxP){
    if(_chSatBITipos)_chSatBITipos.destroy();
    const lineaData=_BI_LINEAS.map(l=>({v:_biLineaSat[l.prop],lbl:l.lbl,col:l.col})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
    const lineaTotal=lineaData.reduce((s,x)=>s+x.v,0);
    _chSatBITipos=safeChart(ctxP.getContext('2d'),{
      type:'doughnut',
      data:{
        labels:lineaData.map(x=>x.lbl),
        datasets:[{data:lineaData.map(x=>x.v),backgroundColor:lineaData.map(x=>x.col),borderWidth:2,borderColor:'#fff'}]
      },
      options:{
        cutout:'60%',responsive:true,maintainAspectRatio:true,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:c=>`${c.label}: ${c.raw.toLocaleString('es-CL')} equipos (${lineaTotal>0?(c.raw/lineaTotal*100).toFixed(1):0}%)`}}
        }
      }
    });
    const leg=document.getElementById('sat-bi-tipos-legend');
    if(leg)leg.innerHTML=lineaData.map(x=>`
      <div style="display:flex;align-items:center;gap:.3rem;font-size:.58rem;color:var(--txt)">
        <span style="width:10px;height:10px;border-radius:2px;background:${x.col};flex-shrink:0"></span>
        <span>${x.lbl} (${x.v.toLocaleString('es-CL')})</span>
      </div>`).join('');
  }

  // Scatter se inicializa con filtro actual
  _renderSatBIScatter();
}

// Filtro de tramo para el scatter
function satFiltrarBIScatter(btn){
  document.querySelectorAll('#sat-bi-scatter-filt .btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  _satBIFiltTramo=btn.dataset.sbf;
  _renderSatBIScatter();
}

// Renderizado del scatter (separado para poder actualizar sin recrear todo)
function _renderSatBIScatter(){
  const inst=APP_DATA.satisf.instituciones||[];
  const ctxS=document.getElementById('cSatBIScatter');
  if(!ctxS)return;

  // Usar base instalada real (Potencial ST = Sí) como eje X
  const _biCliPotSc = _satGetBICliPot();

  const _inTramo=(bi,t)=>{
    if(!bi||bi<=0)return false;
    if(t==='todos')return true;
    if(t==='1-10')  return bi>=1  && bi<=10;
    if(t==='11-50') return bi>=11 && bi<=50;
    if(t==='51-100')return bi>=51 && bi<=100;
    if(t==='101+')  return bi>=101;
    return true;
  };
  const _biMapSc = {};
  inst.forEach(d=>{ const r=_satLookupBICliente(d,_biCliPotSc); if(r) _biMapSc[d.institucion]=r; });
  const pts=inst
    .map(d=>{
      const biRec=_biMapSc[d.institucion];
      const biReal=biRec?(biRec.total_si||0):0;
      if(!biReal||!_inTramo(biReal,_satBIFiltTramo))return null;
      return {
        x:biReal, y:d.recom,
        label:d.institucion, n:d.n,
        bi_detalle:biRec, categoria:d.categoria,
        calidad:d.calidad, tiempo:d.tiempo, bi_total:biReal,
        bg:d.recom>=7?'rgba(0,131,47,.8)':d.recom>=4?'rgba(255,192,0,.9)':'rgba(192,0,0,.8)'
      };
    })
    .filter(Boolean);

  if(_chSatBIScatter)_chSatBIScatter.destroy();
  _chSatBIScatter=safeChart(ctxS.getContext('2d'),{
    type:'scatter',
    data:{datasets:[{
      label:'Institución',
      data:pts,
      backgroundColor:pts.map(p=>p.bg),
      pointRadius:8,pointHoverRadius:12,
      borderWidth:1,borderColor:'rgba(255,255,255,.6)'
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,
      onClick:(evt,els)=>{
        if(!els.length)return;
        _showBIScatterDet(pts[els[0].index]);
      },
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          label:c=>{
            const p=c.raw;
            const lines=[p.label,`BI: ${p.x} equipos`,`Recom: ${p.y.toFixed(2)} / 10`];
            if(p.n>1)lines.push(`Prom. de ${p.n} respuestas`);
            return lines;
          }
        }}
      },
      scales:{
        x:{type:'logarithmic',min:1,
          title:{display:true,text:'Base Instalada total (escala logarítmica)',font:{size:10}},
          grid:{color:'#E2E6F0'},ticks:{callback:v=>Number.isInteger(v)?v:''}},
        y:{min:0,max:10,
          title:{display:true,text:'Recomendación promedio',font:{size:10}},
          grid:{color:'#E2E6F0'},ticks:{stepSize:2}}
      }
    }
  });
}

// Panel de detalle al hacer clic en un punto del scatter
function _showBIScatterDet(p){
  const det=document.getElementById('sat-bi-scatter-det');
  if(!det)return;
  const rcol=p.y>=7?'var(--gn)':p.y>=4?'var(--am)':'var(--rd)';
  const cls=p.categoria==='Sector Público'?'pb':p.categoria==='Sector Privado'?'por':'pgr';
  const bd=p.bi_detalle||{};
  const total=p.bi_total||1;

  const barrasHTML=_BD_KEYS.map((k,i)=>{
    const v=bd[k]||0;
    if(v===0)return'';
    const pct=Math.round(v/total*100);
    return`<div style="margin-bottom:.45rem">
      <div style="display:flex;justify-content:space-between;font-size:.58rem;color:var(--txt);margin-bottom:.12rem">
        <span>${_BD_LABELS[i]}</span>
        <span style="font-family:'Roboto Mono',monospace;font-weight:700">${v} <span style="color:var(--mut)">(${pct}%)</span></span>
      </div>
      <div style="height:7px;border-radius:4px;background:#D8DCE8;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${_BD_COLORS[i]};border-radius:4px"></div>
      </div>
    </div>`;
  }).join('');

  det.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.6rem">
      <div style="flex:1;min-width:0">
        <div style="font-size:.68rem;font-weight:700;color:var(--az1);line-height:1.3;word-break:break-word">${p.label}</div>
        <span class="pill ${cls}" style="margin-top:.2rem;display:inline-block">${p.categoria}</span>
        ${p.n>1?`<span style="font-size:.56rem;color:var(--mut);margin-left:.3rem">${p.n} resp.</span>`:''}
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:.5rem">
        <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.5rem;font-weight:900;color:${rcol}">${p.y.toFixed(2).replace('.',',')}</div>
        <div style="font-size:.52rem;color:var(--mut)">Recom./10</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-bottom:.7rem">
      <div style="background:#fff;border-radius:5px;padding:.45rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.1rem;font-weight:900;color:var(--az1)">${p.bi_total}</div>
        <div style="font-size:.5rem;color:var(--mut)">Equipos BI</div>
      </div>
      <div style="background:#fff;border-radius:5px;padding:.45rem;text-align:center">
        <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.1rem;font-weight:900;color:var(--mut)">${p.calidad.toFixed(1).replace('.',',')}</div>
        <div style="font-size:.5rem;color:var(--mut)">Calidad/7</div>
      </div>
    </div>
    <div style="font-size:.56rem;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.45rem">Composición BI</div>
    ${barrasHTML||'<div style="font-size:.6rem;color:var(--mut);font-style:italic">Sin detalle de composición</div>'}`;
}

// ─── Evolutivo trimestral: N° encuestas + satisfacción ───────────
function _renderSatEvolutivo(){
  const trim=(APP_DATA.satisf&&APP_DATA.satisf.trimestral)||[];
  const ctx=document.getElementById('cSatEvolutivo');
  if(!ctx||!trim.length)return;
  if(_chSatEvo){_chSatEvo.destroy();}
  _chSatEvo=safeChart(ctx.getContext('2d'),{
    type:'bar',
    data:{
      labels:trim.map(t=>t.trimestre),
      datasets:[
        {label:'N° Encuestas',data:trim.map(t=>t.n),backgroundColor:C.az2+'BB',borderColor:C.az2,borderWidth:2,borderRadius:4,yAxisID:'y',order:2},
        {label:'Recomendación Promedio',data:trim.map(t=>t.recom),type:'line',borderColor:C.am,backgroundColor:'transparent',borderWidth:2.5,tension:0.4,pointRadius:5,pointBackgroundColor:C.am,fill:false,yAxisID:'yRec',order:1}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'bottom',labels:{boxWidth:12,font:{size:9},padding:10}},
        tooltip:{callbacks:{label:c=>c.dataset.yAxisID==='yRec'?` Recomendación promedio: ${(c.raw||0).toFixed(2)}`:` ${c.dataset.label}: ${c.raw}`}}
      },
      scales:{
        x:{grid:{display:false},ticks:{font:{size:9}}},
        y:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{font:{size:9},precision:0},title:{display:true,text:'N° Encuestas',font:{size:8},color:'var(--mut)'}},
        yRec:{position:'right',min:0,max:10,grid:{display:false},ticks:{font:{size:9}},title:{display:true,text:'Recomendación (0-10)',font:{size:8},color:'#B8860B'}}
      }
    }
  });
}

// ─── Motivos de insatisfacción (categoría detractor) ─────────────
function _renderSatCatDet(){
  const cats=(APP_DATA.satisf&&APP_DATA.satisf.detractor_categorias)||[];
  const countEl=document.getElementById('sat-cat-det-count');
  const nTotal=cats.reduce((s,c)=>s+c.n,0);
  if(countEl)countEl.textContent=nTotal?`${nTotal} respuestas categorizadas`:'';

  const ctx=document.getElementById('cSatCatDet');
  if(ctx&&cats.length){
    if(_chSatCatDet){_chSatCatDet.destroy();}
    const cols=['#7A1FAA','#0A5C8C','#C05000','#007A72','#8B3A00','#1a6b2a'];
    _chSatCatDet=safeChart(ctx.getContext('2d'),{
      type:'bar',
      data:{labels:cats.map(c=>c.categoria),datasets:[{label:'N° respuestas',data:cats.map(c=>c.n),backgroundColor:cats.map((c,i)=>cols[i%cols.length]),borderRadius:5}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw} respuestas`}}},scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{precision:0}},y:{grid:{display:false},ticks:{font:{size:9}}}}}
    });
  }

  const tb=document.getElementById('tb-sat-cat-det');
  if(tb){
    tb.innerHTML=cats.length?(`
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--brd)">
          <th style="text-align:left;padding:.3rem .2rem;color:var(--mut);font-size:.58rem">Categoría</th>
          <th style="text-align:right;padding:.3rem .2rem;color:var(--mut);font-size:.58rem">N°</th>
          <th style="text-align:right;padding:.3rem .2rem;color:var(--mut);font-size:.58rem">Recom.</th>
        </tr></thead>
        <tbody>${cats.map(c=>`<tr>
          <td style="padding:.28rem .2rem">${_catBadge(c.categoria)}</td>
          <td class="num" style="text-align:right;font-weight:700">${c.n}</td>
          <td class="num" style="text-align:right;color:${c.recom_avg>=7?'var(--gn)':c.recom_avg>=4?'var(--am)':'var(--rd)'}">${c.recom_avg.toFixed(1).replace('.',',')}</td>
        </tr>`).join('')}</tbody>
      </table>`)
      :'<div style="padding:1rem;text-align:center;color:var(--mut);font-style:italic">Sin categorías registradas</div>';
  }
}

function initSatisfaccion(){
  const s=APP_DATA.satisf;
  const g=s.global;
  _satDomUnif=_unificarDominios(s.dominio||[]);
  _satComUnif=_unificarCom(s.comentarios||[]);
  document.getElementById('sat-k-n').textContent=g.n;
  document.getElementById('sat-k-n-sub').textContent=g.n+' respuestas';
  document.getElementById('sat-k-calidad').textContent=g.calidad_avg.toFixed(2).replace('.',',');
  document.getElementById('sat-k-tiempo').textContent=g.tiempo_avg.toFixed(2).replace('.',',');
  document.getElementById('sat-k-recom').textContent=g.recom_avg.toFixed(2).replace('.',',');
  document.getElementById('sat-k-nps').textContent=s.nps.nps>0?'+'+s.nps.nps:s.nps.nps;
  const npsCol=s.nps.nps>=50?C.gn:s.nps.nps>=0?C.am:C.rd;
  document.getElementById('sat-k-nps').style.color=npsCol;
  document.getElementById('sat-k-nps-sub').textContent=`${s.nps.pro} prom · ${s.nps.pas} pas · ${s.nps.det} det`;

  const totRes=g.resuelto_si+g.resuelto_no+g.resuelto_parcial;
  const pctSi=totRes>0?g.resuelto_si/totRes*100:0;
  document.getElementById('sat-resuelto-pct').textContent=pctSi.toFixed(0)+'%';
  document.getElementById('sat-res-si').textContent='('+g.resuelto_si+')';
  document.getElementById('sat-res-par').textContent='('+g.resuelto_parcial+')';
  document.getElementById('sat-res-no').textContent='('+g.resuelto_no+')';
  const ctxR=document.getElementById('cSatResuelto');
  if(ctxR){
    if(_chSatRes){_chSatRes.destroy();}
    _chSatRes=safeChart(ctxR.getContext('2d'),{
      type:'doughnut',
      data:{labels:['Sí, totalmente','Parcialmente','No, no fue resuelto'],datasets:[{data:[g.resuelto_si,g.resuelto_parcial,g.resuelto_no],backgroundColor:[C.gn,C.am,C.rd],borderWidth:0}]},
      options:{cutout:'68%',responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}}}
    });
  }

  const ctxN=document.getElementById('cSatNps');
  if(ctxN){
    if(_chSatNps){_chSatNps.destroy();}
    _chSatNps=safeChart(ctxN.getContext('2d'),{
      type:'bar',
      data:{labels:['Promotores (9-10)','Pasivos (7-8)','Detractores (0-6)'],datasets:[{label:'N° respuestas',data:[s.nps.pro,s.nps.pas,s.nps.det],backgroundColor:[C.gn,C.am,C.rd],borderRadius:5}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw} respuestas`}}},scales:{x:{beginAtZero:true,grid:{color:'#E2E6F0'},ticks:{stepSize:5}},y:{grid:{display:false}}}}
    });
  }

  const grid=document.getElementById('sat-cat-grid');
  if(grid){
    const colMap={'Sector Público':C.az2,'Sector Privado':C.or,'Correo personal':C.mut};
    grid.innerHTML=s.categoria.map(c=>{
      const col=colMap[c.categoria]||C.az3;
      return`<div class="card">
        <div class="ch"><span class="ct">${c.categoria}</span><span style="font-family:'Roboto Mono',monospace;font-size:.65rem;color:var(--mut)">${c.n} resp.</span></div>
        <div class="cb" style="padding:1rem">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;text-align:center">
            <div style="background:var(--gy);padding:.6rem;border-radius:5px">
              <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.2rem;font-weight:900;color:${col}">${c.calidad.toFixed(1).replace('.',',')}</div>
              <div style="font-size:.55rem;color:var(--mut)">Calidad (0-7)</div>
            </div>
            <div style="background:var(--gy);padding:.6rem;border-radius:5px">
              <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.2rem;font-weight:900;color:${col}">${c.tiempo.toFixed(1).replace('.',',')}</div>
              <div style="font-size:.55rem;color:var(--mut)">Tiempo (0-7)</div>
            </div>
            <div style="background:var(--gy);padding:.6rem;border-radius:5px">
              <div style="font-family:'Roboto Condensed',sans-serif;font-size:1.2rem;font-weight:900;color:${col}">${c.recom.toFixed(1).replace('.',',')}</div>
              <div style="font-size:.55rem;color:var(--mut)">Recom. (0-10)</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Detractores: usar instituciones completas (no solo las con comentario)
  const _biCliPotDet = _satGetBICliPot();
  const det=(s.instituciones||[]).filter(d=>d.recom<7).sort((a,b)=>a.recom-b.recom);

  const detTb=document.getElementById('tb-sat-det');
  if(detTb){
    detTb.innerHTML=det.map((d,i)=>{
      const cls=d.categoria==='Sector Público'?'pb':d.categoria==='Sector Privado'?'por':'pgr';
      const biRec=_satLookupBICliente(d,_biCliPotDet);
      const biSi=biRec?(biRec.total_si||0):null;
      const biStyle=biSi!=null?'color:#C00000;font-weight:700':'color:var(--mut)';
      const nTag=d.n>1?`<span style="font-size:.58rem;background:#FFE0E0;border-radius:3px;padding:.1rem .3rem;margin-left:.3rem">${d.n} resp.</span>`:'';
      const ctr = _satContrMonto(d);
      const contrCell = ctr.monto > 0
        ? `<td style="text-align:right;color:var(--gn);font-weight:700;font-size:.65rem;font-family:'Roboto Mono',monospace" title="${ctr.tipos.join(' + ')||'según hoja SATISFACCION'}">${mm(ctr.monto)}</td>`
        : ctr.n > 0
          ? `<td style="text-align:center;color:var(--gn);font-weight:700;font-size:.65rem" title="Contrato vigente sin monto anual cargado">Sí</td>`
          : `<td></td>`;
      return`<tr>
        <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
        <td><strong>${d.institucion}</strong>${nTag}</td>
        <td><span class="pill ${cls}">${d.categoria}</span></td>
        <td>${_catBadge(d.cat_detractor)}</td>
        ${contrCell}
        <td style="text-align:center;font-family:'Roboto Mono',monospace">${d.n}</td>
        <td style="text-align:right;font-family:'Roboto Mono',monospace;${biStyle}">${biSi!=null?biSi:'—'}</td>
        <td class="num" style="text-align:right;color:var(--mut)">${d.calidad.toFixed(2).replace('.',',')}</td>
        <td class="num" style="text-align:right;color:var(--mut)">${d.tiempo.toFixed(2).replace('.',',')}</td>
        <td class="num" style="text-align:right;color:var(--rd);font-weight:700">${d.recom.toFixed(2).replace('.',',')}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--gn);padding:1rem">No hay detractores registrados</td></tr>';
  }
  const detCount=document.getElementById('sat-det-count');
  if(detCount)detCount.textContent=det.length+' instituciones con recom. < 7';

  renderSatTabla();
  renderSatCom();
  renderSatBI();

  // ── Detractores · Base Instalada ─────────────────────────────────────────
  _renderSatDetBI();

  // ── Evolutivo trimestral y motivos de insatisfacción ─────────────────────
  _renderSatEvolutivo();
  _renderSatCatDet();
}

function _normBI(s){
  return (s||'').trim().toUpperCase()
    .replace(/\s+/g,' ')
    .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E')
    .replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O')
    .replace(/[ÚÙÜÛ]/g,'U').replace(/Ñ/g,'N');
}

function _renderSatDetBI(){
  const satView = document.getElementById('view-satisfaccion');
  if(!satView) return;

  const bi   = APP_DATA.base_instalada || {};
  // Solo equipos con Potencial ST = Sí (marcas que TECSERVICE representa)
  const biCli = (bi.clientes || []).filter(c => c.potencial_st);
  const inst  = (APP_DATA.satisf && APP_DATA.satisf.instituciones) || [];

  // Detractores: recom < 7 (NPS score ≤ 6)
  const detractores = inst.filter(d => d.recom < 7).sort((a,b) => a.recom - b.recom);

  // Match usando nombre_bi del Excel (col 16 SATISFACCION) con fallback fuzzy
  function matchBI(inst){
    const nombreBi = (inst && inst.nombre_bi) ? inst.nombre_bi : '';
    const nombre   = (inst && inst.institucion) ? inst.institucion : (inst||'');
    // 1. Búsqueda exacta por NombreBI del Excel
    if(nombreBi){
      const f = biCli.find(c => _normBI(c.nombre) === _normBI(nombreBi));
      if(f) return f;
    }
    // 2. Fallback: búsqueda exacta por nombre institución
    const nk = _normBI(nombre);
    let found = biCli.find(c => _normBI(c.nombre) === nk);
    if(found) return found;
    // Luego buscar si uno contiene al otro (min 5 chars)
    if(nk.length >= 5){
      found = biCli.find(c => {
        const ck = _normBI(c.nombre);
        return ck.includes(nk) || nk.includes(ck);
      });
    }
    return found || null;
  }

  // Sección container
  const secId = 'sat-det-bi-sec';
  let sec = document.getElementById(secId);
  if(!sec){
    sec = document.createElement('div');
    sec.id = secId;
    sec.style.marginTop = '1.2rem';
    satView.appendChild(sec);
  }

  const nDet = detractores.length;
  // Mapa de panel y contratos para cruce
  const panelMap={};
  (APP_DATA.panel||[]).forEach(p=>{panelMap[_normBI(p.cliente)]=p;});
  function _findPanel(nom){
    const k=_normBI(nom);
    if(panelMap[k])return panelMap[k];
    const f=Object.keys(panelMap).find(pk=>pk.includes(k)||k.includes(pk));
    return f?panelMap[f]:null;
  }
  const contratoMap={};
  (typeof DATA!=='undefined'?DATA:[]).forEach(d=>{
    const k=_normBI(d.cliente);
    if(!contratoMap[k])contratoMap[k]={n:0,tipos:[],coords:[]};
    contratoMap[k].n++;
    if(!contratoMap[k].tipos.includes(d.tipo))contratoMap[k].tipos.push(d.tipo);
  });
  function _findContrato(nom){
    const k=_normBI(nom);
    if(contratoMap[k])return contratoMap[k];
    const f=Object.keys(contratoMap).find(ck=>ck.includes(k)||k.includes(ck));
    return f?contratoMap[f]:null;
  }
  function _contrBadge(d,p){
    if(d&&d.n>0){
      if(d.tipos.includes('Comercial'))return'<span class="badge bok">✓ Contrato activo</span>';
      return'<span class="badge bte">Garantía activa</span>';
    }
    if(p&&p.tiene_contrato)return'<span class="badge bok">Con contrato</span>';
    if(p)return'<span class="badge bgy">Sin contrato</span>';
    return'<span class="badge bgy">Sin datos</span>';
  }

  // Se guardan los valores ya cruzados para reutilizarlos en el exportable
  // sin repetir la lógica de match con base instalada, panel y contratos.
  window._satDetBIRows = [];

  const rows = detractores.map((d,i) => {
    const rcol = 'var(--rd)';
    const biRec = matchBI(d);
    const panelRec = _findPanel(d.institucion);
    const contrRec = _findContrato(d.institucion);
    // Usar conteos _si (Potencial ST=Sí, habilitados) — misma fuente que tabla BI
    const totalEq  = biRec ? (biRec.total_si||0).toLocaleString('es-CL') : '—';
    const dental    = biRec ? (biRec.dental_si    || '—') : '—';
    const ester     = biRec ? (biRec.esterilizacion_si || '—') : '—';
    const incardia  = biRec ? (biRec.incardia_si   || '—') : '—';
    const endo      = biRec ? (biRec.endoscopia_si || '—') : '—';
    const mob       = biRec ? (biRec.mobiliario_si || '—') : '—';
    // Prioridad: col AC de SATISFACCION → panel de facturación → '—'
    const fac2026   = d.fac_2026 > 0 ? mm(d.fac_2026)
      : panelRec && (panelRec.real_ytd||0) > 0 ? mm(panelRec.real_ytd) : '—';
    const calCol = d.calidad >= 5 ? 'var(--gn)' : d.calidad >= 3 ? 'var(--am)' : 'var(--rd)';
    const tieCol = d.tiempo  >= 5 ? 'var(--gn)' : d.tiempo  >= 3 ? 'var(--am)' : 'var(--rd)';
    const nTag = d.n > 1 ? `<span style="font-size:.56rem;background:#FFE0E0;border-radius:3px;padding:.08rem .3rem;margin-left:.3rem">${d.n} resp.</span>` : '';
    // Contrato: mostrar monto si contr_asociados > 0, si no indicar si tiene contrato activo
    // Si ni la hoja ni el panel traen monto, se toma el valor anual del
    // contrato desde DATA: antes esos casos caían en un "Sí" sin cifra
    // (Clínica Vespucio, Hospital San Camilo, Hospital de Puerto Aysén).
    const montoContrDet = (d.contr_asociados > 0) ? d.contr_asociados
      : (panelRec && (panelRec.presup_contr_ytd || 0) > 0) ? panelRec.presup_contr_ytd
      : (typeof _satContrMonto === 'function' ? _satContrMonto(d).monto : 0);
    const tieneContr = montoContrDet > 0
      || (contrRec && contrRec.n > 0 && contrRec.tipos && contrRec.tipos.includes('Comercial'))
      || (panelRec && panelRec.tiene_contrato);
    const contrCell = montoContrDet > 0
      ? `<td style="text-align:right;font-weight:700;color:var(--gn);font-family:'Roboto Mono',monospace">${mm(montoContrDet)}</td>`
      : tieneContr
        ? `<td style="text-align:center;font-weight:700;color:var(--gn)">Sí</td>`
        : `<td></td>`;
    window._satDetBIRows.push({
      inst: d.institucion, n: d.n, cat: d.cat_detractor || '',
      recom: d.recom, calidad: d.calidad, tiempo: d.tiempo,
      contrMonto: montoContrDet, contrSi: !!tieneContr,
      fac2026: fac2026, totalEq: totalEq,
      dental: dental, ester: ester, incardia: incardia, endo: endo, mob: mob,
    });
    return `<tr>
      <td style="font-family:'Roboto Mono',monospace;color:var(--mut);font-size:.62rem">${i+1}</td>
      <td><strong style="font-size:.7rem;color:var(--az1)">${d.institucion}</strong>${nTag}</td>
      <td>${_catBadge(d.cat_detractor)}</td>
      <td style="text-align:center;font-family:'Roboto Mono',monospace;font-weight:700;color:${rcol}">${d.recom.toFixed(d.n>1?2:0)}</td>
      <td style="text-align:center;font-family:'Roboto Mono',monospace;color:${calCol}">${d.calidad.toFixed(d.n>1?2:0)}</td>
      <td style="text-align:center;font-family:'Roboto Mono',monospace;color:${tieCol}">${d.tiempo.toFixed(d.n>1?2:0)}</td>
      ${contrCell}
      <td style="text-align:right;color:var(--az1);font-weight:700">${fac2026}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;font-weight:700;color:var(--az1)">${totalEq}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--am)">${dental}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--az2)">${ester}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--or)">${incardia}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:var(--teal)">${endo}</td>
      <td style="text-align:right;font-family:'Roboto Mono',monospace;color:#7B2FBE">${mob}</td>
    </tr>`;
  }).join('');

  sec.innerHTML = `
  <div class="sh" style="margin-top:.6rem">
    <h2>Detractores</h2>
    <div class="sh-line"></div>
    <span class="sh-tag" style="color:var(--rd)">${nDet} institución${nDet!==1?'es':''} con recomendación &le; 6 · cruce con contratos activos (hoja Contratos) y base instalada</span>
  </div>
  <div class="card" style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:.68rem">
      <thead>
        <tr style="background:var(--az3);color:#fff">
          <th style="padding:.5rem .6rem;width:2rem">#</th>
          <th style="padding:.5rem .6rem;text-align:left">Institución</th>
          <th style="padding:.5rem .6rem;text-align:left">Categoría</th>
          <th style="padding:.5rem .6rem;text-align:center;color:#FF9090">Recom.</th>
          <th style="padding:.5rem .6rem;text-align:center;color:#90C090">Calidad</th>
          <th style="padding:.5rem .6rem;text-align:center;color:#90B8D8">Tiempo</th>
          <th style="padding:.5rem .6rem;text-align:left">Contrato</th>
          <th style="padding:.5rem .6rem;text-align:right;color:#FFC000">Fac. 2026</th>
          <th style="padding:.5rem .6rem;text-align:right">Total Eq.</th>
          <th style="padding:.5rem .6rem;text-align:right;color:#FFC000">Dental</th>
          <th style="padding:.5rem .6rem;text-align:right;color:#A0B8F0">Esteril.</th>
          <th style="padding:.5rem .6rem;text-align:right;color:#F0A060">Incardia</th>
          <th style="padding:.5rem .6rem;text-align:right;color:#28D2C3">Endosc.</th>
          <th style="padding:.5rem .6rem;text-align:right;color:#C0A0F0">Mobil.</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="14" style="text-align:center;color:var(--gn);padding:1rem">No hay detractores registrados</td></tr>`}
      </tbody>
    </table>
  </div>
  <div style="margin-top:.5rem;padding:.45rem .7rem;background:rgba(255,192,0,.08);border-left:3px solid var(--am);border-radius:4px;font-size:.6rem;color:var(--mut);line-height:1.5">
    ℹ️ <strong style="color:var(--am)">Nota Base Instalada:</strong> Los equipos mostrados consideran únicamente marcas con <strong>Potencial ST = Sí</strong>, es decir, marcas que TECSERVICE actualmente representa y para las cuales podría ofrecer servicios de mantención. Equipos de marcas no representadas quedan excluidos de este cruce.
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTAR RESUMEN A PDF — una sola hoja
// Mismo enfoque que eerrExportPDF(): se mide el ancho natural del
// contenido y se crea una pagina de esa medida exacta.
// Los <canvas> no sobreviven a cloneNode(), asi que cada grafico se
// convierte a <img> con toDataURL() antes de capturar.
// ═══════════════════════════════════════════════════════════════
async function satExportPDF(){
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    alert('Librerías PDF no cargadas. Verifique conexión a internet e intente de nuevo.');
    return;
  }
  const btn = document.getElementById('sat-pdf-btn');
  const SVG_ICON = '<svg width="11" height="13" viewBox="0 0 11 13" fill="none" style="flex-shrink:0"><path d="M1.5 1h6l2.5 2.5V12a.5.5 0 01-.5.5h-8A.5.5 0 011 12V1.5A.5.5 0 011.5 1z" stroke="#fff" stroke-width="1" fill="none"/><path d="M7 1v3h3" stroke="#fff" stroke-width="1" fill="none"/><path d="M3 6.5h5M3 8.5h5M3 10.5h3" stroke="#fff" stroke-width=".9" stroke-linecap="round"/></svg>Exportar PDF';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  const txt = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : '—'; };
  const imgDe = (id, w, h) => {
    const cv = document.getElementById(id);
    if (!cv || !cv.toDataURL) return '';
    try {
      return '<img src="' + (hdChartImg(cv) || cv.toDataURL('image/png')) + '" style="width:' + w + 'px;height:' + h +
             'px;object-fit:contain;display:block">';
    } catch (e) { return ''; }
  };

  let wrap = null;
  try {
    const S = (window.APP_DATA || {}).satisf || {};
    const nps = S.nps || {};
    const hoy = (window.APP_DATA || {}).hoy || '';

    // ── KPIs ──
    const kpi = (lbl, val, sub, col) =>
      '<div style="flex:1;min-width:120px;background:#F4F6FB;border-top:3px solid ' + col +
      ';border-radius:5px;padding:7px 10px">' +
      '<div style="font-size:8px;text-transform:uppercase;letter-spacing:.06em;color:#6B7BA8">' + lbl + '</div>' +
      '<div style="font-size:19px;font-weight:900;color:' + col + ';line-height:1.1;font-family:Arial,sans-serif">' + val + '</div>' +
      '<div style="font-size:8px;color:#8892a8;margin-top:1px">' + sub + '</div></div>';

    const kpis =
      kpi('Total Encuestas',     txt('sat-k-n'),       txt('sat-k-n-sub'),  '#002D73') +
      kpi('Calidad Promedio',    txt('sat-k-calidad'), 'escala 1 a 7',      '#33448D') +
      kpi('Tiempo de Respuesta', txt('sat-k-tiempo'),  'escala 1 a 7',      '#0A5C8C') +
      kpi('Recomendación',       txt('sat-k-recom'),   'escala 0 a 10',     '#28D2C3') +
      kpi('NPS',                 txt('sat-k-nps'),     txt('sat-k-nps-sub'), (nps.nps || 0) >= 50 ? '#00832F' : (nps.nps || 0) >= 0 ? '#B8860B' : '#C00000');

    // ── Tabla de detractores ──
    // Es la misma que cierra la hoja: cruza cada institución con contratos
    // activos y base instalada (sólo marcas con Potencial ST = Sí). Se arma
    // desde los valores que deja _renderSatDetBI(), porque los badges de
    // categoría usan variables CSS que html2canvas no resuelve. Van todas las
    // filas; la letra se ajusta al alto de la tabla.
    if (typeof _renderSatDetBI === 'function' && !window._satDetBIRows) {
      try { _renderSatDetBI(); } catch (e) { /* la hoja aún no se ha abierto */ }
    }
    const det = window._satDetBIRows || [];
    const fDet = det.length > 22 ? 6.6 : det.length > 16 ? 7.1 : 7.6;
    const pDet = det.length > 22 ? '1.6px 5px' : '2.6px 5px';
    const CAT_COL = {
      'Tiempo de Respuesta': '#0A5C8C', 'Mala Resolucion': '#C05000',
      'Rotación Tecnicos': '#8B3A00', 'Mala Respuesta Solicitudes': '#007A72',
      'Otros': '#7A1FAA',
    };
    const n2 = (v, n) => (v == null ? '—' : v.toFixed(n > 1 ? 2 : 0).replace('.', ','));
    const colNota = v => v >= 5 ? '#00832F' : v >= 3 ? '#B8860B' : '#C00000';

    let detHTML = '';
    if (det.length) {
      const enc = [['#', 'right'], ['INSTITUCIÓN', 'left'], ['CATEGORÍA', 'left'],
                   ['RECOM.', 'center'], ['CALIDAD', 'center'], ['TIEMPO', 'center'],
                   ['CONTRATO', 'right'], ['FAC. 2026', 'right'], ['TOTAL EQ.', 'right'],
                   ['DENTAL', 'right'], ['ESTERIL.', 'right'], ['INCARDIA', 'right'],
                   ['ENDOSC.', 'right'], ['MOBIL.', 'right']];
      detHTML =
        '<div style="font-size:9px;font-weight:700;color:#C00000;text-transform:uppercase;' +
        'letter-spacing:.06em;margin:0 0 4px">Detractores · ' + det.length +
        ' instituciones con recomendación ≤ 6 · cruce con contratos activos y base instalada</div>' +
        '<table style="border-collapse:collapse;width:100%">' +
          '<thead><tr>' + enc.map(e =>
            '<th style="background:#002D73;color:#fff;font-size:' + (fDet - 0.6) + 'px;padding:3px 5px;' +
            'letter-spacing:.03em;white-space:nowrap;text-align:' + e[1] + '">' + e[0] + '</th>').join('') +
          '</tr></thead><tbody>' +
          det.map((d, i) => {
            const td = 'font-size:' + fDet + 'px;padding:' + pDet + ';border-bottom:1px solid #E6EAF2;white-space:nowrap';
            const cc = CAT_COL[d.cat] || '#6B7BA8';
            const eq = (v, col) => '<td style="' + td + ';text-align:right;color:' +
              (v === '—' ? '#B8C1D8' : col) + '">' + v + '</td>';
            const contr = d.contrMonto > 0 ? mm(d.contrMonto) : d.contrSi ? 'Sí' : '—';
            return '<tr style="background:' + (i % 2 ? '#fff' : '#F7F9FC') + '">' +
              '<td style="' + td + ';text-align:right;color:#8892a8">' + (i + 1) + '</td>' +
              '<td style="' + td + ';font-weight:600;white-space:normal;max-width:250px;line-height:1.25">' +
                d.inst + (d.n > 1 ? ' <span style="color:#8892a8;font-weight:400">(' + d.n + ' resp.)</span>' : '') + '</td>' +
              '<td style="' + td + ';white-space:normal;max-width:130px;line-height:1.25;color:' + cc +
                ';font-weight:700">' + (d.cat || '—') + '</td>' +
              '<td style="' + td + ';text-align:center;font-weight:700;color:#C00000">' + n2(d.recom, d.n) + '</td>' +
              '<td style="' + td + ';text-align:center;color:' + colNota(d.calidad) + '">' + n2(d.calidad, d.n) + '</td>' +
              '<td style="' + td + ';text-align:center;color:' + colNota(d.tiempo) + '">' + n2(d.tiempo, d.n) + '</td>' +
              '<td style="' + td + ';text-align:right;font-weight:700;color:' +
                (d.contrMonto > 0 || d.contrSi ? '#00832F' : '#B8C1D8') + '">' + contr + '</td>' +
              '<td style="' + td + ';text-align:right;font-weight:700;color:' +
                (d.fac2026 === '—' ? '#B8C1D8' : '#002D73') + '">' + d.fac2026 + '</td>' +
              eq(d.totalEq, '#002D73') + eq(d.dental, '#B8860B') + eq(d.ester, '#33448D') +
              eq(d.incardia, '#D46000') + eq(d.endo, '#0A7D74') + eq(d.mob, '#7B2FBE') +
            '</tr>';
          }).join('') +
        '</tbody></table>' +
        '<div style="font-size:7px;color:#8892a8;margin-top:4px;line-height:1.45">' +
        'Los equipos consideran únicamente marcas con Potencial ST = Sí, es decir las que TECSERVICE ' +
        'representa y para las cuales podría ofrecer mantención.</div>';
    }

    // ── Motivos de insatisfacción (categoría detractor) ──
    // Se arma desde APP_DATA en vez de clonar el DOM: el badge de categoría
    // usa colores por variable CSS que no sobreviven a html2canvas.
    const cats = ((window.APP_DATA || {}).satisf || {}).detractor_categorias || [];
    const nCats = cats.reduce((a, c) => a + c.n, 0);
    let catHTML = '';
    if (cats.length) {
      const colR = v => v >= 7 ? '#00832F' : v >= 4 ? '#B8860B' : '#C00000';
      const PAL = ['#7A1FAA', '#0A5C8C', '#C05000', '#007A72', '#8B3A00', '#1a6b2a'];
      const maxN = Math.max.apply(null, cats.map(c => c.n)) || 1;
      const recProm = nCats ? cats.reduce((a, c) => a + c.recom_avg * c.n, 0) / nCats : 0;
      const enc = [['MOTIVO', 'left'], ['N°', 'right'], ['% DEL TOTAL', 'left'], ['RECOM.', 'right']];
      catHTML =
        '<table style="border-collapse:collapse;width:100%;table-layout:fixed">' +
          '<colgroup><col style="width:34%"><col style="width:9%"><col style="width:42%"><col style="width:15%"></colgroup>' +
          '<thead><tr>' + enc.map(e =>
            '<th style="background:#002D73;color:#fff;font-size:7.5px;padding:4px 7px;letter-spacing:.04em;' +
            'text-align:' + e[1] + '">' + e[0] + '</th>').join('') + '</tr></thead><tbody>' +
          cats.map((c, i) => {
            const col = PAL[i % PAL.length];
            const pct = nCats ? c.n / nCats * 100 : 0;
            const td = 'font-size:8.5px;padding:5px 7px;border-bottom:1px solid #E6EAF2';
            return '<tr style="background:' + (i % 2 ? '#fff' : '#F7F9FC') + '">' +
              '<td style="' + td + ';font-weight:600">' +
                '<span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:' + col +
                ';margin-right:5px"></span>' + c.categoria + '</td>' +
              '<td style="' + td + ';text-align:right;font-weight:700">' + c.n + '</td>' +
              '<td style="' + td + '">' +
                '<div style="display:flex;align-items:center;gap:6px">' +
                  '<div style="flex:1;height:8px;background:#E6EAF2;border-radius:4px;overflow:hidden">' +
                    '<div style="height:8px;width:' + (c.n / maxN * 100) + '%;background:' + col + '"></div></div>' +
                  '<span style="font-size:7.5px;color:#6B7BA8;min-width:30px;text-align:right">' +
                    pct.toFixed(1).replace('.', ',') + '%</span>' +
                '</div></td>' +
              '<td style="' + td + ';text-align:right;font-weight:700;color:' + colR(c.recom_avg) + '">' +
                c.recom_avg.toFixed(1).replace('.', ',') + '</td>' +
            '</tr>';
          }).join('') +
          '<tr style="background:#002D73;color:#fff;font-weight:800">' +
            '<td style="font-size:8.5px;padding:5px 7px">TOTAL</td>' +
            '<td style="font-size:8.5px;padding:5px 7px;text-align:right">' + nCats + '</td>' +
            '<td style="font-size:8.5px;padding:5px 7px;color:rgba(255,255,255,.75)">100,0%</td>' +
            '<td style="font-size:8.5px;padding:5px 7px;text-align:right">' +
              (nCats ? recProm.toFixed(1).replace('.', ',') : '—') + '</td></tr>' +
        '</tbody></table>';
    }

    const secLbl = t => '<div style="font-size:9px;font-weight:700;color:#002D73;text-transform:uppercase;' +
                        'letter-spacing:.06em;margin:0 0 4px">' + t + '</div>';

    wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;width:1300px;' +
      'padding:16px 24px 20px;font-family:Arial,sans-serif;color:#111;box-sizing:border-box';

    wrap.innerHTML =
      '<div style="border-bottom:2.5px solid #002D73;padding-bottom:6px;margin-bottom:10px">' +
        '<span style="font-size:13px;font-weight:700;color:#002D73">TECSERVICE — Satisfacción de Clientes</span>' +
        '&emsp;<span style="font-size:10px;color:#555">' + txt('sat-k-n') + ' encuestas respondidas' +
        (hoy ? ' &nbsp;·&nbsp; Datos al ' + hoy : '') + '</span>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' + kpis + '</div>' +
      '<div style="display:flex;gap:14px;margin-bottom:14px;align-items:flex-start">' +
        '<div style="flex:1.35">' + secLbl('Evolución trimestral') + imgDe('cSatEvolutivo', 620, 195) + '</div>' +
        '<div style="flex:1">' + secLbl('Distribución NPS') + imgDe('cSatNps', 430, 195) + '</div>' +
        '<div style="width:210px;flex-shrink:0">' + secLbl('¿Problema resuelto?') +
          imgDe('cSatResuelto', 185, 150) +
          '<div style="font-size:8px;color:#444;margin-top:3px;line-height:1.55">' +
            '<div><span style="display:inline-block;width:8px;height:8px;background:#00832F;border-radius:2px;margin-right:4px"></span>Sí, totalmente <strong>' + txt('sat-res-si') + '</strong></div>' +
            '<div><span style="display:inline-block;width:8px;height:8px;background:#FFC000;border-radius:2px;margin-right:4px"></span>Parcialmente <strong>' + txt('sat-res-par') + '</strong></div>' +
            '<div><span style="display:inline-block;width:8px;height:8px;background:#C00000;border-radius:2px;margin-right:4px"></span>No resuelto <strong>' + txt('sat-res-no') + '</strong></div>' +
          '</div></div>' +
      '</div>' +
      '<div>' + detHTML + '</div>' +
      (cats.length ?
        '<div style="display:flex;gap:16px;align-items:flex-start;margin-top:16px">' +
          '<div style="width:430px;flex-shrink:0">' +
            secLbl('Motivos de insatisfacción · categoría detractor') +
            imgDe('cSatCatDet', 430, 190) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            secLbl(nCats + ' respuestas categorizadas') + catHTML + '</div>' +
        '</div>' : '');

    document.body.appendChild(wrap);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const realW = Math.ceil(wrap.getBoundingClientRect().width)  || wrap.offsetWidth;
    const realH = Math.ceil(wrap.getBoundingClientRect().height) || wrap.offsetHeight;
    if (!realW || !realH) throw new Error('No se pudo medir el contenido');

    const canvas = await html2canvas(wrap, {
      scale: hdEscala(realW, realH), backgroundColor: '#ffffff', useCORS: true, logging: false,
      width: realW, height: realH, windowWidth: realW, windowHeight: realH,
    });

    const MM_PX = 25.4 / 96;
    await hdEntregar(canvas, 'Satisfaccion_Clientes_TS_' + (hoy || '').replace(/[\s/]+/g, '-'),
                     realW * MM_PX, realH * MM_PX);

  } catch (err) {
    console.error('satExportPDF:', err);
    alert('Error al generar PDF: ' + err.message);
  } finally {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    if (btn) { btn.disabled = false; btn.innerHTML = SVG_ICON; }
  }
}
