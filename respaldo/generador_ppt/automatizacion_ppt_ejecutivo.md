# Automatización del PowerPoint ejecutivo (Comité TECSERVICE)

Análisis del deck `20261023 TECSERVICE_vd.pptx` (88 slides, 16:9) para generarlo
automáticamente desde el panel cada vez que se actualiza el Excel.

## Uso (versión 1: imágenes, bullets y títulos)

Después de `extractor.py` y `build.ps1`:

```
cd src
python gen_ppt.py
```

- Toma como base el deck más reciente de la carpeta (`AAAAMMDD TECSERVICE_vd.pptx`) y
  guarda uno nuevo con la fecha de hoy; nunca sobrescribe la base.
- Junto al deck deja un `.txt` con: puntos a revisar, frases manuales resaltadas y cada
  cifra que cambió (valor anterior → nuevo).
- `--base "<archivo>"` elige otro deck base; `--salida` otro nombre; `--sin-capturar`
  reusa las imágenes y datos de la última corrida (sirve para probar cambios de reglas).
- Tarda unos 3 minutos; abre el panel en Edge sin pantalla (Playwright).

Archivos: `src/ppt_capturar.py` (exportables y estados), `src/ppt_textos.py` (cálculo
de cifras y patrones de cada bullet), `src/gen_ppt.py` (imágenes, textos e informe).

Para agregar o cambiar un bullet automático se edita su patrón en `ppt_textos.reglas()`:
los grupos con nombre son lo único que se reemplaza; el resto de la frase queda como
está escrita en el deck. Grupos `m_…` son comentario manual (quedan resaltados).

Validación: corrido sobre el deck del 23-10 con los datos del 23-10, reproduce todas las
cifras salvo cinco que en el deck estaban desactualizadas o mal copiadas (top 10 de
garantías, pares sin maestro de inventario, top 10 sin stock, margen presupuestado del
EERR Limpio y STEELCO en equipos detenidos).

Pendiente para la versión 2: tablas nativas (slides 23, 29, 30, 33, 40, 42, 44, 47–48,
51–52, 64–80), cajas con cifras del Plan RM (45, 46, 50) y capturas de mapa y agenda
(49, 53, 54).

## 1. Cómo se arma hoy

1. Se actualiza el Excel y se regenera el panel (`extractor.py` + `build.ps1`).
2. En el panel se ajustan filtros o despliegues y se pulsa **Exportar** en cada tarjeta.
   La salida PNG / copiar (`hdSalida`) entrega una imagen a escala 4 (1.240 px de
   panel → 4.960 px de imagen), con el encabezado «TECSERVICE — título · datos al …».
3. La imagen se pega en la slide, encima de la anterior, y se recorta con el recorte de
   PowerPoint para que calce en el marco.
4. Se reescriben a mano las cifras de los bullets manteniendo la redacción.
5. Algunas tablas nativas de PowerPoint se copian desde los Excel que exporta el panel.

## 2. Composición del deck

| Bloque | Slides | Origen |
|---|---|---|
| Portada, agenda, decisiones, información del último comité | 1–6, 13, 18, 26, 31, 34, 38, 39, 41, 62 | Fijo o escrito a mano |
| Facturación y garantías | 7–12 | Panel: imagen + bullets |
| EERR | 14–17 | Panel: imagen + bullets (título con el mes de cierre) |
| Equipos detenidos y casos | 19–25 | Panel: imagen + bullets; slide 23 es tabla manual |
| Contratos | 27–30 | Panel: imagen + bullets; slides 29–30 son tablas con comentarios manuales |
| Satisfacción | 32–33 | Panel: imagen; slide 33 es tabla manual (planes por detractor) |
| Base instalada y prospectos | 35–37, 42–44 | Panel: imagen + bullets; slides 42 y 44 son tablas |
| Plan por región | 40, 45–61 | Mezcla: tablas desde Excel exportados, imágenes del panel, cajas con cifras |
| Anexos | 63–80 | Tablas desde los Excel del Plan de Visitas (una por región) |
| Organización y procesos | 81–88 | Fijo (no depende del panel) |

