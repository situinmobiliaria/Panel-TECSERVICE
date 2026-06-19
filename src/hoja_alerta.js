// ═══════════════════════════════════════════════════════════════
// hoja_alerta.js — Clientes con facturación bajo contrato
// Depende de: datos.js (ALERTA_DATA, MES_CORTE), utils.js
// ═══════════════════════════════════════════════════════════════

let _altCoordF='todas', _altSrch='';

function initAlertas(){
  const data=window.ALERTA_DATA||[];

  // Botones coordinador
  const coords=[...new Set(data.map(c=>c.coord).filter(Boolean))].sort();
  const filtDiv=document.getElementById('alt-filt-coord');
  if(filtDiv){
    coords.forEach(coord=>{
      const b=document.createElement('button');
      b.className='btn';b.dataset.altc=coord;
      b.textContent=coord.split(' ')[0];
      b.addEventListener('click',()=>{
        filtDiv.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');_altCoordF=coord;renderAlertas();
      });
      filtDiv.appendChild(b);
    });
  }
  const srch=document.getElementById('alt-srch');
  if(srch)srch.addEventListener('input',e=>{_altSrch=e.target.value.toLowerCase();renderAlertas();});

  renderAlertas();
}

function renderAlertas(){
  const tbody=document.getElementById('alt-tbody');
  if(!tbody)return;
  const data=window.ALERTA_DATA||[];

  // Aplanar: una fila por contrato
  let rows=[];
  data.forEach(cli=>{
    cli.contratos.forEach(c=>{
      rows.push({...c,cliente:cli.cliente,coord:cli.coord});
    });
  });

  // Filtros
  if(_altCoordF!=='todas') rows=rows.filter(r=>r.coord===_altCoordF);
  if(_altSrch) rows=rows.filter(r=>
    r.cliente.toLowerCase().includes(_altSrch)||
    r.coord.toLowerCase().includes(_altSrch)||
    String(r.n).toLowerCase().includes(_altSrch)
  );

  // Badge
  const badge=document.getElementById('alerta-badge');
  if(badge){
    const nCli=new Set(rows.map(r=>r.cliente)).size;
    badge.textContent=nCli+' clientes · '+rows.length+' contratos';
  }

  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const SZ=17; // tamaño círculo px

  if(!rows.length){
    tbody.innerHTML='<tr><td colspan="12" style="text-align:center;padding:2rem;color:var(--mut)">Sin registros para los filtros seleccionados</td></tr>';
    return;
  }

  tbody.innerHTML=rows.map(r=>{
    // Círculos mensuales
    const flags=r.fact_flags.map((f,i)=>{
      const isPast=i<MES_CORTE;
      if(f){
        const bg=isPast?'var(--teal)':'rgba(40,210,195,.4)';
        return`<span title="${MESES[i]}" style="display:inline-block;width:${SZ}px;height:${SZ}px;border-radius:50%;background:${bg};margin:0 2px;vertical-align:middle"></span>`;
      }
      const border=isPast?'rgba(184,193,216,.8)':'rgba(184,193,216,.4)';
      return`<span title="${MESES[i]}" style="display:inline-block;width:${SZ}px;height:${SZ}px;border-radius:50%;border:2px solid ${border};margin:0 2px;vertical-align:middle;box-sizing:border-box"></span>`;
    }).join('');

    const gap=r.gap;
    const gapColor=gap>0?'var(--rd)':gap<0?'var(--teal)':'var(--mut)';
    const gapTxt=gap===0?'—':(gap>0?'−':'+')+'MM$'+(Math.abs(gap)/1e6).toFixed(1);
    const cuotaTxt=r.cuota_uf>0?r.cuota_uf.toFixed(2)+' UF':'—';

    return`<tr>
      <td style="font-size:.6rem;color:var(--mut);white-space:nowrap">${r.coord.split(' ')[0]}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.cliente}"><strong>${r.cliente}</strong></td>
      <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--az2);white-space:nowrap">${r.n}</td>
      <td style="font-size:.6rem;white-space:nowrap;color:var(--mut)">${r.inicio_fmt}</td>
      <td style="font-size:.6rem;white-space:nowrap;color:var(--mut)">${r.fin_fmt}</td>
      <td style="white-space:nowrap;padding:.3rem .5rem;text-align:center">${flags}</td>
      <td class="num" style="font-size:.68rem;font-weight:700;color:var(--az2)">${r.n_mant_fecha||0}</td>
      <td class="num" style="font-size:.62rem">${cuotaTxt}</td>
      <td class="num">${mm(r.neta_mes)}</td>
      <td class="num" style="color:var(--az2)">${mm(r.expected_ytd)}</td>
      <td class="num" style="color:var(--teal)">${mm(r.real_ytd)}</td>
      <td class="num" style="color:${gapColor};font-weight:800">${gapTxt}</td>
    </tr>`;
  }).join('');
}
