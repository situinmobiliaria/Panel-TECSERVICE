#!/usr/bin/env python3
"""
gen_ppt.py — Genera el PowerPoint ejecutivo del Comité TECSERVICE con los datos del
panel, partiendo del deck de la semana anterior.

    python gen_ppt.py                       # deck más reciente → deck de hoy
    python gen_ppt.py --base "20261023 TECSERVICE_vd.pptx" --salida "x.pptx"
    python gen_ppt.py --sin-capturar        # reusa las imágenes de la última corrida

Qué hace:
  1. Abre index.html en un navegador sin pantalla y exporta cada tarjeta que va en el
     deck, en el estado con que se pega (ver ppt_capturar.EXPORTABLES).
  2. Cambia cada imagen por la nueva dentro del mismo marco, con el mismo recorte del
     encabezado y de la nota al pie. Si la imagen nueva trae más filas, se achica para
     caber en el marco en vez de perder filas.
  3. Actualiza las cifras de los bullets y los títulos con fecha sin cambiar la
     redacción (ppt_textos). Lo que es comentario manual queda resaltado en amarillo.
  4. Deja junto al deck un informe .txt con lo que cambió y lo que hay que revisar.

Requiere: python-pptx, Pillow, playwright (con Edge o Chrome instalado).
"""
from __future__ import annotations
import argparse, copy, io, json, os, re, sys
from datetime import date
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.oxml.ns import qn

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ppt_textos as TX                                       # noqa: E402

DIR = Path(__file__).resolve().parent
ROOT = DIR.parent
PATRON_DECK = re.compile(r'^(\d{8}) TECSERVICE_vd\.pptx$')

# Slide → exportables, de arriba hacia abajo según su posición en la slide.
IMAGENES = {
    7: ['analisis_fac'], 8: ['garantias'], 9: ['garantias_lin'], 10: ['brechas'],
    11: ['brecha_cli'], 12: ['que_comprar'],
    14: ['eerr_res'], 15: ['eerr_mens'], 16: ['eerr_lim_res'], 17: ['eerr_lim_mens'],
    19: ['casos_flujo'], 20: ['casos_equipo'], 21: ['casos_marca'], 22: ['casos_cliente'],
    24: ['casos_resumen'], 25: ['fill_rate'], 27: ['fac_tipo_cli'], 28: ['venc_90'],
    32: ['satisfaccion'], 35: ['bi_kpi', 'bi_heat_linea'], 36: ['bi_region'], 37: ['bi_heat_region'],
    43: ['matriz'], 46: ['conc_valpo'], 50: ['conc_rm'], 55: ['visitas_prog'],
    56: ['visitas_dest', 'visitas_grupo'], 57: ['visitas_eje', 'visitas_mes'], 58: ['visitas_mapa'],
    61: ['plan_gantt'],
}
AMARILLO = 'FFFF00'


# ── Deck de entrada y de salida ─────────────────────────────────────────────
def deck_anterior(carpeta: Path) -> Path:
    cands = sorted((m.group(1), p) for p in carpeta.iterdir() if (m := PATRON_DECK.match(p.name)))
    if not cands:
        raise SystemExit(f'No hay ningún «AAAAMMDD TECSERVICE_vd.pptx» en {carpeta}')
    return cands[-1][1]


def nombre_salida(carpeta: Path, hoy: date, base: Path) -> Path:
    p = carpeta / f'{hoy:%Y%m%d} TECSERVICE_vd.pptx'
    k = 2
    while p.exists() or p == base:
        p = carpeta / f'{hoy:%Y%m%d} TECSERVICE_vd ({k}).pptx'; k += 1
    return p


# ── Imágenes ───────────────────────────────────────────────────────────────
def fin_encabezado(img: Image.Image) -> int:
    """Fila donde termina el encabezado «TECSERVICE — …» del exportable: la línea azul
    (#002D73) de 2,5 px que lo cierra. 0 si la imagen no trae encabezado."""
    w, h = img.size
    px = img.convert('RGB').resize((min(w, 800), h)).load()
    ww = min(w, 800)
    for y in range(0, int(h * 0.25)):
        azul = sum(1 for x in range(0, ww, 4)
                   if abs(px[x, y][0] - 0) < 40 and abs(px[x, y][1] - 45) < 40 and abs(px[x, y][2] - 115) < 45)
        if azul > ww / 4 * 0.6:
            y2 = y
            while y2 + 1 < h and sum(1 for x in range(0, ww, 4)
                                     if abs(px[x, y2 + 1][2] - 115) < 45 and px[x, y2 + 1][0] < 40) > ww / 4 * 0.6:
                y2 += 1
            return y2 + 1
    return 0


