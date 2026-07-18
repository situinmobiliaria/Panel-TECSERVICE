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

  // ── GRÁFICO APILADO ──────────────────────────────────────────
  const ctx = document.getElementById('cDesglose');
  if(ctx && window.Chart){
    const PALETTE = {
      'Esterilización':'#002D73', 'Endoscopía':'#28D2C3', 'Dental':'#FFC000',
      'Trazabilidad':'#7A1FAA', 'REAS':'#E87722',
      'TECSERVICE':'#0A5C8C', 'Nacional':'#6B3A2A', 'ICTGroup':'#C05000',
      'Steelco':'#00832F', 'Pentax Medical':'#D46000', 'Otras Marcas':'#B8C1D8',
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
