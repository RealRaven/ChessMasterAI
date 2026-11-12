/* ================================================================
   tts.js — speechSynthesis wrapper with per-side pitch/rate.
   Handles missing OS voices or browser support gracefully.
   ================================================================ */

let muted = false;
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

export function speak(text, side = 'white') {
  // Guard clause: check for API support before doing anything
  if (muted || !text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return;
  }

  // Cancel any in-flight utterance so lines don't queue up.
  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.pitch = side === 'white' ? 1.2 : 0.8;
  utter.rate = side === 'white' ? 1.05 : 0.95;
  utter.volume = 0.9;

  if (voices.length > 0) {
    utter.voice = side === 'white'
      ? voices[0]
      : voices[Math.min(1, voices.length - 1)];
  }

  speechSynthesis.speak(utter);
}

export const TTS = {
  speak,
  isSupported() {
    return 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  },
  toggleMute() {
    muted = !muted;
    if (muted && 'speechSynthesis' in window) speechSynthesis.cancel();
    return muted;
  },
  isMuted() {
    return muted;
  },
};