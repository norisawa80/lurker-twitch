// Twitch Lurker Pro - Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elementi UI
  const toggleEnabled = document.getElementById('toggleEnabled');
  const toggleHumanDelay = document.getElementById('toggleHumanDelay');
  const toggleKeepAlive = document.getElementById('toggleKeepAlive');
  const toggleShowBadge = document.getElementById('toggleShowBadge');
  const toggleSound = document.getElementById('toggleSound');

  const totalClaimsEl = document.getElementById('totalClaims');
  const totalPointsEl = document.getElementById('totalPoints');
  const historyListEl = document.getElementById('historyList');
  const resetStatsBtn = document.getElementById('resetStatsBtn');
  const statusTextEl = document.getElementById('statusText');
  const statusDotEl = document.querySelector('.status-dot');
  const updateBannerEl = document.getElementById('updateBanner');
  const updateVersionTextEl = document.getElementById('updateVersionText');
  const updateDownloadBtnEl = document.getElementById('updateDownloadBtn');
  const updateNotesTextEl = document.getElementById('updateNotesText');
  const currentVersionTagEl = document.getElementById('currentVersionTag');
  const checkUpdateBtnEl = document.getElementById('checkUpdateBtn');

  const manifestVersion = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest().version
    : '1.0.16';

  if (currentVersionTagEl) {
    currentVersionTagEl.textContent = 'v' + manifestVersion;
  }

  // Formatta numeri con separatore
  function formatNumber(num) {
    return new Intl.NumberFormat('it-IT').format(num || 0);
  }

  // Renderizza la cronologia dei riscatti
  function renderHistory(history) {
    if (!history || history.length === 0) {
      historyListEl.innerHTML = `
        <div class="history-empty">
          <p>Nessun riscatto recente.</p>
          <span>Apri uno stream su Twitch per iniziare a raccogliere punti!</span>
        </div>
      `;
      return;
    }

    historyListEl.innerHTML = history.slice(0, 15).map(item => `
      <div class="history-item">
        <div class="history-item-left">
          <span class="history-time">${item.time || ''}</span>
          <span class="history-channel">📺 ${item.channel || 'Twitch'}</span>
        </div>
        <span class="history-points">+${item.points || 50}</span>
      </div>
    `).join('');
  }

  // Aggiorna interfaccia con i dati correnti
  function updateUI(data) {
    if (data.totalClaims !== undefined) {
      totalClaimsEl.textContent = formatNumber(data.totalClaims);
    }
    if (data.totalPoints !== undefined) {
      totalPointsEl.textContent = '+' + formatNumber(data.totalPoints);
    }
    if (data.enabled !== undefined) {
      toggleEnabled.checked = data.enabled;
    }
    if (data.humanDelay !== undefined) {
      toggleHumanDelay.checked = data.humanDelay;
    }
    if (data.keepAlive !== undefined) {
      toggleKeepAlive.checked = data.keepAlive;
    }
    if (data.showBadge !== undefined && toggleShowBadge) {
      toggleShowBadge.checked = data.showBadge;
    }
    if (data.soundNotification !== undefined) {
      toggleSound.checked = data.soundNotification;
    }
    if (data.history !== undefined) {
      renderHistory(data.history);
    }

    // Mostra sempre la versione reale caricata nel browser
    if (currentVersionTagEl) {
      currentVersionTagEl.textContent = 'v' + manifestVersion;
    }

    if (data.updateAvailable !== undefined && updateBannerEl) {
      if (data.updateAvailable && data.latestVersion !== manifestVersion) {
        updateBannerEl.style.display = 'flex';
        if (data.latestVersion && updateVersionTextEl) {
          updateVersionTextEl.textContent = 'v' + data.latestVersion;
        }
        if (data.updateNotes && updateNotesTextEl) {
          updateNotesTextEl.textContent = data.updateNotes;
        }
        if (updateDownloadBtnEl) {
          updateDownloadBtnEl.textContent = data.diskReady ? '⚡ Attiva subito' : '⬇️ Scarica aggiornamento';
        }
      } else {
        updateBannerEl.style.display = 'none';
      }
    }

    // Stato canale
    if (data.enabled === false) {
      statusTextEl.textContent = 'In Pausa';
      statusDotEl.className = 'status-dot idle';
    } else if (data.currentChannel && data.currentChannel !== 'Twitch') {
      statusTextEl.textContent = `🔴 ${data.currentChannel}`;
      statusDotEl.className = 'status-dot';
    } else {
      statusTextEl.textContent = 'Attivo';
      statusDotEl.className = 'status-dot';
    }
  }

  // Carica dati iniziali dallo storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(null, (data) => {
      updateUI(data);
    });

    // Ascolta modifiche in tempo reale
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        const updated = {};
        for (const [key, change] of Object.entries(changes)) {
          updated[key] = change.newValue;
        }
        updateUI(updated);
      }
    });
  }

  // Gestione toggle impostazioni
  function bindToggle(element, key) {
    element.addEventListener('change', (e) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: e.target.checked });
      }
    });
  }

  bindToggle(toggleEnabled, 'enabled');
  bindToggle(toggleHumanDelay, 'humanDelay');
  bindToggle(toggleKeepAlive, 'keepAlive');
  if (toggleShowBadge) bindToggle(toggleShowBadge, 'showBadge');
  bindToggle(toggleSound, 'soundNotification');

  // Pulsante Reset Statistiche
  resetStatsBtn.addEventListener('click', () => {
    if (confirm('Vuoi azzerare il conteggio dei bauli e la cronologia?')) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          totalClaims: 0,
          totalPoints: 0,
          history: []
        });
      }
    }
  });

  // Controllo aggiornamenti automatico all'apertura del popup + pulsante manuale
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'CHECK_UPDATES' }, (info) => {
      if (info && info.reloaded) {
        if (checkUpdateBtnEl) checkUpdateBtnEl.textContent = `✅ Aggiornato a v${info.appliedVersion}!`;
        if (currentVersionTagEl) currentVersionTagEl.textContent = 'v' + info.appliedVersion;
      }
    });

    if (updateDownloadBtnEl) {
      updateDownloadBtnEl.addEventListener('click', (e) => {
        e.preventDefault();
        updateDownloadBtnEl.textContent = '⏳ Aggiornamento...';
        chrome.runtime.sendMessage({ type: 'APPLY_HOT_UPDATE' }, (info) => {
          if (info && info.reloaded) {
            if (currentVersionTagEl) currentVersionTagEl.textContent = 'v' + info.appliedVersion;
            if (updateBannerEl) updateBannerEl.style.display = 'none';
            if (checkUpdateBtnEl) checkUpdateBtnEl.textContent = `✅ Aggiornato a v${info.appliedVersion}!`;
          } else if (info && info.updateUrl) {
            window.open(info.updateUrl, '_blank');
            updateDownloadBtnEl.textContent = '📦 Zip scaricato!';
          }
        });
      });
    }

    if (checkUpdateBtnEl) {
      checkUpdateBtnEl.addEventListener('click', () => {
        checkUpdateBtnEl.textContent = '⏳ Controllo...';
        chrome.runtime.sendMessage({ type: 'CHECK_UPDATES' }, (info) => {
          if (info && info.reloaded) {
            checkUpdateBtnEl.textContent = `✅ Aggiornato a v${info.appliedVersion}!`;
            if (currentVersionTagEl) currentVersionTagEl.textContent = 'v' + info.appliedVersion;
          } else if (info && info.updateAvailable) {
            checkUpdateBtnEl.textContent = `🚀 v${info.latestVersion} pronta!`;
          } else {
            checkUpdateBtnEl.textContent = `✓ Già alla v${manifestVersion}`;
            setTimeout(() => {
              checkUpdateBtnEl.textContent = '🔄 Controlla aggiornamenti';
            }, 3000);
          }
        });
      });
    }
  }
});
