# Architecture

How ChessMasterAI is put together, why the folders are split the way
they are, and where the seams are if you want to extend it.

---

## High-level dependency graph

```
                    ┌───────────────┐
                    │   index.html  │
                    └───────┬───────┘
                            │ imports
                            ▼
                    ┌───────────────┐
                    │   src/main.js │  ← the only file that imports
                    └───┬───┬───┬───┘     from all four top folders
                        │   │   │
        ┌───────────────┘   │   └───────────────┐
        ▼                   ▼                   ▼
    ┌───────┐           ┌───────┐           ┌───────┐
    │ core/ │           │ llm/  │           │ three/│
    └───┬───┘           └───┬───┘           └───┬───┘
        │                   │                   │
        └─────────┬─────────┴───────────────────┘
                  │
                  ▼
            ┌──────────┐
            │  ui/     │  subscribes to events, mounts panels
            └──────────┘
```

### Import rules (enforced by convention, not tooling)

| Folder  | May import from                     | Must NOT import from        |
|---------|-------------------------------------|-----------------------------|
| `core/` | `config.js`, `utils/coords.js`      | `three/`, `ui/`, `llm/`     |
| `llm/`  | `config.js`                         | `three/`, `ui/`, `core/` (except `config`) |
| `three/`| `config.js`, `utils/coords.js`, `three/` internals | `ui/`, `core/` (except via events) |
| `ui/`   | `core/`, `audio/`, `utils/`         | `three/` (must receive via deps) |
| `audio/`| nothing                             | everything else             |

**Rule of thumb:** if a module needs to *notify* another layer, it emits an
event on `core/events.js`. If it needs to *call* another layer, it accepts
a callback via dependency injection. The only module that knows about all
four layers at once is `src/main.js`.

---

## The turn pipeline

Every turn goes through the same path, in this order:

```
game-loop.tick(deps)
  │
  ├─▶ engine.getFen()                 (core/chess-engine.js)
  ├─▶ engine.getLegalMoves()          (core/chess-engine.js)
  ├─▶ state.consumeWhisper()          (core/state.js — one-shot)
  │
  ├─▶ referee.requestMove({ callAI })
  │     │
  │     ├─ LOOP (up to CONFIG.maxRetries):
  │     │   │
  │     │   ├─▶ callAI({ fen, legalMoves, attempt, previousRejection })
  │     │   │     │
  │     │   │     ├─▶ vision-capture.captureSnapshot()  ← browser memory only
  │     │   │     ├─▶ events.emit('vision:snapshot')    ← HUD preview updates
  │     │   │     ├─▶ prompt-builder.buildMessages()
  │     │   │     ├─▶ ollama-client.chat()
  │     │   │     └─▶ response-parser.parseResponse()
  │     │   │
  │     │   ├─▶ normalizeMove(candidate)
  │     │   ├─▶ engine.probe(candidate)  ← pure, on a clone
  │     │   │
  │     │   ├─ legal   → return { move, speech, emotion, wasOverride: false }
  │     │   └─ illegal → record rejection, retry with feedback
  │     │
  │     └─▶ On retries exhausted:
  │           random legal move + [Referee Override] speech
  │
  ├─▶ engine.commit(result.move)         ← mutates the real game
  ├─▶ state.setTurn(engine.getTurn())
  ├─▶ state.setLastMove(moveData)
  ├─▶ events.emit('move:committed', moveData)
  │
  ├─▶ await deps.onCommit(moveData)      ← main.js: animate + sync + speak
  │
  └─▶ if engine.isGameOver():
        events.emit('game:over', reason)
        await deps.onGameOver(reason)
```

The referee **never commits**. It returns a plan. `game-loop` is the only
caller of `engine.commit()`. This makes the referee fully testable and
keeps the "single mutation path" invariant.

---

## Event contract

All inter-module notifications go through `core/events.js`. Handlers are
isolated — a throw in one listener won't break the others.

### State mutations

