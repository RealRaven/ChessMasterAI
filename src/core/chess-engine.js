/* ================================================================
   chess-engine.js — thin wrapper around chess.js.
   Pure: no DOM, no events, no Three.js. All game-rule queries and
   the single commit path for validated moves live here.
   ================================================================ */

/** @type {Chess|null} */
let game = null;

/* ------------------------------------------------------------------
   Lifecycle
   ------------------------------------------------------------------ */

/**
 * Start a brand-new game from the standard starting position.
 * @returns {Chess} the fresh game instance
 */
export function newGame() {
  game = new Chess();
  return game;
}

/**
 * Ensure a game exists — lazily create one if needed.
 * Every getter goes through this so callers can't hit null.
 */
function ensureGame() {
  if (!game) newGame();
  return game;
}

/** Reset to no-game state (next call to a getter creates a fresh one). */
export function reset() {
  game = null;
}

/** Direct access to the underlying chess.js instance (for pgn/history). */
export function getGame() {
  return ensureGame();
}

/* ------------------------------------------------------------------
   Query — the shape the referee, prompt-builder, and UI consume
   ------------------------------------------------------------------ */

/** @returns {string} current FEN */
export function getFen() {
  return ensureGame().fen();
}

/** @returns {'w'|'b'} whose turn it is */
export function getTurn() {
  return ensureGame().turn();
}

/** @returns {string[]} every legal SAN move for the active side */
export function getLegalMoves() {
  return ensureGame().moves();
}

/** @returns {Array<Array<{type,color}|null>>} 8×8 board matrix */
export function getBoard() {
  return ensureGame().board();
}

/** @returns {Array<object>} verbose move history */
export function getHistory() {
  return ensureGame().history({ verbose: true });
}

/** @returns {string} PGN of the game so far */
export function getPgn() {
  return ensureGame().pgn();
}

/* ------------------------------------------------------------------
   Terminal-state queries
   ------------------------------------------------------------------ */

export function isGameOver() {
  return ensureGame().game_over();
}

export function isCheck() {
  return ensureGame().in_check();
}

export function isCheckmate() {
  return ensureGame().in_checkmate();
}

export function isStalemate() {
  return ensureGame().in_stalemate();
}

export function isDraw() {
  return ensureGame().in_draw();
}

/**
 * Classify the terminal state into a { type, winner, message } object.
 * Only meaningful once isGameOver() === true.
 */
export function getGameOverReason() {
  const g = ensureGame();

  if (g.in_checkmate()) {
    const winner = g.turn() === 'w' ? 'black' : 'white';
    return {
      type: 'checkmate',
      winner,
      message: `Checkmate — ${winner === 'white' ? 'White' : 'Black'} wins!`,
    };
  }
  if (g.in_stalemate()) {
    return { type: 'stalemate', winner: null, message: 'Stalemate — draw.' };
  }
  if (g.in_threefold_repetition()) {
    return { type: 'threefold', winner: null, message: 'Draw by threefold repetition.' };
  }
  if (g.insufficient_material()) {
    return { type: 'material', winner: null, message: 'Draw by insufficient material.' };
  }
  if (g.in_draw()) {
    return { type: 'fifty-move', winner: null, message: 'Draw by the 50-move rule.' };
  }
  return { type: 'unknown', winner: null, message: 'Game over.' };
}

/* ------------------------------------------------------------------
   Commit — the ONLY mutation path for the board.
   Referee approves first (on a clone); game-loop calls this to
   actually advance the game. Returns chess.js's move object or null.
   ------------------------------------------------------------------ */

/**
 * @param {string} candidate — SAN or coordinate notation
 * @returns {object|null} chess.js verbose move result, or null if illegal
 */
export function commit(candidate) {
  const g = ensureGame();
  try {
    return g.move(candidate, { sloppy: true });
  } catch {
    return null;
  }
}

/**
 * Pure legality probe on a clone of the current position.
 * Does NOT mutate the real game. Used by referee for validation.
 *
 * @param {string} candidate — raw candidate move string
 * @returns {{ ok: boolean, san: string|null, reason: string }}
 */
export function probe(candidate) {
  const g = ensureGame();
  const clone = new Chess(g.fen());
  try {
    const result = clone.move(candidate, { sloppy: true });
    if (!result) return { ok: false, san: null, reason: 'illegal' };
    return { ok: true, san: result.san, reason: 'legal' };
  } catch {
    return { ok: false, san: null, reason: 'parse-error' };
  }
}