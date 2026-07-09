/**
 * AgentWSClient - WebSocket client to communicate with Next.js backend agent
 * Syncs tool buffer over WebSocket
 */

import { toolBuffer, ToolCall, ToolResponse } from "./tool-buffer";

export class AgentWSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url?: string) {
    // Default: derive from the current page host so the proxy in vite.config.ts
    // routes it to FastAPI regardless of whether we're on localhost or a phone on LAN.
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = url ?? `${proto}//${window.location.host}/ws`;
  }

  /**
   * Connect to the backend agent via WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("[AgentWSClient] Connected to backend agent");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("[AgentWSClient] Failed to parse message:", error);
          }
        };

        this.ws.onerror = (error) => {
          console.error("[AgentWSClient] WebSocket error:", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("[AgentWSClient] Disconnected from backend");
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from the backend
   */
  private handleMessage(message: any) {
    if (message.type === "tool_call") {
      // Backend agent sent a tool call
      const toolCall: ToolCall = {
        id: message.id,
        name: message.name,
        args: message.args,
      };
      console.log("[AgentWSClient] Tool call from backend:", toolCall);
      toolBuffer.pushToolCall(toolCall);
    }
  }

  /**
   * Send a tool response back to the backend
   */
  sendToolResponse(response: ToolResponse) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[AgentWSClient] WebSocket not connected");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "tool_response",
        toolCallId: response.toolCallId,
        success: response.success,
        result: response.result,
        error: response.error,
      })
    );
  }

  /**
   * Send a scene/state update to the backend
   */
  sendStateUpdate(type: string, data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...data }));
  }

  /**
   * Disconnect from the backend
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Attempt to reconnect to the backend
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      console.log(`[AgentWSClient] Reconnecting in ${delay}ms...`);
      setTimeout(() => {
        this.connect().catch(() => {
          // Retry will happen in onclose
        });
      }, delay);
    } else {
      console.error("[AgentWSClient] Max reconnection attempts reached");
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Global singleton
export const agentWSClient = new AgentWSClient();