| Event | Payload | Emitted by |
|---|---|---|
| `state:game` | `{ prev, next }` | `state.setGameState` |
| `state:turn` | `{ prev, next }` | `state.setTurn` |
| `state:lastMove` | moveData | `state.setLastMove` |
| `state:whisper` | `{ value }` | `state.setWhisper` / `consumeWhisper` |
| `state:theme` | `{ prev, next }` | `state.setTheme` |
| `state:model` | `{ side, value }` | `state.setModel` |
| `state:personality` | `{ side, value }` | `state.setPersonality` |
| `state:lastSpeech` | `{ side, value }` | `state.setLastSpeech` |

### Referee

| Event | Payload | Emitted by |
|---|---|---|
| `referee:attempt` | `{ attempt, maxRetries }` | `referee.requestMove` |
| `referee:legal` | `{ move, san, attempt }` | `referee.requestMove` |
| `referee:illegal` | `{ move, reason, attempt }` | `referee.requestMove` |
| `referee:override` | `{ move, attempts, rejectedMoves }` | `referee.requestMove` |
| `referee:error` | `{ attempt, message }` | `referee.requestMove` |

### Game loop

| Event | Payload | Emitted by |
|---|---|---|
| `ai:thinking` | `{ turn, side, attempt }` | `game-loop.tick` |
| `move:committed` | moveData (see below) | `game-loop.tick` |
| `game:over` | `{ type, winner, message }` | `game-loop.tick` |
| `game:reset` | `{}` | `game-loop.reset` |
| `game:error` | `{ message, error }` | `game-loop.tick`, `main.js` |

### Vision

| Event | Payload | Emitted by |
|---|---|---|
| `vision:snapshot` | `{ dataURL }` | `main.callAI` |

### `moveData` shape

```ts
{
  from:      string,     // "e2"
  to:        string,     // "e4"
  san:       string,     // "e4"
  color:     'w' | 'b',
  piece:     'p' | 'r' | 'n' | 'b' | 'q' | 'k',
  captured:  string | null,
  isKnight:  boolean,
  speech:    string,
  emotion:   'confident' | 'nervous' | 'thinking' | 'triumphant',
  wasOverride: boolean,
  attempts:  number,
  rejectedMoves: Array<{ move: string, reason: string }>,
}
```

---

## Vision snapshot privacy

The PNG snapshot is the only image the app ever produces. Its entire
lifecycle lives inside `src/llm/vision-capture.js` and the two call sites
that consume it:

1. `main.callAI` calls `captureSnapshot(snapshotEngine, scene)`, which
   renders the scene into an **offscreen** `THREE.WebGLRenderer` and calls
   `canvas.toDataURL('image/png')`.
2. The resulting base64 string is passed to `prompt-builder.buildMessages`
   as `imageBase64` and ends up in the `images: [...]` field of the
   Ollama request body.
3. The same `dataURL` string is also emitted via `vision:snapshot` so
   `ui/vision-preview.js` can show it as an `<img src="data:...">`.

At no point does this module:

- write to `localStorage` or `sessionStorage`
- write to `IndexedDB` or the Cache API
- enqueue a service worker request
- create a `File`, `Blob` download, or `<a download>`
- POST to any endpoint other than `CONFIG.ollamaEndpoint`

**When the page reloads, the image is gone.** No trace remains.

The only user-facing downloads in the app are **PGN exports**, which are
plaintext game history, not images.

---

## Where to extend

| If you want to… | Change this file |
|---|---|
| Add a new board theme | `src/three/themes.js` + `<option>` in `index.html` |
| Add a new personality | `CONFIG.personalities` in `src/config.js` |
| Support a new LLM provider | `src/llm/ollama-client.js` — it's the only file that fetches |
| Change the retry policy | `src/core/referee.js` + `CONFIG.maxRetries` |
| Change the referee rules | `src/core/chess-engine.js` (uses chess.js 0.11) |
| Add a new camera preset | `CONFIG.cameraPresets` + `<button data-cam>` |
| Change snapshot dimensions | `CONFIG.snapshotWidth/Height` |
| Add a new avatar type | `src/three/avatars/` — implement the `getBubbleAnchor / update / setEmotion / dispose` interface |
| Add a new HUD panel | `src/ui/your-panel.js` exporting `mountX(deps)` + call from `hud.js` |
| Add a new SFX | `src/audio/sfx.js` — everything is procedural, no files |

