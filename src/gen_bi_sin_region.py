# -*- coding: utf-8 -*-
"""Clientes de BASE INSTALADA sin región, para completarla a mano.
Uso: python src/gen_bi_sin_region.py  ->  BI_clientes_sin_region.xlsx"""
import os, re, sys
from collections import Counter
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.datavalidation import DataValidation

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSB = os.path.join(ROOT, "data", "CONTRATOS -FACTURACION -SATISFACCION -VISITAS.xlsb")
OUT = os.path.join(ROOT, "BI_clientes_sin_region.xlsx")
import unicodedata
def sin_tilde(s): return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn")
def region_ok(v):
    if not isinstance(v, str): return None
    k = sin_tilde(v).upper().strip()
    return None if k in {"", "SIN INFORMACION", "0", "0X2A", "#N/A", "SIN REGION", "NAN"} else v.strip()
def rut_ok(v):
    if isinstance(v, float) and pd.isna(v): return None
    t = str(v).strip()
    return None if t.upper() in {"", "NAN", "NONE", "0", "0.0"} else t

bi = pd.read_excel(XLSB, sheet_name="BASE INSTALADA", engine="pyxlsb")
act = bi[(bi.iloc[:, 0].astype(str).str.strip().str.upper() == "SI") & (bi.iloc[:, 1].astype(str).str.strip().str.upper() != "SI")].copy()
def nombre(r):
    for i in (26, 13):
        v = r.iloc[i]
        if isinstance(v, str) and v.strip().upper() not in {"", "NONE", "VACIO", "VACÍO", "0", "0.0"}: return v.strip().upper()
    return None
act["nom"] = act.apply(nombre, axis=1).fillna("VACIO")   # como en el panel: sin nombre = «VACIO»
act = act[~act.nom.str.contains("GEMCO")].copy()
act["reg"] = act.iloc[:, 29].map(region_ok)
act["rut"] = act.iloc[:, 9].map(rut_ok)
act["rutn"] = act.iloc[:, 32].map(rut_ok)
act["pot"] = act.iloc[:, 27].astype(str).str.strip().str.upper().isin({"SI", "SÍ"})

# Respaldo: hojas «Región Clientes» y «Región BI» (por nombre) y RUT de «Región BI»
rb = pd.read_excel(XLSB, sheet_name="Región BI", engine="pyxlsb")
rc = pd.read_excel(XLSB, sheet_name="Región Clientes", engine="pyxlsb")
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]+", " ", sin_tilde(s).upper())).strip()
sug_reg, sug_rut = {}, {}
for n_, r_ in zip(rc.iloc[:, 0], rc.iloc[:, 1]):
    if isinstance(n_, str) and region_ok(r_): sug_reg.setdefault(norm(n_), r_.strip())
for n_, rut_, r_ in zip(rb.iloc[:, 1], rb.iloc[:, 2], rb.iloc[:, 4]):
    if isinstance(n_, str):
        if region_ok(r_): sug_reg.setdefault(norm(n_), r_.strip())
        if rut_ok(rut_): sug_rut.setdefault(norm(n_), str(rut_).strip())

# Universo y potencial tal como los muestra el panel (index.html): región, contrato vigente y
# potencial ST anual = equipos × tarifa (Esterilización 50 UF, Endoscopía 22 UF, Dental 15 UF).
import json
html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
k0 = html.index("window.APP_DATA = ")
APP = json.loads(html[k0 + 18:html.index(chr(10), k0)].rstrip(";"))
TARIFA = {"esterilizacion": 2043239, "endoscopia": 898585, "dental": 612671}
rut_bi = {}
for nom, g in act.groupby("nom"):
    c_ = Counter(list(g.rut.dropna()) + list(g.rutn.dropna()))
    if c_: rut_bi[nom] = c_.most_common(1)[0][0]
eq_bi = act.groupby("nom").size().to_dict()
pot_bi = act[act.pot].groupby("nom").size().to_dict()

