/* ================================================================
   main.js — application entry point.
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
   Wrapped in try/catch so errors don't leave the UI stuck on
   "Initializing..." forever.
   ================================================================ */
try {
  const sceneApi  = createScene();
  const board     = createBoard();
  const pieces    = createPieceLayer();
  const avatars   = createAvatarManager(sceneApi.scene);
  const bubbles   = createSpeechBubbles(sceneApi.scene);
  const cameraCtl = createCameraController(sceneApi.camera, sceneApi.controls);

  sceneApi.scene.add(board.group);
  sceneApi.scene.add(pieces.group);

  const snapshotEngine = createSnapshotEngine();

  /* ================================================================
     callAI
     ================================================================ */
  async function callAI({ fen, legalMoves, side, attempt, previousRejection, whisper }) {
    const model       = state.models[side];
    const personality = state.personalities[side];
    const textOnly    = qs('#text-only-mode')?.checked;

    let snapshot = null;
    if (!textOnly) {
      try {
        snapshot = captureSnapshot(snapshotEngine, sceneApi.scene);
        events.emit('vision:snapshot', { dataURL: snapshot.dataURL });
      } catch (err) {
        console.error('[main] vision snapshot failed:', err);
      }
    }

    const opponentSide        = side === 'white' ? 'black' : 'white';
    const opponentLastMessage = state.lastSpeech[opponentSide];

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

    return await ollamaChat({ model, messages });
  }

  /* ================================================================
     onCommit
     ================================================================ */
  async function onCommit(moveData) {
    const side = moveData.color === 'w' ? 'white' : 'black';

    if (moveData.captured) SFX.capture();
    else                   SFX.move();
    if (engine.isCheck())  SFX.check();

    if (moveData.captured) pieces.removeMesh(moveData.to);

    const mesh = pieces.getMesh(moveData.from);
    await animateMove(mesh, moveData.from, moveData.to, {
      isKnight: moveData.isKnight,
    });

    pieces.syncBoard(engine.getBoard());
    bubbles.show(side, moveData.speech, moveData.emotion);
    avatars.setEmotion(side, moveData.emotion);

    if (moveData.speech) TTS.speak(moveData.speech, side);
  }

  /* ================================================================
     onGameOver
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

  function applyTheme(id) {
    applySceneTheme(sceneApi, id);
    board.applyTheme(id);
  }

  const gameDeps = { callAI, onCommit, onGameOver };

  mountHUD({
    gameLoop,
    gameDeps,
    cameraCtl,
    avatars,
    applyTheme,
  });

  events.on('referee:illegal', () => SFX.illegal());
  events.on('state:theme', ({ next }) => applyTheme(next));
  events.on('game:reset', () => {
    pieces.syncBoard(engine.getBoard());
    bubbles.clear();
    avatars.setEmotion('white', 'confident');
    avatars.setEmotion('black', 'confident');
  });

  let lastTime = performance.now();
  function render() {
    const now = performance.now();
    const dt  = Math.min((now - lastTime) / 1000, 0.1);
    lastTime  = now;

    sceneApi.controls.update();
    avatars.update(dt);
    bubbles.setAnchor('white', avatars.getBubbleAnchor('white'));
    bubbles.setAnchor('black', avatars.getBubbleAnchor('black'));

    sceneApi.renderer.render(sceneApi.scene, sceneApi.camera);
    sceneApi.labelRenderer.render(sceneApi.scene, sceneApi.camera);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  /* ================================================================
     Bootstrap
     ================================================================ */
  async function bootstrap() {
    const badge = qs('#status-badge');
    engine.newGame();
    pieces.syncBoard(engine.getBoard());
    
    badge.textContent = 'Checking Ollama…';
    const available = await ollamaAvailable();

    if (!available) {
      badge.innerHTML = `⚠️ Ollama offline. <a href="#" onclick="alert('Run: OLLAMA_ORIGINS=\"*\" ollama serve')" style="color:inherit;text-decoration:underline">Fix</a>`;
      events.emit('game:error', { message: `Ollama not reachable at ${CONFIG.ollamaEndpoint}.` });
      return;
    }

    const pulled = (await ollamaListModels()).map((m) => m.name);
    const wanted = [state.models.white, state.models.black];
    const missing = wanted.filter((w) => !pulled.some((p) => p === w || p === w + ':latest' || p.startsWith(w)));

    if (missing.length > 0) {
      badge.innerHTML = `⚠️ Missing: ${missing[0]} <a href="#" onclick="alert('Run: ollama pull ${missing[0]}')" style="color:inherit;text-decoration:underline">Fix</a>`;
      events.emit('game:error', { message: `Model not pulled: ${missing[0]}. Run: ollama pull ${missing[0]}` });
      return;
    }

    badge.textContent = 'Ready. Press Play.';
  }

  bootstrap();

  window.ChessMasterAI = { scene: sceneApi, board, pieces, avatars, bubbles, cameraCtl, gameLoop, engine, state, events };
  
} catch (err) {
  // Catch initialization errors (e.g. WebGL missing)
  const badge = document.getElementById('status-badge');
  if (badge) badge.textContent = `⚠️ Error: ${err.message}`;
  console.error('[main] Initialization failed:', err);
}