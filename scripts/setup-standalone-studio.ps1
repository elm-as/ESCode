param(
  [string]$DestinationDir = "Elmas-Studio-Desktop"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  ELMAS STUDIO - Standalone Distribution  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Compile extension & standalone Mission Control desktop application
Write-Host "[1/6] Compiling Elmas Studio Core Extension & Standalone Mission Control App..." -ForegroundColor Yellow
pnpm run build
pnpm exec tsc -p tsconfig.extension.json
cargo build -p tauri-app --features custom-protocol

if (-not (Test-Path "dist-extension/extension.js")) {
  Write-Error "Extension compilation failed: dist-extension/extension.js not found."
  exit 1
}

# 2. Download VSCodium Portable base if needed
$zipFileName = "VSCodium-win32-x64-1.143.17232.zip"
$downloadUrl = "https://github.com/VSCodium/vscodium/releases/download/1.143.17232/VSCodium-win32-x64-1.143.17232.zip"

if (-not (Test-Path $zipFileName)) {
  Write-Host "[2/6] Downloading VSCodium portable base..." -ForegroundColor Yellow
  curl.exe -L -o $zipFileName $downloadUrl
} else {
  Write-Host "[2/6] VSCodium portable archive already present." -ForegroundColor Green
}

# 3. Extract to DestinationDir
if (-not (Test-Path $DestinationDir)) {
  Write-Host "[3/6] Extracting VSCodium base to $DestinationDir..." -ForegroundColor Yellow
  Expand-Archive -Path $zipFileName -DestinationPath $DestinationDir -Force
} else {
  Write-Host "[3/6] Target directory already exists." -ForegroundColor Green
}

# 4. Rename executable to Elmas Studio.exe and keep VSCodium.exe compatibility
$origExe = Join-Path $DestinationDir "codium.exe"
$targetExe = Join-Path $DestinationDir "Elmas Studio.exe"
$vsCodiumExe = Join-Path $DestinationDir "VSCodium.exe"
if (Test-Path $origExe) {
  Write-Host "[4/6] Branding executable to Elmas Studio.exe..." -ForegroundColor Yellow
  Copy-Item -Path $origExe -Destination $targetExe -Force
  Move-Item -Path $origExe -Destination $vsCodiumExe -Force
}

# Create bin/elmas.cmd
$binDir = Join-Path $DestinationDir "bin"
$elmasCmd = Join-Path $binDir "elmas.cmd"
Set-Content -Path $elmasCmd -Value "@echo off`r`nsetlocal`r`nset VSCODE_DEV=`r`nset ELECTRON_RUN_AS_NODE=1`r`n`"%~dp0..\VSCodium.exe`" `"%~dp0..\resources\app\out\cli.js`" %*`r`nIF %ERRORLEVEL% NEQ 0 EXIT /b %ERRORLEVEL%`r`nendlocal"


# 5. Pre-bundle Elmas Studio Core Extension in portable data directory
Write-Host "[5/6] Pre-bundling Elmas Studio Core Extension & Mission Control..." -ForegroundColor Yellow
$extDir = Join-Path $DestinationDir "data\extensions\elmas-studio-core"
if (-not (Test-Path $extDir)) {
  New-Item -ItemType Directory -Force -Path $extDir | Out-Null
}
Copy-Item -Path "src-extension\package.json" -Destination $extDir -Force
Copy-Item -Path "dist-extension\*" -Destination $extDir -Recurse -Force
if (Test-Path "src-extension\media") {
  Copy-Item -Path "src-extension\media" -Destination $extDir -Recurse -Force
}
if (Test-Path "target\debug\tauri-app.exe") {
  $binDest = Join-Path $extDir "bin"
  New-Item -ItemType Directory -Force -Path $binDest | Out-Null
  Copy-Item -Path "target\debug\tauri-app.exe" -Destination (Join-Path $binDest "elmas-mission-control.exe") -Force
  Copy-Item -Path "target\debug\tauri-app.exe" -Destination (Join-Path $DestinationDir "Elmas Mission Control.exe") -Force
}

# 6. Customize product.json, French language pack, and Elmas Amber Forge branding
Write-Host "[6/6] Applying Elmas Studio branding, French locale, and Amber Forge theme..." -ForegroundColor Yellow
$productJsonPath = Join-Path $DestinationDir "resources\app\product.json"
if (Test-Path $productJsonPath) {
  $product = Get-Content $productJsonPath -Raw | ConvertFrom-Json
  $product.nameShort = "Elmas Studio"
  $product.nameLong = "Elmas Studio"
  $product.applicationName = "elmas-studio"
  $product | ConvertTo-Json -Depth 15 | Set-Content $productJsonPath
}

& (Join-Path $DestinationDir "bin\codium.cmd") --install-extension MS-CEINTL.vscode-language-pack-fr
node scripts/apply-elmas-branding.mjs

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
Write-Host "  Executable: $targetExe" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
