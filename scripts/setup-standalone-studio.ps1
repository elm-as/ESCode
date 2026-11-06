param(
  [string]$DestinationDir = "Elmas-Studio-Desktop"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  ELMAS STUDIO — Standalone Distribution  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Compile extension
Write-Host "[1/6] Compiling Elmas Studio Core Extension..." -ForegroundColor Yellow
pnpm exec tsc -p tsconfig.extension.json

if (!(Test-Path "dist-extension/extension.js")) {
  Write-Error "Extension compilation failed: dist-extension/extension.js not found."
  exit 1
}

# 2. Download VSCodium Portable base if needed
$zipFileName = "VSCodium-win32-x64-1.143.17232.zip"
$downloadUrl = "https://github.com/VSCodium/vscodium/releases/download/1.143.17232/VSCodium-win32-x64-1.143.17232.zip"

if (!(Test-Path $zipFileName)) {
  Write-Host "[2/6] Downloading VSCodium portable base (231 MB)..." -ForegroundColor Yellow
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFileName
} else {
  Write-Host "[2/6] VSCodium portable archive already present." -ForegroundColor Green
}

# 3. Extract to DestinationDir
if (!(Test-Path $DestinationDir)) {
  Write-Host "[3/6] Extracting VSCodium base to $DestinationDir..." -ForegroundColor Yellow
  Expand-Archive -Path $zipFileName -DestinationPath $DestinationDir -Force
} else {
  Write-Host "[3/6] Target directory $DestinationDir already exists." -ForegroundColor Green
}

# 4. Rename executable to Elmas Studio.exe
$origExe = Join-Path $DestinationDir "codium.exe"
$targetExe = Join-Path $DestinationDir "Elmas Studio.exe"
if (Test-Path $origExe) {
  Write-Host "[4/6] Renaming codium.exe to Elmas Studio.exe..." -ForegroundColor Yellow
  Move-Item -Path $origExe -Destination $targetExe -Force
}

# 5. Pre-bundle Elmas Studio Core Extension in portable data directory
Write-Host "[5/6] Pre-bundling Elmas Studio Core Extension..." -ForegroundColor Yellow
$extDir = Join-Path $DestinationDir "data\extensions\elmas-studio-core"
if (!(Test-Path $extDir)) {
  New-Item -ItemType Directory -Force -Path $extDir | Out-Null
}
Copy-Item -Path "dist-extension\*" -Destination $extDir -Recurse -Force

# 6. Customize product.json and settings.json
Write-Host "[6/6] Applying Elmas Studio branding and default workspace..." -ForegroundColor Yellow
$productJsonPath = Join-Path $DestinationDir "resources\app\product.json"
if (Test-Path $productJsonPath) {
  $product = Get-Content $productJsonPath -Raw | ConvertFrom-Json
  $product.nameShort = "Elmas Studio"
  $product.nameLong = "Elmas Studio"
  $product.applicationName = "elmas-studio"
  $product | ConvertTo-Json -Depth 15 | Set-Content $productJsonPath
}

$userSettingsDir = Join-Path $DestinationDir "data\user-data\User"
if (!(Test-Path $userSettingsDir)) {
  New-Item -ItemType Directory -Force -Path $userSettingsDir | Out-Null
}

$settings = @{
  "workbench.colorTheme" = "Default Dark Modern";
  "workbench.startupEditor" = "none";
  "workbench.activityBar.location" = "default";
  "elmasStudio.sdkPaths.androidSdk" = "C:\Users\elmas\AppData\Local\Android\Sdk";
}
$settings | ConvertTo-Json | Set-Content (Join-Path $userSettingsDir "settings.json")

Write-Host "==========================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE!                         " -ForegroundColor Green
Write-Host "  Executable: $targetExe                  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
