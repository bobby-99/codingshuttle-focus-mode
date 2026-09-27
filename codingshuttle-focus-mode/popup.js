/**
 * CodingShuttle Focus Mode — popup.js  v2.0
 *
 * Handles:
 *  - Loading & saving toggle states (focus, spotlight, pomodoro)
 *  - Driving the Pomodoro timer display independently in the popup
 *  - Sending messages to the active-tab content script
 *  - Fetching per-page stats from the content script
 */

'use strict';

const SK = {
  FOCUS:     'cs_focus_mode',
  SPOTLIGHT: 'cs_spotlight',
  POMODORO:  'cs_pomodoro',
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const togFocus     = document.getElementById('tog-focus');
const togSpotlight = document.getElementById('tog-spotlight');
const togPomodoro  = document.getElementById('tog-pomodoro');

const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const pomoDisplay = document.getElementById('pomo-display');
const pomoStatus  = document.getElementById('pomo-status');
const pomoPlay    = document.getElementById('pomo-play');
const pomoReset   = document.getElementById('pomo-reset');

const statHL    = document.getElementById('stat-hl');
const statNotes = document.getElementById('stat-notes');
const statDone  = document.getElementById('stat-done');
const statPage  = document.getElementById('stat-page');

// ─── Pomodoro state (mirrored in popup for display) ──────────────────────────
// The authoritative timer runs in content.js; here we just mirror the display
// for a nicer UX when the popup is open.
const POMO_DURATION = 25 * 60;
let pomoLeft    = POMO_DURATION;
let pomoRunning = false;
let pomoTick    = null;

function pomoRefresh() {
  const m = String(Math.floor(pomoLeft / 60)).padStart(2, '0');
  const s = String(pomoLeft % 60).padStart(2, '0');
  pomoDisplay.textContent = `${m}:${s}`;
  pomoDisplay.style.color = pomoLeft < 60 ? '#ef4444' : pomoLeft < 300 ? '#f59e0b' : '#f8fafc';
  pomoPlay.textContent = pomoRunning
    ? '⏸ Pause'
    : (pomoLeft < POMO_DURATION ? '▶ Resume' : '▶ Start');
}

function pomoStartStop() {
  if (pomoRunning) {
    clearInterval(pomoTick); pomoRunning = false;
    sendToContent({ type: 'CS_POMO_PAUSE' });
  } else {
    pomoRunning = true;
    sendToContent({ type: 'CS_POMO_PLAY' });
    pomoTick = setInterval(() => {
      if (pomoLeft > 0) { pomoLeft--; pomoRefresh(); }
      else { clearInterval(pomoTick); pomoRunning = false; pomoRefresh(); }
    }, 1000);
  }
  pomoRefresh();
}

function pomoDoReset() {
  clearInterval(pomoTick);
  pomoRunning = false;
  pomoLeft    = POMO_DURATION;
  pomoStatus.textContent  = 'Ready to start';
  pomoStatus.style.color  = '';
  pomoDisplay.style.color = '#f8fafc';
  pomoRefresh();
  sendToContent({ type: 'CS_POMO_RESET' });
}

// ─── Toggle helpers ───────────────────────────────────────────────────────────
function setFocusUI(on) {
  togFocus.checked = on;
  statusDot.classList.toggle('off', !on);
  statusText.textContent = on ? 'Focus mode is active' : 'Focus mode is off';
}

// ─── Send message to content script in active tab ─────────────────────────────
function sendToContent(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id != null) {
      chrome.tabs.sendMessage(tabs[0].id, msg, () => {
        // Swallow "no receiving end" errors gracefully
        void chrome.runtime.lastError;
      });
    }
  });
}

// ─── Load stats from content script ──────────────────────────────────────────
function loadStats() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'CS_GET_STATS' }, resp => {
      void chrome.runtime.lastError; // suppress if no content script
      if (!resp) return;
      statHL.textContent    = resp.highlights ?? '—';
      statNotes.textContent = resp.notes      ?? '—';
      statDone.textContent  = resp.totalDone  ?? '—';
      statPage.textContent  = resp.pageDone   ? '✅ Done' : '○ In progress';
      statPage.style.color  = resp.pageDone   ? '#22c55e' : '';
      statPage.style.fontSize = resp.pageDone ? '13px' : '';
    });
  });
}

// ─── Wire up toggles ─────────────────────────────────────────────────────────
togFocus.addEventListener('change', () => {
  const on = togFocus.checked;
  chrome.storage.local.set({ [SK.FOCUS]: on });
  setFocusUI(on);
  sendToContent({ type: 'CS_FOCUS_TOGGLE', enabled: on });
});

togSpotlight.addEventListener('change', () => {
  const on = togSpotlight.checked;
  chrome.storage.local.set({ [SK.SPOTLIGHT]: on });
  sendToContent({ type: 'CS_SPOTLIGHT_TOGGLE', enabled: on });
});

togPomodoro.addEventListener('change', () => {
  const on = togPomodoro.checked;
  chrome.storage.local.set({ [SK.POMODORO]: on });
  sendToContent({ type: 'CS_POMODORO_TOGGLE', enabled: on });
  if (!on) { clearInterval(pomoTick); pomoRunning = false; pomoRefresh(); }
});

// Pomodoro controls inside popup
pomoPlay.addEventListener('click', () => {
  if (!togPomodoro.checked) {
    // Auto-enable pomodoro if user clicks play without turning on the toggle
    togPomodoro.checked = true;
    chrome.storage.local.set({ [SK.POMODORO]: true });
    sendToContent({ type: 'CS_POMODORO_TOGGLE', enabled: true });
  }
  pomoStartStop();
});

pomoReset.addEventListener('click', pomoDoReset);

// ─── Init ─────────────────────────────────────────────────────────────────────
chrome.storage.local.get([SK.FOCUS, SK.SPOTLIGHT, SK.POMODORO], result => {
  const focusOn    = result[SK.FOCUS]     !== false; // default ON
  const spotOn     = !!result[SK.SPOTLIGHT];
  const pomodoroOn = !!result[SK.POMODORO];

  setFocusUI(focusOn);
  togSpotlight.checked = spotOn;
  togPomodoro.checked  = pomodoroOn;
  pomoRefresh();
  loadStats();
});
