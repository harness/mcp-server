import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError, HarnessApiError } from "../utils/errors.js";
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
      // Dynamic fields for various actions
      pipeline_id: z.string().describe("Pipeline identifier").optional(),
      execution_id: z.string().describe("Execution identifier").optional(),
      flag_id: z.string().describe("Feature flag identifier").optional(),
      connector_id: z.string().describe("Connector identifier").optional(),
      agent_id: z.string().describe("GitOps agent identifier").optional(),
      app_name: z.string().describe("GitOps application name").optional(),
      experiment_id: z.string().describe("Chaos experiment identifier").optional(),
      approval_id: z.string().describe("Approval instance identifier for approve/reject actions").optional(),
      comments: z.string().describe("Comments for approval/rejection").optional(),
      approver_inputs: z.array(z.record(z.string(), z.string())).describe("Approver inputs as [{name, value}] for approval actions").optional(),
      module: z.string().describe("Harness module (CD, CI)").optional(),
      inputs: z.record(z.string(), z.unknown()).describe("Runtime inputs for pipeline execution").optional(),
      interrupt_type: z.string().describe("Interrupt type (AbortAll, Pause, Resume, etc.)").optional(),
      enable: z.boolean().describe("Enable/disable for feature flag toggle").optional(),
      environment: z.string().describe("Target environment for feature flag operations").optional(),
      body: z.record(z.string(), z.unknown()).describe("Additional body payload for the action").optional(),
    },
    async (args) => {
      try {
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);
        const resourceType = input.resource_type as string | undefined;
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        const resourceId = input.resource_id as string | undefined;

        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_execute",
          message: `Execute "${args.action}" on ${resourceType}${resourceId ? ` "${resourceId}"` : ""}?`,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }

        // Map resource_id to the primary identifier field
        const def = registry.getResource(resourceType);
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
        throw toMcpError(err);
      }
    },
  );
}
