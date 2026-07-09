# JARVIS Agent Backend

WebSocket server that communicates with the JARVIS frontend via a **Tool Buffer**.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Your Agent/LLM                             │
│  (Python, Node.js, etc.)                    │
└────────────┬────────────────────────────────┘
             │ Tool calls
             ▼
┌─────────────────────────────────────────────┐
│  Backend Agent WebSocket Server (3001)      │
│  - Listens to connections                   │
│  - Sends tool calls to frontend             │
│  - Receives tool responses                  │
└────────────┬────────────────────────────────┘
             │ WebSocket (ws://localhost:3001)
             ▼
┌─────────────────────────────────────────────┐
│  Frontend (localhost:3000)                  │
│  - Connects to agent                        │
│  - Receives tool calls                      │
│  - Executes tools (render HTML, etc)        │
│  - Sends responses back                     │
└─────────────────────────────────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm init -y
npm install ws
```

### 2. Run the Server

```bash
node server.js
```

The server will start on `ws://localhost:3001`

### 3. Test Connection

Open http://localhost:3000 in the browser:
- Frontend will auto-connect to the agent
- You'll see test HTML messages every 10 seconds

## How It Works

### Frontend Connects
```javascript
const agentWSClient = new AgentWSClient("ws://localhost:3001");
await agentWSClient.connect();
```

### Agent Sends Tool Call
```javascript
sendToolCall({
  id: "123",
  name: "render_html_file",
  args: { html_file: "<html>...</html>" }
});
```

### Frontend Receives & Executes
```typescript
// ToolExecutor listens for tool calls
toolBuffer.on("toolcall", (toolCall) => {
  // Execute the tool
  // Send response back
  agentWSClient.sendToolResponse({
    toolCallId: "123",
    success: true,
    result: "..."
  });
});
```

### Agent Receives Response
```javascript
// Server receives tool responses
ws.on("message", (data) => {
  const message = JSON.parse(data);
  if (message.type === "tool_response") {
    console.log("Tool executed:", message);
  }
});
```

## Available Tools

The agent can call these tools:

### 1. render_html_file
Render HTML content in AR windows

```json
{
  "id": "unique-id",
  "name": "render_html_file",
  "args": {
    "html_file": "<html><body>Content</body></html>"
  }
}
```

### 2. execute_task
Execute browser automation tasks

```json
{
  "id": "unique-id",
  "name": "execute_task",
  "args": {
    "task": "Click the button and fill the form"
  }
}
```

## Example: Custom Agent

Replace the `exampleAgentLoop()` in `server.js` with your own agent logic:

```javascript
// Your LLM agent
async function agentLoop() {
  while (true) {
    // Get user input from somewhere
    const userQuery = await getUserInput();
    
    // Call your LLM
    const decision = await yourLLM.decide(userQuery);
    
    // Send tool calls based on LLM decision
    if (decision.action === "render_html") {
      sendToolCall({
        id: Date.now().toString(),
        name: "render_html_file",
        args: { html_file: decision.html }
      });
    }
    
    // Wait for responses
    const response = await waitForToolResponse(toolCallId);
    console.log("Tool response:", response);
  }
}

agentLoop();
```

## Protocol

### Message Types

**Tool Call (Agent → Frontend)**
```json
{
  "type": "tool_call",
  "id": "unique-id",
  "name": "tool-name",
  "args": { "param": "value" }
}
```

**Tool Response (Frontend → Agent)**
```json
{
  "type": "tool_response",
  "toolCallId": "unique-id",
  "success": true,
  "result": { "data": "..." },
  "error": null
}
```

**Tools List (Agent → Frontend)**
```json
{
  "type": "tools",
  "tools": [
    {
      "name": "tool-name",
      "description": "...",
      "parameters": { ... }
    }
  ]
}
```

## Environment Variables

```bash
AGENT_PORT=3001  # Port to run the server on
```

## Debugging

Check browser console (http://localhost:3000):
```javascript
// View tool calls
console.log("[ToolExecutor] Received tool call:", toolCall);

// View responses
console.log("[Agent] Tool response:", response);
```

Check server console:
```bash
[Agent] New client connected
[Agent] Sending tool call: { id: '123', name: 'render_html_file', ... }
[Agent] Tool response: { toolCallId: '123', success: true, ... }
```

## Production Notes

- Add authentication to WebSocket
- Add error handling and timeouts
- Implement heartbeat/ping-pong
- Handle disconnections gracefully
- Rate limit tool calls
- Add logging/monitoring

## Next Steps

1. Implement your LLM agent
2. Replace `exampleAgentLoop()` with your agent logic
3. Start the backend: `node server.js`
4. Frontend will auto-connect and receive tool calls
