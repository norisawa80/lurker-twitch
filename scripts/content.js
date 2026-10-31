// Twitch Lurker Pro - Content Script (Modalità Ultra-Leggera)
(function () {
  'use strict';

  console.log('[Twitch Lurker Pro] Script avviato in modalità leggera.');

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

  // Posiziona il badge sempre sopra "Invia un messaggio" e "Modalità lenta" (tra 118px e 240px dal fondo)
  function positionBadge() {
    try {
      const badge = document.getElementById('tlp-badge');
      if (!badge) return;

      const inputBox = document.querySelector('[data-a-target="chat-input"]') ||
                       document.querySelector('[data-test-selector="chat-input-container"]');
      if (inputBox) {
        const rect = inputBox.getBoundingClientRect();
        if (rect.height > 0 && rect.top > 0) {
          const offsetBottom = Math.min(240, Math.max(118, Math.round(window.innerHeight - rect.top + 42)));
          badge.style.bottom = offsetBottom + 'px';
          return;
        }
      }
      badge.style.bottom = '118px';
    } catch (e) {}
  }

  function renderBadgeContent() {
    const badge = document.getElementById('tlp-badge');
    if (!badge) return;

    const updateHtml = latestUpdate
      ? `<a href="${latestUpdate.url}" target="_blank" id="tlp-update-link" title="Nuova versione v${latestUpdate.version} disponibile! Clicca per scaricare" style="margin-left:6px; background:#10b981; color:#042718; font-weight:800; font-size:10px; padding:1px 6px; border-radius:999px; text-decoration:none;">⬆️ v${latestUpdate.version}</a>`
      : '';

    if (isCollapsed) {
      badge.innerHTML = `<span title="Clicca per mostrare il contatore Lurker Pro (Alt+B)" style="cursor:pointer; font-size:13px;">💎</span>${updateHtml}`;
      badge.style.padding = '4px 7px';
      badge.style.opacity = latestUpdate ? '0.95' : '0.55';
    } else {
      badge.innerHTML = `
        <span>💎 Lurker Pro: <strong id="tlp-count">${currentPoints}</strong> pts</span>
        ${updateHtml}
        <span id="tlp-close-btn" title="Nascondi badge (Alt+B)" style="margin-left:7px; cursor:pointer; opacity:0.65; font-size:10px; padding:1px 3px;">✕</span>
      `;
      badge.style.padding = '4px 10px';
      badge.style.opacity = '0.95';
    }

    const updateLink = document.getElementById('tlp-update-link');
    if (updateLink) {
      updateLink.addEventListener('click', (ev) => ev.stopPropagation());
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
      const existing = document.getElementById('tlp-badge');
      if (existing) {
        existing.style.display = (config.enabled && config.showBadge !== false) ? 'inline-flex' : 'none';
        positionBadge();
        return;
      }

      const badge = document.createElement('div');
      badge.id = 'tlp-badge';
      badge.setAttribute('style', `
        position: fixed;
        bottom: 118px;
        right: 18px;
        z-index: 2147483647;
        display: ${(config.enabled && config.showBadge !== false) ? 'inline-flex' : 'none'};
        align-items: center;
        background: rgba(14, 14, 16, 0.92);
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
        transition: bottom 0.15s ease, opacity 0.2s ease;
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

      document.addEventListener('input', positionBadge, { passive: true });
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

  // Trova il pulsante del baule in modo rapido e sicuro
  function findBonusButton() {
    try {
      const bonusIcon = document.querySelector('.claimable-bonus__icon');
      if (bonusIcon) {
        return bonusIcon.closest('button') || bonusIcon.closest('[role="button"]') || bonusIcon;
      }

      const selectors = [
        'button[aria-label*="Claim" i]',
        'button[aria-label*="bonus" i]',
        'button[aria-label*="riscatta" i]',
        'button[aria-label*="richiedi" i]',
        'button[data-test-selector="community-points-claim-button"]'
      ];

      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) return btn;
      }

      const summary = document.querySelector('[data-test-selector="community-points-summary"]') ||
                      document.querySelector('.community-points-summary');
      if (summary) {
        const buttons = summary.querySelectorAll('button');
        if (buttons.length > 1) {
          return buttons[buttons.length - 1];
        }
      }
    } catch (e) {}

    return null;
  }

  // Simula un clic naturale sul <button>
  function triggerClick(target) {
    if (!target) return;
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
    if (!config.enabled || isClaiming) return;

    const btn = findBonusButton();
    if (btn) {
      isClaiming = true;
      const delay = config.humanDelay ? Math.floor(Math.random() * 1300) + 1200 : 100;
      console.log(`[Twitch Lurker Pro] 🎁 Baule rilevato! Riscatto tra ${(delay / 1000).toFixed(1)}s...`);

      setTimeout(() => {
        const targetBtn = findBonusButton();
        if (targetBtn) {
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
