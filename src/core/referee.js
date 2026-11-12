/* ================================================================
   referee.js — the anti-hallucination layer.

   Responsibilities:
     1. Ask the active AI for a move via an injected `callAI`.
     2. Normalize the response and validate it against a *clone* of
        the current position (pure — never mutates the real game).
     3. On illegal/unparseable output, re-prompt with explicit
        feedback and the up-to-date allowlist.
     4. After `maxRetries` failures, pick a random legal move and
        mark the result as an override.

   The referee NEVER commits. It returns a plan; game-loop executes.
   This keeps referee pure and testable.
   ================================================================ */

import { CONFIG } from '../config.js';
import { events } from './events.js';
import * as engine from './chess-engine.js';

/**
 * Strip whitespace and stray punctuation from a raw AI move string.
 * Keeps letters, digits, and the chess notation symbols = + # -.
 *
 * @param {any} raw
 * @returns {string}
 */
export function normalizeMove(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^a-zA-Z0-9=+#-]/g, '');
}

/**
 * Request a validated move from an AI.

 * @param {object} opts
 * @param {string} opts.fen                — position FEN (must match the real game)
 * @param {string[]} opts.legalMoves       — allowlist for the active side
 * @param {(ctx: {attempt: number, previousRejection: object|null, legalMoves: string[], fen: string}) => Promise<{move:string, speech:string, emotion:string}>} opts.callAI
 * @param {number} [opts.maxRetries=CONFIG.maxRetries]
 *
 * @returns {Promise<{
 *   ok: true,
 *   move: string,
 *   speech: string,
 *   emotion: string,
 *   attempts: number,
 *   rejectedMoves: Array<{move:string, reason:string}>,
 *   wasOverride: boolean,
 * }>}
 */
export async function requestMove({
  fen,
  legalMoves,
  callAI,
  maxRetries = CONFIG.maxRetries,
}) {
  const rejectedMoves = [];
  let previousRejection = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    events.emit('referee:attempt', { attempt, maxRetries });

    /* ---- 1. Call the AI (errors count as a failed attempt) ---- */
    let response;
    try {
      response = await callAI({
        attempt,
        previousRejection,
        legalMoves,
        fen,
      });
    } catch (err) {
      events.emit('referee:error', {
        attempt,
        message: err?.message || 'unknown error',
      });
      rejectedMoves.push({ move: null, reason: 'api-error' });
      previousRejection = { move: null, reason: 'api-error' };
      continue;
    }

    /* ---- 2. Normalize ---- */
    const candidate = normalizeMove(response?.move);
    const speech = String(response?.speech || '').slice(0, 240);
    const emotion = ['confident', 'nervous', 'thinking', 'triumphant'].includes(response?.emotion)
      ? response.emotion
      : 'confident';

    if (!candidate) {
      events.emit('referee:illegal', {
        move: response?.move ?? '(empty)',
        reason: 'empty',
        attempt,
      });
      rejectedMoves.push({ move: response?.move ?? '(empty)', reason: 'empty' });
      previousRejection = { move: response?.move ?? '(empty)', reason: 'empty' };
      continue;
    }

    /* ---- 3. Validate on a clone ---- */
    const probe = engine.probe(candidate);

    if (probe.ok) {
      events.emit('referee:legal', {
        move: candidate,
        san: probe.san,
        attempt,
      });
      return {
        ok: true,
        move: candidate,
        speech,
        emotion,
        attempts: attempt,
        rejectedMoves,
        wasOverride: false,
      };
    }

    /* ---- 4. Reject and retry ---- */
    events.emit('referee:illegal', {
      move: candidate,
      reason: probe.reason,
      attempt,
    });
    rejectedMoves.push({ move: candidate, reason: probe.reason });
    previousRejection = { move: candidate, reason: probe.reason };
  }

  /* ---- 5. Fallback after retries exhausted ---- */
  const fallbackMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  events.emit('referee:override', {
    move: fallbackMove,
    attempts: maxRetries,
    rejectedMoves,
  });

  return {
    ok: true,
    move: fallbackMove,
    speech:
      `[Referee Override] Fine — ${fallbackMove}. ` +
      `The referee forced my hand after ${maxRetries} illegal attempts.`,
    emotion: 'nervous',
    attempts: maxRetries,
    rejectedMoves,
    wasOverride: true,
  };
}