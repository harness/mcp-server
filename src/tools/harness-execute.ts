import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";

export function registerExecuteTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_execute",
    "Execute an action on a Harness resource: run/retry/interrupt pipelines, toggle feature flags, test connectors, sync GitOps apps, run chaos experiments.",
    {
      resource_type: z.string().describe("The resource type (e.g. pipeline, execution, feature_flag, connector, gitops_application, chaos_experiment)"),
      action: z.string().describe("The action to execute (e.g. run, retry, interrupt, toggle, test_connection, sync)"),
      resource_id: z.string().describe("The primary identifier of the resource").optional(),
      confirmation: z.boolean().describe("Must be true to confirm execution").default(false),
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
      module: z.string().describe("Harness module (CD, CI)").optional(),
      inputs: z.record(z.string(), z.unknown()).describe("Runtime inputs for pipeline execution").optional(),
      interrupt_type: z.string().describe("Interrupt type (AbortAll, Pause, Resume, etc.)").optional(),
      enable: z.boolean().describe("Enable/disable for feature flag toggle").optional(),
      environment: z.string().describe("Target environment for feature flag operations").optional(),
      body: z.record(z.string(), z.unknown()).describe("Additional body payload for the action").optional(),
    },
    async (args) => {
      try {
        if (!args.confirmation) {
          // Show available actions for the resource type
          const actions = registry.getExecuteActions(args.resource_type);
          if (!actions) {
            return errorResult(`Resource "${args.resource_type}" has no execute actions.`);
          }
          const actionList = Object.entries(actions)
            .map(([name, spec]) => `  - ${name}: ${spec.actionDescription}`)
            .join("\n");
          return errorResult(
            `Execute operations require confirmation=true.\n\nAvailable actions for "${args.resource_type}":\n${actionList}`,
          );
        }

        // Map resource_id to the primary identifier field
        const def = registry.getResource(args.resource_type);
        const input: Record<string, unknown> = { ...args };
        if (def.identifierFields.length > 0 && args.resource_id) {
          input[def.identifierFields[0]] = args.resource_id;
        }

        const result = await registry.dispatchExecute(client, args.resource_type, args.action, input);
        return jsonResult(result);
      } catch (err) {
        if (err instanceof Error && (err.message.startsWith("Unknown resource_type") || err.message.includes("no execute action"))) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}
