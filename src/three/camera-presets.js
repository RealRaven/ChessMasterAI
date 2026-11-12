/* ================================================================
   camera-presets.js — smooth transitions to named camera poses.
   ================================================================ */

import { CONFIG } from '../config.js';

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.OrbitControls} controls
 */
export function createCameraController(camera, controls) {
  let animating = false;
  let cancelFn = null;

  /**
   * Smoothly move the camera and controls target to a new pose.
   * Any in-flight transition is cancelled.
   *
   * @param {[number,number,number]} pos
   * @param {[number,number,number]} target
   * @param {number} [duration=900]
   * @returns {Promise<void>}
   */
  function moveTo(pos, target, duration = 900) {
    if (cancelFn) cancelFn();
    animating = true;

    const startPos    = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos      = new THREE.Vector3(...pos);
    const endTarget   = new THREE.Vector3(...target);

    return new Promise((resolve) => {
      const t0 = performance.now();
      let cancelled = false;
      cancelFn = () => { cancelled = true; resolve(); };

      function tick(now) {
        if (cancelled) return;
        const t = Math.min((now - t0) / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(startPos, endPos, eased);
        controls.target.lerpVectors(startTarget, endTarget, eased);
        controls.update();

        if (t < 1) requestAnimationFrame(tick);
        else {
          animating = false;
          cancelFn = null;
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  /**
   * @param {'free'|'overhead'|'white'|'black'} id
   */
  function applyPreset(id) {
    const preset = CONFIG.cameraPresets[id];
    if (!preset) return Promise.resolve();
    return moveTo(preset.pos, preset.target);
  }

  return { moveTo, applyPreset, isAnimating: () => animating };
}