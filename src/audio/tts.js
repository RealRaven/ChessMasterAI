/* ================================================================
   tts.js — Kokoro-82M TTS wrapper (Language Forced)
   ================================================================ */

import { KokoroTTS } from 'kokoro-js';

let tts = null;
let muted = false;
let audioCtx = null;

(async () => {
  try {
    console.log('[TTS] Loading Kokoro-82M model...');
    let device = 'wasm';
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) device = 'webgpu';
      } catch (e) {}
    }

    tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      { dtype: device === 'wasm' ? 'fp32' : 'q8', device }
    );
    console.log('[TTS] Kokoro-82M loaded and ready.');
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
    
    // Sanitize text: remove markdown asterisks, quotes, and weird unicode that confuses the phonemizer
    const cleanText = text.replace(/[*_#`"']/g, '').trim();
    
    console.log(`[TTS] Generating audio for: "${cleanText}" with voice: ${voice}`);
    
    // Force English language and use the sanitized text
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