/* ================================================================
   game-loop.js — turn orchestration.

   Public API:
     play(deps)   — run turn after turn until paused / game over
     pause()      — finish the current turn, then stop
     step(deps)   — execute exactly one turn while paused
     reset()      — start a fresh game

   Dependencies (injected so tests and the real app share one path):
     deps.callAI(opts)         — REQUIRED. The LLM round-trip.
     deps.onCommit(moveData)   — OPTIONAL. Post-commit hook (animator).
     deps.onGameOver(reason)   — OPTIONAL. Game-over hook (fanfare).

   Emits:
     ai:thinking            — { turn, side, attempt }
     move:committed         — full move + speech + override flag
     game:over              — { type, winner, message }
     game:reset             — {}
     game:error             — { message, error }
   ================================================================ */

import * as engine from './chess-engine.js';
import * as referee from './referee.js';
import { events } from './events.js';
import {
  state,
  setGameState,
  setTurn,
  setLastMove,
  consumeWhisper,
  setLastSpeech,
} from './state.js';

/* Internal flags — prevent overlapping loops */
let running = false;
let stopping = false;

/* ------------------------------------------------------------------
   One turn
   ------------------------------------------------------------------ */

async function tick(deps) {
  if (engine.isGameOver()) return;

  const turn = engine.getTurn();
  const side = turn === 'w' ? 'white' : 'black';
  const fen = engine.getFen();
  const legalMoves = engine.getLegalMoves();
  const whisper = consumeWhisper(); // one-shot hint for this turn

  /* ---- 1. Ask the referee to obtain a validated move ---- */
  let result;
  try {
    result = await referee.requestMove({
      fen,
      legalMoves,
      callAI: async (ctx) => {
        events.emit('ai:thinking', { turn, side, attempt: ctx.attempt });
        return await deps.callAI({
          fen: ctx.fen,
          legalMoves: ctx.legalMoves,
          turn, // <--- FIXED: Use local turn instead of ctx.turn
          side, // <--- FIXED: Use local side instead of ctx.side
          attempt: ctx.attempt,
          previousRejection: ctx.previousRejection,
          whisper,
        });
      },
    });
  } catch (err) {
    console.error('[game-loop] referee failure:', err);
    events.emit('game:error', {
      message: err?.message || 'referee failure',
      error: err,
    });
    return;
  }

  /* ---- 2. Commit the approved move to the real game ---- */
  const commit = engine.commit(result.move);
  if (!commit) {
    events.emit('game:error', {
      message: `Referee approved "${result.move}" but engine rejected it — desync bug.`,
      error: new Error('commit-failed'),
    });
    return;
  }

  /* ---- 3. Update UI-facing state ---- */
  setTurn(engine.getTurn());

  const moveData = {
    from: commit.from,
    to: commit.to,
    san: commit.san,
    color: turn,
    piece: commit.piece,
    captured: commit.captured || null,
    isKnight: commit.piece === 'n',
    // Enriched for consumers
    speech: result.speech,
    emotion: result.emotion,
    wasOverride: result.wasOverride,
    attempts: result.attempts,
    rejectedMoves: result.rejectedMoves,
  };

  setLastMove(moveData);
  setLastSpeech(side, result.speech || '');

  events.emit('move:committed', moveData);

  /* ---- 4. Let the animator drive the next tick's timing ---- */
  if (typeof deps.onCommit === 'function') {
    try {
      await deps.onCommit(moveData);
    } catch (err) {
      console.error('[game-loop] onCommit hook threw:', err);
    }
  }

  /* ---- 5. Terminal check ---- */
  if (engine.isGameOver()) {
    const reason = engine.getGameOverReason();
    state.gameOverReason = reason;
    setGameState('gameover');
    events.emit('game:over', reason);
    if (typeof deps.onGameOver === 'function') {
      try {
        await deps.onGameOver(reason);
      } catch (err) {
        console.error('[game-loop] onGameOver hook threw:', err);
      }
    }
  }
}

/* ------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------ */

/**
 * Run turn after turn until pause() is called or the game ends.
 * Safe to call when already running — it returns immediately.
 *
 * @param {object} deps — see module header
 */
export async function play(deps) {
  if (running) return;
  if (engine.isGameOver()) return;

  running = true;
  stopping = false;
  setGameState('playing');

  try {
    while (!stopping && !engine.isGameOver()) {
      await tick(deps);
    }
  } finally {
    running = false;
    if (engine.isGameOver()) {
      setGameState('gameover');
    } else {
      setGameState('paused');
    }
  }
}

/**
 * Request a graceful stop. The current in-flight turn finishes,
 * then the loop exits and emits `state:game` → 'paused'.
 */
export function pause() {
  stopping = true;
}

/**
 * Execute exactly one turn while paused. No-op if already running.
 *
 * @param {object} deps — see module header
 */
export async function step(deps) {
  if (running) return;
  if (engine.isGameOver()) return;

  running = true;
  setGameState('playing');

  try {
    await tick(deps);
  } finally {
    running = false;
    if (!engine.isGameOver()) {
      setGameState('paused');
    } else {
      setGameState('gameover');
    }
  }
}

/**
 * Hard reset — new game, cleared state, paused at "idle".
 * Emits `game:reset` so the board, HUD, and avatars can rebuild.
 */
export function reset() {
  running = false;
  stopping = true;
  engine.newGame();

  state.gameState = 'idle';
  state.turn = 'w';
  state.lastMove = null;
  state.whisper = null;
  state.gameOverReason = null;
  state.lastSpeech.white = '';
  state.lastSpeech.black = '';

  events.emit('game:reset');
}