Unas **45 slides** dependen de datos del panel; el resto no cambia de semana a semana.

## 3. Slide por slide (las que dependen del panel)

Columnas: **Exportable** es el botón del panel que genera la imagen (ids de
`exportarPanel` o función especial); **Estado al exportar** es lo que tiene que estar
puesto en el panel para que salga igual que hoy; **Recorte** es lo que se corta en la
imagen (px de panel, arriba / abajo); **Textos**: A = cifras automáticas, M = mixto
(cifras automáticas + frases manuales), F = fijo.

| Slide | Título | Exportable | Estado al exportar | Recorte | Textos |
|---|---|---|---|---|---|
| 7 | Facturación 4° Semana de Octubre | `rs-anal-card` + `rs-sem-card` (Análisis de Facturación) | Semana en curso (la del dato) | 45 / 27 (encabezado y nota) | A · título con semana y mes |
| 8 | Desglose Garantías Vigentes | `vg-gar-tabla` (Contratos en Garantía) | Línea «todas», orden por monto desc. | 0 / 73 | A (6 bullets) |
| 9 | Agrupación por Línea de Negocio | `vg-garl-tabla` (Garantías por Línea de Negocio) | — | 55 / 71, derecha 12 | A (8 bullets) |
| 10 | Brechas de Facturación | `br-resumen` (tiles + composición) | — | 45 / 40 | A en 3 cajas (Oport., Bajo contrato, Sin stock) |
| 11 | Rotación brecha sin Stock – Bruto | `br-st-cli` (Brecha por Cliente · Sin Stock) | Todos colapsados | 81 / 28 (encabezado + botones Expandir/Colapsar) | A (6 bullets) |
| 12 | Rotación brecha sin Stock – Neto | `br-st-compras` (Qué Comprar por Cliente) | **«Sólo con compra pendiente» encendido** (`_cmpSoloComprar`) | 85 / 99 | — |
| 14 | EERR TECSERVICE Cierre Ago-26 | `eerrExportResumenPDF()` | Último mes cerrado | 48 / 53, derecha 20 | A (5 bullets) · título con mes |
| 15 | EERR Mensualizado | `eerrExportPDF()` | Todos los meses seleccionados | 0 / 202 | — |
| 16 | EERR Limpio Cierre Ago-26 | `eerrExportResumenPDF('limpio')` | Último mes cerrado | 55 / 198 | A (5 bullets) + texto metodológico F · título con mes |
| 17 | EERR Limpio Mensualizado | `eerrExportPDF('limpio')` | Todos los meses | 48 / 82 | — |
| 19 | # Equipos Detenidos | `cas-flujo` (Flujo de Equipos Detenidos) | — | 58 / 115 | A (10 bullets con rankings) |
| 20 | Por Equipo | `cas-eq-tabla` | Todo colapsado | 87 / 63 (encabezado + botones) | — |
| 21 | Por Marca | `cas-marca-tabla` | — | sin recorte | — |
| 22 | Por Cliente | `cas-cli-tabla` | — | 54 / 56 | A (6 bullets con rankings) |
| 23 | Casos Críticos | tabla nativa (hoja Casos Relevantes) | — | — | M: «solucionados esta semana» requiere comparar con la semana anterior |
| 24 | # Equipos Detenidos (resumen de casos) | `cas-res-tabla` | — | sin recorte | — |
| 25 | Fill Rate | `cr-fr-kpi` + `cr-fr` | Objetivo 99 %, top 10 | 0 / 87 | F |
| 27 | Composición de Facturación | `pf-comp-tabla` (Facturación por tipo de cliente) | **Fila «Perdidos (sin facturación actual)» desplegada** (`_pcAbierta='perd'`), tipo «todos» | 60 / 97 | A (6 bullets) |
| 28 | Update Contratos – 90 días | `vencExportPDF()`, página «Horizonte 90 días» | — (la función arma 4 páginas: 30 d, 90 d, 1 año, Perdidos) | sin recorte, **imagen estirada −18 %** | A (5 bullets) |
| 29 | Update Contratos – 90 días (detalle) | tabla nativa | Columna «Clasificación (indicada por usuario)» es manual | — | M |
| 30 | Contratos Perdidos | tabla nativa (página «Contratos Perdidos» de `vencExportPDF`) | — | — | M: cifras A, «Comentario» y «Razón de pérdida» manuales |
| 32 | Encuesta de Satisfacción | `satExportPDF()` (página 1) | — | 43 / 0 | — |
| 33 | Detractores | tabla nativa | Planes y fechas manuales | — | M |
| 35 | Prospectos según renovación BI | `pb-kpi` (tiles) + `_pbExpHeat()` (mapa por línea) | Potencial «todos», vida mín. 80 %, mapa por **línea** | 51/21 y 58/52 | A (7 bullets) |
| 36 | Base Instalada a Renovar por Región | `pb-reg-tabla` | — | sin recorte | — |
| 37 | Base Instalada a Renovar por Región | `_pbExpHeat()` | Mapa por **región** (`_heatEje='region'`) | sin recorte | — |
| 40 | Plan de Acción Bío Bío | tabla nativa (Clientes_puntuales) | — | — | A (5 bullets) + F |
| 42 | Plan por Región (status y potencial) | tabla nativa (Cartera ST por región) | — | — | F (texto de hubs) |
| 43 | Considerando antigüedad de equipos | `bi-mx-card` (Matriz de Prospección) | Región «Todas» | sin recorte | F |
| 44 | Plan Clientes Foco | tabla = hoja Consolidado del Excel de la Matriz | — | — | F |
| 45 | Plan RM y Valparaíso | cajas con cifras | — | — | A (potencial, n° clientes por grupo) + F |
| 46 | Valparaíso | `bi-cv-card` (Concentración del Potencial ST) | **Región «Valparaíso»** (`_biCvRegion`) | 39 / 119 | A (cajas) |
| 47 | Valparaíso Grupo 1 | tabla = hoja Valparaíso del Excel de la Matriz | — | — | — |
| 48 | Valparaíso Grupo 2 | tabla = Excel del Plan RM | — | — | F |
| 49 | Valparaíso Grupo 3 | capturas de pantalla del mapa y la agenda (Plan RM) | — | — | M |
| 50 | Región Metropolitana | `bi-cv-card` | **Región «Metropolitana»** | 118 / 133, izq. 24 | A (cajas) |
| 51 | Metropolitana Grupo 1 | tabla = hoja Metropolitana (sin «VACIO») | — | — | — |
| 52 | RM Grupo 2 | tabla = Excel del Plan RM | — | — | F |
| 53–54 | Grupo 3 / Plan RM y Valparaíso | capturas de mapa y agenda | — | — | M |
| 55 | Visitas Programadas | `vp-prog-box` + `vp-prog-viz` | Próximos 15 días | 0 / 564 (deja sólo la tabla) | — |
| 56 | Seguimiento Visitas | `vp-dest-box` + `vp-grp-tabla` | Período 2026, ejecutivo «todos», región y grupo «todos» | sin recorte | — |
| 57 | Seguimiento Visitas | `vp-eje-box` + `vp-evo-box` | Igual que 56 | sin recorte | — |
| 58 | Visitas Programadas Mapa | `vp-prog-mapa-box` | Fecha «Todos los días» | sin recorte | — |
| 61 | Plan RM y Valparaíso (Gantt) | `prm-gantt-card` | — | sin recorte | F |
| 64–80 | Anexos: Carta Gantt y plan por región | tablas = hojas del Excel de la Matriz | — | — | — |

