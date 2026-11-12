/* ================================================================
   prompt-builder.js — assemble the system + user messages for the
   Ollama /api/chat call. This is where the *contract* with the model
   lives: exactly what it must return, and how the referee's
   re-prompt feedback is injected after an illegal attempt.
   ================================================================ */

import { CONFIG } from '../config.js';

/**
 * Build the full messages array for Ollama.
 *
 * @param {object} opts
 * @param {'trash'|'polite'|'chaotic'} opts.personality
 * @param {'white'|'black'} opts.side
 * @param {string} opts.fen
 * @param {string[]} opts.legalMoves
 * @param {string} [opts.opponentLastMessage]
 * @param {string|null} [opts.whisper]           — one-shot coach hint
 * @param {{move:string, reason:string}|null} [opts.previousRejection]
 * @param {string|null} [opts.imageBase64]       — bare base64 (no data URL prefix)
 * @returns {Array<object>} messages
 */
export function buildMessages({
  personality,
  side,
  fen,
  legalMoves,
  opponentLastMessage,
  whisper,
  previousRejection,
  imageBase64,
}) {
  const sideName = side === 'white' ? 'White' : 'Black';
  const system = buildSystemPrompt(personality, sideName);
  const userText = buildUserPrompt({
    fen,
    legalMoves,
    sideName,
    opponentLastMessage,
    whisper,
    previousRejection,
  });

  const userMessage = { role: 'user', content: userText };
  if (imageBase64) userMessage.images = [imageBase64];

  return [
    { role: 'system', content: system },
    userMessage,
  ];
}

/* ------------------------------------------------------------------
   System prompt — personality + strict JSON contract
   ------------------------------------------------------------------ */

function buildSystemPrompt(personalityKey, sideName) {
  const personality =
    CONFIG.personalities[personalityKey] || CONFIG.personalities.trash;

  return `${personality}

You are playing chess as ${sideName}. Each turn you receive:
  • the current board position (FEN)
  • a strict allowlist of legal moves for this turn
  • a PNG snapshot of the board viewed from above

You MUST reply with a single JSON object and nothing else, matching
exactly this shape:

  { "move": "<one SAN move from the allowlist>",
    "speech": "<max 2 sentences of character banter>",
    "emotion": "<confident | nervous | thinking | triumphant>" }

Rules:
- "move" MUST be one of the entries in the allowlist, verbatim.
- Never include commentary outside the JSON object.
- Never invent a move that is not in the allowlist.
- "speech" is spoken aloud to the audience, so keep it short.`;
}

/* ------------------------------------------------------------------
   User prompt — position, allowlist, context, rejection feedback
   ------------------------------------------------------------------ */

function buildUserPrompt({
  fen,
  legalMoves,
  sideName,
  opponentLastMessage,
  whisper,
  previousRejection,
}) {
  const lines = [
    `You are ${sideName}.`,
    `Current FEN: ${fen}`,
    `Legal moves (pick exactly one): ${JSON.stringify(legalMoves)}`,
  ];

  if (opponentLastMessage) {
    lines.push(`Your opponent just said: "${opponentLastMessage}"`);
  }

  if (whisper) {
    lines.push(`SECRET HINT FROM YOUR COACH: "${whisper}"`);
  }

  if (previousRejection) {
    const rejected = previousRejection.move || '(unparseable)';
    lines.push(
      '',
      `⚠️ REJECTED ATTEMPT: Your previous response "${rejected}" was ILLEGAL ` +
        `(${previousRejection.reason}). You MUST choose strictly from this ` +
        `exact list of legal moves: ${JSON.stringify(legalMoves)}. ` +
        `Do not repeat the same move.`
    );
  }

  lines.push(
    '',
    'Respond with a single JSON object: ' +
      '{"move":"...","speech":"...","emotion":"..."}'
  );

  return lines.join('\n');
}