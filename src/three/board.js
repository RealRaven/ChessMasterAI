
/* ================================================================
   board.js — alternating tiles, border frame, and rank/file labels.
   Tiles live in a rebuildable group so theme swaps replace their
   materials; labels are static CSS2DObjects built once.
   ================================================================ */

import { CONFIG } from '../config.js';
import { getTheme } from './themes.js';

const TILE_HEIGHT   = 0.2;
const TILE_GAP      = 0.02;
const FRAME_PADDING = 0.35;
const LABEL_OFFSET  = 0.85;

/**
 * @returns {{ group: THREE.Group, applyTheme: (id: string) => void }}
 */
export function createBoard() {
  const root        = new THREE.Group();
  const tilesGroup  = new THREE.Group();
  const labelsGroup = new THREE.Group();
  root.add(tilesGroup, labelsGroup);

  let currentThemeId = 'classic';

  /* ---------- Tiles + frame ---------- */
  function buildTiles() {
    while (tilesGroup.children.length) tilesGroup.remove(tilesGroup.children[0]);

    const theme = getTheme(currentThemeId);
    const size  = CONFIG.board.size;
    const tile  = CONFIG.board.tileSize;
    const off   = CONFIG.board.offset;

    for (let rank = 0; rank < size; rank++) {
      for (let file = 0; file < size; file++) {
        const isLight = (rank + file) % 2 === 0;
        const color = isLight ? theme.tiles.light : theme.tiles.dark;

        const geo = new THREE.BoxGeometry(
          tile - TILE_GAP,
          TILE_HEIGHT,
          tile - TILE_GAP
        );
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: theme.tiles.roughness,
          metalness: theme.tiles.metalness,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.position.set(
          (file - off) * tile,
          TILE_HEIGHT / 2 - 0.1,   // top of tile at y = CONFIG.board.pieceLiftY
          (rank - off) * tile
        );
        tilesGroup.add(mesh);
      }
    }

    /* Frame */
    const frameGeo = new THREE.BoxGeometry(
      size * tile + FRAME_PADDING * 2,
      0.25,
      size * tile + FRAME_PADDING * 2
    );
    const frameMat = new THREE.MeshStandardMaterial({
      color: theme.frame.color,
      roughness: theme.frame.roughness,
      metalness: theme.frame.metalness,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.receiveShadow = true;
    frame.position.y = -0.14;
    tilesGroup.add(frame);
  }

  /* ---------- A-H and 1-8 labels ---------- */
  function buildLabels() {
    const theme = getTheme(currentThemeId);
    const off   = CONFIG.board.offset;

    const style = `
      color:${theme.labelColor};
      font: 600 14px 'Segoe UI', system-ui, sans-serif;
      text-shadow: 0 0 6px rgba(0,0,0,0.7);
      pointer-events: none;
      user-select: none;
    `;

    /* Files: a..h along the near edge (z = +off + LABEL_OFFSET) */
    for (let i = 0; i < 8; i++) {
      const div = document.createElement('div');
      div.textContent = String.fromCharCode(65 + i);
      div.style.cssText = style;
      const obj = new THREE.CSS2DObject(div);
      obj.position.set((i - off) * 1, 0.15, off + LABEL_OFFSET);
      labelsGroup.add(obj);
    }

    /* Ranks: 1..8 along the left edge (x = -off - LABEL_OFFSET) */
    for (let i = 0; i < 8; i++) {
      const div = document.createElement('div');
      div.textContent = String(i + 1);
      div.style.cssText = style;
      const obj = new THREE.CSS2DObject(div);
      obj.position.set(-off - LABEL_OFFSET, 0.15, (i - off) * 1);
      labelsGroup.add(obj);
    }
  }

  /* ---------- Public ---------- */
  buildTiles();
  buildLabels();

  function applyTheme(themeId) {
    if (themeId === currentThemeId) return;
    currentThemeId = themeId;

    /* Labels need a rebuild to pick up the new colour. Rebuild both. */
    while (labelsGroup.children.length) labelsGroup.remove(labelsGroup.children[0]);
    buildTiles();
    buildLabels();
  }

  return { group: root, applyTheme };
}