## 4. Recortes de imagen

- Todos los recortes son **recortes puros**: la imagen no está deformada (salvo la
  slide 28, que está aplastada un 18 % en alto).
- Arriba se quita siempre el encabezado del exportable (≈ 45–60 px de panel) y, en
  algunas tarjetas, además los botones o la leyenda (≈ 80–120 px).
- Abajo se quita la nota explicativa en letra chica o el espacio en blanco.
- El **marco** (posición y tamaño en la slide) es lo que se mantiene semana a semana.

**Regla propuesta para el generador:** conservar el marco de la imagen actual, poner la
imagen nueva, recortar arriba la franja del encabezado (se detecta por la línea azul
de 2,5 px que lo cierra) más los px fijos que indique la slide, y recortar abajo lo
necesario para mantener la proporción del marco. Si la imagen nueva viene más alta que
el marco (más filas), en vez de cortar filas se reduce el ancho y se centra. La slide 28
se corrige para no deformar.

**Hallazgo:** en las slides 35, 36 y 55 la imagen nueva quedó pegada encima de la
anterior (hay una del 16-10 debajo de la del 23-10). El generador reemplaza la imagen y
borra la duplicada.

## 5. Bullets: actualizar cifras sin cambiar la redacción

- Casi todos los bullets son un solo tramo de texto con formato uniforme, así que se
  pueden reescribir sin perder formato. Los que tienen varios tramos (negritas, colores)
  se actualizan reemplazando cada cifra dentro de su tramo.
