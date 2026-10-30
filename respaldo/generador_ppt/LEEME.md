# Generador del PPT ejecutivo — respaldo (desactivado)

Versión 1 del generador automático del PowerPoint del Comité TECSERVICE: imágenes,
bullets automáticos y títulos con fecha. Está guardado aquí sin uso: el panel y su
compilación (`extractor.py`, `build.ps1`) no lo llaman.

El diseño, el detalle slide por slide y lo que falta están en
`automatizacion_ppt_ejecutivo.md`.

## Para volver a activarlo

Los scripts calculan sus rutas desde `src/` (buscan `index.html` y los decks en la
carpeta de arriba), así que hay que copiarlos de vuelta:

```
copy respaldo\generador_ppt\*.py src\
cd src
python gen_ppt.py
```

Requiere `python-pptx`, `Pillow` y `playwright`, con Edge o Chrome instalado.
