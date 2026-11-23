// ==UserScript==
// @name         Twitch Lurker Pro - Auto Channel Points & Keep-Alive
// @namespace    https://github.com/norisawa80/lurker-twitch
// @version      1.0.19
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

  const CURRENT_VERSION = '1.0.19';
  const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/version.json';
  const RAID_COOLDOWN_MS = 100 * 1000; // Blocco di sicurezza di 100 secondi quando viene rilevato un Raid
  const RAID_COMMAND_GRACE_MS = 8000;  // Tolleranza tra invio comando /raid e comparsa del banner

  let raidPauseUntil = 0;
  let lastRaidCommandAt = 0;
  let wasRaidBannerVisible = false;
  let bannerMissingChecks = 0;
  let lastPath = window.location.pathname;

  console.log(`%c[Twitch Lurker Pro v${CURRENT_VERSION}]%c Avviato (Selettori Punti 2026 + Scudo Anti-Raid Intelligente)!`, 'background: #9146ff; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;', 'color: #9146ff;');

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

  function isRaidActionButtonText(text) {
    return /\b(raid|unraid|annulla|cancel|leave|abbandona|avvia ora|raid now)\b/i.test(text || '');
  }

  // SCUDO GLOBALE ANTI-UNRAID + RILEVAMENTO CLIC UMANO SU "ANNULLA RAID"
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtType) => {
    window.addEventListener(evtType, (e) => {
      try {
        const target = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;

        // 1. Se è un clic automatico (!e.isTrusted), bloccalo SOLO se è nella parte alta dello schermo (zona banner Raid)
        // oppure se contiene testo di Raid/Annulla o se c'è un Raid attivo.
        if (!e.isTrusted && target) {
          const rect = target.getBoundingClientRect();
          const btnText = ((target.textContent || '') + ' ' + (target.getAttribute('aria-label') || '')).toLowerCase();
          const isInTopHalf = rect.top > 0 && rect.top < window.innerHeight * 0.45;

          if (isInTopHalf || isRaidActionButtonText(btnText) || isRaidActive()) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            console.warn('[Twitch Lurker Pro] 🛡️ Bloccato clic automatico nella zona Raid:', target);
          }
          return;
        }

        // 2. Se è un clic UMANO (e.isTrusted === true) sul bottone "Annulla" del raid, riattiva subito lo script
        if (evtType === 'click' && e.isTrusted && target && (raidPauseUntil > Date.now() || wasRaidBannerVisible)) {
          const btnText = ((target.textContent || '') + ' ' + (target.getAttribute('aria-label') || '')).toLowerCase();
          if (/\b(annulla|cancel|unraid|abbandona|leave)\b/i.test(btnText)) {
            setTimeout(() => clearRaidLock('clic umano su Annulla'), 300);
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
      ? `<a href="${latestUpdate.url}" target="_blank" id="tlp-update-link" title="Nuova versione v${latestUpdate.version} disponibile! Clicca per aggiornare con 1 clic" style="margin-left:6px; background:#10b981; color:#042718; font-weight:800; font-size:10px; padding:1px 6px; border-radius:999px; text-decoration:none;">⬆️ v${latestUpdate.version}</a>`
      : '';

    if (isCollapsed) {
      badge.innerHTML = `<span title="Twitch Lurker Pro v${CURRENT_VERSION} - Clicca per mostrare (Alt+B)" style="cursor:pointer; font-size:13px;">💎</span>${raidHtml}${updateHtml}`;
      badge.style.padding = '4px 7px';
      badge.style.opacity = (latestUpdate || remainingRaidSec > 0) ? '0.95' : '0.55';
    } else {
      badge.innerHTML = `
        <span>💎 Lurker Pro <small style="opacity:0.65; font-size:9.5px;">v${CURRENT_VERSION}</small>: <strong id="tlp-count">${claimedCount * 50}</strong> pts</span>
        ${raidHtml}
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

  // Inietta il badge in ALTO sopra la chat
  function injectBadge() {
    try {
      if (!document.body) return;

      const legacyBadge = document.getElementById('tlp-badge');
      if (legacyBadge) legacyBadge.remove();

      if (document.getElementById('tlp-badge-v2')) {
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
        display: inline-flex;
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

  function updateBadge() {
    const el = document.getElementById('tlp-count');
    if (el) el.textContent = claimedCount * 50;
  }

  function checkChatInputForRaid() {
    try {
      const inputBox = document.querySelector('[data-a-target="chat-input"], [role="textbox"]');
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

  // Rileva ESCLUSIVAMENTE il vero banner di Raid nella fascia alta della chat (ignorando messaggi chat, emote o titoli stream)
  function detectRaidBannerInDom() {
    try {
      // 1. Selettori specifici del banner raid nella parte alta dello schermo
      const specificRaidEls = document.querySelectorAll('[data-test-selector*="raid-banner" i], [data-test-selector*="raid" i], [class*="raid-banner" i]');
      for (const el of specificRaidEls) {
        if (el.closest('[data-a-target="chat-scroller"], .chat-scrollable-area__message-container, [role="log"]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.height > 15 && rect.top >= 0 && rect.top < 280) {
          return true;
        }
      }

      // 2. Controlla i bottoni presenti SOLO nella fascia alta della colonna chat (top < 280px, fuori dai messaggi)
      const chatRoom = document.querySelector('.stream-chat, .chat-room, .channel-root__right-column');
      if (chatRoom) {
        const buttons = chatRoom.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          if (btn.id === 'tlp-badge-v2' || btn.closest('#tlp-badge-v2')) continue;
          if (btn.closest('[data-a-target="chat-scroller"], .chat-scrollable-area__message-container, [role="log"]')) continue;

          const rect = btn.getBoundingClientRect();
          if (rect.height === 0 || rect.top < 0 || rect.top > 280) continue;

          const txt = ((btn.textContent || '') + ' ' + (btn.getAttribute('aria-label') || '')).trim().toLowerCase();
          if (/\b(avvia ora|raid now|annulla raid|cancel raid|abbandona il raid|leave raid|unraid)\b/i.test(txt)) {
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

  // Trova il pulsante del baule bonus in fondo alla chat supportando tutti i selettori Twitch (vecchi e nuovi 2026)
  function findBonusButton() {
    try {
      let candidate = null;

      // 1. Ricerca diretta tramite tutti i selettori ufficiali Twitch per il baule bonus
      const directSelectors = [
        '.claimable-bonus__icon',
        'button[aria-label*="Claim Bonus" i]',
        'button[aria-label*="Riscatta bonus" i]',
        'button[aria-label*="Richiedi bonus" i]',
        '[data-test-selector*="community-points-claim" i]',
        '[data-test-selector="community-points-summary"] button[aria-label*="bonus" i]',
        '.community-points-summary button[aria-label*="bonus" i]',
        '.community-points-summary button[aria-label*="Claim" i]',
        '.community-points-summary button[aria-label*="Riscatta" i]'
      ];

      for (const sel of directSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          candidate = el.closest('button') || el.closest('[role="button"]') || el;
          if (candidate) break;
        }
      }

      // 2. Fallback: se il contenitore .community-points-summary ha 2 bottoni (1° = saldo punti, 2° = baule bonus)
      if (!candidate) {
        const summary = document.querySelector('[data-test-selector="community-points-summary"], .community-points-summary');
        if (summary) {
          const buttons = summary.querySelectorAll('button');
          if (buttons.length > 1) {
            candidate = buttons[buttons.length - 1];
          }
        }
      }

      if (!candidate) return null;

      // Verifica 1: Escludi qualsiasi bottone che abbia testo di Raid / Annulla / Avvia ora
      const btnText = ((candidate.textContent || '') + ' ' + (candidate.getAttribute('aria-label') || '')).toLowerCase();
      if (isRaidActionButtonText(btnText)) {
        return null;
      }

      // Verifica 2: Il baule dei punti si trova SEMPRE nella metà inferiore della finestra (mai in alto dove c'è il Raid)
      const btnRect = candidate.getBoundingClientRect();
      if (btnRect.height === 0 || btnRect.top < window.innerHeight * 0.45) {
        return null;
      }

      return candidate;
    } catch (e) {}

    return null;
  }

  // Clic naturale sul pulsante
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

  // Controllo periodico del bonus
  function checkAndClaim() {
    const raidActive = isRaidActive();
    if (raidPauseUntil > 0 || raidActive) {
      renderBadgeContent();
    }
    if (isClaiming || raidActive) return;

    const btn = findBonusButton();
    if (btn) {
      isClaiming = true;
      const delay = Math.floor(Math.random() * 1300) + 1200;
      console.log(`[Twitch Lurker Pro] 🎁 Baule rilevato! Riscatto tra ${(delay / 1000).toFixed(1)}s...`);

      setTimeout(() => {
        if (isRaidActive()) {
          isClaiming = false;
          return;
        }
        const currentBtn = findBonusButton();
        if (currentBtn && !isRaidActive()) {
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
