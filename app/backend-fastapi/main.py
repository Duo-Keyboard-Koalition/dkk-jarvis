from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from contextlib import asynccontextmanager
import asyncio
import csv
import json
import uuid
from dotenv import load_dotenv
import os
import subprocess
import time
import random
from typing import Optional, List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# ─── ~/.jarvis directory layout ───────────────────────────────────────────────
#
#   ~/.jarvis/
#     scene_state.json      — live AR scene ontology (written by backend)
#     tool_queue.json       — tool calls to enqueue (written by agent / you)
#     windows.csv           — placement table: uuid, html_file, surface_id,
#                             pos_x, pos_y, pos_z, width, height, title
#     html/
#       <uuid>.html         — one file per AR window (UUID filename)
#
JARVIS_HOME      = os.path.expanduser("~/.jarvis")
HTML_DIR         = os.path.join(JARVIS_HOME, "html")
SCENE_STATE_PATH = os.path.join(JARVIS_HOME, "scene_state.json")
TOOL_QUEUE_PATH  = os.path.join(JARVIS_HOME, "tool_queue.json")
WINDOWS_CSV_PATH = os.path.join(JARVIS_HOME, "windows.csv")
os.makedirs(HTML_DIR, exist_ok=True)

WINDOWS_CSV_FIELDS = [
    "window_uuid",   # UUID — also the html filename stem
    "html_file",     # full path: ~/.jarvis/html/<uuid>.html
    "title",         # display title in AR window title bar
    "surface_id",    # which detected surface it's anchored to (blank = floating)
    "pos_x", "pos_y", "pos_z",   # world-space spawn position
    "width_m",       # width  in metres (AR scale)
    "height_m",      # height in metres (AR scale)
    "created_at",
    "last_updated",
]

if not os.path.exists(WINDOWS_CSV_PATH):
    with open(WINDOWS_CSV_PATH, "w", newline="") as _f:
        csv.DictWriter(_f, fieldnames=WINDOWS_CSV_FIELDS).writeheader()

if not os.path.exists(TOOL_QUEUE_PATH):
    with open(TOOL_QUEUE_PATH, "w") as _f:
        json.dump([], _f)


# ─── Windows CSV helpers ──────────────────────────────────────────────────────

def _read_windows_csv() -> List[Dict]:
    with open(WINDOWS_CSV_PATH, newline="") as f:
        return list(csv.DictReader(f))


def _write_windows_csv(rows: List[Dict]):
    with open(WINDOWS_CSV_PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=WINDOWS_CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)


def register_window(
    window_uuid: str,
    html_path: str,
    title: str = "Window",
    surface_id: str = "",
    pos_x: float = 0, pos_y: float = 0, pos_z: float = -2,
    width_m: float = 0.5, height_m: float = 0.3,
) -> Dict:
    """Upsert a row in windows.csv for this window."""
    rows = _read_windows_csv()
    now = time.time()
    existing = next((r for r in rows if r["window_uuid"] == window_uuid), None)
    row = {
        "window_uuid": window_uuid,
        "html_file":   html_path,
        "title":       title,
        "surface_id":  surface_id,
        "pos_x": pos_x, "pos_y": pos_y, "pos_z": pos_z,
        "width_m":  width_m,
        "height_m": height_m,
        "created_at":   existing["created_at"] if existing else now,
        "last_updated": now,
    }
    rows = [r for r in rows if r["window_uuid"] != window_uuid]
    rows.append(row)
    _write_windows_csv(rows)
    return row


def update_window_placement(window_uuid: str, **kwargs):
    """Patch position/surface fields for an existing window row."""
    rows = _read_windows_csv()
    for r in rows:
        if r["window_uuid"] == window_uuid:
            r.update({k: v for k, v in kwargs.items() if k in WINDOWS_CSV_FIELDS})
            r["last_updated"] = time.time()
            break
    _write_windows_csv(rows)


