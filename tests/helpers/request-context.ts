import { vi } from "vitest";

export interface ConfirmationAnswer {
  action: "accept" | "decline" | "cancel";
  content?: Record<string, unknown>;
}

/** v2 handler context. Handlers read the abort signal and progress token from `mcpReq`. */
export function toolHandlerContext(
  signal: AbortSignal = new AbortController().signal,
  confirmation?: ConfirmationAnswer,
) {
  return {
    mcpReq: {
      id: 1,
      method: "tools/call",
      signal,
      _meta: {} as Record<string, unknown>,
      notify: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue({}),
      log: vi.fn().mockResolvedValue(undefined),
      requestState: () => undefined,
      inputResponses: confirmation ? { confirm: confirmation } : undefined,
    },
  };
}

export const ACCEPTED_CONFIRMATION: ConfirmationAnswer = { action: "accept", content: { confirm: true } };

/**
 * Field map of a registered tool input schema. v2 passes a Zod object;
 * older fixtures still store a raw shape.
 */
export function inputShape<T extends Record<string, unknown>>(schema: { inputSchema: T | { shape: T } }): T {
  const input = schema.inputSchema as { shape?: T };
  if (input && typeof input === "object" && input.shape && typeof input.shape === "object") {
    return input.shape;
  }
  return schema.inputSchema as T;
}
