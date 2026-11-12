/* ================================================================
   main.js — application entry point.
   Wires every layer together: 3D scene, LLM pipeline, game-loop,
   HUD, audio, and the render loop. This is the ONLY module that
   knows about all four top-level folders at once.
   ================================================================ */

import { CONFIG } from './config.js';
import { events } from './core/events.js';
import * as engine from './core/chess-engine.js';
import * as gameLoop from './core/game-loop.js';
import { state } from './core/state.js';

import { chat as ollamaChat, isAvailable as ollamaAvailable, listModels as ollamaListModels } from './llm/ollama-client.js';
import { buildMessages } from './llm/prompt-builder.js';
import { createSnapshotEngine, captureSnapshot } from './llm/vision-capture.js';

import { createScene, applyTheme as applySceneTheme } from './three/scene.js';
import { createBoard } from './three/board.js';
import { createPieceLayer } from './three/pieces.js';
import { animateMove } from './three/animator.js';
import { createCameraController } from './three/camera-presets.js';
import { createSpeechBubbles } from './three/speech-bubbles.js';
import { createAvatarManager } from './three/avatars/avatar-manager.js';

import { mountHUD } from './ui/hud.js';

import { SFX } from './audio/sfx.js';
import { TTS } from './audio/tts.js';

import { qs } from './utils/dom.js';

/* ================================================================
   1. Build the 3D scene
   ================================================================ */

const sceneApi  = createScene();
const board     = createBoard();
const pieces    = createPieceLayer();
const avatars   = createAvatarManager(sceneApi.scene);
const bubbles   = createSpeechBubbles(sceneApi.scene);
const cameraCtl = createCameraController(sceneApi.camera, sceneApi.controls);

sceneApi.scene.add(board.group);
sceneApi.scene.add(pieces.group);

/* ================================================================
   2. Vision snapshot engine (offscreen 512×512 renderer)
   ================================================================ */

const snapshotEngine = createSnapshotEngine();

/* ================================================================
   3. callAI — the function the referee calls on every attempt.
   This is the seam between core/ (batch 2) and llm/ (batch 3).
   ================================================================ */

async function callAI({
  fen,
  legalMoves,
  side,
  attempt,
  previousRejection,
  whisper,
}) {
  const model       = state.models[side];
  const personality = state.personalities[side];

  /* --- Capture a fresh PNG snapshot for THIS attempt.
         Held only in browser memory. Emitted to the HUD preview. --- */
  let snapshot = null;
  try {
    snapshot = captureSnapshot(snapshotEngine, sceneApi.scene);
    events.emit('vision:snapshot', { dataURL: snapshot.dataURL });
  } catch (err) {
    console.error('[main] vision snapshot failed:', err);
  }

  /* --- Opponent's most recent line --- */
  const opponentSide        = side === 'white' ? 'black' : 'white';
  const opponentLastMessage = state.lastSpeech[opponentSide];

  /* --- Build the prompt (system + user + images) --- */
  const messages = buildMessages({
    personality,
    side,
    fen,
    legalMoves,
    opponentLastMessage,
    whisper,
    previousRejection,
    imageBase64: snapshot?.base64,
  });

  /* --- Round-trip to Ollama --- */
  return await ollamaChat({ model, messages });
}

/* ================================================================
   4. onCommit — game-loop awaits this after every approved move.
   Drives the animation, board re-sync, speech bubble, TTS, and SFX.
   ================================================================ */

async function onCommit(moveData) {
  const side = moveData.color === 'w' ? 'white' : 'black';

  /* --- SFX --- */
  if (moveData.captured) SFX.capture();
  else                   SFX.move();
  if (engine.isCheck())  SFX.check();

  /* --- Remove captured piece immediately --- */
  if (moveData.captured) {
    pieces.removeMesh(moveData.to);
  }

  /* --- Animate the mover --- */
  const mesh = pieces.getMesh(moveData.from);
  await animateMove(mesh, moveData.from, moveData.to, {
    isKnight: moveData.isKnight,
  });

  /* --- Rebuild from the authoritative chess.js board --- */
  pieces.syncBoard(engine.getBoard());

  /* --- Speech bubble + emotion --- */
  bubbles.show(side, moveData.speech, moveData.emotion);
  avatars.setEmotion(side, moveData.emotion);

  /* --- TTS --- */
  if (moveData.speech) {
    TTS.speak(moveData.speech, side);
  }
}

