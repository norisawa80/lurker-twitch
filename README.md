# 🟣 Twitch Lurker Pro - Auto Punti Canale & Keep-Alive

Un'estensione e userscript ultra-leggero progettato specificamente per **riscattare automaticamente i bauli bonus dei Punti Canale (+50 punti)** e **prevenire l'esclusione del viewer count da parte del sistema anti-bot di Twitch**.

---

## 🌟 Caratteristiche Principali

- **⚡ Auto-Riscatto Intelligente**: Rileva istantaneamente la comparsa del baule verde dei punti canale in qualsiasi lingua (Italiano, Inglese, Spagnolo, Francese, Tedesco, ecc.).
- **🛡️ Ritardo Umano Anti-Bot**: Non clicca a 0 millisecondi (comportamento tipico dei bot), ma applica un ritardo casuale e naturale tra **1.2s e 3.8s** con eventi puntatore realistici (`pointerdown`, `mousedown`, `mouseup`, `click`).
- **💤 Anti-Sleep / Keep-Alive**: Invia micro-segnali periodici ed evita che il browser (Chrome/Edge Memory Saver) congeli la scheda video o tagli la telemetria di Twitch.
- **📊 Dashboard Grafica Moderna**: Interfaccia popup in stile Twitch con tema scuro, contatore bauli, punti totali stimati, canale attivo e storico riscatti.
- **🔇 Compatibile con Lurk Silenzioso**: Funziona perfettamente anche se la scheda del browser è silenziata.

---

## ⚡ Installazione Rapida per Principianti (Scegli quello che preferisci)

Per rendere l'installazione accessibile a tutti senza dover copiare/incollare codice o cercare cartelle complesse, abbiamo creato 2 strumenti dedicati:

1. **🌐 Guida Visiva Interattiva**: fai doppio clic su [`INSTALLA.html`](INSTALLA.html) per aprire una pagina grafica nel browser con pulsanti di copia del percorso e importazione in un clic.
2. **💾 File da Importare in Tampermonkey**: [`tampermonkey-backup.json`](tampermonkey-backup.json) (si importa direttamente dalla scheda *Utilità* di Tampermonkey).

---

## 📜 Metodo 1: Importazione Userscript (Tampermonkey / Violentmonkey) - *Più Facile*

Funziona su **qualsiasi browser** (Chrome, Edge, Brave, Opera, Firefox) senza dover attivare la modalità sviluppatore.

### Modo A: Importazione Diretta del file `.json` (Consigliato)
1. Clicca sull'icona di **Tampermonkey** e seleziona **Dashboard**.
2. Vai nella scheda in alto **Utilità** (*Utilities*).
3. Nella sezione **Importa da file** (*File Import*), clicca su **Scegli file** e seleziona [`tampermonkey-backup.json`](tampermonkey-backup.json).
4. Clicca su **Importa** o **Installa**. Fine!

### Modo B: Trascina con il Mouse
1. Apri la Dashboard di Tampermonkey nel browser.
2. Trascina semplicemente il file [`twitch-lurker-points.user.js`](twitch-lurker-points.user.js) dalla cartella direttamente dentro la finestra del browser.
3. Si aprirà la schermata di Tampermonkey: clicca sul pulsante verde **"Installa"**.

---

## 🚀 Metodo 2: Installare come Estensione Chrome / Edge / Brave

Se vuoi l'icona viola nella barra degli strumenti e la popup dashboard completa con statistiche e storico riscatti:

1. Apri il browser e vai su `chrome://extensions/` (o `edge://extensions/`).
2. Attiva la spunta **"Modalità sviluppatore"** in alto a destra.
3. Clicca su **"Carica estensione non pacchettizzata"** (*Load unpacked*).
4. Seleziona la cartella **"lurker-twitch"** (ovunque tu l'abbia estratta, es. nei tuoi *Download* o sul tuo *Desktop*).
   *💡 Consiglio rapido:* puoi aprire [`INSTALLA.html`](INSTALLA.html) per copiare con 1 clic il percorso automatico rilevato su qualsiasi computer.
5. Fatto! Fissa l'icona viola nella barra degli strumenti per consultare la dashboard.

---

## 🦊 Come usarlo su Mozilla Firefox

Dato che la versione stabile di Firefox disattiva le estensioni non firmate al riavvio del browser, su Firefox il metodo ideale e definitivo è il **Metodo 1 (Userscript)** tramite l'estensione **Tampermonkey** o **Violentmonkey**.

Se desideri comunque testare l'estensione completa temporaneamente:
1. Digita `about:debugging#/runtime/this-firefox` nella barra degli indirizzi.
2. Clicca su **"Carica componente aggiuntivo temporaneo..."**.
3. Seleziona il file [`manifest.json`](manifest.json).

---

## 💡 Best Practice per un Lurk che Conta Sempre come Viewer

Twitch ha inasprito i filtri anti-bot e scarta silenziosamente le visualizzazioni che presentano anomalie. Per assicurarti che la tua visualizzazione sia **sempre conteggiata**:

1. **Non silenziare il player di Twitch**:
   - Lascia il cursore del volume del player di Twitch all'1% o 5%.
   - Fai clic destro sulla **scheda del browser** e seleziona **"Disattiva audio scheda"** (*Mute Tab*).
2. **Disattiva il congelamento scheda per Twitch**:
   - In Chrome: `Impostazioni` → `Rendimento` → aggiungi `https://www.twitch.tv` all'elenco *"Mantieni sempre attivi questi siti"*.
3. **Risoluzione a 160p**:
   - Se hai banda limitata o tieni la finestra in background, imposta 160p: consuma pochissimi dati ma continua a scaricare regolarmente i flussi video.
4. **Massimo 2 stream contemporanei**:
   - Twitch limita i viewer validi a massimo 1 o 2 per indirizzo IP/account. Più schede aperte oltre la seconda non vengono conteggiate.
