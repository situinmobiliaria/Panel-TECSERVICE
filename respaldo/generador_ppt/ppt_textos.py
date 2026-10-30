"""
ppt_textos.py — Actualiza las cifras de los bullets del deck ejecutivo sin tocar la
redacción.

Cada bullet automático se reconoce con una expresión regular cuyos grupos con nombre
son lo único que se reemplaza: cifras, nombres de un ranking y las palabras que
dependen del signo («superando» / «bajo»). Todo lo demás —la redacción del usuario—
queda exactamente como estaba, incluso si la retocó a mano.

Grupos cuyo nombre empieza con «m_» son comentario manual: no se recalculan y se
dejan resaltados. Un párrafo de una caja con reglas que no calza con ninguna también
se resalta, salvo que esté en la lista de textos fijos de la slide.
"""
from __future__ import annotations
import math, re, unicodedata
from collections import defaultdict
from datetime import date

# ── Formatos ────────────────────────────────────────────────────────────────
MMR = r'-?MM\$-?[\d.]+(?:,\d+)?'                 # MM$1.923,4 · -MM$136,1
PCT = r'[+-]?[\d.]+(?:,\d+)?\s?%'                # 88,2% · +3,2%
NUM = r'[\d.]+(?:,\d+)?'                          # 12.557 · 6,8
NOM = r'[^():;]+?'                                # nombre en un ranking

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre']
MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']


def _miles(entero: str) -> str:
    return re.sub(r'(\d)(?=(\d{3})+$)', r'\1.', entero)


def nfmt(v, dec=0) -> str:
    """12557 → '12.557' · 6.8 → '6,8'."""
    s = f'{abs(v):.{dec}f}'
    ent, _, fr = s.partition('.')
    out = _miles(ent) + (',' + fr if fr else '')
    return ('-' if v < 0 and float(s) != 0 else '') + out


def MM(v, dec=1) -> str:
    """Millones → 'MM$1.923,4'; negativo → '-MM$136,1'."""
    s = 'MM$' + nfmt(abs(v), dec)
    return '-' + s if v < 0 and round(abs(v), dec) != 0 else s


def P(v, dec=1, signo=False) -> str:
    """Porcentaje ya multiplicado por 100 → '88,2%'."""
    if dec == 0:
        v = round(v)
    s = nfmt(v, dec)
    if signo and v > 0:
        s = '+' + s
    return s + '%'


def num(s) -> float:
    """'MM$1.923,4' · 'MM$−23,0' · '$8.438.613' · '89,5%' · '12.557' → número."""
    if s is None:
        return 0.0
    t = str(s).replace('−', '-').replace('−', '-')
    neg = '-' in t.split('MM$')[0] or t.strip().startswith('-') or 'MM$-' in t
    t = re.sub(r'[^\d,.]', '', t)
    if not t or t in {',', '.'}:
        return 0.0
    t = t.replace('.', '').replace(',', '.')
    v = float(t)
    return -v if neg else v


