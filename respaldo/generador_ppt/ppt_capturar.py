"""
ppt_capturar.py — Abre el panel (index.html) en un navegador sin pantalla y saca
las imágenes que van en el PowerPoint ejecutivo, con el mismo botón «Exportar» de
cada tarjeta y en el estado (filtros, despliegues, región) con que se pegan en el deck.

No cambia nada del panel: reemplaza en la página la función hdEntregar, por donde
pasan todos los exportables, para quedarse con el PNG en vez de descargarlo.

Uso desde gen_ppt.py:  capturar(index_html, carpeta_salida) -> (imagenes, datos)
"""
from __future__ import annotations
import base64, json, os, re
from pathlib import Path

# Cada exportable: id → (botón o expresión JS, estado previo en JS, n° de página).
# La página sirve para los exportables de varias hojas: Vencimientos entrega 30 d,
# 90 d, 1 año y Perdidos, y en el deck va la de 90 días.
EXPORTABLES = {
    'analisis_fac':   dict(btn='rs-anal-pdf'),
    'garantias':      dict(btn='vg-gar-pdf-btn'),
    'garantias_lin':  dict(btn='vg-garl-pdf'),
    'brechas':        dict(btn='br-res-pdf'),
    'brecha_cli':     dict(btn='br-cli-pdf'),
    # Sólo los SKU que todavía hay que comprar: el «neto» de la slide 12.
    # El filtro nace apagado al cargar el panel y _brCmpF lo invierte: se llama una vez.
    'que_comprar':    dict(btn='br-cmp-pdf',
                           antes="if(!window._pptSoloCompra){window._brCmpF();window._pptSoloCompra=true}"),
    'eerr_res':       dict(btn='eerr-pdf-res-btn'),
    'eerr_mens':      dict(btn='eerr-pdf-btn'),
    'eerr_lim_res':   dict(btn='eerr-limpio-res-btn'),
    'eerr_lim_mens':  dict(btn='eerr-limpio-pdf-btn'),
    'casos_flujo':    dict(vista='casos', btn='cas-flujo-pdf'),
    'casos_equipo':   dict(vista='casos', btn='cas-eq-pdf'),
    'casos_marca':    dict(vista='casos', btn='cas-marca-pdf'),
    'casos_cliente':  dict(vista='casos', btn='cas-cli-pdf'),
    'casos_resumen':  dict(vista='casos', btn='cas-res-pdf'),
    'fill_rate':      dict(btn='cr-fr-pdf', vista='clirel', antes='window.crFill(99)', despues='window.crFill(80)'),
    # La fila «Perdidos (sin facturación actual)» va desplegada con sus clientes.
    'fac_tipo_cli':   dict(btn='pf-comp-exp', antes="if(_pcAbierta!=='perd') pcToggle('perd')"),
    'venc_90':        dict(btn='hz-pdf-btn', pagina=2),
    'satisfaccion':   dict(btn='sat-pdf-btn'),
    'bi_kpi':         dict(btn='pb-kpi-pdf', vista='prospbi'),
    'bi_heat_linea':  dict(btn='pb-heat-pdf', vista='prospbi', antes="window._pbHeatEje('linea')"),
    'bi_region':      dict(btn='pb-reg-pdf', vista='prospbi'),
    'bi_heat_region': dict(btn='pb-heat-pdf', vista='prospbi', antes="window._pbHeatEje('region')",
                           despues="window._pbHeatEje('linea')"),
    # Sólo el gráfico y su leyenda, como la captura original; sin btn para que el
    # botón «Exportar Excel» de la tarjeta no salga en la imagen diciendo «Generando…».
    'matriz':         dict(js="exportarPanel({ids:['bi-mx-box','bi-mx-leg'],"
                              "titulo:'Matriz de Prospección · % vida útil vs potencial ST anual',"
                              "archivo:'Matriz_prospeccion'})", vista='base'),
    # La curva toma el ancho de la pantalla: en el deck va apaisada, así que se
    # exporta con una ventana ancha.
    'conc_valpo':     dict(btn='bi-cv-pdf', ancho_vista=2560, antes="window._biCvReg('Valparaíso')",
                           despues="window._biCvReg('todas')"),
    'conc_rm':        dict(btn='bi-cv-pdf', ancho_vista=2560, antes="window._biCvReg('Metropolitana')",
                           despues="window._biCvReg('todas')"),
    'visitas_prog':   dict(btn='vp-prog-exp'),
    'visitas_dest':   dict(btn='vp-dest-exp'),
    'visitas_grupo':  dict(btn='vp-grp-exp'),
    'visitas_eje':    dict(btn='vp-eje-exp'),
    'visitas_mes':    dict(btn='vp-evo-exp'),
    'visitas_mapa':   dict(btn='vp-prog-mapa-exp'),
    'plan_gantt':     dict(btn='prm-gantt-pdf', vista='planrm'),
}

