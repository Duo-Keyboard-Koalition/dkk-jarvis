/**
 * Simple Agent WebSocket Server
 * Connects to frontend via WebSocket
 * Sends tool calls and receives responses
 */

const WebSocket = require("ws");
const http = require("http");
const ToolQueue = require("./queue");

const PORT = process.env.AGENT_PORT || 3001;

// Create a tool queue for ordered execution
const toolQueue = new ToolQueue();

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Connected clients
const clients = new Set();

/**
 * Tool definitions the agent can use
 */
const availableTools = [
  {
    name: "render_html_file",
    description: "Render HTML content in AR windows",
    parameters: {
      html_file: {
        type: "string",
        description: "HTML content to render",
      },
    },
  },
  {
    name: "execute_task",
    description: "Execute a browser automation task",
    parameters: {
      task: {
        type: "string",
        description: "Task description",
      },
    },
  },
];

/**
 * Send a tool call to all connected clients
 */
function sendToolCall(toolCall) {
  console.log("[Agent] Sending tool call:", toolCall);

  // Add to queue
  toolQueue.enqueue(toolCall);

  // Send to all connected clients
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "tool_call",
          id: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
        })
      );
    }
  });
}

/**
 * Get queue status
 */
function getQueueStatus() {
  return toolQueue.getStatus();
}

/**
 * Send tools list to client
 */
function sendToolsToClient(ws) {
  ws.send(
    JSON.stringify({
      type: "tools",
      tools: availableTools,
    })
  );
}

wss.on("connection", (ws) => {
  console.log("[Agent] New client connected");
  clients.add(ws);

  // Send available tools to the client
  sendToolsToClient(ws);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === "tool_response") {
        console.log("[Agent] Tool response:", message);
        // Mark tool as completed in queue
        toolQueue.completeToolCall(message.toolCallId, {
          success: message.success,
          result: message.result,
          error: message.error,
        });
        // Backend agent would process the response here
      }
    } catch (error) {
      console.error("[Agent] Failed to parse message:", error);
    }
  });

  ws.on("close", () => {
    console.log("[Agent] Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("[Agent] WebSocket error:", error);
  });
});

/**
 * Example: Test sending tool calls
 * In a real scenario, these would come from an LLM agent
 */
function exampleAgentLoop() {
  // Send a test HTML rendering every 10 seconds (for testing)
  let counter = 0;

  setInterval(() => {
    if (clients.size > 0) {
      counter++;
      const html = `
        <html>
          <head>
            <style>
              body {
                background: linear-gradient(135deg, #0a0a14, #1a0033);
                color: #00ffea;
                font-family: 'Space Mono', monospace;
                padding: 20px;
              }
              h1 { text-shadow: 0 0 10px #00ffea; }
            </style>
          </head>
          <body>
            <h1>🤖 Agent Test Message #${counter}</h1>
            <p>This HTML was sent from the backend agent at ${new Date().toLocaleTimeString()}</p>
            <p>Agent is connected and sending tool calls!</p>
          </body>
        </html>
      `;

      sendToolCall({
        id: `test-${counter}`,
        name: "render_html_file",
        args: { html_file: html },
      });
    }
  }, 10000); // Every 10 seconds
}

server.listen(PORT, () => {
  console.log(`[Agent] WebSocket server listening on ws://localhost:${PORT}`);
  console.log("[Agent] Waiting for frontend to connect...");
  exampleAgentLoop();
});
