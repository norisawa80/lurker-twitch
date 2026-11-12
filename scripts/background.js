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

function getEffectiveVersion(manifestVer, appliedVer) {
  if (appliedVer && isNewerVersion(appliedVer, manifestVer)) {
    return appliedVer;
  }
  return manifestVer;
}

async function checkForUpdates(autoApply = false) {
  try {
    const manifestVersion = chrome.runtime.getManifest().version;
    const stored = await chrome.storage.local.get(['appliedVersion']);
    const currentVersion = getEffectiveVersion(manifestVersion, stored.appliedVersion);

    const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const remoteVer = data.version || currentVersion;

    if (autoApply && isNewerVersion(remoteVer, currentVersion)) {
      const appliedInfo = {
        appliedVersion: remoteVer,
        latestVersion: remoteVer,
        updateAvailable: false,
        remoteConfig: data.config || { badgePosition: 'top' },
        updateNotes: data.notes || '',
        lastUpdateCheck: Date.now()
      };
      await chrome.storage.local.set(appliedInfo);
      chrome.action.setBadgeText({ text: '' });
      return appliedInfo;
    }

    const hasUpdate = isNewerVersion(remoteVer, currentVersion);

    const updateInfo = {
      updateAvailable: hasUpdate,
      latestVersion: remoteVer,
      appliedVersion: currentVersion,
      remoteConfig: data.config || { badgePosition: 'top' },
      updateUrl: data.downloadUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip',
      updateNotes: data.notes || '',
      lastUpdateCheck: Date.now()
    };

    await chrome.storage.local.set(updateInfo);

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
  checkForUpdates(false);
});

chrome.runtime.onStartup.addListener(() => {
  checkForUpdates(false);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'CHECK_UPDATES') {
    checkForUpdates(false).then((info) => sendResponse(info));
    return true;
  }
  if (msg && msg.type === 'APPLY_HOT_UPDATE') {
    checkForUpdates(true).then((info) => sendResponse(info));
    return true;
  }
});

// Controllo periodico ogni 4 ore
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
