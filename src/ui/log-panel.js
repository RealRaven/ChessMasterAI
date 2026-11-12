/* ================================================================
   log-panel.js — three event-driven panes (referee, moves, chat)
   plus the status badge logic.
   ================================================================ */

import { events } from '../core/events.js';
import { qs, el, escapeHtml } from '../utils/dom.js';

const REFEREE_MAX = 60;
const MOVES_MAX   = 200;
const CHAT_MAX    = 40;

export function mountLogPanel() {
  const refereePane = qs('#referee-log');
  const movesPane   = qs('#move-history');
  const chatPane    = qs('#chat-transcript');
  const statusBadge = qs('#status-badge');

  let moveNumber = 1;

  function setStatus(text, thinking = false) {
    statusBadge.textContent = text;
    statusBadge.classList.toggle('thinking', thinking);
  }

  function pushLog(pane, html, kind = '', max = 60) {
    const div = el('div', { class: kind ? `log-${kind}` : '' });
    div.innerHTML = html;
    pane.prepend(div);
    while (pane.children.length > max) {
      pane.removeChild(pane.lastChild);
    }
  }

  /* --- Referee Log --- */
  events.on('referee:attempt', ({ attempt, maxRetries }) => {
    pushLog(refereePane, `attempt ${attempt}/${maxRetries}…`, '', REFEREE_MAX);
  });

  events.on('referee:legal', ({ san, attempt }) => {
    pushLog(refereePane, `✅ legal ${escapeHtml(san)} (try ${attempt})`, 'legal', REFEREE_MAX);
  });

  events.on('referee:illegal', ({ move, reason, attempt }) => {
    pushLog(refereePane, `❌ illegal "${escapeHtml(String(move))}" (${escapeHtml(reason)}) try ${attempt}`, 'illegal', REFEREE_MAX);
  });

  events.on('referee:override', ({ move, attempts }) => {
    pushLog(refereePane, `⚠️ override → ${escapeHtml(move)} after ${attempts} attempts`, 'override', REFEREE_MAX);
  });

  events.on('referee:error', ({ attempt, message }) => {
    pushLog(refereePane, `❗ API error (try ${attempt}): ${escapeHtml(message)}`, 'illegal', REFEREE_MAX);
  });

  events.on('game:error', ({ message }) => {
    pushLog(refereePane, `❗ ${escapeHtml(message)}`, 'illegal', REFEREE_MAX);
  });

  /* --- Move History --- */
  events.on('move:committed', (moveData) => {
    if (moveData.color === 'w') {
      pushLog(movesPane, `${moveNumber}. ${escapeHtml(moveData.san)}`, 'legal', MOVES_MAX);
    } else {
      pushLog(movesPane, `${moveNumber}… ${escapeHtml(moveData.san)}`, 'legal', MOVES_MAX);
      moveNumber++;
    }
  });

  /* --- Chat Transcript --- */
  events.on('state:lastSpeech', ({ side, value }) => {
    if (!value) return;
    const color = side === 'white' ? 'white' : 'black';
    pushLog(chatPane, `<strong class="${color}">${side === 'white' ? 'White' : 'Black'}:</strong> ${escapeHtml(value)}`, '', CHAT_MAX);
  });

  /* --- Status Badge --- */
  events.on('ai:thinking', ({ side, attempt }) => {
    const name = side === 'white' ? 'Qwen' : 'Gemma';
    const retry = attempt > 1 ? ` (retry ${attempt})` : '';
    setStatus(`${name} is thinking${retry}…`, true);
  });

  events.on('state:turn', ({ next }) => {
    const name = next === 'w' ? 'Qwen' : 'Gemma';
    setStatus(`${name}'s turn`);
  });

  events.on('game:over', ({ message }) => {
    setStatus(message);
  });

  events.on('game:reset', () => {
    setStatus('Ready. Press Play.');
    refereePane.innerHTML = '';
    movesPane.innerHTML   = '';
    chatPane.innerHTML    = '';
    moveNumber = 1;
  });
}