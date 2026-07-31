// ═══════════════════════════════════════════════════════════════
// hoja_desglose.js — Desglose de Ingresos (Contratos por línea + Otros Ingresos)
// Depende de: datos.js (APP_DATA.desglose_ingresos), utils.js
// ═══════════════════════════════════════════════════════════════
(function(){
  const D = (APP_DATA && APP_DATA.desglose_ingresos) || {};
  if(!D.meses || !D.meses.length){
    const el = document.getElementById('desg-empty');
    if(el) el.style.display='block';
    return;
  }

  const meses = D.meses;
  const n = meses.length;

  const mesLbl = document.getElementById('desg-mes-lbl');
  if(mesLbl) mesLbl.textContent = meses[n-1];
  const anoLbl = document.getElementById('desg-ano-lbl');
  if(anoLbl) anoLbl.textContent = ANO_ACTUAL;

  const fN1 = v => (v||0).toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1});
  const fmm = v => { const a=Math.abs(v||0); return (v<0?'−':'')+fN1(a); };

  const contratosTotal = D.contratos.total[n];
  const otrosTotal     = D.otros.total[n];
  const grandTotal     = D.total_general[n];

  const k1=document.getElementById('desg-k1'), k2=document.getElementById('desg-k2'), k3=document.getElementById('desg-k3');
  if(k1) k1.textContent = 'MM$'+fmm(grandTotal);
  if(k2) k2.textContent = 'MM$'+fmm(contratosTotal);
  if(k3) k3.textContent = 'MM$'+fmm(otrosTotal);

  // Evita que hover del .tbl borre el fondo en la fila azul de total (texto blanco)
  if(!document.getElementById('desg-azul-style')){
    const s = document.createElement('style');
    s.id = 'desg-azul-style';
    s.textContent = `
      #desg-table tr.desg-azul:hover { background: var(--az3) !important; }
      #desg-table tr.desg-azul:hover td { background-color: transparent; }
    `;
    document.head.appendChild(s);
  }

  // ── TABLA ────────────────────────────────────────────────────
  const tblEl = document.getElementById('desg-table');
  if(tblEl){
    const colHdr    = 'background:var(--az3);color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const colHdrTot = 'background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.6rem;font-weight:700;text-align:center;padding:.35rem .4rem';
    const SL  = 'position:sticky;left:0;top:0;z-index:2';
    const NW  = 'white-space:nowrap';
    const BG_CEL = '#def3fa';
    const BG_SEP = '#edf0f5';
    const SLC = bg => `position:sticky;left:0;z-index:1;background:${bg};border-right:1px solid rgba(0,0,0,.08)`;

    const thMeses = meses.map(m=>`<th style="position:sticky;top:0;z-index:2;${colHdr}">${m.slice(0,3)}</th>`).join('');

    const sepRow = lbl => `<tr style="background:rgba(0,45,115,.07)">
      <td style="${SLC(BG_SEP)};font-size:.58rem;font-weight:700;color:var(--mut);padding:.22rem .6rem;letter-spacing:.05em">${lbl.toUpperCase()}</td>
      <td colspan="${n+2}" style="background:rgba(0,45,115,.07)"></td>
    </tr>`;

    const cellsRow = (valores,fw,color) => {
      const c = color||'#111';
      const mesesTd = Array.from({length:n},(_,i)=>`<td class="num" style="${NW};${fw?'font-weight:700;':''}color:${c}">${fmm(valores[i])}</td>`).join('');
      const totTd   = `<td class="num" style="${NW};font-weight:700;color:${c}">${fmm(valores[n])}</td>`;
      const pctTd   = `<td class="num" style="${NW};color:${color?'rgba(255,255,255,.6)':'var(--mut)'}">${grandTotal>0?((valores[n]/grandTotal)*100).toFixed(1).replace('.',','):'0,0'}%</td>`;
      return mesesTd+totTd+pctTd;
    };

    const dataRow = (lbl,valores) => `<tr>
      <td style="${SLC('var(--bg,#fff)')};font-size:.62rem;white-space:nowrap;padding:.3rem .6rem .3rem 1.4rem">${lbl}</td>
      ${cellsRow(valores,false)}
    </tr>`;

    const subtotalRow = (lbl,valores) => `<tr style="background:rgba(0,160,220,.13)">
      <td style="${SLC(BG_CEL)};font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;font-weight:700">${lbl}</td>
      ${cellsRow(valores,true)}
    </tr>`;

    const totalRow = (lbl,valores) => `<tr class="desg-azul" style="background:var(--az3)">
      <td style="${SLC('var(--az3)')};font-size:.62rem;white-space:nowrap;padding:.35rem .6rem;font-weight:700;color:#fff">${lbl}</td>
      ${cellsRow(valores,true,'#fff')}
    </tr>`;

    tblEl.innerHTML = `
      <div style="overflow-x:auto;overflow-y:auto;max-height:60vh">
        <table class="tbl" style="font-size:.62rem;width:100%;min-width:640px;border-collapse:separate;border-spacing:0">
          <thead>
            <tr>
              <th style="${SL};${colHdr};text-align:left;min-width:200px">Concepto</th>
              ${thMeses}
              <th style="position:sticky;top:0;z-index:2;${colHdrTot}">TOTAL</th>
              <th style="position:sticky;top:0;z-index:2;${colHdrTot}">% TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${sepRow('Ingreso por Contratos')}
            ${D.contratos.lineas.map(l=>dataRow(l.label,l.valores)).join('')}
            ${subtotalRow('Total Ingreso por Contratos',D.contratos.total)}
            ${sepRow('Otros Ingresos')}
            ${D.otros.categorias.map(c=>dataRow(c.label,c.valores)).join('')}
            ${subtotalRow('Total Otros Ingresos',D.otros.total)}
            ${totalRow('TOTAL FACTURACIÓN',D.total_general)}
          </tbody>
        </table>
      </div>`;
  }

  // ── REGIÓN ───────────────────────────────────────────────────
  // Misma base que la tabla de desglose: contr_meses_2026 + otros proporcional
  const PR = D.por_region || {};
  const regiones = PR.regiones || [];
  const regData  = PR.data    || {};

  const PALETTE_MAP = {
    'Esterilización':'#002D73','Endoscopía':'#28D2C3','Dental':'#FFC000',
    'Trazabilidad':'#7A1FAA','REAS':'#E87722',
    'Reparación Esterilización':'#0A5C8C','Reparación Endoscopía':'#00832F','Reparación Dental':'#D46000',
  };
  const PALETTE_REG = ['#002D73','#28D2C3','#FFC000','#E87722','#7A1FAA',
                       '#0A5C8C','#00832F','#D46000','#8B008B','#5a7da8',
                       '#c44569','#574b90','#3c9d4e','#b5451b','#888','#333','#aaa'];

  if(regiones.length > 0){
    let selReg  = null;
    let chartReg = null;
    let mainChart = null; // referencia al gráfico global para poder reemplazarlo

    const regSub  = document.getElementById('desg-reg-sub');
    const regBtns = document.getElementById('desg-reg-btns');

    function setRegion(r){
      selReg = r;
      regBtns && regBtns.querySelectorAll('.btn').forEach(x=>x.classList.remove('on'));
      const btn = regBtns && regBtns.querySelector(`[data-reg="${r||'__todas__'}"]`);
      if(btn) btn.classList.add('on');
      renderRegTable();
      renderRegChart();
    }

    // ── Botones de filtro ───────────────────────────────────
    if(regBtns){
      const allBtn = document.createElement('button');
      allBtn.className='btn on'; allBtn.textContent='Todas';
      allBtn.dataset.reg='__todas__';
      allBtn.addEventListener('click',()=>setRegion(null));
      regBtns.appendChild(allBtn);

      regiones.forEach((r,i)=>{
        const b=document.createElement('button');
        b.className='btn'; b.textContent=r;
        b.dataset.reg=r;
        b.style.cssText=`font-size:.57rem;border-left:3px solid ${PALETTE_REG[i%PALETTE_REG.length]}`;
        b.addEventListener('click',()=>setRegion(r));
        regBtns.appendChild(b);
      });
    }

    // ── Tabla resumen por región ────────────────────────────
    // Usa misma base: contratos + otros proporcional → calza con tabla desglose
    function renderRegTable(){
      const el=document.getElementById('desg-reg-table');
      if(!el) return;
      const H='background:var(--az3);color:rgba(255,255,255,.85);font-size:.57rem;font-weight:700;text-align:center;padding:.28rem .38rem;white-space:nowrap';
      const Ht='background:#1a3a6b;color:rgba(255,255,255,.85);font-size:.57rem;font-weight:700;text-align:center;padding:.28rem .38rem';
      const thM=meses.map(m=>`<th style="${H}">${m.slice(0,3)}</th>`).join('');
      const list=selReg?[selReg]:regiones;

      const rows=list.map((r,i)=>{
        const rd=regData[r]||{contratos:[],otros:[],total:[]};
        const clr=PALETTE_REG[regiones.indexOf(r)%PALETTE_REG.length];
        const cell=(arr,j,bold,c)=>`<td class="num" style="font-size:.58rem;${bold?'font-weight:700;':''}color:${c||'inherit'}">${fmm(arr[j]||0)}</td>`;
        const rowTot  =Array.from({length:n+1},(_,j)=>cell(rd.total,j,true,clr)).join('');
        const rowCon  =Array.from({length:n+1},(_,j)=>cell(rd.contratos,j,false,'var(--mut)')).join('');
        const rowOtr  =Array.from({length:n+1},(_,j)=>cell(rd.otros,j,false,'var(--mut)')).join('');
        const bg=`${clr}12`;
        return`<tr style="background:${bg}">
          <td rowspan="3" style="font-size:.6rem;font-weight:700;white-space:nowrap;padding:.3rem .55rem .3rem .65rem;
            border-left:3px solid ${clr}">${r}</td>${rowTot}</tr>
          <tr style="background:${bg};font-size:.56rem;color:var(--mut)">
            <td colspan="${n+2}" style="padding:0 .55rem;font-style:italic">Contratos</td></tr>
          <tr style="background:${bg}">${rowCon}</tr>`;
      });

      // Total row calzado con la tabla global
      const totRowCells=Array.from({length:n+1},(_,j)=>{
        const v=list.reduce((s,r)=>s+(regData[r]&&regData[r].total[j]||0),0);
        return`<td class="num" style="font-weight:700;font-size:.59rem">${fmm(v)}</td>`;
      }).join('');

      el.innerHTML=`<div style="overflow-x:auto;overflow-y:auto;max-height:400px">
        <table class="tbl" style="font-size:.6rem;width:100%;min-width:400px;border-collapse:separate;border-spacing:0">
          <thead><tr>
            <th style="${H};text-align:left;min-width:115px;position:sticky;left:0;top:0;z-index:3">Región</th>
            ${thM}
            <th style="${Ht};position:sticky;top:0;z-index:2">TOTAL</th>
          </tr></thead>
          <tbody>${rows.join('')}
            <tr class="desg-azul" style="background:var(--az3)">
              <td style="font-size:.6rem;font-weight:700;color:#fff;padding:.32rem .55rem;position:sticky;left:0;background:var(--az3)">TOTAL</td>
              ${totRowCells}
            </tr>
          </tbody>
        </table></div>`;
    }

    // ── Gráfico por región ──────────────────────────────────
    // Sin región: apilado por región (contratos, misma base)
    // Con región: desglose por línea (mismo que gráfico global pero filtrado)
    function renderRegChart(){
      const ctx2=document.getElementById('cDesgRegion');
      if(!ctx2||!window.Chart) return;
      if(chartReg){chartReg.destroy();chartReg=null;}
      const labels=meses.map(m=>m.slice(0,3));
      let datasets, title;

      if(!selReg){
        datasets=regiones.map((r,i)=>({
          label:r,
          data:(regData[r]||{contratos:[]}).contratos.slice(0,n),
          backgroundColor:PALETTE_REG[i%PALETTE_REG.length],
          stack:'s1',borderRadius:3,
        }));
        title='Ingreso Contratos por Región (MM$)';
        if(regSub) regSub.textContent=regiones.length+' regiones · calza con "Total Ingreso por Contratos"';
      } else {
        const rd=regData[selReg]||{};
        const lineas=rd.lineas||{};
        datasets=[
          {label:'Esterilización',data:(lineas['Esterilización']||[]).slice(0,n),backgroundColor:PALETTE_MAP['Esterilización'],stack:'s1',borderRadius:3},
          {label:'Endoscopía',    data:(lineas['Endoscopía']||[]).slice(0,n),    backgroundColor:PALETTE_MAP['Endoscopía'],    stack:'s1',borderRadius:3},
          {label:'Dental',        data:(lineas['Dental']||[]).slice(0,n),        backgroundColor:PALETTE_MAP['Dental'],        stack:'s1',borderRadius:3},
          {label:'Otros Ingresos',data:(rd.otros||[]).slice(0,n),                backgroundColor:'#C0C0C0',                    stack:'s1',borderRadius:3},
        ];
        title=selReg+' · Contratos por línea + Otros';
        if(regSub) regSub.textContent=selReg+' · Contratos YTD MM$'+fmm((rd.contratos||[])[n]||0)+' · Total MM$'+fmm((rd.total||[])[n]||0);
      }

      chartReg=new Chart(ctx2.getContext('2d'),{
        type:'bar',
        data:{labels,datasets},
        options:{
          responsive:true,maintainAspectRatio:false,
          interaction:{mode:'index',intersect:false},
          plugins:{
            title:{display:true,text:title,font:{size:9},color:'var(--mut)',padding:{bottom:4}},
            legend:{position:'bottom',labels:{boxWidth:10,font:{size:8},padding:6}},
            tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${fN1(c.raw||0)}`}}
          },
          scales:{
            x:{stacked:true,grid:{display:false},ticks:{font:{size:9}}},
            y:{stacked:true,grid:{color:'#E2E6F0'},
               ticks:{font:{size:9},callback:v=>'MM$'+(v||0).toLocaleString('es-CL',{maximumFractionDigits:0})}}
          }
        }
      });
    }

    renderRegTable();
    renderRegChart();
  }

  // ── GRÁFICO APILADO ──────────────────────────────────────────
  const ctx = document.getElementById('cDesglose');
  if(ctx && window.Chart){
    const PALETTE = {
      'Esterilización':'#002D73', 'Endoscopía':'#28D2C3', 'Dental':'#FFC000',
      'Trazabilidad':'#7A1FAA', 'REAS':'#E87722',
      'Reparación Esterilización':'#0A5C8C', 'Reparación Endoscopía':'#00832F', 'Reparación Dental':'#D46000',
    };
    const datasets = [
      ...D.contratos.lineas.map(l=>({label:l.label, data:l.valores.slice(0,n), backgroundColor:PALETTE[l.label]||'#999', stack:'s1'})),
      ...D.otros.categorias.map(c=>({label:c.label, data:c.valores.slice(0,n), backgroundColor:PALETTE[c.label]||'#999', stack:'s1'})),
    ];
    new Chart(ctx.getContext('2d'),{
      type:'bar',
      data:{ labels: meses.map(m=>m.slice(0,3)), datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{
          legend:{position:'bottom',labels:{boxWidth:10,font:{size:8},padding:8}},
          tooltip:{callbacks:{label:c=>` ${c.dataset.label}: MM$${fN1(c.raw||0)}`}}
        },
        scales:{
          x:{stacked:true,grid:{display:false},ticks:{font:{size:9}}},
          y:{stacked:true,grid:{color:'#E2E6F0'},
             ticks:{font:{size:9},callback:v=>'MM$'+(v||0).toLocaleString('es-CL',{maximumFractionDigits:0})}}
        }
      }
    });
  }
})();
