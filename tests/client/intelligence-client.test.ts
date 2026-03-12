import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntelligenceClient } from "../../src/client/intelligence-client.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ServiceChatRequest, ServiceChatResponse } from "../../src/client/dto/intelligence.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(overrides?: Partial<HarnessClient>): HarnessClient {
  return {
    request: vi.fn(),
    requestStream: vi.fn(),
    account: "test-account",
    ...overrides,
  } as unknown as HarnessClient;
}

function makeChatRequest(overrides?: Partial<ServiceChatRequest>): ServiceChatRequest {
  return {
    harness_context: { account_id: "acct1", org_id: "org1", project_id: "proj1" },
    prompt: "Create a deploy pipeline",
    action: "CREATE_PIPELINE",
    conversation_id: "conv-123",
    stream: false,
    ...overrides,
  };
}

/** Build a ReadableStream that emits chunks of SSE text. */
function sseStream(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function makeStreamResponse(body: ReadableStream<Uint8Array>): Response {
  return { ok: true, body } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IntelligenceClient", () => {
  let harnessClient: HarnessClient;
  let intelligence: IntelligenceClient;

  beforeEach(() => {
    harnessClient = makeClient();
    intelligence = new IntelligenceClient(harnessClient);
  });

  describe("non-streaming", () => {
    it("sends a non-streaming request and returns the response", async () => {
      const mockResponse: ServiceChatResponse = {
        conversation_id: "conv-123",
        response: "Here is your pipeline YAML...",
      };
      vi.mocked(harnessClient.request).mockResolvedValue(mockResponse);

      const result = await intelligence.sendChat(makeChatRequest({ stream: false }));

      expect(harnessClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: IntelligenceClient.API_PATH,
          timeoutMs: IntelligenceClient.TIMEOUT_MS,
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it("populates harness_context in the request body", async () => {
      vi.mocked(harnessClient.request).mockResolvedValue({ conversation_id: "c" });

      await intelligence.sendChat(
        makeChatRequest({
          harness_context: { account_id: "a1", org_id: "o1", project_id: "p1" },
          stream: false,
        }),
      );

      const call = vi.mocked(harnessClient.request).mock.calls[0]![0] as { body: ServiceChatRequest };
      expect(call.body.harness_context).toEqual({
        account_id: "a1",
        org_id: "o1",
        project_id: "p1",
      });
    });

    it("sends orgIdentifier and projectIdentifier as query params", async () => {
      vi.mocked(harnessClient.request).mockResolvedValue({ conversation_id: "c" });

      await intelligence.sendChat(
        makeChatRequest({
          harness_context: { account_id: "a1", org_id: "myorg", project_id: "myproj" },
          stream: false,
        }),
      );

      const call = vi.mocked(harnessClient.request).mock.calls[0]![0] as { params: Record<string, string> };
      expect(call.params).toEqual({
        orgIdentifier: "myorg",
        projectIdentifier: "myproj",
      });
    });

    it("passes through conversation_id", async () => {
      vi.mocked(harnessClient.request).mockResolvedValue({ conversation_id: "existing-id" });

      const result = await intelligence.sendChat(
        makeChatRequest({ conversation_id: "existing-id", stream: false }),
      );

      expect(result.conversation_id).toBe("existing-id");
    });
  });

  describe("streaming", () => {
    it("accumulates SSE content events into a response", async () => {
      const body = sseStream(
        "event: content\ndata: Hello\n\n",
        "event: content\ndata: World\n\n",
        "event: error\ndata: eof\n\n",
      );
      vi.mocked(harnessClient.requestStream).mockResolvedValue(makeStreamResponse(body));

      const result = await intelligence.sendChat(makeChatRequest({ stream: true }));

      expect(result.response).toBe("HelloWorld");
      expect(result.error).toBeUndefined();
      expect(result.conversation_id).toBe("conv-123");
    });

    it("handles eof as normal termination (not an error)", async () => {
      const body = sseStream(
        "event: content\ndata: done\n\n",
        "event: error\ndata: eof\n\n",
      );
      vi.mocked(harnessClient.requestStream).mockResolvedValue(makeStreamResponse(body));

      const result = await intelligence.sendChat(makeChatRequest({ stream: true }));

      expect(result.error).toBeUndefined();
      expect(result.response).toBe("done");
    });

    it("captures real errors from the stream", async () => {
      const body = sseStream(
        "event: content\ndata: partial\n\n",
        "event: error\ndata: Internal service failure\n\n",
      );
      vi.mocked(harnessClient.requestStream).mockResolvedValue(makeStreamResponse(body));

      const result = await intelligence.sendChat(makeChatRequest({ stream: true }));

      expect(result.error).toBe("Internal service failure");
      expect(result.response).toBe("partial");
    });

    it("invokes onProgress callback for each event", async () => {
      const body = sseStream(
        "event: content\ndata: chunk1\n\n",
        "event: content\ndata: chunk2\n\n",
        "event: error\ndata: eof\n\n",
      );
      vi.mocked(harnessClient.requestStream).mockResolvedValue(makeStreamResponse(body));
      const onProgress = vi.fn();

      await intelligence.sendChat(makeChatRequest({ stream: true }), { onProgress });

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenCalledWith({ type: "content", data: "chunk1" });
      expect(onProgress).toHaveBeenCalledWith({ type: "content", data: "chunk2" });
      expect(onProgress).toHaveBeenCalledWith({ type: "error", data: "eof" });
    });

    it("handles empty body gracefully", async () => {
      const response = { ok: true, body: null } as unknown as Response;
      vi.mocked(harnessClient.requestStream).mockResolvedValue(response);

      const result = await intelligence.sendChat(makeChatRequest({ stream: true }));

      expect(result.response).toBe("");
      expect(result.conversation_id).toBe("conv-123");
    });

    it("handles chunked SSE data split across reads", async () => {
      // Split an event across two chunks
      const body = sseStream(
        "event: content\nda",
        "ta: split-data\n\nevent: error\ndata: eof\n\n",
      );
      vi.mocked(harnessClient.requestStream).mockResolvedValue(makeStreamResponse(body));

      const result = await intelligence.sendChat(makeChatRequest({ stream: true }));

      expect(result.response).toBe("split-data");
    });

    it("uses 300s timeout", async () => {
      const body = sseStream("event: error\ndata: eof\n\n");
      vi.mocked(harnessClient.requestStream).mockResolvedValue(makeStreamResponse(body));

      await intelligence.sendChat(makeChatRequest({ stream: true }));

      expect(harnessClient.requestStream).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: 300_000 }),
      );
    });
  });
});