def resolve_html(value: str) -> str:
    """If value is a file path that exists, read and return its content.
    Otherwise treat as an inline HTML string (backwards-compat for mock calls)."""
    expanded = os.path.expanduser(value)
    if os.path.isfile(expanded):
        with open(expanded) as f:
            return f.read()
    return value


def persist_scene_state():
    """Write current scene ontology to disk."""
    with open(SCENE_STATE_PATH, "w") as f:
        json.dump(scene_state.model_dump(), f, indent=2)


def load_scene_state():
    """Restore scene ontology from disk on startup (survives server restarts)."""
    global scene_state
    if os.path.exists(SCENE_STATE_PATH):
        try:
            with open(SCENE_STATE_PATH) as f:
                scene_state = SceneState(**json.load(f))
            print(f"[JARVIS] Restored scene: {len(scene_state.windows)} windows, "
                  f"{len(scene_state.surfaces)} surfaces")
        except Exception as e:
            print(f"[JARVIS] Could not load scene_state.json: {e}")


async def watch_tool_queue():
    """
    Background task: poll ~/.jarvis/tool_queue.json every 0.5 s.
    Any entries are forwarded to connected frontends via WebSocket then drained.

    Queue entry format:
      {"name": "render_html_file", "args": {"html_file": "~/.jarvis/html/weather.html"}}

    html_file can be:
      - A path  → backend reads the file and sends its content
      - Inline HTML string → sent as-is (backwards-compat)
    """
    last_mtime: float = 0.0
    while True:
        try:
            mtime = os.path.getmtime(TOOL_QUEUE_PATH)
            if mtime > last_mtime:
                last_mtime = mtime
                with open(TOOL_QUEUE_PATH) as f:
                    queue: List[dict] = json.load(f)
                if queue and manager.active:
                    # Clear before sending to avoid re-processing on next poll
                    with open(TOOL_QUEUE_PATH, "w") as f:
                        json.dump([], f)
                    for item in queue:
                        name = item.get("name", "")
                        args = dict(item.get("args", {}))
                        if name == "render_html_file" and "html_file" in args:
                            html_ref = args["html_file"]
                            # Register in windows.csv if it's a UUID-named file
                            win_uuid = item.get("window_uuid") or os.path.splitext(
                                os.path.basename(os.path.expanduser(html_ref)))[0]
                            register_window(
                                win_uuid,
                                os.path.expanduser(html_ref),
                                title=item.get("title", "Window"),
                            )
                            args["html_file"] = resolve_html(html_ref)
                            args["window_uuid"] = win_uuid
                        if name:
                            print(f"[Queue] → {name}")
                            asyncio.create_task(send_tool_call(name, args))
        except (FileNotFoundError, json.JSONDecodeError):
            pass
        await asyncio.sleep(0.5)