def _pictures(slide):
    """Imágenes grandes de la slide, sin las duplicadas que quedan debajo de otra."""
    pics = [sh for sh in slide.shapes if sh.shape_type == 13 and _tiene_blob(sh) and sh.image.size[0] >= 1000]
    keep = []
    for sh in reversed(pics):                                   # la de más arriba en z-orden manda
        if any(_solapa(sh, k) > 0.6 for k in keep):
            sh._element.getparent().remove(sh._element)
            continue
        keep.append(sh)
    return sorted(keep, key=lambda s: s.top)


def _tiene_blob(sh):
    try:
        sh.image.blob; return True
    except Exception:
        return False


def _solapa(a, b):
    x0, y0 = max(a.left, b.left), max(a.top, b.top)
    x1, y1 = min(a.left + a.width, b.left + b.width), min(a.top + a.height, b.top + b.height)
    if x1 <= x0 or y1 <= y0:
        return 0
    inter = (x1 - x0) * (y1 - y0)
    return inter / min(a.width * a.height, b.width * b.height)


def reemplazar_imagen(slide, pic, png: Path, log):
    old = Image.open(io.BytesIO(pic.image.blob))
    new = Image.open(png)
    ow, oh = old.size; nw, nh = new.size
    cl, ct, cr, cb = pic.crop_left, pic.crop_top, pic.crop_right, pic.crop_bottom
    oh_end = fin_encabezado(old); nh_end = fin_encabezado(new)
    # Escala entre la imagen vieja y la nueva: por la altura del encabezado si las dos
    # lo traen (no depende del ancho del contenido), si no por el ancho.
    r = (nh_end / oh_end) if (oh_end and nh_end) else (nw / ow)
    top_old = ct * oh
    if oh_end and top_old >= oh_end - 4:
        top = nh_end + (top_old - oh_end) * r                   # se cortaba el encabezado y algo más
    elif not oh_end and nh_end:
        top = nh_end                                           # la vieja era una captura sin encabezado
    else:
        top = top_old * r
    bot = cb * oh * r; izq = cl * ow * r; der = cr * ow * r
    vis_w, vis_h = nw - izq - der, nh - top - bot
    if vis_w <= 10 or vis_h <= 10:
        top, bot, izq, der = nh_end, 0, 0, 0; vis_w, vis_h = nw, nh - nh_end
    # Marco: se conserva; la imagen cabe dentro sin deformarse, arriba y centrada.
    L, T, W, Hh = pic.left, pic.top, pic.width, pic.height
    esc = min(W / vis_w, Hh / vis_h)
    w2, h2 = int(vis_w * esc), int(vis_h * esc)
    # Nueva imagen en el paquete y el mismo <p:pic> apuntando a ella.
    _, rid = slide.part.get_or_add_image_part(io.BytesIO(png.read_bytes()))
    blip = pic._element.find('.//' + qn('a:blip'))
    old_rid = blip.get(qn('r:embed'))
    blip.set(qn('r:embed'), rid)
    if old_rid and old_rid != rid and not _rid_en_uso(slide, old_rid):
        try:
            slide.part.drop_rel(old_rid)
        except Exception:
            pass
    pic.crop_left, pic.crop_right = izq / nw, der / nw
    pic.crop_top, pic.crop_bottom = top / nh, bot / nh
    pic.left, pic.top = L + (W - w2) // 2, T
    pic.width, pic.height = w2, h2
    log(f'    imagen {png.stem:15} {ow}x{oh} → {nw}x{nh} · ocupa {w2 / W:.0%} × {h2 / Hh:.0%} del marco')


def _rid_en_uso(slide, rid):
    return any(e.get(qn('r:embed')) == rid for e in slide._element.iter(qn('a:blip')))


# ── Textos ─────────────────────────────────────────────────────────────────
_ORDEN_RPR = ['ln', 'noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill', 'effectLst', 'effectDag',
              'highlight', 'uLnTx', 'uLn', 'uFillTx', 'uFill', 'latin', 'ea', 'cs', 'sym', 'hlinkClick',
              'hlinkMouseOver', 'rtl', 'extLst']


def _resaltar(rPr, si: bool):
    for h in rPr.findall(qn('a:highlight')):
        rPr.remove(h)
    if not si:
        return
    h = rPr.makeelement(qn('a:highlight'), {})
    c = h.makeelement(qn('a:srgbClr'), {'val': AMARILLO}); h.append(c)
    despues = _ORDEN_RPR[_ORDEN_RPR.index('highlight') + 1:]
    for i, ch in enumerate(list(rPr)):
        if ch.tag.split('}')[1] in despues:
            rPr.insert(i, h); return
    rPr.append(h)


