/**
 * Mock Agent - Wizard of Oz testing
 * Simulates an LLM agent pushing tool calls to the frontend
 * Use this to test all AR display features without a real agent
 */

const WebSocket = require("ws");
const http = require("http");
const readline = require("readline");
const ToolQueue = require("./queue");

const PORT = process.env.AGENT_PORT || 3001;
const server = http.createServer();
const wss = new WebSocket.Server({ server });
const toolQueue = new ToolQueue();
const clients = new Set();

// ─── WebSocket Server ───────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  console.log("\n✅ Frontend connected!\n");
  clients.add(ws);

  ws.send(JSON.stringify({
    type: "tools",
    tools: [
      { name: "render_html_file", description: "Render HTML in AR windows" },
      { name: "execute_task", description: "Execute browser automation" },
    ],
  }));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "tool_response") {
        toolQueue.completeToolCall(msg.toolCallId, msg);
        console.log(`\n📨 Tool response received: ${msg.success ? "✓ Success" : "✗ Failed"}`);
        if (msg.result) console.log("   Result:", JSON.stringify(msg.result).slice(0, 100));
      }
    } catch (e) {
      console.error("Failed to parse message:", e);
    }
  });

  ws.on("close", () => {
    console.log("⚠️  Frontend disconnected");
    clients.delete(ws);
  });
});

// ─── Send Tool Call ──────────────────────────────────────────────────────────

function sendToolCall(toolCall) {
  if (clients.size === 0) {
    console.log("⚠️  No frontend connected. Open http://localhost:3000 first.");
    return;
  }

  const fullCall = { ...toolCall, id: `mock-${Date.now()}` };
  toolQueue.enqueue(fullCall);

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "tool_call", ...fullCall }));
    }
  });

  console.log(`\n📤 Sent tool call: ${fullCall.name}`);
}

// ─── Mock HTML Templates ─────────────────────────────────────────────────────

const mockResponses = {
  weather: `
    <html><head><style>
      body { background: linear-gradient(135deg, #0a0a14, #1a0033); color: #00ffea;
             font-family: 'Space Mono', monospace; padding: 20px; margin: 0; }
      h1 { text-shadow: 0 0 10px #00ffea; font-size: 1.5rem; }
      .temp { font-size: 3rem; color: #ff00ea; text-shadow: 0 0 20px #ff00ea; }
      .row { display: flex; gap: 20px; margin-top: 15px; }
      .stat { background: rgba(0,255,234,0.1); border: 1px solid #00ffea;
              border-radius: 8px; padding: 10px; flex: 1; text-align: center; }
    </style></head><body>
      <h1>🌤 WEATHER REPORT</h1>
      <div class="temp">22°C</div>
      <p>Partly Cloudy · Toronto, ON</p>
      <div class="row">
        <div class="stat">💧 Humidity<br><strong>65%</strong></div>
        <div class="stat">💨 Wind<br><strong>12 km/h</strong></div>
        <div class="stat">🌅 Sunrise<br><strong>6:42 AM</strong></div>
      </div>
    </body></html>
  `,

  news: `
    <html><head><style>
      body { background: #0a0a14; color: #00ffea;
             font-family: 'Space Mono', monospace; padding: 15px; margin: 0; }
      h1 { color: #ff00ea; text-shadow: 0 0 10px #ff00ea; font-size: 1.2rem; }
      .item { border-left: 3px solid #00ffea; padding: 8px 12px; margin: 10px 0;
              background: rgba(0,255,234,0.05); }
      .item h3 { margin: 0 0 4px 0; font-size: 0.9rem; color: #fff; }
      .item p { margin: 0; font-size: 0.75rem; opacity: 0.6; }
    </style></head><body>
      <h1>📡 LIVE NEWS FEED</h1>
      <div class="item"><h3>AI Breakthrough: New Model Surpasses Human Benchmarks</h3><p>2 min ago · Technology</p></div>
      <div class="item"><h3>Space Mission Successfully Deploys Telescope Array</h3><p>15 min ago · Science</p></div>
      <div class="item"><h3>Markets React to Global Economic Summit Outcomes</h3><p>1 hr ago · Finance</p></div>
      <div class="item"><h3>New EV Battery Tech Promises 1000km Range</h3><p>2 hrs ago · Technology</p></div>
    </body></html>
  `,

  stats: `
    <html><head><style>
      body { background: #0a0a14; color: #00ffea;
             font-family: 'Space Mono', monospace; padding: 15px; margin: 0; }
      h1 { font-size: 1.2rem; text-shadow: 0 0 10px #00ffea; }
      .bar-row { margin: 8px 0; }
      .label { font-size: 0.75rem; margin-bottom: 3px; }
      .bar { height: 20px; background: linear-gradient(90deg, #00ffea, #ff00ea);
             border-radius: 4px; box-shadow: 0 0 8px #00ffea; }
      .val { font-size: 0.7rem; opacity: 0.7; margin-top: 2px; }
    </style></head><body>
      <h1>📊 SYSTEM STATS</h1>
      <div class="bar-row"><div class="label">CPU Usage</div>
        <div class="bar" style="width:72%"></div><div class="val">72%</div></div>
      <div class="bar-row"><div class="label">Memory</div>
        <div class="bar" style="width:58%"></div><div class="val">9.3GB / 16GB</div></div>
      <div class="bar-row"><div class="label">GPU</div>
        <div class="bar" style="width:45%"></div><div class="val">45%</div></div>
      <div class="bar-row"><div class="label">Network</div>
        <div class="bar" style="width:30%"></div><div class="val">↑ 2.1 MB/s</div></div>
    </body></html>
  `,

  custom: (text) => `
    <html><head><style>
      body { background: #0a0a14; color: #00ffea;
             font-family: 'Space Mono', monospace; padding: 20px; margin: 0; }
      h2 { text-shadow: 0 0 10px #00ffea; }
      p { line-height: 1.6; color: #ccc; }
    </style></head><body>
      <h2>🤖 JARVIS</h2>
      <p>${text}</p>
    </body></html>
  `,
};

// ─── Interactive CLI ──────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function showMenu() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  JARVIS MOCK AGENT — Wizard of Oz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Connected clients: ${clients.size}
  Queue size:        ${toolQueue.getStatus().total}

  Commands:
  [1] Send weather widget
  [2] Send news feed
  [3] Send stats dashboard
  [4] Send custom HTML message
  [5] Show queue status
  [q] Quit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

function prompt() {
  rl.question("\n> ", async (input) => {
    const choice = input.trim().toLowerCase();

    switch (choice) {
      case "1":
        sendToolCall({ name: "render_html_file", args: { html_file: mockResponses.weather } });
        break;
      case "2":
        sendToolCall({ name: "render_html_file", args: { html_file: mockResponses.news } });
        break;
      case "3":
        sendToolCall({ name: "render_html_file", args: { html_file: mockResponses.stats } });
        break;
      case "4":
        rl.question("Enter your message: ", (msg) => {
          sendToolCall({ name: "render_html_file", args: { html_file: mockResponses.custom(msg) } });
          prompt();
        });
        return;
      case "5":
        console.log("\n📋 Queue Status:", toolQueue.getStatus());
        break;
      case "q":
        console.log("Bye!");
        process.exit(0);
        break;
      default:
        console.log("Unknown command");
    }

    prompt();
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n🚀 Mock Agent WebSocket server on ws://localhost:${PORT}`);
  console.log("   Open http://localhost:3000 in your browser, then click AR START\n");
  showMenu();
  prompt();
});