def _write_mock_html_files():
    """Write default HTML widget files to ~/.jarvis/html/ on first run.
    Existing files are left untouched so users can customise them."""
    defaults = {
        "weather.html": lambda: _html("🌤 WEATHER REPORT", """
            <div class="val" style="font-size:2.5rem">22°C</div>
            <p>Partly Cloudy · Toronto, ON</p>
            <div class="row">
              <div class="card">💧 Humidity<br><strong>65%</strong></div>
              <div class="card">💨 Wind<br><strong>12 km/h</strong></div>
              <div class="card">🌅 Sunrise<br><strong>6:42 AM</strong></div>
            </div>"""),
        "news.html": lambda: _html("📡 LIVE NEWS FEED", """
            <div class="item"><strong>AI Breakthrough Surpasses Human Benchmarks</strong><br>
              <small>2 min ago · Technology</small></div>
            <div class="item"><strong>Space Mission Deploys Telescope Array</strong><br>
              <small>15 min ago · Science</small></div>
            <div class="item"><strong>Markets React to Economic Summit</strong><br>
              <small>1 hr ago · Finance</small></div>
            <div class="item"><strong>New EV Battery Promises 1000km Range</strong><br>
              <small>2 hrs ago · Technology</small></div>"""),
        "stats.html": lambda: _html("📊 SYSTEM STATS", """
            <div class="bar-wrap">CPU 72%
              <div class="bar" style="width:72%"></div></div>
            <div class="bar-wrap">Memory 58%
              <div class="bar" style="width:58%"></div></div>
            <div class="bar-wrap">GPU 45%
              <div class="bar" style="width:45%"></div></div>
            <div class="bar-wrap">Network 30%
              <div class="bar" style="width:30%"></div></div>"""),
    }
    for filename, generator in defaults.items():
        path = os.path.join(HTML_DIR, filename)
        if not os.path.exists(path):
            with open(path, "w") as f:
                f.write(generator())
    print(f"[JARVIS] HTML widgets at {HTML_DIR}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _write_mock_html_files()
    load_scene_state()
    queue_task = asyncio.create_task(watch_tool_queue())
    yield
    queue_task.cancel()


app = FastAPI(title="JARVIS Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ──────────────────────────────────────────────────────────────────

USE_MOCK_RESPONSES = True

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
AIML_API_KEY   = os.environ.get("AIML_API_KEY")

HOME             = os.path.expanduser("~")
chrome_path      = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
user_data_dir    = os.path.join(HOME, "Library/Application Support/BraveSoftware/Brave-Browser/")
remote_debug_port = "9422"

controller = None
if not USE_MOCK_RESPONSES:
    from browser_use import Agent, BrowserSession, Controller, ActionResult
    from langchain_openai import ChatOpenAI
    import litellm
    controller = Controller()

    @controller.action("Presses a specified keyboard key down and holds it.")
    async def press_keyboard_down(key: str, page) -> ActionResult:
        await page.keyboard.down(key)
        return ActionResult(extracted_content=f'Key "{key}" held down.')


# ─── WebSocket Connection Manager ────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"[WS] Frontend connected  (total: {len(self.active)})")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        print(f"[WS] Frontend disconnected (total: {len(self.active)})")

    async def send(self, ws: WebSocket, data: dict):
        await ws.send_text(json.dumps(data))

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)


manager = ConnectionManager()

# In-memory tool-response futures: id -> asyncio.Future
pending: Dict[str, asyncio.Future] = {}


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)

    # Send available tools on connect
    await manager.send(ws, {
        "type": "tools",
        "tools": [
            {"name": "render_html_file", "description": "Render HTML in AR windows"},
            {"name": "execute_task",     "description": "Execute browser automation"},
        ],
    })

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "tool_response":
                call_id = msg.get("toolCallId")
                if call_id and call_id in pending:
                    pending[call_id].set_result(msg)
                print(f"[WS] Tool response: {call_id}  success={msg.get('success')}")

            elif msg.get("type") == "scene_state":
                _apply_scene_state(msg)

            elif msg.get("type") == "surface_scan":
                _apply_surface_scan(msg)

            elif msg.get("type") == "window_anchored":
                _apply_window_anchor(msg)

            elif msg.get("type") in ("window_dragging", "window_moved"):
                # Update window position in scene_state and windows.csv
                window_id = msg.get("window_id")
                p = msg.get("world_position", {})
                if window_id and p:
                    for anchor in scene_state.anchors:
                        if anchor.window_id == window_id:
                            anchor.world_position = Vec3(x=p.get("x", 0), y=p.get("y", 0), z=p.get("z", 0))
                            break
                    if msg.get("type") == "window_moved":
                        update_window_placement(window_id, pos_x=p.get("x", 0), pos_y=p.get("y", 0), pos_z=p.get("z", 0))
                        persist_scene_state()

            elif msg.get("type") == "session_start":
                scene_state.session_active = True
                scene_state.platform = msg.get("platform")
                scene_state.last_updated = time.time()
                persist_scene_state()
                print(f"[WS] AR session started  platform={scene_state.platform}")

            elif msg.get("type") == "session_end":
                scene_state.session_active = False
                scene_state.last_updated = time.time()
                persist_scene_state()
                print("[WS] AR session ended")

    except WebSocketDisconnect:
        manager.disconnect(ws)


