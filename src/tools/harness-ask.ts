import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { ACTION_VALUES } from "../client/dto/intelligence.js";
import type { ServiceChatRequest } from "../client/dto/intelligence.js";
import { IntelligenceClient } from "../client/intelligence-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { HarnessApiError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { sendProgress, sendLog } from "../utils/progress.js";
import { RateLimiter } from "../utils/rate-limiter.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ask");

// 5 requests/minute with burst of 3 — each call triggers LLM inference on Harness's backend
const ASK_MAX_BURST = 3;
const ASK_REFILL_RATE_PER_MS = 5 / 60_000; // 5 tokens per 60s

export function registerAskTool(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
): void {
  // Skip registration in read-only mode (this is a write tool)
  if (config.HARNESS_READ_ONLY) return;

  // Skip registration when HARNESS_TOOLSETS is set but doesn't include "intelligence"
  const enabledToolsets = registry.getAllToolsets();
  if (config.HARNESS_TOOLSETS && !enabledToolsets.some((t) => t.name === "intelligence")) {
    return;
  }

  const intelligenceClient = new IntelligenceClient(client);
  const askRateLimiter = new RateLimiter(ASK_MAX_BURST, ASK_REFILL_RATE_PER_MS);

  server.registerTool(
    "harness_ask",
    {
      description:
        "Ask the Harness AI DevOps Agent to create or update entities (pipelines, environments, connectors, services, secrets) via natural language. " +
        "The entity is persisted in Harness automatically on the initial call. " +
        "For multi-turn refinement, pass the returned conversation_id back.",
      inputSchema: {
        prompt: z.string().min(1).describe("The natural language prompt for the AI DevOps agent"),
        action: z.enum(ACTION_VALUES).describe("The action to perform (e.g. CREATE_PIPELINE, UPDATE_SERVICE)"),
        stream: z.boolean().describe("Stream the response with real-time progress (default: false for reliability)").default(false).optional(),
        conversation_id: z
          .string()
          .describe("Conversation ID for multi-turn context (auto-generated if omitted)")
          .optional(),
        context: z
          .array(
            z.object({
              type: z.string().describe("Context item type"),
              payload: z.unknown().describe("Context payload (for UPDATE operations: existing YAML string)"),
            }),
          )
          .describe("Context for UPDATE operations — pass existing YAML to modify")
          .optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
      },
      annotations: {
        title: "Ask AI DevOps Agent",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args, extra) => {
      try {
        await askRateLimiter.acquire();

        const conversationId = args.conversation_id ?? crypto.randomUUID();

        const harnessContext = {
          account_id: client.account,
          org_id: args.org_id ?? config.HARNESS_DEFAULT_ORG_ID,
          project_id: args.project_id ?? config.HARNESS_DEFAULT_PROJECT_ID,
        };

        let eventCount = 0;
        const onProgress = args.stream
          ? (event: { type: string; data: string }) => {
              eventCount++;
              sendProgress(extra, eventCount, undefined, `SSE: ${event.type}`).catch(() => {});
              sendLog(extra, "debug", "intelligence", `[${event.type}] ${event.data.slice(0, 200)}`).catch(() => {});
            }
          : undefined;

        const chatRequest: ServiceChatRequest = {
          harness_context: harnessContext,
          prompt: args.prompt,
          action: args.action,
          conversation_id: conversationId,
          context: args.context,
          stream: args.stream ?? false,
        };

        log.info("Calling intelligence service", {
          action: args.action,
          stream: chatRequest.stream,
          conversationId,
        });

        // Send request, falling back to non-streaming if streaming returns 422
        let result;
        if (chatRequest.stream) {
          try {
            result = await intelligenceClient.sendChat(chatRequest, {
              signal: extra.signal,
              onProgress,
            });
          } catch (streamErr) {
            if (streamErr instanceof HarnessApiError && streamErr.statusCode === 422) {
              log.warn("Streaming returned 422, falling back to non-streaming");
              result = await intelligenceClient.sendChat({ ...chatRequest, stream: false }, {
                signal: extra.signal,
              });
            } else {
              throw streamErr;
            }
          }
        } else {
          result = await intelligenceClient.sendChat(chatRequest, { signal: extra.signal });
        }

        const effectiveConversationId = result.conversation_id || conversationId;

        if (result.error) {
          return errorResult(result.error);
        }

        return jsonResult({
          conversation_id: effectiveConversationId,
          response: result.response,
        });
      } catch (err) {
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
