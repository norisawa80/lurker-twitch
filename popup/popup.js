// Twitch Lurker Pro - Popup Logic (v1.1.0)

document.addEventListener('DOMContentLoaded', () => {
  const DISK_VERSION = '1.1.0';
  const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/version.json';

  // Elementi UI
  const toggleEnabled = document.getElementById('toggleEnabled');
  const toggleHumanDelay = document.getElementById('toggleHumanDelay');
  const toggleKeepAlive = document.getElementById('toggleKeepAlive');
  const toggleAutoRecover = document.getElementById('toggleAutoRecover');
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

  // Elementi Modalità Lurk & Contatore Schede
  const lurkModeBtn = document.getElementById('lurkModeBtn');
  const lurkBtnIcon = document.getElementById('lurkBtnIcon');
  const lurkBtnTitle = document.getElementById('lurkBtnTitle');
  const lurkBtnSub = document.getElementById('lurkBtnSub');
  const tabsCounterBar = document.getElementById('tabsCounterBar');
  const tabsCounterText = document.getElementById('tabsCounterText');

  let activeTwitchTabId = null;
  let isCurrentTabLurking = false;

  // Versione realmente caricata nella RAM del browser
  const memoryVersion = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest().version
    : DISK_VERSION;

  if (currentVersionTagEl) {
    currentVersionTagEl.textContent = 'v' + memoryVersion;
  }

  function isNewerVersion(remote, local) {
    if (!remote || !local) return false;
    const r = String(remote).replace(/^v/i, '').split('.').map(Number);
    const l = String(local).replace(/^v/i, '').split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  function isTwitchChannelTab(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      if (!u.hostname.endsWith('twitch.tv')) return false;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length === 0) return false;
      const nonChannels = ['directory', 'settings', 'videos', 'downloads', 'wallet', 'subscriptions', 'inventory', 'drops', 'search', 'friends', 'messages'];
      return !nonChannels.includes(parts[0].toLowerCase());
    } catch (e) {
      return false;
    }
  }

  function renderLurkButtonState(isActive, hasTab) {
    isCurrentTabLurking = Boolean(isActive);
    if (!lurkModeBtn) return;

    if (!hasTab) {
      lurkModeBtn.classList.remove('active');
      if (lurkBtnIcon) lurkBtnIcon.textContent = '🌙';
      if (lurkBtnTitle) lurkBtnTitle.textContent = 'Modalità Lurk (Apri una live Twitch)';
      if (lurkBtnSub) lurkBtnSub.textContent = 'Silenzia la scheda del browser + qualità 160p salva-banda';
      return;
    }

    if (isCurrentTabLurking) {
      lurkModeBtn.classList.add('active');
      if (lurkBtnIcon) lurkBtnIcon.textContent = '🔊';
      if (lurkBtnTitle) lurkBtnTitle.textContent = 'Modalità Lurk ATTIVA (Scheda Mutata + 160p)';
      if (lurkBtnSub) lurkBtnSub.textContent = 'Clicca per riattivare l\'audio della scheda e la qualità normale';
    } else {
      lurkModeBtn.classList.remove('active');
      if (lurkBtnIcon) lurkBtnIcon.textContent = '🌙';
      if (lurkBtnTitle) lurkBtnTitle.textContent = 'Attiva Modalità Lurk (1-Click)';
      if (lurkBtnSub) lurkBtnSub.textContent = 'Muta scheda browser (non il player) + qualità 160p salva-banda';
    }
  }

  function renderTabsCounter(count) {
    if (!tabsCounterBar || !tabsCounterText) return;
    if (count > 2) {
      tabsCounterBar.classList.add('warning');
      tabsCounterText.innerHTML = `⚠️ Hai <strong>${count} live Twitch</strong> aperte! Twitch conteggia il lurk su massimo <strong>2 stream</strong> contemporanei: chiudi le schede extra per risparmiare RAM e banda.`;
    } else if (count > 0) {
      tabsCounterBar.classList.remove('warning');
      tabsCounterText.innerHTML = `📺 Live Twitch aperte: <strong>${count}/2</strong> (Ottimale per il lurk e Memory Saver disattivato)`;
    } else {
      tabsCounterBar.classList.remove('warning');
      tabsCounterText.innerHTML = `📺 Nessuna live Twitch aperta al momento`;
    }
  }

  // Controlla le schede Twitch aperte e lo stato della scheda attiva
  function inspectTwitchTabs() {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) return;

    chrome.tabs.query({ url: '*://*.twitch.tv/*' }, (tabs) => {
      if (!tabs) return;
      const channelTabs = tabs.filter(t => isTwitchChannelTab(t.url));
      renderTabsCounter(channelTabs.length);

      // Trova la scheda Twitch attiva nella finestra corrente (o la prima scheda canale Twitch aperta)
      const activeTab = channelTabs.find(t => t.active) || channelTabs[0] || tabs[0];
      if (!activeTab || !activeTab.id) {
        activeTwitchTabId = null;
        renderLurkButtonState(false, false);
        return;
      }

      activeTwitchTabId = activeTab.id;
      const tabMuted = Boolean(activeTab.mutedInfo && activeTab.mutedInfo.muted);

      // Assicura autoDiscardable: false sulla scheda attiva se keepAlive è attivo
      if (toggleKeepAlive && toggleKeepAlive.checked) {
        chrome.tabs.update(activeTab.id, { autoDiscardable: false }, () => {
          void chrome.runtime.lastError;
        });
      }

      chrome.tabs.sendMessage(activeTab.id, { type: 'GET_TAB_LURK_STATE' }, (res) => {
        void chrome.runtime.lastError;
        const lurkOn = (res && res.lurkMode) || tabMuted;
        renderLurkButtonState(lurkOn, true);
      });
    });
  }

  if (lurkModeBtn) {
    lurkModeBtn.addEventListener('click', () => {
      if (!activeTwitchTabId) {
        inspectTwitchTabs();
        return;
      }
      const nextState = !isCurrentTabLurking;
      renderLurkButtonState(nextState, true);

      // Muta/smuta la scheda del browser tramite API nativa e imposta 160p nel player
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update) {
        chrome.tabs.update(activeTwitchTabId, {
          muted: nextState,
          autoDiscardable: false
        }, () => {
          void chrome.runtime.lastError;
          chrome.tabs.sendMessage(activeTwitchTabId, {
            type: 'SET_LURK_QUALITY',
            enable: nextState
          }, () => {
            void chrome.runtime.lastError;
          });
        });
      }
    });
  }

  async function getDiskManifestVersion() {
    try {
      const res = await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return DISK_VERSION;
      const data = await res.json();
      return (data && data.version) ? String(data.version) : DISK_VERSION;
    } catch (e) {
      return DISK_VERSION;
    }
  }

  // Ricarica direttamente dall'interno del popup le schede Twitch e l'estensione
  function applyReloadNow(targetVer) {
    if (updateDownloadBtnEl) updateDownloadBtnEl.textContent = `✅ Aggiornato a v${targetVer}!`;
    if (checkUpdateBtnEl) checkUpdateBtnEl.textContent = `✅ Aggiornato a v${targetVer}! Ricarico...`;
    if (currentVersionTagEl) currentVersionTagEl.textContent = 'v' + targetVer;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        updateAvailable: false,
        latestVersion: targetVer,
        appliedVersion: targetVer
      });
    }

    setTimeout(() => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({ url: '*://*.twitch.tv/*' }, (tabs) => {
            if (tabs && tabs.length > 0) {
              for (const tab of tabs) {
                if (tab.id) chrome.tabs.reload(tab.id);
              }
            }
          });
        }
      } catch (e) {}
      setTimeout(() => {
        chrome.runtime.reload();
      }, 150);
    }, 400);
  }

  // Controlla stato aggiornamenti confrontando RAM vs Disco vs GitHub direttamente nel popup
  async function checkUpdatesDirectly(autoApplyIfOnDisk = false) {
    const diskVer = await getDiskManifestVersion();

    // 1. Se su disco c'è già una versione più nuova rispetto a quella in RAM nel browser
    if (isNewerVersion(diskVer, memoryVersion)) {
      if (autoApplyIfOnDisk) {
        applyReloadNow(diskVer);
        return;
      }
      if (updateBannerEl) updateBannerEl.style.display = 'flex';
      if (updateVersionTextEl) updateVersionTextEl.textContent = 'v' + diskVer;
      if (updateNotesTextEl) updateNotesTextEl.textContent = 'Aggiornamento già scaricato su disco: clicca per attivarlo subito senza riavviare!';
      if (updateDownloadBtnEl) updateDownloadBtnEl.textContent = `⚡ Attiva v${diskVer} ora`;
      if (checkUpdateBtnEl) checkUpdateBtnEl.textContent = `⚡ Attiva v${diskVer} ora`;
      return;
    }

    // 2. Controlla su GitHub se c'è una versione più nuova
    try {
      const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const remoteVer = data.version || memoryVersion;

      if (isNewerVersion(remoteVer, memoryVersion)) {
        if (updateBannerEl) updateBannerEl.style.display = 'flex';
        if (updateVersionTextEl) updateVersionTextEl.textContent = 'v' + remoteVer;
        if (updateNotesTextEl) updateNotesTextEl.textContent = data.changelog || data.notes || '';
        if (updateDownloadBtnEl) {
          updateDownloadBtnEl.textContent = '⬇️ Scarica aggiornamento';
          updateDownloadBtnEl.dataset.downloadUrl = data.downloadUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip';
        }
        if (checkUpdateBtnEl) checkUpdateBtnEl.textContent = `🚀 v${remoteVer} disponibile!`;
      } else {
        if (updateBannerEl) updateBannerEl.style.display = 'none';
        if (autoApplyIfOnDisk && checkUpdateBtnEl) {
          checkUpdateBtnEl.textContent = `✓ Già aggiornato (v${memoryVersion})`;
          setTimeout(() => {
            checkUpdateBtnEl.textContent = '🔄 Controlla aggiornamenti';
          }, 3000);
        }
      }
    } catch (e) {}
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
    if (data.autoRecover !== undefined && toggleAutoRecover) {
      toggleAutoRecover.checked = data.autoRecover;
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
    if (typeof data.openTwitchTabsCount === 'number') {
      renderTabsCounter(data.openTwitchTabsCount);
    }

    if (currentVersionTagEl) {
      currentVersionTagEl.textContent = 'v' + memoryVersion;
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
      inspectTwitchTabs();
    });

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
    if (!element) return;
    element.addEventListener('change', (e) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: e.target.checked });
      }
      if (key === 'keepAlive' && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  }

  bindToggle(toggleEnabled, 'enabled');
  bindToggle(toggleHumanDelay, 'humanDelay');
  bindToggle(toggleKeepAlive, 'keepAlive');
  bindToggle(toggleAutoRecover, 'autoRecover');
  bindToggle(toggleShowBadge, 'showBadge');
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

  // All'apertura del popup controlla subito schede e aggiornamenti
  inspectTwitchTabs();
  checkUpdatesDirectly(false);

  if (updateDownloadBtnEl) {
    updateDownloadBtnEl.addEventListener('click', async (e) => {
      e.preventDefault();
      const diskVer = await getDiskManifestVersion();
      if (isNewerVersion(diskVer, memoryVersion)) {
        applyReloadNow(diskVer);
      } else {
        const dlUrl = updateDownloadBtnEl.dataset.downloadUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip';
        window.open(dlUrl, '_blank');
        updateDownloadBtnEl.textContent = '📦 Zip scaricato!';
      }
    });
  }

  if (checkUpdateBtnEl) {
    checkUpdateBtnEl.addEventListener('click', async () => {
      checkUpdateBtnEl.textContent = '⏳ Controllo...';
      await checkUpdatesDirectly(true);
    });
  }
});
