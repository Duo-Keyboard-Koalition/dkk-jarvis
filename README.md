# JARVIS AR Assistant

A spatial computing platform that lets an AI agent place, move, and manage HTML windows floating in 3D world space — visible through a webcam on desktop or real AR (WebXR) on Android/iPad.

Think of it as an **operating system for augmented reality**: windows exist in 3D space, persist their positions, and are driven by a backend agent rather than a human clicking around a 2D desktop.

---

## What It Does

- **Floating AR windows** — HTML content rendered as CSS3D planes in a Three.js scene, anchored to world-space planes
- **Webcam passthrough** — desktop browsers show the live webcam feed behind the 3D scene for an AR feel without needing AR hardware
- **WebXR** — on AR-capable devices (Android Chrome, iPad) real depth/surface detection kicks in
- **Agent-driven** — a backend agent (or any HTTP/WebSocket client) pushes HTML into the scene via a tool queue; the frontend executes and displays it
- **Persistent layout** — window positions are written to `~/.jarvis/scene_state.json` and `windows.csv` so the scene survives restarts
- **Real-time drag sync** — dragging a window updates its world position; the final position is sent to the backend on drop

---

## Architecture

```
  Agent / LLM
      │  tool calls (render_html, etc.)
      ▼
┌─────────────────────────┐
│  FastAPI backend         │  :8000
│  ─────────────────────  │
│  • WebSocket /ws         │
│  • Tool queue watcher    │
│  • Scene state (JSON)    │
│  • Window registry (CSV) │
│  • HTML file store       │
└────────────┬────────────┘
             │  ws://…/ws  (proxied by Vite)
             ▼
┌─────────────────────────┐
│  React frontend          │  :5173
│  ─────────────────────  │
│  • Three.js + CSS3D      │
│  • WebXR / webcam        │
│  • Drag & drop windows   │
│  • Tool executor         │
└─────────────────────────┘
```

### Key files

| Path | Purpose |
|------|---------|
| `app/frontend-web/src/components/ar-scene/ARScene.tsx` | All Three.js scene logic, window class, drag system |
| `app/frontend-web/src/App.tsx` | Landing screen, HUD, top-level layout |
| `app/frontend-web/src/lib/agent-ws-client.ts` | WebSocket client, auto-reconnect |
| `app/frontend-web/src/lib/tool-buffer.ts` | In-memory tool call queue |
| `app/backend-fastapi/main.py` | FastAPI server — WebSocket, tool queue, persistence |

### Persistent storage (`~/.jarvis/`)

```
~/.jarvis/
  scene_state.json   — live scene ontology (surfaces, window anchors)
  tool_queue.json    — tool calls written by the agent, consumed by backend
  windows.csv        — placement table (uuid, html_file, pos_x/y/z, …)
  html/
    <uuid>.html      — one file per AR window
```

---

## Running Locally

### 1. Backend

Requires Python 3.11+ and [`uv`](https://github.com/astral-sh/uv).

```bash
cd app/backend-fastapi
uv run uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd app/frontend-web
npm install
npm run dev
# opens http://localhost:5173
```

Vite proxies `/ws` and `/mock/*` to `localhost:8000` so the frontend and backend talk through the same origin.

---

## WebSocket Protocol

All messages are JSON. The frontend connects to `ws://<host>/ws`.

### Backend → Frontend

```jsonc
// Spawn a new AR window
{ "type": "tool_call", "name": "render_html_file",
  "args": { "html_file": "<html>…</html>", "title": "My Window" } }
```

### Frontend → Backend

```jsonc
// Tool execution result
{ "type": "tool_response", "toolCallId": "…", "success": true }

// Window dragged (buffered, sent on drop)
{ "type": "window_moved", "window_id": "…",
  "world_position": { "x": 0.4, "y": -0.1, "z": -2.1 },
  "plane_normal":   { "x": 0,   "y": 0,    "z": 1   } }

// Surface scan (WebXR only)
{ "type": "surface_scan", "surfaces": [ … ] }
```

---

## Spawning a Window (Quick Test)

```bash
curl -X POST http://localhost:8000/mock/paragraph
```

This enqueues a lorem-ipsum HTML window. The frontend will display it floating in the 3D scene within a second.

You can also write directly to the tool queue:

```bash
cat > ~/.jarvis/tool_queue.json << 'EOF'
[{
  "id": "test-1",
  "name": "render_html_file",
  "args": {
    "title": "Hello World",
    "html_file": "<h1 style='color:#00ffea'>Hello from the agent</h1>"
  }
}]
EOF
```

---

## Drag System

Each window lives on its own `THREE.Plane`. Dragging uses ray-plane intersection so the window follows the cursor exactly at its world depth. On every drag start a fresh camera-facing plane is computed so subsequent drags are always reliable. The final world position is persisted to `scene_state.json` and `windows.csv` on drop.

---

## Device Support

| Device | Mode |
|--------|------|
| Desktop (Mac/Windows) | Webcam passthrough + 3D windows |
| Android Chrome | WebXR immersive-AR with surface detection |
| iPad (Safari 17+) | WebXR immersive-AR |
| iPhone | Webcam passthrough (WebXR not yet supported) |

---

## What This Could Become

This is the scaffolding for a **spatial AI operating system**:

- Windows are not apps — they are agent outputs. The agent decides what to show and where.
- Surface detection maps the physical room; the agent can anchor windows to walls, desks, or mid-air.
- A voice/LLM agent loop (Claude, Gemini, etc.) can push tool calls into `tool_queue.json` in real time, turning any surface into a display.
- Multiple agents can connect simultaneously over WebSocket.
- The CSV/JSON persistence layer is a lightweight scene graph that survives restarts and can be queried by any tool.

The eventual shape is closer to a **spatial shell** than a traditional AR app: the OS manages window placement and input routing; agents provide the content.
