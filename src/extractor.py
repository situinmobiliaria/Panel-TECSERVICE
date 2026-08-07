#!/usr/bin/env python3
"""
extractor.py — Genera dashboard_contratos_v16.2.html directamente desde Excel.

Uso:
    python extractor.py

Requiere:
    pip install openpyxl pandas

Configuración:
    Editar la sección CONFIG si cambia el presupuesto anual o el nombre del Excel.
"""
from __future__ import annotations
import os, re, json, math
from datetime import date, datetime, timedelta
from collections import defaultdict

import openpyxl
import pandas as pd

def _xlsb_to_xlsx(xlsb_path):
    """Convierte .xlsb a .xlsx temporal usando Excel COM. Retorna la ruta del xlsx generado."""
    import win32com.client, shutil, tempfile
    # Nombre único por corrida: evita PermissionError si una corrida previa
    # dejó el archivo bloqueado por un proceso Excel colgado.
    tmp_dir  = tempfile.gettempdir()
    tmp_path = os.path.join(tmp_dir, f"panel_ts_conv_{os.getpid()}.xlsx")
    # Limpiar conversiones viejas que ya no estén bloqueadas
    for f in os.listdir(tmp_dir):
        if f.startswith("panel_ts_conv") and f.endswith(".xlsx"):
            try: os.remove(os.path.join(tmp_dir, f))
            except OSError: pass
    print(f"  Convirtiendo {os.path.basename(xlsb_path)} con Excel COM ...")
    excel = None
    wb_com = None
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        try: excel.Visible = False
        except Exception: pass
        excel.DisplayAlerts = False
        excel.AskToUpdateLinks = False
        wb_com = excel.Workbooks.Open(
            os.path.abspath(xlsb_path),
            UpdateLinks=0, ReadOnly=True
        )
        wb_com.SaveAs(tmp_path, FileFormat=51)  # 51 = xlOpenXMLWorkbook
        print(f"  Conversion completada -> {tmp_path}")
        return tmp_path
    finally:
        if wb_com:
            try: wb_com.Close(False)
            except: pass
        if excel:
            try: excel.Quit()
            except: pass

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — editar aquí si cambia algo
# ══════════════════════════════════════════════════════════════════════════════
DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DIR)
_BASE_NAME = "CONTRATOS -FACTURACION -SATISFACCION -VISITAS"
XLSX  = os.path.join(ROOT, "data", _BASE_NAME + ".xlsx")
XLSB  = os.path.join(ROOT, "data", _BASE_NAME + ".xlsb")
TMPL  = os.path.join(DIR, "template.html")
OUT   = os.path.join(DIR, "dashboard_contratos_v16.2.html")

PPTO_ANUAL_TOTAL = 2_724_000_000   # Presupuesto anual total del área (CLP)

EJECUTIVOS_VISITAS = ["Eglys Ramirez", "Cristian Perez"]

# IMPORTANTE: esta lista debe estar sincronizada con $jsFiles en build.ps1.
# Si un archivo falta aquí, esa hoja simplemente no existe en el standalone
# (dashboard_contratos_v16.2.html) aunque sí funcione en index.html. Faltaban
# base_instalada, mapa, matriz, casos y pdf, así que esas 5 hojas nunca se
# generaron en el standalone. main() ahora avisa si las listas divergen.
JS_FILES = [
    "utils.js", "datos.js", "hoja_resumen.js", "hoja_tipos.js", "hoja_nuevos.js",
    "hoja_vencimientos.js", "hoja_vision.js", "hoja_presupuesto.js",
    "hoja_facturacion.js", "hoja_panelfact.js", "hoja_base_instalada.js", "hoja_satisfaccion.js",
    "hoja_visitas.js", "hoja_mapa.js", "hoja_matriz.js", "hoja_casos.js", "hoja_alerta.js",
    "hoja_pdf.js", "hoja_eerr.js", "hoja_desglose.js", "hoja_inv_ts.js", "hoja_rep_vend.js",
    "hoja_brechas.js",
]

ANO   = date.today().year
TODAY = date.today()

# ══════════════════════════════════════════════════════════════════════════════
# Clasificación de contratos por línea de negocio (Esterilización = base/default).
# Fuente Dental: Excel "CONTRATOS DENTAL" (col Línea de Negocio = DENTAL) al 2026-07-17.
# Fuente Endoscopía: listado "Contratos Vigentes ENDO" al 2026-07-15.
# Si se agregan nuevos contratos Dental/Endoscopía, sumar aquí su número de contrato.
# ══════════════════════════════════════════════════════════════════════════════
DENTAL_CONTRATOS_NUMS = {
    163, 194, 192, 193, 213, 221, 222, 139, 160, 165, 164, 206,
    188, 232, 251, 170, 181, 183, 199, 238, 146, 187,
}
ENDOSCOPIA_CONTRATOS_NUMS = {200, 198, 142, 237}

# NOTA (2026-07-19): #198 (HUAP) y #200 (Intermedical) tienen en CONTRATOS
# TODOS fechas/Estado desactualizados (figuran Expirado, con fin 30/04/2026 y
# 31/05/2026). Cristián confirmó explícitamente que las fechas correctas son
# las del listado "Contratos Vigentes ENDO" (imagen, 2026-07-15), no las del
# Excel. Se sobreescriben inicio/fin/estado con esos valores hasta que
# CONTRATOS TODOS se actualice en la fuente (ver SUPUESTOS.txt, punto 2).
CONTRATO_OVERRIDE = {
    198: {"inicio": date(2024, 10, 31), "fin": date(2026, 10, 31), "estado": "Activado"},  # HUAP Endoscopía
    200: {"inicio": date(2026, 7, 8),   "fin": date(2027, 7, 31),  "estado": "Activado"},  # Intermedical Endoscopía
}

# Marcas con facturación propia relevante dentro del catálogo "Servicio Técnico"
# no ligado a contrato; el resto se agrupa en "Otras Marcas".
TOP_MARCAS_DESGLOSE = ["TECSERVICE", "NACIONAL", "ICTGROUP", "STEELCO", "PENTAX MEDICAL"]

def linea_negocio_contrato(num_str):
    try:
        n = int(num_str)
    except (TypeError, ValueError):
        return "Esterilización"
    if n in DENTAL_CONTRATOS_NUMS:
        return "Dental"
    if n in ENDOSCOPIA_CONTRATOS_NUMS:
        return "Endoscopía"
    return "Esterilización"

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def to_float(val, default=0.0):
    try:
        if val is None:
            return default
        if isinstance(val, float) and math.isnan(val):
            return default
        return float(val)
    except Exception:
        return default

def to_int(val, default=0):
    try:
        return int(val) if val is not None else default
    except Exception:
        return default

def safe_str(val):
    return str(val).strip() if val is not None else ""

def _bi_total(val):
    """Convierte el valor de BI Total; retorna None si es N/A o vacío."""
    if val is None:
        return None
    if isinstance(val, str) and val.strip().upper() in ('#N/A', '', 'N/A', '#REF!', '#VALUE!', '#NUM!'):
        return None
    try:
        result = int(float(val))
        return result if result > 0 else None
    except Exception:
        return None

def parse_date(val):
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(val[:len(fmt)], fmt).date()
            except Exception:
                pass
    return None

_MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

def formato_actualizacion(dt):
    """'Última actualización: 19 de julio 2026 · 02:50 am' a partir de un datetime."""
    mes = _MESES_LARGO[dt.month - 1]
    hora12 = dt.hour % 12 or 12
    ampm = "am" if dt.hour < 12 else "pm"
    return f"Última actualización: {dt.day} de {mes} {dt.year} · {hora12:02d}:{dt.minute:02d} {ampm}"

# ══════════════════════════════════════════════════════════════════════════════
# 1. HOJA: CONTRATOS TODOS
#    Fila 1 = números de mes (cabecera auxiliar)
#    Fila 2 = encabezados de columna
#    Fila 3+ = datos
#
#    Columnas relevantes (índice 0-based):
#    0=Coordinador  1=Vendedor  3=N°Contrato  4=Cliente  5=Garantia
#    6=FechaInicio  8=FechaFin  10=Estado
#    13-24 = flags Fact Ene–Dic
#    27=ValMes(CLP)  29=ValAnual2026  32=RealYTD2026  33=Real2025  34=Real2024
# ══════════════════════════════════════════════════════════════════════════════
def read_contratos(wb):
    ws = wb["CONTRATOS TODOS"]
    contratos = []
    last_coord   = ""
    last_vendedor = ""

    for row in ws.iter_rows(min_row=3, values_only=True):
        num_str = safe_str(row[3])
        if not num_str:
            continue

        # Forward-fill merged coordinator / vendedor cells
        coord_raw    = safe_str(row[0])
        vendedor_raw = safe_str(row[1])
        if coord_raw:
            last_coord = coord_raw
        if vendedor_raw:
            last_vendedor = vendedor_raw

        cliente = safe_str(row[4])
        if not cliente:
            continue

        es_garantia  = safe_str(row[5]).upper() in ("TRUE", "VERDADERO", "1")
        fecha_inicio = parse_date(row[6])
        fecha_fin    = parse_date(row[8])
        estado       = safe_str(row[10])   # "Activado" / "Expirado"
        try:
            override = CONTRATO_OVERRIDE.get(int(num_str))
        except ValueError:
            override = None
        if override:
            fecha_inicio = override["inicio"]
            fecha_fin    = override["fin"]
            estado       = override["estado"]

        if not fecha_inicio or not fecha_fin:
            continue

        # Billing flags per month (columns N–Y = indices 13–24)
        fact_flags = [bool(row[13 + m]) for m in range(12)]

        cuota_uf  = to_float(row[25])   # Z:  Facturación Cuota UF
        val_mes   = to_float(row[27])   # AB: Facturación Neta Mes convertido
        n_mant    = to_int(row[28])     # AC: N° mantenimientos esperados año
        val_anual = to_float(row[29])   # AE: Facturación Anual Esperada 2026
        if val_anual == 0:
            val_anual = val_mes * n_mant if n_mant >= 1 else val_mes  # fallback si col AE vacía
        n_mant_actual = to_int(row[31])   # AF: N° Mantenimientos a la Fecha 2026
        real_ytd  = to_float(row[32])   # AG: Facturación Contratos 2026 YTD
        real_2025 = to_float(row[33])   # AH
        real_2024 = to_float(row[34])   # AI
        # AJ (idx 35): tipo de programa (Basic/Advanced/Profesional/Integral Care Program)
        prog_raw  = row[35] if len(row) > 35 else None
        programa  = safe_str(prog_raw).replace('​','').strip() if prog_raw else ""
        # AK (idx 36): flag "FACTURACIÓN < CONTRATOS" (SI/NO)
        bajo_contrato = safe_str(row[36]).strip().upper() if len(row) > 36 and row[36] else ""

        dias_vence    = (fecha_fin - TODAY).days
        long_dias     = max(1, (fecha_fin - fecha_inicio).days)
        tpo_activo    = max(0, (TODAY - fecha_inicio).days)
        pct_consumido = round(tpo_activo / long_dias * 100, 1)

        contratos.append({
            "n":            num_str,
            "cliente":      cliente,
            "coord":        last_coord,
            "vendedor":     last_vendedor,
            "tipo":         "Garantia" if es_garantia else "Comercial",
            "inicio":       fecha_inicio.isoformat(),
            "fin":          fecha_fin.isoformat(),
            "inicio_fmt":   fecha_inicio.strftime("%d/%m/%Y"),
            "fin_fmt":      fecha_fin.strftime("%d/%m/%Y"),
            "val":          val_anual,
            "cuota_uf":     cuota_uf,
            "val_mes":      val_mes,
            "n_mant":       n_mant,
            "fact_flags":   fact_flags,   # internal, excluded from DATA output
            "real_ytd":     real_ytd,
            "real_2025":    real_2025,
            "real_2024":    real_2024,
            "dias_vence":   dias_vence,
            "long_dias":    long_dias,
            "tpo_activo":   tpo_activo,
            "pct_consumido": pct_consumido,
            "es_nuevo":     tpo_activo <= 90,
            "n_mant_actual":  n_mant_actual,
            "estado":         estado,
            "programa":       programa,
            "linea_negocio":  linea_negocio_contrato(num_str),
            "bajo_contrato":  bajo_contrato,
            "dias_inicio_cli": tpo_activo,
        })

    # Eliminar duplicados por número de contrato (filas ocultas/filtradas en Excel)
    seen = {}
    for c in contratos:
        key = c["n"]
        if key not in seen:
            seen[key] = c
        else:
            # Si el duplicado está Activado y el existente no, reemplazar
            if c["estado"] == "Activado" and seen[key]["estado"] != "Activado":
                seen[key] = c
    duplicados = len(contratos) - len(seen)
    if duplicados > 0:
        print(f"       ADVERTENCIA: {duplicados} contrato(s) duplicado(s) eliminado(s) de CONTRATOS TODOS")
    contratos_final = list(seen.values())

    # "es_nuevo" no debe depender sólo de la fecha de inicio del contrato: si
    # el cliente ya tenía OTRO contrato (cualquier estado) antes de éste, no es
    # un cliente nuevo, es una renovación/continuación bajo otro N° de contrato.
    primer_inicio_cliente = {}
    for c in contratos_final:
        cli = c["cliente"]
        if cli not in primer_inicio_cliente or c["inicio"] < primer_inicio_cliente[cli]:
            primer_inicio_cliente[cli] = c["inicio"]
    for c in contratos_final:
        c["es_nuevo"] = c["tpo_activo"] <= 90 and c["inicio"] == primer_inicio_cliente[c["cliente"]]

    # Un contrato "Activado" cuya fecha de término ya pasó, pero que tiene un
    # sucesor claro del mismo cliente (otro contrato que empieza dentro de una
    # ventana de 30 días desde ese término y termina más tarde), se considera
    # superado: el sucesor es "el que vale" y éste pasa a histórico (Estado ->
    # Expirado) para no contarlo en cartera activa, presupuesto ni Vencimientos.
    contratos_por_cliente_tmp = defaultdict(list)
    for c in contratos_final:
        contratos_por_cliente_tmp[c["cliente"]].append(c)
    superados = 0
    for c in contratos_final:
        if c["estado"] != "Activado":
            continue
        c_fin = date.fromisoformat(c["fin"])
        if c_fin >= TODAY:
            continue  # todavía no vence
        for otro in contratos_por_cliente_tmp[c["cliente"]]:
            if otro is c:
                continue
            o_fin = date.fromisoformat(otro["fin"])
            if o_fin <= c_fin:
                continue  # no extiende cobertura más allá de c
            o_inicio = date.fromisoformat(otro["inicio"])
            if abs((o_inicio - c_fin).days) <= 30:
                c["estado"] = "Expirado"
                superados += 1
                break
    if superados > 0:
        print(f"       {superados} contrato(s) vencido(s) marcados como histórico (tenían sucesor claro)")

    return contratos_final


# ══════════════════════════════════════════════════════════════════════════════
# 2. HOJA: FACTURACIÓN
#    Fila 1 = encabezados, Fila 2+ = datos
#    0=Cliente  1=NombreFact  2=Total2026  3=Total2025  4=Total2024
#    6=Contr2026  7=Contr2025  8=Contr2024
#    14=PrimeraVez  15=Renovo  16=NoContinuo  17=NContratos
# ══════════════════════════════════════════════════════════════════════════════
def read_facturacion(wb):
    ws = wb["FACTURACION"]
    panel = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        cliente = safe_str(row[0])
        if not cliente:
            continue

        # Col[2] = NombreAnalisis — nombre normalizado que coincide con BBDD col H
        nombre_analisis = safe_str(row[2]) or cliente

        # Col[3] = Total2026, Total2026 se desplazó a col[3]
        real_ytd   = to_float(row[3])
        real_2025  = to_float(row[4])
        real_2024  = to_float(row[5])
        contr_2026 = to_float(row[7])   # Columna H (Contr2026 YTD)
        # AZ-BK (idx 51-62): facturación contratos mes a mes 2026
        contr_meses = [to_float(row[51 + m]) if len(row) > 51 + m else 0.0 for m in range(12)]
        # BL (idx 63): flag "FACTURACIÓN < CONTRATOS" (SI/NO)
        fac_menor_contr = safe_str(row[63]).strip().upper() == "SI" if len(row) > 63 and row[63] else False
        n_contratos = to_int(row[18])   # desplazado por columna nueva

        primera_vez = safe_str(row[15]).upper() == "SI"  # desplazado
        renovo      = safe_str(row[16]).upper() == "SI"  # desplazado
        no_continuo = safe_str(row[17]).upper() == "SI"  # desplazado

        if primera_vez:
            estado_rel = "Nuevo"
        elif renovo:
            estado_rel = "Renovado"
        elif no_continuo:
            estado_rel = "Perdido"
        elif n_contratos > 0:
            estado_rel = "Con contrato"
        else:
            estado_rel = "Sin contrato"

        panel.append({
            "cliente":           cliente,
            "nombre_analisis":   nombre_analisis,   # key para lookup en BBDD
            "coord":             "Sin contrato",    # filled later from CONTRATOS
            "tipo_cli":          "Privado",          # filled later from BBDD
            "real_ytd":          real_ytd,
            "real_anual_2026":   real_ytd,           # YTD = mejor proxy para año en curso
            "real_anual_2025":   real_2025,
            "real_anual_2024":   real_2024,
            "real_ytd_2025":     0,                  # filled later from BBDD
            "real_ytd_2024":     0,
            "presup_contr_anio": 0,                 # filled later from CONTRATOS
            "presup_contr_ytd":  contr_2026,
            "contr_meses_2026":  contr_meses,
            "_fac_menor_contr":  fac_menor_contr,
            "n_contratos":       n_contratos,
            "tiene_contrato":    (n_contratos > 0) and not no_continuo,
            "estado_relacion":   estado_rel,
            "_no_continuo":      no_continuo,       # internal flag
        })

    return panel


