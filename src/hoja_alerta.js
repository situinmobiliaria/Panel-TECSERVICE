// ═══════════════════════════════════════════════════════════════
// hoja_alerta.js — Clientes con facturación bajo contrato
// Fuente: col AK de CONTRATOS TODOS (SI/NO)
// Estructura: filas por contrato + fila subtotal por cliente
// ═══════════════════════════════════════════════════════════════

let _altCoordF='todas', _altSrch='';

function initAlertas(){
  const data=window.ALERTA_DATA||[];
  const coords=[...new Set(data.map(c=>c.coord).filter(Boolean))].sort();
  const filtDiv=document.getElementById('alt-filt-coord');
  if(filtDiv){
    const bAll=document.createElement('button');
    bAll.className='btn on';bAll.textContent='Todos';
    bAll.addEventListener('click',()=>{
      filtDiv.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
      bAll.classList.add('on');_altCoordF='todas';renderAlertas();
    });
    filtDiv.appendChild(bAll);
    coords.forEach(coord=>{
      const b=document.createElement('button');
      b.className='btn';b.textContent=coord.split(' ')[0];
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
  let data=window.ALERTA_DATA||[];

  // Filtros a nivel cliente: si el cliente califica, aparecen TODOS sus contratos
  if(_altCoordF!=='todas') data=data.filter(cli=>cli.coord===_altCoordF);
  if(_altSrch) data=data.filter(cli=>
    cli.cliente.toLowerCase().includes(_altSrch)||
    cli.coord.toLowerCase().includes(_altSrch)||
    cli.contratos.some(c=>String(c.n).toLowerCase().includes(_altSrch))
  );

  const badge=document.getElementById('alerta-badge');
  if(badge){
    const nContr=data.reduce((s,cli)=>s+cli.contratos.length,0);
    badge.textContent=data.length+' clientes · '+nContr+' contratos';
  }

  const MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const SZ=17;

  if(!data.length){
    tbody.innerHTML='<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--mut)">Sin registros para los filtros seleccionados</td></tr>';
    return;
  }

  const html=[];
  data.forEach(cli=>{
    const nc=cli.contratos.length;

    cli.contratos.forEach((c,idx)=>{
      const isFirst=idx===0;
      const sepStyle=isFirst&&html.length?'border-top:2px solid rgba(51,68,141,.35)':'';

      const flags=c.fact_flags.map((f,i)=>{
        const isPast=i<MES_CORTE;
        if(f){
          const bg=isPast?'var(--teal)':'rgba(40,210,195,.4)';
          return`<span title="${MESES[i]}" style="display:inline-block;width:${SZ}px;height:${SZ}px;border-radius:50%;background:${bg};margin:0 2px;vertical-align:middle"></span>`;
        }
        const border=isPast?'rgba(184,193,216,.8)':'rgba(184,193,216,.4)';
        return`<span title="${MESES[i]}" style="display:inline-block;width:${SZ}px;height:${SZ}px;border-radius:50%;border:2px solid ${border};margin:0 2px;vertical-align:middle;box-sizing:border-box"></span>`;
      }).join('');

      const cuotaEsCLP=c.cuota_uf>0&&Math.abs(c.cuota_uf-c.neta_mes)<=1;
      const sinCuotaUF=c.cuota_uf===0||cuotaEsCLP;
      const cuotaTxt=c.cuota_uf>0&&!cuotaEsCLP?c.cuota_uf.toFixed(2)+' UF':'—';
      const cuotaTitle=sinCuotaUF?'title="La cuota de este contrato está expresada en CLP, no en UF"':'';

      // Coord y Cliente con rowspan sobre los contratos + la fila subtotal
      const coordCell=isFirst
        ?`<td style="font-size:.6rem;color:var(--mut);white-space:nowrap;vertical-align:middle;${sepStyle}" rowspan="${nc+1}">${cli.coord.split(' ')[0]}</td>`:'';
      const cliCell=isFirst
        ?`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;${sepStyle}" title="${cli.cliente}" rowspan="${nc+1}"><strong>${cli.cliente}</strong></td>`:'';

      html.push(`<tr>
        ${coordCell}${cliCell}
        <td style="font-family:'Roboto Mono',monospace;font-size:.6rem;color:var(--az2);white-space:nowrap;${sepStyle}">${c.n}</td>
        <td style="font-size:.6rem;white-space:nowrap;color:var(--mut);${sepStyle}">${c.inicio_fmt}</td>
        <td style="font-size:.6rem;white-space:nowrap;color:var(--mut);${sepStyle}">${c.fin_fmt}</td>
        <td style="white-space:nowrap;padding:.3rem .5rem;text-align:center;${sepStyle}">${flags}</td>
        <td style="text-align:center;font-size:.68rem;font-weight:700;color:var(--az2);${sepStyle}">${c.n_mant_fecha||0}</td>
        <td class="num" style="font-size:.62rem;color:${cuotaEsCLP?'var(--mut)':'inherit'};${sepStyle}" ${cuotaTitle}>${cuotaTxt}</td>
        <td class="num" style="${sepStyle}">${mm(c.neta_mes)}</td>
        <td class="num" style="color:var(--az2);${sepStyle}">${mm(c.expected_ytd)}</td>
        <td style="${sepStyle}"></td>
        <td style="${sepStyle}"></td>
      </tr>`);
    });

    // Fila subtotal del cliente
    const dif=cli.total_gap;   // Esperado − Real (positivo = déficit)
    const difColor=dif>0?'var(--rd)':dif<0?'var(--teal)':'var(--mut)';
    const difTxt=dif===0?'—':(dif>0?'−':'+')+'MM$'+(Math.abs(dif)/1e6).toFixed(1);
    const subBg='background:rgba(14,45,85,.55)';

    html.push(`<tr style="${subBg}">
      <td colspan="7" style="text-align:right;font-size:.6rem;color:rgba(255,255,255,.5);padding:.3rem .6rem;font-style:italic">
        Subtotal ${cli.cliente.split(' ').slice(0,2).join(' ')} · ${nc} contrato${nc>1?'s':''}
      </td>
      <td class="num" style="color:rgba(184,193,216,.9)">${mm(cli.total_expected)}</td>
      <td class="num" style="color:var(--teal);font-weight:700">${mm(cli.total_real)}</td>
      <td class="num" style="color:${difColor};font-weight:800">${difTxt}</td>
    </tr>`);
  });

  tbody.innerHTML=html.join('');

  // ── Fila total general (dinámica según filtros) ──────────────
  const tfoot=document.getElementById('alt-tfoot');
  if(tfoot){
    const totNeta    = data.reduce((s,cli)=>s+cli.contratos.reduce((sc,c)=>sc+c.neta_mes,0),0);
    const totEsp     = data.reduce((s,cli)=>s+cli.total_expected,0);
    const totReal    = data.reduce((s,cli)=>s+cli.total_real,0);
    const totDif     = totEsp - totReal;   // Esperado − Real
    const difColor   = totDif>0?'var(--rd)':totDif<0?'var(--teal)':'var(--mut)';
    const difTxt     = totDif===0?'—':(totDif>0?'−':'+')+'MM$'+(Math.abs(totDif)/1e6).toFixed(1);
    const nContr     = data.reduce((s,cli)=>s+cli.contratos.length,0);
    tfoot.innerHTML=`<tr style="background:var(--az3);font-weight:700">
      <td colspan="9" style="padding:.4rem .7rem;font-size:.62rem;color:rgba(255,255,255,.7)">
        Total · ${data.length} cliente${data.length!==1?'s':''} · ${nContr} contrato${nContr!==1?'s':''}
      </td>
      <td class="num" style="color:rgba(255,255,255,.9)">${mm(totEsp)}</td>
      <td class="num" style="color:var(--teal)">${mm(totReal)}</td>
      <td class="num" style="color:${difColor}">${difTxt}</td>
    </tr>`;
  }
}
