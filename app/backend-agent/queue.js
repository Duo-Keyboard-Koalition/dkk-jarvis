/**
 * Tool Call Queue
 * Ensures tools are executed in order
 */

class ToolQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.onProcess = null; // Callback when tool is processed
  }

  /**
   * Add a tool call to the queue
   */
  enqueue(toolCall) {
    this.queue.push({
      ...toolCall,
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(`[Queue] Tool added: ${toolCall.name} (Queue size: ${this.queue.length})`);
    this.processNext();
  }

  /**
   * Get the next tool call to process
   */
  peek() {
    return this.queue[0] || null;
  }

  /**
   * Mark tool as completed and process next
   */
  completeToolCall(toolCallId, response) {
    const toolCall = this.queue.find((t) => t.id === toolCallId);
    if (toolCall) {
      toolCall.status = "completed";
      toolCall.response = response;
      toolCall.completedAt = Date.now();
      console.log(`[Queue] Tool completed: ${toolCall.name} (${response.success ? "✓" : "✗"})`);
    }
    this.processNext();
  }

  /**
   * Process next tool in queue
   */
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const toolCall = this.peek();

    if (toolCall && toolCall.status === "pending") {
      console.log(`[Queue] Processing: ${toolCall.name}`);
      if (this.onProcess) {
        await this.onProcess(toolCall);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter((t) => t.status === "pending").length,
      completed: this.queue.filter((t) => t.status === "completed").length,
      current: this.peek(),
    };
  }

  /**
   * Clear completed items
   */
  clearCompleted() {
    const before = this.queue.length;
    this.queue = this.queue.filter((t) => t.status !== "completed");
    console.log(`[Queue] Cleared ${before - this.queue.length} completed items`);
  }

  /**
   * Wait for a specific tool call to complete
   */
  async waitForToolCompletion(toolCallId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool ${toolCallId} timed out`));
      }, timeoutMs);

      const checkCompletion = () => {
        const toolCall = this.queue.find((t) => t.id === toolCallId);
        if (toolCall && toolCall.status === "completed") {
          clearTimeout(timeout);
          resolve(toolCall.response);
        } else if (!toolCall) {
          clearTimeout(timeout);
          reject(new Error(`Tool ${toolCallId} not found`));
        }
      };

      // Check immediately
      checkCompletion();

      // Poll every 100ms
      const interval = setInterval(checkCompletion, 100);

      // Stop polling when done
      const originalClearTimeout = clearTimeout;
      clearTimeout = (id) => {
        if (id === timeout) {
          clearInterval(interval);
        }
        originalClearTimeout(id);
      };
    });
  }
}

module.exports = ToolQueue;
