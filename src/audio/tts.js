/* ================================================================
   tts.js — Kokoro-82M TTS wrapper.
   Runs 100% locally in the browser via kokoro-js.
   ================================================================ */

import { KokoroTTS } from 'kokoro-js';

let tts = null;
let muted = false;

// Load the model asynchronously on module import.
// Using the quantized 'q8' model keeps the download around 86MB.
(async () => {
  try {
    console.log('[TTS] Loading Kokoro-82M model...');
    tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      { dtype: "q8", device: "wasm" } // 'wasm' is universally supported; 'webgpu' is faster if available
    );
    console.log('[TTS] Kokoro-82M loaded and ready.');
  } catch (err) {
    console.error('[TTS] Failed to load Kokoro model:', err);
  }
})();

export async function speak(text, side = 'white') {
  if (muted || !text || !tts) return;

  try {
    // Assign distinct voices for White and Black
    const voice = side === 'white' ? 'af_sky' : 'am_adam';

    // Generate the audio
    const audio = await tts.generate(text, { voice });

    // Play it using the Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createBufferSource();
    source.buffer = audio.toAudioBuffer(audioCtx);
    source.connect(audioCtx.destination);
    source.start();
  } catch (err) {
    console.error('[TTS] Generation failed:', err);
  }
}

export const TTS = {
  speak,
  isSupported() {
    // Kokoro runs entirely in the browser, so it's supported as long as WebAssembly is.
    return typeof WebAssembly === 'object';
  },
  toggleMute() {
    muted = !muted;
    return muted;
  },
  isMuted() {
    return muted;
  },
};