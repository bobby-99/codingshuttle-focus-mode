/**
 * CodingShuttle Focus Mode — content.js  v2.0
 *
 * Features
 * ────────
 * [A] Focus Mode       – hide navbar / ads / promo cards / floating widgets
 * [B] Reading Progress – thin red bar that fills as you scroll
 * [C] Read Time        – "~8 min read · 1,600 words" badge below the title
 * [D] Spotlight Mode   – dims everything except the paragraph under the cursor
 * [E] Pomodoro Timer   – 25-min countdown HUD with start/pause/reset
 * [F] Copy Code        – hover-to-reveal "Copy" button on every <pre> block
 * [G] Floating TOC     – quick-jump panel built from the article's headings
 * [H] Highlighter      – select text → pick a colour → persists across reloads
 * [I] Inline Notes     – 📝 icon in the margin of each paragraph
 * [J] Mark as Done     – ✅ button at the bottom of each article
 *
 * Cross-platform: works identically on Chrome/Chromium on Windows and Linux.
 * All storage uses chrome.storage.local. No OS-specific APIs.
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════════
  // §1  CONSTANTS & STATE
  // ══════════════════════════════════════════════════════════════════════════════

  const SK = {
    FOCUS:      'cs_focus_mode',
    SPOTLIGHT:  'cs_spotlight',
    POMODORO:   'cs_pomodoro',
    HIGHLIGHTS: 'cs_highlights',
    NOTES:      'cs_notes',
    COMPLETED:  'cs_completed',
  };

  /** Stable key per page (pathname without trailing slash) */
  const PAGE = location.pathname.replace(/\/$/, '') || '/';

  const HIGHLIGHT_COLORS = {
    yellow: { bg: '#fef08a', fg: '#713f12' },
    green:  { bg: '#bbf7d0', fg: '#14532d' },
    blue:   { bg: '#bfdbfe', fg: '#1e3a5f' },
    pink:   { bg: '#fbcfe8', fg: '#831843' },
  };

  const AD_KEYWORDS = [
    'CHECK IT OUT','Check It Out','Request Callback','₹','Enroll Now','Buy Now',
    'Get Access','Limited Seats','Batch Starting','Register Now','Apply Now',
    'From SDE To','AI Engineering',
  ];
  const AD_CLASS_FRAGS = ['glare-effect','promo','banner-card'];

  // ══════════════════════════════════════════════════════════════════════════════
  // §2  UTILITIES
  // ══════════════════════════════════════════════════════════════════════════════

  /** Best-effort selector for the main article content column */
  function getArticle() {
    return (
      document.querySelector('article') ||
      document.querySelector('main > div > div:nth-child(2)') ||
      document.querySelector('main > div > div') ||
      document.querySelector('main')
    );
  }

  /** Run fn() once getArticle() returns a non-null element. */
  function whenArticleReady(fn, attempts = 0) {
    if (getArticle()) { fn(); return; }
    if (attempts > 30) return;
    setTimeout(() => whenArticleReady(fn, attempts + 1), 200);
  }

  function isDarkMode() {
    return document.documentElement.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §3  [A] FOCUS MODE  (preserved & cleaned from v1)
  // ══════════════════════════════════════════════════════════════════════════════

  let focusStyleEl  = null;
  let mutObserver   = null;
  let mutObserving  = false;

  const HIDE_SELECTORS = [
    'header','nav','div.sticky.z-50.top-0','aside',
    "a[href*='/courses/']:not([href='/courses/'])",
    "a[href*='wa.me']","a[href*='whatsapp']","a[href*='api.whatsapp']",
    "div[style*='position: fixed'][style*='bottom']",
    "div[style*='position:fixed'][style*='bottom']",
    "div[aria-hidden='true'][style*='--banner-height']",
    'footer',
    "div[role='region'][aria-label*='Notifications']",
    'ol.fixed.top-0.right-0',
    "section:has(img[alt*='SDE'])",
    "section:has(img[alt*='Engineering'])",
  ];

  function injectFocusCSS(on) {
    if (!on) { focusStyleEl?.remove(); focusStyleEl = null; return; }
    if (focusStyleEl) return;

    const base = HIDE_SELECTORS.map(s =>
      `${s} { display:none !important; visibility:hidden !important; }`
    ).join('\n');

    const extra = `
      div.sticky.z-50         { display:none !important; }
      .glare-effect           { display:none !important; }
      a[style*="position: fixed"],
      a[style*="position:fixed"],
      div[style*="z-index: 9999"],
      div[style*="z-index:9999"] { display:none !important; }
      div[style*="--banner-height"]                          { display:none !important; }
      div[role="region"][aria-label*="Notifications"]        { display:none !important; }
      main > div > div:nth-child(2) { max-width:860px !important; margin:0 auto !important; }
    `;

    focusStyleEl = document.createElement('style');
    focusStyleEl.id = 'cs-focus-styles';
    focusStyleEl.textContent = base + '\n' + extra;
    document.head.appendChild(focusStyleEl);
  }

  function hideNavbar(on) {
    const nav = document.querySelector('body > div.sticky');
    const banner = document.querySelector('body > div[aria-hidden="true"]');
    const main = document.querySelector('main');
    if (nav)    nav.style.display    = on ? 'none' : '';
    if (banner) banner.style.display = on ? 'none' : '';
    if (main) { main.style.paddingTop = on ? '0' : ''; main.style.marginTop = on ? '0' : ''; }
  }

  function hideRightSidebar(on) {
    const flex = document.querySelector('main > div.flex');
    if (!flex) return;
    const kids = Array.from(flex.children);
    if (kids.length < 3) return;
    const right   = kids[kids.length - 1];
    const article = kids[kids.length - 2];
    right.style.display = on ? 'none' : '';
    if (article) {
      article.style.maxWidth = on ? '860px' : '';
      article.style.margin   = on ? '0 auto' : '';
    }
  }

  function hideFloatingWidgets(on) {
    document.querySelectorAll('a,div,button,iframe').forEach(el => {
      // Skip our own injected elements
      if (el.id?.startsWith('cs-')) return;
      const cs = window.getComputedStyle(el);
      if (cs.position === 'fixed') {
        const r = el.getBoundingClientRect();
        if (r.bottom > window.innerHeight * 0.5 && r.right > window.innerWidth * 0.5) {
          el.style.display = on ? 'none' : '';
        }
      }
      const href = el.getAttribute('href') || '';
      if (href.includes('wa.me') || href.includes('whatsapp')) {
        let p = el;
        for (let i = 0; i < 5; i++) if (p.parentElement) p = p.parentElement;
        p.style.display = on ? 'none' : '';
      }
    });
  }

  function hidePromoCards(on) {
    document.querySelectorAll('div,section,aside').forEach(el => {
      if (el.id?.startsWith('cs-')) return;
      if (el.closest('[style*="--aside-top-offset"]')) return;
      if (el.closest('article')) return;
      const text  = el.innerText || '';
      const cls   = el.className || '';
      const isAd  = AD_KEYWORDS.some(kw => text.includes(kw) && text.length < 800);
      const isCls = AD_CLASS_FRAGS.some(f => cls.includes(f));
      if (isAd || isCls) el.style.display = on ? 'none' : '';
    });
  }

  function applyFocusMode(on) {
    injectFocusCSS(on);
    hideNavbar(on);
    hideRightSidebar(on);
    hideFloatingWidgets(on);
    hidePromoCards(on);
    if (on) startMutObs(); else stopMutObs();
  }

  function startMutObs() {
    if (mutObserving) return;
    mutObserver = new MutationObserver(() => {
      hideFloatingWidgets(true);
      hidePromoCards(true);
      hideRightSidebar(true);
    });
    mutObserver.observe(document.body, { childList: true, subtree: true });
    mutObserving = true;
  }

  function stopMutObs() {
    mutObserver?.disconnect();
    mutObserving = false;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §4  [B] READING PROGRESS BAR
  // ══════════════════════════════════════════════════════════════════════════════

  function initReadingProgress() {
    if (document.getElementById('cs-progress-bar')) return;
    const bar = Object.assign(document.createElement('div'), { id: 'cs-progress-bar' });
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0',
      height: '3px', width: '0%',
      background: 'linear-gradient(90deg, #ED155A, #ff6b9d)',
      zIndex: '2147483647', transition: 'width 0.1s linear',
      pointerEvents: 'none', borderRadius: '0 2px 2px 0',
    });
    document.body.appendChild(bar);

    function update() {
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      const total    = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = total > 0 ? `${Math.min((scrolled / total) * 100, 100)}%` : '0%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §5  [C] ESTIMATED READ TIME
  // ══════════════════════════════════════════════════════════════════════════════

  function initReadTime() {
    if (document.getElementById('cs-read-time')) return;
    const art = getArticle();
    if (!art) return;

    const words   = (art.innerText || '').trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    const dark    = isDarkMode();

    const badge = Object.assign(document.createElement('div'), { id: 'cs-read-time' });
    Object.assign(badge.style, {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      fontSize: '13px', padding: '4px 14px', borderRadius: '20px',
      marginBottom: '16px', marginTop: '4px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: dark ? '#1e293b' : '#f1f5f9',
      color:      dark ? '#94a3b8' : '#64748b',
      border: `1px solid ${dark ? '#334155' : '#e2e8f0'}`,
    });
    badge.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      ~${minutes} min read &nbsp;·&nbsp; ${words.toLocaleString()} words
    `;

    const h1 = art.querySelector('h1');
    if (h1?.nextElementSibling) h1.parentNode.insertBefore(badge, h1.nextElementSibling);
    else if (h1) h1.after(badge);
    else art.prepend(badge);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §6  [D] SPOTLIGHT MODE
  // ══════════════════════════════════════════════════════════════════════════════

  const SPOTLIGHT_SEL = 'p, li, h1, h2, h3, h4, h5, pre, blockquote, td';
  let spotlightLast   = null;

  function spotlightHandler(e) {
    const target = e.target.closest(SPOTLIGHT_SEL);
    if (target === spotlightLast) return;
    spotlightLast = target;
    const art = getArticle();
    if (!art) return;
    art.querySelectorAll(SPOTLIGHT_SEL).forEach(el => {
      el.style.opacity    = (target && el !== target) ? '0.25' : '1';
      el.style.transition = 'opacity 0.2s ease';
    });
  }

  function enableSpotlight() {
    document.addEventListener('mousemove', spotlightHandler, { passive: true });
  }

  function disableSpotlight() {
    document.removeEventListener('mousemove', spotlightHandler);
    spotlightLast = null;
    getArticle()?.querySelectorAll(SPOTLIGHT_SEL).forEach(el => {
      el.style.opacity = ''; el.style.transition = '';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §7  [E] POMODORO TIMER
  // ══════════════════════════════════════════════════════════════════════════════

  const POMO_DURATION = 25 * 60; // seconds
  let pomoEl       = null;
  let pomoLeft     = POMO_DURATION;
  let pomoRunning  = false;
  let pomoInterval = null;

  function buildPomodoro() {
    if (pomoEl) return;
    pomoEl = document.createElement('div');
    pomoEl.id = 'cs-pomodoro';
    pomoEl.innerHTML = `
      <div class="cs-pomo-label">🍅 POMODORO</div>
      <div id="cs-pomo-time">25:00</div>
      <div class="cs-pomo-ring"><svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#334155" stroke-width="2"/>
        <circle id="cs-pomo-arc" cx="18" cy="18" r="15.9155" fill="none"
          stroke="#ED155A" stroke-width="2"
          stroke-dasharray="100 100" stroke-dashoffset="0"
          stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg></div>
      <div class="cs-pomo-btns">
        <button id="cs-pomo-toggle">▶ Start</button>
        <button id="cs-pomo-reset" title="Reset">↺</button>
      </div>
      <div id="cs-pomo-status">Focus session</div>
    `;
    // Styles
    const s = document.createElement('style');
    s.id = 'cs-pomo-styles';
    s.textContent = `
      #cs-pomodoro {
        position:fixed; bottom:24px; right:24px; z-index:2147483646;
        background:#1e293b; border:1px solid #334155; border-radius:18px;
        padding:14px 20px; min-width:148px;
        display:flex; flex-direction:column; align-items:center; gap:8px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        box-shadow:0 8px 32px rgba(0,0,0,.5); user-select:none;
        color:#e2e8f0;
      }
      #cs-pomodoro .cs-pomo-label {
        font-size:9px; font-weight:700; letter-spacing:.12em; color:#475569;
      }
      #cs-pomo-time {
        font-size:30px; font-weight:700; letter-spacing:.04em; color:#f8fafc;
        font-variant-numeric: tabular-nums;
      }
      #cs-pomodoro .cs-pomo-ring { width:44px; height:44px; }
      #cs-pomodoro .cs-pomo-ring svg { width:100%; height:100%; }
      #cs-pomodoro .cs-pomo-btns { display:flex; gap:8px; }
      #cs-pomo-toggle {
        background:#ED155A; color:#fff; border:none; border-radius:8px;
        padding:5px 14px; font-size:12px; font-weight:600; cursor:pointer;
      }
      #cs-pomo-reset {
        background:#334155; color:#94a3b8; border:none; border-radius:8px;
        padding:5px 10px; font-size:14px; cursor:pointer; line-height:1;
      }
      #cs-pomo-status { font-size:10px; color:#475569; }
    `;
    document.head.appendChild(s);
    document.body.appendChild(pomoEl);

    document.getElementById('cs-pomo-toggle').addEventListener('click', pomoToggle);
    document.getElementById('cs-pomo-reset').addEventListener('click', pomoReset);
    pomoRefreshUI();
  }

  function pomoRefreshUI() {
    const m   = String(Math.floor(pomoLeft / 60)).padStart(2, '0');
    const sec = String(pomoLeft % 60).padStart(2, '0');
    const timeEl = document.getElementById('cs-pomo-time');
    const arc    = document.getElementById('cs-pomo-arc');
    if (!timeEl) return;
    timeEl.textContent = `${m}:${sec}`;
    timeEl.style.color = pomoLeft < 60 ? '#ef4444' : pomoLeft < 300 ? '#f59e0b' : '#f8fafc';
    if (arc) {
      const pct = (pomoLeft / POMO_DURATION) * 100;
      arc.setAttribute('stroke-dasharray', `${pct} 100`);
    }
    const btn = document.getElementById('cs-pomo-toggle');
    if (btn) btn.textContent = pomoRunning ? '⏸ Pause' : (pomoLeft < POMO_DURATION ? '▶ Resume' : '▶ Start');
  }

  function pomoToggle() {
    if (pomoRunning) {
      clearInterval(pomoInterval); pomoRunning = false;
    } else {
      pomoRunning = true;
      pomoInterval = setInterval(() => {
        pomoLeft--;
        pomoRefreshUI();
        if (pomoLeft <= 0) {
          clearInterval(pomoInterval); pomoRunning = false;
          pomoComplete();
        }
      }, 1000);
    }
    pomoRefreshUI();
  }

  function pomoReset() {
    clearInterval(pomoInterval); pomoRunning = false;
    pomoLeft = POMO_DURATION;
    pomoRefreshUI();
    const st = document.getElementById('cs-pomo-status');
    if (st) { st.textContent = 'Focus session'; st.style.color = '#475569'; }
    const timeEl = document.getElementById('cs-pomo-time');
    if (timeEl) timeEl.style.color = '#f8fafc';
  }

  function pomoComplete() {
    const st = document.getElementById('cs-pomo-status');
    if (st) { st.textContent = '🎉 Break time!'; st.style.color = '#22c55e'; }
    if (pomoEl) {
      pomoEl.style.boxShadow = '0 0 0 3px #22c55e, 0 8px 32px rgba(0,0,0,.5)';
      setTimeout(() => { if (pomoEl) pomoEl.style.boxShadow = '0 8px 32px rgba(0,0,0,.5)'; }, 4000);
    }
    // Web Notification (works on Chrome/Chromium, Linux + Windows)
    const notify = () => new Notification('🍅 Pomodoro done!', {
      body: 'Great focus session! Time for a 5-minute break.',
      icon: chrome.runtime?.getURL?.('icons/icon48.png') || '',
    });
    if (Notification.permission === 'granted') notify();
    else if (Notification.permission !== 'denied')
      Notification.requestPermission().then(p => { if (p === 'granted') notify(); });

    setTimeout(pomoReset, 5000);
  }

  function showPomodoro(show) {
    if (!pomoEl) { if (show) buildPomodoro(); return; }
    pomoEl.style.display = show ? 'flex' : 'none';
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §8  [F] COPY CODE BUTTONS
  // ══════════════════════════════════════════════════════════════════════════════

  function initCopyCode() {
    const style = document.createElement('style');
    style.id = 'cs-copy-styles';
    style.textContent = `
      .cs-copy-btn {
        position:absolute; top:8px; right:8px;
        background:#334155; color:#94a3b8; border:none; border-radius:6px;
        padding:3px 10px; font-size:11px; font-weight:600; cursor:pointer;
        opacity:0; transition:opacity .2s, background .2s, color .2s;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        z-index:10;
      }
      pre:hover .cs-copy-btn { opacity:1; }
      .cs-copy-btn.copied { background:#16a34a !important; color:#fff !important; }
    `;
    document.head.appendChild(style);

    document.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.cs-copy-btn')) return;
      if (getComputedStyle(pre).position === 'static') pre.style.position = 'relative';

      const btn = document.createElement('button');
      btn.className = 'cs-copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const code  = pre.querySelector('code') || pre;
        const text  = code.innerText || code.textContent || '';
        const flash = () => {
          btn.classList.add('copied');
          btn.textContent = '✓ Copied!';
          setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 2000);
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(flash).catch(() => fallbackCopy(text, flash));
        } else {
          fallbackCopy(text, flash);
        }
      });
      pre.appendChild(btn);
    });
  }

  function fallbackCopy(text, cb) {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    Object.assign(ta.style, { position: 'fixed', top: '-9999px', left: '-9999px' });
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (_) { /* silent */ }
    ta.remove();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §9  [G] FLOATING TABLE OF CONTENTS
  // ══════════════════════════════════════════════════════════════════════════════

  function initFloatingTOC() {
    if (document.getElementById('cs-toc')) return;
    const art = getArticle();
    if (!art) return;

    const headings = art.querySelectorAll('h2, h3');
    if (headings.length < 2) return;

    // Give each heading a stable id
    headings.forEach((h, i) => { if (!h.id) h.id = `cs-h-${i}`; });

    const toc = Object.assign(document.createElement('div'), { id: 'cs-toc' });
    toc.innerHTML = `
      <div id="cs-toc-header">
        <span style="font-size:10px;font-weight:700;letter-spacing:.08em;
                     text-transform:uppercase;color:#475569">📑 On this page</span>
        <button id="cs-toc-close" title="Collapse TOC">−</button>
      </div>
      <div id="cs-toc-body"></div>
    `;

    const tocStyle = document.createElement('style');
    tocStyle.id = 'cs-toc-styles';
    tocStyle.textContent = `
      #cs-toc {
        position:fixed; right:16px; top:50%; transform:translateY(-50%);
        background:#1e293b; border:1px solid #334155; border-radius:14px;
        padding:12px; width:210px; max-height:60vh; overflow:hidden;
        z-index:2147483645;
        box-shadow:0 4px 24px rgba(0,0,0,.4);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        transition:max-height .3s ease, opacity .2s;
      }
      #cs-toc-header {
        display:flex; justify-content:space-between; align-items:center;
        padding-bottom:8px; margin-bottom:6px;
        border-bottom:1px solid #334155;
      }
      #cs-toc-close {
        background:none; border:none; color:#475569; cursor:pointer;
        font-size:16px; line-height:1; padding:0 2px;
      }
      #cs-toc-close:hover { color:#e2e8f0; }
      #cs-toc-body { overflow-y:auto; max-height:calc(60vh - 50px); }
      #cs-toc-body::-webkit-scrollbar { width:3px; }
      #cs-toc-body::-webkit-scrollbar-track { background:transparent; }
      #cs-toc-body::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
      .cs-toc-link {
        display:block; font-size:12px; color:#64748b; text-decoration:none;
        padding:3px 6px; border-left:2px solid transparent;
        margin:1px 0; border-radius:0 4px 4px 0;
        transition:color .15s, border-color .15s;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        line-height:1.45; cursor:pointer;
      }
      .cs-toc-link:hover  { color:#cbd5e1; background:rgba(255,255,255,.04); }
      .cs-toc-link.active { color:#ED155A; border-left-color:#ED155A; font-weight:600; }
      .cs-toc-h3 { padding-left:18px !important; font-size:11px; }
      #cs-toc.collapsed #cs-toc-body { display:none; }
      #cs-toc.collapsed { max-height:42px; }
    `;
    document.head.appendChild(tocStyle);

    const body = toc.querySelector('#cs-toc-body');
    const links = [];

    headings.forEach(h => {
      const a = document.createElement('a');
      a.className = 'cs-toc-link' + (h.tagName === 'H3' ? ' cs-toc-h3' : '');
      a.textContent = h.textContent.trim();
      a.title       = h.textContent.trim();
      a.href = `#${h.id}`;
      a.addEventListener('click', e => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      body.appendChild(a);
      links.push({ a, h });
    });

    document.body.appendChild(toc);

    // Close/expand toggle
    toc.querySelector('#cs-toc-close').addEventListener('click', () => {
      const collapsed = toc.classList.toggle('collapsed');
      toc.querySelector('#cs-toc-close').textContent = collapsed ? '+' : '−';
      toc.querySelector('#cs-toc-close').title = collapsed ? 'Expand TOC' : 'Collapse TOC';
    });

    // Scroll-spy via IntersectionObserver
    const io = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        links.forEach(({ a, h }) => a.classList.toggle('active', h === target));
      });
    }, { rootMargin: '-10% 0px -75% 0px' });

    headings.forEach(h => io.observe(h));
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §10  [H] HIGHLIGHTER
  // ══════════════════════════════════════════════════════════════════════════════

  let hlToolbar   = null;
  let hlSelection = null;

  function initHighlighter() {
    const style = document.createElement('style');
    style.id = 'cs-hl-styles';
    style.textContent = `
      mark.cs-hl {
        border-radius:2px; cursor:pointer; padding:1px 0;
        transition:filter .15s;
      }
      mark.cs-hl:hover { filter:brightness(.88); }

      #cs-hl-bar {
        position:absolute; z-index:2147483644;
        background:#1e293b; border:1px solid #334155;
        border-radius:10px; padding:6px 8px;
        display:flex; gap:6px; align-items:center;
        box-shadow:0 4px 20px rgba(0,0,0,.45);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:cs-fade .15s ease;
      }
      @keyframes cs-fade {
        from { opacity:0; transform:translateY(4px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .cs-hl-dot {
        width:20px; height:20px; border-radius:50%;
        border:2px solid transparent; cursor:pointer;
        transition:transform .15s, border-color .15s;
      }
      .cs-hl-dot:hover { transform:scale(1.25); border-color:#fff; }
      .cs-hl-x {
        background:none; border:none; color:#475569;
        cursor:pointer; font-size:13px; padding:0 2px; line-height:1;
      }
      .cs-hl-x:hover { color:#ef4444; }
      .cs-hl-sep { width:1px; height:14px; background:#334155; }
    `;
    document.head.appendChild(style);

    document.addEventListener('mouseup', onSelectionEnd);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideHlBar(); });
  }

  function onSelectionEnd(e) {
    // Don't interfere with our own toolbar click
    if (e.target.closest('#cs-hl-bar')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { hideHlBar(); return; }
      const art = getArticle();
      if (!art || !art.contains(sel.anchorNode)) { hideHlBar(); return; }
      hlSelection = sel;
      showHlBar(e.clientX, e.clientY);
    }, 10);
  }

  function showHlBar(cx, cy) {
    hideHlBar();
    const bar = Object.assign(document.createElement('div'), { id: 'cs-hl-bar' });

    Object.entries(HIGHLIGHT_COLORS).forEach(([name, c]) => {
      const dot = Object.assign(document.createElement('div'), { className: 'cs-hl-dot', title: name });
      dot.style.background = c.bg;
      dot.addEventListener('mousedown', ev => {
        ev.preventDefault();
        applyHighlight(name, c);
        hideHlBar();
      });
      bar.appendChild(dot);
    });

    const sep = Object.assign(document.createElement('div'), { className: 'cs-hl-sep' });
    const x   = Object.assign(document.createElement('button'), { className: 'cs-hl-x', textContent: '✕', title: 'Cancel' });
    x.addEventListener('mousedown', ev => { ev.preventDefault(); hideHlBar(); });
    bar.appendChild(sep);
    bar.appendChild(x);
    document.body.appendChild(bar);
    hlToolbar = bar;

    // Position above cursor, clamped to viewport
    const { width } = bar.getBoundingClientRect();
    let left = window.scrollX + cx - width / 2;
    let top  = window.scrollY + cy - 54;
    left = Math.max(8, Math.min(left, window.innerWidth  + window.scrollX - width - 8));
    top  = Math.max(8, top);
    bar.style.left = `${left}px`;
    bar.style.top  = `${top}px`;
  }

  function hideHlBar() {
    hlToolbar?.remove();
    hlToolbar = null;
  }

  function applyHighlight(colorName, colors) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const text  = range.toString().trim();
    if (!text) return;

    const mark = document.createElement('mark');
    mark.className = 'cs-hl';
    mark.dataset.csColor = colorName;
    Object.assign(mark.style, { backgroundColor: colors.bg, color: colors.fg });

    try {
      range.surroundContents(mark);
    } catch {
      // Cross-node selection – extract then wrap
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
    sel.removeAllRanges();
    persistHighlight(text, colorName);
  }

  function persistHighlight(text, colorName) {
    chrome.storage.local.get([SK.HIGHLIGHTS], d => {
      const all = d[SK.HIGHLIGHTS] || {};
      if (!all[PAGE]) all[PAGE] = [];
      // Avoid exact duplicates
      if (!all[PAGE].some(h => h.text === text && h.colorName === colorName))
        all[PAGE].push({ text, colorName });
      chrome.storage.local.set({ [SK.HIGHLIGHTS]: all });
    });
  }

  function restoreHighlights(allHL) {
    const list = allHL[PAGE] || [];
    if (!list.length) return;
    // Give the page a moment to fully render
    setTimeout(() => {
      const art = getArticle();
      if (!art) return;
      list.forEach(({ text, colorName }) => {
        const c = HIGHLIGHT_COLORS[colorName];
        if (!c || !text) return;
        findAndWrapText(art, text, c);
      });
    }, 900);
  }

  /** Walk text nodes in container and wrap the first occurrence of `text`. */
  function findAndWrapText(container, text, colors) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.classList.contains('cs-hl')) continue;
      const idx = node.nodeValue.indexOf(text);
      if (idx === -1) continue;
      const before = node.splitText(idx);
      const after  = before.splitText(text.length);     // eslint-disable-line no-unused-vars
      const mark   = document.createElement('mark');
      mark.className = 'cs-hl';
      Object.assign(mark.style, { backgroundColor: colors.bg, color: colors.fg });
      mark.textContent = text;
      before.parentNode.replaceChild(mark, before);
      return; // first occurrence only
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §11  [I] INLINE NOTES
  // ══════════════════════════════════════════════════════════════════════════════

  let openNotePopup = null;

  function initInlineNotes() {
    const style = document.createElement('style');
    style.id = 'cs-note-styles';
    style.textContent = `
      .cs-note-icon {
        position:absolute; left:-32px; top:50%; transform:translateY(-50%);
        background:none; border:none; cursor:pointer; font-size:15px;
        opacity:0; transition:opacity .2s; padding:2px; line-height:1;
        z-index:100;
      }
      .cs-note-icon.has-note { opacity:.85 !important; filter:none; }
      .cs-note-host { position:relative; }
      .cs-note-host:hover .cs-note-icon { opacity:.5; }

      .cs-note-popup {
        position:absolute; left:-268px; top:0; width:240px;
        background:#1e293b; border:1px solid #334155; border-radius:10px;
        padding:10px; z-index:2147483643;
        box-shadow:0 6px 24px rgba(0,0,0,.5);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:cs-fade .15s ease;
      }
      .cs-note-popup textarea {
        width:100%; height:82px; resize:vertical;
        background:#0f172a; color:#e2e8f0;
        border:1px solid #334155; border-radius:6px;
        padding:6px 8px; font-size:12px; font-family:inherit;
        outline:none; box-sizing:border-box;
      }
      .cs-note-popup textarea:focus { border-color:#ED155A; }
      .cs-note-row {
        display:flex; justify-content:flex-end; gap:6px; margin-top:6px;
      }
      .cs-note-del { background:#334155; color:#94a3b8; border:none; border-radius:6px; padding:4px 10px; font-size:11px; cursor:pointer; }
      .cs-note-save { background:#ED155A; color:#fff; border:none; border-radius:6px; padding:4px 12px; font-size:11px; font-weight:600; cursor:pointer; }
    `;
    document.head.appendChild(style);

    const art = getArticle();
    if (!art) return;

    art.querySelectorAll('p, h2, h3, h4, pre').forEach((el, i) => {
      el.classList.add('cs-note-host');
      el.dataset.csPi = i; // paragraph index

      const icon = document.createElement('button');
      icon.className = 'cs-note-icon';
      icon.textContent = '📝';
      icon.title = 'Add note';
      icon.addEventListener('click', ev => {
        ev.stopPropagation();
        openNote(i, el, icon);
      });
      el.appendChild(icon);
    });

    // Close popup on outside click
    document.addEventListener('click', e => {
      if (openNotePopup && !openNotePopup.contains(e.target) &&
          !e.target.classList.contains('cs-note-icon')) {
        openNotePopup.remove(); openNotePopup = null;
      }
    });
  }

  function openNote(idx, el, icon) {
    openNotePopup?.remove();
    chrome.storage.local.get([SK.NOTES], d => {
      const saved = ((d[SK.NOTES] || {})[PAGE] || {})[idx] || '';

      const popup = document.createElement('div');
      popup.className = 'cs-note-popup';

      const ta = document.createElement('textarea');
      ta.placeholder = 'Your note…';
      ta.value = saved;

      const row  = document.createElement('div'); row.className = 'cs-note-row';
      const del  = Object.assign(document.createElement('button'), { className: 'cs-note-del',  textContent: 'Delete' });
      const save = Object.assign(document.createElement('button'), { className: 'cs-note-save', textContent: 'Save'   });

      save.addEventListener('click', () => { saveNote(idx, ta.value.trim(), icon); popup.remove(); openNotePopup = null; });
      del.addEventListener('click',  () => { saveNote(idx, '', icon); popup.remove(); openNotePopup = null; });

      row.append(del, save);
      popup.append(ta, row);
      el.appendChild(popup);
      openNotePopup = popup;
      ta.focus();
    });
  }

  function saveNote(idx, text, icon) {
    chrome.storage.local.get([SK.NOTES], d => {
      const all = d[SK.NOTES] || {};
      if (!all[PAGE]) all[PAGE] = {};
      if (text) { all[PAGE][idx] = text; icon.classList.add('has-note'); }
      else       { delete all[PAGE][idx]; icon.classList.remove('has-note'); }
      chrome.storage.local.set({ [SK.NOTES]: all });
    });
  }

  function restoreNotes(allNotes) {
    const pageNotes = allNotes[PAGE] || {};
    if (!Object.keys(pageNotes).length) return;
    setTimeout(() => {
      getArticle()?.querySelectorAll('[data-cs-pi]').forEach(el => {
        if (pageNotes[el.dataset.csPi])
          el.querySelector('.cs-note-icon')?.classList.add('has-note');
      });
    }, 700);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §12  [J] MARK AS DONE
  // ══════════════════════════════════════════════════════════════════════════════

  function initMarkDone(allDone) {
    if (document.getElementById('cs-mark-done-wrap')) return;
    const art = getArticle();
    if (!art) return;

    const done = !!allDone[PAGE];
    const wrap = Object.assign(document.createElement('div'), { id: 'cs-mark-done-wrap' });
    Object.assign(wrap.style, {
      display: 'flex', justifyContent: 'center',
      padding: '36px 0 56px',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    });

    const btn = Object.assign(document.createElement('button'), { id: 'cs-mark-done-btn' });
    Object.assign(btn.style, {
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '12px 30px', borderRadius: '10px', border: 'none',
      fontSize: '15px', fontWeight: '600', cursor: 'pointer',
      transition: 'all .2s ease',
      background: done ? '#dcfce7' : '#ED155A',
      color:      done ? '#16a34a' : '#fff',
    });
    btn.innerHTML = done ? '✅ Marked as done — great work!' : '✓ Mark this page as done';

    btn.addEventListener('click', () => {
      chrome.storage.local.get([SK.COMPLETED], d => {
        const all = d[SK.COMPLETED] || {};
        if (all[PAGE]) {
          delete all[PAGE];
          btn.innerHTML = '✓ Mark this page as done';
          Object.assign(btn.style, { background: '#ED155A', color: '#fff' });
        } else {
          all[PAGE] = Date.now();
          btn.innerHTML = '✅ Marked as done — great work!';
          Object.assign(btn.style, { background: '#dcfce7', color: '#16a34a' });
          confetti(btn);
        }
        chrome.storage.local.set({ [SK.COMPLETED]: all });
      });
    });

    wrap.appendChild(btn);
    art.appendChild(wrap);
  }

  function confetti(anchor) {
    const palette = ['#ED155A','#22c55e','#3b82f6','#f59e0b','#a855f7','#06b6d4'];
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + window.scrollY + r.height / 2;

    if (!document.getElementById('cs-confetti-style')) {
      const s = document.createElement('style');
      s.id = 'cs-confetti-style';
      s.textContent = `
        @keyframes cs-poof {
          0%   { opacity:1; transform:translate(0,0) scale(1) rotate(0deg); }
          100% { opacity:0; transform:translate(var(--dx),var(--dy)) scale(.3) rotate(var(--dr)); }
        }
        .cs-confetti-dot {
          position:absolute; border-radius:50%; pointer-events:none; z-index:2147483647;
          animation:cs-poof .9s ease-out forwards;
        }
      `;
      document.head.appendChild(s);
    }

    for (let i = 0; i < 40; i++) {
      const dot  = document.createElement('div');
      const size = 5 + Math.random() * 8;
      dot.className = 'cs-confetti-dot';
      dot.style.cssText = `
        width:${size}px; height:${size}px;
        background:${palette[i % palette.length]};
        left:${cx + (Math.random() - .5) * 10}px;
        top:${cy}px;
        --dx:${(Math.random() - .5) * 220}px;
        --dy:${-(60 + Math.random() * 120)}px;
        --dr:${Math.round(Math.random() * 360)}deg;
        animation-delay:${Math.random() * .25}s;
      `;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 1200);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // §13  POPUP MESSAGE HANDLER
  // ══════════════════════════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'CS_FOCUS_TOGGLE':
        applyFocusMode(msg.enabled);
        break;
      case 'CS_SPOTLIGHT_TOGGLE':
        msg.enabled ? enableSpotlight() : disableSpotlight();
        break;
      case 'CS_POMODORO_TOGGLE':
        showPomodoro(msg.enabled);
        break;
      case 'CS_GET_STATS':
        chrome.storage.local.get([SK.HIGHLIGHTS, SK.NOTES, SK.COMPLETED], d => {
          sendResponse({
            highlights: (d[SK.HIGHLIGHTS]?.[PAGE] || []).length,
            notes:      Object.keys(d[SK.NOTES]?.[PAGE] || {}).length,
            totalDone:  Object.keys(d[SK.COMPLETED]  || {}).length,
            pageDone:   !!d[SK.COMPLETED]?.[PAGE],
          });
        });
        return true; // async response
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // §14  BOOTSTRAP
  // ══════════════════════════════════════════════════════════════════════════════

  function boot() {
    chrome.storage.local.get(null, stored => {
      const focusOn     = stored[SK.FOCUS]     !== false; // default ON
      const spotOn      = !!stored[SK.SPOTLIGHT];
      const pomodoroOn  = !!stored[SK.POMODORO];

      // Always-on features (no toggle)
      initReadingProgress();

      // Features that need the article content
      whenArticleReady(() => {
        initReadTime();
        initCopyCode();
        initFloatingTOC();
        initHighlighter();
        initInlineNotes();
        initMarkDone(stored[SK.COMPLETED] || {});
        restoreHighlights(stored[SK.HIGHLIGHTS] || {});
        restoreNotes(stored[SK.NOTES]      || {});
      });

      // Toggled features
      if (focusOn)    applyFocusMode(true);
      if (spotOn)     enableSpotlight();
      if (pomodoroOn) buildPomodoro();
    });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else
    boot();

})(); // end IIFE
