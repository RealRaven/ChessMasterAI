/* ================================================================
   tts.js — Kokoro-82M TTS wrapper (WebGPU + WASM Fallback)
   ================================================================ */

import { KokoroTTS } from 'kokoro-js';

let tts = null;
let muted = false;
let audioCtx = null;

(async () => {
  try {
    console.log('[TTS] Loading Kokoro-82M model...');
    
    let device = 'wasm';
    let dtype = 'q8'; // Optimized for WASM/CPU

    // Check if WebGPU is actually usable
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          device = 'webgpu';
          dtype = 'fp32'; // WebGPU requires fp32 for correct audio generation
          console.log('[TTS] WebGPU adapter found. Using GPU acceleration.');
        } else {
          console.log('[TTS] WebGPU supported but no adapter found. Falling back to WASM.');
        }
      } catch (e) {
        console.warn('[TTS] WebGPU adapter request failed, falling back to WASM', e);
      }
    } else {
      console.log('[TTS] WebGPU not supported in this browser. Using WASM.');
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

export async function speak(text, side = 'white') {
  if (muted || !text || !tts) return;

  try {
    unlockAudio();

    const voice = side === 'white' ? 'af_sky' : 'am_adam';
    const cleanText = text.replace(/[*_#`"']/g, '').trim();
    
    console.log(`[TTS] Generating audio for: "${cleanText}" with voice: ${voice}`);
    
    const audio = await tts.generate(cleanText, { 
      voice: voice,
      lang: "en-us" 
    });
    
    const wavBuffer = audio.toWav();
    
    audioCtx.decodeAudioData(wavBuffer, (buffer) => {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0; 
      
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      source.start(0);
      console.log('[TTS] Playback started.');
    }, (err) => {
      console.error('[TTS] Error decoding WAV data:', err);
    });
    
  } catch (err) {
    console.error('[TTS] Generation or playback failed:', err);
  }
}

export const TTS = {
  speak,
  isSupported() { return typeof WebAssembly === 'object'; },
  toggleMute() {
    muted = !muted;
    if (muted && audioCtx) audioCtx.suspend();
    else if (!muted && audioCtx) audioCtx.resume();
    return muted;
  },
  isMuted() { return muted; },
};