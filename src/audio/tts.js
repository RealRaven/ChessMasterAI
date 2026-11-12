/* ================================================================
   tts.js — Kokoro-82M TTS wrapper (WebGPU + Cache/Log Fixes)
   ================================================================ */

import { KokoroTTS } from 'kokoro-js';

// --- 1. Patch the Cache API to ignore put() errors ---
if (typeof caches !== 'undefined' && caches?.default) {
  const originalPut = caches.default.put;
  caches.default.put = async function (request, response) {
    try {
      return await originalPut.call(this, request, response);
    } catch (err) {
      // Silently ignore cache write failures (e.g., UnknownError)
      return undefined;
    }
  };
}

// --- 2. Suppress the specific ONNX Runtime EP warnings ---
const originalWarn = console.warn;
console.warn = function (...args) {
  const msg = args.join(' ');
  if (
    msg.includes('VerifyEachNodeIsAssignedToAnEp') ||
    msg.includes('Some nodes were not assigned to the preferred execution providers')
  ) {
    return; // Drop these specific warnings
  }
  originalWarn.apply(console, args);
};

// --- 3. Try to set log level and disable browser cache globally ---
// (Kokoro-js bundles its own onnxruntime-web, but we can try the global)
if (typeof window !== 'undefined' && window.ort?.env) {
  window.ort.env.logLevel = 'error';
}
// Transformers.js env (may be exposed globally by kokoro-js)
if (typeof window !== 'undefined' && window.env) {
  window.env.useBrowserCache = false;
  window.env.userBrowserCache = false;
}

let tts = null;
let muted = false;
let audioCtx = null;

// --- Audio Queue State ---
let isSpeaking = false;
const speechQueue = [];

(async () => {
  try {
    console.log('[TTS] Loading Kokoro-82M model...');
    let device = 'wasm';
    let dtype = 'q8';

    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          device = 'webgpu';
          dtype = 'fp32';
          console.log('[TTS] WebGPU adapter found. Using GPU acceleration.');
        }
      } catch (e) {
        console.warn('[TTS] WebGPU adapter request failed, falling back to WASM');
      }
    }

    tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      { dtype: dtype, device: device }
    );
    console.log(`[TTS] Kokoro-82M loaded and ready on ${device}.`);
  } catch (err) {
    console.error('[TTS] Failed to load Kokoro model:', err);
  }
})();

export function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

async function processQueue() {
  if (isSpeaking || speechQueue.length === 0) return;

  isSpeaking = true;
  const { text, side, resolve } = speechQueue.shift();

  try {
    unlockAudio();
    const voice = side === 'white' ? 'af_sky' : 'am_adam';
    const cleanText = text.replace(/[*_#`"']/g, '').trim();

    if (!cleanText) {
      isSpeaking = false;
      resolve();
      processQueue();
      return;
    }

    console.log(`[TTS] Generating audio for: "${cleanText}"`);
    const audio = await tts.generate(cleanText, { voice, lang: "en-us" });
    const wavBuffer = audio.toWav();

    await new Promise((decodeResolve, reject) => {
      audioCtx.decodeAudioData(wavBuffer, (buffer) => {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        source.onended = () => {
          console.log('[TTS] Playback finished.');
          decodeResolve();
        };

        source.start(0);
        console.log('[TTS] Playback started.');
      }, (err) => {
        console.error('[TTS] Error decoding WAV data:', err);
        reject(err);
      });
    });

  } catch (err) {
    console.error('[TTS] Generation or playback failed:', err);
  } finally {
    resolve();
    isSpeaking = false;
    processQueue();
  }
}

export async function speak(text, side = 'white') {
  if (muted || !text || !tts) return Promise.resolve();

  return new Promise((resolve) => {
    speechQueue.push({ text, side, resolve });
    processQueue();
  });
}

export const TTS = {
  speak,
  isSupported() { return typeof WebAssembly === 'object'; },
  toggleMute() {
    muted = !muted;
    if (muted) {
      speechQueue.length = 0;
      if (audioCtx) audioCtx.suspend();
    } else {
      if (audioCtx) audioCtx.resume();
    }
    return muted;
  },
  isMuted() { return muted; },
};