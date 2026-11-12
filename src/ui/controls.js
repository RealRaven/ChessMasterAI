/* ================================================================
   controls.js — Play / Pause / Step / Reset buttons.
   ================================================================ */

import { events } from '../core/events.js';
import { state } from '../core/state.js';
import { qs } from '../utils/dom.js';
import { unlockAudio } from '../audio/tts.js'; // <-- Import the unlock function

export function mountControls({ gameLoop, gameDeps }) {
  const playBtn  = qs('#btn-play');
  const pauseBtn = qs('#btn-pause');
  const stepBtn  = qs('#btn-step');
  const resetBtn = qs('#btn-reset');

  playBtn.addEventListener('click', () => {
    unlockAudio(); // <-- Unlock audio on user gesture
    if (state.gameState === 'gameover') gameLoop.reset();
    gameLoop.play(gameDeps);
  });

  pauseBtn.addEventListener('click', () => gameLoop.pause());
  stepBtn.addEventListener('click',  () => {
    unlockAudio(); // Also unlock here just in case
    gameLoop.step(gameDeps);
  });
  resetBtn.addEventListener('click', () => gameLoop.reset());

  function updateButtons() {
    const s = state.gameState;
    playBtn.disabled  = s === 'playing';
    pauseBtn.disabled = s !== 'playing';
    stepBtn.disabled  = s === 'playing' || s === 'gameover';
  }

  events.on('state:game', updateButtons);
  updateButtons();
}