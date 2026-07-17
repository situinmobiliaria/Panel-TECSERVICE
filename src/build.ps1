# build.ps1 — Genera ../index.html y ../hoja_login.js (self-contained)
# Uso: cd src && .\build.ps1
# Requiere: template.html + todos los hoja_*.js en la misma carpeta
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root      = Split-Path -Parent $scriptDir

$src  = Join-Path $scriptDir 'template.html'
$dest = Join-Path $root 'index.html'
$tmp  = $dest + '.tmp'

$jsFiles = @(
  'utils.js','datos.js','hoja_resumen.js','hoja_tipos.js','hoja_nuevos.js',
  'hoja_vencimientos.js','hoja_vision.js','hoja_presupuesto.js',
  'hoja_facturacion.js','hoja_panelfact.js','hoja_base_instalada.js','hoja_satisfaccion.js',
  'hoja_visitas.js','hoja_mapa.js','hoja_matriz.js','hoja_casos.js','hoja_alerta.js','hoja_pdf.js','hoja_eerr.js'
)

$writer = [System.IO.StreamWriter]::new($tmp, $false, [System.Text.Encoding]::UTF8)
try {
  foreach ($line in [System.IO.File]::ReadLines($src, [System.Text.Encoding]::UTF8)) {
    $matched = $false
    foreach ($jsFile in $jsFiles) {
      $tag = '<script src="' + $jsFile + '">'
      if ($line -match [regex]::Escape($tag)) {
        $jsPath = Join-Path $scriptDir $jsFile
        if (Test-Path $jsPath) {
          $writer.WriteLine('<script>')
          foreach ($jsLine in [System.IO.File]::ReadLines($jsPath, [System.Text.Encoding]::UTF8)) {
            $writer.WriteLine($jsLine)
          }
          $writer.WriteLine('</script>')
          Write-Host ('  Inlined: ' + $jsFile)
        } else {
          $writer.WriteLine($line)
          Write-Warning ('No encontrado: ' + $jsFile)
        }
        $matched = $true
        break
      }
    }
    if (-not $matched) { $writer.WriteLine($line) }
  }
} finally {
  $writer.Close()
}

if (Test-Path $dest) { Remove-Item $dest -Force }
Move-Item $tmp $dest -Force

# Copiar hoja_login.js al root (se sirve junto a index.html en GitHub Pages)
$loginSrc  = Join-Path $scriptDir 'hoja_login.js'
$loginDest = Join-Path $root 'hoja_login.js'
Copy-Item $loginSrc $loginDest -Force
Write-Host '  Copiado: hoja_login.js -> root'

$sizeKb = [math]::Round((Get-Item $dest).Length / 1024)
Write-Host ''
Write-Host ('Listo: ' + $dest)
Write-Host ('Tamano: ' + $sizeKb + ' KB')
Write-Host ''
Write-Host 'Siguiente paso: git add index.html hoja_login.js && git commit -m "..." && git push'
