/* ================================================================
   emotions.js — shared vocabulary + default procedural reactions.
   Kept separate so the manager, UI, and both avatar types reference
   the same constant list.
   ================================================================ */

export const EMOTIONS = ['confident', 'nervous', 'thinking', 'triumphant'];

export const DEFAULT_EMOTION = 'confident';

export function normalizeEmotion(input) {
  return EMOTIONS.includes(input) ? input : DEFAULT_EMOTION;
}