# Bloques del panel que se leen justo después de exportar, en el mismo estado, para
# sacar las cifras de los bullets: así el texto calza siempre con la imagen pegada.
LEER = {
    'analisis_fac':  ['rs-anal-card', 'rs-sem-card'],
    'garantias':     ['vg-gar-tabla'],
    'garantias_lin': ['vg-garl-tabla'],
    'brechas':       ['br-resumen'],
    'brecha_cli':    ['br-st-cli'],
    'que_comprar':   ['br-st-compras'],
    'eerr_res':      ['eerr-table'],
    'eerr_lim_res':  ['eerr-limpio-table'],
    'casos_flujo':   ['cas-flujo'],
    'casos_equipo':  ['cas-eq-tabla'],
    'casos_marca':   ['cas-marca-tabla'],
    'casos_cliente': ['cas-cli-tabla'],
    'fac_tipo_cli':  ['pf-comp-tabla'],
    'bi_kpi':        ['pb-kpi'],
    'bi_heat_linea': ['pb-heat'],
    'bi_region':     ['pb-reg-tabla'],
}

# Texto y celdas de cada tabla de un bloque, tal como se ven en pantalla.
_LEER_JS = """(ids) => { const out = {};
  ids.forEach(id => { const el = document.getElementById(id); if (!el) return;
    out[id] = { texto: el.innerText,
      tablas: [...el.querySelectorAll('table')].map(t => [...t.rows].map(r =>
        [...r.cells].map(c => c.innerText.replace(/\\s+/g, ' ').trim()))) }; });
  return out; }"""

# Captura: hdEntregar recibe el canvas ya dibujado; se guarda como PNG en memoria.
_HOOK = """
window.hdSalida = 'png';
window._pptCaps = [];
window.hdEntregar = async function (canvas, nombre) {
  window._pptCaps.push({ nombre: nombre, png: canvas.toDataURL('image/png'),
                         w: canvas.width, h: canvas.height });
};
window.alert = function (m) { window._pptAlert = String(m); };
"""

# Vista a la que pertenece un botón: el .view que lo contiene.
_VISTA_DE = """(id) => { const b = document.getElementById(id);
  const v = b && b.closest('.view'); return v ? v.id.replace(/^view-/, '') : null; }"""

_IR_A = """(v) => { const nb = [...document.querySelectorAll('.nb')]
    .find(b => (b.getAttribute('onclick') || '').indexOf("'" + v + "'") >= 0);
  if (typeof sv === 'function' && document.getElementById('view-' + v)) sv(v, nb || document.createElement('button')); }"""

# Datos que usan los bullets: todo lo que el panel tiene cargado.
_DATOS = """() => JSON.parse(JSON.stringify({
  APP_DATA: window.APP_DATA, DATA: (typeof DATA !== 'undefined') ? DATA : null,
  ALERTA_DATA: window.ALERTA_DATA || null, CASOS_DATA: window.CASOS_DATA || null,
  MAPA_DATA: window.MAPA_DATA || null,
  NC_DATA: (typeof NC_DATA !== 'undefined') ? NC_DATA : null,
  PERDIDOS_VG: (typeof PERDIDOS_VG !== 'undefined') ? PERDIDOS_VG : null,
  MES_CORTE: (typeof MES_CORTE !== 'undefined') ? MES_CORTE : null }))"""


