/* ================================================================
   controls.js — Play / Pause / Step / Reset buttons.
   Delegates to core/game-loop; never calls engine directly.
   ================================================================ */

import { events } from '../core/events.js';
import { state } from '../core/state.js';
import { qs } from '../utils/dom.js';

/**
 * @param {object} deps
 * @param {{play:Function, pause:Function, step:Function, reset:Function}} deps.gameLoop
 * @param {object} deps.gameDeps — the injected dependency bundle for game-loop
 */
export function mountControls({ gameLoop, gameDeps }) {
  const playBtn  = qs('#btn-play');
  const pauseBtn = qs('#btn-pause');
  const stepBtn  = qs('#btn-step');
  const resetBtn = qs('#btn-reset');

  playBtn.addEventListener('click', () => {
    if (state.gameState === 'gameover') gameLoop.reset();
    gameLoop.play(gameDeps);
  });

  pauseBtn.addEventListener('click', () => gameLoop.pause());
  stepBtn.addEventListener('click',  () => gameLoop.step(gameDeps));
  resetBtn.addEventListener('click', () => gameLoop.reset());

  function updateButtons() {
    const s = state.gameState;
    playBtn.disabled  = s === 'playing';
    pauseBtn.disabled = s !== 'playing';
    stepBtn.disabled  = s === 'playing' || s === 'gameover';
    /* reset always enabled */
  }

  events.on('state:game', updateButtons);
  updateButtons();
}