def _runs(par):
    return [r for r in par._p if r.tag == qn('a:r')]


def _reescribir(par, piezas):
    """piezas: [(texto, índice del run de origen, resaltar)]. Rehace los runs del
    párrafo conservando el formato de cada tramo."""
    runs = _runs(par)
    if not runs:
        return
    plantillas = [copy.deepcopy(r) for r in runs]
    ancla = runs[0]
    pos = list(par._p).index(ancla)
    for r in runs:
        par._p.remove(r)
    # Junta piezas consecutivas del mismo run y el mismo resaltado.
    junt = []
    for t, i, h in piezas:
        if not t:
            continue
        if junt and junt[-1][1] == i and junt[-1][2] == h:
            junt[-1][0] += t
        else:
            junt.append([t, i, h])
    for k, (t, i, h) in enumerate(junt):
        r = copy.deepcopy(plantillas[i])
        r.find(qn('a:t')).text = t
        rPr = r.find(qn('a:rPr'))
        if rPr is None:
            rPr = r.makeelement(qn('a:rPr'), {}); r.insert(0, rPr)
        _resaltar(rPr, h)
        par._p.insert(pos + k, r)


def _texto_y_mapa(par):
    txt, mapa = '', []
    for i, r in enumerate(_runs(par)):
        t = r.find(qn('a:t')).text or ''
        txt += t; mapa += [i] * len(t)
    return txt, mapa


def aplicar_regla(par, regla, H, idx, previos, log):
    txt, mapa = _texto_y_mapa(par)
    m = regla.patron.search(txt)
    if not m:
        return False
    piezas, cur = [], 0
    spans = sorted(((m.start(g), m.end(g), g) for g in m.groupdict() if m.start(g) >= 0), key=lambda x: x[0])

    def literal(a, b):
        j = a
        while j < b:
            i = mapa[j]; k = j
            while k < b and mapa[k] == i:
                k += 1
            piezas.append((txt[j:k], i, False)); j = k

    cambios = []
    for a, b, g in spans:
        literal(cur, a)
        viejo = txt[a:b]
        src = mapa[a] if a < len(mapa) else mapa[-1]
        if g.startswith('m_'):
            piezas.append((viejo, src, True))
        elif g in regla.grupos:
            v = regla.grupos[g](H, idx)
            if isinstance(v, tuple) and v[0] == 'nombre':
                v = TX.nombre_para(v[1], previos)
            if v != viejo:
                cambios.append(f'{viejo} → {v}')
            piezas.append((v, src, False))
        else:
            literal(a, b)
        cur = b
    literal(cur, len(txt))
    _reescribir(par, piezas)
    return cambios


def actualizar_textos(prs, H, informe):
    R = TX.reglas()
    TIT = TX.titulos(H)
    for n, slide in enumerate(prs.slides, 1):
        if n in TIT:
            pat, nuevo = TIT[n]
            for sh in slide.shapes:
                if sh.has_text_frame and re.match(pat, sh.text_frame.text.strip()):
                    p = sh.text_frame.paragraphs[0]; viejo = p.text
                    if viejo != nuevo:
                        _reescribir(p, [(nuevo, 0, False)])
                        informe['cambios'].append(f's{n} título: {viejo} → {nuevo}')
        if n not in R:
            continue
        reglas, fijos = R[n]
        fijos = [re.compile(f) for f in fijos]
        cajas = []
        for sh in slide.shapes:
            if not sh.has_text_frame:
                continue
            pars = [p for p in sh.text_frame.paragraphs if p.text.strip()]
            if len(pars) == 1 and not any(r.patron.search(pars[0].text) for r in reglas) and (
                    len(pars[0].text) < 60 or sh.top < 1_000_000):
                continue                                          # títulos y etiquetas
            cajas.append(pars)
        # Nombres que el usuario ya escribió en la slide (grupos «nom…» de los
        # patrones): un cliente que sigue en el ranking conserva cómo lo escribió.
        previos = []
        for pars in cajas:
            for p in pars:
                for r in reglas:
                    mm = r.patron.search(p.text.strip())
                    if mm:
                        previos += [v.strip() for g, v in mm.groupdict().items() if g.startswith('nom') and v]
                        break
        H['_previos'] = previos
        for pars in cajas:
            cont = {}
            for p in pars:
                t = p.text.strip()
                regla = next((r for r in reglas if r.patron.search(t)), None)
                if regla:
                    idx = cont.get(regla.lista, 0)
                    if regla.lista:
                        cont[regla.lista] = idx + 1
                    try:
                        cambios = aplicar_regla(p, regla, H, idx, previos, informe['log'])
                        if cambios:
                            informe['cambios'].append(f's{n}: ' + '; '.join(cambios))
                    except (IndexError, KeyError, ZeroDivisionError, TypeError) as e:
                        _marcar(p, True)
                        informe['revisar'].append(f's{n} sin dato para actualizar ({type(e).__name__}): {t[:110]}')
                elif any(f.search(t) for f in fijos):
                    continue
                else:
                    _marcar(p, True)
                    informe['manual'].append(f's{n}: {t[:140]}')


