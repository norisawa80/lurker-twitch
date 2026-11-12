#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"
echo "============================================================"
echo "  🔄 TWITCH LURKER PRO - AGGIORNAMENTO AUTOMATICO (LINUX)"
echo "============================================================"
echo ""

if [ -d ".git" ] && command -v git >/dev/null 2>&1; then
  echo "Aggiornamento tramite Git in corso..."
  git fetch origin main
  git reset --hard origin/main
else
  echo "Scaricamento dell'ultima versione da GitHub in corso..."
  TMP_ZIP="/tmp/tlp_update_$$.zip"
  TMP_DIR="/tmp/tlp_extract_$$"
  curl -sL "https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip" -o "$TMP_ZIP"
  rm -rf "$TMP_DIR"
  mkdir -p "$TMP_DIR"
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"
  cp -rf "$TMP_DIR"/lurker-twitch-*/* .
  rm -rf "$TMP_ZIP" "$TMP_DIR"
fi

chmod +x aggiorna-estensione.sh 2>/dev/null || true
echo ""
echo "✅ [SUCCESSO] Cartella aggiornata all'ultima versione!"
echo "👉 Ora vai su vivaldi://extensions (o chrome://extensions) e premi l'icona 🔄 Ricarica."
