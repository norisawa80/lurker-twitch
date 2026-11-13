// Twitch Lurker Pro - Content Script (Modalità Ultra-Leggera)
(function () {
  'use strict';

  const RAID_COOLDOWN_MS = 100 * 1000; // Blocco di sicurezza di 100 secondi quando viene rilevato un Raid
  const RAID_COMMAND_GRACE_MS = 8000;  // Tolleranza tra invio comando /raid e comparsa del banner

  let raidPauseUntil = 0;
  let lastRaidCommandAt = 0;
  let wasRaidBannerVisible = false;
  let bannerMissingChecks = 0;
  let lastPath = window.location.pathname;

  console.log('[Twitch Lurker Pro] Script avviato con Scudo Anti-Unraid Intelligente (100s + Auto-Reset su Annulla).');

  function activateRaidLock(reason, resetFullTimer = false) {
    const now = Date.now();
    if (now >= raidPauseUntil || resetFullTimer) {
      raidPauseUntil = now + RAID_COOLDOWN_MS;
      console.log(`[Twitch Lurker Pro] 🛡️ Raid rilevato (${reason})! Blocco di 100 secondi attivato.`);
    } else {
      raidPauseUntil = Math.max(raidPauseUntil, now + RAID_COOLDOWN_MS);
    }
    bannerMissingChecks = 0;
    renderBadgeContent();
  }

  function clearRaidLock(reason) {
    if (raidPauseUntil > 0 || wasRaidBannerVisible) {
      raidPauseUntil = 0;
      lastRaidCommandAt = 0;
      wasRaidBannerVisible = false;
      bannerMissingChecks = 0;
      console.log(`[Twitch Lurker Pro] ✅ Raid annullato/terminato (${reason}). Estensione riattivata!`);
      renderBadgeContent();
    }
  }

  // SCUDO GLOBALE ANTI-UNRAID + RILEVAMENTO CLIC UMANO SU "ANNULLA RAID"
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtType) => {
    window.addEventListener(evtType, (e) => {
      try {
        const target = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;

        // 1. Se è un clic automatico (!e.isTrusted), bloccalo se non è sul baule punti in basso o se c'è un raid
        if (!e.isTrusted) {
          const inSummary = target && target.closest('[data-test-selector="community-points-summary"], .community-points-summary');
          const hasChestIcon = target && target.querySelector('.claimable-bonus__icon');
          const inputBox = document.querySelector('[data-a-target="chat-input"]');
          const isBelowChat = (!inputBox || !target) ? false : (target.getBoundingClientRect().top >= inputBox.getBoundingClientRect().top);

          if (!inSummary || !hasChestIcon || !isBelowChat || isRaidActive()) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            console.warn('[Twitch Lurker Pro] 🛡️ Bloccato clic automatico sospetto fuori dal baule punti:', target);
          }
          return;
        }

        // 2. Se è un clic UMANO (e.isTrusted === true) sul bottone "Annulla" del raid, riattiva subito lo script
        if (evtType === 'click' && e.isTrusted && target && (raidPauseUntil > Date.now() || wasRaidBannerVisible)) {
          const btnText = ((target.textContent || '') + ' ' + (target.getAttribute('aria-label') || '')).toLowerCase();
          if (/annulla|cancel|unraid|abbandona|leave/i.test(btnText)) {
            setTimeout(() => clearRaidLock('clic umano su Annulla'), 300);
          }
        }
      } catch (err) {}
    }, true);
  });

  let config = {
    enabled: true,
    humanDelay: true,
    keepAlive: true,
    showBadge: true,
    soundNotification: false
  };

  let isClaiming = false;
  let keepAliveInterval = null;
  let currentPoints = parseInt(localStorage.getItem('tlp_claimed_count') || '0', 10) * 50;
  let isCollapsed = localStorage.getItem('tlp_badge_collapsed') === '1';
  let latestUpdate = null; // { version, url }

  // Posiziona il badge in ALTO sopra la chat (nella barra superiore della chat, top: 56px)
  function positionBadge() {
    try {
      const legacyBadge = document.getElementById('tlp-badge');
      if (legacyBadge) legacyBadge.remove();

      const badge = document.getElementById('tlp-badge-v2');
      if (!badge) return;

      badge.style.setProperty('top', '56px', 'important');
      badge.style.setProperty('bottom', 'auto', 'important');
      badge.style.setProperty('right', '46px', 'important');
    } catch (e) {}
  }

  function renderBadgeContent() {
    const badge = document.getElementById('tlp-badge-v2');
    if (!badge) return;

    const remainingRaidSec = Math.max(0, Math.ceil((raidPauseUntil - Date.now()) / 1000));
    const raidHtml = remainingRaidSec > 0
      ? `<span style="margin-left:6px; background:#f59e0b; color:#18181b; font-weight:800; font-size:10px; padding:1px 6px; border-radius:999px;" title="Blocco di sicurezza anti-raid attivo (si disattiva da solo se il raid viene annullato)">🛡️ Pausa Raid ${remainingRaidSec}s</span>`
      : '';

    const updateHtml = latestUpdate
      ? `<a href="${latestUpdate.url}" target="_blank" id="tlp-update-link" title="Nuova versione v${latestUpdate.version} disponibile! Clicca per scaricare" style="margin-left:6px; background:#10b981; color:#042718; font-weight:800; font-size:10px; padding:1px 6px; border-radius:999px; text-decoration:none;">⬆️ v${latestUpdate.version}</a>`
      : '';

    const extVer = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
      ? chrome.runtime.getManifest().version
      : '1.0.14';

    if (isCollapsed) {
      badge.innerHTML = `<span title="Twitch Lurker Pro v${extVer} - Clicca per mostrare (Alt+B)" style="cursor:pointer; font-size:13px;">💎</span>${raidHtml}${updateHtml}`;
      badge.style.padding = '4px 7px';
      badge.style.opacity = (latestUpdate || remainingRaidSec > 0) ? '0.95' : '0.55';
    } else {
      badge.innerHTML = `
        <span>💎 Lurker Pro <small style="opacity:0.65; font-size:9.5px;">v${extVer}</small>: <strong id="tlp-count">${currentPoints}</strong> pts</span>
        ${raidHtml}
        ${updateHtml}
        <span id="tlp-close-btn" title="Nascondi badge (Alt+B)" style="margin-left:7px; cursor:pointer; opacity:0.65; font-size:10px; padding:1px 3px;">✕</span>
      `;
      badge.style.padding = '4px 10px';
      badge.style.opacity = '0.95';
    }

    const updateLink = document.getElementById('tlp-update-link');
    if (updateLink) {
      updateLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          updateLink.textContent = '⏳...';
          chrome.runtime.sendMessage({ type: 'APPLY_HOT_UPDATE' }, () => {
            latestUpdate = null;
            renderBadgeContent();
            positionBadge();
          });
        } else if (latestUpdate && latestUpdate.url) {
          window.open(latestUpdate.url, '_blank');
        }
      });
    }
  }

  function updateBadge(pts) {
    if (typeof pts === 'number') currentPoints = pts;
    const el = document.getElementById('tlp-count');
    if (el) el.textContent = currentPoints;
  }

  function injectBadge() {
    try {
      if (!document.body) return;

      const legacyBadge = document.getElementById('tlp-badge');
      if (legacyBadge) legacyBadge.remove();

      const existing = document.getElementById('tlp-badge-v2');
      if (existing) {
        existing.style.display = (config.enabled && config.showBadge !== false) ? 'inline-flex' : 'none';
        positionBadge();
        return;
      }

      const badge = document.createElement('div');
      badge.id = 'tlp-badge-v2';
      badge.setAttribute('style', `
        position: fixed !important;
        top: 56px !important;
        bottom: auto !important;
        right: 46px !important;
        z-index: 2147483647 !important;
        display: ${(config.enabled && config.showBadge !== false) ? 'inline-flex' : 'none'};
        align-items: center;
        background: rgba(14, 14, 16, 0.94);
        border: 1px solid #9146ff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 0 10px rgba(145, 70, 255, 0.35);
        color: #efeff1;
        font-size: 11px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 4px 10px;
        border-radius: 20px;
        cursor: pointer;
        backdrop-filter: blur(8px);
        user-select: none;
        transition: opacity 0.2s ease;
      `);
      document.body.appendChild(badge);
      renderBadgeContent();
      positionBadge();

      badge.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        localStorage.setItem('tlp_badge_collapsed', isCollapsed ? '1' : '0');
        renderBadgeContent();
      });

      document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'b' || e.key === 'B')) {
          e.preventDefault();
          isCollapsed = !isCollapsed;
          localStorage.setItem('tlp_badge_collapsed', isCollapsed ? '1' : '0');
          renderBadgeContent();
        }
      });

      document.addEventListener('input', () => {
        positionBadge();
        checkChatInputForRaid();
      }, { passive: true });
      window.addEventListener('resize', positionBadge, { passive: true });
    } catch (e) {}
  }

  // Carica impostazioni salvate
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['enabled', 'humanDelay', 'keepAlive', 'showBadge', 'soundNotification', 'totalPoints', 'updateAvailable', 'latestVersion', 'updateUrl'], (res) => {
      config = { ...config, ...res };
      if (typeof res.totalPoints === 'number') {
        updateBadge(res.totalPoints);
      }
      if (res.updateAvailable && res.latestVersion) {
        latestUpdate = { version: res.latestVersion, url: res.updateUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip' };
      }
      injectBadge();
      renderBadgeContent();
      updateKeepAlive();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        for (const [key, change] of Object.entries(changes)) {
          config[key] = change.newValue;
        }
        if (changes.totalPoints && typeof changes.totalPoints.newValue === 'number') {
          updateBadge(changes.totalPoints.newValue);
        }
        if (changes.updateAvailable || changes.latestVersion) {
          chrome.storage.local.get(['updateAvailable', 'latestVersion', 'updateUrl'], (u) => {
            latestUpdate = (u.updateAvailable && u.latestVersion)
              ? { version: u.latestVersion, url: u.updateUrl || 'https://github.com/norisawa80/lurker-twitch/archive/refs/heads/main.zip' }
              : null;
            renderBadgeContent();
          });
        }
        if (changes.enabled || changes.showBadge) {
          injectBadge();
        }
        if (changes.keepAlive) {
          updateKeepAlive();
        }
      }
    });
  }

  function checkChatInputForRaid() {
    try {
      const inputBox = document.querySelector('[data-a-target="chat-input"]');
      if (!inputBox || !inputBox.textContent) return false;
      const text = inputBox.textContent.trim().toLowerCase();

      if (text.startsWith('/unraid')) {
        clearRaidLock('comando /unraid');
        return false;
      }

      if (text.startsWith('/raid')) {
        lastRaidCommandAt = Date.now();
        activateRaidLock('comando /raid');
        return true;
      }
    } catch (e) {}
    return false;
  }

  function detectRaidBannerInDom() {
    try {
      if (document.querySelector('[data-test-selector*="raid" i], [data-a-target*="raid" i], [class*="raid-banner" i], [aria-label*="raid" i]')) {
        return true;
      }

      const chatRoom = document.querySelector('.stream-chat, .chat-room, .chat-room__content, .channel-root__right-column');
      if (chatRoom) {
        const elements = chatRoom.querySelectorAll('[role="region"], [role="alert"], [role="status"], .chat-room__notifications > *, button');
        for (const el of elements) {
          if (el.id === 'tlp-badge-v2' || el.closest('#tlp-badge-v2')) continue;
          const txt = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
          if (txt.includes('raid') || txt.includes('unraid') || txt.includes('avvia ora') || txt.includes('raid now')) {
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }

  // Gestisce avvio, blocco di 100s, riattivazione se il raid viene annullato e nuova pausa se riparte
  function isRaidActive() {
    try {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        clearRaidLock('cambio canale');
      }

      const typingRaid = checkChatInputForRaid();
      const bannerVisible = detectRaidBannerInDom();

      if (bannerVisible) {
        if (!wasRaidBannerVisible) {
          wasRaidBannerVisible = true;
          activateRaidLock('comparsa banner raid', true);
        } else {
          bannerMissingChecks = 0;
        }
        return true;
      }

      if (wasRaidBannerVisible && !bannerVisible && !typingRaid) {
        bannerMissingChecks++;
        if (bannerMissingChecks >= 2) {
          clearRaidLock('scomparsa banner raid');
          return false;
        }
      }

      if (!wasRaidBannerVisible && !typingRaid && lastRaidCommandAt > 0 && (Date.now() - lastRaidCommandAt > RAID_COMMAND_GRACE_MS)) {
        clearRaidLock('comando /raid annullato in chat');
        return false;
      }
    } catch (e) {}

    return Date.now() < raidPauseUntil;
  }

  // Trova ESCLUSIVAMENTE l'icona .claimable-bonus__icon dentro .community-points-summary in fondo alla chat
  function findBonusButton() {
    try {
      const summary = document.querySelector('[data-test-selector="community-points-summary"]') ||
                      document.querySelector('.community-points-summary');
      if (!summary) return null;

      const bonusIcon = summary.querySelector('.claimable-bonus__icon');
      if (!bonusIcon) return null;

      const candidate = bonusIcon.closest('button') || bonusIcon.closest('[role="button"]');
      if (!candidate) return null;

      // Escludi qualsiasi bottone che contenga testo di Raid / Annulla / Avvia ora / Abbandona
      const btnText = ((candidate.textContent || '') + ' ' + (candidate.getAttribute('aria-label') || '')).toLowerCase();
      if (/raid|annulla|cancel|leave|abbandona|esci|unraid|avvia|ora|now|start/i.test(btnText)) {
        return null;
      }

      // Verifica geometrica: il baule DEVE trovarsi nella barra in basso (sotto la casella "Invia un messaggio")
      const btnRect = candidate.getBoundingClientRect();
      if (btnRect.top < window.innerHeight - 180) {
        return null;
      }
      const inputBox = document.querySelector('[data-a-target="chat-input"]');
      if (inputBox) {
        const inputRect = inputBox.getBoundingClientRect();
        if (inputRect.height > 0 && btnRect.top < inputRect.top) {
          return null;
        }
      }

      return candidate;
    } catch (e) {}

    return null;
  }

  // Simula un clic naturale sul <button>
  function triggerClick(target) {
    if (!target || isRaidActive()) return;
    const btn = target.closest('button') || target.closest('[role="button"]') || target;
    try {
      const rect = btn.getBoundingClientRect();
      const evt = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };
      btn.dispatchEvent(new PointerEvent('pointerdown', evt));
      btn.dispatchEvent(new MouseEvent('mousedown', evt));
      btn.dispatchEvent(new PointerEvent('pointerup', evt));
      btn.dispatchEvent(new MouseEvent('mouseup', evt));
      btn.click();
    } catch (e) {
      btn.click();
    }
  }

  function getCurrentChannel() {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length > 0 && !['directory', 'settings', 'videos', 'downloads'].includes(parts[0])) {
        return parts[0];
      }
    } catch (e) {}
    return 'Twitch';
  }

  function playBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  function recordClaim() {
    const channel = getCurrentChannel();
    const timestamp = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (config.soundNotification) {
      playBeep();
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['totalClaims', 'totalPoints', 'history'], (data) => {
        const claims = (data.totalClaims || 0) + 1;
        const points = (data.totalPoints || 0) + 50;
        const history = data.history || [];

        history.unshift({
          id: Date.now(),
          channel: channel,
          time: timestamp,
          points: 50
        });

        if (history.length > 40) history.pop();

        chrome.storage.local.set({
          totalClaims: claims,
          totalPoints: points,
          history: history,
          lastClaim: Date.now(),
          currentChannel: channel
        });

        updateBadge(points);
        console.log(`[Twitch Lurker Pro] 🎉 Baule riscattato su ${channel}! Totale: +${points} punti.`);
      });
    } else {
      updateBadge(currentPoints + 50);
    }
  }

  function checkAndClaim() {
    const raidActive = isRaidActive();
    if (raidPauseUntil > 0 || raidActive) {
      renderBadgeContent();
    }
    if (!config.enabled || isClaiming || raidActive) return;

    const btn = findBonusButton();
    if (btn) {
      isClaiming = true;
      const delay = config.humanDelay ? Math.floor(Math.random() * 1300) + 1200 : 100;
      console.log(`[Twitch Lurker Pro] 🎁 Baule rilevato! Riscatto tra ${(delay / 1000).toFixed(1)}s...`);

      setTimeout(() => {
        if (isRaidActive()) {
          isClaiming = false;
          return;
        }
        const targetBtn = findBonusButton();
        if (targetBtn && !isRaidActive()) {
          triggerClick(targetBtn);
          recordClaim();
        }
        setTimeout(() => {
          isClaiming = false;
        }, 1500);
      }, delay);
    }
  }

  function updateKeepAlive() {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }

    if (config.keepAlive && config.enabled) {
      keepAliveInterval = setInterval(() => {
        try {
          if (isRaidActive()) return;
          document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: Math.floor(Math.random() * 200) + 50,
            clientY: Math.floor(Math.random() * 200) + 50
          }));
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ currentChannel: getCurrentChannel() });
          }
        } catch (e) {}
      }, 150000);
    }
  }

  // Intervallo ultra-leggero ogni 2.5 secondi (zero freeze / zero lag su Twitch)
  injectBadge();
  setTimeout(injectBadge, 1500);
  setInterval(injectBadge, 5000);
  setInterval(checkAndClaim, 2500);
  setTimeout(checkAndClaim, 2000);
  updateKeepAlive();
})();
