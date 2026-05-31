import openpyxl
from collections import Counter, defaultdict

XLSX = '../data/CONTRATOS -FACTURACION -SATISFACCION -VISITAS.xlsx'
wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb['BASE INSTALADA']

habilitados = 0
total_rows = 0
tipos = Counter()
lineas = Counter()
clases2 = Counter()  # Clasificacion 2 (estado contrato)
clientes = set()
lineas_negocio = Counter()

for row in ws.iter_rows(min_row=2, values_only=True):
    nombre = row[4]
    if not nombre:
        continue
    total_rows += 1
    habilitado = str(row[0]).strip().lower() if row[0] else ''
    fuera = str(row[1]).strip().lower() if row[1] else ''
    if habilitado == 'si' and fuera != 'si':
        habilitados += 1
    tipo = str(row[12]).strip() if row[12] else 'Sin tipo'
    cl1 = str(row[13]).strip() if row[13] else ''
    cl2 = str(row[14]).strip() if row[14] else 'Sin clasificar'
    linea = str(row[25]).strip() if row[25] else 'Sin línea'
    tipos[tipo] += 1
    clases2[cl2] += 1
    lineas_negocio[linea] += 1
    if cl1:
        clientes.add(cl1)

wb.close()

print(f"Total filas con datos: {total_rows}")
print(f"Equipos habilitados (activos): {habilitados}")
print(f"Clientes únicos: {len(clientes)}")
print()
print("=== Top 15 Tipos de equipo ===")
for t,n in tipos.most_common(15):
    print(f"  {n:5d}  {t}")
print()
print("=== Líneas de Negocio ===")
for l,n in lineas_negocio.most_common():
    print(f"  {n:5d}  {l}")
print()
print("=== Top 10 Clasificación 2 (estado) ===")
for c,n in clases2.most_common(10):
    print(f"  {n:5d}  {c}")
