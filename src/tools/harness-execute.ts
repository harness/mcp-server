import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError, HarnessApiError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { createLogger } from "../utils/logger.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

const log = createLogger("execute");

export function registerExecuteTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_execute",
    "Execute an action on a Harness resource: run/retry/interrupt pipelines, toggle feature flags, test connectors, sync GitOps apps, run chaos experiments. You can pass a Harness URL to auto-extract identifiers.",
    {
      resource_type: z.string().describe("The resource type (e.g. pipeline, execution, feature_flag, connector, gitops_application, chaos_experiment). Auto-detected from url if provided.").optional(),
      url: z.string().describe("A Harness UI URL — org, project, resource type, and ID are extracted automatically").optional(),
      action: z.string().describe("The action to execute (e.g. run, retry, interrupt, toggle, test_connection, sync)"),
      resource_id: z.string().describe("The primary identifier of the resource").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      inputs: z.record(z.string(), z.unknown()).describe("Runtime inputs for pipeline execution").optional(),
      body: z.record(z.string(), z.unknown()).describe("Additional body payload for the action").optional(),
      params: z.record(z.string(), z.unknown()).describe("Action-specific parameters (e.g. pipeline_id, execution_id, flag_id, agent_id, interrupt_type, enable, environment, module). Call harness_describe for available actions and fields per resource_type.").optional(),
    },
    async (args) => {
      try {
        const { params, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        if (params) Object.assign(input, params);
        const resourceType = input.resource_type as string | undefined;
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        const resourceId = input.resource_id as string | undefined;

        // Validate resource_type and action before asking user to confirm
        const def = registry.getResource(resourceType);
        if (!def.executeActions?.[args.action]) {
          const available = def.executeActions ? Object.keys(def.executeActions).join(", ") : "none";
          return errorResult(`Resource "${resourceType}" has no execute action "${args.action}". Available: ${available}`);
        }

        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_execute",
          message: `Execute "${args.action}" on ${resourceType}${resourceId ? ` "${resourceId}"` : ""}?`,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }

        // Map resource_id to the primary identifier field
        if (def.identifierFields.length > 0 && resourceId) {
          input[def.identifierFields[0]] = resourceId;
        }

        let result: unknown;
        try {
          result = await registry.dispatchExecute(client, resourceType, args.action, input);
        } catch (err) {
          // If retry fails with 405, fall back to a fresh pipeline run
          if (
            args.action === "retry" &&
            resourceType === "pipeline" &&
            err instanceof HarnessApiError &&
            err.statusCode === 405
          ) {
            log.info("Retry returned 405, falling back to fresh pipeline run");
            let pipelineId = input.pipeline_id as string | undefined;

            // Resolve pipeline_id from execution if not provided
            if (!pipelineId && input.execution_id) {
              try {
                const exec = await registry.dispatch(client, "execution", "get", input) as Record<string, unknown>;
                const pes = exec?.pipelineExecutionSummary as Record<string, unknown> | undefined;
                pipelineId = pes?.pipelineIdentifier as string | undefined;
              } catch {
                // Fall through — will error below
              }
            }

            if (!pipelineId) {
              return errorResult("Retry is not available for this execution (405). Provide pipeline_id to run a fresh execution instead.");
            }

            input.pipeline_id = pipelineId;
            result = await registry.dispatchExecute(client, "pipeline", "run", input);
            return jsonResult({ ...result as Record<string, unknown>, _note: "Retry was not available (405). Executed a fresh pipeline run instead." });
          }
          throw err;
        }

        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