# ─── Tool-call helper ─────────────────────────────────────────────────────────

async def send_tool_call(name: str, args: dict, timeout: float = 30.0) -> dict:
    """Push a tool call to all connected frontends and wait for the response."""
    call_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    pending[call_id] = future

    await manager.broadcast({
        "type": "tool_call",
        "id":   call_id,
        "name": name,
        "args": args,
    })

    try:
        result = await asyncio.wait_for(future, timeout=timeout)
    except asyncio.TimeoutError:
        result = {"toolCallId": call_id, "success": False, "error": "timeout"}
    finally:
        pending.pop(call_id, None)

    return result


# ─── Scene State Helpers ──────────────────────────────────────────────────────

def _apply_scene_state(msg: dict):
    """Merge frontend window snapshot into server-side ontology."""
    raw_windows = msg.get("windows", [])
    updated: List[ARWindowState] = []
    for w in raw_windows:
        pos_raw = w.get("position", {})
        pos = Vec3(x=pos_raw.get("x", 0), y=pos_raw.get("y", 0), z=pos_raw.get("z", 0))
        existing = next((e for e in scene_state.windows if e.id == w["id"]), None)
        updated.append(ARWindowState(
            id=w["id"],
            title=w.get("title", "Window"),
            position=pos,
            created_at=existing.created_at if existing else time.time(),
        ))
    # Remove anchors for windows that were closed
    live_ids = {w["id"] for w in raw_windows}
    scene_state.anchors = [a for a in scene_state.anchors if a.window_id in live_ids]
    scene_state.windows = updated
    scene_state.last_updated = time.time()
    persist_scene_state()


def _apply_surface_scan(msg: dict):
    """Upsert surfaces from the latest scan; preserve out-of-frame surfaces as stale.

    ARKit/ARCore keep planes in their internal spatial map even when the surface
    goes out of the camera FOV — they are just no longer actively refined.
    We mirror that here: surfaces not in the current scan are marked stale but
    kept in the ontology so anchored windows don't lose their reference plane.
    Surfaces that haven't been seen for > STALE_PURGE_SECONDS are pruned.
    """
    STALE_PURGE_SECONDS = 60.0
    now = time.time()
    raw = msg.get("surfaces", [])
    incoming_ids = {s["id"] for s in raw}

    # Build a lookup of what we already know
    existing_map: Dict[str, DetectedSurface] = {s.id: s for s in scene_state.surfaces}

    # Upsert surfaces reported in this scan
    for s in raw:
        p = s.get("position", {})
        n = s.get("normal", {})
        polygon = [Vec3(x=v.get("x", 0), y=v.get("y", 0), z=v.get("z", 0))
                   for v in s.get("polygon", [])]
        prev = existing_map.get(s["id"])
        existing_map[s["id"]] = DetectedSurface(
            id=s["id"],
            kind=s.get("kind", "horizontal"),
            position=Vec3(x=p.get("x", 0), y=p.get("y", 0), z=p.get("z", 0)),
            normal=Vec3(x=n.get("x", 0), y=n.get("y", 1), z=n.get("z", 0)),
            polygon=polygon,
            polygon_vertex_count=len(polygon),
            detected_at=prev.detected_at if prev else now,
            last_updated=now,
            last_seen=now,
            device_last_changed=s.get("last_changed", 0.0),
            is_stale=False,
        )

    # Mark surfaces absent from this scan as stale (but keep them)
    for sid, surface in existing_map.items():
        if sid not in incoming_ids:
            surface.is_stale = True
            # last_seen is unchanged — it records when the device last saw it

    # Purge only surfaces the device hasn't reported for a long time
    scene_state.surfaces = [
        s for s in existing_map.values()
        if (now - s.last_seen) < STALE_PURGE_SECONDS
    ]
    scene_state.last_updated = now
    persist_scene_state()
    stale_count = sum(1 for s in scene_state.surfaces if s.is_stale)
    print(f"[WS] Surface scan: {len(incoming_ids)} active, {stale_count} stale preserved")


