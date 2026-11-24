// ==UserScript==
// @name         Twitch Lurker Pro - Auto Channel Points & Keep-Alive
// @namespace    https://github.com/norisawa80/lurker-twitch
// @version      1.1.0
// @description  Riscatta automaticamente i punti canale bonus di Twitch, ripristina il player in caso di errore (#2000/#3000/#4000) e include la Modalità Lurk 160p.
// @author       Twitch Lurker Pro
// @match        https://www.twitch.tv/*
// @updateURL    https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/twitch-lurker-points.user.js
// @downloadURL  https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/twitch-lurker-points.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CURRENT_VERSION = '1.1.0';
  const VERSION_CHECK_URL = 'https://raw.githubusercontent.com/norisawa80/lurker-twitch/main/version.json';
  const RAID_COOLDOWN_MS = 100 * 1000; // Blocco di sicurezza di 100 secondi quando viene rilevato un Raid
  const RAID_COMMAND_GRACE_MS = 8000;  // Tolleranza tra invio comando /raid e comparsa del banner
  const PLAYER_RELOAD_COOLDOWN_MS = 35 * 1000; // Cooldown minimo tra due reload per errore #2000/#3000/#4000

  let raidPauseUntil = 0;
  let lastRaidCommandAt = 0;
  let wasRaidBannerVisible = false;
  let bannerMissingChecks = 0;
  let lastPath = window.location.pathname;
  let errorFirstSeenAt = 0;
  let isLurkModeActive = localStorage.getItem('tlp_lurk_mode_active') === '1';

  console.log(`%c[Twitch Lurker Pro v${CURRENT_VERSION}]%c Avviato (Auto-Points + Scudo Anti-Raid + Auto-Recovery #2000/#3000/#4000 + Lurk 160p)!`, 'background: #9146ff; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;', 'color: #9146ff;');

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
    return /\b(raid|unraid|annulla|cancel|leave|abbandona|esci|avvia)\b/i.test(text || '');
  }

  // Verifica se un elemento è il bottone di ripristino errore dentro il player video (mai nella chat)
  function isPlayerErrorRetryButton(el) {
    if (!el) return false;
    if (el.closest('.stream-chat, .chat-room, .channel-root__right-column')) return false;
    const gate = el.closest('[data-a-target="player-overlay-content-gate"], .content-overlay-gate');
    const inPlayer = el.closest('.video-player, [data-a-target="video-player"], .persistent-player');
    return Boolean(gate && inPlayer);
  }

  // Verifica se un elemento si trova nella zona bassa sotto la lista dei messaggi della chat
  function isElementBelowChatMessages(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.top < window.innerHeight * 0.60) return false;

    const scroller = document.querySelector('[data-a-target="chat-scroller"], .chat-scrollable-area__message-container, [role="log"]');
    if (scroller) {
      const scrollerRect = scroller.getBoundingClientRect();
      if (scrollerRect.height > 0 && rect.top < scrollerRect.bottom - 45) {
        return false;
      }
    }
    return true;
  }

  // SCUDO GLOBALE ANTI-UNRAID + RILEVAMENTO CLIC UMANO SU "ANNULLA RAID"
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evtType) => {
    window.addEventListener(evtType, (e) => {
      try {
        const target = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;

        // 1. Se è un clic automatico (!e.isTrusted), consenti SOLO:
        //    - il bauletto punti in fondo alla chat (privo di parole e sotto i messaggi)
        //    - oppure il bottone di ripristino crash dentro il player video (#2000/#3000/#4000)
        if (!e.isTrusted && target) {
          if (isPlayerErrorRetryButton(target) && !isRaidActive()) {
            return;
          }

          const visibleText = (target.textContent || '').trim();
          const fullText = (visibleText + ' ' + (target.getAttribute('aria-label') || '')).toLowerCase();
          const hasSuspiciousVisibleWords = /[a-zA-Z]{3,}/.test(visibleText);

          if (!isElementBelowChatMessages(target) || hasSuspiciousVisibleWords || isRaidActionButtonText(fullText) || isRaidActive()) {
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            console.warn('[Twitch Lurker Pro] 🛡️ Bloccato clic automatico fuori dal baule punti:', target);
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

  function toggleLurkQuality(enable) {
    try {
      isLurkModeActive = Boolean(enable);
      localStorage.setItem('tlp_lurk_mode_active', isLurkModeActive ? '1' : '0');

      if (isLurkModeActive) {
        const currentQ = localStorage.getItem('video-quality');
        if (currentQ && !currentQ.includes('160p')) {
          localStorage.setItem('tlp_prev_video_quality', currentQ);
        }
        localStorage.setItem('video-quality', '{"default":"160p30"}');
        const video = document.querySelector('video');
        if (video) {
          video.muted = false;
          if (video.volume < 0.05) video.volume = 0.5;
          if (video.paused) video.play().catch(() => {});
        }
        console.log('[Twitch Lurker Pro] 🌙 Modalità Lurk 160p attivata (Muta la scheda del browser con tasto destro -> Disattiva audio scheda).');
      } else {
        const prevQ = localStorage.getItem('tlp_prev_video_quality') || '{"default":"chunked"}';
        localStorage.setItem('video-quality', prevQ);
        console.log('[Twitch Lurker Pro] 🔊 Modalità Lurk 160p disattivata.');
      }
      renderBadgeContent();
    } catch (e) {}
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

    const lurkHtml = `<span id="tlp-lurk-pill" style="margin-left:6px; background:${isLurkModeActive ? 'rgba(145,70,255,0.32)' : 'rgba(255,255,255,0.08)'}; border:1px solid ${isLurkModeActive ? '#a855f7' : 'rgba(255,255,255,0.15)'}; color:${isLurkModeActive ? '#e9d5ff' : '#adadb8'}; font-weight:700; font-size:9.5px; padding:1px 6px; border-radius:999px; cursor:pointer;" title="Clicca per attivare/disattivare la Modalità Lurk a bassa banda (160p)">🌙 ${isLurkModeActive ? '160p ON' : 'Lurk'}</span>`;

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
        ${lurkHtml}
        ${raidHtml}
        ${updateHtml}
        <span id="tlp-close-btn" title="Nascondi badge (oppure premi Alt+B)" style="margin-left:7px; cursor:pointer; opacity:0.65; font-size:10px; padding:1px 3px;">✕</span>
      `;
      badge.style.padding = '4px 10px';
      badge.style.opacity = '0.95';
    }

    const lurkPill = document.getElementById('tlp-lurk-pill');
    if (lurkPill) {
      lurkPill.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleLurkQuality(!isLurkModeActive);
      });
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

  // Rileva il banner di Raid nella fascia alta della chat (escludendo i messaggi scritti dagli utenti in chat)
  function detectRaidBannerInDom() {
    try {
      const isInsideChatMessages = (el) =>
        el.closest('[data-a-target="chat-scroller"], .chat-scrollable-area__message-container, [role="log"]') ||
        el.querySelector('[data-a-target="chat-scroller"], .chat-scrollable-area__message-container, [role="log"]');

      const specificRaidEls = document.querySelectorAll('[data-test-selector*="raid" i], [data-a-target*="raid" i], [class*="raid-banner" i]');
      for (const el of specificRaidEls) {
        if (isInsideChatMessages(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.height > 15 && rect.top >= 0 && rect.top < 320) {
          return true;
        }
      }

      const chatRoom = document.querySelector('.stream-chat, .chat-room, .channel-root__right-column');
      if (chatRoom) {
        const buttons = chatRoom.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          if (btn.id === 'tlp-badge-v2' || btn.closest('#tlp-badge-v2')) continue;
          if (isInsideChatMessages(btn)) continue;

          const rect = btn.getBoundingClientRect();
          if (rect.height === 0 || rect.top < 0 || rect.top > 320) continue;

          const visibleTxt = (btn.textContent || '').trim().toLowerCase();
          const fullTxt = (visibleTxt + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();

          if (/^(annulla|cancel|avvia ora|raid now|abbandona|leave)$/i.test(visibleTxt) ||
              /\b(avvia ora|raid now|annulla raid|cancel raid|abbandona il raid|leave raid|unraid)\b/i.test(fullTxt)) {
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

  // Trova ESCLUSIVAMENTE il bauletto punti in fondo alla chat (scartando qualsiasi elemento sopra i messaggi o con parole nel bottone)
  function findBonusButton() {
    try {
      const candidates = [];

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
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const btn = el.closest('button') || el.closest('[role="button"]');
          if (btn && !candidates.includes(btn)) {
            candidates.push(btn);
          }
        }
      }

      const summary = document.querySelector('[data-test-selector="community-points-summary"], .community-points-summary');
      if (summary) {
        const buttons = summary.querySelectorAll('button');
        if (buttons.length > 1) {
          const lastBtn = buttons[buttons.length - 1];
          if (!candidates.includes(lastBtn)) candidates.push(lastBtn);
        }
      }

      for (const candidate of candidates) {
        const visibleText = (candidate.textContent || '').trim();
        if (/[a-zA-Z]{3,}/.test(visibleText)) continue;

        const fullText = (visibleText + ' ' + (candidate.getAttribute('aria-label') || '')).toLowerCase();
        if (isRaidActionButtonText(fullText)) continue;

        if (!isElementBelowChatMessages(candidate)) continue;

        return candidate;
      }
    } catch (e) {}

    return null;
  }

  // Auto-ripristino del player in caso di crash/errore di rete (#1000, #2000, #3000, #4000, #5000)
  function checkAndRecoverPlayerError() {
    try {
      if (isRaidActive()) {
        errorFirstSeenAt = 0;
        return;
      }

      const player = document.querySelector('.video-player, [data-a-target="video-player"], .persistent-player');
      if (!player) {
        errorFirstSeenAt = 0;
        return;
      }

      const gate = player.querySelector('[data-a-target="player-overlay-content-gate"], .content-overlay-gate');
      if (!gate) {
        errorFirstSeenAt = 0;
        return;
      }

      const gateText = (gate.textContent || '').trim();
      const hasPlayerCrashError = /#[12345]000\b|errore di rete|network error|errore del browser|decoding error/i.test(gateText);
      if (!hasPlayerCrashError) {
        errorFirstSeenAt = 0;
        return;
      }

      const now = Date.now();
      if (errorFirstSeenAt === 0) {
        errorFirstSeenAt = now;
        console.warn(`[Twitch Lurker Pro] ⚠️ Rilevato crash player Twitch (${gateText.slice(0, 60)})! Tentativo di ripristino...`);

        const retryBtn = gate.querySelector('button');
        if (retryBtn && isPlayerErrorRetryButton(retryBtn)) {
          retryBtn.click();
          return;
        }
      }

      if (now - errorFirstSeenAt > 7000) {
        const lastReload = parseInt(sessionStorage.getItem('tlp_last_player_reload') || '0', 10);
        if (now - lastReload > PLAYER_RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem('tlp_last_player_reload', now.toString());
          console.warn('[Twitch Lurker Pro] 🔄 Errore player persistente (#2000/#3000/#4000): ricarico lo stream!');
          window.location.reload();
        }
      }
    } catch (e) {}
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

  // Avvia subito il badge, controllo versione, auto-claim e auto-ripristino crash player (#2000/#3000/#4000) (zero mousemove finto!)
  injectBadge();
  setTimeout(injectBadge, 1500);
  setTimeout(checkRemoteVersion, 4000);
  setInterval(checkRemoteVersion, 4 * 60 * 60 * 1000);
  setInterval(injectBadge, 5000);
  setInterval(checkAndClaim, 2500);
  setInterval(checkAndRecoverPlayerError, 5000);
})();
