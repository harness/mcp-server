/**
 * Client for the Harness Intelligence Service (AI DevOps Agent).
 *
 * Supports both streaming (SSE) and non-streaming request modes.
 */

import type { HarnessClient } from "./harness-client.js";
import type { ServiceChatRequest, ServiceChatResponse, SSEEvent } from "./dto/intelligence.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("intelligence");

export interface ChatOptions {
  /** External abort signal */
  signal?: AbortSignal;
  /** Callback invoked for each SSE event during streaming */
  onProgress?: (event: SSEEvent) => void;
}

/** Build query params matching the Go implementation's scope injection. */
function buildScopeParams(request: ServiceChatRequest): Record<string, string> {
  const params: Record<string, string> = {};
  const ctx = request.harness_context;
  if (ctx.org_id) params.orgIdentifier = ctx.org_id;
  if (ctx.project_id) params.projectIdentifier = ctx.project_id;
  return params;
}

export class IntelligenceClient {
  static readonly API_PATH = "/gateway/harness-intelligence/api/v1/chat/platform";
  static readonly TIMEOUT_MS = 300_000; // 5 minutes

  constructor(private readonly client: HarnessClient) {}

  /**
   * Send a chat request to the Intelligence service.
   * When `request.stream` is true, reads the SSE stream and accumulates the response.
   */
  async sendChat(request: ServiceChatRequest, options?: ChatOptions): Promise<ServiceChatResponse> {
    if (request.stream) {
      return this.sendStreaming(request, options);
    }
    return this.sendNonStreaming(request, options);
  }

  private async sendNonStreaming(
    request: ServiceChatRequest,
    options?: ChatOptions,
  ): Promise<ServiceChatResponse> {
    log.info("Sending non-streaming intelligence request", { action: request.action });
    return this.client.request<ServiceChatResponse>({
      method: "POST",
      path: IntelligenceClient.API_PATH,
      params: buildScopeParams(request),
      body: request,
      signal: options?.signal,
      timeoutMs: IntelligenceClient.TIMEOUT_MS,
    });
  }

  private async sendStreaming(
    request: ServiceChatRequest,
    options?: ChatOptions,
  ): Promise<ServiceChatResponse> {
    log.info("Sending streaming intelligence request", { action: request.action });

    const response = await this.client.requestStream({
      method: "POST",
      path: IntelligenceClient.API_PATH,
      params: buildScopeParams(request),
      body: request,
      signal: options?.signal,
      timeoutMs: IntelligenceClient.TIMEOUT_MS,
    });

    return this.processStream(response, request.conversation_id, options?.onProgress);
  }

  /**
   * Parse SSE stream from the intelligence service.
   *
   * SSE format:
   *   event: <type>\n
   *   data: <content>\n
   *   \n
   *
   * - `event: error` + `data: eof` → end of stream (normal termination)
   * - `event: error` + other data → real error
   * - All other events → content to accumulate
   */
  private async processStream(
    response: Response,
    conversationId: string,
    onProgress?: (event: SSEEvent) => void,
  ): Promise<ServiceChatResponse> {
    const result: ServiceChatResponse = {
      conversation_id: conversationId,
      response: "",
    };

    if (!response.body) {
      log.warn("Stream response has no body");
      return result;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = this.parseSSEBuffer(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          log.debug("SSE event", { type: event.type, data: event.data.slice(0, 200) });

          if (event.type === "error") {
            if (event.data === "eof") {
              // Normal end-of-stream signal — still forward to onProgress
              log.debug("SSE stream ended (eof)");
            } else {
              // Real error from the service
              result.error = event.data;
              log.error("Intelligence service error", { error: event.data });
            }
          } else {
            // Accumulate content
            result.response = (result.response ?? "") + event.data;
          }

          if (onProgress) {
            onProgress(event);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return result;
  }

  /**
   * Parse complete SSE events from a buffer, returning parsed events
   * and any remaining incomplete data.
   */
  private parseSSEBuffer(buffer: string): { parsed: SSEEvent[]; remaining: string } {
    const parsed: SSEEvent[] = [];
    // SSE events are separated by double newlines
    const blocks = buffer.split("\n\n");
    // Last element may be incomplete
    const remaining = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim()) continue;

      let eventType = "message";
      let data = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) {
          eventType = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          data = line.slice("data:".length).trim();
        }
      }

      if (data || eventType) {
        parsed.push({ type: eventType, data });
      }
    }

    return { parsed, remaining };
  }
}
