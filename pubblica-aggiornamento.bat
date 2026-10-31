@echo off
chcp 65001 >nul
title Twitch Lurker Pro - Pubblica Nuovo Aggiornamento
cd /d "%~dp0"

echo ============================================================
echo   🚀 TWITCH LURKER PRO - PUBBLICAZIONE AGGIORNAMENTO
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$verFile = 'version.json';" ^
  "$verObj = Get-Content -Raw -Encoding UTF8 $verFile | ConvertFrom-Json;" ^
  "$oldVer = $verObj.version;" ^
  "$parts = $oldVer.Split('.');" ^
  "$parts[2] = [int]$parts[2] + 1;" ^
  "$newVer = $parts -join '.';" ^
  "Write-Host ('Versione attuale: v' + $oldVer) -ForegroundColor Cyan;" ^
  "$inputVer = Read-Host ('Inserisci nuova versione [Invio per v' + $newVer + ']');" ^
  "if (-not [string]::IsNullOrWhiteSpace($inputVer)) { $newVer = $inputVer.Trim().TrimStart('v') };" ^
  "$notes = Read-Host 'Note di rilascio (opzionale, premi Invio per default)';" ^
  "if ([string]::IsNullOrWhiteSpace($notes)) { $notes = 'Aggiornamento automatico v' + $newVer };" ^
  "$verObj.version = $newVer;" ^
  "$verObj.releaseDate = (Get-Date -Format 'yyyy-MM-dd');" ^
  "$verObj.notes = $notes;" ^
  "$verObj | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $verFile;" ^
  "" ^
  "$manifest = Get-Content -Raw -Encoding UTF8 'manifest.json';" ^
  "$manifest = [regex]::Replace($manifest, '\"version\":\s*\"[^\"]+\"', '\"version\": \"' + $newVer + '\"');" ^
  "Set-Content -Encoding UTF8 -Path 'manifest.json' -Value $manifest -NoNewline;" ^
  "" ^
  "$userJs = Get-Content -Raw -Encoding UTF8 'twitch-lurker-points.user.js';" ^
  "$userJs = [regex]::Replace($userJs, '// @version\s+[^\r\n]+', '// @version      ' + $newVer);" ^
  "$userJs = [regex]::Replace($userJs, 'const CURRENT_VERSION = ''[^'']+'';', 'const CURRENT_VERSION = ''' + $newVer + ''';');" ^
  "Set-Content -Encoding UTF8 -Path 'twitch-lurker-points.user.js' -Value $userJs -NoNewline;" ^
  "" ^
  "$tmObj = [ordered]@{ version = 1; scripts = @([ordered]@{ name = 'Twitch Lurker Pro - Auto Channel Points & Keep-Alive'; enabled = $true; position = 1; source = $userJs }) };" ^
  "$tmObj | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 'tampermonkey-backup.json';" ^
  "" ^
  "$installa = Get-Content -Raw -Encoding UTF8 'INSTALLA.html';" ^
  "$pattern = '(?s)(<script type=\"text/plain\" id=\"userscriptCode\">).*?(</script>)';" ^
  "$installa = [regex]::Replace($installa, $pattern, ('$1' + $userJs.Trim() + '$2'));" ^
  "Set-Content -Encoding UTF8 -Path 'INSTALLA.html' -Value $installa -NoNewline;" ^
  "" ^
  "$popup = Get-Content -Raw -Encoding UTF8 'popup\popup.html';" ^
  "$popup = [regex]::Replace($popup, 'id=\"currentVersionTag\">v[^<]+<', 'id=\"currentVersionTag\">v' + $newVer + '<');" ^
  "Set-Content -Encoding UTF8 -Path 'popup\popup.html' -Value $popup -NoNewline;" ^
  "" ^
  "Set-Clipboard -Value $userJs;" ^
  "Write-Host '';" ^
  "Write-Host ('[OK] Tutti i file sincronizzati alla versione v' + $newVer + '!') -ForegroundColor Green;" ^
  "Write-Host '[OK] Codice Userscript copiato automaticamente negli Appunti di Windows!' -ForegroundColor Green;"

echo.
if exist ".git" (
  echo Invio aggiornamento su GitHub in corso...
  git add -A
  git commit -m "Release update"
  git push -u origin main
  echo.
  echo [COMPLETATO] Aggiornamento pubblicato su GitHub! Tutti gli utenti riceveranno la notifica.
) else (
  echo [INFO] Cartella non ancora collegata a GitHub.
  echo Per attivare l'auto-update online, esegui una sola volta:
  echo   git init
  echo   git remote add origin https://github.com/norisawa80/lurker-twitch.git
  echo   git branch -M main
  echo   git push -u origin main
)

echo.
pause