/* ================================================================
   5. onGameOver — terminal-state hook.
   ================================================================ */

async function onGameOver(reason) {
  SFX.gameover();

  if (reason.winner) {
    const side = reason.winner;
    bubbles.show(side, `🏆 ${reason.message}`, 'triumphant');
    avatars.setEmotion(side, 'triumphant');
    TTS.speak(reason.message, side);
  } else {
    bubbles.show('white', `🤝 ${reason.message}`, 'confident');
    bubbles.show('black', `🤝 ${reason.message}`, 'confident');
    TTS.speak(reason.message, 'white');
  }
}

/* ================================================================
   6. Theme applier — called by settings-panel + state:theme
   ================================================================ */

function applyTheme(id) {
  applySceneTheme(sceneApi, id);
  board.applyTheme(id);
}

/* ================================================================
   7. Wire up the HUD
   ================================================================ */

const gameDeps = { callAI, onCommit, onGameOver };

mountHUD({
  gameLoop,       // raw module — controls.js passes gameDeps into play/step
  gameDeps,
  cameraCtl,
  avatars,
  applyTheme,
});

/* ================================================================
   8. Cross-cutting event subscriptions
   ================================================================ */

/* Illegal move from the referee → buzzer */
events.on('referee:illegal', () => SFX.illegal());

/* Theme changes (from anywhere, not just settings-panel) → 3D swap */
events.on('state:theme', ({ next }) => applyTheme(next));

/* Reset → rebuild pieces, clear bubbles, restore emotions */
events.on('game:reset', () => {
  pieces.syncBoard(engine.getBoard());
  bubbles.clear();
  avatars.setEmotion('white', 'confident');
  avatars.setEmotion('black', 'confident');
});

/* ================================================================
   9. Render loop
   ================================================================ */

let lastTime = performance.now();

function render() {
  const now = performance.now();
  const dt  = Math.min((now - lastTime) / 1000, 0.1);   // clamp on tab refocus
  lastTime  = now;

  sceneApi.controls.update();
  avatars.update(dt);

  /* Anchor speech bubbles above each avatar's head */
  bubbles.setAnchor('white', avatars.getBubbleAnchor('white'));
  bubbles.setAnchor('black', avatars.getBubbleAnchor('black'));

  sceneApi.renderer.render(sceneApi.scene, sceneApi.camera);
  sceneApi.labelRenderer.render(sceneApi.scene, sceneApi.camera);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

/* ================================================================
   10. Bootstrap — initial game state + Ollama liveness check
   ================================================================ */

async function bootstrap() {
  const badge = qs('#status-badge');

  /* Start a fresh game and paint the initial board. */
  engine.newGame();
  pieces.syncBoard(engine.getBoard());

  /* Check that Ollama is reachable at the configured endpoint. */
  badge.textContent = 'Checking Ollama…';
  const available = await ollamaAvailable();

  if (!available) {
    badge.textContent = '⚠️ Ollama offline';
    events.emit('game:error', {
      message:
        `Ollama not reachable at ${CONFIG.ollamaEndpoint}. ` +
        `Is it running? Is OLLAMA_ORIGINS set? See docs/OLLAMA_SETUP.md.`,
    });
    return;
  }

  /* Check that the requested models are actually pulled. */
  const pulled = (await ollamaListModels()).map((m) => m.name);
  const wanted = [state.models.white, state.models.black];
  const missing = wanted.filter(
    (w) => !pulled.some((p) => p === w || p === w + ':latest' || p.startsWith(w))
  );

  if (missing.length > 0) {
    badge.textContent = `⚠️ Missing: ${missing[0]}`;
    events.emit('game:error', {
      message:
        `Model${missing.length > 1 ? 's' : ''} not pulled: ${missing.join(', ')}. ` +
        `Run: ollama pull ${missing[0]}`,
    });
    return;
  }

  badge.textContent = 'Ready. Press Play.';
}

bootstrap();

/* ================================================================
   11. Debug handle (open DevTools and inspect window.ChessMasterAI)
   ================================================================ */

if (typeof window !== 'undefined') {
  window.ChessMasterAI = {
    scene: sceneApi,
    board,
    pieces,
    avatars,
    bubbles,
    cameraCtl,
    gameLoop,
    engine,
    state,
    events,
  };
}