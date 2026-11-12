/* ================================================================
   hud.js — top-level HUD orchestrator. Mounts every sub-panel
   and wires the collapse toggle. Returns handles for anything
   main.js needs to call directly (currently just vision-preview).
   ================================================================ */

import { qs } from '../utils/dom.js';
import { mountControls } from './controls.js';
import { mountCameraPanel } from './camera-panel.js';
import { mountSettingsPanel } from './settings-panel.js';
import { mountLogPanel } from './log-panel.js';
import { mountWhisperInput } from './whisper-input.js';
import { mountPgnExport } from './pgn-export.js';
import { mountVisionPreview } from './vision-preview.js';

/**
 * @param {object} deps
 * @param {object} deps.gameLoop    — { play, pause, step, reset }
 * @param {object} deps.gameDeps    — { callAI, onCommit, onGameOver }
 * @param {object} deps.cameraCtl   — from three/camera-presets.js
 * @param {object} deps.avatars     — from three/avatars/avatar-manager.js
 * @param {(themeId:string) => void} deps.applyTheme
 * @returns {{ visionPreview: { setSnapshot: Function } }}
 */
export function mountHUD(deps) {
  /* Sub-panels that return handles are mounted first */
  const visionPreview = mountVisionPreview();
  mountCameraPanel({ cameraCtl: deps.cameraCtl });

  /* Fire-and-forget sub-panels */
  mountControls({
    gameLoop: deps.gameLoop,
    gameDeps: deps.gameDeps,
  });
  mountSettingsPanel({
    avatars: deps.avatars,
    applyTheme: deps.applyTheme,
  });
  mountLogPanel();
  mountWhisperInput();
  mountPgnExport();

  /* Collapse toggle */
  const toggle = qs('#hud-toggle');
  const hud    = qs('#hud');
  toggle.addEventListener('click', () => hud.classList.toggle('collapsed'));

  return { visionPreview };
}