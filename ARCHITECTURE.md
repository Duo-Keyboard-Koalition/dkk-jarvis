# JARVIS — Architecture Reference

## Directory Layout

```
dkk-jarvis/
  app/
    frontend-web/          React + Vite + Three.js frontend
      src/
        App.tsx            Root — landing screen, HUD, session gating
        App.scss           Global styles / CSS variables
        components/
          ar-scene/
            ARScene.tsx    Three.js scene, ARWindow class, drag system
            ar-scene.scss  Canvas / video / overlay styles
          tool-executor/
            ToolExecutor.tsx  Listens for tool calls, spawns AR windows
        lib/
          agent-ws-client.ts  WebSocket client (auto-reconnect)
          tool-buffer.ts      In-memory tool call queue + event emitter
      vite.config.ts       Proxy: /ws → :8000, /mock/* → :8000

    backend-fastapi/       Python FastAPI backend
      main.py              WebSocket, tool queue watcher, REST endpoints

    backend-agent/         (legacy) Node.js mock agent
```

## Frontend — ARScene deep dive

### ARWindow class

Each floating window is an instance of `ARWindow`:

| Field | Type | Purpose |
|-------|------|---------|
| `group` | `THREE.Group` | Scene node; `group.position` = world position |
| `contentMesh` | `THREE.Mesh` | Invisible plane for raycasting (title bar + content) |
| `cssObject` | `CSS3DObject` | HTML content rendered via CSS3DRenderer |
| `plane` | `THREE.Plane` | World-space plane the window lives on |
| `_pendingPosition` | `{x,y,z}\|null` | Buffered final position, flushed to backend on drop |

### Drag system

```
mousedown on canvas
  └─ handleMouseDown
       ├─ getIntersectedWindow()  (raycasts contentMesh array)
       ├─ UV check → title bar?
       └─ potentialDragWindow = windowObj

mousemove on document
  ├─ FAILSAFE: event.buttons === 0 → endDrag()   ← catches missed mouseup
  ├─ threshold check → startDrag()
  │    ├─ fresh camera-facing plane at window centre
  │    └─ dragOffset = worldPos − rayHit
  └─ ray.intersectPlane(dragPlane, hit)
       └─ group.position = hit + dragOffset  (NDC-clamped)

mouseup on document
  └─ endDrag()
       ├─ flush _pendingPosition
       └─ WS: window_moved { world_position, plane_normal }
```

**Key design decision**: the drag plane is recomputed fresh (camera-facing) at every drag start. This prevents accumulated float from NDC-clamping across multiple drags making subsequent intersections unreliable.

### Rendering stack

```
body  (background: #000)
  └─ .App  (100vw × 100vh, position: relative)
       ├─ .ar-scene-wrapper  (isolation: isolate)
       │    ├─ <video> .ar-video-bg   z-index: 0  ← webcam feed
       │    └─ WebGL canvas           z-index: 1  ← Three.js (alpha: true)
       ├─ CSS3DRenderer overlay       z-index: 2  ← HTML windows
       └─ ActiveHUD (React)           z-index: 20 ← branding, crosshair
```

Pointer-events chain: CSS3DObject containers are `pointer-events: none`; only the content div is `auto`; the WebGL canvas receives all title-bar clicks for raycasting.

## Backend — FastAPI

### Startup

```python
lifespan()
  ├─ load_scene_state()      reads ~/.jarvis/scene_state.json
  ├─ _write_mock_html_files() seeds sample HTML in ~/.jarvis/html/
  └─ watch_tool_queue()      polls tool_queue.json every 0.5 s
```

### WebSocket message handling (`/ws`)

| Incoming `type` | Action |
|----------------|--------|
| `scene_state` | Updates in-memory scene state |
| `surface_scan` | Upserts detected surfaces |
| `window_anchor` | Records window→surface relationship |
| `window_moved` | Updates CSV position + persists scene state |
| `tool_response` | Resolves pending `send_tool_call` future |

### Persistence

All state lives in `~/.jarvis/`:

```
scene_state.json   anchors[], surfaces[], last_updated
windows.csv        window_uuid, html_file, title, surface_id,
                   pos_x, pos_y, pos_z, width_m, height_m,
                   created_at, last_updated
tool_queue.json    [ { id, name, args }, … ]   (agent writes, backend consumes)
html/<uuid>.html   one file per window
```

## WebSocket Protocol

### Backend → Frontend

```jsonc
{ "type": "tool_call",
  "id": "uuid",
  "name": "render_html_file",
  "args": { "html_file": "…", "title": "…" } }
```

### Frontend → Backend

```jsonc
// Position persisted on drop
{ "type": "window_moved",
  "window_id": "uuid",
  "world_position": { "x": 0.4, "y": -0.1, "z": -2.1 },
  "plane_normal":   { "x": 0,   "y": 0,    "z": 1   } }

// XR surface map update
{ "type": "surface_scan",
  "surfaces": [{ "id": "sf-…", "kind": "horizontal",
                 "position": {…}, "normal": {…}, "polygon": […] }] }

// Tool execution result
{ "type": "tool_response", "toolCallId": "uuid",
  "success": true, "result": "…" }
```

## Running

```bash
# Terminal 1 — backend
cd app/backend-fastapi
uv run uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd app/frontend-web
npm run dev
# http://localhost:5173
```