- Cada bullet automático se modela como una **plantilla con la redacción exacta** y
  marcas para los datos. Ejemplo (slide 8):
  `La cartera de garantías vigentes alcanza {mm:gar.monto} de ingresos estimados,
  asociados a {n:gar.contratos} contratos, con {mm:gar.costo} de costo estimado y
  {mm:gar.remanente} aún por consumir.`
- Formatos: MM$ con un decimal y miles con punto (MM$1.923,4), porcentajes con coma
  (88,2 %), enteros con punto de miles.
- **Palabras que dependen del signo** se modelan como alternativas:
  «superando / bajo» el presupuesto, «superior / inferior al … presupuestado»,
  «por sobre / por debajo» del año anterior (slides 7, 14, 16).
- **Rankings**: los nombres de clientes, marcas o equipos salen del dato (top N) y se
  escriben con el mismo patrón («Hospital Pitrufquén: 14,2 % de la brecha (14 SKU)»).
  Si cambia la cantidad de ítems de una lista se agregan o quitan párrafos copiando el
  formato del anterior.
- **Frases manuales** (comentarios del comité, por ejemplo «Fundación ANCHORA UC indica
  termino de contratos…», «Durante esta semana se han solucionado 8 casos (…)») no se
  tocan; el generador las deja y las marca para revisión.
- **Títulos con fecha**: «Facturación 4° Semana de Octubre» (7) y «Cierre Ago-26»
  (14, 16) se actualizan con la semana y el mes de cierre.

Cifras que hoy se calculan fuera del panel y habría que agregar al cálculo: cobertura
valorizada por stock y back order en Sin Stock (slide 10), concentración top 3 / top 10
(11, 19, 22), y el comparativo del Plan Sur (40).

## 6. Diseño propuesto

1. **Captura desde el panel sin modificarlo** (`ppt_capturar.py`): en la página se
   reemplaza `hdEntregar` —por donde pasan todos los exportables— para quedarse con el
   PNG en vez de descargarlo; se fija el estado de cada exportable (filtros, despliegues,
   región), se pulsa su botón y se leen las tablas de esa tarjeta en el mismo estado, que
   son la fuente de las cifras de los bullets.
2. **Generador** `src/gen_ppt.py`: abre el panel en un navegador sin pantalla
   (Playwright, ya instalado), llama a `pptExport()`, toma el deck de la semana anterior
   como plantilla, reemplaza imágenes y tablas, actualiza bullets y títulos, y guarda
   `AAAAMMDD TECSERVICE_vd.pptx` junto con un informe de lo que cambió y lo que quedó
   para revisar.
3. **Configuración por slide** (`src/ppt_config.json`): exportable, estado, recorte y
   plantillas de bullets. Cambiar el deck no requiere tocar código.

Fases sugeridas: (1) imágenes de las slides con exportable directo; (2) bullets
automáticos; (3) tablas nativas desde los Excel; (4) capturas de mapa y agenda del
Plan RM.
