// Twitch Lurker Pro - Service Worker (Background)

const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/version.json';

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

// Legge la versione reale del file manifest.json presente su disco nella cartella dell'estensione
async function getDiskVersion() {
  try {
    const url = chrome.runtime.getURL('manifest.json') + '?t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const diskManifest = await res.json();
    return diskManifest && diskManifest.version ? String(diskManifest.version) : null;
  } catch (e) {
    return null;
  }
}

// Ricarica le schede Twitch aperte e poi ricarica l'estensione in memoria (senza riavviare il browser)
function reloadExtensionAndTwitchTabs() {
  try {
    chrome.tabs.query({ url: '*://*.twitch.tv/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        for (const tab of tabs) {
          if (tab.id) chrome.tabs.reload(tab.id);
        }
      }
      setTimeout(() => {
        chrome.runtime.reload();
      }, 350);
    });
  } catch (e) {
    chrome.runtime.reload();
  }
}

async function checkForUpdates(triggerReloadIfReady = false) {
  try {
    // Versione attualmente caricata nella RAM del browser
    const memoryVersion = chrome.runtime.getManifest().version;
    // Versione presente nei file su disco nella cartella dell'estensione
    const diskVersion = await getDiskVersion();

    // 1. Se i file su disco sono già stati aggiornati rispetto alla memoria del browser
    if (diskVersion && isNewerVersion(diskVersion, memoryVersion)) {
      if (triggerReloadIfReady) {
        await chrome.storage.local.set({
          updateAvailable: false,
          latestVersion: diskVersion,
          appliedVersion: diskVersion
        });
        chrome.action.setBadgeText({ text: '' });
        reloadExtensionAndTwitchTabs();
        return {
          reloaded: true,
          appliedVersion: diskVersion,
          latestVersion: diskVersion,
          updateAvailable: false
        };
      }

      const diskUpdateInfo = {
        updateAvailable: true,
        diskReady: true,
        latestVersion: diskVersion,
        appliedVersion: memoryVersion,
        updateNotes: 'File già pronti su disco: clicca per attivare subito senza riavviare il browser!',
        lastUpdateCheck: Date.now()
      };
      await chrome.storage.local.set(diskUpdateInfo);
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
      return diskUpdateInfo;
    }

    // 2. Controlla su GitHub se esiste una versione più recente di quella in memoria
    const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const remoteVer = data.version || memoryVersion;
    const hasUpdate = isNewerVersion(remoteVer, memoryVersion);

    const updateInfo = {
      updateAvailable: hasUpdate,
      diskReady: false,
      latestVersion: remoteVer,
      appliedVersion: memoryVersion,
      updateUrl: data.downloadUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip',
      updateNotes: data.changelog || data.notes || '',
      lastUpdateCheck: Date.now()
    };

    await chrome.storage.local.set(updateInfo);

    if (hasUpdate) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    return updateInfo;
  } catch (e) {
    return null;
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  const currentVer = chrome.runtime.getManifest().version;
  console.log(`[Twitch Lurker Pro v${currentVer}] Estensione installata/aggiornata:`, details.reason);

  chrome.storage.local.get(
    ['enabled', 'humanDelay', 'keepAlive', 'showBadge', 'soundNotification', 'totalClaims', 'totalPoints', 'history'],
    (data) => {
      const defaults = {
        appliedVersion: currentVer,
        updateAvailable: false
      };
      if (data.enabled === undefined) defaults.enabled = true;
      if (data.humanDelay === undefined) defaults.humanDelay = true;
      if (data.keepAlive === undefined) defaults.keepAlive = true;
      if (data.showBadge === undefined) defaults.showBadge = true;
      if (data.soundNotification === undefined) defaults.soundNotification = false;
      if (data.totalClaims === undefined) defaults.totalClaims = 0;
      if (data.totalPoints === undefined) defaults.totalPoints = 0;
      if (!Array.isArray(data.history)) defaults.history = [];

      chrome.storage.local.set(defaults);
    }
  );

  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#9146FF' });
  checkForUpdates(false);
});

chrome.runtime.onStartup.addListener(() => {
  checkForUpdates(true);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'CHECK_UPDATES') {
    // Se i file su disco sono già aggiornati quando l'utente clicca "Controlla aggiornamenti", ricarica subito l'estensione!
    checkForUpdates(true).then((info) => sendResponse(info));
    return true;
  }
  if (msg && msg.type === 'APPLY_HOT_UPDATE') {
    checkForUpdates(true).then((info) => sendResponse(info));
    return true;
  }
});

// Controlla ogni 25 secondi se i file nella cartella locale sono stati aggiornati:
// se sì, ricarica automaticamente l'estensione senza dover riavviare il browser!
setInterval(async () => {
  const memoryVersion = chrome.runtime.getManifest().version;
  const diskVersion = await getDiskVersion();
  if (diskVersion && isNewerVersion(diskVersion, memoryVersion)) {
    console.log(`[Twitch Lurker Pro] Nuova versione v${diskVersion} rilevata su disco! Ricarico estensione...`);
    reloadExtensionAndTwitchTabs();
  }
}, 25000);

// Controllo periodico su GitHub ogni 4 ore
setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);

// Ascolta gli aggiornamenti di storage per aggiornare il badge dell'icona
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.totalClaims) {
    chrome.storage.local.get(['updateAvailable'], (res) => {
      if (res && res.updateAvailable) return;

      const claims = changes.totalClaims.newValue;
      if (claims > 0) {
        chrome.action.setBadgeText({ text: claims > 999 ? '999+' : claims.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

        setTimeout(() => {
          chrome.action.setBadgeBackgroundColor({ color: '#9146FF' });
        }, 3000);
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    });
  }
});