---

## Testing strategy

`src/core/` and `src/utils/coords.js` have **zero browser dependencies**
— they can be unit-tested in Node with `vitest` or `node:test` after a
tiny import-map shim.

Highest-value targets, in order:

1. **`referee.js`** — mock `callAI` to return illegal moves and verify
   the retry count, fallback behaviour, and `wasOverride` flag.
2. **`chess-engine.js`** — verify `probe()` never mutates, `commit()`
   returns null on illegals, `getGameOverReason()` correctly classifies
   checkmate / stalemate / repetition / insufficient material.
3. **`response-parser.js`** — feed it fenced JSON, prefixed commentary,
   malformed brackets, and nested-brace strings.

`src/three/` and `src/ui/` are best tested manually in the browser.
`window.ChessMasterAI` (exposed in `main.js`) gives DevTools access to
every subsystem.
```

### `docs/OLLAMA_SETUP.md`

```markdown
# Ollama Setup

ChessMasterAI talks directly to a local Ollama daemon. This doc covers
everything from first install to advanced remote setups and the two or
three failures that catch almost everybody.

---

## 1. Install Ollama

Follow the official instructions: **https://ollama.com/download**

Verify it's running:

```bash
ollama list
```

If that prints a (possibly empty) list of models, Ollama is running. If it
hangs or errors, start it manually:

```bash
ollama serve
```

---

## 2. Pull the two models

The defaults are:

```bash
ollama pull qwen3.5:9b
ollama pull gemma4:e4b
```

Either side can be swapped for any **vision-capable** Ollama model. Good
alternatives (as of this writing):

| Model | Notes |
|---|---|
| `qwen2.5vl:7b` | Strong vision, similar speed to qwen3.5:9b |
| `llava:13b` | Larger, slower, generally solid move selection |
| `gemma3:4b` | Lightweight, needs a vision-enabled build |
| `moondream` | Very small, fast, weaker chess knowledge |

Swap the tags in the HUD's **Models & Personality** panel — no code
changes needed.

---

## 3. Enable CORS ⚠️ (the #1 stumbling block)

The browser calls `http://localhost:11434` from your page origin. By
default, Ollama only accepts requests from `localhost` and `127.0.0.1`
without a CORS header — the browser will block the `fetch()` with a
`Failed to fetch` error before your code even sees a response.

You **must** set `OLLAMA_ORIGINS` to include your page origin. Restart
Ollama with:

**macOS / Linux:**

```bash
OLLAMA_ORIGINS="http://localhost:8080" ollama serve
```

**Windows (PowerShell):**

```powershell
$env:OLLAMA_ORIGINS="http://localhost:8080"; ollama serve
```

**Wildcards (fine for local dev, not for production):**

```bash
OLLAMA_ORIGINS="*" ollama serve
```

If you serve the game on a different port, replace `8080` with that port.

### How to tell if CORS is the problem

Open DevTools → Console. On the first move you'll see something like:

```
Access to fetch at 'http://localhost:11434/api/chat' from origin
'http://localhost:8080' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

That's Ollama running but rejecting your origin. Restart with
`OLLAMA_ORIGINS` set and try again.

If instead you see `net::ERR_CONNECTION_REFUSED`, Ollama itself isn't
running — `ollama serve` in another terminal.

---

## 4. Verify the setup end-to-end

Before you press Play in the game, verify with `curl`:

```bash
# 1. Ollama is up
curl http://localhost:11434/api/tags

# 2. Both models are pulled
curl http://localhost:11434/api/tags | grep -E 'qwen|gemma'