# ══════════════════════════════════════════════════════════════════════════════
# 3. HOJA: BBDD FACTURACION (pandas — 32k+ filas)
#    Columnas clave (1-indexed en Excel → 0-indexed en pandas):
#    H(7)=NombreCliente  S(18)=TotalLineaVenta  AM(38)=Mes  AO(40)=Año
#    AR(43)=Empresa2  AT(45)=TipoCliente  AU(46)=LineaDeNegocio
# ══════════════════════════════════════════════════════════════════════════════
def read_bbdd(xlsx_path):
    print("  Leyendo BBDD FACTURACION con pandas (puede tardar ~15 s)...")
    df = pd.read_excel(xlsx_path, sheet_name="Facturacion a Fecha", header=0)

    cols = df.columns.tolist()
    # Access by position to avoid encoding issues in header names
    c_cliente   = cols[7]    # H
    c_monto     = cols[18]   # S: Total Linea Venta
    c_catalogo  = cols[36]   # AK: Catálogo
    c_tipodoc   = cols[37]   # AL: Tipo documento (Factura / Nota de crédito / etc.)
    c_mes       = cols[38]   # AM
    c_ano       = cols[40]   # AO
    c_emp2      = cols[43]   # AR: Empresa 2
    c_tipocli   = cols[45]   # AT: Tipo Cliente
    c_linea     = cols[46]   # AU: Linea de Negocio
    c_ejecutivo = cols[50] if len(cols) > 50 else None  # AY: Ejecutivo

    # Filter Tecservice rows
    df_ts = df[df[c_emp2].astype(str).str.strip() == "TS"].copy()

    df_ts[c_monto] = pd.to_numeric(df_ts[c_monto], errors="coerce").fillna(0)
    df_ts[c_mes]   = pd.to_numeric(df_ts[c_mes],   errors="coerce")
    df_ts[c_ano]   = pd.to_numeric(df_ts[c_ano],   errors="coerce")
    df_ts = df_ts.dropna(subset=[c_mes, c_ano])
    df_ts[c_mes] = df_ts[c_mes].astype(int)
    df_ts[c_ano] = df_ts[c_ano].astype(int)

    # tipo_cli_map: last known sector per client
    tipo_map = (
        df_ts[df_ts[c_tipocli].notna()]
        .groupby(c_cliente)[c_tipocli]
        .last()
        .to_dict()
    )

    # Helper: build {year: {month: total}} dict from a sub-dataframe
    def monthly_dict(sub):
        result = {}
        for (ano, mes), grp in sub.groupby([c_ano, c_mes]):
            result.setdefault(int(ano), {})[int(mes)] = float(grp[c_monto].sum())
        return result

    mensual_total   = monthly_dict(df_ts)
    df_priv         = df_ts[df_ts[c_tipocli].astype(str).str.strip() == "Privado"]
    df_pub          = df_ts[df_ts[c_tipocli].astype(str).str.strip() == "Público"]
    df_nocontr      = df_ts[df_ts[c_linea].astype(str).str.strip() == "Ingresos No Recurrentes"]
    df_contr        = df_ts[df_ts[c_linea].astype(str).str.strip() != "Ingresos No Recurrentes"]

    mensual_priv    = monthly_dict(df_priv)
    mensual_pub     = monthly_dict(df_pub)
    mensual_contr   = monthly_dict(df_contr)
    mensual_nocontr = monthly_dict(df_nocontr)

    # Facturación mensual filtrada: solo Facturas + catálogos ST/Trazabilidad/REAS
    # Mismos filtros que el desglose por ejecutivo pero sin desagregar
    _CATALOGOS_FAC = {"Servicio Técnico", "Trazabilidad", "REAS"}
    df_ts[c_tipodoc]  = df_ts[c_tipodoc].astype(str).str.strip()
    df_ts[c_catalogo] = df_ts[c_catalogo].astype(str).str.strip()
    df_facturado = df_ts[
        (df_ts[c_tipodoc]  == "Factura") &
        (df_ts[c_catalogo].isin(_CATALOGOS_FAC))
    ].copy()
    mensual_facturado = monthly_dict(df_facturado)

    # Desglose "Otros Ingresos" del año actual: Trazabilidad / REAS / Marca (dentro de Servicio Técnico)
    # Usado por la sección "Desglose de Ingresos" (ver compute_desglose_ingresos)
    c_marca = cols[11]  # L: Marca
    df_fac_ano = df_facturado[df_facturado[c_ano] == ANO]

    def monthly_arr_12(sub):
        arr = [0.0] * 12
        for mes, grp in sub.groupby(c_mes):
            if 1 <= mes <= 12:
                arr[mes - 1] = float(grp[c_monto].sum())
        return arr

    traz_mensual = monthly_arr_12(df_fac_ano[df_fac_ano[c_catalogo] == "Trazabilidad"])
    reas_mensual = monthly_arr_12(df_fac_ano[df_fac_ano[c_catalogo] == "REAS"])

    df_st_ano = df_fac_ano[df_fac_ano[c_catalogo] == "Servicio Técnico"].copy()
    df_st_ano[c_marca] = df_st_ano[c_marca].astype(str).str.strip()
    marca_mensual = {
        marca: monthly_arr_12(grp)
        for marca, grp in df_st_ano.groupby(c_marca)
    }
    st_total_mensual = monthly_arr_12(df_st_ano)

    # Facturación mensual por ejecutivo (columna AY)
    # Usa df_facturado (ya filtrado) restringido al año actual
    mensual_por_ejecutivo = {}
    if c_ejecutivo:
        df_ts[c_ejecutivo] = df_ts[c_ejecutivo].astype(str).str.strip()
        df_eje_base = df_facturado[df_facturado[c_ano] == ANO].copy()
        ejecutivos = [e for e in df_eje_base[c_ejecutivo].unique()
                      if isinstance(e, str) and e.strip().lower() not in ("nan", "none", "")]
        for eje in ejecutivos:
            df_eje = df_eje_base[df_eje_base[c_ejecutivo] == eje]
            mensual_por_ejecutivo[eje] = monthly_dict(df_eje)

    # MES_CORTE: mes calendario actual (dinámico)
    mes_corte = TODAY.month

    # YTD per client: solo Facturas + catálogos ST/REAS/Trazabilidad
    _CATALOGOS_YTD = {"Servicio Técnico", "REAS", "Trazabilidad"}
    df_ytd_base = df_ts[
        (df_ts[c_tipodoc] == "Factura") &
        df_ts[c_catalogo].isin(_CATALOGOS_YTD)
    ]

    def ytd_per_cli(year, max_mes):
        sub = df_ytd_base[(df_ytd_base[c_ano] == year) & (df_ytd_base[c_mes] <= max_mes)]
        return sub.groupby(c_cliente)[c_monto].sum().to_dict()

    ytd_cli_2025 = ytd_per_cli(ANO - 1, mes_corte)
    ytd_cli_2024 = ytd_per_cli(ANO - 2, mes_corte)

    # YTD contratos 2024/2025: Vendedor (col T) empieza con "ST"
    c_vendedor = cols[19]
    df_ytd_base = df_ytd_base.copy()
    df_ytd_base[c_vendedor] = df_ytd_base[c_vendedor].astype(str).str.strip().str.upper()
    df_ytd_contr = df_ytd_base[df_ytd_base[c_vendedor].str.startswith("ST")]

    def ytd_contr_total(year, max_mes):
        sub = df_ytd_contr[(df_ytd_contr[c_ano] == year) & (df_ytd_contr[c_mes] <= max_mes)]
        return float(sub[c_monto].sum())

    ytd_contr_2024 = ytd_contr_total(ANO - 2, mes_corte)
    ytd_contr_2025 = ytd_contr_total(ANO - 1, mes_corte)

    # Monthly billing per client for current year (same filters as df_fac_ano)
    mensual_por_cliente = {}
    for cli_k, grp in df_fac_ano.groupby(c_cliente):
        s = str(cli_k).strip()
        if not s or s.lower() in ("nan", "none"):
            continue
        a = [0.0] * 12
        for m_val, sub in grp.groupby(c_mes):
            mi = int(m_val) - 1
            if 0 <= mi < 12:
                a[mi] = float(sub[c_monto].sum())
        mensual_por_cliente[s] = a

    return {
        "mensual_total":         mensual_total,
        "mensual_facturado":     mensual_facturado,
        "traz_mensual":          traz_mensual,
        "reas_mensual":          reas_mensual,
        "marca_mensual":         marca_mensual,
        "st_total_mensual":      st_total_mensual,
        "mensual_priv":          mensual_priv,
        "mensual_pub":           mensual_pub,
        "mensual_contr":         mensual_contr,
        "mensual_nocontr":       mensual_nocontr,
        "mensual_por_ejecutivo": mensual_por_ejecutivo,
        "tipo_cli_map":          tipo_map,
        "ytd_cli_2025":          ytd_cli_2025,
        "ytd_cli_2024":          ytd_cli_2024,
        "ytd_contr_2024":        ytd_contr_2024,
        "ytd_contr_2025":        ytd_contr_2025,
        "mes_corte":             mes_corte,
        "mensual_por_cliente":   mensual_por_cliente,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 4. HOJA: VISITAS
#    0=Asignado  2=Fecha  3=Cliente  6=TipoActividad  8=Conteo  9=Mes  10=Año
# ══════════════════════════════════════════════════════════════════════════════
def read_visitas(wb, mes_corte):
    ws = wb["VISITAS"]

    mensual        = {e: {str(ANO - 1): [0] * 12, str(ANO): [0] * 12} for e in EJECUTIVOS_VISITAS}
    tipo_acts      = {e: defaultdict(int) for e in EJECUTIVOS_VISITAS}
    cli_count_ytd  = {e: defaultdict(int) for e in EJECUTIVOS_VISITAS}
    cli_count_all  = {e: defaultdict(int) for e in EJECUTIVOS_VISITAS}
    unique_2026    = {e: set() for e in EJECUTIVOS_VISITAS}
    unique_2025_ytd = {e: set() for e in EJECUTIVOS_VISITAS}
    # Visitas mensuales por ejecutivo + cliente (para gráfico de búsqueda)
    cli_mensual    = {e: defaultdict(lambda: {str(ANO-1): [0]*12, str(ANO): [0]*12})
                      for e in EJECUTIVOS_VISITAS}

    for row in ws.iter_rows(min_row=2, values_only=True):
        asignado = safe_str(row[0])
        if asignado not in EJECUTIVOS_VISITAS:
            continue

        tipo_act = safe_str(row[6])
        cliente  = safe_str(row[3])
        conteo   = to_int(row[8], 1)
        mes      = to_int(row[9], 0)
        ano      = to_int(row[10], 0)

        if not (1 <= mes <= 12) or not ano:
            continue

        ano_str = str(ano)
        if ano_str in mensual[asignado]:
            mensual[asignado][ano_str][mes - 1] += conteo
            cli_mensual[asignado][cliente][ano_str][mes - 1] += conteo

        tipo_acts[asignado][tipo_act] += conteo
        cli_count_all[asignado][cliente] += conteo

        if ano == ANO and mes <= mes_corte:
            cli_count_ytd[asignado][cliente] += conteo
            unique_2026[asignado].add(cliente)

        if ano == ANO - 1 and mes <= mes_corte:
            unique_2025_ytd[asignado].add(cliente)

    # Build resumen
    resumen = {}
    for e in EJECUTIVOS_VISITAS:
        tot_2025 = sum(mensual[e][str(ANO - 1)])
        tot_2026 = sum(mensual[e][str(ANO)])
        ytd_2026 = sum(mensual[e][str(ANO)][:mes_corte])
        ytd_2025_mismo = sum(mensual[e][str(ANO - 1)][:mes_corte])
        resumen[e] = {
            "total":              tot_2025 + tot_2026,
            "tot_2025":           tot_2025,
            "tot_2026":           tot_2026,
            "tot_2026_ytd":       ytd_2026,
            "tot_2025_ytd_mismo": ytd_2025_mismo,
            "clientes_unicos_2026": len(unique_2026[e]),
        }

    # Top 10 clients by YTD visits
    top = {}
    for e in EJECUTIVOS_VISITAS:
        sorted_cli = sorted(cli_count_ytd[e].items(), key=lambda x: -x[1])[:10]
        top[e] = [{"cliente": c, "n": n} for c, n in sorted_cli]

    # Convertir cli_mensual (defaultdict anidado) a dict serializable
    cli_mensual_out = {}
    for e in EJECUTIVOS_VISITAS:
        cli_mensual_out[e] = {cli: dict(meses) for cli, meses in cli_mensual[e].items()}

    return {
        "mensual":     {e: dict(mensual[e]) for e in EJECUTIVOS_VISITAS},
        "tipo":        {e: dict(tipo_acts[e]) for e in EJECUTIVOS_VISITAS},
        "resumen":     resumen,
        "top":         top,
        "cli_mensual": cli_mensual_out,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 5. HOJA: SATISFACCION
#    0=Version  6=Estado  7=Nombre  8=Correo  9=Institucion
#   10=Calidad(0-7)  11=Resuelto  12=Tiempo(0-7)  13=Recomendacion(0-10)
#   14=Comentario  15=NombreAnalisis  16=NombreBI  17=BITotal
# ══════════════════════════════════════════════════════════════════════════════

# Correcciones de nombres con errores tipográficos o versiones abreviadas
_NOMBRE_FIXES = {
    "CLINIDA VAILA VESPUCIO":         "CLINICA DAVILA VESPUCIO",
    "HOSPITAL BARROS LUCO":           "HOSPITAL BARROS LUCO TRUDEAU",
    "HOSPITAL SAN LUIS DE BUIN":      "HOSPITAL SAN LUIS DE BUIN PAINE",
    "HOSPITAL SAN LUIS DE BUIN PAINE.": "HOSPITAL SAN LUIS DE BUIN PAINE",
}

_PERSONAL_DOMAINS = {
    "gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "live.com",
    "icloud.com", "yahoo.es", "hotmail.es", "protonmail.com", "desconocido",
}

def _dom_cat(dom):
    if "gob.cl" in dom or ".gob." in dom:
        return "Sector Público"
    if dom in _PERSONAL_DOMAINS:
        return "Correo personal"
    return "Sector Privado"


def read_satisfaccion(wb):
    # Leer mapa de nombres normalizados
    ws_map = wb["Nombre Satisfacción"]
    nombre_map = {}
    for row in ws_map.iter_rows(min_row=2, values_only=True):
        if row[0] and row[1]:
            nombre_map[safe_str(row[0]).lower()] = safe_str(row[1]).upper()

    ws = wb["SATISFACCION"]
    respuestas = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        estado = safe_str(row[6]).lower()
        if estado != "completed":
            continue

        inst_raw        = safe_str(row[9])
        nombre_analisis = safe_str(row[15])
        if not nombre_analisis:
            nombre_analisis = nombre_map.get(inst_raw.lower(), inst_raw.upper())

        # Corregir errores tipográficos y nombres abreviados
        nombre_analisis = _NOMBRE_FIXES.get(nombre_analisis, nombre_analisis)

        # col[16] = NombreBI: nombre exacto para cruzar con Base Instalada
        nombre_bi = safe_str(row[16]).strip().upper() if len(row) > 16 and row[16] else ""

        email   = safe_str(row[8])
        dominio = email.split("@")[1].lower() if "@" in email else "desconocido"

        calidad  = to_float(row[10])
        resuelto = safe_str(row[11])
        tiempo   = to_float(row[12])
        recom    = to_float(row[13])
        mejora   = safe_str(row[14])
        # Columna AD (row[29]) = categoría detractor (llenada manualmente en Excel)
        cat_det  = safe_str(row[29]).strip() if len(row) > 29 and row[29] else ""
        # Columna R (row[17]) = contratos asociados al cliente (monto CLP)
        contr_asoc = round(to_float(row[17] if len(row) > 17 else 0))
        _BD_KEYS = ["ester","endo","mob","dent","inc","mmq","reas","otro"]
        bi_det   = {k: to_int(row[18+i] if len(row) > 18+i else None)
                    for i, k in enumerate(_BD_KEYS)}
        # bi_total = suma real de equipos por tipo (no la columna R)
        bi_sum   = sum(bi_det.values())
        bi       = bi_sum if bi_sum > 0 else None
        # Columna AC (row[28]) = facturación real 2026 del cliente
        fac_2026_sat = round(to_float(row[28] if len(row) > 28 else 0))
        # Columna E (row[4]) = Fecha y hora de finalización de la encuesta
        fecha_resp = row[4] if len(row) > 4 and isinstance(row[4], datetime) else None

        respuestas.append({
            "institucion":    nombre_analisis,
            "nombre_bi":      nombre_bi,
            "dominio":        dominio,
            "categoria":      _dom_cat(dominio),
            "fecha":          fecha_resp,
            "calidad":        calidad,
            "tiempo":         tiempo,
            "recom":          recom,
            "resuelto":       resuelto,
            "mejora":         mejora,
            "cat_detractor":  cat_det,
            "bi_total":       bi,
            "bi_detalle":     bi_det,
            "contr_asociados": contr_asoc,
            "fac_2026":       fac_2026_sat,
        })

    n = len(respuestas)
    if n == 0:
        return {
            "global":        {"n": 0, "calidad_avg": 0, "tiempo_avg": 0, "recom_avg": 0,
                              "resuelto_si": 0, "resuelto_no": 0, "resuelto_parcial": 0},
            "nps":           {"det": 0, "pas": 0, "pro": 0, "nps": 0},
            "dominio":       [],
            "categoria":     [],
            "trimestral":            [],
            "detractor_categorias":  [],
            "instituciones": [],
            "bi_resumen":    {"n_inst": 0, "n_con_bi": 0, "total_bi": 0},
            "comentarios":   [],
        }

    cal_avg = round(sum(r["calidad"] for r in respuestas) / n, 2)
    tie_avg = round(sum(r["tiempo"]  for r in respuestas) / n, 2)
    rec_avg = round(sum(r["recom"]   for r in respuestas) / n, 2)

    def _resuelto_cat(s):
        sl = s.lower()
        if "parcial" in sl: return "parcial"
        if "no" in sl and "si" not in sl: return "no"
        return "si"

    res_si  = sum(1 for r in respuestas if _resuelto_cat(r["resuelto"]) == "si")
    res_no  = sum(1 for r in respuestas if _resuelto_cat(r["resuelto"]) == "no")
    res_par = n - res_si - res_no

    # NPS
    pro = sum(1 for r in respuestas if r["recom"] >= 9)
    pas = sum(1 for r in respuestas if 7 <= r["recom"] <= 8)
    det = sum(1 for r in respuestas if r["recom"] <= 6)
    nps = round((pro - det) / n * 100)

    # Por dominio
    dom_data = defaultdict(lambda: {"n": 0, "cal": [], "tie": [], "rec": []})
    for r in respuestas:
        d = dom_data[r["dominio"]]
        d["n"] += 1
        d["cal"].append(r["calidad"])
        d["tie"].append(r["tiempo"])
        d["rec"].append(r["recom"])

    dominio_list = []
    for dom, d in sorted(dom_data.items(), key=lambda x: -x[1]["n"]):
        dominio_list.append({
            "dominio":   dom,
            "n":         d["n"],
            "calidad":   round(sum(d["cal"]) / d["n"], 2),
            "tiempo":    round(sum(d["tie"]) / d["n"], 2),
            "recom":     round(sum(d["rec"]) / d["n"], 2),
            "categoria": _dom_cat(dom),
        })

    # Por categoría (ponderado)
    cat_data: dict = {}
    for entry in dominio_list:
        cat = entry["categoria"]
        if cat not in cat_data:
            cat_data[cat] = {"n": 0, "cal": [], "tie": [], "rec": []}
        cat_data[cat]["n"] += entry["n"]
        cat_data[cat]["cal"].append((entry["calidad"], entry["n"]))
        cat_data[cat]["tie"].append((entry["tiempo"],  entry["n"]))
        cat_data[cat]["rec"].append((entry["recom"],   entry["n"]))

    def w_avg(pairs):
        total_n = sum(p[1] for p in pairs)
        return 0 if total_n == 0 else round(sum(p[0] * p[1] for p in pairs) / total_n, 2)

    categoria_list = [
        {"categoria": cat, "n": d["n"],
         "calidad": w_avg(d["cal"]), "tiempo": w_avg(d["tie"]), "recom": w_avg(d["rec"])}
        for cat, d in sorted(cat_data.items(), key=lambda x: -x[1]["n"])
    ]

    # Evolutivo trimestral: N° de encuestas y satisfacción promedio por trimestre
    trim_data: dict = {}
    for r in respuestas:
        f = r.get("fecha")
        if f is None:
            continue
        q = (f.month - 1) // 3 + 1
        key = (f.year, q)
        if key not in trim_data:
            trim_data[key] = {"cal": [], "tie": [], "rec": [], "pro": 0, "pas": 0, "det": 0}
        t = trim_data[key]
        t["cal"].append(r["calidad"])
        t["tie"].append(r["tiempo"])
        t["rec"].append(r["recom"])
        if r["recom"] >= 9: t["pro"] += 1
        elif r["recom"] >= 7: t["pas"] += 1
        else: t["det"] += 1

    trimestral_list = [
        {
            "trimestre": f"Q{q} {year}",
            "n":         len(t["cal"]),
            "calidad":   round(sum(t["cal"]) / len(t["cal"]), 2),
            "tiempo":    round(sum(t["tie"]) / len(t["tie"]), 2),
            "recom":     round(sum(t["rec"]) / len(t["rec"]), 2),
            "promotores":  t["pro"],
            "pasivos":     t["pas"],
            "detractores": t["det"],
            "nps": round((t["pro"] - t["det"]) / len(t["cal"]) * 100) if t["cal"] else 0,
        }
        for (year, q), t in sorted(trim_data.items())
    ]

    # Desglose por categoría detractor (columna "Categoría" del Excel, se llena
    # manualmente sólo para respuestas con problemas). Sólo categorías con valor.
    det_cat_data: dict = {}
    n_con_categoria = 0
    for r in respuestas:
        c = (r.get("cat_detractor") or "").strip()
        if not c:
            continue
        n_con_categoria += 1
        if c not in det_cat_data:
            det_cat_data[c] = {"n": 0, "rec": []}
        det_cat_data[c]["n"] += 1
        det_cat_data[c]["rec"].append(r["recom"])

    detractor_categorias = [
        {"categoria": c, "n": d["n"], "recom_avg": round(sum(d["rec"]) / d["n"], 2)}
        for c, d in sorted(det_cat_data.items(), key=lambda x: -x[1]["n"])
    ]

    # Por institución (TODAS las respuestas, no solo las que tienen mejora)
    # BI = primer valor no-nulo (mismo cliente → mismo valor)
    # Categoría = preferir Sector Público o Privado sobre Correo personal
    _CAT_PRIO  = {"Sector Público": 0, "Sector Privado": 1, "Correo personal": 2}
    _BD_KEYS   = ["ester","endo","mob","dent","inc","mmq","reas","otro"]
    _BD_EMPTY  = {k: 0 for k in _BD_KEYS}
    inst_data: dict = {}
    for r in respuestas:
        key = r["institucion"]
        if key not in inst_data:
            inst_data[key] = {
                "n": 0, "cal": [], "tie": [], "rec": [],
                "_bi": None, "_bi_det": None, "_contr": None, "_fac2026": None,
                "_nombre_bi": r.get("nombre_bi", ""),
                "_cat_det": r.get("cat_detractor", ""),
                "categoria": r["categoria"]
            }
        d = inst_data[key]
        d["n"] += 1
        d["cal"].append(r["calidad"])
        d["tie"].append(r["tiempo"])
        d["rec"].append(r["recom"])
        if d["_bi"] is None and r["bi_total"] is not None:
            d["_bi"] = r["bi_total"]
        # bi_detalle: tomar primera fila con suma > 0 (todos son el mismo cliente)
        if d["_bi_det"] is None:
            bd = r.get("bi_detalle", {})
            if sum(bd.values()) > 0:
                d["_bi_det"] = bd
        # contr_asociados: primer valor no-nulo (mismo cliente = mismo monto siempre)
        if d["_contr"] is None and r.get("contr_asociados", 0) > 0:
            d["_contr"] = r["contr_asociados"]
        # fac_2026: primer valor no-nulo de columna AC
        if d["_fac2026"] is None and r.get("fac_2026", 0) > 0:
            d["_fac2026"] = r["fac_2026"]
        # nombre_bi: primer valor no vacío (mismo cliente = mismo valor)
        if not d["_nombre_bi"] and r.get("nombre_bi"):
            d["_nombre_bi"] = r["nombre_bi"]
        # cat_detractor: primer valor no vacío entre todas las respuestas de la institución
        if not d["_cat_det"] and r.get("cat_detractor"):
            d["_cat_det"] = r["cat_detractor"]
        if _CAT_PRIO.get(r["categoria"], 9) < _CAT_PRIO.get(d["categoria"], 9):
            d["categoria"] = r["categoria"]

    instituciones = sorted([
        {
            "institucion":    key,
            "n":              d["n"],
            "calidad":        round(sum(d["cal"]) / d["n"], 2),
            "tiempo":         round(sum(d["tie"]) / d["n"], 2),
            "recom":          round(sum(d["rec"]) / d["n"], 2),
            "bi_total":       d["_bi"],
            "bi_detalle":     d["_bi_det"] or dict(_BD_EMPTY),
            "contr_asociados": d["_contr"] or 0,
            "fac_2026":       d["_fac2026"] or 0,
            "nombre_bi":      d["_nombre_bi"] or "",
            "cat_detractor":  d["_cat_det"] or "",
            "categoria":      d["categoria"],
        }
        for key, d in inst_data.items()
    ], key=lambda x: (-(x["bi_total"] or 0), x["institucion"]))

    inst_con_bi = [i for i in instituciones if i["bi_total"] is not None]
    bi_resumen = {
        "n_inst":    len(instituciones),
        "n_con_bi":  len(inst_con_bi),
        "total_bi":  sum(i["bi_total"] for i in inst_con_bi),
    }

    comentarios = [
        {"institucion": r["institucion"], "mejora": r["mejora"], "recom": r["recom"],
         "bi_total": r["bi_total"], "contr_asociados": r.get("contr_asociados", 0)}
        for r in respuestas if r["mejora"]
    ]

    return {
        "global": {
            "n":               n,
            "calidad_avg":     cal_avg,
            "tiempo_avg":      tie_avg,
            "recom_avg":       rec_avg,
            "resuelto_si":     res_si,
            "resuelto_no":     res_no,
            "resuelto_parcial": res_par,
        },
        "nps":           {"det": det, "pas": pas, "pro": pro, "nps": nps},
        "dominio":       dominio_list,
        "categoria":     categoria_list,
        "trimestral":            trimestral_list,
        "detractor_categorias":  detractor_categorias,
        "instituciones": instituciones,
        "bi_resumen":    bi_resumen,
        "comentarios":   comentarios,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 5b. HOJA: BASE INSTALADA
#     col[0]=Habilitado(Si/No)  col[1]=FueraDeServicio(Si/No)
#     col[4]=Nombre  col[5]=Fabricante  col[6]=Modelo
#     col[12]=Tipo  col[13]=Clasificacion1(cliente)  col[14]=Clasificacion2(estado)
#     col[25]=LineaDeNegocio  col[26]=NombreAnalisis(cliente normalizado, puede ser None)
#     col[27]=PotencialST (Si/No) — marcas que TECSERVICE aún representa
# ══════════════════════════════════════════════════════════════════════════════
def read_base_instalada(wb):
    ws = None
    for name in wb.sheetnames:
        if "base instalada" in name.lower():
            ws = wb[name]
            break
    if ws is None:
        print("  ADVERTENCIA: no se encontro la hoja 'BASE INSTALADA'.")
        return {
            "total": 0, "por_linea": {}, "por_tipo": [],
            "por_estado": {}, "clientes": [],
        }

    _ESTADO_MAP = {
        "CONTRATO":     "Contrato",
        "CONTRATO 24/7":"Contrato",
        "GARANTÍA":     "Garantia",
        "GARANTIA":     "Garantia",
        "SIN GARANTIA": "Sin garantia",
    }

    por_linea      = defaultdict(int)
    por_tipo       = defaultdict(int)
    por_tipo_si    = defaultdict(int)   # solo filas con Potencial ST = Si
    por_tipo_no    = defaultdict(int)   # solo filas con Potencial ST = No
    por_estado     = defaultdict(int)
    tipo_por_linea = defaultdict(lambda: defaultdict(int))
    cli_map        = {}  # cliente → {total, lineas:{}, estados:{}}

    total = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        # Filtro activos
        habilitado = safe_str(row[0]).upper() if row[0] is not None else ""
        fuera_sv   = safe_str(row[1]).upper() if row[1] is not None else ""
        if habilitado != "SI":
            continue
        if fuera_sv == "SI":
            continue

        tipo   = safe_str(row[12]).strip().upper() if row[12] else "SIN TIPO"
        linea  = safe_str(row[25]).strip() if row[25] else "Otra"
        estado_raw = safe_str(row[14]).strip().upper() if row[14] else ""
        estado = _ESTADO_MAP.get(estado_raw, "Sin clasificar")

        # Nombre cliente: col[26] si existe, sino col[13]
        nombre_analisis = safe_str(row[26]).strip() if row[26] else ""
        if not nombre_analisis or nombre_analisis.lower() in ("none", ""):
            nombre_analisis = safe_str(row[13]).strip() if row[13] else "SIN CLIENTE"
        nombre_analisis = nombre_analisis.upper()

        # col[27] = Potencial ST (Si/No)
        potencial_raw = safe_str(row[27]).strip().upper() if len(row) > 27 and row[27] is not None else ""
        es_potencial  = potencial_raw in ("SI", "SÍ", "S", "1", "TRUE", "VERDADERO")

        total += 1
        por_linea[linea] += 1
        por_tipo[tipo]   += 1
        if es_potencial: por_tipo_si[tipo] += 1
        else:            por_tipo_no[tipo] += 1
        por_estado[estado] += 1
        tipo_por_linea[linea][tipo] += 1

        if nombre_analisis not in cli_map:
            cli_map[nombre_analisis] = {
                "total": 0, "total_si": 0, "total_no": 0,
                "lineas": defaultdict(int),
                "lineas_si": defaultdict(int),
                "lineas_no": defaultdict(int),
                "estados": defaultdict(int),
                "_potencial_st": False,
            }
        d = cli_map[nombre_analisis]
        d["total"]          += 1
        d["lineas"][linea]  += 1
        d["estados"][estado] += 1
        if es_potencial:
            d["_potencial_st"]     = True
            d["total_si"]          += 1
            d["lineas_si"][linea]  += 1
        else:
            d["total_no"]          += 1
            d["lineas_no"][linea]  += 1

    # Top 20 tipos (global y por potencial)
    top_tipos    = sorted([{"tipo": t, "n": n} for t, n in por_tipo.items()],    key=lambda x: -x["n"])[:20]
    top_tipos_si = sorted([{"tipo": t, "n": n} for t, n in por_tipo_si.items()], key=lambda x: -x["n"])[:20]
    top_tipos_no = sorted([{"tipo": t, "n": n} for t, n in por_tipo_no.items()], key=lambda x: -x["n"])[:20]

    # Construir lista de clientes
    clientes = []
    for nombre, d in cli_map.items():
        ls = d["lineas"]
        # Estado más frecuente
        if d["estados"]:
            estado_cli = max(d["estados"], key=lambda e: d["estados"][e])
        else:
            estado_cli = "Sin clasificar"

        mmq_reas = ls.get("MMQ", 0) + ls.get("REAS", 0)
        lineas_conocidas = {"DENTAL", "ESTERILIZACIÓN", "ESTERILIZACION", "INCARDIA", "ENDOSCOPIA", "MOBILIARIO CLINICO", "MMQ", "REAS"}
        otros = sum(v for k, v in ls.items() if k not in lineas_conocidas and k not in ("MMQ", "REAS"))

        ls_si  = d["lineas_si"]
        ls_no  = d["lineas_no"]
        mmq_reas_si = ls_si.get("MMQ", 0) + ls_si.get("REAS", 0)
        mmq_reas_no = ls_no.get("MMQ", 0) + ls_no.get("REAS", 0)
        otros_si = sum(v for k, v in ls_si.items() if k not in lineas_conocidas and k not in ("MMQ", "REAS"))
        otros_no = sum(v for k, v in ls_no.items() if k not in lineas_conocidas and k not in ("MMQ", "REAS"))

        clientes.append({
            "nombre":            nombre,
            "total":             d["total"],
            "total_si":          d["total_si"],
            "total_no":          d["total_no"],
            "dental":            ls.get("DENTAL", 0),
            "dental_si":         ls_si.get("DENTAL", 0),
            "dental_no":         ls_no.get("DENTAL", 0),
            "esterilizacion":    ls.get("ESTERILIZACIÓN", ls.get("ESTERILIZACION", 0)),
            "esterilizacion_si": ls_si.get("ESTERILIZACIÓN", ls_si.get("ESTERILIZACION", 0)),
            "esterilizacion_no": ls_no.get("ESTERILIZACIÓN", ls_no.get("ESTERILIZACION", 0)),
            "incardia":          ls.get("INCARDIA", 0),
            "incardia_si":       ls_si.get("INCARDIA", 0),
            "incardia_no":       ls_no.get("INCARDIA", 0),
            "endoscopia":        ls.get("ENDOSCOPÍA", ls.get("ENDOSCOPIA", 0)),
            "endoscopia_si":     ls_si.get("ENDOSCOPÍA", ls_si.get("ENDOSCOPIA", 0)),
            "endoscopia_no":     ls_no.get("ENDOSCOPÍA", ls_no.get("ENDOSCOPIA", 0)),
            "mobiliario":        ls.get("MOBILIARIO CLINICO", 0),
            "mobiliario_si":     ls_si.get("MOBILIARIO CLINICO", 0),
            "mobiliario_no":     ls_no.get("MOBILIARIO CLINICO", 0),
            "mmq_reas":          mmq_reas,
            "mmq_reas_si":       mmq_reas_si,
            "mmq_reas_no":       mmq_reas_no,
            "otros":             otros,
            "otros_si":          otros_si,
            "otros_no":          otros_no,
            "estado":            estado_cli,
            "con_contrato":      estado_cli in ("Contrato", "Garantia"),
            "potencial_st":      d.get("_potencial_st", False),
        })

    # Excluir clientes internos (GEMCO)
    clientes = [c for c in clientes if "GEMCO" not in c["nombre"]]

    # Ordenar clientes por total desc
    clientes.sort(key=lambda x: -x["total"])

    # Recalcular total sin GEMCO (para que KPIs sean consistentes)
    total_sin_gemco    = sum(c["total"]    for c in clientes)
    total_si_sin_gemco = sum(c["total_si"] for c in clientes)
    total_no_sin_gemco = sum(c["total_no"] for c in clientes)

    print(f"       Base Instalada: {total_sin_gemco} activos (sin GEMCO) | {len(clientes)} clientes | {len(por_tipo)} tipos")
    por_tipo_linea_out = {
        linea: sorted([{"tipo": t, "n": n} for t, n in ctr.items()], key=lambda x: -x["n"])[:6]
        for linea, ctr in tipo_por_linea.items()
    }

    return {
        "total":          total_sin_gemco,
        "total_si":       total_si_sin_gemco,
        "total_no":       total_no_sin_gemco,
        "por_linea":      dict(por_linea),
        "por_tipo":       top_tipos,
        "por_tipo_si":    top_tipos_si,
        "por_tipo_no":    top_tipos_no,
        "por_tipo_linea": por_tipo_linea_out,
        "por_estado":     dict(por_estado),
        "clientes":       clientes,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 5c. HOJA: ANALISIS FACTURACIÓN + GD-PPTO
#     Tabla 1 (filas 4-7): resumen mensual por linea de negocio
#     Tabla 2 (filas 11-14): desglose semanal del mes en curso
#     GD-PPTO filas 20-22: presupuesto mensual por catálogo
#
#     Valores en la hoja están en MM$ → se multiplican por 1e6 para pesos
# ══════════════════════════════════════════════════════════════════════════════
def read_analisis_fac(wb):
    # Encontrar hoja por nombre (con/sin acento)
    ws_anal = None
    ws_gd   = None
    for name in wb.sheetnames:
        nl = name.lower()
        if "analisis" in nl or "análisis" in nl:
            ws_anal = wb[name]
        if "gd" in nl and "ppto" in nl:
            ws_gd = wb[name]

    MM = 1_000_000  # los valores en la hoja están en MM$

    # ── Analisis Facturación ────────────────────────────────────────────────
    result = {
        "semana": 0, "mes_nombre": "",
        "tabla_mensual": [], "tabla_semanal": [],
        "ts_ingresos": 0.0, "ts_total_ytd": 0.0,
        "ts_ppto_acum": 0.0, "ts_ppto_anual": 0.0,
        "ts_ingresos_aa": 0.0,
        "ppto_mensual": [0.0] * 12,
    }

    if ws_anal:
        rows = list(ws_anal.iter_rows(min_row=1, max_row=35, values_only=True))

        # Fila 2 (idx 1): semana y mes
        r2 = rows[1] if len(rows) > 1 else []
        result["semana"]     = to_int(r2[4]) if len(r2) > 4 else 0
        result["mes_nombre"] = safe_str(r2[6]) if len(r2) > 6 else ""

        def _parse_mensual(row):
            if not row or not row[1]:
                return None
            return {
                "linea":            safe_str(row[1]),
                "ingresos":         to_float(row[4]) * MM,
                "provision":        to_float(row[5]) * MM,
                "gd":               to_float(row[6]) * MM,
                "total_ytd":        to_float(row[7]) * MM,
                "ppto_acum":        to_float(row[8]) * MM,
                "delta_ppto":       to_float(row[9]) * MM,
                "delta_ppto_pct":   to_float(row[10]),
                "ingresos_aa":      to_float(row[11]) * MM,
                "delta_aa":         to_float(row[12]) * MM,
                "delta_aa_pct":     to_float(row[13]),
                "ppto_anual":       to_float(row[14]) * MM,
            }

        def _parse_semanal(row):
            if not row or not row[1]:
                return None
            return {
                "linea":        safe_str(row[1]),
                "ingresos":     to_float(row[4]) * MM,
                "s1":           to_float(row[5]) * MM,
                "s2":           to_float(row[6]) * MM,
                "s3":           to_float(row[7]) * MM,
                "s4":           to_float(row[8]) * MM,
                "s5":           to_float(row[9]) * MM,
                "acum_mes":     to_float(row[10]) * MM,
                "ppto_mes":     to_float(row[11]) * MM,
                "delta_ppto":   to_float(row[12]) * MM,
                "delta_ppto_pct": to_float(row[13]),
                "vs_mes_ant":   to_float(row[14]) * MM if len(row) > 14 else 0,
                "delta_vs_ant": to_float(row[15]) * MM if len(row) > 15 else 0,
            }

        # Tabla 1: filas 4-7 (índice 3-6)
        for idx in [3, 4, 5, 6]:
            parsed = _parse_mensual(rows[idx] if idx < len(rows) else None)
            if parsed:
                result["tabla_mensual"].append(parsed)

        # Tabla 2: filas 11-14 (índice 10-13)
        for idx in [10, 11, 12, 13]:
            parsed = _parse_semanal(rows[idx] if idx < len(rows) else None)
            if parsed:
                result["tabla_semanal"].append(parsed)

        # Totales TS (fila de "Ingresos Totales")
        for r in result["tabla_mensual"]:
            if "total" in r["linea"].lower():
                result["ts_ingresos"]    = r["ingresos"]
                result["ts_total_ytd"]   = r["total_ytd"]
                result["ts_ppto_acum"]   = r["ppto_acum"]
                result["ts_ppto_anual"]  = r["ppto_anual"]
                result["ts_ingresos_aa"] = r["ingresos_aa"]
                break

    # ── Líneas de negocio mensuales: filas 31-34 (índices 30-33 en rows) ────
    result["lineas_mensual"] = {}
    if ws_anal:
        for row in rows[30:35]:
            label = safe_str(row[1]).strip() if row[1] else ""
            if not label:
                continue
            meses = []
            for m in range(12):
                v = row[2 + m] if len(row) > 2 + m else 0
                meses.append(round(to_float(v)))
            result["lineas_mensual"][label] = meses

    # ── GD-PPTO: presupuesto mensual (fila 23 = total TECSERVICE) ───────────
    if ws_gd:
        # Fila 23 = total TECSERVICE (suma de REAS + ST + Trazabilidad)
        gd_rows = list(ws_gd.iter_rows(min_row=23, max_row=23, values_only=True))
        ppto_mes = [0.0] * 12
        for row in gd_rows:
            if not row:
                continue
            for m in range(12):
                col_idx = 5 + m  # Enero = col F (índice 5)
                if col_idx < len(row):
                    ppto_mes[m] = to_float(row[col_idx]) * MM
        result["ppto_mensual"] = [round(v) for v in ppto_mes]

    return result


# ══════════════════════════════════════════════════════════════════════════════
# 6. HOJA: BASE MAPA (hoja "BASE MAPA" del Excel principal)
#    Columnas (0-based):
#    0=NombreCliente  1=TipoCliente  2=Ingresos2025  3=Ingresos2026  4=BiTotal
#    6=EqEster  7=EqDental  8=EqEndo  9=EqIncardia  10=EqMMQ  11=EqREAS
#    12=EqMobClin  13=EqMobOtros
#    14=Región  15=Comuna
#    17=PipeEster  18=PipeEndo  19=PipeDental
#    20=PotencialEquipos  21=PotSTGarantía  22=PotContratosBIActual
#    23=PotSTTotal  24=Latitud  25=Longitud  26=Contrato(Sí/No)
#    contratos y sat se enriquecen en enrich_mapa_data(); cc viene directo de col AA
# ══════════════════════════════════════════════════════════════════════════════
def read_mapa(wb):
    ws = None
    for name in wb.sheetnames:
        if name.strip().upper() == "BASE MAPA":
            ws = wb[name]
            break
    if ws is None:
        print("  ADVERTENCIA: no se encontró la hoja 'BASE MAPA' en el Excel.")
        return []
    clientes = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        nombre = safe_str(row[0])
        if not nombre:
            continue
        lat = to_float(row[24], None)   # col Y
        lon = to_float(row[25], None)   # col Z
        if lat is None or lon is None or lat == 0 or lon == 0:
            continue
        region_raw = safe_str(row[14])
        region = region_raw.replace("Región ", "").replace("Region ", "").strip()

        # Potencial Equipos (col U) = sum pipeline por línea (R+S+T)
        pot_eq_ester  = to_int(row[17])   # col R: Pipeline Esterilización
        pot_eq_endo   = to_int(row[18])   # col S: Pipeline Endoscopía
        pot_eq_dental = to_int(row[19])   # col T: Pipeline Dental
        pot_eq        = to_int(row[20])   # col U: Potencial Equipos total

        # Potencial ST (col V + col W; col X = total precalculado)
        pot_st_gar   = to_int(row[21])   # col V: Potencial ST Garantía
        pot_st_contr = to_int(row[22])   # col W: Potencial Contratos sobre BI Actual
        pot_st       = to_int(row[23])   # col X: Potencial ST Total (directo del Excel)
        if pot_st == 0:
            pot_st = pot_st_gar + pot_st_contr  # fallback si col X está vacía

        # Contrato (col AA = index 26): fuente autorativa desde Excel
        cc_raw = safe_str(row[26]).strip().upper() if len(row) > 26 and row[26] is not None else ""
        cc = cc_raw in ("SI", "SÍ", "S", "1", "TRUE", "VERDADERO", "X")

        # Satisfacción (col AB = index 27): escala 1–5, 0 = sin dato
        sat_raw = row[27] if len(row) > 27 else None
        sat = None
        if sat_raw is not None:
            try:
                sat_val = int(float(sat_raw))
                sat = sat_val if 1 <= sat_val <= 5 else None
            except Exception:
                sat = None

        eq = {
            "Esterilización": to_int(row[6]),
            "Dental":         to_int(row[7]),
            "Endoscopía":     to_int(row[8]),
            "Incardia":       to_int(row[9]),
            "MMQ":            to_int(row[10]),
            "REAS":           to_int(row[11]),
            "Mob.Clínico":    to_int(row[12]),
            "Mob.Otros":      to_int(row[13]),
        }
        clientes.append({
            "n":            nombre,
            "tipo":         safe_str(row[1]),
            "ingreso_2025": to_int(row[2]),    # col C
            "ingreso_2026": to_int(row[3]),    # col D
            "ingreso":      to_int(row[3]),    # alias 2026
            "bi":           to_int(row[4]),    # BI Total (equipos con pot. ST)
            "eq":           eq,
            "region":       region,
            "comuna":       safe_str(row[15]),
            "contratos":    0,                 # enrich_mapa_data
            "pipe":         pot_eq,
            "lat":          round(lat, 7),
            "lon":          round(lon, 7),
            "cc":           cc,                # desde col AA del Excel
            "margen":       0,
            "sat":          sat,               # desde col AB del Excel
            "pot_eq":       pot_eq,
            "pot_eq_ester": pot_eq_ester,
            "pot_eq_endo":  pot_eq_endo,
            "pot_eq_dental": pot_eq_dental,
            "pot_st":       pot_st,
            "pot_st_gar":   pot_st_gar,
            "pot_st_contr": pot_st_contr,
            "pot":          pot_eq + pot_st,
        })
    return clientes


# ══════════════════════════════════════════════════════════════════════════════
# 6b. HOJA: CASOS RELEVANTES
#     Dos tablas lado a lado:
#     Tabla izquierda A-F (cols 0-5): Casos Relevantes
#     Tabla derecha   J-T (cols 9-19): Equipos Detenidos
# ══════════════════════════════════════════════════════════════════════════════
def read_casos(wb):
    ws = None
    for name in wb.sheetnames:
        if "caso" in name.lower() and "relevante" in name.lower():
            ws = wb[name]
            break
    if ws is None:
        return {"casos": [], "equipos": []}

    casos   = []
    equipos = []
    last_coord = ""
    for row in ws.iter_rows(min_row=2, values_only=True):
        # Forward-fill coordinador (puede estar en celdas combinadas)
        coord_cell = safe_str(row[0]) if len(row) > 0 and row[0] else ""
        if coord_cell:
            last_coord = coord_cell

        # Tabla izquierda: fila de caso si hay cliente (col B = índice 1)
        cliente = safe_str(row[1]) if len(row) > 1 and row[1] else ""
        if cliente:
            casos.append({
                "coordinador": last_coord,
                "cliente":     cliente,
                "problema":    safe_str(row[2]) if len(row) > 2 else "",
                "responsable": safe_str(row[3]) if len(row) > 3 else "",
                "comentario":  safe_str(row[4]) if len(row) > 4 else "",
                "salesforce":  safe_str(row[5]) if len(row) > 5 else "",
            })

        # Tabla derecha: fila de equipo si hay modelo (col J = índice 9)
        modelo = safe_str(row[9]) if len(row) > 9 and row[9] else ""
        if modelo:
            def _fmt_dt(v):
                if isinstance(v, (datetime, date)):
                    return v.strftime("%d-%m-%Y")
                return ""
            def _no_asoc(v):
                s = safe_str(v) if v is not None else ""
                return "" if "NO ASOCIADO" in s.upper() else s
            equipos.append({
                "modelo":           modelo,
                "nombre":           safe_str(row[11]) if len(row) > 11 else "",
                "serie":            safe_str(str(row[12])) if len(row) > 12 and row[12] else "",
                "marca":            safe_str(row[13]) if len(row) > 13 else "",
                "estado":           safe_str(row[14]) if len(row) > 14 else "",
                "coordinadora":     safe_str(row[15]) if len(row) > 15 else "",
                "comentario_coord": safe_str(row[16]) if len(row) > 16 else "",
                "comentario_mat":   safe_str(row[17]) if len(row) > 17 else "",
                "contrato_num":     safe_str(str(row[18])) if len(row) > 18 and row[18] else "",
                "garantia":         safe_str(row[19]) if len(row) > 19 else "",
                "nombre_cliente":   _no_asoc(row[21]) if len(row) > 21 else "",
                "neta_mes":         to_float(row[22]) if len(row) > 22 and not isinstance(row[22], str) else 0,
                "fac_anual":        to_float(row[23]) if len(row) > 23 and not isinstance(row[23], str) else 0,
                "fac_ytd":          to_float(row[24]) if len(row) > 24 and not isinstance(row[24], str) else 0,
                "fecha_inicio":     _fmt_dt(row[25]) if len(row) > 25 else "",
                "fecha_fin":        _fmt_dt(row[26]) if len(row) > 26 else "",
            })

    return {"casos": casos, "equipos": equipos}



def _ffill(valor, previo):
    """Los export de Salesforce dejan en blanco las filas que continúan el
    mismo grupo (propietario, línea, orden). Arrastra el último valor visto."""
    v = safe_str(valor).strip()
    return v if v else previo


def _parse_fecha(v):
    """Fecha que puede venir como datetime o como texto D/M/YYYY."""
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = safe_str(v).strip()
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def read_brecha_oport(wb):
    """Oportunidades adjudicadas que aún no se facturan.

    Fuente: hoja "Brecha Oport por Facturar". El monto es "Monto adjudicado
    (convertido)" (col H). El propietario (col A) viene con celdas en blanco
    en las filas que continúan el mismo grupo, así que se arrastra.
    """
    ws = None
    for name in wb.sheetnames:
        n = name.strip().lower()
        if "brecha" in n and "oport" in n:
            ws = wb[name]
            break
    if ws is None:
        return {}

    items, prop = [], ""
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 9:
            continue
        prop = _ffill(row[0], prop)
        cliente = safe_str(row[2]).strip()
        monto   = to_float(row[7])
        if not cliente and monto == 0:
            continue
        f = _parse_fecha(row[6])
        items.append({
            "prop":     prop or "Sin asignar",
            "cliente":  cliente or "(sin cliente)",
            "oport":    safe_str(row[3]).strip(),
            "contrato": safe_str(row[4]).strip(),
            "oc":       safe_str(row[5]).strip(),
            "fecha":    f.isoformat() if f else "",
            "fecha_fmt": f.strftime("%d/%m/%Y") if f else "",
            "ov":       safe_str(row[8]).strip(),
            "monto":    round(monto),
        })

    if not items:
        return {}
    items.sort(key=lambda x: -x["monto"])

    def agrupa(campo):
        g = defaultdict(lambda: [0.0, 0])
        for it in items:
            g[it[campo]][0] += it["monto"]
            g[it[campo]][1] += 1
        return [{"k": k, "monto": round(v[0]), "n": v[1]}
                for k, v in sorted(g.items(), key=lambda x: -x[1][0])]

    return {
        "total":          round(sum(i["monto"] for i in items)),
        "n":              len(items),
        "por_propietario": agrupa("prop"),
        "por_cliente":     agrupa("cliente"),
        "items":           items,
    }


def read_brecha_stock(wb):
    """Oportunidades detenidas por falta de stock de repuestos.

    Fuente: hoja "Brecha Sin Stock". El monto es "Precio total" (col N).
    Propietario (A), línea de negocio (B) y orden de venta (C) vienen con
    celdas en blanco en las filas de continuación y se arrastran.
    """
    ws = None
    for name in wb.sheetnames:
        n = name.strip().lower()
        if "brecha" in n and "stock" in n:
            ws = wb[name]
            break
    if ws is None:
        return {}

    items = []
    prop = linea = ov = ""
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 14:
            continue
        prop  = _ffill(row[0], prop)
        linea = _ffill(row[1], linea)
        ov    = _ffill(row[2], ov)
        monto = to_float(row[13])
        cod   = safe_str(row[9]).strip()
        if not cod and monto == 0:
            continue
        f = _parse_fecha(row[8])
        items.append({
            "prop":     prop or "Sin asignar",
            "linea":    linea or "Sin línea",
            "ov":       ov,
            "oport":    safe_str(row[4]).strip(),
            "cliente":  safe_str(row[6]).strip() or "(sin cliente)",
            "oc":       safe_str(row[7]).strip(),
            "fecha":    f.isoformat() if f else "",
            "fecha_fmt": f.strftime("%d/%m/%Y") if f else "",
            "cod":      cod,
            "prod":     safe_str(row[10]).strip(),
            "cant":     round(to_float(row[11]), 2),
            "pu":       round(to_float(row[12])),
            "monto":    round(monto),
            "dias":     (TODAY - f).days if f else None,
        })

    if not items:
        return {}
    items.sort(key=lambda x: -x["monto"])

    def agrupa(campo):
        g = defaultdict(lambda: [0.0, 0, 0.0])
        for it in items:
            g[it[campo]][0] += it["monto"]
            g[it[campo]][1] += 1
            g[it[campo]][2] += it["cant"]
        return [{"k": k, "monto": round(v[0]), "n": v[1], "cant": round(v[2], 2)}
                for k, v in sorted(g.items(), key=lambda x: -x[1][0])]

    # Antigüedad: cuánto llevan esperando repuesto. Es lo más accionable —
    # una oportunidad de hace 8 meses probablemente ya se perdió.
    TRAMOS = [(0, 30, "0–30 días"), (31, 60, "31–60 días"), (61, 90, "61–90 días"),
              (91, 180, "91–180 días"), (181, 10**6, "Más de 180 días")]
    aging = []
    for lo, hi, lbl in TRAMOS:
        sel = [i for i in items if i["dias"] is not None and lo <= i["dias"] <= hi]
        aging.append({"k": lbl, "monto": round(sum(i["monto"] for i in sel)), "n": len(sel)})
    sin_fecha = [i for i in items if i["dias"] is None]
    if sin_fecha:
        aging.append({"k": "Sin fecha", "monto": round(sum(i["monto"] for i in sin_fecha)),
                      "n": len(sin_fecha)})

    # Mes de creación de la oportunidad
    MESES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
                 "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    g_mes = defaultdict(lambda: [0.0, 0])
    for it in items:
        if not it["fecha"]:
            continue
        y, m = it["fecha"][:4], int(it["fecha"][5:7])
        g_mes[(y, m)][0] += it["monto"]
        g_mes[(y, m)][1] += 1
    por_mes = [{"k": f"{MESES_ABR[m-1]} {y[2:]}", "monto": round(v[0]), "n": v[1]}
               for (y, m), v in sorted(g_mes.items(), key=lambda x: (x[0][0], x[0][1]))]

    # Productos que más veces bloquean una venta
    g_prod = defaultdict(lambda: [0.0, 0, 0.0, "", set()])
    for it in items:
        e = g_prod[it["cod"]]
        e[0] += it["monto"]; e[1] += 1; e[2] += it["cant"]
        if not e[3]:
            e[3] = it["prod"]
        e[4].add(it["cliente"])
    productos = [{"cod": k, "prod": v[3], "monto": round(v[0]), "n": v[1],
                  "cant": round(v[2], 2), "n_cli": len(v[4])}
                 for k, v in sorted(g_prod.items(), key=lambda x: -x[1][0])][:25]

    dias_val = [i["dias"] for i in items if i["dias"] is not None]
    return {
        "total":           round(sum(i["monto"] for i in items)),
        "n":               len(items),
        "n_ov":            len({i["ov"] for i in items if i["ov"]}),
        "n_clientes":      len({i["cliente"] for i in items}),
        "cant_total":      round(sum(i["cant"] for i in items), 2),
        "dias_prom":       round(sum(dias_val) / len(dias_val)) if dias_val else None,
        "dias_max":        max(dias_val) if dias_val else None,
        "por_linea":       agrupa("linea"),
        "por_cliente":     agrupa("cliente"),
        "por_propietario": agrupa("prop"),
        "aging":           aging,
        "por_mes":         por_mes,
        "productos":       productos,
        "items":           items,
    }


def read_repuestos_vendidos(wb):
    """Repuestos vendidos por marca, mes y cliente.

    Fuente: hoja "Repuestos Vendidas" (una fila por línea de cotización).
    Replica la tabla dinámica "TD": suma "Precio de venta" agrupando por
    "Marca 2" (marca normalizada) y año/mes. NO filtra por Estado — la
    dinámica incluye Aprobado, En borrador y Rechazado (validado: el total
    da 1.240.069.989,55 sólo sin filtrar).

    La marca se pasa a mayúsculas antes de agrupar porque el Excel trae
    PURYTAS/Purytas y NACIONAL/Nacional como variantes de la misma marca;
    la dinámica las junta y sin normalizar los totales no cuadran.

    Columnas: C=Nombre del cliente, M=Cantidad, P=Precio de venta,
              R=año, S=mes, T=Marca 2.
    """
    MESES_ABR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun",
                 "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    ws = None
    for name in wb.sheetnames:
        n = name.strip().lower()
        if "repuesto" in n and "vend" in n:
            ws = wb[name]
            break
    if ws is None:
        return {}

    # celdas[(marca, anio, mes)] = [monto, cantidad]
    celdas = defaultdict(lambda: [0.0, 0.0])
    # clientes[marca][cliente][anio] = [monto, cantidad]. Se guarda abierto por
    # año para que el panel pueda recalcular el top de clientes según el
    # segmentador 2025 / 2026 / ambos sin volver a leer el Excel.
    clientes = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0.0, 0.0])))
    # cli_mes[(cliente, anio, mes)] = [monto, cantidad] — serie mensual por
    # cliente, para el gráfico de evolución con selector de cliente.
    cli_mes   = defaultdict(lambda: [0.0, 0.0])
    cli_marca = defaultdict(lambda: defaultdict(float))
    # cli_mm[(cliente, marca, anio, mes)] = [monto, cantidad] — desglose por
    # marca dentro de cada mes, para las barras apiladas del gráfico y su
    # tooltip. Sólo se guardan los pares (cliente, marca) con venta real.
    cli_mm    = defaultdict(lambda: [0.0, 0.0])
    periodos = set()

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 20:
            continue
        marca = safe_str(row[19]).strip().upper()
        if not marca:
            continue
        try:
            mes = int(row[18])
        except (TypeError, ValueError):
            continue
        if not (1 <= mes <= 12):
            continue
        anio = safe_str(row[17]).strip()
        if not anio:
            continue
        monto = to_float(row[15])
        cant  = to_float(row[12])
        cli   = safe_str(row[2]).strip() or "(sin cliente)"

        celdas[(marca, anio, mes)][0] += monto
        celdas[(marca, anio, mes)][1] += cant
        clientes[marca][cli][anio][0] += monto
        clientes[marca][cli][anio][1] += cant
        cli_mes[(cli, anio, mes)][0] += monto
        cli_mes[(cli, anio, mes)][1] += cant
        cli_marca[cli][marca] += monto
        cli_mm[(cli, marca, anio, mes)][0] += monto
        cli_mm[(cli, marca, anio, mes)][1] += cant
        periodos.add((anio, mes))

    if not celdas:
        return {}

    per = sorted(periodos, key=lambda p: (int(p[0]), p[1]))
    meses = [{"a": a, "m": m, "lbl": f"{MESES_ABR[m-1]} {a[2:]}"} for a, m in per]
    n = len(per)
    idx = {p: i for i, p in enumerate(per)}

    anios = sorted({a for a, _ in per})
    marcas = sorted({m for (m, _, _) in celdas})
    out = {}
    for marca in marcas:
        monto = [0.0] * n
        cant  = [0.0] * n
        for (mk, a, m), (v, q) in celdas.items():
            if mk != marca:
                continue
            i = idx[(a, m)]
            monto[i] += v
            cant[i]  += q
        # Lista completa de clientes abierta por año: el panel arma el top
        # según el año seleccionado.
        cli_out = []
        for c, por_anio in clientes[marca].items():
            reg = {"c": c}
            for a in anios:
                v, q = por_anio.get(a, [0.0, 0.0])
                reg["m" + a[2:]] = round(v)
                reg["q" + a[2:]] = round(q)
            cli_out.append(reg)
        cli_out.sort(key=lambda r: -sum(r[k] for k in r if k.startswith("m")))
        out[marca] = {
            "monto":      [round(x) for x in monto],
            "cant":       [round(x) for x in cant],
            "monto_tot":  round(sum(monto)),
            "cant_tot":   round(sum(cant)),
            "n_clientes": len(cli_out),
            "clientes":   cli_out,
        }

    marcas_sorted = sorted(out, key=lambda m: -out[m]["monto_tot"])
    tot_monto = [round(sum(out[m]["monto"][i] for m in out)) for i in range(n)]
    tot_cant  = [round(sum(out[m]["cant"][i]  for m in out)) for i in range(n)]
    todos_cli = set()
    for marca in clientes:
        todos_cli.update(clientes[marca].keys())

    # Serie mensual por cliente (para el gráfico con selector de cliente)
    series_mes = defaultdict(lambda: [[0.0] * n, [0.0] * n])
    for (ck, a, m), (v, q) in cli_mes.items():
        i = idx[(a, m)]
        series_mes[ck][0][i] += v
        series_mes[ck][1][i] += q

    # Desglose mensual por marca dentro de cada cliente
    det = defaultdict(lambda: defaultdict(lambda: [[0.0] * n, [0.0] * n]))
    for (ck, mk_, a, m), (v, q) in cli_mm.items():
        i = idx[(a, m)]
        det[ck][mk_][0][i] += v
        det[ck][mk_][1][i] += q

    cli_out = {}
    for c in todos_cli:
        mo, qt = series_mes[c]
        mk = sorted(cli_marca[c].items(), key=lambda x: -x[1])
        cli_out[c] = {
            "monto":     [round(x) for x in mo],
            "cant":      [round(x) for x in qt],
            "monto_tot": round(sum(mo)),
            "cant_tot":  round(sum(qt)),
            "marcas":    [[k, round(v)] for k, v in mk],
            "n_marcas":  len(mk),
            # {marca: {"m": [n montos], "q": [n cantidades]}} ordenado por monto
            "det": {
                k: {"m": [round(x) for x in det[c][k][0]],
                    "q": [round(x) for x in det[c][k][1]]}
                for k, _ in mk
            },
        }

    return {
        "meses":       meses,
        "anios":       anios,
        "marcas":      marcas_sorted,
        "data":        out,
        "tot_monto":   tot_monto,
        "tot_cant":    tot_cant,
        "tot_monto_g": sum(tot_monto),
        "tot_cant_g":  sum(tot_cant),
        "n_clientes":  len(todos_cli),
        "cli_serie":   cli_out,
    }


