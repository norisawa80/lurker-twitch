// ==UserScript==
// @name         Twitch Lurker Pro - Auto Channel Points & Keep-Alive
// @namespace    https://github.com/norisawa80/lurker-twitch
// @version      1.0.5
// @description  Riscatta automaticamente i punti canale bonus di Twitch con ritardo umano e tiene attiva la sessione per i lurker.
// @author       Twitch Lurker Pro
// @match        https://www.twitch.tv/*
// @updateURL    https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/twitch-lurker-points.user.js
// @downloadURL  https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/twitch-lurker-points.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CURRENT_VERSION = '1.0.5';
  const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/version.json';

  console.log(`%c[Twitch Lurker Pro v${CURRENT_VERSION}]%c Avviato in modalità ultra-leggera!`, 'background: #9146ff; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;', 'color: #9146ff;');

  let claimedCount = parseInt(localStorage.getItem('tlp_claimed_count') || '0', 10);
  let isCollapsed = localStorage.getItem('tlp_badge_collapsed') === '1';
  let isClaiming = false;
  let latestUpdate = null; // { version, url }

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

  async function checkRemoteVersion() {
    try {
      const res = await fetch(`${VERSION_CHECK_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.version && isNewerVersion(data.version, CURRENT_VERSION)) {
        latestUpdate = {
          version: data.version,
          url: data.userscriptUrl || 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/twitch-lurker-points.user.js'
        };
        renderBadgeContent();
        console.log(`[Twitch Lurker Pro] 🚀 Nuova versione v${data.version} disponibile!`);
      }
    } catch (e) {}
  }

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
      ? `<a href="${latestUpdate.url}" target="_blank" id="tlp-update-link" title="Nuova versione v${latestUpdate.version} disponibile! Clicca per aggiornare con 1 clic" style="margin-left:6px; background:#10b981; color:#042718; font-weight:800; font-size:10px; padding:1px 6px; border-radius:999px; text-decoration:none;">⬆️ v${latestUpdate.version}</a>`
      : '';

    if (isCollapsed) {
      badge.innerHTML = `<span title="Clicca per mostrare il contatore Lurker Pro (oppure premi Alt+B)" style="cursor:pointer; font-size:13px;">💎</span>${updateHtml}`;
      badge.style.padding = '4px 7px';
      badge.style.opacity = latestUpdate ? '0.95' : '0.55';
    } else {
      badge.innerHTML = `
        <span>💎 Lurker Pro: <strong id="tlp-count">${claimedCount * 50}</strong> pts</span>
        ${updateHtml}
        <span id="tlp-close-btn" title="Nascondi badge (oppure premi Alt+B)" style="margin-left:7px; cursor:pointer; opacity:0.65; font-size:10px; padding:1px 3px;">✕</span>
      `;
      badge.style.padding = '4px 10px';
      badge.style.opacity = '0.95';
    }

    const updateLink = document.getElementById('tlp-update-link');
    if (updateLink) {
      updateLink.addEventListener('click', (ev) => ev.stopPropagation());
    }
  }

  // Inietta il badge sopra la casella chat in basso a destra
  function injectBadge() {
    try {
      if (!document.body) return;
      if (document.getElementById('tlp-badge')) {
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
        display: inline-flex;
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

      // Clic sul badge (o sulla ✕ / 💎) per nasconderlo o riaprirlo
      badge.addEventListener('click', () => {
        isCollapsed = !isCollapsed;
        localStorage.setItem('tlp_badge_collapsed', isCollapsed ? '1' : '0');
        renderBadgeContent();
      });

      // Scorciatoia da tastiera Alt + B per mostrare/nascondere
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

  function updateBadge() {
    const el = document.getElementById('tlp-count');
    if (el) el.textContent = claimedCount * 50;
  }

  // Trova il pulsante del baule in modo rapido e leggero
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

  // Clic naturale sul pulsante
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

  // Controllo periodico del bonus
  function checkAndClaim() {
    if (isClaiming) return;

    const btn = findBonusButton();
    if (btn) {
      isClaiming = true;
      const delay = Math.floor(Math.random() * 1300) + 1200;
      console.log(`[Twitch Lurker Pro] 🎁 Baule rilevato! Riscatto tra ${(delay / 1000).toFixed(1)}s...`);

      setTimeout(() => {
        const currentBtn = findBonusButton();
        if (currentBtn) {
          triggerClick(currentBtn);
          claimedCount++;
          localStorage.setItem('tlp_claimed_count', claimedCount.toString());
          updateBadge();
          console.log(`[Twitch Lurker Pro] 🎉 Baule riscattato con successo! Totale: +${claimedCount * 50} punti.`);
        }
        setTimeout(() => {
          isClaiming = false;
        }, 1500);
      }, delay);
    }
  }

  // Keep-Alive leggero ogni 2.5 minuti
  setInterval(() => {
    try {
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 200, clientY: 200 }));
    } catch (e) {}
  }, 150000);

  // Avvia subito il badge, controllo versione e i controlli periodici
  injectBadge();
  setTimeout(injectBadge, 1500);
  setTimeout(checkRemoteVersion, 4000);
  setInterval(checkRemoteVersion, 4 * 60 * 60 * 1000);
  setInterval(injectBadge, 5000);
  setInterval(checkAndClaim, 2500);
})();
