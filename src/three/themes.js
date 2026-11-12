/* ================================================================
   themes.js — visual definitions for each board theme.
   The Three.js scene reads these to build materials, fog, and lights;
   src/styles/themes.css mirrors the CSS-variable side so the HUD and
   the 3D scene never disagree.
   ================================================================ */

export const THEMES = {
  classic: {
    id: 'classic',
    label: 'Classic Wood',
    bg: 0x1a120b,
    fogDensity: 0.028,
    ambient:   { color: 0x404060, intensity: 1.15 },
    directional: { color: 0xfff4e0, intensity: 1.5, pos: [5, 10, 7] },
    fill:      { color: 0x4466ff, intensity: 0.5,  pos: [-5, 5, -5] },
    tiles: {
      light: 0xd4b896, dark: 0x6b4226,
      roughness: 0.65, metalness: 0.15,
    },
    frame: { color: 0x3d2b1f, roughness: 0.8, metalness: 0.25 },
    labelColor: '#c8b89a',
  },

  cyberpunk: {
    id: 'cyberpunk',
    label: 'Cyberpunk Neon',
    bg: 0x050510,
    fogDensity: 0.022,
    ambient:   { color: 0x0a2244, intensity: 1.0 },
    directional: { color: 0x88eeff, intensity: 1.3, pos: [5, 10, 7] },
    fill:      { color: 0xff006e, intensity: 0.7,  pos: [-5, 5, -5] },
    tiles: {
      light: 0x00a0cc, dark: 0x1a0033,
      roughness: 0.25, metalness: 0.85,
    },
    frame: { color: 0x000000, roughness: 0.15, metalness: 1.0 },
    labelColor: '#00f0ff',
  },

  marble: {
    id: 'marble',
    label: 'Marble & Obsidian',
    bg: 0x1a1a1a,
    fogDensity: 0.02,
    ambient:   { color: 0x555566, intensity: 1.4 },
    directional: { color: 0xffffff, intensity: 1.6, pos: [5, 10, 7] },
    fill:      { color: 0x8888ff, intensity: 0.35, pos: [-5, 5, -5] },
    tiles: {
      light: 0xf0f0f0, dark: 0x0a0a0a,
      roughness: 0.35, metalness: 0.4,
    },
    frame: { color: 0x222222, roughness: 0.2, metalness: 0.7 },
    labelColor: '#d0d0d0',
  },
};

export function getTheme(id) {
  return THEMES[id] || THEMES.classic;
}