def read_inventario_ts(wb):
    """Inventario de repuestos en bodega, agregado por marca y SKU.

    Fuente: hoja "Inventario Bodega" (una fila por SKU y bodega). Replica la
    tabla dinámica "TD Inventario TS": agrupa por (marca, SKU) sumando stock y
    costo total, y promediando el costo unitario — 82 SKUs aparecen en más de
    una bodega, por eso el promedio y no el valor de una fila cualquiera.

    Columnas: C=SKU, E=Descripción, G=Categoría, H=FirmName (marca),
              L=En stock, M=Costo del artículo, N=Costo Total.
    """
    ws = None
    for name in wb.sheetnames:
        if name.strip().lower() == "inventario bodega":
            ws = wb[name]
            break
    if ws is None:
        return {}

    # {marca: {sku: {"d": desc, "st": stock, "cus": [costos unit], "ct": costo total}}}
    # El costo unitario se promedia sólo a nivel SKU (82 SKU están en más de una
    # bodega). A nivel marca NO se expone un promedio: cualquier forma de
    # agregarlo es engañosa — el promedio simple pesa igual un tornillo de $47
    # que un generador de $3,8 MM, y ponderarlo por costo eleva al cuadrado los
    # SKU caros. La tabla muestra sólo stock y costo total por marca.
    marcas = defaultdict(lambda: defaultdict(lambda: {"d": "", "st": 0.0, "cus": [], "ct": 0.0}))

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 14:
            continue
        marca = safe_str(row[7]).strip()
        if not marca:
            continue
        sku = safe_str(row[2]).strip() or "(sin SKU)"
        it  = marcas[marca][sku]
        if not it["d"]:
            it["d"] = safe_str(row[4]).strip()
        it["st"] += to_float(row[11])
        it["ct"] += to_float(row[13])
        cu = row[12]
        if isinstance(cu, (int, float)):
            it["cus"].append(float(cu))


    out       = {}
    tot_stock = 0.0
    tot_costo = 0.0
    tot_skus  = 0
    for marca, skus in marcas.items():
        items = []
        m_st  = 0.0
        m_ct  = 0.0
        for sku, it in skus.items():
            cu = sum(it["cus"]) / len(it["cus"]) if it["cus"] else 0.0
            items.append({
                "sku": sku,
                "d":   it["d"],
                "st":  round(it["st"], 2),
                "cu":  round(cu),
                "ct":  round(it["ct"]),
            })
            m_st += it["st"]
            m_ct += it["ct"]
        items.sort(key=lambda x: -x["ct"])
        out[marca] = {
            "stock":   round(m_st, 2),
            "ct":      round(m_ct),
            "n_skus":  len(items),
            "items":   items,
        }
        tot_stock += m_st
        tot_costo += m_ct
        tot_skus  += len(items)

    marcas_sorted = sorted(out, key=lambda m: -out[m]["ct"])
    return {
        "marcas":      marcas_sorted,
        "data":        out,
        "total_stock": round(tot_stock, 2),
        "total_costo": round(tot_costo),
        "total_skus":  tot_skus,
        "n_marcas":    len(out),
    }