# Las regiones ya completadas a mano se conservan: el extractor las lee de este
# mismo archivo, así que esos clientes ya no salen «Sin región» en el panel y,
# sin esto, se perderían al regenerarlo.
previas = {}
if os.path.exists(OUT):
    _p = pd.read_excel(OUT, sheet_name=0)
    for f in _p.itertuples(index=False):
        if isinstance(f[0], str) and isinstance(f[7], str) and f[7].strip():
            previas[norm(f[0])] = list(f)

filas = []
for c in APP["base_instalada"]["clientes"]:
    if (c.get("region") or "Sin región") != "Sin región" and not c.get("region_manual"): continue
    nom = c["nombre"].strip().upper()
    mant = sum((c.get(k, 0) or 0) * v for k, v in TARIFA.items())
    cv = bool(c.get("cv"))
    estado = "Contrato vigente (fuera del panel)" if cv else ("Con potencial" if mant > 0 else "Sin potencial")
    filas.append([nom, rut_bi.get(nom) or sug_rut.get(norm(nom), ""), 0 if cv else round(mant / 1e6, 1), c.get("total", eq_bi.get(nom, 0)),
                  pot_bi.get(nom, 0), estado, sug_reg.get(norm(nom), ""), (previas.pop(norm(nom), [""] * 8)[7] or "")])
# Las completadas que ya no aparecen (cambió el nombre o el potencial) quedan al final.
filas += [[("" if isinstance(v, float) and pd.isna(v) else v) for v in f] for f in previas.values()]
orden = {"Con potencial": 0, "Sin potencial": 1, "Contrato vigente (fuera del panel)": 2}
filas = [f for f in filas if f[5] == "Con potencial" or f[7]]   # los con potencial y los ya completados
filas.sort(key=lambda r: (orden.get(r[5], 3), -(r[2] or 0), -(r[3] or 0), r[0]))

wb = Workbook(); ws = wb.active; ws.title = "Clientes sin región"
cab = ["Cliente", "RUT", "Potencial ST anual (MM$)", "Equipos en base instalada", "Equipos con Potencial ST", "En el panel", "Región sugerida (otras hojas)", "Región"]
ws.append(cab)
for f in filas: ws.append(f)
n = len(filas) + 1
tab = Table(displayName="BISinRegion", ref=f"A1:H{n}"); tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
ws.add_table(tab); ws.freeze_panes = "B2"
REGS = ["Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana", "O'Higgins", "Maule",
        "Ñuble", "Biobío", "Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes"]
lst = wb.create_sheet("Regiones"); [lst.append([r]) for r in REGS]; lst.sheet_state = "hidden"
dv = DataValidation(type="list", formula1=f"=Regiones!$A$1:$A${len(REGS)}", allow_blank=True, showErrorMessage=False)
ws.add_data_validation(dv); dv.add(f"H2:H{n}")
for c in "DE":
    for r in range(2, n + 1): ws[f"{c}{r}"].number_format = "#,##0"
for r in range(2, n + 1):
    ws[f"C{r}"].number_format = "#,##0.0"
    ws[f"H{r}"].fill = PatternFill("solid", fgColor="FFF2CC")
ws.row_dimensions[1].height = 34
for c in range(1, 9): ws.cell(1, c).alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
for c, w in zip("ABCDEFGH", (58, 16, 14, 14, 14, 30, 24, 24)): ws.column_dimensions[c].width = w
try:
    wb.save(OUT)
except PermissionError:      # el archivo está abierto en Excel
    OUT = OUT.replace(".xlsx", "_v2.xlsx"); wb.save(OUT)
print(OUT, len(filas), "clientes |", Counter(f[5] for f in filas), "|", sum(1 for f in filas if f[1]), "con RUT |", sum(1 for f in filas if f[6]), "con región sugerida | potencial MM$", round(sum(f[2] for f in filas), 1))
