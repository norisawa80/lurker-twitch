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

async function checkForUpdates() {
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const hasUpdate = isNewerVersion(data.version, currentVersion);

    const updateInfo = {
      updateAvailable: hasUpdate,
      latestVersion: data.version || currentVersion,
      updateUrl: data.downloadUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip',
      updateNotes: data.notes || '',
      lastUpdateCheck: Date.now()
    };

    chrome.storage.local.set(updateInfo);

    if (hasUpdate) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    }
    return updateInfo;
  } catch (e) {
    return null;
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Twitch Lurker Pro] Estensione installata/aggiornata:', details.reason);

  chrome.storage.local.get(
    ['enabled', 'humanDelay', 'keepAlive', 'showBadge', 'soundNotification', 'totalClaims', 'totalPoints', 'history'],
    (data) => {
      const defaults = {};
      if (data.enabled === undefined) defaults.enabled = true;
      if (data.humanDelay === undefined) defaults.humanDelay = true;
      if (data.keepAlive === undefined) defaults.keepAlive = true;
      if (data.showBadge === undefined) defaults.showBadge = true;
      if (data.soundNotification === undefined) defaults.soundNotification = false;
      if (data.totalClaims === undefined) defaults.totalClaims = 0;
      if (data.totalPoints === undefined) defaults.totalPoints = 0;
      if (!Array.isArray(data.history)) defaults.history = [];

      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    }
  );

  chrome.action.setBadgeBackgroundColor({ color: '#9146FF' });
  checkForUpdates();
});

chrome.runtime.onStartup.addListener(() => {
  checkForUpdates();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'CHECK_UPDATES') {
    checkForUpdates().then((info) => sendResponse(info));
    return true;
  }
});

// Controllo periodico ogni 4 ore
setInterval(checkForUpdates, 4 * 60 * 60 * 1000);

// Ascolta gli aggiornamenti di storage per aggiornare il badge dell'icona
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.totalClaims) {
    chrome.storage.local.get(['updateAvailable'], (res) => {
      if (res && res.updateAvailable) return; // Mantieni avviso NEW se c'è un aggiornamento

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
