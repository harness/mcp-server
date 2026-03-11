import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { ACTION_VALUES } from "../client/dto/intelligence.js";
import type { ServiceChatRequest } from "../client/dto/intelligence.js";
import { IntelligenceClient } from "../client/intelligence-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { sendProgress, sendLog } from "../utils/progress.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("ask");

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

  server.registerTool(
    "harness_ask",
    {
      description:
        "Ask the Harness AI DevOps Agent to create or update entities (pipelines, environments, connectors, services, secrets) via natural language. " +
        "Returns generated YAML and automatically persists it in Harness (auto-accepts). " +
        "Set auto_accept to false to review the YAML before persisting. " +
        "For multi-turn refinement, pass the returned conversation_id back with a REGENERATE prompt.",
      inputSchema: {
        prompt: z.string().min(1).describe("The natural language prompt for the AI DevOps agent"),
        action: z.enum(ACTION_VALUES).describe("The action to perform (e.g. CREATE_PIPELINE, UPDATE_SERVICE)"),
        stream: z.boolean().describe("Stream the response with real-time progress").default(true).optional(),
        auto_accept: z.boolean().describe("Automatically ACCEPT the generated entity to persist it in Harness (default: true). Set to false to only preview the YAML.").default(true).optional(),
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
        const conversationId = args.conversation_id ?? crypto.randomUUID();
        const shouldStream = args.stream ?? true;
        const autoAccept = args.auto_accept ?? true;

        const harnessContext = {
          account_id: client.account,
          org_id: args.org_id ?? config.HARNESS_DEFAULT_ORG_ID,
          project_id: args.project_id ?? config.HARNESS_DEFAULT_PROJECT_ID,
        };

        const chatRequest: ServiceChatRequest = {
          harness_context: harnessContext,
          prompt: args.prompt,
          action: args.action,
          conversation_id: conversationId,
          context: args.context,
          stream: shouldStream,
        };

        log.info("Calling intelligence service", {
          action: args.action,
          stream: shouldStream,
          autoAccept,
          conversationId,
        });

        let eventCount = 0;
        const makeOnProgress = () =>
          shouldStream
            ? (event: { type: string; data: string }) => {
                eventCount++;
                sendProgress(extra, eventCount, undefined, `SSE: ${event.type}`).catch(() => {});
                sendLog(extra, "debug", "intelligence", `[${event.type}] ${event.data.slice(0, 200)}`).catch(() => {});
              }
            : undefined;

        const result = await intelligenceClient.sendChat(chatRequest, {
          signal: extra.signal,
          onProgress: makeOnProgress(),
        });

        if (result.error) {
          return errorResult(result.error);
        }

        const hasAccept = result.capabilities_to_run?.some(
          (cap) => JSON.stringify(cap).includes("ACCEPT"),
        );

        // Auto-ACCEPT: send a follow-up to persist the entity in Harness
        if (autoAccept && hasAccept) {
          log.info("Auto-accepting generated entity", { conversationId });
          sendLog(extra, "info", "intelligence", "Auto-accepting to persist in Harness...").catch(() => {});

          const acceptRequest: ServiceChatRequest = {
            harness_context: harnessContext,
            prompt: "ACCEPT",
            action: args.action,
            conversation_id: result.conversation_id,
            stream: shouldStream,
          };

          const acceptResult = await intelligenceClient.sendChat(acceptRequest, {
            signal: extra.signal,
            onProgress: makeOnProgress(),
          });

          if (acceptResult.error) {
            // ACCEPT failed — return the original YAML so the user still has it
            return jsonResult({
              conversation_id: result.conversation_id,
              response: result.response,
              accept_error: acceptResult.error,
              persisted: false,
            });
          }

          return jsonResult({
            conversation_id: acceptResult.conversation_id,
            response: acceptResult.response ?? result.response,
            persisted: true,
          });
        }

        // No auto-accept: return YAML with guidance for manual follow-up
        const response: Record<string, unknown> = {
          conversation_id: result.conversation_id,
          response: result.response,
          persisted: false,
        };

        if (result.capabilities_to_run?.length) {
          response.available_actions = result.capabilities_to_run;
          response.next_step =
            `To persist this entity, call harness_ask again with conversation_id "${result.conversation_id}", ` +
            `prompt "ACCEPT", and the same action. Do NOT use harness_create/harness_update.`;
        }

        return jsonResult(response);
      } catch (err) {
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
