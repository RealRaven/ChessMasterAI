/* ================================================================
   state.js — central mutable state store.
   Only owned writers mutate this object (game-loop, controls).
   Readers should consume it via the events bus where possible.
   ================================================================ */

import { CONFIG } from '../config.js';
import { events } from './events.js';

/**
 * The single source of runtime truth.
 * NOTE: `chess-engine.js` holds the *rule* state (FEN, board).
 *       `state.js` holds *UI-facing* state (whose turn, last move,
 *       theme, model tags). The two stay in sync via game-loop.
 */
export const state = {
  /** 'idle' | 'playing' | 'paused' | 'gameover' */
  gameState: 'idle',

  /** 'w' | 'b' — whose move it is. Mirrors chess.turn(). */
  turn: 'w',

  /** { from, to, san, color, piece, captured, isKnight } | null */
  lastMove: null,

  /** { type, winner, message } | null — set on game:over */
  gameOverReason: null,

  /** One-shot hint consumed by the next AI prompt. */
  whisper: null,

  /** 'classic' | 'cyberpunk' | 'marble' */
  theme: 'classic',

  /** Editable model tags per side (initialised from CONFIG). */
  models: {
    white: CONFIG.defaultModels.white,
    black: CONFIG.defaultModels.black,
  },

  /** 'trash' | 'polite' | 'chaotic' */
  personalities: {
    white: 'trash',
    black: 'trash',
  },

  /** Last line spoken per side — carried into the next prompt. */
  lastSpeech: {
    white: '',
    black: '',
  },
};

/* ------------------------------------------------------------------
   Mutators — each transition emits a `state:*` event so the UI can
   react without polling.
   ------------------------------------------------------------------ */

export function setGameState(next) {
  if (state.gameState === next) return;
  const prev = state.gameState;
  state.gameState = next;
  events.emit('state:game', { prev, next });
}

export function setTurn(next) {
  if (state.turn === next) return;
  const prev = state.turn;
  state.turn = next;
  events.emit('state:turn', { prev, next });
}

export function setLastMove(move) {
  state.lastMove = move;
  events.emit('state:lastMove', move);
}

export function setWhisper(text) {
  state.whisper = text || null;
  events.emit('state:whisper', { value: state.whisper });
}

/**
 * Read-and-clear. Returns the whisper (or null) and emits the clear.
 * Called once per turn by game-loop so the hint isn't carried
 * forward into future turns.
 */
export function consumeWhisper() {
  const w = state.whisper;
  if (w) {
    state.whisper = null;
    events.emit('state:whisper', { value: null });
  }
  return w;
}

export function setTheme(theme) {
  if (state.theme === theme) return;
  const prev = state.theme;
  state.theme = theme;
  events.emit('state:theme', { prev, next: theme });
}

export function setModel(side, model) {
  state.models[side] = model;
  events.emit('state:model', { side, value: model });
}

export function setPersonality(side, preset) {
  state.personalities[side] = preset;
  events.emit('state:personality', { side, value: preset });
}

export function setLastSpeech(side, text) {
  state.lastSpeech[side] = text;
  events.emit('state:lastSpeech', { side, value: text });
}