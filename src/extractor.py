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
from datetime import date, datetime
from collections import defaultdict

import openpyxl
import pandas as pd

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — editar aquí si cambia algo
# ══════════════════════════════════════════════════════════════════════════════
DIR  = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(DIR)
XLSX      = os.path.join(ROOT, "data", "CONTRATOS -FACTURACION -SATISFACCION -VISITAS.xlsx")
TMPL = os.path.join(DIR, "template.html")
OUT  = os.path.join(DIR, "dashboard_contratos_v16.2.html")

PPTO_ANUAL_TOTAL = 2_724_000_000   # Presupuesto anual total del área (CLP)

EJECUTIVOS_VISITAS = ["Eglys Ramirez", "Cristian Perez"]

JS_FILES = [
    "utils.js", "datos.js", "hoja_resumen.js", "hoja_tipos.js", "hoja_nuevos.js",
    "hoja_vencimientos.js", "hoja_vision.js", "hoja_presupuesto.js",
    "hoja_facturacion.js", "hoja_panelfact.js", "hoja_satisfaccion.js", "hoja_visitas.js",
]

ANO   = date.today().year
TODAY = date.today()

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

        if not fecha_inicio or not fecha_fin:
            continue

        # Billing flags per month (columns N–Y = indices 13–24)
        fact_flags = [bool(row[13 + m]) for m in range(12)]

        val_mes   = to_float(row[27])   # AC: Facturación Neta Mes convertido
        val_anual = to_float(row[29])   # AE: Facturación Anual Esperada 2026
        if val_anual == 0:
            nm = to_float(row[28])
            val_anual = val_mes * nm if nm >= 1 else val_mes  # fallback si col AE vacía
        real_ytd  = to_float(row[32])   # AG: Facturación Contratos 2026 YTD
        real_2025 = to_float(row[33])   # AH
        real_2024 = to_float(row[34])   # AI
        # AJ (idx 35): tipo de programa (Basic/Advanced/Profesional/Integral Care Program)
        prog_raw  = row[35] if len(row) > 35 else None
        programa  = safe_str(prog_raw).replace('​','').strip() if prog_raw else ""

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
            "val_mes":      val_mes,
            "fact_flags":   fact_flags,   # internal, excluded from DATA output
            "real_ytd":     real_ytd,
            "real_2025":    real_2025,
            "real_2024":    real_2024,
            "dias_vence":   dias_vence,
            "long_dias":    long_dias,
            "tpo_activo":   tpo_activo,
            "pct_consumido": pct_consumido,
            "es_nuevo":     tpo_activo <= 90,
            "estado":       estado,
            "programa":     programa,
            "dias_inicio_cli": tpo_activo,
        })

    return contratos


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

    return {
        "mensual_total":         mensual_total,
        "mensual_facturado":     mensual_facturado,
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

        respuestas.append({
            "institucion":    nombre_analisis,
            "nombre_bi":      nombre_bi,
            "dominio":        dominio,
            "categoria":      _dom_cat(dominio),
            "calidad":        calidad,
            "tiempo":         tiempo,
            "recom":          recom,
            "resuelto":       resuelto,
            "mejora":         mejora,
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
        rows = list(ws_anal.iter_rows(min_row=1, max_row=20, values_only=True))

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
            })

    return {"casos": casos, "equipos": equipos}


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
# 7. ENSAMBLAR APP_DATA
# ══════════════════════════════════════════════════════════════════════════════
def build_app_data(contratos, panel_raw, bbdd, visitas, satisf, mes_corte, analisis_fac=None, base_instalada=None):

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

    # Ratio contrato/no-contrato desde hoja FACTURACIÓN (contr_2026 / real_ytd por cliente)
    _total_ytd_fac = sum(p.get("real_ytd", 0) for p in panel_raw)
    _contr_ytd_fac = sum(p.get("presup_contr_ytd", 0) for p in panel_raw)
    _ratio_contr   = _contr_ytd_fac / _total_ytd_fac if _total_ytd_fac > 0 else 0

    _monthly_2026 = to_arr(mt, ANO)
    contr_real_monthly   = [round(v * _ratio_contr)       for v in _monthly_2026]
    nocontr_real_monthly = [round(v * (1 - _ratio_contr)) for v in _monthly_2026]

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
    }


# ══════════════════════════════════════════════════════════════════════════════
# 7. CONSTRUIR DATA, NC_DATA, PERDIDOS_VG
# ══════════════════════════════════════════════════════════════════════════════
_DATA_EXCLUDE = {"fact_flags", "vendedor", "estado", "real_ytd", "real_2025", "real_2024"}

