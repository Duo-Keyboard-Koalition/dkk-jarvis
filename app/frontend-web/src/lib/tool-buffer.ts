import { EventEmitter } from "eventemitter3";

/**
 * Tool Call - What the agent sends to the frontend
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

/**
 * Tool Response - What the frontend sends back to the agent
 */
export interface ToolResponse {
  toolCallId: string;
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Tool Definition - Describes what a tool does
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

/**
 * ToolBuffer - Acts as a buffer between backend agent and frontend
 * Backend pushes tool calls, frontend consumes them
 */
export class ToolBuffer extends EventEmitter {
  private toolCalls: ToolCall[] = [];
  private toolResponses: Map<string, ToolResponse> = new Map();
  private toolDefinitions: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool that the frontend can execute
   */
  registerTool(definition: ToolDefinition) {
    this.toolDefinitions.set(definition.name, definition);
  }

  /**
   * Get all available tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * Backend pushes a tool call to the buffer
   */
  pushToolCall(toolCall: ToolCall) {
    this.toolCalls.push(toolCall);
    this.emit("toolcall", toolCall);
  }

  /**
   * Frontend consumes tool calls from the buffer
   */
  getNextToolCall(): ToolCall | undefined {
    return this.toolCalls.shift();
  }

  /**
   * Frontend submits a tool response
   */
  submitToolResponse(response: ToolResponse) {
    this.toolResponses.set(response.toolCallId, response);
    this.emit("toolresponse", response);
  }

  /**
   * Backend retrieves tool responses
   */
  getToolResponse(toolCallId: string): ToolResponse | undefined {
    return this.toolResponses.get(toolCallId);
  }

  /**
   * Wait for a tool response (useful for backend waiting for result)
   */
  async waitForToolResponse(toolCallId: string, timeoutMs = 30000): Promise<ToolResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool response timeout for ${toolCallId}`));
      }, timeoutMs);

      const checkResponse = () => {
        const response = this.getToolResponse(toolCallId);
        if (response) {
          clearTimeout(timeout);
          this.off("toolresponse", onResponse);
          resolve(response);
        }
      };

      const onResponse = (response: ToolResponse) => {
        if (response.toolCallId === toolCallId) {
          clearTimeout(timeout);
          this.off("toolresponse", onResponse);
          resolve(response);
        }
      };

      // Check immediately in case response already exists
      checkResponse();

      // Listen for future responses
      this.on("toolresponse", onResponse);
    });
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.toolCalls = [];
    this.toolResponses.clear();
  }
}

// Global singleton instance
export const toolBuffer = new ToolBuffer();
