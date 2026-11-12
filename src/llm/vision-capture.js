/* ================================================================
   vision-capture.js — renders an overhead PNG snapshot of the
   Three.js scene to send to the vision model.

   PRIVACY GUARANTEE (see README):
     • The PNG is produced entirely in the browser.
     • It lives ONLY in browser memory as a base64 data URL.
     • It is NEVER written to disk, IndexedDB, localStorage, a
       service worker cache, or any remote server.
     • It is passed to Ollama's `images` array as a bare base64
       string and garbage-collected on the next turn.

   A dedicated 512×512 offscreen renderer is used so the user's
   main camera is never disturbed.
   ================================================================ */

import { CONFIG } from '../config.js';

/**
 * Create the offscreen snapshot renderer + overhead camera.
 * Call this ONCE at startup and pass the returned engine into
 * `captureSnapshot()` on every turn.
 *
 * @returns {{ renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera }}
 */
export function createSnapshotEngine() {
  if (typeof THREE === 'undefined') {
    throw new Error('vision-capture: THREE is not loaded');
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  renderer.setSize(CONFIG.snapshotWidth, CONFIG.snapshotHeight);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x0a0a1a, 1);

  const camera = new THREE.PerspectiveCamera(
    50,
    1,        // square
    0.1,
    50
  );
  camera.position.set(0, 8, 0.01);
  camera.lookAt(0, 0, 0);

  return { renderer, camera };
}

/**
 * Render the scene from the overhead camera and return the PNG.
 *
 * The returned object:
 *   { dataURL, base64, width, height }
 *
 * `dataURL` is the full `data:image/png;base64,...` string used by
 * the HUD preview thumbnail.
 *
 * `base64` is the bare payload (no prefix) used by Ollama's
 * `images` array.
 *
 * Both live only in RAM — this module never touches storage APIs.
 *
 * @param {{renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera}} engine
 * @param {THREE.Scene} scene
 * @returns {{ dataURL: string, base64: string, width: number, height: number }}
 */
export function captureSnapshot(engine, scene) {
  if (!engine) throw new Error('vision-capture: engine not initialized');
  if (!scene) throw new Error('vision-capture: scene is required');

  const { renderer, camera } = engine;

  /* Render synchronously, then read the framebuffer immediately.
     Doing both in the same call site avoids the need for
     preserveDrawingBuffer (which is slow and memory-hungry). */
  renderer.render(scene, camera);

  const format = CONFIG.snapshotFormat || 'image/png';
  const dataURL = renderer.domElement.toDataURL(format);

  const commaIndex = dataURL.indexOf(',');
  const base64 = commaIndex !== -1 ? dataURL.slice(commaIndex + 1) : '';

  return {
    dataURL,
    base64,
    width: CONFIG.snapshotWidth,
    height: CONFIG.snapshotHeight,
  };
}

/**
 * Dispose the offscreen renderer on shutdown / hot reload.
 * @param {{renderer: THREE.WebGLRenderer} | null} engine
 */
export function dispose(engine) {
  if (!engine?.renderer) return;
  try {
    engine.renderer.dispose();
    engine.renderer.forceContextLoss?.();
  } catch {
    /* ignore */
  }
}