def _apply_window_anchor(msg: dict):
    """Record which surface a window landed on and persist to windows.csv."""
    window_id = msg.get("window_id")
    if not window_id:
        return
    p = msg.get("world_position", {})
    anchor = WindowAnchor(
        window_id=window_id,
        surface_id=msg.get("surface_id"),
        world_position=Vec3(x=p.get("x", 0), y=p.get("y", 0), z=p.get("z", 0)),
    )
    scene_state.anchors = [a for a in scene_state.anchors if a.window_id != window_id]
    scene_state.anchors.append(anchor)
    scene_state.last_updated = time.time()
    persist_scene_state()
    # Keep windows.csv in sync with real placement reported by the frontend
    update_window_placement(
        window_id,
        surface_id=msg.get("surface_id", ""),
        pos_x=p.get("x", 0), pos_y=p.get("y", 0), pos_z=p.get("z", 0),
    )


# ─── Mock HTML Templates ──────────────────────────────────────────────────────

def _html(title: str, body: str) -> str:
    return f"""<html><head><style>
  body{{background:linear-gradient(135deg,#0a0a14,#1a0033);color:#00ffea;
       font-family:'Space Mono',monospace;padding:16px;margin:0}}
  h1{{text-shadow:0 0 10px #00ffea;font-size:1.3rem;margin-bottom:12px}}
  .row{{display:flex;gap:12px;margin-top:10px}}
  .card{{background:rgba(0,255,234,.08);border:1px solid #00ffea;
         border-radius:8px;padding:10px;flex:1;text-align:center}}
  .val{{font-size:1.4rem;color:#ff00ea;text-shadow:0 0 8px #ff00ea}}
  .item{{border-left:3px solid #00ffea;padding:6px 10px;margin:8px 0;
         background:rgba(0,255,234,.05)}}
  .bar-wrap{{margin:6px 0}}
  .bar{{height:16px;background:linear-gradient(90deg,#00ffea,#ff00ea);
        border-radius:4px;box-shadow:0 0 6px #00ffea}}
</style></head><body><h1>{title}</h1>{body}</body></html>"""


# ─── Mock Agent Endpoints (Wizard of Oz) ─────────────────────────────────────
# All HTML is read from ~/.jarvis/html/ — edit those files to customise widgets.

def _enqueue_html_file(source_name: str, title: str) -> dict:
    """Copy a named template to a UUID file, register in windows.csv, send to frontend."""
    src = os.path.join(HTML_DIR, source_name)
    if not os.path.isfile(src):
        raise HTTPException(status_code=404, detail=f"Template not found: {source_name}")
    win_uuid = str(uuid.uuid4())
    dest = os.path.join(HTML_DIR, f"{win_uuid}.html")
    with open(src) as sf, open(dest, "w") as df:
        df.write(sf.read())
    register_window(win_uuid, dest, title=title)
    html = resolve_html(dest)
    return win_uuid, html


@app.post("/mock/weather")
async def mock_weather():
    win_uuid, html = _enqueue_html_file("weather.html", "Weather")
    return await send_tool_call("render_html_file", {"html_file": html, "window_uuid": win_uuid})

@app.post("/mock/news")
async def mock_news():
    win_uuid, html = _enqueue_html_file("news.html", "News Feed")
    return await send_tool_call("render_html_file", {"html_file": html, "window_uuid": win_uuid})

@app.post("/mock/stats")
async def mock_stats():
    win_uuid, html = _enqueue_html_file("stats.html", "System Stats")
    return await send_tool_call("render_html_file", {"html_file": html, "window_uuid": win_uuid})

