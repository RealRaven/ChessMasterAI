/* ================================================================
   tts.js — Kokoro-82M TTS wrapper (WebGPU + Silent Cache Patch)
   ================================================================ */

import { KokoroTTS } from 'kokoro-js';

// --- 1. Globally patch the Cache API to fail silently ---
// kokoro-js tries to save the model to the browser cache. If Chrome
// blocks it (sandbox/disk limit), it throws an ugly red error.
// We intercept caches.open and caches.put to swallow these.
if (typeof caches !== 'undefined') {
  const originalOpen = caches.open;
  caches.open = async function (name) {
    const cache = await originalOpen.call(this, name);
    if (!cache._patched) {
      const originalPut = cache.put;
      cache.put = async function (req, res) {
        try {
          return await originalPut.call(this, req, res);
        } catch (err) {
          return undefined; // Silently ignore cache write failures
        }
      };
      cache._patched = true;
    }
    return cache;
  };
}

// --- 2. Filter console warnings/errors ---
const originalWarn = console.warn;
const originalError = console.error;

function shouldFilter(msg) {
  const str = typeof msg === 'string' ? msg : '';
  return (
    str.includes('VerifyEachNodeIsAssignedToAnEp') ||
    str.includes('Some nodes were not assigned to the preferred execution providers') ||
    str.includes('Unable to add response to browser cache')
  );
}

console.warn = function (...args) {
  if (args.some(shouldFilter)) return;
  originalWarn.apply(console, args);
};

console.error = function (...args) {
  if (args.some(shouldFilter)) return;
  originalError.apply(console, args);
};

// --- 3. Try to disable cache natively ---
if (typeof window !== 'undefined' && window.env) {
  window.env.useBrowserCache = false;
  window.env.userBrowserCache = false;
}

let tts = null;
let muted = false;
let audioCtx = null;
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