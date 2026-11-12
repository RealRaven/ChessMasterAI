/* ================================================================
   config.js — single source of truth for defaults.
   Everything tunable that shouldn't be scattered across modules
   lives here: models, personalities, camera presets, board geometry.
   ================================================================ */

export const CONFIG = {
  /** Board geometry (world units) */
  board: {
    size: 8,
    tileSize: 1,
    offset: 3.5,        // (8 - 1) / 2 — used by coords.squareToWorld()
    pieceLiftY: 0.1,    // Y offset of every piece above the tile surface
  },

  /** Default Ollama model tags (overridable in the HUD) */
  defaultModels: {
    white: 'qwen3.5:9b',
    black: 'gemma4:e4b',
  },

  /** Ollama chat endpoint. Change for a remote box. */
  ollamaEndpoint: 'http://localhost:11434/api/chat',

  /** Referee: how many retries before we invoke the fallback override. */
  maxRetries: 3,

  /** Snapshot format. Must be image/png to match the README's
      browser-memory-only privacy guarantee. */
  snapshotFormat: 'image/png',
  snapshotWidth: 512,
  snapshotHeight: 512,
  snapshotQuality: 0.85,   // ignored for PNG, kept for future format swaps

  /** Personality system prompts — injected as the "system" role. */
  personalities: {
    trash:
      'You are a trash-talking chess grandmaster. Be witty, arrogant, ' +
      'and condescending, but keep it to at most two short sentences. ' +
      'Mock your opponent when you can. Never break character.',
    polite:
      'You are a polite philosopher. Speak with grace, wisdom, and ' +
      'humility. Offer brief reflections on the position. ' +
      'Maximum two short sentences.',
    chaotic:
      'You are a chaotic gremlin. Be unpredictable, mischievous, and ' +
      'weird. Slip in odd metaphors and playful threats. ' +
      'Maximum two short sentences.',
  },

  /** Camera presets — position (x,y,z) + orbit target (x,y,z). */
  cameraPresets: {
    free:     { pos: [6, 7, 6],       target: [0, 0, 0] },
    overhead: { pos: [0, 10, 0.01],   target: [0, 0, 0] },
    white:    { pos: [0, 5.5, -6.5],  target: [0, 0.4, 0] },
    black:    { pos: [0, 5.5, 6.5],   target: [0, 0.4, 0] },
  },

  /** Available theme IDs — keys must exist in src/three/themes.js. */
  themeIds: ['classic', 'cyberpunk', 'marble'],

  /** Avatar seat positions (world units). */
  avatarSeats: {
    white: [0, 0, -5.5],
    black: [0, 0, 5.5],
  },

  /** Chess.js colour tokens. */
  colors: { white: 'w', black: 'b' },
};