@app.post("/mock/file/{filename}")
async def mock_file(filename: str):
    """Render any file from ~/.jarvis/html/ by name."""
    title = os.path.splitext(filename)[0].replace("-", " ").replace("_", " ").title()
    win_uuid, html = _enqueue_html_file(filename, title)
    return await send_tool_call("render_html_file", {"html_file": html, "window_uuid": win_uuid})

@app.post("/mock/paragraph")
async def mock_paragraph():
    """Spawn a lorem ipsum test window to verify the queue end-to-end."""
    win_uuid = str(uuid.uuid4())
    dest = os.path.join(HTML_DIR, f"{win_uuid}.html")
    lorem = """<html><body style="margin:16px;font-family:sans-serif;font-size:14px;line-height:1.6;color:#111">
<h2 style="margin-top:0">Lorem Ipsum</h2>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
<p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
<p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis.</p>
<p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione sequi nesciunt.</p>
</body></html>"""
    with open(dest, "w") as f:
        f.write(lorem)
    register_window(win_uuid, dest, title="Paragraph")
    return await send_tool_call("render_html_file", {"html_file": lorem, "window_uuid": win_uuid})

@app.post("/mock/html")
async def mock_html(body: Dict[str, str]):
    """Create a new UUID HTML file from an inline message and render it."""
    win_uuid = str(uuid.uuid4())
    dest = os.path.join(HTML_DIR, f"{win_uuid}.html")
    html = _html("🤖 JARVIS", f"<p>{body.get('message', '')}</p>")
    with open(dest, "w") as f:
        f.write(html)
    register_window(win_uuid, dest, title="JARVIS")
    return await send_tool_call("render_html_file", {"html_file": html, "window_uuid": win_uuid})

@app.get("/html")
async def list_html_files():
    """List HTML files in ~/.jarvis/html/."""
    files = sorted(f for f in os.listdir(HTML_DIR) if f.endswith(".html"))
    return {"html_dir": HTML_DIR, "files": files}

@app.get("/windows")
async def list_windows():
    """Return the full windows placement table."""
    return {"windows_csv": WINDOWS_CSV_PATH, "rows": _read_windows_csv()}


# ─── AR Scene Ontology ────────────────────────────────────────────────────────

class Vec3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

class ARWindowState(BaseModel):
    id: str
    title: str = "Window"
    position: Vec3 = Field(default_factory=Vec3)
    created_at: float = Field(default_factory=time.time)

class DetectedSurface(BaseModel):
    id: str
    kind: str = "horizontal"           # "horizontal" | "vertical"
    position: Vec3 = Field(default_factory=Vec3)
    normal: Vec3 = Field(default_factory=lambda: Vec3(x=0, y=1, z=0))
    polygon: List[Vec3] = []           # boundary vertices in world space, grows as user scans
    polygon_vertex_count: int = 0      # convenience: how many vertices the polygon has
    detected_at: float = Field(default_factory=time.time)
    last_updated: float = Field(default_factory=time.time)
    last_seen: float = Field(default_factory=time.time)
    device_last_changed: float = 0.0   # XRPlane.lastChangedTime forwarded from browser
    # True when the device stopped reporting this surface (went out of frame /
    # tracking lost) but we preserve it because the physical surface still exists.
    is_stale: bool = False

class WindowAnchor(BaseModel):
    window_id: str
    surface_id: Optional[str] = None   # None = floating (not anchored to surface)
    world_position: Vec3 = Field(default_factory=Vec3)

class SceneState(BaseModel):
    windows: List[ARWindowState] = []
    surfaces: List[DetectedSurface] = []
    anchors: List[WindowAnchor] = []
    session_active: bool = False
    platform: Optional[str] = None     # "webxr-ar" | "webxr-vr" | "desktop"
    last_updated: float = 0.0

scene_state = SceneState()


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TaskRequest(BaseModel):
    task: str
    use_llm_cleaning: bool = True

class TaskResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    error: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    html_content: Optional[str] = None
    steps: Optional[List[str]] = None


