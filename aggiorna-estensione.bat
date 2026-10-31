@echo off
chcp 65001 >nul
title Twitch Lurker Pro - Aggiornamento Automatico
cd /d "%~dp0"

echo ============================================================
echo   🔄 TWITCH LURKER PRO - AGGIORNAMENTO RAPIDO
echo ============================================================
echo.
echo Scaricamento dell'ultima versione da GitHub in corso...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$zipUrl = 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip';" ^
  "$tempZip = Join-Path $env:TEMP 'tlp_update.zip';" ^
  "$tempDir = Join-Path $env:TEMP 'tlp_update_extracted';" ^
  "Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing;" ^
  "if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force };" ^
  "Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force;" ^
  "$innerDir = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1;" ^
  "Copy-Item -Path (Join-Path $innerDir.FullName '*') -Destination (Get-Location) -Recurse -Force;" ^
  "Remove-Item $tempZip -Force -ErrorAction SilentlyContinue;" ^
  "Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue;" ^
  "$ver = (Get-Content -Raw 'version.json' | ConvertFrom-Json).version;" ^
  "Write-Host ('[SUCCESSO] Estensione aggiornata alla versione v' + $ver + '!') -ForegroundColor Green;" ^
  "Write-Host 'Ora ti basta ricaricare la pagina di Twitch (F5).' -ForegroundColor Yellow;"

echo.
pause

