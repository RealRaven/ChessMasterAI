/* ================================================================
   camera-panel.js — camera preset buttons + Auto-Cam mode.
   Auto-Cam follows the mover after every committed move.
   ================================================================ */

import { events } from '../core/events.js';
import { qs, qsa } from '../utils/dom.js';

/**
 * @param {object} deps
 * @param {{applyPreset:Function, moveTo:Function}} deps.cameraCtl
 */
export function mountCameraPanel({ cameraCtl }) {
  const buttons = qsa('[data-cam]');
  let autoCam = false;

  function setActive(activeName) {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.cam === activeName;
      btn.classList.toggle('btn-primary', isActive);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.cam;
      if (preset === 'auto') {
        autoCam = true;
        setActive('auto');
        return;
      }
      autoCam = false;
      setActive(preset);
      cameraCtl.applyPreset(preset);
    });
  });

  /* Auto-Cam: pan to the side that just moved (i.e. just spoke) */
  events.on('move:committed', (moveData) => {
    if (!autoCam) return;
    const side = moveData.color === 'w' ? 'white' : 'black';
    cameraCtl.applyPreset(side);
  });

  /* Default active state on first mount */
  setActive('free');
}