/* ================================================================
   tts.js — Kokoro-82M TTS wrapper (WebGPU + Audio Queue)
   ================================================================ */

import { KokoroTTS } from 'kokoro-js';

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

// --- Queue Processor ---
async function processQueue() {
  if (isSpeaking || speechQueue.length === 0) return;

  isSpeaking = true;
  const { text, side } = speechQueue.shift();

  try {
    unlockAudio();
    
    const voice = side === 'white' ? 'af_sky' : 'am_adam';
    const cleanText = text.replace(/[*_#`"']/g, '').trim();
    
    if (!cleanText) {
        isSpeaking = false;
        processQueue(); // Skip empty text
        return;
    }

    console.log(`[TTS] Generating audio for: "${cleanText}"`);
    
    const audio = await tts.generate(cleanText, { voice, lang: "en-us" });
    const wavBuffer = audio.toWav();
    
    // Use a Promise to wait for the audio to finish playing
    await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(wavBuffer, (buffer) => {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0; 
        
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        source.onended = () => {
          console.log('[TTS] Playback finished.');
          resolve();
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
    // Mark as done and process the next item in the queue
    isSpeaking = false;
    processQueue();
  }
}

export async function speak(text, side = 'white') {
  if (muted || !text || !tts) return;
  speechQueue.push({ text, side });
  processQueue();
}

export const TTS = {
  speak,
  isSupported() { return typeof WebAssembly === 'object'; },
  toggleMute() {
    muted = !muted;
    if (muted) {
      speechQueue.length = 0; // Clear pending queue
      if (audioCtx) audioCtx.suspend();
    } else {
      if (audioCtx) audioCtx.resume();
    }
    return muted;
  },
  isMuted() { return muted; },
};