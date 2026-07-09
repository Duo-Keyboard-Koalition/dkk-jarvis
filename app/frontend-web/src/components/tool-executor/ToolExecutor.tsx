/**
 * ToolExecutor - Replaces Gemini Live
 * Listens to tool calls from the tool buffer and executes them
 */

import { useEffect, useRef } from "react";
import { toolBuffer, ToolCall } from "../../lib/tool-buffer";
import { agentWSClient } from "../../lib/agent-ws-client";

export interface ToolExecutorProps {
  onToolCall?: (toolCall: ToolCall) => void;
}

export function ToolExecutor({ onToolCall }: ToolExecutorProps) {
  const executorRef = useRef<any>(null);

  useEffect(() => {
    // Connect to WebSocket on mount
    agentWSClient.connect().catch((error) => {
      console.error("[ToolExecutor] Failed to connect to agent:", error);
    });

    return () => {
      agentWSClient.disconnect();
    };
  }, []);

  useEffect(() => {
    // Listen for tool calls from the buffer
    const onToolCallEvent = async (toolCall: ToolCall) => {
      console.log(`[ToolExecutor] Received tool call:`, toolCall);

      // Call the parent component's handler
      if (onToolCall) {
        onToolCall(toolCall);
      }

      // Handle render_html_file tool
      if (toolCall.name === "render_html_file") {
        const html = toolCall.args.html_file;
        if ((window as any).createARHTMLWindow) {
          try {
            (window as any).createARHTMLWindow(html);
            // Submit success response
            const response = {
              toolCallId: toolCall.id,
              success: true,
              result: "HTML rendered successfully",
            };
            toolBuffer.submitToolResponse(response);
            agentWSClient.sendToolResponse(response);
          } catch (error) {
            const response = {
              toolCallId: toolCall.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
            toolBuffer.submitToolResponse(response);
            agentWSClient.sendToolResponse(response);
          }
        }
      }

      // Handle execute_task tool
      if (toolCall.name === "execute_task") {
        const { task } = toolCall.args;
        try {
          const baseUrl = import.meta.env.VITE_BROWSER_AUTOMATION_API_URL || "";
          const response = await fetch(`${baseUrl}/execute-task`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task,
              use_llm_cleaning: true,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const toolResponse = {
              toolCallId: toolCall.id,
              success: true,
              result,
            };
            toolBuffer.submitToolResponse(toolResponse);
            agentWSClient.sendToolResponse(toolResponse);
          } else {
            const toolResponse = {
              toolCallId: toolCall.id,
              success: false,
              error: `API Error: ${response.statusText}`,
            };
            toolBuffer.submitToolResponse(toolResponse);
            agentWSClient.sendToolResponse(toolResponse);
          }
        } catch (error) {
          const toolResponse = {
            toolCallId: toolCall.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          toolBuffer.submitToolResponse(toolResponse);
          agentWSClient.sendToolResponse(toolResponse);
        }
      }
    };

    toolBuffer.on("toolcall", onToolCallEvent);

    return () => {
      toolBuffer.off("toolcall", onToolCallEvent);
    };
  }, [onToolCall]);

  return null; // This component doesn't render anything
}
