/* ================================================================
   settings-panel.js — theme select, model tags, personality presets,
   avatar uploads, and audio mute toggles.
   All state changes flow through core/state.js.
   ================================================================ */

import { CONFIG } from '../config.js';
import { events } from '../core/events.js';
import {
  state,
  setTheme,
  setModel,
  setPersonality,
} from '../core/state.js';
import { SFX } from '../audio/sfx.js';
import { TTS } from '../audio/tts.js';
import { qs } from '../utils/dom.js';

/**
 * @param {object} deps
 * @param {object} deps.avatars        — THREE avatar manager (batch 4)
 * @param {(themeId: string) => void} deps.applyTheme — 3D theme applier
 */
export function mountSettingsPanel({ avatars, applyTheme }) {
  /* ---------- Theme ---------- */
  const themeSelect = qs('#theme-select');
  themeSelect.value = state.theme;
  themeSelect.addEventListener('change', (e) => {
    const id = e.target.value;
    setTheme(id);
    applyTheme(id);
  });

  /* ---------- Models ---------- */
  const modelWhiteInput = qs('#model-white');
  const modelBlackInput = qs('#model-black');
  modelWhiteInput.value = state.models.white;
  modelBlackInput.value = state.models.black;

  modelWhiteInput.addEventListener('change', (e) => {
    setModel('white', e.target.value.trim() || CONFIG.defaultModels.white);
  });
  modelBlackInput.addEventListener('change', (e) => {
    setModel('black', e.target.value.trim() || CONFIG.defaultModels.black);
  });

  /* ---------- Personalities ---------- */
  const persWhite = qs('#personality-white');
  const persBlack = qs('#personality-black');
  persWhite.value = state.personalities.white;
  persBlack.value = state.personalities.black;

  persWhite.addEventListener('change', (e) => setPersonality('white', e.target.value));
  persBlack.addEventListener('change', (e) => setPersonality('black', e.target.value));

  /* ---------- Avatar uploads ---------- */
  const uploadWhite = qs('#upload-white');
  const uploadBlack = qs('#upload-black');

  async function handleUpload(input, side) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await avatars.setGLB(side, file);
      events.emit('game:error', {
        message: `${side} avatar replaced with ${file.name}`,
        error: null,
      });
    } catch (err) {
      events.emit('game:error', {
        message: `Failed to load ${side} avatar: ${err.message}`,
        error: err,
      });
    } finally {
      /* Clear so the same file can be re-selected if the user wants */
      input.value = '';
    }
  }

  uploadWhite.addEventListener('change', () => handleUpload(uploadWhite, 'white'));
  uploadBlack.addEventListener('change', () => handleUpload(uploadBlack, 'black'));

  /* ---------- Mute toggles ---------- */
  const sfxBtn = qs('#btn-mute-sfx');
  const ttsBtn = qs('#btn-mute-tts');

  sfxBtn.addEventListener('click', () => {
    const muted = SFX.toggleMute();
    sfxBtn.textContent = `SFX: ${muted ? 'Off' : 'On'}`;
  });

  /* Check for TTS support before attaching the click listener */
  if (!TTS.isSupported()) {
    ttsBtn.disabled = true;
    ttsBtn.textContent = 'TTS: Unsupported';
    ttsBtn.title = 'Your browser or OS does not support speech synthesis.';
  } else {
    ttsBtn.addEventListener('click', () => {
      const muted = TTS.toggleMute();
      ttsBtn.textContent = `TTS: ${muted ? 'Off' : 'On'}`;
    });
  }
}