def read_ratios2(wb):
    ws = None
    for name in wb.sheetnames:
        if "ratio" in name.lower() and "2" in name:
            ws = wb[name]
            break
    if ws is None:
        return {}

    # Estructura: col B = etiqueta, Real de mes i = col (2 + i*4), 0-indexed
    # Fila 7=Ingresos, 8=Contratos, 9=Otras, 10=CdV, 11=Margen, 12=Margen%,
    # 14=Empleados, 15=Otros, 17=EBITDA Directo, 20=GAV Indirecto, 30=EBITDA Empresa
    MAX_MONTHS = 12
    MAX_COL    = max(2 + MAX_MONTHS * 4 + 1, 2 + MAX_MONTHS * 2 + 1)  # cubre formato EERR y RATIOS

    rows = list(ws.iter_rows(min_row=1, max_row=70, max_col=MAX_COL, values_only=True))

    MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

    def get_val(row_idx, col_idx):
        row = rows[row_idx] if row_idx < len(rows) else []
        if col_idx < len(row) and row[col_idx] is not None:
            try: return float(row[col_idx])
            except: return 0.0
        return 0.0

    def get_real(row_idx, month_i):   return get_val(row_idx, 2 + month_i * 4)
    def get_ptto(row_idx, month_i):   return get_val(row_idx, 3 + month_i * 4)
    def get_var(row_idx, month_i):    return get_val(row_idx, 4 + month_i * 4)
    def get_varpct(row_idx, month_i): return get_val(row_idx, 5 + month_i * 4)

    def arr(row_idx, n):    return [round(get_real(row_idx, i),   3) for i in range(n)]
    def arrp(row_idx, n):   return [round(get_ptto(row_idx, i),   3) for i in range(n)]
    def arrv(row_idx, n):   return [round(get_var(row_idx, i),    3) for i in range(n)]
    def arrvp(row_idx, n):  return [round(get_varpct(row_idx, i), 4) for i in range(n)]

    # Detectar mes_cierre: meses consecutivos con Ingresos != 0 (row 7 → idx 6)
    # Paramos en el primer cero para no capturar columna Total al final
    mes_cierre = 0
    for i in range(MAX_MONTHS):
        if abs(get_real(6, i)) > 0.001:
            mes_cierre = i + 1
        else:
            break
    if mes_cierre == 0:
        return {}

    n = mes_cierre
    pct  = lambda idx: [round(get_real(idx, i),   4) for i in range(n)]
    pctp = lambda idx: [round(get_ptto(idx, i),   4) for i in range(n)]
    pctv = lambda idx: [round(get_var(idx, i),    4) for i in range(n)]
    pctvp= lambda idx: [round(get_varpct(idx, i), 4) for i in range(n)]

    def row4(ri):  # (real, ptto, var, varpct) para filas MM$
        return arr(ri,n), arrp(ri,n), arrv(ri,n), arrvp(ri,n)
    def pct4(ri):  # idem para filas %
        return pct(ri), pctp(ri), pctv(ri), pctvp(ri)

    r6,  p6,  v6,  vp6  = row4(6)
    r7,  p7,  v7,  vp7  = row4(7)
    r8,  p8,  v8,  vp8  = row4(8)
    r9,  p9,  v9,  vp9  = row4(9)
    r10, p10, v10, vp10 = row4(10)
    r11, p11, v11, vp11 = pct4(11)
    r13, p13, v13, vp13 = row4(13)
    r14, p14, v14, vp14 = row4(14)
    r16, p16, v16, vp16 = row4(16)
    r17, p17, v17, vp17 = pct4(17)
    r19, p19, v19, vp19 = row4(19)
    r20, p20, v20, vp20 = row4(20)
    r21, p21, v21, vp21 = row4(21)
    r22, p22, v22, vp22 = row4(22)
    r23, p23, v23, vp23 = row4(23)
    r24, p24, v24, vp24 = row4(24)
    r25, p25, v25, vp25 = row4(25)
    r27, p27, v27, vp27 = row4(27)
    r29, p29, v29, vp29 = row4(29)
    r32, p32, v32, vp32 = row4(32)
    r33, p33, v33, vp33 = row4(33)
    r35, p35, v35, vp35 = row4(35)
    r36, p36, v36, vp36 = row4(36)
    r37, p37, v37, vp37 = row4(37)
    r38, p38, v38, vp38 = row4(38)
    r39, p39, v39, vp39 = row4(39)
    r40, p40, v40, vp40 = row4(40)
    r42, p42, v42, vp42 = row4(42)
    r44, p44, v44, vp44 = row4(44)
    r45, p45, v45, vp45 = row4(45)

    return {
        "mes_cierre": mes_cierre, "meses": MESES[:n],
        # Ingresos
        "ingresos_totales":  r6,  "ingresos_totales_p":  p6,  "ingresos_totales_v":  v6,  "ingresos_totales_vp":  vp6,
        "ingresos_contratos":r7,  "ingresos_contratos_p":p7,  "ingresos_contratos_v":v7,  "ingresos_contratos_vp":vp7,
        "ingresos_otras":    r8,  "ingresos_otras_p":    p8,  "ingresos_otras_v":    v8,  "ingresos_otras_vp":    vp8,
        # Costo y margen
        "costo_ventas":      r9,  "costo_ventas_p":      p9,  "costo_ventas_v":      v9,  "costo_ventas_vp":      vp9,
        "margen_mm":         r10, "margen_mm_p":         p10, "margen_mm_v":         v10, "margen_mm_vp":         vp10,
        "margen_pct":        r11, "margen_pct_p":        p11, "margen_pct_v":        v11, "margen_pct_vp":        vp11,
        # Gastos directos
        "gastos_empleados":  r13, "gastos_empleados_p":  p13, "gastos_empleados_v":  v13, "gastos_empleados_vp":  vp13,
        "otros_gastos":      r14, "otros_gastos_p":      p14, "otros_gastos_v":      v14, "otros_gastos_vp":      vp14,
        # EBITDA Directo
        "ebitda_directo":       r16, "ebitda_directo_p":       p16, "ebitda_directo_v":       v16, "ebitda_directo_vp":       vp16,
        "ebitda_directo_pct":   r17, "ebitda_directo_pct_p":   p17, "ebitda_directo_pct_v":   v17, "ebitda_directo_pct_vp":   vp17,
        # GAV Indirecto
        "gav_indirecto":     r19, "gav_indirecto_p":     p19, "gav_indirecto_v":     v19, "gav_indirecto_vp":     vp19,
        "ebitda_indirecto":  r20, "ebitda_indirecto_p":  p20, "ebitda_indirecto_v":  v20, "ebitda_indirecto_vp":  vp20,
        # Gastos adicionales
        "finiquitos":             r21, "finiquitos_p":             p21, "finiquitos_v":             v21, "finiquitos_vp":             vp21,
        "multas":                 r22, "multas_p":                 p22, "multas_v":                 v22, "multas_vp":                 vp22,
        "prov_obsolescencias":    r23, "prov_obsolescencias_p":    p23, "prov_obsolescencias_v":    v23, "prov_obsolescencias_vp":    vp23,
        "prov_incobrables":       r24, "prov_incobrables_p":       p24, "prov_incobrables_v":       v24, "prov_incobrables_vp":       vp24,
        "prov_habilitacion":      r25, "prov_habilitacion_p":      p25, "prov_habilitacion_v":      v25, "prov_habilitacion_vp":      vp25,
        "total_gastos_adicionales":r27,"total_gastos_adicionales_p":p27,"total_gastos_adicionales_v":v27,"total_gastos_adicionales_vp":vp27,
        # EBITDA Empresa
        "ebitda_empresa":    r29, "ebitda_empresa_p":    p29, "ebitda_empresa_v":    v29, "ebitda_empresa_vp":    vp29,
        # Depreciación
        "depreciacion":      r32, "depreciacion_p":      p32, "depreciacion_v":      v32, "depreciacion_vp":      vp32,
        "resultado_operacional":  r33, "resultado_operacional_p":  p33, "resultado_operacional_v":  v33, "resultado_operacional_vp":  vp33,
        # No operacional
        "otros_ingresos_funcion": r35, "otros_ingresos_funcion_p": p35, "otros_ingresos_funcion_v": v35, "otros_ingresos_funcion_vp": vp35,
        "ingreso_financiero":     r36, "ingreso_financiero_p":     p36, "ingreso_financiero_v":     v36, "ingreso_financiero_vp":     vp36,
        "costo_financiero":       r37, "costo_financiero_p":       p37, "costo_financiero_v":       v37, "costo_financiero_vp":       vp37,
        "otros_gastos_funcion":   r38, "otros_gastos_funcion_p":   p38, "otros_gastos_funcion_v":   v38, "otros_gastos_funcion_vp":   vp38,
        "diferencia_cambio":      r39, "diferencia_cambio_p":      p39, "diferencia_cambio_v":      v39, "diferencia_cambio_vp":      vp39,
        "resultado_no_operacional":r40,"resultado_no_operacional_p":p40,"resultado_no_operacional_v":v40,"resultado_no_operacional_vp":vp40,
        # Resultado final
        "resultado_antes_imp":  r42, "resultado_antes_imp_p":  p42, "resultado_antes_imp_v":  v42, "resultado_antes_imp_vp":  vp42,
        "impuesto_renta":       r44, "impuesto_renta_p":       p44, "impuesto_renta_v":       v44, "impuesto_renta_vp":       vp44,
        "resultado_ejercicio":  r45, "resultado_ejercicio_p":  p45, "resultado_ejercicio_v":  v45, "resultado_ejercicio_vp":  vp45,
        # ── SECCIÓN RATIOS (filas 49-64, 2 cols/mes: Real=col[2+i*2], PTTO=col[3+i*2]) ──
        # Detectar cuántos meses tienen datos reales válidos en la sección RATIOS
        **_read_ratios_section(rows, MESES),
    }