def build_data_arrays(contratos, panel_raw):
    # Lookup de estado_relacion por cliente desde FACTURACIÓN
    panel_rel_map = {p["cliente"]: p.get("estado_relacion", "Nuevo") for p in panel_raw}

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
    active_clientes = {c["cliente"] for c in contratos if c["estado"] == "Activado"}
    perdidos = []
    for p in panel_raw:
        if not p.get("_no_continuo"):
            continue
        cli = p["cliente"]
        if cli in active_clientes:
            continue  # Cliente renovó con otro contrato

        # Find the last expired contract for this client
        expired = [c for c in contratos if c["cliente"] == cli and c["estado"] != "Activado"]
        last_c  = max(expired, key=lambda c: c["fin"], default={}) if expired else {}

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
        })

    return data, nc_data, perdidos


# ══════════════════════════════════════════════════════════════════════════════
# 8. PARCHEAR BLOQUE DATA/APP_DATA EN EL HTML TEMPLATE
# ══════════════════════════════════════════════════════════════════════════════
def patch_html(html, data, app_data, mapa_data=None, casos_data=None):
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

    mapa_json  = json.dumps(mapa_data  or [], ensure_ascii=False)
    casos_json = json.dumps(casos_data or {"casos": [], "equipos": []}, ensure_ascii=False)
    new_block = (
        "<script>\n"
        f"const DATA = {json.dumps(data, ensure_ascii=False)};\n\n"
        f"// ═══ DATOS ACTUALIZADOS A {mes_nombre} {ano} ═══\n"
        f"window.APP_DATA = {json.dumps(app_data, ensure_ascii=False)};\n"
        f"window.MAPA_DATA = {mapa_json};\n"
        f"window.CASOS_DATA = {casos_json};\n"
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
def main():
    print("=" * 60)
    print("  EXTRACTOR DASHBOARD CONTRATOS TECSERVICE")
    print(f"  Excel : {os.path.basename(XLSX)}")
    print(f"  Fecha : {TODAY}  |  Ano : {ANO}")
    print("=" * 60)

    if not os.path.exists(XLSX):
        print(f"\nERROR: No se encontro el Excel en:\n  {XLSX}")
        return
    if not os.path.exists(TMPL):
        print(f"\nERROR: No se encontro el template HTML en:\n  {TMPL}")
        return

    # ── Leer hojas simples con openpyxl ──────────────────────────────────────
    print("\n[1/5] Abriendo Excel con openpyxl...")
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)

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
    bbdd      = read_bbdd(XLSX)
    mes_corte = bbdd["mes_corte"]
    print(f"       MES_CORTE detectado automaticamente: {mes_corte}")

    # Ahora sí leemos visitas con mes_corte correcto
    wb2 = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    visitas = read_visitas(wb2, mes_corte)
    analisis_fac = read_analisis_fac(wb2)
    base_instalada = read_base_instalada(wb2)
    mapa_data  = read_mapa(wb2)
    casos_data = read_casos(wb2)
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
    app_data = build_app_data(contratos, panel_raw, bbdd, visitas, satisf, mes_corte, analisis_fac, base_instalada)
    data, nc_data, perdidos = build_data_arrays(contratos, panel_raw)
    total_com_val = sum(d["val"] for d in data if d["tipo"] == "Comercial")
    total_gar_val = sum(d["val"] for d in data if d["tipo"] == "Garantia")
    print(f"       DATA: {len(data)} contratos | Cartera COM: MM${total_com_val/1e6:.1f} | GAR: MM${total_gar_val/1e6:.1f} | Total: MM${(total_com_val+total_gar_val)/1e6:.1f}")
    print(f"       NC_DATA: {len(nc_data)} nuevos | PERDIDOS: {len(perdidos)}")
    enrich_mapa_data(mapa_data, contratos, satisf)
    cc_count = sum(1 for c in mapa_data if c["cc"])
    print(f"       MAPA_DATA: {len(mapa_data)} clientes | {cc_count} con contrato")
    print(f"       CASOS: {len(casos_data['casos'])} casos relevantes | {len(casos_data['equipos'])} equipos detenidos")

    # ── Parchear template.html (fuente de build.ps1) ─────────────────────────
    print("\nParcheando template.html...")
    with open(TMPL, encoding="utf-8") as f:
        html = f.read()
    html = patch_html(html, data, app_data, mapa_data, casos_data)
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
