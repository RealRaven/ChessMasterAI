/* ================================================================
   coords.js — square ↔ world coordinate conversions.
   Shared by board, pieces, animator, camera, and vision-capture.
   ================================================================ */

import { CONFIG } from '../config.js';

const { size, tileSize, offset } = CONFIG.board;

const FILE_A = 'a'.charCodeAt(0);

/**
 * Convert a chess square string (e.g. "e4") to a world-space {x, z}
 * coordinate on the board plane. Rank 1 = bottom of board (larger z in
 * our world since White sits at -z facing +z).
 *
 * @param {string} square e.g. "a1", "h8"
 * @returns {{x: number, z: number}}
 */
export function squareToWorld(square) {
  const file = square.charCodeAt(0) - FILE_A;  // a=0 … h=7
  const rank = parseInt(square[1], 10) - 1;    // 1=0 … 8=7
  return {
    x: (file - offset) * tileSize,
    z: (rank - offset) * tileSize,
  };
}

/**
 * Inverse of squareToWorld — snap a world (x, z) to the nearest square.
 * Returns null if the point lies outside the 8×8 board.
 *
 * @param {number} x
 * @param {number} z
 * @returns {string|null}
 */
export function worldToSquare(x, z) {
  const file = Math.round(x / tileSize + offset);
  const rank = Math.round(z / tileSize + offset);
  if (file < 0 || file >= size || rank < 0 || rank >= size) return null;
  return String.fromCharCode(FILE_A + file) + (rank + 1);
}

/**
 * Y coordinate at which a piece mesh should sit above its tile.
 */
export const PIECE_Y = CONFIG.board.pieceLiftY;