def _marcar(par, si):
    for r in _runs(par):
        rPr = r.find(qn('a:rPr'))
        if rPr is None:
            rPr = r.makeelement(qn('a:rPr'), {}); r.insert(0, rPr)
        _resaltar(rPr, si)


# ── Principal ──────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--base', help='deck de la semana anterior (por defecto el más reciente)')
    ap.add_argument('--salida', help='nombre del deck nuevo')
    ap.add_argument('--sin-capturar', action='store_true', help='reusa las imágenes y datos de la última corrida')
    a = ap.parse_args()

    base = Path(a.base) if a.base else deck_anterior(ROOT)
    if not base.is_absolute():
        base = ROOT / base
    cache = Path(os.environ.get('TEMP', str(ROOT))) / 'ppt_capturas'
    print('=' * 64); print('  GENERADOR DEL PPT EJECUTIVO'); print(f'  Base   : {base.name}')

    if a.sin_capturar:
        datos = json.loads((cache / 'datos.json').read_text(encoding='utf-8'))
        imagenes = {p.stem: str(p) for p in cache.glob('*.png') if not p.stem.startswith('_')}
    else:
        from ppt_capturar import capturar
        print('\n[1/3] Exportando tarjetas del panel…')
        imagenes, datos = capturar(ROOT / 'index.html', cache)
        (cache / 'datos.json').write_text(json.dumps(datos, ensure_ascii=False), encoding='utf-8')

    hoy = date.fromisoformat(datos['APP_DATA']['hoy']) if datos.get('APP_DATA', {}).get('hoy') else date.today()
    salida = Path(a.salida) if a.salida else nombre_salida(ROOT, date.today(), base)
    if not salida.is_absolute():
        salida = ROOT / salida
    informe = {'cambios': [], 'manual': [], 'revisar': [], 'log': print}
    for k, e in (datos.get('_errores_captura') or {}).items():
        informe['revisar'].append(f'imagen {k} no se pudo exportar: {e}')

    prs = Presentation(str(base))
    print('\n[2/3] Imágenes…')
    for n, claves in IMAGENES.items():
        slide = prs.slides[n - 1]
        pics = _pictures(slide)
        if len(pics) < len(claves):
            informe['revisar'].append(f's{n}: esperaba {len(claves)} imagen(es) y hay {len(pics)}; no se tocó')
            continue
        # Si hay más imágenes grandes que exportables, se usan las de más abajo/arriba por orden.
        for clave, pic in zip(claves, pics):
            if clave not in imagenes:
                informe['revisar'].append(f's{n}: falta la imagen {clave}; quedó la de la semana anterior')
                continue
            print(f'  s{n}'); reemplazar_imagen(slide, pic, Path(imagenes[clave]), print)

    print('\n[3/3] Títulos y bullets…')
    H = TX.hechos(datos)
    for k, e in (H.get('_errores') or {}).items():
        informe['revisar'].append(f'cálculo {k} falló: {e}')
    actualizar_textos(prs, H, informe)

    prs.save(str(salida))
    rep = salida.with_suffix('.txt')
    with open(rep, 'w', encoding='utf-8') as f:
        f.write(f'Deck generado: {salida.name}\nBase: {base.name}\nDatos al: {datos["APP_DATA"].get("hoy")}\n\n')
        f.write(f'== REVISAR ({len(informe["revisar"])}) ==\n' + '\n'.join(informe['revisar']) + '\n\n')
        f.write(f'== FRASES MANUALES RESALTADAS ({len(informe["manual"])}) ==\n' + '\n'.join(informe['manual']) + '\n\n')
        f.write(f'== CIFRAS ACTUALIZADAS ({len(informe["cambios"])}) ==\n' + '\n'.join(informe['cambios']) + '\n')
    print(f'\n  LISTO: {salida.name}  ·  informe: {rep.name}')
    print(f'  {len(informe["cambios"])} bullets/títulos con cambios · {len(informe["manual"])} frases manuales resaltadas'
          f' · {len(informe["revisar"])} puntos a revisar')


if __name__ == '__main__':
    main()
