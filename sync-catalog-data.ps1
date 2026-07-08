Set-Location $PSScriptRoot

$json = Get-Content -Raw -Encoding UTF8 "catalog.json"
"\"use strict\";`nwindow.NF_CATALOG_DATA = $json;" | Set-Content -Encoding UTF8 "catalog-data.js"

Write-Host "catalog-data.js aktualisiert."