def _read_ratios_section(rows, MESES):
    """Lee la sección RATIOS (filas 49-64) de Ratio Costos 2.
    Formato: 2 columnas por mes (Real = col[2+i*2], PTTO = col[3+i*2]).
    Filas clave (índice 0-based desde fila Excel 1):
      52 → Ingresos ordinarios, 53 → Contratos, 54 → Otras actividades
      55 → Costo Total, 56 → Costo de ventas
      58 → Empleados directos, 59 → Otros directos
      60 → GAV Indirecto, 61 → GAV Total, 63 → Margen del Producto
    """
    def gv(row_idx, col_idx):
        row = rows[row_idx] if row_idx < len(rows) else []
        if col_idx < len(row) and row[col_idx] is not None:
            try: return float(row[col_idx])
            except: return 0.0
        return 0.0

    def real(ri, i): return round(gv(ri, 2 + i * 2), 3)
    def ptto(ri, i): return round(gv(ri, 3 + i * 2), 3)

    # Detectar meses con datos (fila 53 = index 52, Ingresos)
    n_r = 0
    for i in range(12):
        if abs(gv(52, 2 + i * 2)) > 0.01:
            n_r = i + 1
        else:
            break

    if n_r == 0:
        return {"ratios_kpis": {}}

    def arr_r(ri): return [real(ri, i) for i in range(n_r)]
    def arr_p(ri): return [ptto(ri, i) for i in range(n_r)]

    return {
        "ratios_kpis": {
            "n": n_r,
            "meses": MESES[:n_r],
            "ingresos_r":     arr_r(52), "ingresos_p":     arr_p(52),   # fila 53
            "contratos_r":    arr_r(53), "contratos_p":    arr_p(53),   # fila 54
            "otras_r":        arr_r(54), "otras_p":        arr_p(54),   # fila 55
            "costo_total_r":  arr_r(55), "costo_total_p":  arr_p(55),   # fila 56
            "cdv_r":          arr_r(56), "cdv_p":          arr_p(56),   # fila 57
            "empleados_r":    arr_r(58), "empleados_p":    arr_p(58),   # fila 59
            "otros_dir_r":    arr_r(59), "otros_dir_p":    arr_p(59),   # fila 60
            "gav_ind_r":      arr_r(60), "gav_ind_p":      arr_p(60),   # fila 61
            "gav_total_r":    arr_r(61), "gav_total_p":    arr_p(61),   # fila 62
            "margen_prod_r":  arr_r(63), "margen_prod_p":  arr_p(63),   # fila 64
        }
    }