# 3. A chat request works and returns JSON
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3.5:9b",
  "messages": [{"role":"user","content":"Reply with {\"ok\":true}"}],
  "format": "json",
  "stream": false
}'
```

If all three succeed, the game will too.

---

## 5. Running the game

```bash
# From the repo root
python3 -m http.server 8080
open http://localhost:8080
```

Watch the **status badge** in the top-right. What you should see:

| Badge text | Meaning |
|---|---|
| `Checking Ollama…` | Startup, running the liveness probe |
| `Ready. Press Play.` | Everything is wired up correctly |
| `⚠️ Ollama offline` | `ollama serve` isn't running, or the port is wrong |
| `⚠️ Missing: <model>` | `ollama pull <model>` hasn't been run |

If the badge is green, press **▶ Play** and watch the two models argue.

---

## 6. Performance notes

The `qwen3.5:9b` model is ~9B parameters. On a modern GPU with 8+ GB VRAM
it generates a full JSON response (move + speech) in 2–5 seconds. On CPU
it can take 30–60 seconds per turn.

Tips:

- **Set `OLLAMA_NUM_GPU=99`** (default) to use the GPU. Verify with
  `ollama ps` — the `SIZE` column should show VRAM usage close to the
  full model size.
- **Use `gemma4:e4b`** (effective 4B) for a faster game. It's noticeably
  quicker while still vision-capable.
- **Reduce concurrency** — set `OLLAMA_NUM_PARALLEL=1` if you're low on
  VRAM. Ollama otherwise loads two model copies (one per model tag in
  active rotation).
- **Watch the referee log** — if the first move takes 45 seconds, it's
  running on CPU. Check `ollama ps` before starting.

---

## 7. Remote Ollama instance (advanced)

If Ollama runs on a different machine (say, a GPU box on your LAN), point
the game at it via the HUD's settings panel — this is surfaced through
`state.ollamaEndpoint` and overridable in `CONFIG.ollamaEndpoint`.

Two caveats for a remote host:

1. **CORS again** — the remote daemon must set
   `OLLAMA_ORIGINS="http://<your-lan-host>:8080"` (or `*` for dev).
2. **Vision images go over the wire** — the PNG snapshot is POSTed to the
   remote Ollama, so it leaves your machine. The README's "browser memory
   only" privacy guarantee still holds *for your disk* (nothing is
   persisted by the browser), but the image is transmitted to whatever
   host you configure. Only point at hosts you trust.

---

## 8. Common errors and their fixes

| Symptom | Cause | Fix |
|---|---|---|
| `Failed to fetch` on first move | CORS not configured | Set `OLLAMA_ORIGINS` and restart |
| `HTTP 404` from Ollama | Model not pulled | `ollama pull <model>` |
| `Ollama HTTP 500` | Model crashed mid-inference | Check `ollama serve` logs; try a smaller model |
| `Ollama request timed out` | CPU inference on a 9B model | Try `gemma4:e4b`, or switch to GPU |
| Response isn't valid JSON | Model ignores `format:"json"` | Rare; the parser tries 4 fallback layers. If it still fails, try a larger model |
| Same move every game | Temperature too low | In `src/llm/ollama-client.js`, raise `temperature` from 0.8 to 1.0 |
| Vision snapshot is black | `WebGLRenderer` context lost | Reload the page; check the browser console for WebGL errors |

---

## 9. Where the code lives

If you need to trace an Ollama call:

- **Endpoint / HTTP**: `src/llm/ollama-client.js` → `chat()`
- **Prompt construction**: `src/llm/prompt-builder.js` → `buildMessages()`
- **Response extraction**: `src/llm/response-parser.js` → `parseResponse()`
- **Timeouts / retries**: `src/llm/retry-policy.js`
- **Caller (game-loop)**: `src/main.js` → `callAI()`

Every request uses `format: "json"` and `stream: false`. No streaming
support is wired up; if you want streaming later, the seam is entirely in
`ollama-client.chat()`.
