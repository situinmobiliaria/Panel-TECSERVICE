import openpyxl, pandas as pd

XLSX = '../data/CONTRATOS -FACTURACION -SATISFACCION -VISITAS.xlsx'

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb['FACTURACION']
total_fac_sheet = 0
contr_fac_sheet = 0
n = 0
for row in ws.iter_rows(min_row=2, values_only=True):
    cliente = str(row[0]).strip() if row[0] else ''
    if not cliente:
        continue
    v2 = float(row[2]) if row[2] else 0
    v6 = float(row[6]) if row[6] else 0
    total_fac_sheet += v2
    contr_fac_sheet += v6
    n += 1
wb.close()

df = pd.read_excel(XLSX, sheet_name='Facturacion a Fecha', header=0)
cols = df.columns.tolist()
c_emp2 = cols[43]; c_monto = cols[18]; c_mes = cols[38]; c_ano = cols[40]
df_ts = df[df[c_emp2].astype(str).str.strip() == 'TS'].copy()
df_ts[c_monto] = pd.to_numeric(df_ts[c_monto], errors='coerce').fillna(0)
df_ts[c_mes] = pd.to_numeric(df_ts[c_mes], errors='coerce')
df_ts[c_ano] = pd.to_numeric(df_ts[c_ano], errors='coerce')
df_ts = df_ts.dropna(subset=[c_mes, c_ano])
df_ts[c_mes] = df_ts[c_mes].astype(int)
df_ts[c_ano] = df_ts[c_ano].astype(int)

total_bbdd_ytd = float(df_ts[(df_ts[c_ano]==2026)&(df_ts[c_mes]<=5)][c_monto].sum())
total_bbdd_anio = float(df_ts[df_ts[c_ano]==2026][c_monto].sum())

print("=== COMPARACION FUENTES 2026 ===")
print("Hoja FACTURACION  -> total fac_2026 (col C): MM$" + str(round(total_fac_sheet/1e6,1)))
print("Hoja FACTURACION  -> total contr_2026 (col G): MM$" + str(round(contr_fac_sheet/1e6,1)))
print("Hoja FACTURACION  -> correctiva (C-G): MM$" + str(round((total_fac_sheet-contr_fac_sheet)/1e6,1)))
print("")
print("Facturacion a Fecha (BBDD) -> YTD ene-may 2026: MM$" + str(round(total_bbdd_ytd/1e6,1)))
print("Facturacion a Fecha (BBDD) -> Anio 2026 completo: MM$" + str(round(total_bbdd_anio/1e6,1)))
print("Diferencia (FACTURACION - BBDD YTD): MM$" + str(round((total_fac_sheet - total_bbdd_ytd)/1e6,1)))
print("Clientes en hoja FACTURACION: " + str(n))
