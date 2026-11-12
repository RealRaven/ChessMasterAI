/* ================================================================
   animator.js — tweens a single piece mesh between two squares.
   Knights hop; everything else slides. Captures are handled by the
   caller (remove the destination mesh before animating).
   ================================================================ */

import { squareToWorld, PIECE_Y } from '../utils/coords.js';

/**
 * Animate `mesh` from square `from` to square `to`.
 *
 * @param {THREE.Object3D} mesh
 * @param {string} from
 * @param {string} to
 * @param {object} [opts]
 * @param {boolean} [opts.isKnight=false]
 * @param {number}  [opts.duration=380]
 * @returns {Promise<void>}
 */
export function animateMove(mesh, from, to, opts = {}) {
  const { isKnight = false, duration = 380 } = opts;

  if (!mesh) return Promise.resolve();

  const start = squareToWorld(from);
  const end   = squareToWorld(to);

  const sx = start.x, sz = start.z;
  const ex = end.x,   ez = end.z;
  const arc = isKnight ? 0.9 : 0.14;

  return new Promise((resolve) => {
    const t0 = performance.now();

    function tick(now) {
      const t = Math.min((now - t0) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      mesh.position.x = sx + (ex - sx) * eased;
      mesh.position.z = sz + (ez - sz) * eased;
      mesh.position.y = PIECE_Y + Math.sin(t * Math.PI) * arc;

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        mesh.position.set(ex, PIECE_Y, ez);
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}