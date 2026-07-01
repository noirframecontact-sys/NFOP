Set-Location $PSScriptRoot

$port = 8080

Write-Host "NOIRFRAME PAD — http://localhost:$port/index.html"
Write-Host "Ctrl+C aby zatrzymac."

if (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server $port
  exit $LASTEXITCODE
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  py -m http.server $port
  exit $LASTEXITCODE
}

Write-Error "Python nie znaleziony. Zainstaluj Python lub uzyj innego serwera HTTP."
