import React, { useRef, useState, useEffect } from "react";
import "./App.scss";
import ARScene, { ARSceneHandles } from "./components/ar-scene/ARScene";
import { ToolExecutor } from "./components/tool-executor/ToolExecutor";
import { ToolCall } from "./lib/tool-buffer";
import { agentWSClient } from "./lib/agent-ws-client";

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "#ff4444", padding: 40, fontFamily: "monospace" }}>
          <h2>Runtime error</h2>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Connection status dot ────────────────────────────────────────────────────

function WsIndicator() {
  const [connected, setConnected] = useState(agentWSClient.isConnected());

  useEffect(() => {
    const id = setInterval(() => setConnected(agentWSClient.isConnected()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem",
                  color: connected ? "#00ffea" : "#ff4444", fontFamily: "monospace" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%",
                    background: connected ? "#00ffea" : "#ff4444",
                    boxShadow: connected ? "0 0 6px #00ffea" : "0 0 6px #ff4444" }} />
      {connected ? "BACKEND CONNECTED" : "CONNECTING…"}
    </div>
  );
}

// ─── Landing screen ───────────────────────────────────────────────────────────

function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      onClick={onStart}
      style={{
        position: "absolute", inset: 0, zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 30%, #1a0033 0%, #0f0020 70%, #000 100%)",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      {/* Grid */}
      <svg style={{ position: "absolute", inset: 0, opacity: 0.18, pointerEvents: "none" }}
           width="100%" height="100%">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00fff7" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#00fff7" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        {Array.from({ length: 20 }, (_, i) => (
          <line key={`v${i}`} x1={`${(i / 20) * 100}%`} y1="0"
                x2={`${(i / 20) * 100}%`} y2="100%"
                stroke="url(#g)" strokeWidth="1" />
        ))}
        {Array.from({ length: 16 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={`${(i / 16) * 100}%`}
                x2="100%" y2={`${(i / 16) * 100}%`}
                stroke="url(#g)" strokeWidth="1" />
        ))}
      </svg>

      <h1 style={{
        fontFamily: 'Orbitron, "Space Mono", monospace', fontWeight: 900,
        fontSize: "clamp(1.6rem, 5vw, 2.8rem)", color: "#00fff7",
        textShadow: "0 0 16px #00fff7, 0 0 32px #ff00ea",
        letterSpacing: "0.08em", marginBottom: 24, textAlign: "center",
        position: "relative", zIndex: 2, pointerEvents: "none",
      }}>
        JARVIS{" "}
        <span style={{ color: "#ff00ea", textShadow: "0 0 16px #00fff7, 0 0 32px #ff00ea" }}>
          AR ASSISTANT
        </span>
      </h1>

      <div style={{
        width: 240, height: 4,
        background: "linear-gradient(90deg, #00fff7 0%, #ff00ea 100%)",
        borderRadius: 2, margin: "0 auto 32px",
        boxShadow: "0 0 24px #00fff7, 0 0 40px #ff00ea",
        position: "relative", zIndex: 2, pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 2, marginBottom: 40, pointerEvents: "none" }}>
        <WsIndicator />
      </div>

      <button
        onClick={onStart}
        style={{
          position: "relative", zIndex: 2,
          padding: "14px 48px",
          background: "transparent",
          border: "2px solid #00fff7",
          borderRadius: 8,
          color: "#00fff7",
          fontFamily: 'Orbitron, "Space Mono", monospace',
          fontWeight: 700, fontSize: "1rem",
          letterSpacing: "0.12em",
          cursor: "pointer",
          boxShadow: "0 0 24px #00fff7, inset 0 0 12px rgba(0,255,247,0.1)",
          textShadow: "0 0 8px #00fff7",
          transition: "all 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,247,0.12)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        START
      </button>
    </div>
  );
}

// ─── Active HUD overlay ───────────────────────────────────────────────────────

function ActiveHUD() {
  const [connected, setConnected] = useState(agentWSClient.isConnected());
  const [firing, setFiring] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setConnected(agentWSClient.isConnected()), 1000);
    return () => clearInterval(id);
  }, []);

  const spawnTestWindow = async () => {
    setFiring(true);
    try {
      await fetch("/mock/paragraph", { method: "POST" });
    } catch (e) {
      console.error("[HUD] spawn failed", e);
    } finally {
      setTimeout(() => setFiring(false), 1200);
    }
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20,
      pointerEvents: "none",
      fontFamily: 'Orbitron, "Space Mono", monospace',
    }}>
      {/* Top-left branding + connection */}
      <div style={{
        position: "absolute", top: 24, left: 28,
        display: "flex", flexDirection: "column", gap: 6,
        pointerEvents: "none",
      }}>
        <div style={{
          fontSize: "0.7rem", letterSpacing: "0.2em",
          color: "#00ffea", textShadow: "0 0 8px #00ffea", opacity: 0.85,
        }}>
          JARVIS <span style={{ color: "#ff00ea" }}>AR</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: "0.55rem", letterSpacing: "0.1em",
          color: connected ? "#00ffea" : "#ff4444",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "#00ffea" : "#ff4444",
            boxShadow: `0 0 5px ${connected ? "#00ffea" : "#ff4444"}`,
          }} />
          {connected ? "AGENT CONNECTED" : "DISCONNECTED"}
        </div>
      </div>

      {/* Center crosshair */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", pointerEvents: "none",
      }}>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <line x1="20" y1="4"  x2="20" y2="14" stroke="#00ffea" strokeWidth="1.5" opacity="0.7" />
          <line x1="20" y1="26" x2="20" y2="36" stroke="#00ffea" strokeWidth="1.5" opacity="0.7" />
          <line x1="4"  y1="20" x2="14" y2="20" stroke="#00ffea" strokeWidth="1.5" opacity="0.7" />
          <line x1="26" y1="20" x2="36" y2="20" stroke="#00ffea" strokeWidth="1.5" opacity="0.7" />
          <circle cx="20" cy="20" r="3" fill="none" stroke="#00ffea" strokeWidth="1" opacity="0.6" />
        </svg>
      </div>

      {/* Bottom — spawn test window */}
      <div style={{
        position: "absolute", bottom: 28, left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "auto",
      }}>
        <button
          onClick={spawnTestWindow}
          disabled={firing}
          style={{
            padding: "8px 24px",
            background: firing ? "rgba(0,255,234,0.15)" : "transparent",
            border: "1px solid #00ffea",
            borderRadius: 4,
            color: "#00ffea",
            fontFamily: 'Orbitron, "Space Mono", monospace',
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            cursor: firing ? "default" : "pointer",
            textShadow: "0 0 6px #00ffea",
            boxShadow: "0 0 10px rgba(0,255,234,0.2)",
            transition: "all 0.2s",
          }}
        >
          {firing ? "SPAWNING…" : "SPAWN WINDOW"}
        </button>
      </div>
    </div>
  );
}

// ─── Root app ─────────────────────────────────────────────────────────────────

function ARComponent({ onSessionReset }: { onSessionReset?: () => void }) {
  const arSceneRef = useRef<ARSceneHandles>(null);
  const [started, setStarted] = useState(false);

  const handleToolCall = (toolCall: ToolCall) => {
    console.log("[ARComponent] tool call:", toolCall);
  };

  if (!started) {
    return (
      <>
        <LandingScreen onStart={() => setStarted(true)} />
        <ToolExecutor onToolCall={handleToolCall} />
      </>
    );
  }

  return (
    <>
      <ARScene
        ref={arSceneRef}
        onSessionStart={() => {}}
        onSessionEnd={() => setTimeout(() => window.location.reload(), 100)}
      />
      <ActiveHUD />
      <ToolExecutor onToolCall={handleToolCall} />
    </>
  );
}

function App() {
  const [arKey, setArKey] = useState(0);
  return (
    <div className="App">
      <ErrorBoundary>
        <ARComponent key={arKey} onSessionReset={() => setArKey((k) => k + 1)} />
      </ErrorBoundary>
    </div>
  );
}

export default App;