def read_resumen_tipos_programas(wb):
    ws = wb['Resumen Tipos Programas']
    rows_out = []
    for row in ws.iter_rows(min_row=3, max_row=7, values_only=True):
        prog = safe_str(row[1]) if row[1] else ""
        if not prog:
            continue
        rows_out.append({
            "programa":        prog,
            "clientes":        round(to_float(row[2])),
            "contratos":       to_int(row[3]),
            "fac_promedio":    round(to_float(row[4])),
            "fac_esperada":    round(to_float(row[5])),
            "pct_cartera":     round(to_float(row[6]), 4) if row[6] is not None else None,
            "pct_margen":      round(to_float(row[7]), 4) if row[7] is not None else None,
            "margen_total":    round(to_float(row[8])),
            "margen_promedio": round(to_float(row[9])),
            "dur_promedio":    round(to_float(row[10]), 1),
            "vig_promedio":    round(to_float(row[11]), 1),
        })
    return rows_out


def enrich_mapa_data(mapa_data, contratos, satisf):
    """Agrega conteo de contratos activos y satisfacción. cc ya viene del Excel."""
    active_by_cli = {}
    for c in contratos:
        if c["estado"] != "Activado":
            continue
        cli = c["cliente"].upper().strip()
        active_by_cli[cli] = active_by_cli.get(cli, 0) + 1

    # Satisfacción: calidad 0–7 → escala 1–5
    sat_by_inst = {}
    for inst in satisf.get("instituciones", []):
        key = inst["institucion"].upper().strip()
        cal = inst.get("calidad", 0)
        if cal and cal > 0:
            sat_by_inst[key] = round(1 + (cal / 7) * 4, 1)

    for c in mapa_data:
        cli = c["n"].upper().strip()
        c["contratos"] = active_by_cli.get(cli, 0)
        # cc ya viene de col AA — no se sobrescribe
        # sat: si col AB tiene valor lo respeta; si es None usa el cruce con SATISFACCION
        if c["sat"] is None:
            c["sat"] = sat_by_inst.get(cli, None)

    return mapa_data


# ══════════════════════════════════════════════════════════════════════════════
# 6b. DESGLOSE DE INGRESOS — Ingreso por Contratos (por línea de negocio) +
#     Otros Ingresos (Trazabilidad / REAS / Marca). Reconciliado 1:1 con la
#     facturación real mensual (fac_arr) y con contr_real_monthly.
# ══════════════════════════════════════════════════════════════════════════════
def compute_desglose_ingresos(contratos, panel_raw, bbdd, contr_real_monthly, fac_arr, mes_corte, mapa_data=None):
    n = mes_corte
    if n <= 0:
        return {}

    contratos_by_cli = defaultdict(list)
    for c in contratos:
        contratos_by_cli[c["cliente"]].append(c)

    LINEAS = ["Esterilización", "Endoscopía", "Dental"]
    linea_month = {L: [0.0] * n for L in LINEAS}

    # Reparte la facturación real de contratos de cada cliente/mes entre sus
    # líneas de negocio, ponderando por el valor mensual de los contratos que
    # facturan ese mes (fallback: valor anual si ese mes no tiene flags activos).
    for p in panel_raw:
        real_arr = p.get("contr_meses_2026") or [0.0] * 12
        cons = contratos_by_cli.get(p["cliente"], [])
        for m in range(n):
            real_m = real_arr[m] if m < len(real_arr) else 0.0
            if abs(real_m) < 1:
                continue
            weights = defaultdict(float)
            for c in cons:
                if c["fact_flags"][m]:
                    weights[c["linea_negocio"]] += c["val_mes"]
            wsum = sum(weights.values())
            if wsum <= 0:
                weights = defaultdict(float)
                for c in cons:
                    weights[c["linea_negocio"]] += c["val"]
                wsum = sum(weights.values())
            if wsum <= 0:
                weights = {"Esterilización": 1.0}
                wsum = 1.0
            for L, w in weights.items():
                linea_month[L][m] += real_m * (w / wsum)

    # Escala cada mes para calzar exacto con contr_real_monthly (misma fuente que
    # "Ingresos por contratos" en EERR): corrige el pequeño drift de redondeo.
    for m in range(n):
        actual = sum(linea_month[L][m] for L in LINEAS)
        target = contr_real_monthly[m] if m < len(contr_real_monthly) else 0.0
        if abs(actual) > 1e-6:
            scale = target / actual
            for L in LINEAS:
                linea_month[L][m] *= scale

    # Otros ingresos = facturación real − ingreso por contratos, desglosado en
    # Trazabilidad + REAS (catálogos propios) y el resto de "Servicio Técnico"
    # (correctiva, repuestos sueltos, etc.) prorrateado por Marca.
    traz_mensual     = bbdd.get("traz_mensual", [0.0] * 12)
    reas_mensual     = bbdd.get("reas_mensual", [0.0] * 12)
    marca_mensual    = bbdd.get("marca_mensual", {})
    st_total_mensual = bbdd.get("st_total_mensual", [0.0] * 12)

    otros_total_month = [
        (fac_arr[m] if m < len(fac_arr) else 0.0) - (contr_real_monthly[m] if m < len(contr_real_monthly) else 0.0)
        for m in range(n)
    ]

    marca_month = {mk: [0.0] * n for mk in TOP_MARCAS_DESGLOSE + ["Otras Marcas"]}
    for m in range(n):
        tz = traz_mensual[m] if m < len(traz_mensual) else 0.0
        rs = reas_mensual[m] if m < len(reas_mensual) else 0.0
        remainder = otros_total_month[m] - tz - rs
        st_tot = st_total_mensual[m] if m < len(st_total_mensual) else 0.0
        if abs(st_tot) > 1e-6:
            used = 0.0
            for mk in TOP_MARCAS_DESGLOSE:
                serie = marca_mensual.get(mk, [0.0] * 12)
                amt = serie[m] if m < len(serie) else 0.0
                marca_month[mk][m] = remainder * (amt / st_tot)
                used += amt
            marca_month["Otras Marcas"][m] = remainder * ((st_tot - used) / st_tot)
        else:
            marca_month["Otras Marcas"][m] = remainder

    # Reclasificación de "Otros Ingresos" por tipo de reparación:
    # - Trazabilidad se fusiona con la marca ICTGroup (equipos de trazabilidad).
    # - Steelco (autoclaves) → 100% Reparación Esterilización.
    # - Pentax Medical (endoscopios) → 100% Reparación Endoscopía.
    # - El resto de marcas sin línea propia (TECSERVICE, Nacional, Otras Marcas)
    #   se prorratea usando las mismas proporciones mensuales de Ingreso por
    #   Contratos (Esterilización/Endoscopía/Dental); si un mes no tiene ingreso
    #   por contratos (ej. mes en curso sin datos aún), se usa la proporción
    #   promedio del período.
    total_linea_periodo = {L: sum(linea_month[L]) for L in LINEAS}
    total_linea_periodo_sum = sum(total_linea_periodo.values())
    fallback_prop = {
        L: (total_linea_periodo[L] / total_linea_periodo_sum if total_linea_periodo_sum > 0 else 1.0 / len(LINEAS))
        for L in LINEAS
    }

    remainder_pool_month = [
        marca_month["TECSERVICE"][m] + marca_month["NACIONAL"][m] + marca_month["Otras Marcas"][m]
        for m in range(n)
    ]
    reparacion_month = {L: [0.0] * n for L in LINEAS}
    for m in range(n):
        mes_total = sum(linea_month[L][m] for L in LINEAS)
        for L in LINEAS:
            prop = (linea_month[L][m] / mes_total) if mes_total > 1e-6 else fallback_prop[L]
            reparacion_month[L][m] = remainder_pool_month[m] * prop
    reparacion_month["Esterilización"] = [
        reparacion_month["Esterilización"][m] + marca_month["STEELCO"][m] for m in range(n)
    ]
    reparacion_month["Endoscopía"] = [
        reparacion_month["Endoscopía"][m] + marca_month["PENTAX MEDICAL"][m] for m in range(n)
    ]
    trazabilidad_month = [
        (traz_mensual[m] if m < len(traz_mensual) else 0.0) + marca_month["ICTGROUP"][m] for m in range(n)
    ]

    MM = 1_000_000.0
    def to_mm(arr):
        return [round(v / MM, 3) for v in arr]
    def with_total(arr):
        return arr + [round(sum(arr), 3)]

    meses_lbl = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio",
                 "Agosto","Septiembre","Octubre","Noviembre","Diciembre"][:n]

    contratos_lineas = [
        {"key": "esterilizacion", "label": "Esterilización", "valores": with_total(to_mm(linea_month["Esterilización"]))},
        {"key": "endoscopia",     "label": "Endoscopía",     "valores": with_total(to_mm(linea_month["Endoscopía"]))},
        {"key": "dental",         "label": "Dental",         "valores": with_total(to_mm(linea_month["Dental"]))},
    ]
    contratos_total = with_total(to_mm([contr_real_monthly[m] if m < len(contr_real_monthly) else 0.0 for m in range(n)]))

    otros_categorias = [
        {"key": "trazabilidad",              "label": "Trazabilidad",              "valores": with_total(to_mm(trazabilidad_month))},
        {"key": "reas",                       "label": "REAS",                      "valores": with_total(to_mm(reas_mensual[:n]))},
        {"key": "reparacion_esterilizacion", "label": "Reparación Esterilización", "valores": with_total(to_mm(reparacion_month["Esterilización"]))},
        {"key": "reparacion_endoscopia",      "label": "Reparación Endoscopía",     "valores": with_total(to_mm(reparacion_month["Endoscopía"]))},
        {"key": "reparacion_dental",          "label": "Reparación Dental",         "valores": with_total(to_mm(reparacion_month["Dental"]))},
    ]
    otros_total = with_total(to_mm(otros_total_month))

    total_general = with_total(to_mm([fac_arr[m] if m < len(fac_arr) else 0.0 for m in range(n)]))

    # ── Desglose por región ──────────────────────────────────────
    # Usa la MISMA fuente que la tabla global:
    #   - Contratos: contr_meses_2026 por cliente (= contr_real_monthly global)
    #   - Líneas: misma lógica de ponderación que linea_month global
    #   - Otros: prorrateo proporcional de otros_total_month global
    # Así los totales suman exacto a la tabla de desglose.
    cli_to_region = {}
    if mapa_data:
        for entry in mapa_data:
            nombre = entry.get("n", "")
            if nombre:
                r = (entry.get("region") or "Sin región").strip() or "Sin región"
                cli_to_region[nombre] = r

    # Contratos y desglose por línea por región
    reg_con  = {}   # {region: [n floats]} contratos brutos
    reg_lin  = {}   # {region: {linea: [n floats]}} contratos por línea

    for p in panel_raw:
        cli    = p["cliente"]
        region = cli_to_region.get(cli, "Sin región")
        if region not in reg_con:
            reg_con[region] = [0.0] * n
            reg_lin[region] = {L: [0.0] * n for L in LINEAS}
        cons = contratos_by_cli.get(cli, [])
        ca   = p.get("contr_meses_2026") or [0.0] * 12
        for m in range(n):
            real_m = ca[m] if m < len(ca) else 0.0
            reg_con[region][m] += real_m
            if abs(real_m) < 1:
                continue
            # misma lógica de ponderación por línea que linea_month
            weights = defaultdict(float)
            for c in cons:
                if c["fact_flags"][m]:
                    weights[c["linea_negocio"]] += c["val_mes"]
            wsum = sum(weights.values())
            if wsum <= 0:
                weights = defaultdict(float)
                for c in cons:
                    weights[c["linea_negocio"]] += c["val"]
                wsum = sum(weights.values())
            if wsum <= 0:
                weights = {"Esterilización": 1.0}
                wsum = 1.0
            for L, w in weights.items():
                if L in reg_lin[region]:
                    reg_lin[region][L][m] += real_m * (w / wsum)

    # Otros: prorrateo proporcional de otros_total_month global
    reg_out = {}
    for r, con_arr in reg_con.items():
        con_mm = to_mm(con_arr)
        otr_arr = []
        for m in range(n):
            prop = (con_arr[m] / contr_real_monthly[m]) if (m < len(contr_real_monthly) and contr_real_monthly[m] > 1) else 0.0
            otr_arr.append(otros_total_month[m] * prop if m < len(otros_total_month) else 0.0)
        otr_mm  = to_mm(otr_arr)
        tot_mm  = [round(con_mm[m] + otr_mm[m], 3) for m in range(n)]
        rlm     = reg_lin.get(r, {L: [0.0]*n for L in LINEAS})
        reg_out[r] = {
            "contratos": with_total(con_mm),
            "otros":     with_total(otr_mm),
            "total":     with_total(tot_mm),
            "lineas": {L: with_total(to_mm(rlm.get(L, [0.0]*n))) for L in LINEAS},
        }

    regiones_sorted = sorted(reg_out, key=lambda r: reg_out[r]["contratos"][n], reverse=True)

    return {
        "meses": meses_lbl,
        "contratos": {"lineas": contratos_lineas, "total": contratos_total},
        "otros":     {"categorias": otros_categorias, "total": otros_total},
        "total_general": total_general,
        "por_region": {"regiones": regiones_sorted, "data": reg_out},
    }


