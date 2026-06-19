// ═══════════════════════════════════════════════════════════════
// hoja_alerta.js — Clientes con facturación bajo contrato
// Depende de: datos.js (ALERTA_DATA, MES_CORTE), utils.js
// ═══════════════════════════════════════════════════════════════

function initAlertas(){ renderAlertas(); }

function renderAlertas(){
  const el=document.getElementById('alerta-container');
  if(!el)return;
  const data=window.ALERTA_DATA||[];

  const badge=document.getElementById('alerta-badge');
  if(badge)badge.textContent=data.length+' clientes';

  if(!data.length){
    el.innerHTML='<div class="card" style="text-align:center;padding:2.5rem;color:var(--mut);font-size:.8rem">Sin alertas — todos los clientes al día con su contrato ✓</div>';
    return;
  }

  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  el.innerHTML=data.map(cli=>{
    const rows=cli.contratos.map(c=>{
      // Flags mensuales: ● pasado esperado | ○ futuro esperado | · no esperado
      const flagsHtml=c.fact_flags.map((f,i)=>{
        if(!f)return`<span style="color:var(--mut);font-size:.55rem;display:inline-block;width:1.15rem;text-align:center" title="${MESES[i]}">·</span>`;
        if(i<MES_CORTE)return`<span style="color:var(--teal);font-size:.7rem;display:inline-block;width:1.15rem;text-align:center;font-weight:700" title="${MESES[i]} (pasado)">●</span>`;
        return`<span style="color:rgba(40,210,195,.4);font-size:.7rem;display:inline-block;width:1.15rem;text-align:center" title="${MESES[i]} (futuro)">○</span>`;
      }).join('');

      const gap=c.gap;
      const gapColor=gap>0?'var(--rd)':gap<0?'var(--teal)':'var(--mut)';
      const gapTxt=gap===0?'—':(gap>0?'−':'+')+'MM$'+(Math.abs(gap)/1e6).toFixed(1);

      return`<tr>
        <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--az2)">${c.n}</td>
        <td style="font-size:.6rem;color:var(--mut);white-space:nowrap">${c.inicio_fmt}</td>
        <td style="font-size:.6rem;color:var(--mut);white-space:nowrap">${c.fin_fmt}</td>
        <td style="white-space:nowrap;padding:.25rem .4rem">${flagsHtml}</td>
        <td class="num" style="font-size:.62rem">${c.cuota_uf>0?c.cuota_uf.toFixed(2)+' UF':'—'}</td>
        <td class="num">${mm(c.neta_mes)}</td>
        <td class="num" style="font-size:.62rem">${c.n_mant||'—'}</td>
        <td class="num" style="color:var(--az2)">${mm(c.expected_ytd)}</td>
        <td class="num" style="color:var(--teal)">${mm(c.real_ytd)}</td>
        <td class="num" style="color:${gapColor};font-weight:700">${gapTxt}</td>
      </tr>`;
    }).join('');

    const tg=cli.total_gap;
    const tgColor=tg>0?'var(--rd)':'var(--teal)';
    const tgTxt=(tg>0?'−':'+')+'MM$'+(Math.abs(tg)/1e6).toFixed(1);
    const pct=cli.total_expected>0?Math.min(cli.total_real/cli.total_expected*100,100):0;
    const barColor=pct>=90?'var(--teal)':pct>=70?'var(--am)':'var(--rd)';

    return`<div class="card" style="margin-bottom:.8rem">
      <div class="ch" style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;flex-wrap:wrap">
        <div>
          <span class="ct">${cli.cliente}</span>
          <span style="font-size:.6rem;color:var(--mut);margin-left:.4rem">${cli.coord}</span>
        </div>
        <div style="display:flex;gap:.8rem;align-items:center;flex-wrap:wrap">
          <span style="font-size:.62rem;color:var(--mut)">Esperado YTD: <strong style="color:var(--az2)">${mm(cli.total_expected)}</strong></span>
          <span style="font-size:.62rem;color:var(--mut)">Real YTD: <strong style="color:var(--teal)">${mm(cli.total_real)}</strong></span>
          <span style="font-size:.7rem;font-weight:800;color:${tgColor}">${tgTxt}</span>
          <div style="display:flex;align-items:center;gap:.3rem">
            <div style="width:80px;height:6px;background:rgba(184,193,216,.3);border-radius:3px;overflow:hidden">
              <div style="width:${pct.toFixed(1)}%;height:100%;background:${barColor};border-radius:3px"></div>
            </div>
            <span style="font-size:.58rem;color:${barColor};font-weight:700">${pct.toFixed(0)}%</span>
          </div>
        </div>
      </div>
      <div style="overflow-x:auto;margin-top:.3rem">
        <table class="tbl" style="font-size:.62rem;width:100%">
          <thead><tr>
            <th>N° Contrato</th>
            <th>Inicio</th>
            <th>Término</th>
            <th style="text-align:center">Ene  Feb  Mar  Abr  May  Jun  Jul  Ago  Sep  Oct  Nov  Dic</th>
            <th>Cuota UF</th>
            <th>Neta Mes</th>
            <th>N° Mant</th>
            <th>Esperado</th>
            <th>Real</th>
            <th>Diferencia</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}
