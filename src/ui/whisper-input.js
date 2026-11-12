/* ================================================================
   whisper-input.js — one-shot coach hint injected into the next
   AI's prompt. Consumed once by game-loop's tick().
   ================================================================ */

import { events } from '../core/events.js';
import { setWhisper } from '../core/state.js';
import { qs } from '../utils/dom.js';

export function mountWhisperInput() {
  const input = qs('#whisper-input');
  const sendBtn = qs('#btn-whisper');

  function submit() {
    const text = input.value.trim();
    if (!text) return;
    setWhisper(text);
    events.emit('state:whisper', { value: text }); // already emitted, but explicit for logs
    input.value = '';
  }

  sendBtn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}