# ══════════════════════════════════════════════════════════════════════════════
# 7. ENSAMBLAR APP_DATA
# ══════════════════════════════════════════════════════════════════════════════
def build_app_data(contratos, panel_raw, bbdd, visitas, satisf, mes_corte, analisis_fac=None, base_instalada=None, mapa_data=None):

    # Lookups from CONTRATOS
    coord_by_cli   = {}
    presup_by_cli  = defaultdict(float)   # sum of val_anual for active COM contracts
    fin_contrato_by_cli  = {}  # última fecha de fin de contrato activo por cliente
    fin_fmt_by_cli       = {}
    inicio_fmt_by_cli    = {}
    dias_inicio_by_cli   = {}
    for c in contratos:
        if c["estado"] != "Activado":
            continue
        cli = c["cliente"]
        if c["coord"] and c["coord"] not in ("", "None"):
            coord_by_cli[cli] = c["coord"]
        if c["tipo"] == "Comercial":
            presup_by_cli[cli] += c["val"]
        # Guardar la fecha de fin más lejana (mayor cobertura para alertas)
        if cli not in fin_contrato_by_cli or c["fin"] > fin_contrato_by_cli[cli]:
            fin_contrato_by_cli[cli] = c["fin"]
            fin_fmt_by_cli[cli]      = c["fin_fmt"]
        # Guardar la fecha de inicio más antigua
        if cli not in inicio_fmt_by_cli or c["inicio"] < inicio_fmt_by_cli.get(cli + "_iso", "9999"):
            inicio_fmt_by_cli[cli]         = c["inicio_fmt"]
            inicio_fmt_by_cli[cli + "_iso"] = c["inicio"]
            dias_inicio_by_cli[cli]        = c["tpo_activo"]

    tipo_map    = bbdd["tipo_cli_map"]
    ytd_cli_25  = bbdd["ytd_cli_2025"]
    ytd_cli_24  = bbdd["ytd_cli_2024"]

    # Clientes con contratos activos reales (para override de tiene_contrato)
    active_contract_clients = {c["cliente"] for c in contratos if c["estado"] == "Activado"}

    # Build panel (enrich with CONTRATOS + BBDD data)
    panel = []
    for p in panel_raw:
        cli = p["cliente"]
        entry = {k: v for k, v in p.items() if not k.startswith("_")}
        entry["coord"]            = coord_by_cli.get(cli, "Sin contrato")
        entry["tipo_cli"]         = safe_str(tipo_map.get(cli, "")) or "Privado"
        entry["presup_contr_anio"] = round(presup_by_cli.get(cli, 0), 2)
        # Buscar en BBDD usando NombreAnalisis primero (coincide con col H del BBDD)
        nom = p.get("nombre_analisis") or cli
        entry["real_ytd_2025"]    = round(ytd_cli_25.get(nom, ytd_cli_25.get(cli, 0)))
        entry["real_ytd_2024"]    = round(ytd_cli_24.get(nom, ytd_cli_24.get(cli, 0)))
        entry["fin_contrato"]     = fin_contrato_by_cli.get(cli, "")
        entry["fin_fmt"]          = fin_fmt_by_cli.get(cli, "")
        entry["inicio_fmt"]       = inicio_fmt_by_cli.get(cli, "")
        entry["dias_inicio"]      = dias_inicio_by_cli.get(cli, None)
        # Override: tiene_contrato = True solo si hay contrato ACTIVO en CONTRATOS TODOS
        entry["tiene_contrato"]   = cli in active_contract_clients
        panel.append(entry)

    # Monthly arrays helper
    def to_arr(d, year):
        yd = d.get(year, {})
        return [round(yd.get(m + 1, 0)) for m in range(12)]

    # presup_contr: expected monthly contract billing from CONTRATOS billing schedule
    presup_contr = [0.0] * 12
    for c in contratos:
        if c["estado"] == "Activado":
            for m in range(12):
                if c["fact_flags"][m]:
                    presup_contr[m] += c["val_mes"]
    presup_contr = [round(v, 2) for v in presup_contr]

    # YTD aggregates per year
    def ytd_agg(d, year):
        yd = d.get(year, {})
        tot_ytd  = round(sum(yd.get(m + 1, 0) for m in range(mes_corte)))
        tot_anio = round(sum(yd.get(m + 1, 0) for m in range(12)))
        return {"tot_ytd": tot_ytd, "tot_anio": tot_anio}

    mt = bbdd["mensual_total"]
    ytd = {
        str(ANO - 2): ytd_agg(mt, ANO - 2),
        str(ANO - 1): ytd_agg(mt, ANO - 1),
        str(ANO):     ytd_agg(mt, ANO),
    }

    # Contratos mensuales: suma de col AZ-BK (idx 51-62) de FACTURACIÓN por mes
    contr_real_monthly = [0.0] * 12
    for p in panel_raw:
        for m in range(12):
            contr_real_monthly[m] += p.get("contr_meses_2026", [0]*12)[m]
    contr_real_monthly = [round(v) for v in contr_real_monthly]
    # Otras = total facturado (BBDD filtrada) - contratos (mínimo 0)
    _fac_arr = to_arr(bbdd["mensual_facturado"], ANO)
    nocontr_real_monthly = [max(0, _fac_arr[m] - contr_real_monthly[m]) for m in range(12)]

    desglose_ingresos = compute_desglose_ingresos(contratos, panel_raw, bbdd, contr_real_monthly, _fac_arr, mes_corte, mapa_data=mapa_data)

    _MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
              "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

    _mes_nom = _MESES[mes_corte - 1] if 1 <= mes_corte <= 12 else "—"
    return {
        "mes_corte":        mes_corte,
        "mes_corte_nombre": _mes_nom,
        "periodo_nota":     f"Comparativo YTD: Ene–{_mes_nom} {ANO} vs Ene–{_mes_nom} {ANO-1} y {ANO-2}",
        "hoy":              TODAY.isoformat(),
        "ytd_contr_2024":   round(bbdd.get("ytd_contr_2024", 0)),
        "ytd_contr_2025":   round(bbdd.get("ytd_contr_2025", 0)),
        "panel":   panel,
        "mensual": {
            "total":        {str(y): to_arr(mt, y) for y in [ANO - 2, ANO - 1, ANO]},
            "facturado":    {str(y): to_arr(bbdd["mensual_facturado"], y) for y in [ANO - 2, ANO - 1, ANO]},
            "priv":         {str(y): to_arr(bbdd["mensual_priv"], y) for y in [ANO - 2, ANO - 1, ANO]},
            "pub":          {str(y): to_arr(bbdd["mensual_pub"],  y) for y in [ANO - 2, ANO - 1, ANO]},
            "presup_contr": presup_contr,
            "contr_real":   contr_real_monthly,
            "nocontr_real": nocontr_real_monthly,
            "por_ejecutivo": {
                eje: {str(y): to_arr(data, y) for y in [ANO - 2, ANO - 1, ANO]}
                for eje, data in bbdd.get("mensual_por_ejecutivo", {}).items()
            },
        },
        "ytd":                  ytd,
        "ppto_anual_total":     PPTO_ANUAL_TOTAL,
        "ppto_anual_contratos": round(PPTO_ANUAL_TOTAL * 0.5),
        "presup_mes_contr":     presup_contr,
        "satisf":               satisf,
        "visitas":              visitas,
        "analisis_fac":         analisis_fac or {},
        "base_instalada":       base_instalada or {"total":0,"por_linea":{},"por_tipo":[],"por_estado":{},"clientes":[]},
        "desglose_ingresos":    desglose_ingresos,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 7. CONSTRUIR DATA, NC_DATA, PERDIDOS_VG
# ══════════════════════════════════════════════════════════════════════════════
_DATA_EXCLUDE = {"fact_flags", "estado", "real_ytd", "real_2025", "real_2024"}

def _tiene_sucesor_reciente(contratos_cliente, ventana_dias=30):
    """True si, tras el contrato Expirado más reciente de un cliente, existe
    OTRO contrato (cualquier estado) cuyo inicio cae dentro de +/- ventana_dias
    respecto a esa fecha de término y que extiende la cobertura (termina
    después). Sirve para no marcar como "perdido" a un cliente que renovó
    pero cuyo contrato nuevo aún figura con Estado desactualizado en el Excel
    (mismo patrón de desfase que #198/#200 de Endoscopía)."""
    expirados = [c for c in contratos_cliente if c["estado"] != "Activado"]
    if not expirados:
        return False
    ultimo = max(expirados, key=lambda c: c["fin"])
    ultimo_fin = date.fromisoformat(ultimo["fin"])
    for c in contratos_cliente:
        if c is ultimo:
            continue
        c_fin = date.fromisoformat(c["fin"])
        if c_fin <= ultimo_fin:
            continue  # no extiende la cobertura del cliente
        c_inicio = date.fromisoformat(c["inicio"])
        if abs((c_inicio - ultimo_fin).days) <= ventana_dias:
            return True
    return False


def clientes_con_contrato_vigente(contratos):
    """Clientes con contrato REALMENTE vigente: Estado="Activado" en el Excel Y
    fecha de término aún no pasada.

    La columna Estado de CONTRATOS TODOS se actualiza a mano y queda atrasada:
    hay contratos marcados "Activado" cuya fecha venció hace semanas. Si sólo se
    mira Estado, un cliente que de verdad no continuó se cuenta como Renovado.
    Ver SUPUESTOS.txt punto 7a."""
    return {
        c["cliente"] for c in contratos
        if c["estado"] == "Activado" and c["dias_vence"] >= 0
    }


def corregir_estado_relacion(panel_raw, contratos):
    """Reconcilia el flag manual "No Continuó" de FACTURACIÓN con los contratos.

    Se aplica UNA sola vez sobre panel_raw, antes de construir APP_DATA.panel y
    DATA, para que todas las hojas muestren el mismo estado para un mismo
    cliente. Antes había dos fuentes divergentes: la tabla de detalle leía el
    flag crudo (Perdido) y Vencimientos/Visión General leían el corregido
    (Renovado), así que el mismo cliente aparecía distinto según la hoja."""
    vigentes = clientes_con_contrato_vigente(contratos)
    corregidos = []
    for p in panel_raw:
        if p.get("estado_relacion") == "Perdido" and p["cliente"] in vigentes:
            # El flag manual quedó atrasado: el cliente sí renovó y tiene un
            # contrato con fecha vigente.
            p["estado_relacion"] = "Renovado"
            p["_no_continuo"]    = False
            p["tiene_contrato"]  = True
            corregidos.append(p["cliente"])
    if corregidos:
        print(f"       Estado relacion corregido (No Continuo -> Renovado, tienen contrato vigente): {len(corregidos)}")
        for cli in corregidos:
            print(f"         - {cli}")
    return panel_raw


def build_data_arrays(contratos, panel_raw):
    # Lookup de estado_relacion por cliente desde FACTURACIÓN. Ya viene
    # reconciliado por corregir_estado_relacion(), así que se usa tal cual.
    panel_rel_map = {p["cliente"]: p.get("estado_relacion", "Nuevo") for p in panel_raw}
    contratos_by_cliente = defaultdict(list)
    for c in contratos:
        contratos_by_cliente[c["cliente"]].append(c)
    clientes_vigentes = clientes_con_contrato_vigente(contratos)

    # DATA: only active contracts
    data = []
    for c in contratos:
        if c["estado"] != "Activado":
            continue
        d = {k: v for k, v in c.items() if k not in _DATA_EXCLUDE}
        d["estado_relacion"] = panel_rel_map.get(c["cliente"], "Nuevo")
        data.append(d)

    # NC_DATA: new active contracts (started ≤90 days ago), all types
    nc_data = [d for d in data if d["es_nuevo"]]

    # PERDIDOS_VG: clients marked as no_continuo with no active contract
    perdidos = []
    for p in panel_raw:
        if not p.get("_no_continuo"):
            continue
        cli = p["cliente"]
        if cli in clientes_vigentes:
            continue  # Cliente renovó con otro contrato aún vigente
        if _tiene_sucesor_reciente(contratos_by_cliente.get(cli, [])):
            continue  # Renovó dentro de la ventana de 30 días; no está realmente perdido

        # Último contrato del cliente: el de término más reciente, sin importar
        # que el Excel lo siga marcando "Activado" (su fecha ya pasó).
        anteriores = [c for c in contratos if c["cliente"] == cli]
        last_c = max(anteriores, key=lambda c: c["fin"], default={}) if anteriores else {}

        perdidos.append({
            "n":              "—",
            "cliente":        cli,
            "coord":          last_c.get("coord", "—"),
            "tipo":           "Comercial",
            "inicio":         last_c.get("inicio", ""),
            "fin":            "",
            "inicio_fmt":     last_c.get("inicio_fmt", ""),
            "fin_fmt":        last_c.get("fin_fmt", ""),
            "val":            0,
            "val_mes":        0,
            "dias_vence":     -999,
            "long_dias":      0,
            "tpo_activo":     last_c.get("tpo_activo", 0),
            "pct_consumido":  100.0,
            "es_nuevo":       False,
            "estado_relacion": "Perdido",
            "fac_total":      p.get("real_anual_2024", 0) + p.get("real_anual_2025", 0) + p.get("real_ytd", 0),
            "fac_2026":       p.get("real_ytd", 0),
            "_es_perdido_fac": True,
            "fin_contrato":   last_c.get("fin", ""),
            "tipo_cli":       p.get("tipo_cli", "Privado"),
            "linea_negocio":  last_c.get("linea_negocio", "Esterilización"),
            "vendedor":       last_c.get("vendedor", "Sin vendedor"),
        })

    return data, nc_data, perdidos


# ══════════════════════════════════════════════════════════════════════════════
# 7b. BUILD ALERTA DATA — clientes con facturación bajo contrato
# ══════════════════════════════════════════════════════════════════════════════
def build_alerta_data(contratos, panel_raw, mes_corte):
    # Fuente: col AK = "SI", excluir garantías (todos los estados incluidos)
    by_cli = {}
    for c in contratos:
        if c.get("bajo_contrato") != "SI":
            continue
        if c["tipo"] == "Garantia":
            continue
        by_cli.setdefault(c["cliente"], []).append(c)

    # Mapa cliente → datos panel (para Real col H y Diferencia col D-H)
    panel_map = {p["cliente"]: p for p in panel_raw}

    result = []
    for cli, cli_contratos in by_cli.items():
        cli_contratos = sorted(cli_contratos, key=lambda x: x["inicio"])
        p = panel_map.get(cli, {})

        real_cli_total  = round(p.get("real_ytd", 0))          # col D FACTURACIÓN: total facturado al cliente
        esperado_cli    = round(p.get("presup_contr_ytd", 0))  # col H FACTURACIÓN: total contratado del cliente

        contracts_out = []
        for c in cli_contratos:
            contracts_out.append({
                "n":            c["n"],
                "coord":        c["coord"],
                "inicio_fmt":   c["inicio_fmt"],
                "fin_fmt":      c["fin_fmt"],
                "fact_flags":   c["fact_flags"],
                "n_mant_fecha": c.get("n_mant_actual", 0),   # col AF CONTRATOS TODOS
                "cuota_uf":     round(c.get("cuota_uf", 0), 2),
                "neta_mes":     round(c["val_mes"]),
                "n_mant":       c.get("n_mant", 0),
                "expected_ytd": round(c["real_ytd"]),         # col AG CONTRATOS TODOS
            })

        result.append({
            "cliente":        cli,
            "coord":          cli_contratos[0]["coord"],
            "total_expected": esperado_cli,                       # col H FACTURACIÓN
            "total_real":     real_cli_total,                     # col D FACTURACIÓN
            "total_gap":      esperado_cli - real_cli_total,      # col H − col D
            "contratos":      contracts_out,
        })

    result.sort(key=lambda x: -x["total_gap"])
    return result


# ══════════════════════════════════════════════════════════════════════════════
# 8. PARCHEAR BLOQUE DATA/APP_DATA EN EL HTML TEMPLATE
# ══════════════════════════════════════════════════════════════════════════════
def patch_html(html, data, app_data, mapa_data=None, casos_data=None, alerta_data=None):
    """Reemplaza el bloque <script>...const DATA=...;window.APP_DATA=...;</script>"""
    # Buscar "const DATA=" (con o sin espacio) y su bloque <script> contenedor
    data_idx = html.find("const DATA=")
    if data_idx == -1:
        data_idx = html.find("const DATA =")
    if data_idx == -1:
        print("  ADVERTENCIA: no se encontro 'const DATA' en el template.")
        return html

    # <script> más cercano ANTES de const DATA
    script_start = html.rfind("<script>", 0, data_idx)
    if script_start == -1:
        print("  ADVERTENCIA: no se encontro '<script>' antes de const DATA.")
        return html

    # Buscar window.APP_DATA después de const DATA (es la declaración usada en el HTML)
    app_idx = html.find("window.APP_DATA", data_idx)
    if app_idx == -1:
        print("  ADVERTENCIA: no se encontro 'window.APP_DATA' en el template.")
        return html

    # </script> inmediatamente después de window.APP_DATA
    script_end = html.find("</script>", app_idx)
    if script_end == -1:
        print("  ADVERTENCIA: no se encontro '</script>' despues de window.APP_DATA.")
        return html

    _MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
              "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    mes_nombre = _MESES[app_data["mes_corte"] - 1].upper()
    ano = app_data.get("hoy", "")[:4]

    mapa_json   = json.dumps(mapa_data   or [], ensure_ascii=False)
    casos_json  = json.dumps(casos_data  or {"casos": [], "equipos": []}, ensure_ascii=False)
    alerta_json = json.dumps(alerta_data or [], ensure_ascii=False)
    new_block = (
        "<script>\n"
        f"const DATA = {json.dumps(data, ensure_ascii=False)};\n\n"
        f"// ═══ DATOS ACTUALIZADOS A {mes_nombre} {ano} ═══\n"
        f"window.APP_DATA = {json.dumps(app_data, ensure_ascii=False)};\n"
        f"window.MAPA_DATA = {mapa_json};\n"
        f"window.CASOS_DATA = {casos_json};\n"
        f"window.ALERTA_DATA = {alerta_json};\n"
        "</script>"
    )
    return html[:script_start] + new_block + html[script_end + 9:]


# ══════════════════════════════════════════════════════════════════════════════
# 9. PARCHEAR datos.js (MES_CORTE, NC_DATA, PERDIDOS_VG)
# ══════════════════════════════════════════════════════════════════════════════
def patch_datos_js(js_content, mes_corte, nc_data, perdidos):
    # MES_CORTE
    js_content = re.sub(
        r'window\.MES_CORTE\s*=\s*\d+;',
        f"window.MES_CORTE = {mes_corte};",
        js_content,
    )
    # NC_DATA
    js_content = re.sub(
        r'const NC_DATA\s*=\s*\[.*?\];',
        f"const NC_DATA = {json.dumps(nc_data, ensure_ascii=False)};",
        js_content,
        flags=re.DOTALL,
    )
    # PERDIDOS_VG
    js_content = re.sub(
        r'const PERDIDOS_VG\s*=\s*\[.*?\];',
        f"const PERDIDOS_VG = {json.dumps(perdidos, ensure_ascii=False)};",
        js_content,
        flags=re.DOTALL,
    )
    return js_content


# ══════════════════════════════════════════════════════════════════════════════
# 10. INLINE TODOS LOS JS → HTML SELF-CONTAINED
# ══════════════════════════════════════════════════════════════════════════════
def build_final_html(html, datos_js_patched):
    for js_file in JS_FILES:
        # Build regex that matches <script src="file.js"></script>
        pattern = re.compile(
            rf'<script\s+src="{re.escape(js_file)}"\s*>\s*</script>',
            re.IGNORECASE,
        )
        if js_file == "datos.js":
            replacement = f"<script>\n{datos_js_patched}\n</script>"
        else:
            js_path = os.path.join(DIR, js_file)
            if not os.path.exists(js_path):
                print(f"  ADVERTENCIA: {js_file} no encontrado, se omite.")
                continue
            with open(js_path, encoding="utf-8") as f:
                js_content = f.read()
            replacement = f"<script>\n{js_content}\n</script>"

        # Usar lambda para evitar que re interprete backslashes del JS como escapes
        new_html = pattern.sub(lambda _: replacement, html)
        if new_html != html:
            print(f"  Inlined: {js_file}")
            html = new_html
        else:
            print(f"  ADVERTENCIA: no se encontro <script src=\"{js_file}\"> en el HTML.")

    return html


# ══════════════════════════════════════════════════════════════════════════════
# MAIN

# ══════════════════════════════════════════════════════════════════════════════
def _check_js_files():
    """Avisa si JS_FILES y $jsFiles de build.ps1 divergen.

    Son dos listas separadas: JS_FILES arma el standalone y $jsFiles arma
    index.html. Si un archivo está sólo en una, esa hoja funciona en un
    entregable y no existe en el otro, sin ningún error visible."""
    ps = os.path.join(DIR, "build.ps1")
    if not os.path.exists(ps):
        return
    with open(ps, encoding="utf-8", errors="ignore") as f:
        txt = f.read()
    m = re.search(r"\$jsFiles\s*=\s*@\((.*?)\)", txt, re.S)
    if not m:
        return
    en_ps  = set(re.findall(r"'([^']+\.js)'", m.group(1)))
    en_py  = set(JS_FILES)
    faltan_py = en_ps - en_py
    faltan_ps = en_py - en_ps
    if faltan_py:
        print(f"  AVISO: en build.ps1 pero NO en JS_FILES (faltarian en el standalone): {sorted(faltan_py)}")
    if faltan_ps:
        print(f"  AVISO: en JS_FILES pero NO en build.ps1 (faltarian en index.html): {sorted(faltan_ps)}")


def main():
    print("=" * 60)
    print("  EXTRACTOR DASHBOARD CONTRATOS TECSERVICE")
    print(f"  Excel : {os.path.basename(XLSX)}")
    print(f"  Fecha : {TODAY}  |  Ano : {ANO}")
    print("=" * 60)
    _check_js_files()

    # Detectar archivo: si existe .xlsb, convertir a xlsx temporal (siempre fresco)
    xlsx_to_use = XLSX
    if os.path.exists(XLSB):
        print(f"\n  Encontrado .xlsb — convirtiendo con Excel COM...")
        xlsx_to_use = _xlsb_to_xlsx(XLSB)
    elif not os.path.exists(XLSX):
        print(f"\nERROR: No se encontro el Excel en:\n  {XLSX}\n  ni en: {XLSB}")
        return

    if not os.path.exists(TMPL):
        print(f"\nERROR: No se encontro el template HTML en:\n  {TMPL}")
        return

    # ── Leer hojas simples con openpyxl ──────────────────────────────────────
    print("\n[1/5] Abriendo Excel con openpyxl...")
    wb = openpyxl.load_workbook(xlsx_to_use, read_only=True, data_only=True)

    print("[2/5] Leyendo CONTRATOS TODOS...")
    contratos = read_contratos(wb)
    activos   = [c for c in contratos if c["estado"] == "Activado"]
    expirados = [c for c in contratos if c["estado"] != "Activado"]
    print(f"       {len(activos)} activos | {len(expirados)} expirados/otros")

    print("[3/5] Leyendo FACTURACION...")
    panel_raw = read_facturacion(wb)
    print(f"       {len(panel_raw)} clientes en panel")

    print("[4/5] Leyendo VISITAS, SATISFACCION y BASE MAPA...")
    # Necesitamos mes_corte antes de procesar visitas; hacemos un pase rápido
    # leyendo BBDD primero (lo haremos abajo) — usamos mes=MES_CORTE provisional
    satisf = read_satisfaccion(wb)
    wb.close()
    print(f"       Satisfaccion: {satisf['global']['n']} respuestas | NPS {satisf['nps']['nps']:+}")

    # ── Leer BBDD FACTURACION con pandas ─────────────────────────────────────
    print("[5/5] Leyendo BBDD FACTURACION...")
    bbdd      = read_bbdd(xlsx_to_use)
    mes_corte = bbdd["mes_corte"]
    print(f"       MES_CORTE detectado automaticamente: {mes_corte}")

    # Ahora sí leemos visitas con mes_corte correcto
    wb2 = openpyxl.load_workbook(xlsx_to_use, read_only=True, data_only=True)
    visitas = read_visitas(wb2, mes_corte)
    analisis_fac = read_analisis_fac(wb2)
    base_instalada = read_base_instalada(wb2)
    mapa_data  = read_mapa(wb2)
    casos_data = read_casos(wb2)
    ratios2 = read_ratios2(wb2)
    resumen_programas = read_resumen_tipos_programas(wb2)
    inv_ts = read_inventario_ts(wb2)
    rep_vend = read_repuestos_vendidos(wb2)
    br_oport = read_brecha_oport(wb2)
    br_stock = read_brecha_stock(wb2)
    wb2.close()
    eg = visitas["resumen"].get("Eglys Ramirez", {})
    cr = visitas["resumen"].get("Cristian Perez", {})
    print(f"       Visitas YTD: Eglys {eg.get('tot_2026_ytd',0)} | Cristian {cr.get('tot_2026_ytd',0)}")
    ts_ytd = analisis_fac.get("ts_total_ytd", 0)
    ts_ing = analisis_fac.get("ts_ingresos", 0)
    print(f"       Analisis Fac: Ingresos TS MM${ts_ing/1e6:.1f} | Total YTD MM${ts_ytd/1e6:.1f}")
    print(f"       BASE MAPA: {len(mapa_data)} clientes con coordenadas")

    # ── Construir estructuras de datos ───────────────────────────────────────
    print("[6/6] Construyendo estructuras de datos...")
    # Reconciliar el flag manual "No Continuó" con los contratos ANTES de
    # derivar APP_DATA.panel y DATA, para que ambas fuentes coincidan.
    panel_raw = corregir_estado_relacion(panel_raw, contratos)
    app_data = build_app_data(contratos, panel_raw, bbdd, visitas, satisf, mes_corte, analisis_fac, base_instalada, mapa_data=mapa_data)
    app_data["ratios2"] = ratios2
    app_data["resumen_programas"] = resumen_programas
    app_data["inv_ts"] = inv_ts
    app_data["rep_vend"] = rep_vend
    app_data["br_oport"] = br_oport
    app_data["br_stock"] = br_stock
    if inv_ts:
        print(f"       INVENTARIO TS: {inv_ts['n_marcas']} marcas | {inv_ts['total_skus']} SKUs | "
              f"{inv_ts['total_stock']:,.0f} un | MM${inv_ts['total_costo']/1e6:,.1f}")
    if rep_vend:
        print(f"       REPUESTOS VENDIDOS: {len(rep_vend['marcas'])} marcas | {len(rep_vend['meses'])} meses "
              f"({rep_vend['meses'][0]['lbl']}-{rep_vend['meses'][-1]['lbl']}) | "
              f"{rep_vend['n_clientes']} clientes | MM${rep_vend['tot_monto_g']/1e6:,.1f} | "
              f"{rep_vend['tot_cant_g']:,.0f} un")
    # Hora fija 02:50 am (el proceso real de actualización se considera
    # completo a esa hora todos los días; el aviso por correo sale 10 min
    # después, a las 03:00 am). Si esta corrida pasa de las 02:50 am del día
    # de hoy, la próxima ocurrencia real de "02:50 am" es MAÑANA, así que la
    # fecha avanza un día — nunca queda una fecha/hora 02:50 am que ya pasó.
    _ahora_real = datetime.now()
    _ahora = _ahora_real.replace(hour=2, minute=50, second=0, microsecond=0)
    if _ahora_real > _ahora:
        _ahora += timedelta(days=1)
    app_data["actualizado_label"] = formato_actualizacion(_ahora)
    app_data["actualizado_iso"] = _ahora.isoformat()
    print(f"       {app_data['actualizado_label']}")
    data, nc_data, perdidos = build_data_arrays(contratos, panel_raw)
    total_com_val = sum(d["val"] for d in data if d["tipo"] == "Comercial")
    total_gar_val = sum(d["val"] for d in data if d["tipo"] == "Garantia")
    print(f"       DATA: {len(data)} contratos | Cartera COM: MM${total_com_val/1e6:.1f} | GAR: MM${total_gar_val/1e6:.1f} | Total: MM${(total_com_val+total_gar_val)/1e6:.1f}")
    print(f"       NC_DATA: {len(nc_data)} nuevos | PERDIDOS: {len(perdidos)}")
    alerta_data = build_alerta_data(contratos, panel_raw, mes_corte)
    print(f"       ALERTA_DATA: {len(alerta_data)} clientes con facturación bajo contrato")

    # Brecha por facturación bajo contrato: no viene de una hoja propia, se
    # deriva de ALERTA_DATA (facturación esperada por contrato − facturación
    # real), así queda siempre alineada con la hoja "Bajo Contrato" del panel.
    app_data["br_contrato"] = {
        "total":     round(sum(c.get("total_gap", 0) for c in alerta_data)),
        "esperado":  round(sum(c.get("total_expected", 0) for c in alerta_data)),
        "real":      round(sum(c.get("total_real", 0) for c in alerta_data)),
        "n_clientes": len(alerta_data),
    }
    _b = app_data["br_contrato"]
    print(f"       BRECHAS: oport MM${(br_oport.get('total',0))/1e6:,.1f} | "
          f"contrato MM${_b['total']/1e6:,.1f} | stock MM${(br_stock.get('total',0))/1e6:,.1f}")
    enrich_mapa_data(mapa_data, contratos, satisf)
    cc_count = sum(1 for c in mapa_data if c["cc"])
    print(f"       MAPA_DATA: {len(mapa_data)} clientes | {cc_count} con contrato")
    print(f"       CASOS: {len(casos_data['casos'])} casos relevantes | {len(casos_data['equipos'])} equipos detenidos")

    # ── Parchear template.html (fuente de build.ps1) ─────────────────────────
    print("\nParcheando template.html...")
    with open(TMPL, encoding="utf-8") as f:
        html = f.read()
    html = patch_html(html, data, app_data, mapa_data, casos_data, alerta_data)
    with open(TMPL, "w", encoding="utf-8") as f:
        f.write(html)
    print("  Actualizado: template.html")

    # ── Parchear y guardar datos.js ───────────────────────────────────────────
    datos_js_path = os.path.join(DIR, "datos.js")
    with open(datos_js_path, encoding="utf-8") as f:
        datos_js = f.read()
    datos_js_patched = patch_datos_js(datos_js, mes_corte, nc_data, perdidos)
    with open(datos_js_path, "w", encoding="utf-8") as f:
        f.write(datos_js_patched)
    print("  Actualizado: datos.js")

    # ── Generar dashboard standalone (v16.2) ──────────────────────────────────
    print("\nGenerando dashboard standalone...")
    html_final = build_final_html(html, datos_js_patched)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html_final)

    size_kb = round(os.path.getsize(OUT) / 1024)
    print()
    print("=" * 60)
    print("  LISTO")
    print(f"  template.html  : actualizado con datos nuevos")
    print(f"  datos.js       : actualizado (MES_CORTE, NC_DATA, PERDIDOS)")
    print(f"  Standalone     : {os.path.basename(OUT)} ({size_kb} KB)")
    print(f"  MES_CORTE : {mes_corte}")
    print(f"  Contratos activos : {len(data)}")
    print(f"  Clientes panel    : {len(app_data['panel'])}")
    print(f"  Cartera COM       : MM${total_com_val/1e6:.1f}")
    print(f"  Cartera GAR       : MM${total_gar_val/1e6:.1f}")
    print(f"  Cartera Total     : MM${(total_com_val+total_gar_val)/1e6:.1f}")
    print()
    print("  SIGUIENTE PASO:")
    print(r"  cd src && .\build.ps1")
    print("=" * 60)


if __name__ == "__main__":
    main()
