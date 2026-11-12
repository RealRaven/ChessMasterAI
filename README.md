# ♟️ ChessMasterAI — Qwen vs Gemma

A single-page, zero-build 3D chess arena where two local Ollama vision models — qwen3.5:9b (White) and gemma4:e4b (Black) — battle it out in real time. Each model sees the board through a rendered PNG snapshot, talks trash in 3D speech bubbles, and is kept honest by a strict chess.js referee that blocks illegal moves before they hit the board.

No build step. No backend. No cloud. Just a browser, Three.js, and your local LLM.

> 🔒 **Privacy note:** the PNG snapshot sent to Ollama is generated **in-browser** and lives **only in browser memory** (as a base64 data URL in the JavaScript heap). It is **never written to disk**, never uploaded to a third-party service, and never persisted between sessions — it exists only for the duration of the request and the HUD thumbnail preview.

**Repo:** [github.com/RealRaven/ChessMasterAI](https://github.com/RealRaven/ChessMasterAI)

---

## ✨ Features

| Category | Highlights |
|---|---|
| **Referee** | FIDE-complete rule enforcement via `chess.js` (pins, checks, castling, en passant, promotion, threefold, 50-move) |
| **Anti-hallucination** | Pre-move legal-move allowlist + post-move validation with up to **3 self-correcting retries** and a `[Referee Override]` fallback so the game never soft-locks |
| **Vision** | Overhead **PNG** snapshot of the actual 3D scene sent to each model on every turn (thumbnail preview in HUD). The image is rendered in-browser, held **only in browser memory** as a base64 data URL, and **never saved to disk**. |
| **3D Scene** | Procedural chess pieces, animated moves (knight hop arc, capture FX), last-move highlights, rank/file labels for the models to read |
| **Avatars** | Built-in procedural bots (cyan accent = Qwen, magenta = Gemma) **or** drop in your own `.glb` — auto-normalized, auto-animated |
| **Speech** | CSS2D speech bubbles + `speechSynthesis` TTS with distinct voices per side (mute toggle) |
| **Audio** | Fully procedural Web Audio SFX — move click, capture, illegal buzzer, check chime, gameover fanfare. No audio files. |
| **Themes** | Classic Wood, Cyberpunk Neon, Marble & Obsidian — swaps materials, lighting, fog, background live |
| **Cameras** | Free Orbit, Overhead Tactical, White POV, Black POV, Auto-Cam (pans to the speaker/mover) |
| **Spectator HUD** | Play/Pause/Step/Reset, whisper-sabotage input, referee log, move history, chat transcript, vision preview, PGN export |

---

## 📋 Prerequisites

- **A modern Chromium/Firefox browser** (ES modules + `importmap` + WebGL2). Safari 16+ works, older Safari may not.
- **[Ollama](https://ollama.com)** installed and running locally on `http://localhost:11434`.
- The two models pulled:

  ```bash
  ollama pull qwen3.5:9b
  ollama pull gemma4:e4b
  ```

  > Don't have these exact tags? Any **vision-capable** Ollama model will work — just update the model names in the HUD settings panel. Good substitutes: `qwen2.5vl:7b`, `llava:13b`, `gemma3:4b` (vision-enabled builds).

- **CORS enabled on Ollama** — the browser must be allowed to POST to `localhost:11434` from your page origin. See [Ollama CORS setup](#-ollama-cors-setup) below.

No Node.js, no npm, no bundler required to *run* the game. (Node is only useful if you want a local static server, see [Quick Start](#-quick-start).)

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/RealRaven/ChessMasterAI.git
cd ChessMasterAI

# 2. Start any static file server (importmaps + modules require http://, not file://)
python3 -m http.server 8080
#   or: npx serve .
#   or: php -S localhost:8080

# 3. Open the game
open http://localhost:8080
```

Then:

1. Set the two model names in the HUD (defaults are prefilled: `qwen3.5:9b`, `gemma4:e4b`).
2. Pick a personality for each side (Trash-Talker / Philosopher / Chaotic Gremlin).
3. Hit **▶ Play**. Watch Qwen and Gemma argue about the Ruy López.

---

## 🔒 Snapshot Privacy — Browser Memory Only, Never on Disk

Every turn, the game renders a PNG of the board from a temporary overhead camera. That image:

- Is produced **entirely in the browser** by `canvas.toDataURL('image/png')`.
- Exists **only in browser memory** as a base64 string inside the JavaScript heap.
- Is passed to `fetch()` in the `images` array of the Ollama `/api/chat` request body.
- Is displayed in the HUD **Vision Preview** thumbnail as a `data:` URL — still in browser memory.
- Is **never** written to the filesystem, IndexedDB, localStorage, a service worker cache, or any remote server.
- Is garbage-collected as soon as the next turn replaces the reference.

There is **no upload endpoint**, **no telemetry**, **no cloud round-trip**. The only network request is the direct `POST` to your own local Ollama daemon. You can verify this by opening DevTools → Network and observing that only `localhost:11434` is ever contacted while the game runs.

---

## 🔧 Ollama CORS Setup

The browser calls Ollama directly, so Ollama must allow cross-origin requests from your page origin.

**macOS / Linux:**

```bash
OLLAMA_ORIGINS="http://localhost:8080" ollama serve
```

**Windows (PowerShell):**

```powershell
$env:OLLAMA_ORIGINS="http://localhost:8080"; ollama serve
```

Wildcards are fine for local dev:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

If you skip this step, the app will show `Ollama error: Failed to fetch` in the referee log on the first move. That's the signal.

---

## 🕹️ HUD Reference

| Panel | What it does |
|---|---|
| **Controls** | `Play`, `Pause`, `Step` (advance exactly one turn while paused), `Reset` |
| **Board Theme** | Classic Wood / Cyberpunk Neon / Marble & Obsidian |
| **Models & Personality** | Editable model tag per side + one of three personality presets injected into the system prompt |
| **Avatar Upload** | Swap either side to a custom `.glb` / `.gltf` at any time (auto-scaled, auto-centered, auto-faced) |
| **Camera Presets** | Free Orbit / Overhead / White POV / Black POV / Auto-Cam |
| **Audio / TTS** | Independent mute toggles for SFX and speech |
| **Whisper / Sabotage** | Inject a one-shot secret hint into the **next** active AI's prompt |
| **Vision Preview** | Shows the exact **PNG** currently being sent to the LLM (rendered from browser memory, never saved to disk) |
| **Referee Log** | Per-move validation events — legal ✅, illegal ❌ (with the rejected string), override ⚠️ |
| **Move History** | SAN history of all accepted moves + **Export PGN** |
| **Chat Transcript** | Full banter feed from both models, newest first |

---

## 📁 Project Structure

```
ChessMasterAI/
├── index.html              # Shell: canvases + HUD skeleton + importmap + module bootstrap
├── README.md
├── LICENSE
├── assets/                 # User-supplied .glb / textures (optional)
├── vendor/                 # Pinned CDN libs, committed for offline use
│   ├── three.min.js        # Three.js r128
│   ├── OrbitControls.js
│   ├── GLTFLoader.js
│   ├── CSS2DRenderer.js
│   └── chess.min.js        # chess.js 0.11.0
├── src/
│   ├── main.js             # Entry: wires modules, starts render loop
│   ├── config.js           # Defaults (models, personalities, camera presets, theme IDs)
│   ├── core/               # Pure chess logic + referee (no DOM, no Three.js)
│   │   ├── chess-engine.js
│   │   ├── referee.js
│   │   ├── game-loop.js
│   │   ├── state.js
│   │   └── events.js
│   ├── llm/                # Ollama client, prompt builder, parser, vision capture
│   │   ├── ollama-client.js
│   │   ├── prompt-builder.js
│   │   ├── response-parser.js
│   │   ├── vision-capture.js   # ← renders PNG to base64 data URL, browser-memory only
│   │   └── retry-policy.js
│   ├── three/              # Scene, board, pieces, animator, themes, avatars, bubbles
│   │   ├── scene.js
│   │   ├── board.js
│   │   ├── pieces.js
│   │   ├── animator.js
│   │   ├── camera-presets.js
│   │   ├── themes.js
│   │   ├── speech-bubbles.js
│   │   └── avatars/
│   │       ├── avatar-manager.js
│   │       ├── procedural-avatar.js
│   │       ├── glb-loader.js
│   │       └── emotions.js
│   ├── ui/                 # HUD panels
│   │   ├── hud.js
│   │   ├── controls.js
│   │   ├── settings-panel.js
│   │   ├── camera-panel.js
│   │   ├── log-panel.js
│   │   ├── whisper-input.js
│   │   ├── pgn-export.js
│   │   └── vision-preview.js   # ← displays PNG data URL from memory, no caching
│   ├── audio/
│   │   ├── sfx.js
│   │   └── tts.js
│   ├── utils/
│   │   ├── coords.js
│   │   └── dom.js
│   └── styles/
│       ├── main.css
│       ├── hud.css
│       ├── speech-bubbles.css
│       └── themes.css
└── docs/
    ├── ARCHITECTURE.md     # Data-flow diagram + module contracts
    └── OLLAMA_SETUP.md     # Deeper Ollama troubleshooting
```

The rule of thumb when editing:

- **`core/`** never imports from `three/`, `ui/`, or `llm/`.
- **`three/`** never reads game state directly — it subscribes to `events`.
- **`ui/`** never touches Three.js — it calls `game-loop` and emits events.
- **`llm/`** can be swapped for another provider by editing only `ollama-client.js`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data-flow contract.

---

## ⚙️ Configuration

Everything tunable lives in **`src/config.js`**:

```js
export const CONFIG = {
  defaultModels:    { white: 'qwen3.5:9b', black: 'gemma4:e4b' },
  ollamaEndpoint:   'http://localhost:11434/api/chat',
  maxRetries:       3,
  snapshotFormat:   'image/png',   // browser-memory only; never written to disk
  personalities:    { trash: '...', polite: '...', chaotic: '...' },
  cameraPresets:    { free: {...}, overhead: {...}, white: {...}, black: {...} },
  themeIds:         ['classic', 'cyberpunk', 'marble'],
};
```

Change `ollamaEndpoint` there for a remote Ollama box, or set it at runtime via the HUD's settings panel (currently surfaced via `state.js` — see [`docs/OLLAMA_SETUP.md`](docs/OLLAMA_SETUP.md) for the remote-instance caveat).

---

## 🧠 How the Referee Loop Works

Every turn, in order:

1. **Build allowlist** — `chess.moves()` → array of legal SANs for the active side.
2. **Snapshot** — overhead temporary camera renders the scene to a **PNG** (base64 data URL) without disturbing your camera. The image is held **only in browser memory**; it is never written to disk, IndexedDB, or any cache.
3. **Prompt** — system = personality, user = FEN + allowlist + opponent's last line + whisper (if any) + image.
4. **Call** — `POST /api/chat` with `format: "json"`, `stream: false`, and the PNG in the `images` array.
5. **Parse** — extract `{move, speech, emotion}`; normalize `move` (trim, strip punctuation, lowercase).
6. **Validate** — clone the current `Chess` instance and try `move(candidate, {sloppy: true})`.
   - **Legal** → commit, animate, emit `turnEnd`.
   - **Illegal** → log ❌, play buzzer, re-prompt with:
     > *"Your previous move 'X' is ILLEGAL under chess rules. You MUST choose strictly from this exact list: […]"*
7. **3 strikes** → pick a random legal move, append `[Referee Override]` to the speech bubble.
8. **Sync** — `syncBoardFromChess()` rebuilds every piece mesh from `chess.board()`. Visual state cannot drift from internal rules.

---

## 🎨 Customizing Avatars

Drop a `.glb` / `.gltf` into the HUD's upload slot for either side, **or** place a file in `assets/models/` and load it programmatically. The loader will:

- Auto-scale to ~1.8 world units tall (via `THREE.Box3`).
- Re-center at the avatar's seat and face the board.
- Enable shadows on every mesh.
- Play the first embedded `AnimationClip` via `THREE.AnimationMixer` if present.
- Fall back to procedural bobbing / nodding if there are no clips.

Both sides support this **independently** — mix one built-in bot with one uploaded model if you like.

---

## 🎨 Customizing Themes

Add a new key to `THEME` in `src/three/themes.js`:

```js
export const THEME = {
  myTheme: {
    light: 0xff0000,   // material color for light squares
    dark:  0x330000,
    border: 0x111111,
    ambient: 0x404060,
    bg:    0x0a0a1a,
    fog:   0.03,
  },
  // ...
};
```

Then add an `<option value="myTheme">` in the theme `<select>` in `index.html`. Colors, fog density, and background are all picked up automatically.

---

## 🐛 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Failed to fetch` in referee log | Ollama CORS not configured | See [Ollama CORS setup](#-ollama-cors-setup) |
| `HTTP 404` from Ollama | Model tag not pulled | `ollama list` — pull the exact tag, or change the model name in the HUD |
| Both AIs play the **same** move every game | Temperature too low / model too small | In `src/llm/ollama-client.js`, bump `options.temperature` from `0.8` to `1.0` |
| Vision screenshot is black / empty | WebGL context lost or scene not yet rendered | Wait one frame before the first `Play` — the game loop is already gated on `renderer.render` |
| Speech bubbles not appearing | `CSS2DRenderer` DOM not mounted | Check `#css2d-container` exists in `index.html` |
| `.glb` uploads show up floating | Model has non-identity origin | The loader recenters via `Box3`, but if it still floats, check `glb-loader.js` — some rigged models need `SkinnedMesh` pivot fixes |
| Game soft-locks after a weird move | Shouldn't happen — fallback is `[Referee Override]` | If it does, open the browser console and file an issue with the referee log contents |
| `importmap` not supported | Old browser | Use Chrome 89+, Firefox 108+, Safari 16.4+ |

---

## 🧪 Development Notes

- **No build step.** Files are imported directly. Edit, save, hard-refresh.
- **Vendored libraries** live in `vendor/`. Bumping Three.js means replacing `three.min.js` + the three examples files together — they must match versions.
- **Pure modules are testable.** `core/` and `utils/coords.js` have zero browser dependencies. If you want unit tests, add `tests/` with `vitest` or `node:test` — `chess-engine.js` and `referee.js` are the highest-value targets.
- **Adding a new UI panel**: create `src/ui/your-panel.js` exporting a `mount(parentEl, deps)` function, and call it from `src/ui/hud.js`.
- **Privacy is a design constraint, not an afterthought.** `src/llm/vision-capture.js` and `src/ui/vision-preview.js` must both operate on the in-memory `data:image/png;base64,...` string only. Do **not** add code paths that write the snapshot to `localStorage`, `IndexedDB`, the Cache API, a service worker, a `File` object, or any download — that would violate the browser-memory-only guarantee.

---

## 🤝 Contributing

PRs are welcome. Before opening one:

1. Fork → branch from `main`.
2. Keep changes scoped to a single concern (one module, one fix, one feature).
3. Verify the game still runs end-to-end (`python3 -m http.server 8080` and one full AI-vs-AI match with your local Ollama).
4. Include a short screencap or referee-log excerpt if you touched the referee or LLM pipeline.
5. If you touched `vision-capture.js` or `vision-preview.js`, confirm in your PR description that the PNG still lives **only in browser memory** and is never persisted.

If you find a reproducible model that hallucinates moves the referee doesn't catch, please file an issue with the exact FEN, the rejected SAN, and the allowlist — those are the most valuable bug reports.

---

## 📜 License

MIT — see [`LICENSE`](./LICENSE). Do whatever you want, no warranty. If you train a model on this codebase, please make sure it can actually play chess before shipping.

---

## 🙏 Credits

- [chess.js](https://github.com/jhlywa/chess.js) — the referee
- [Three.js](https://threejs.org) — the stage
- [Ollama](https://ollama.com) — the players
- Every vision model that has ever hallucinated `Ke9` — this project exists because of you

---

**Maintained by [@RealRaven](https://github.com/RealRaven) · [github.com/RealRaven/ChessMasterAI](https://github.com/RealRaven/ChessMasterAI)**
