// ==UserScript==
// @name         Twitch Lurker Pro - Auto Channel Points & Keep-Alive
// @namespace    https://github.com/norisawa80/lurker-twitch
// @version      1.0.11
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

  const CURRENT_VERSION = '1.0.11';
  const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/version.json';

  console.log(`%c[Twitch Lurker Pro v${CURRENT_VERSION}]%c Avviato con Scudo Anti-Unraid!`, 'background: #9146ff; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;', 'color: #9146ff;');

  // SCUDO GLOBALE ANTI-UNRAID: blocca alla radice qualsiasi clic automatico (!e.isTrusted)
  // generato da script (anche da vecchie versioni duplicate rimaste attive in Tampermonkey)
  // se non è ESATTAMENTE sull'icona .claimable-bonus__icon dentro .community-points-summary!
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtType) => {
    window.addEventListener(evtType, (e) => {
      try {
        if (!e.isTrusted) {
          const target = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
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
        }
      } catch (err) {}
    }, true);
  });

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

  // Posiziona il badge in ALTO all'inizio della chat (subito sotto "Chat dello streaming")
  function positionBadge() {
    try {
      const badge = document.getElementById('tlp-badge');
      if (!badge) return;

      const chatScroller = document.querySelector('[data-a-target="chat-scroller"]') ||
                           document.querySelector('.chat-scrollable-area__message-container');
      if (chatScroller) {
        const rect = chatScroller.getBoundingClientRect();
        if (rect.height > 0 && rect.top >= 40 && rect.top <= 250) {
          badge.style.top = Math.round(rect.top + 8) + 'px';
          badge.style.bottom = 'auto';
          return;
        }
      }
      badge.style.top = '92px';
      badge.style.bottom = 'auto';
    } catch (e) {}
  }

  function renderBadgeContent() {
    const badge = document.getElementById('tlp-badge');
    if (!badge) return;

    const updateHtml = latestUpdate
      ? `<a href="${latestUpdate.url}" target="_blank" id="tlp-update-link" title="Nuova versione v${latestUpdate.version} disponibile! Clicca per aggiornare con 1 clic" style="margin-left:6px; background:#10b981; color:#042718; font-weight:800; font-size:10px; padding:1px 6px; border-radius:999px; text-decoration:none;">⬆️ v${latestUpdate.version}</a>`
      : '';

    if (isCollapsed) {
      badge.innerHTML = `<span title="Twitch Lurker Pro v${CURRENT_VERSION} - Clicca per mostrare (Alt+B)" style="cursor:pointer; font-size:13px;">💎</span>${updateHtml}`;
      badge.style.padding = '4px 7px';
      badge.style.opacity = latestUpdate ? '0.95' : '0.55';
    } else {
      badge.innerHTML = `
        <span>💎 Lurker Pro <small style="opacity:0.65; font-size:9.5px;">v${CURRENT_VERSION}</small>: <strong id="tlp-count">${claimedCount * 50}</strong> pts</span>
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
        top: 92px;
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
        transition: top 0.15s ease, opacity 0.2s ease;
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

  // Verifica se c'è un raid in corso (controlla sia selettori che il testo visibile nella chat)
  function isRaidActive() {
    try {
      if (document.querySelector('[data-test-selector*="raid" i], [data-a-target*="raid" i], [class*="raid" i], [aria-label*="raid" i]')) {
        return true;
      }
      // Controlla se nella parte alta della chat c'è un banner con testo "raid" / "annulla"
      const chatRoom = document.querySelector('.chat-room__content, [data-a-target="chat-scroller"], .stream-chat');
      if (chatRoom) {
        const banners = chatRoom.querySelectorAll('[role="region"], [role="alert"], [role="status"], .chat-room__notifications > *');
        for (const b of banners) {
          const txt = (b.textContent || '').toLowerCase();
          if (txt.includes('raid') || txt.includes('unraid')) return true;
        }
      }
      // Se l'utente sta scrivendo "/raid" in chat
      const inputBox = document.querySelector('[data-a-target="chat-input"]');
      if (inputBox && inputBox.textContent && inputBox.textContent.trim().toLowerCase().startsWith('/raid')) {
        return true;
      }
    } catch (e) {}
    return false;
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

      // Escludi qualsiasi bottone che contenga testo di Raid / Annulla / Abbandona
      const btnText = ((candidate.textContent || '') + ' ' + (candidate.getAttribute('aria-label') || '')).toLowerCase();
      if (/raid|annulla|cancel|leave|abbandona|esci|unraid/i.test(btnText)) {
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
    if (isClaiming || isRaidActive()) return;

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
      if (isRaidActive()) return;
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