def capturar(index_html: str | Path, salida: str | Path, solo: list[str] | None = None,
             log=print) -> tuple[dict, dict]:
    from playwright.sync_api import sync_playwright
    salida = Path(salida); salida.mkdir(parents=True, exist_ok=True)
    imagenes, errores, tablas = {}, {}, {}
    with sync_playwright() as p:
        try:
            br = p.chromium.launch(channel='msedge')
        except Exception:
            br = p.chromium.launch(channel='chrome')
        pg = br.new_page(viewport={'width': 1600, 'height': 1000})
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto(Path(index_html).resolve().as_uri())
        pg.wait_for_function("() => window.APP_DATA && typeof exportarPanel === 'function'", timeout=60000)
        pg.wait_for_timeout(2500)
        pg.evaluate(_HOOK)
        datos = pg.evaluate(_DATOS)

        for clave, job in EXPORTABLES.items():
            if solo and clave not in solo:
                continue
            try:
                pg.set_viewport_size({'width': job.get('ancho_vista', 1600), 'height': 1000})
                vista = job.get('vista') or (pg.evaluate(_VISTA_DE, job['btn']) if job.get('btn') else None)
                if vista:
                    pg.evaluate(_IR_A, vista)
                    pg.wait_for_timeout(1500)
                if job.get('antes'):
                    pg.evaluate(job['antes']); pg.wait_for_timeout(600)
                n0 = pg.evaluate('window._pptCaps.length')
                pg.evaluate("window._pptAlert = null")
                if job.get('btn'):
                    pg.evaluate("(id) => document.getElementById(id).click()", job['btn'])
                else:
                    pg.evaluate(job['js'])
                pag = job.get('pagina', 1)
                pg.wait_for_function(f"() => window._pptCaps.length >= {n0 + pag} || window._pptAlert",
                                     timeout=120000)
                pg.wait_for_timeout(300)
                al = pg.evaluate('window._pptAlert')
                if al:
                    raise RuntimeError(al)
                # Un exportable de varias páginas sigue entregando después de la que se usa:
                # se espera a que termine, o sus páginas se cuelan en el exportable siguiente.
                _esperar_fin(pg)
                cap = pg.evaluate(f'window._pptCaps[{n0 + pag - 1}]')
                f = salida / f'{clave}.png'
                f.write_bytes(base64.b64decode(cap['png'].split(',', 1)[1]))
                imagenes[clave] = str(f)
                log(f'  imagen {clave:15} {cap["w"]}x{cap["h"]}')
                # Las capturas ya usadas no hacen falta en memoria.
                pg.evaluate('window._pptCaps = window._pptCaps.map(c => ({nombre: c.nombre}))')
                if clave in LEER:
                    tablas[clave] = pg.evaluate(_LEER_JS, LEER[clave])
                if job.get('despues'):
                    pg.evaluate(job['despues'])
            except Exception as e:
                errores[clave] = str(e)[:300]
                log(f'  ERROR {clave}: {errores[clave]}')
        br.close()
    datos['_errores_captura'] = errores
    datos['tablas'] = tablas
    return imagenes, datos


def _esperar_fin(pg, quieto_ms=2000, max_ms=90000):
    """Hasta que pasen quieto_ms sin capturas nuevas."""
    n, quieto, t = pg.evaluate('window._pptCaps.length'), 0, 0
    while quieto < quieto_ms and t < max_ms:
        pg.wait_for_timeout(250); t += 250
        m = pg.evaluate('window._pptCaps.length')
        quieto = 0 if m != n else quieto + 250
        n = m


if __name__ == '__main__':
    import sys
    raiz = Path(__file__).resolve().parent.parent
    solo = sys.argv[1:] or None
    out = Path(os.environ.get('TEMP', '.')) / 'ppt_capturas'
    im, d = capturar(raiz / 'index.html', out, solo)
    previo = out / 'datos.json'
    if solo and previo.exists():
        # Recaptura parcial: se conservan las tablas de los exportables que no se tocaron.
        viejo = json.loads(previo.read_text(encoding='utf-8'))
        viejo.setdefault('tablas', {}).update(d['tablas'])
        viejo['_errores_captura'] = {k: v for k, v in viejo.get('_errores_captura', {}).items() if k not in solo}
        viejo['_errores_captura'].update(d['_errores_captura'])
        d = viejo
    previo.write_text(json.dumps(d, ensure_ascii=False), encoding='utf-8')
    print(len(im), 'imágenes ·', len(d['_errores_captura']), 'errores')