def _norm(s) -> str:
    s = ''.join(c for c in unicodedata.normalize('NFD', str(s).upper()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', re.sub(r'[^A-Z0-9 ]', ' ', s)).strip()


_VACIAS = {'DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y', 'E', 'EN', 'S', 'A', 'SA', 'SPA', 'LTDA', 'I'}


def _toks(s):
    return {t for t in _norm(s).split() if t not in _VACIAS and len(t) > 1}


def mismo_cliente(a, b) -> float:
    """Parecido entre dos nombres: 0 si no son el mismo cliente. Lo son si las palabras
    del nombre corto están todas en el largo («Clínica Indisa» ⊂ «Instituto de
    Diagnóstico S.A. / Clínica Indisa»); así «Andes Salud Chillán» no se confunde con
    «Andes Salud Puerto Montt»."""
    ta, tb = _toks(a), _toks(b)
    if not ta or not tb:
        return 0.0
    corto, largo = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    return len(corto) / len(largo) if corto <= largo else 0.0


_MINUS = {'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'para', 'por'}
_SIGLAS = {'S.A.', 'S.A', 'SPA', 'LTDA', 'LTDA.', 'UC', 'II', 'III', 'IV', 'BI', 'RM', 'ST', 'HP', 'ISM', 'HUAP',
           'FACH', 'MMQ', 'REAS', 'DDC'}


def bonito(nombre: str) -> str:
    """Nombre del Excel en mayúsculas → como se escribe en una frase."""
    out = []
    for i, w in enumerate(str(nombre).split()):
        u = w.upper()
        if u in _SIGLAS:
            out.append({'SPA': 'SpA', 'LTDA': 'Ltda.', 'LTDA.': 'Ltda.'}.get(u, u))
        elif i and w.lower() in _MINUS:
            out.append(w.lower())
        elif u in {'DR', 'DR.'}:
            out.append('Dr.')
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return ' '.join(out)


def nombre_para(raw: str, previos: list[str]) -> str:
    """Si el cliente ya estaba escrito en el deck, se respeta cómo lo escribió el usuario."""
    mejor = max(previos, key=lambda p: mismo_cliente(raw, p), default=None)
    return mejor if mejor and mismo_cliente(raw, mejor) > 0 else bonito(raw)


def rk(H, lista, iv=1, inom=0):
    """Ranking por valor descendente; en un empate van primero los que ya estaban
    escritos en la slide, para no cambiar un nombre por otro con la misma cifra."""
    prev = H.get('_previos') or []
    def pos(x):
        return next((k for k, p in enumerate(prev) if mismo_cliente(x[inom], p)), len(prev))
    return sorted(lista, key=lambda x: (-x[iv], pos(x)))


# ── Lectura de las tablas capturadas ────────────────────────────────────────
def _tabla(datos, clave, id_, i=0):
    try:
        return datos['tablas'][clave][id_]['tablas'][i]
    except (KeyError, IndexError, TypeError):
        return []


def _texto(datos, clave, id_):
    try:
        return datos['tablas'][clave][id_]['texto']
    except (KeyError, TypeError):
        return ''


def _fila(tab, prefijo, exacto=False, min_celdas=2):
    p = _norm(prefijo)
    for r in tab:
        if not r or len(r) < min_celdas:
            continue                                     # separadores de sección
        k = _norm(r[0].lstrip('▸▶▾ '))
        if (k == p) if exacto else k.startswith(p):
            return r
    return None


def _cuerpo(tab):
    """Filas de datos: sin la cabecera y sin la fila TOTAL."""
    return [r for r in tab[1:] if r and len(r) > 2 and not _norm(r[0]).startswith('TOTAL')]


# ── Hechos: las cifras que usan los bullets ────────────────────────────────
def hechos(datos: dict) -> dict:
    A = datos.get('APP_DATA') or {}
    H = {'hoy': A.get('hoy'), 'mes_corte': A.get('mes_corte')}
    hoy = date.fromisoformat(A['hoy']) if A.get('hoy') else date.today()
    H['mes_nombre'] = MESES[hoy.month - 1]
    H['semana_mes'] = math.ceil(hoy.day / 7)
    for f in (_h_facturacion, _h_garantias, _h_brechas, _h_stock, _h_eerr, _h_casos,
              _h_composicion, _h_vencimientos, _h_bi):
        try:
            H.update(f(datos))
        except Exception as e:                                   # un bloque roto no tumba el resto
            H.setdefault('_errores', {})[f.__name__] = repr(e)[:200]
    return H


def _h_facturacion(d):
    t = _tabla(d, 'analisis_fac', 'rs-anal-card'); s = _tabla(d, 'analisis_fac', 'rs-sem-card')
    T, ST, TZ = _fila(t, 'Ingresos Totales'), _fila(t, 'Servicio Técnico'), _fila(t, 'Trazabilidad')
    sST, sTZ = _fila(s, 'Servicio Técnico'), _fila(s, 'Trazabilidad')
    f = dict(fac_tot=num(T[1]), fac_st=num(ST[1]), fac_tz=num(TZ[1]), fac_aa=num(T[7]))
    f['fac_var_aa'] = f['fac_tot'] - f['fac_aa']
    # Avance del mes contra el presupuesto del mes (acumulado mes / ppto. mes).
    av = lambda r: (num(r[7]) / num(r[8]) * 100) if num(r[8]) else 0.0
    f['tz_avance_mes'] = av(sTZ); f['st_avance_mes'] = av(sST)
    return {'fac': f}


def _h_garantias(d):
    t = _tabla(d, 'garantias', 'vg-gar-tabla')
    filas = _cuerpo(t); tot = _fila(t, 'TOTAL')
    montos = sorted((num(r[4]) for r in filas), reverse=True)
    anios = [int(r[8][-4:]) for r in filas if re.match(r'\d\d/\d\d/\d{4}', r[8] or '')]
    g = dict(monto=num(tot[1]), costo=num(tot[2]), rem=num(tot[3]),
             n=int(re.search(r'(\d+)', tot[0]).group(1)), top10=sum(montos[:10]), fin_max=max(anios))
    l = _tabla(d, 'garantias_lin', 'vg-garl-tabla')
    E, D, TT = _fila(l, 'Esterilización'), _fila(l, 'Dental'), _fila(l, 'TOTAL')
    for k, r in (('E', E), ('D', D), ('T', TT)):
        g[k] = dict(n=int(num(r[1])), costo=num(r[2]), rem=num(r[3]), suma=num(r[4]),
                    dias=int(num(r[5])), cons=num(r[6]))
    return {'gar': g}


def _h_brechas(d):
    A = d['APP_DATA']
    O = A.get('br_oport') or {}; C = A.get('br_contrato') or {}
    top = (O.get('por_cliente') or [])[:2]
    alerta = sorted(d.get('ALERTA_DATA') or [], key=lambda a: -a.get('total_gap', 0))
    return {'br': dict(op_total=O.get('total', 0) / 1e6,
                       op_top=[(c['k'], c['monto'] / 1e6, c['monto'] / O['total'] * 100) for c in top],
                       ct_n=C.get('n_clientes', 0), ct_esp=C.get('esperado', 0) / 1e6,
                       ct_real=C.get('real', 0) / 1e6, ct_gap=C.get('total', 0) / 1e6,
                       ct_top=[(a['cliente'], a['total_expected'] / 1e6, a['total_real'] / 1e6) for a in alerta[:5]])}


def _h_stock(d):
    """Brecha sin stock: totales, ranking de clientes y cobertura valorizada por stock
    en bodega y back order, repartiendo el stock de cada SKU entre los clientes que lo
    esperan de mayor a menor monto (el mismo cálculo de la versión del 23-10)."""
    A = d['APP_DATA']; B = A['br_stock']
    stock, conocidos = defaultdict(float), set()
    for m in (A.get('inv_ts') or {}).get('data', {}).values():
        for it in m.get('items', []):
            stock[it['sku']] += it['st']; conocidos.add(it['sku'])
    bo = dict(A.get('back_order') or {})
    pares = defaultdict(lambda: [0.0, 0.0])
    sku_cli = defaultdict(set)
    for it in B['items']:
        p = pares[(it['cliente'], it['cod'])]; p[0] += it['cant']; p[1] += it['monto']
        sku_cli[it['cliente']].add(it['cod'])
    tot = sum(p[1] for p in pares.values()) or 1
    cs = cb = resto = 0.0; n_resto = 0; sin_maestro = 0
    st, b = dict(stock), dict(bo)
    for (c, sku), (q, m) in sorted(pares.items(), key=lambda x: -x[1][1]):
        a = min(q, st.get(sku, 0)); st[sku] = st.get(sku, 0) - a
        bb = min(q - a, b.get(sku, 0)); b[sku] = b.get(sku, 0) - bb
        cs += m * a / q if q else 0; cb += m * bb / q if q else 0
        r = q - a - bb
        if r > 1e-9:
            n_resto += 1; resto += m * r / q
        if sku not in conocidos:
            sin_maestro += 1
    rot = {x['k']: x for x in B.get('por_rotacion', [])}
    pc = lambda k: (rot.get(k) or {}).get('pct_monto', 0.0)
    clientes = B.get('por_cliente', [])
    return {'stk': dict(total=B['total'] / 1e6, n_sku_lineas=B['n'], n_cli=B['n_clientes'],
                        n_sku=len({k[1] for k in pares}), n_pares=len(pares),
                        top=[(c['k'], c['monto'] / tot * 100, len(sku_cli[c['k']]), c['monto'] / 1e6)
                             for c in clientes[:10]],
                        top3=sum(c['monto'] for c in clientes[:3]) / 1e6,
                        top10=sum(c['monto'] for c in clientes[:10]) / 1e6,
                        cob_stock=cs / tot * 100, cob_bo=cb / tot * 100,
                        resto=resto / 1e6, n_resto=n_resto, sin_maestro=sin_maestro,
                        rot_baja=pc('Baja Rotacion'), rot_media=pc('Mediana Rotacion'),
                        rot_alta=pc('Alta Rotacion'), rot_sin=pc('Sin Rotacion'))}


def _h_eerr(d):
    """Acumulado del año (columna TOTAL) de cada concepto del EERR y del EERR Limpio,
    y el último mes cargado, que es el «Cierre» del título."""
    out = {}
    for clave, id_, k in (('eerr_res', 'eerr-table', 'eerr'), ('eerr_lim_res', 'eerr-limpio-table', 'eerr_l')):
        t = _tabla(d, clave, id_)
        meses = [c for c in t[0][1:] if c != 'TOTAL']
        def tot(pref):
            r = _fila(t, pref, min_celdas=5)
            return (num(r[-4]), num(r[-3]), num(r[-2]), num(r[-1])) if r else (0.0,) * 4  # real, ppto, var, var%
        e = dict(ult_mes=meses[-1] if meses else '', n_meses=len(meses))
        e['ing'] = tot('Ingresos de actividades ordinarias')
        e['ebd'] = tot('= EBITDA Directo')
        e['ebi'] = tot('= EBITDA Indirecto')
        e['ebe'] = tot('= EBITDA Empresa')
        e['res'] = tot('= Resultado del ejercicio')
        e['nop'] = tot('= Resultado no operacional')
        out[k] = e
    return out


def _h_casos(d):
    m = _tabla(d, 'casos_marca', 'cas-marca-tabla')
    tm = _fila(m, 'TOTAL')
    marcas = _cuerpo(m)
    c = _tabla(d, 'casos_cliente', 'cas-cli-tabla')
    clis = _cuerpo(c)
    sin = next((r for r in clis if 'SIN CLIENTE' in _norm(r[0])), None)
    con = [r for r in clis if r is not sin]
    tc = _fila(c, 'TOTAL')
    eq = _tabla(d, 'casos_equipo', 'cas-eq-tabla')
    equipos = sorted(_cuerpo(eq), key=lambda r: -num(r[2]))
    flujo = _texto(d, 'casos_flujo', 'cas-flujo')
    etapas = _etapas_flujo(flujo)
    tot_eq = int(num(tm[1]))
    return {'cas': dict(n_eq=tot_eq, n_cli=int(num(tc[0].split('·')[-1])) if tc else 0,
                        n_marcas=int(re.search(r'(\d+)', tm[0]).group(1)), val=num(tm[7]),
                        marcas=[(r[0], int(num(r[1])), num(r[7]), num(r[8])) for r in marcas],
                        equipos=[(f'{r[0].lstrip("▶▸ ")} {r[1]}', int(num(r[2]))) for r in equipos],
                        clientes=[(r[0], int(num(r[1])), num(r[3]), num(r[4])) for r in con],
                        sin_eq=int(num(sin[1])) if sin else 0, sin_val=num(sin[3]) if sin else 0,
                        fact=num(tc[4]) if tc else 0, contrato=num(tc[6]) if tc else 0,
                        etapas=etapas)}


def _etapas_flujo(txt):
    """Equipos y valorizado de cada etapa del flujo de equipos detenidos."""
    nombres = ['En Diagnóstico', 'Espera de Diagnóstico', 'Espera OC', 'Espera Repuestos', 'En Reparación', 'Otros']
    partes = txt.split('N° Equipos')[1:]
    out = []
    for nom, p in zip(nombres, partes):
        n = re.search(r'(\d+)', p); v = re.search(r'Valorizado total\s*\|?\s*(MM\$[\d.,]+)', p)
        out.append((nom, int(n.group(1)) if n else 0, num(v.group(1)) if v else 0.0))
    return out


def _h_composicion(d):
    t = _tabla(d, 'fac_tipo_cli', 'pf-comp-tabla')
    g = lambda p, i: num((_fila(t, p) or [0, 0, 0, 0, 0])[i])
    tt = _fila(t, 'TOTAL', exacto=True) or [0, 0, 0, 0, 0]
    return {'cmp': dict(tot=num(tt[2]), tc=g('Total Contratos', 2), tc_p=g('Total Contratos', 3),
                        tm=g('Total Mantenciones', 2), tm_p=g('Total Mantenciones', 3),
                        cc=g('Con Contrato', 2), cc_p=g('Con Contrato', 3),
                        sc=g('Sin Contrato', 2), sc_p=g('Sin Contrato', 3),
                        ca=g('Contratos Activos', 2), spot_c=g('Facturación Spot Clientes con', 2),
                        spot_s=g('Facturación Spot Clientes sin', 2), cv=g('Contratos Vencidos', 2),
                        nue=g('Nuevos', 2), nue_p=g('Nuevos', 3),
                        perd_n=int(g('Perdidos', 1)), perd_25=g('Perdidos', 4))}


def _h_vencimientos(d):
    from datetime import datetime
    D = d.get('DATA') or []
    hz = [x for x in D if x.get('dias_vence', 9999) <= 90]
    venc = [x for x in hz if x['dias_vence'] < 0]
    hoy = date.fromisoformat(d['APP_DATA']['hoy'])
    def mes_fin(x):
        try:
            return datetime.strptime(x['fin_fmt'], '%d/%m/%Y').date()
        except Exception:
            return None
    este_mes = [x for x in hz if x['dias_vence'] >= 0 and (mes_fin(x) or hoy).month == hoy.month
                and (mes_fin(x) or hoy).year == hoy.year]
    com = [x for x in hz if x.get('tipo') != 'Garantia']; gar = [x for x in hz if x.get('tipo') == 'Garantia']
    s = lambda L: sum(x.get('val', 0) for x in L) / 1e6
    return {'vto': dict(n=len(hz), n_cli=len({x['cliente'] for x in hz}), monto=s(hz),
                        n_venc=len(venc), m_venc=s(venc), mes=MESES[hoy.month - 1].capitalize(),
                        n_mes=len(este_mes), m_mes=s(este_mes),
                        n_com=len(com), m_com=s(com), n_gar=len(gar), m_gar=s(gar))}


def _h_bi(d):
    k = _texto(d, 'bi_kpi', 'pb-kpi')
    parte = [x.strip() for x in k.split('\n') if x.strip()]
    def tras(lbl, i=1):
        j = next(n for n, x in enumerate(parte) if x.lower().startswith(lbl.lower()))
        return parte[j + i]
    h = _tabla(d, 'bi_heat_linea', 'pb-heat')
    anios = h[0][1:-1]                                      # 'Vencida', '2026'…
    def celda(c):
        m = re.match(r'([\d.]+)\s*\(MM\$([\d.,]+)\)', c or '')
        return (int(num(m.group(1))), num(m.group(2))) if m else (0, 0.0)
    tot = {a: celda(c) for a, c in zip(anios, _fila(h, 'TOTAL')[1:-1])}
    lin = {r[0]: celda(r[-1]) for r in h[1:] if r and r[0] != 'TOTAL'}
    fut = [a for a in anios if a.isdigit()]
    rango = lambda a0, a1: [a for a in fut if a0 <= int(a) <= a1]
    sum2 = lambda L: (sum(tot[a][0] for a in L), sum(tot[a][1] for a in L))
    return {'bi': dict(eq=int(num(tras('Equipos en la BI'))), cli=int(num(re.sub(r'\D', '', tras('Equipos en la BI', 2)))),
                       val=num(tras('Valorización')), eq_val=int(num(tras('Valorización', 2).split()[0])),
                       cumplida=int(num(tras('Vida útil cumplida'))), renovar=num(tras('Valor a renovar')),
                       a0=fut[0], a1=fut[-1], fut=sum2(fut), primero=tot[fut[0]],
                       r3=sum2(rango(int(fut[1]), int(fut[3]))), r3_a0=fut[1], r3_a1=fut[3],
                       dental=lin.get('DENTAL', (0, 0)), ester=lin.get('ESTERILIZACIÓN', (0, 0)))}


# Cómo se nombra cada etapa del flujo dentro de «se encuentra en …».
ETAPA_FRASE = {'En Diagnóstico': 'diagnóstico', 'Espera de Diagnóstico': 'espera de diagnóstico',
               'Espera OC': 'espera de OC', 'Espera Repuestos': 'espera de repuestos',
               'En Reparación': 'reparación', 'Otros': 'otros estados'}


# ── Reglas por slide ────────────────────────────────────────────────────────
class R:
    """Un bullet: patrón con grupos con nombre y cómo recalcular cada uno.
    lista: nombre de un ranking; cada párrafo que calce es el ítem siguiente."""
    def __init__(self, patron, lista=None, **grupos):
        self.patron = re.compile(patron.replace('MMR', MMR).replace('PCT', PCT)
                                 .replace('NUM', NUM).replace('NOM', NOM), re.S)
        self.lista = lista
        self.grupos = grupos


def _w(cond, si, no):
    return si if cond else no


def reglas() -> dict:
    """slide → (reglas, textos fijos). Los fijos no cambian ni se resaltan."""
    F = {}
    # 7 · Facturación semana
    F[7] = ([
        R(r'^• A (?P<mes>\w+) se acumulan (?P<a>MMR) de facturación, concentrada principalmente en Servicio Técnico \((?P<b>MMR)\)',
          mes=lambda H, i: H['mes_nombre'], a=lambda H, i: MM(H['fac']['fac_tot']), b=lambda H, i: MM(H['fac']['fac_st'])),
        R(r'^• Servicio Técnico acumula (?P<a>MMR) de facturación, representando (?P<p>PCT) de la facturación acumulada',
          a=lambda H, i: MM(H['fac']['fac_st']), p=lambda H, i: P(H['fac']['fac_st'] / H['fac']['fac_tot'] * 100)),
        # «por sobre el mismo periodo» / «por debajo del mismo periodo»
        R(r'^• La facturación acumulada alcanza (?P<a>MMR), un (?P<p>PCT) (?P<w>por sobre |por debajo d)el mismo periodo del año anterior, equivalente a (?P<d>MMR) (?P<w2>adicionales|menos)',
          a=lambda H, i: MM(H['fac']['fac_tot']),
          p=lambda H, i: P(abs(H['fac']['fac_var_aa']) / H['fac']['fac_aa'] * 100),
          w=lambda H, i: _w(H['fac']['fac_var_aa'] >= 0, 'por sobre ', 'por debajo d'),
          d=lambda H, i: MM(abs(H['fac']['fac_var_aa'])),
          w2=lambda H, i: _w(H['fac']['fac_var_aa'] >= 0, 'adicionales', 'menos')),
        R(r'^• Trazabilidad acumula (?P<a>MMR) y presenta un avance mensual de (?P<p>PCT) sobre el presupuesto, mientras que Servicio Técnico se encuentra (?P<q>PCT) (?P<w>bajo|sobre) presupuesto mensual',
          a=lambda H, i: MM(H['fac']['fac_tz']),
          p=lambda H, i: P(H['fac']['tz_avance_mes'], 0 if round(H['fac']['tz_avance_mes'], 1) in (0, 100) else 1),
          q=lambda H, i: P(abs(H['fac']['st_avance_mes'] - 100)),
          w=lambda H, i: _w(H['fac']['st_avance_mes'] < 100, 'bajo', 'sobre')),
    ], [])
    # 8 · Garantías vigentes
    g = lambda H: H['gar']
    F[8] = ([
        R(r'^La cartera de garantías vigentes alcanza (?P<a>MMR) de ingresos estimados, asociados a (?P<n>NUM) contratos, con (?P<b>MMR) de costo estimado y (?P<c>MMR) aún por consumir',
          a=lambda H, i: MM(g(H)['monto']), n=lambda H, i: nfmt(g(H)['n']), b=lambda H, i: MM(g(H)['costo']),
          c=lambda H, i: MM(g(H)['rem'])),
        R(r'^El costo estimado representa aproximadamente (?P<p>PCT) de los ingresos, dejando un margen estimado cercano al (?P<q>PCT)',
          p=lambda H, i: P(g(H)['costo'] / g(H)['monto'] * 100, 0),
          q=lambda H, i: P(100 - round(g(H)['costo'] / g(H)['monto'] * 100), 0)),
        R(r'^La cartera presenta una alta concentración en los contratos de mayor monto: los 10 principales reúnen aproximadamente (?P<a>MMR) millones, equivalentes al (?P<p>PCT) del monto total',
          a=lambda H, i: MM(g(H)['top10']), p=lambda H, i: P(g(H)['top10'] / g(H)['monto'] * 100, 0)),
        R(r'^Los contratos presentan distintos niveles de consumo y vigencia, con vencimientos que se extienden hasta (?P<y>\d{4})',
          y=lambda H, i: str(g(H)['fin_max'])),
        R(r'^La cartera mantiene (?P<a>MMR) de costo estimado remanente',
          a=lambda H, i: MM(g(H)['rem'])),
    ], [r'^Esterilización concentra la mayor parte de la cartera'])
    # 9 · Garantías por línea
    F[9] = ([
        R(r'^La esterilización concentra el (?P<p>PCT) de los contratos vigentes, con (?P<a>NUM) de los (?P<b>NUM) contratos de la cartera, versus (?P<c>NUM) de Dental',
          p=lambda H, i: P(g(H)['E']['n'] / g(H)['T']['n'] * 100), a=lambda H, i: str(g(H)['E']['n']),
          b=lambda H, i: str(g(H)['T']['n']), c=lambda H, i: str(g(H)['D']['n'])),
        R(r'^Esterilización representa cerca del (?P<p>PCT) del costo total estimado, alcanzando (?P<a>MMR), versus (?P<b>MMR) de Dental',
          p=lambda H, i: P(g(H)['E']['costo'] / g(H)['T']['costo'] * 100, 0),
          a=lambda H, i: MM(g(H)['E']['costo']), b=lambda H, i: MM(g(H)['D']['costo'])),
        R(r'^El costo remanente asciende a (?P<a>MMR), equivalente al (?P<p>PCT) del costo total estimado, quedando (?P<b>MMR) consumidos',
          a=lambda H, i: MM(g(H)['T']['rem']), p=lambda H, i: P(100 - g(H)['T']['cons']),
          b=lambda H, i: MM(g(H)['T']['costo'] - g(H)['T']['rem'])),
        R(r'^A nivel consolidado, se ha consumido (?P<p>PCT) del costo estimado, manteniéndose (?P<q>PCT) pendiente de consumir',
          p=lambda H, i: P(g(H)['T']['cons']), q=lambda H, i: P(100 - g(H)['T']['cons'])),
        R(r'^Los contratos de Dental presentan un (?P<w>mayor|menor) nivel de avance, con (?P<p>PCT) consumido, versus (?P<q>PCT) en Esterilización',
          w=lambda H, i: _w(g(H)['D']['cons'] >= g(H)['E']['cons'], 'mayor', 'menor'),
          p=lambda H, i: P(g(H)['D']['cons']), q=lambda H, i: P(g(H)['E']['cons'])),
        R(r'^Esterilización concentra el (?P<p>PCT) del costo remanente, con (?P<a>MMR), constituyendo',
          p=lambda H, i: P(g(H)['E']['rem'] / g(H)['T']['rem'] * 100), a=lambda H, i: MM(g(H)['E']['rem'])),
        R(r'^El promedio de días restantes es de (?P<a>NUM) días, con una diferencia relevante entre Esterilización \((?P<b>NUM) días\) y Dental \((?P<c>NUM) días\)',
          a=lambda H, i: nfmt(g(H)['T']['dias']), b=lambda H, i: nfmt(g(H)['E']['dias']), c=lambda H, i: nfmt(g(H)['D']['dias'])),
    ], [r'^La cartera presenta una alta concentración en proyectos de Esterilización'])
    # 10 · Brechas de facturación (tres cajas)
    b = lambda H: H['br']; s = lambda H: H['stk']
    F[10] = ([
        R(r'^En total (?P<a>MMR) por facturar, (?P<m_coment>.*)$', a=lambda H, i: MM(b(H)['op_total'])),
        R(r'^Se concentra fuerte: dos clientes explican el (?P<p>PCT)',
          p=lambda H, i: P(sum(x[2] for x in b(H)['op_top']), 0)),
        R(r'^(?P<nom>NOM): (?P<a>MMR) \((?P<p>PCT)\)$', lista='op_top',
          nom=lambda H, i: ('nombre', b(H)['op_top'][i][0]), a=lambda H, i: MM(b(H)['op_top'][i][1]),
          p=lambda H, i: P(b(H)['op_top'][i][2])),
        R(r'^De (?P<n>NUM) clientes, se esperaba una facturación de (?P<a>MMR), sin embargo, a la fecha se ha facturado solo (?P<b>MMR) \(brecha (?P<c>MMR)\)',
          n=lambda H, i: str(b(H)['ct_n']), a=lambda H, i: MM(b(H)['ct_esp']), b=lambda H, i: MM(b(H)['ct_real']),
          c=lambda H, i: MM(b(H)['ct_gap'])),
        R(r'^(?P<nom>NOM) \((?P<a>MMR) vs\. (?P<b>MMR) real\)$', lista='ct_top',
          nom=lambda H, i: ('nombre', b(H)['ct_top'][i][0]), a=lambda H, i: MM(b(H)['ct_top'][i][1]),
          b=lambda H, i: MM(b(H)['ct_top'][i][2])),
        R(r'^Hay un total de (?P<a>MMR) de repuestos que no tienen stock\. Son (?P<n>NUM) SKU distintos \((?P<m>NUM) pares cliente-SKU\) en (?P<c>NUM) clientes',
          a=lambda H, i: MM(s(H)['total']), n=lambda H, i: nfmt(s(H)['n_sku']), m=lambda H, i: nfmt(s(H)['n_pares']),
          c=lambda H, i: nfmt(s(H)['n_cli'])),
        R(r'^(?P<nom>NOM): (?P<p>PCT)(?P<x> de la brecha)? \((?P<n>NUM) SKU\)(?P<fin>\.?)$', lista='stk_top',
          nom=lambda H, i: ('nombre', s(H)['top'][i][0]), p=lambda H, i: P(s(H)['top'][i][1]),
          n=lambda H, i: str(s(H)['top'][i][2])),
        R(r'^(?P<p>PCT) se cubre por stock en bodega', p=lambda H, i: P(s(H)['cob_stock'], 0)),
        R(r'^(?P<p>PCT) se cubre por back order', p=lambda H, i: P(s(H)['cob_bo'], 0)),
        R(r'^Stock \+ back order = (?P<p>PCT)',
          p=lambda H, i: P(round(s(H)['cob_stock']) + round(s(H)['cob_bo']), 0)),
        R(r'^El restante (?P<p>PCT) son (?P<a>MMR) en (?P<n>NUM) pares cliente-SKU\. Se explica principalmente porque (?P<x>NUM) de los (?P<y>NUM) pares \((?P<q>PCT)\) no figuran en el maestro de inventario',
          p=lambda H, i: P(100 - round(s(H)['cob_stock']) - round(s(H)['cob_bo']), 0),
          a=lambda H, i: MM(s(H)['resto']), n=lambda H, i: nfmt(s(H)['n_resto']),
          x=lambda H, i: nfmt(s(H)['sin_maestro']), y=lambda H, i: nfmt(s(H)['n_pares']),
          q=lambda H, i: P(s(H)['sin_maestro'] / s(H)['n_pares'] * 100, 0)),
    ], [r'^Principales clientes:?$', r'^Cobertura de estos repuestos'])
    # 11 · Rotación sin stock (bruto)
    F[11] = ([
        R(r'^El stock pendiente alcanza (?P<a>MMR), distribuido en (?P<n>NUM) SKU y (?P<c>NUM) clientes',
          a=lambda H, i: MM(s(H)['total']), n=lambda H, i: nfmt(s(H)['n_sku_lineas']), c=lambda H, i: nfmt(s(H)['n_cli'])),
        R(r'^El (?P<a>PCT) del stock presenta baja rotación, mientras que un (?P<b>PCT) corresponde a rotación media, un (?P<c>PCT) a alta rotación y un (?P<d>PCT) a productos sin rotación',
          a=lambda H, i: P(s(H)['rot_baja']), b=lambda H, i: P(s(H)['rot_media']), c=lambda H, i: P(s(H)['rot_alta']),
          d=lambda H, i: P(s(H)['rot_sin'])),
        R(r'^Los 3 principales clientes concentran (?P<a>MMR), equivalentes aproximadamente al (?P<p>PCT) del stock pendiente',
          a=lambda H, i: MM(s(H)['top3']), p=lambda H, i: P(s(H)['top3'] / s(H)['total'] * 100, 0)),
        R(r'^Solo el (?P<p>PCT) del stock presenta rotación media o alta',
          p=lambda H, i: P(s(H)['rot_media'] + s(H)['rot_alta'])),
        R(r'^(?P<nom1>NOM) concentra el mayor stock pendiente, con (?P<a>MMR), seguido por (?P<nom2>NOM) \((?P<b>MMR)\) y (?P<nom3>NOM) \((?P<c>MMR)\)',
          nom1=lambda H, i: ('nombre', s(H)['top'][0][0]), a=lambda H, i: MM(s(H)['top'][0][3]),
          nom2=lambda H, i: ('nombre', s(H)['top'][1][0]), b=lambda H, i: MM(s(H)['top'][1][3]),
          nom3=lambda H, i: ('nombre', s(H)['top'][2][0]), c=lambda H, i: MM(s(H)['top'][2][3])),
        R(r'^Los 10 principales clientes concentran aproximadamente (?P<a>MMR), equivalentes al (?P<p>PCT) del stock pendiente',
          a=lambda H, i: MM(s(H)['top10']), p=lambda H, i: P(s(H)['top10'] / s(H)['total'] * 100, 0)),
    ], [])
    # 14 y 16 · EERR (el 16 usa el EBITDA Indirecto del EERR Limpio como «EBITDA Empresa»)
    for sl, k, ebe in ((14, 'eerr', 'ebe'), (16, 'eerr_l', 'ebi')):
        F[sl] = (_reglas_eerr(k, ebe), [r'^Este estado de resultado es el mismo', r'^Costo de ventas en una sola',
                                       r'^Costo de ventas neto de garantías', r'^Depreciación sin el Arriendo',
                                       r'^EBITDAR y arriendo', r'^Los dos primeros ajustes'])
    # 19 · Equipos detenidos (flujo)
    c = lambda H: H['cas']
    def etapa_max(H):
        return max(c(H)['etapas'], key=lambda e: e[1])
    F[19] = ([
        R(r'^En total hay (?P<n>NUM) equipos detenidos, correspondientes a (?P<c>NUM) clientes y (?P<m>NUM) marcas, con una valorización total de (?P<a>MMR)',
          n=lambda H, i: str(c(H)['n_eq']), c=lambda H, i: str(c(H)['n_cli']), m=lambda H, i: str(c(H)['n_marcas']),
          a=lambda H, i: MM(c(H)['val'])),
        R(r'^El (?P<p>PCT) de los equipos se encuentra en (?P<e>[^,]+?), equivalente a (?P<n>NUM) equipos y (?P<a>MMR), siendo la principal concentración',
          p=lambda H, i: P(etapa_max(H)[1] / c(H)['n_eq'] * 100, 0),
          e=lambda H, i: ETAPA_FRASE.get(etapa_max(H)[0], etapa_max(H)[0].lower()), n=lambda H, i: str(etapa_max(H)[1]),
          a=lambda H, i: MM(etapa_max(H)[2])),
        R(r'^(?P<mar>[A-ZÁÉÍÓÚÑ ]+) concentra aproximadamente (?P<a>MMR) del valor de los equipos detenidos, equivalente a cerca del (?P<p>PCT) del total, con (?P<n>NUM) equipos',
          mar=lambda H, i: c(H)['marcas'][0][0], a=lambda H, i: MM(c(H)['marcas'][0][2]),
          p=lambda H, i: P(c(H)['marcas'][0][3], 0), n=lambda H, i: str(c(H)['marcas'][0][1])),
        R(r'^(?P<nom>[^–]+?) – (?P<n>NUM) equipos \((?P<p>PCT)\)$', lista='eq_top',
          nom=lambda H, i: rk(H, c(H)['equipos'])[i][0], n=lambda H, i: str(rk(H, c(H)['equipos'])[i][1]),
          p=lambda H, i: P(rk(H, c(H)['equipos'])[i][1] / c(H)['n_eq'] * 100, 0)),
    ], [r'^Los equipos con mayor cantidad de unidades detenidas son'])
    # 22 · Equipos detenidos por cliente
    cl = lambda H, k: rk(H, c(H)['clientes'])[k]
    F[22] = ([
        R(r'^Los (?P<n>NUM) equipos detenidos se concentran principalmente en (?P<s>NUM) equipos sin cliente asociado, equivalentes al (?P<p>PCT) del total',
          n=lambda H, i: str(c(H)['n_eq']), s=lambda H, i: str(c(H)['sin_eq']),
          p=lambda H, i: P(c(H)['sin_eq'] / c(H)['n_eq'] * 100, 0)),
        R(r'^Entre los clientes, (?P<nom>NOM) concentra (?P<n>NUM) equipos, con (?P<a>MMR) valorizados y (?P<b>MMR) de ingresos facturados a la fecha',
          nom=lambda H, i: ('nombre', cl(H, 0)[0]), n=lambda H, i: str(cl(H, 0)[1]), a=lambda H, i: MM(cl(H, 0)[2]),
          b=lambda H, i: MM(cl(H, 0)[3])),
        R(r'^(?P<nom1>NOM) y (?P<nom2>NOM) registran (?P<n>NUM) equipos detenidos cada uno, con valorizados de (?P<a>MMR) y (?P<b>MMR), respectivamente',
          nom1=lambda H, i: ('nombre', cl(H, 1)[0]), nom2=lambda H, i: ('nombre', cl(H, 2)[0]), n=lambda H, i: str(cl(H, 1)[1]),
          a=lambda H, i: MM(cl(H, 1)[2]), b=lambda H, i: MM(cl(H, 2)[2])),
        R(r'^(?P<nom1>NOM) y (?P<nom2>NOM) mantienen (?P<n>NUM) equipos detenidos cada uno, con valorizados de (?P<a>MMR) y (?P<b>MMR)',
          nom1=lambda H, i: ('nombre', cl(H, 3)[0]), nom2=lambda H, i: ('nombre', cl(H, 4)[0]), n=lambda H, i: str(cl(H, 3)[1]),
          a=lambda H, i: MM(cl(H, 3)[2]), b=lambda H, i: MM(cl(H, 4)[2])),
        R(r'^El total de equipos detenidos alcanza un valorizado de (?P<a>MMR), frente a (?P<b>MMR) de ingresos facturados a la fecha y un contrato anual esperado de (?P<c>MMR)',
          a=lambda H, i: MM(c(H)['val']), b=lambda H, i: MM(c(H)['fact']), c=lambda H, i: MM(c(H)['contrato'])),
        R(r'^La concentración de equipos sin cliente asociado representa (?P<a>MMR) valorizados, equivalentes a aproximadamente (?P<p>PCT) del valorizado total',
          a=lambda H, i: MM(c(H)['sin_val']), p=lambda H, i: P(c(H)['sin_val'] / c(H)['val'] * 100, 0)),
    ], [])
    # 27 · Composición de la facturación
    m = lambda H: H['cmp']
    F[27] = ([
        R(r'^La facturación acumulada (?P<y>\d{4}) \(enero–(?P<mes>\w+)\) alcanza (?P<a>MMR), (?P<m_dist>distribuida [^(]+?)\((?P<b>MMR); (?P<p>PCT)\) y mantenciones correctivas y otras facturaciones \((?P<c>MMR); (?P<q>PCT)\)',
          y=lambda H, i: H['hoy'][:4], mes=lambda H, i: MESES[(H['mes_corte'] or 1) - 1],
          a=lambda H, i: MM(m(H)['tot']), b=lambda H, i: MM(m(H)['tc']), p=lambda H, i: P(m(H)['tc_p']),
          c=lambda H, i: MM(m(H)['tm']), q=lambda H, i: P(m(H)['tm_p'])),
        R(r'^Los clientes con contrato concentran (?P<a>MMR) de facturación, equivalentes al (?P<p>PCT) del total, mientras que los clientes sin contrato representan (?P<b>MMR) \((?P<q>PCT)\)',
          a=lambda H, i: MM(m(H)['cc']), p=lambda H, i: P(m(H)['cc_p']), b=lambda H, i: MM(m(H)['sc']),
          q=lambda H, i: P(m(H)['sc_p'])),
        R(r'^Los contratos activos aportan (?P<a>MMR), mientras que la facturación spot de clientes que además mantienen contrato alcanza (?P<b>MMR)',
          a=lambda H, i: MM(m(H)['ca']), b=lambda H, i: MM(m(H)['spot_c'])),
        R(r'^Los clientes sin contrato generan (?P<a>MMR) mediante facturación spot y (?P<b>MMR) asociados a contratos vencidos',
          a=lambda H, i: MM(m(H)['spot_s']), b=lambda H, i: MM(m(H)['cv'])),
        R(r'^Los clientes nuevos aportan (?P<a>MMR) de facturación durante (?P<y>\d{4}), equivalentes al (?P<p>PCT) del total acumulado',
          a=lambda H, i: MM(m(H)['nue']), y=lambda H, i: H['hoy'][:4], p=lambda H, i: P(m(H)['nue_p'])),
        R(r'^Se identifican (?P<n>NUM) clientes perdidos sin facturación actual, que durante (?P<y>\d{4}) generaron (?P<a>MMR)',
          n=lambda H, i: str(m(H)['perd_n']), y=lambda H, i: str(int(H['hoy'][:4]) - 1), a=lambda H, i: MM(m(H)['perd_25'])),
    ], [])
    # 28 · Vencimientos 90 días
    v = lambda H: H['vto']
    F[28] = ([
        R(r'^(?P<n>NUM) contratos se encuentran vencidos o vencen dentro del horizonte de 90 días, asociados a (?P<c>NUM) clientes y por un monto total de (?P<a>MMR)',
          n=lambda H, i: str(v(H)['n']), c=lambda H, i: str(v(H)['n_cli']), a=lambda H, i: MM(v(H)['monto'])),
        R(r'^(?P<n>NUM) contratos ya se encuentran vencidos, por (?P<a>MMR), siendo el principal foco',
          n=lambda H, i: str(v(H)['n_venc']), a=lambda H, i: MM(v(H)['m_venc'])),
        R(r'^(?P<mes>\w+) concentra (?P<n>NUM) contratos \((?P<a>MMR)\), mientras que (?P<k>NUM) contratos ya se encuentran vencidos \((?P<b>MMR)\)',
          mes=lambda H, i: v(H)['mes'], n=lambda H, i: str(v(H)['n_mes']), a=lambda H, i: MM(v(H)['m_mes']),
          k=lambda H, i: str(v(H)['n_venc']), b=lambda H, i: MM(v(H)['m_venc'])),
        R(r'^Los contratos vencidos concentran el mayor monto del período, con (?P<a>MMR), equivalente aproximadamente al (?P<p>PCT) del total del horizonte',
          a=lambda H, i: MM(v(H)['m_venc']), p=lambda H, i: P(v(H)['m_venc'] / v(H)['monto'] * 100, 0)),
        R(r'^\s*(?P<n>NUM) contratos corresponden a la cartera comercial, por (?P<a>MMR), mientras que (?P<k>NUM) son de garantía, por (?P<b>MMR)',
          n=lambda H, i: str(v(H)['n_com']), a=lambda H, i: MM(v(H)['m_com']), k=lambda H, i: str(v(H)['n_gar']),
          b=lambda H, i: MM(v(H)['m_gar'])),
    ], [])
    # 35 · Prospectos según renovación de la base instalada
    bi = lambda H: H['bi']
    F[35] = ([
        R(r'^Actualmente, existen (?P<a>NUM) equipos instalados en (?P<b>NUM) clientes, con una valorización de (?P<c>MMR) para (?P<d>NUM) equipos valorizados',
          a=lambda H, i: nfmt(bi(H)['eq']), b=lambda H, i: nfmt(bi(H)['cli']), c=lambda H, i: MM(bi(H)['val']),
          d=lambda H, i: nfmt(bi(H)['eq_val'])),
        R(r'^(?P<a>NUM) equipos ya cumplieron su vida útil, representando un valor a renovar de (?P<b>MMR)',
          a=lambda H, i: nfmt(bi(H)['cumplida']), b=lambda H, i: MM(bi(H)['renovar'])),
        R(r'^Entre (?P<y0>\d{4}) y (?P<y1>\d{4}), se identifican (?P<a>NUM) equipos que cumplen su vida útil, con un valor potencial de renovación de (?P<b>MMR)',
          y0=lambda H, i: bi(H)['a0'], y1=lambda H, i: bi(H)['a1'], a=lambda H, i: nfmt(bi(H)['fut'][0]),
          b=lambda H, i: MM(bi(H)['fut'][1])),
        R(r'^(?P<y>\d{4}) concentra (?P<a>NUM) equipos, equivalentes a (?P<b>MMR) de potencial de renovación',
          y=lambda H, i: bi(H)['a0'], a=lambda H, i: nfmt(bi(H)['primero'][0]), b=lambda H, i: MM(bi(H)['primero'][1])),
        R(r'^El mayor volumen de renovación se concentra entre (?P<y0>\d{4}) y (?P<y1>\d{4}), con (?P<a>NUM) equipos y (?P<b>MMR) de valor potencial',
          y0=lambda H, i: bi(H)['r3_a0'], y1=lambda H, i: bi(H)['r3_a1'], a=lambda H, i: nfmt(bi(H)['r3'][0]),
          b=lambda H, i: MM(bi(H)['r3'][1])),
        R(r'^Dental concentra el mayor número de equipos con vencimiento, con (?P<a>NUM) equipos y (?P<b>MMR), seguido por Esterilización con (?P<c>NUM) equipos y (?P<d>MMR)',
          a=lambda H, i: nfmt(bi(H)['dental'][0]), b=lambda H, i: MM(bi(H)['dental'][1]),
          c=lambda H, i: nfmt(bi(H)['ester'][0]), d=lambda H, i: MM(bi(H)['ester'][1])),
        R(r'^La distribución de vencimientos permite construir un pipeline de renovación de largo plazo, priorizando inicialmente los (?P<a>NUM) equipos',
          a=lambda H, i: nfmt(bi(H)['cumplida'])),
    ], [])
    return F


def _reglas_eerr(k, ebe):
    e = lambda H: H[k]
    dif = lambda t: t[2]                                # la variación tal como la muestra el panel
    pct = lambda t: t[3]
    mg = lambda H, t, j: t[j] / e(H)['ing'][j] * 100 if e(H)['ing'][j] else 0
    return [
        R(r'^Los ingresos acumulados alcanzan (?P<a>MMR), (?P<w>superando|bajo) el presupuesto en (?P<b>MMR) \((?P<p>PCT)\)',
          a=lambda H, i: MM(e(H)['ing'][0]), w=lambda H, i: _w(dif(e(H)['ing']) >= 0, 'superando', 'bajo'),
          b=lambda H, i: MM(abs(dif(e(H)['ing']))), p=lambda H, i: P(pct(e(H)['ing']), 1, True)),
        R(r'^El EBITDA Directo alcanza (?P<a>MMR), con un margen de (?P<p>PCT), (?P<w>superior|inferior) al (?P<q>PCT) presupuestado, reflejando una (?P<w2>mayor|menor) rentabilidad',
          a=lambda H, i: MM(e(H)['ebd'][0]), p=lambda H, i: P(mg(H, e(H)['ebd'], 0)),
          w=lambda H, i: _w(mg(H, e(H)['ebd'], 0) >= mg(H, e(H)['ebd'], 1), 'superior', 'inferior'),
          q=lambda H, i: P(mg(H, e(H)['ebd'], 1)),
          w2=lambda H, i: _w(mg(H, e(H)['ebd'], 0) >= mg(H, e(H)['ebd'], 1), 'mayor', 'menor')),
        R(r'^Al incorporar GAV Indirecto, el EBITDA Empresa alcanza (?P<a>MMR), (?P<b>MMR) (?P<w>sobre|bajo) presupuesto \((?P<p>PCT)\), con un margen de (?P<q>PCT), (?P<w2>superior|inferior) al (?P<r>PCT) presupuestado',
          a=lambda H, i: MM(e(H)[ebe][0]), b=lambda H, i: MM(abs(dif(e(H)[ebe]))),
          w=lambda H, i: _w(dif(e(H)[ebe]) >= 0, 'sobre', 'bajo'), p=lambda H, i: P(pct(e(H)[ebe]), 1, True),
          q=lambda H, i: P(mg(H, e(H)[ebe], 0)),
          w2=lambda H, i: _w(mg(H, e(H)[ebe], 0) >= mg(H, e(H)[ebe], 1), 'superior', 'inferior'),
          r=lambda H, i: P(mg(H, e(H)[ebe], 1))),
        R(r'^El resultado del ejercicio alcanza (?P<a>MMR), versus (?P<b>MMR) presupuestados, evidenciando que, (?P<w>pese a|junto a) los mayores ingresos y EBITDA, el resultado final se encuentra (?P<w2>bajo|sobre) presupuesto',
          a=lambda H, i: MM(e(H)['res'][0]), b=lambda H, i: MM(e(H)['res'][1]),
          w=lambda H, i: _w(dif(e(H)['res']) >= 0, 'junto a', 'pese a'),
          w2=lambda H, i: _w(dif(e(H)['res']) >= 0, 'sobre', 'bajo')),
        R(r'^El principal desafío está en mantener la conversión del EBITDA en resultado final, (?P<m_txt>.*?)el resultado no operacional acumula (?P<a>MMR)',
          a=lambda H, i: MM(e(H)['nop'][0])),
    ]


# ── Títulos con fecha ──────────────────────────────────────────────────────
ORD = {1: '1°', 2: '2°', 3: '3°', 4: '4°', 5: '5°'}


def titulos(H) -> dict:
    out = {7: (r'^Facturación \d° Semana de \w+$',
               f'Facturación {ORD[H["semana_mes"]]} Semana de {H["mes_nombre"].capitalize()}')}
    if H.get('eerr'):
        mes = H['eerr']['ult_mes'][:3].capitalize()
        yy = (H.get('hoy') or '2026')[2:4]
        for sl, base in ((14, 'EERR TECSERVICE Cierre'), (16, 'EERR Limpio TECSERVICE Cierre')):
            out[sl] = (r'^' + base + r' \w{3}-\d\d$', f'{base} {mes}-{yy}')
    return out