# ─── Browser Helpers ──────────────────────────────────────────────────────────

def close_all_chrome():
    os.system("pkill -f 'Brave Browser'")
    time.sleep(2)

def start_chrome():
    close_all_chrome()
    profile_path = os.path.join(user_data_dir, "Profile 1")
    for lock in ("LOCK", "SingletonLock"):
        fn = os.path.join(profile_path, lock)
        if os.path.exists(fn):
            try:
                os.remove(fn)
            except OSError:
                pass
    subprocess.Popen([
        chrome_path,
        f"--remote-debugging-port={remote_debug_port}",
        f"--user-data-dir={user_data_dir}",
        "--profile-directory=Profile 1",
        "--no-first-run",
        "--no-default-browser-check",
    ])
    time.sleep(5)


# ─── Mock Website Data ────────────────────────────────────────────────────────

MOCK_WEBSITES: Dict[str, Any] = {
    "weather":   {"url": "https://weather.com",         "title": "Weather.com",      "summary": "68°F, Partly Cloudy, SF"},
    "news":      {"url": "https://news.ycombinator.com", "title": "Hacker News",      "summary": "Top stories: AI, WebAssembly, Databases"},
    "wikipedia": {"url": "https://wikipedia.org",        "title": "Wikipedia",        "summary": "Article found and summarised"},
    "stocks":    {"url": "https://finance.yahoo.com",    "title": "Yahoo Finance",    "summary": "S&P 500 +0.82%, NASDAQ +1.12%"},
    "github":    {"url": "https://github.com/trending",  "title": "GitHub Trending",  "summary": "claude-code, whisper, next.js trending"},
    "default":   {"url": "https://example.com",          "title": "Example Domain",   "summary": "Page loaded successfully"},
}

def get_mock_response(task: str) -> dict:
    t = task.lower()
    if any(w in t for w in ["weather", "temperature"]):   site = MOCK_WEBSITES["weather"]
    elif any(w in t for w in ["news", "hacker"]):          site = MOCK_WEBSITES["news"]
    elif any(w in t for w in ["wiki", "what is"]):         site = MOCK_WEBSITES["wikipedia"]
    elif any(w in t for w in ["stock", "market"]):         site = MOCK_WEBSITES["stocks"]
    elif any(w in t for w in ["github", "trending"]):      site = MOCK_WEBSITES["github"]
    else:                                                  site = MOCK_WEBSITES["default"]
    return {**site, "html_content": f"<p>{site['summary']}</p>",
            "steps_taken": ["Navigated", "Loaded", "Extracted", "Summarised"]}


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "JARVIS Backend", "mock_mode": USE_MOCK_RESPONSES,
            "ws_clients": len(manager.active)}

@app.get("/scene-state")
async def get_scene_state():
    return scene_state

@app.delete("/scene-state")
async def clear_scene_state():
    scene_state.windows = []
    scene_state.session_active = False
    scene_state.last_updated = time.time()
    return {"cleared": True}

@app.post("/execute-task", response_model=TaskResponse)
async def execute_task(request: TaskRequest):
    try:
        if USE_MOCK_RESPONSES:
            await asyncio.sleep(random.uniform(0.3, 0.8))
            data = get_mock_response(request.task)
            return TaskResponse(success=True, result=data["summary"],
                                url=data["url"], title=data["title"],
                                html_content=data["html_content"], steps=data["steps_taken"])
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY")
        start_chrome()
        result = await execute_browser_task(request.task)
        close_all_chrome()
        return TaskResponse(success=True, result=result)
    except Exception as e:
        if not USE_MOCK_RESPONSES:
            close_all_chrome()
        return TaskResponse(success=False, error=str(e))

@app.post("/start-chrome")
async def start_chrome_endpoint():
    start_chrome()
    return {"message": "Brave started", "port": remote_debug_port}

@app.post("/stop-chrome")
async def stop_chrome_endpoint():
    close_all_chrome()
    return {"message": "Brave stopped"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
