/* ================================================================
   sfx.js — procedural Web Audio SFX.
   No audio files. Every sound is synthesized from oscillators.
   ================================================================ */

let ctx = null;
let muted = false;

/** Lazily create the AudioContext on first user gesture. */
function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Play a single oscillator tone.
 * @param {number} freq      Hz
 * @param {number} duration  seconds
 * @param {OscillatorType} type  'sine' | 'square' | 'sawtooth' | 'triangle'
 * @param {number} gain      peak gain (0..1)
 */
function playTone(freq, duration, type = 'sine', gain = 0.15) {
  if (muted) return;
  const c = ensureCtx();
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  amp.gain.setValueAtTime(gain, c.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(amp).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

export const SFX = {
  /** Piece placed on a square — soft two-tone click. */
  move() {
    playTone(440, 0.08, 'triangle', 0.10);
    setTimeout(() => playTone(550, 0.06, 'triangle', 0.08), 30);
  },

  /** Capture — lower, harsher. */
  capture() {
    playTone(200, 0.15, 'sawtooth', 0.20);
    setTimeout(() => playTone(150, 0.20, 'sawtooth', 0.15), 50);
  },

  /** Illegal move — buzzing error. */
  illegal() {
    playTone(150, 0.30, 'square', 0.20);
    setTimeout(() => playTone(120, 0.40, 'square', 0.15), 100);
  },

  /** Check — a rising two-note alarm. */
  check() {
    playTone(880, 0.15, 'sine', 0.20);
    setTimeout(() => playTone(1100, 0.20, 'sine', 0.15), 80);
  },

  /** Game over — ascending chime fanfare. */
  gameover() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => playTone(f, 0.40, 'sine', 0.15), i * 150)
    );
  },

  /** Toggle mute state. Returns the new state. */
  toggleMute() {
    muted = !muted;
    return muted;
  },

  isMuted() {
    return muted;
  },
};