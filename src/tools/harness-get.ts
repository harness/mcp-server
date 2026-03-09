import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

export function registerGetTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.registerTool(
    "harness_get",
    {
      description: "Get a specific Harness resource by ID. You can pass a Harness URL to auto-extract org, project, resource type, and resource ID. For troubleshooting failures or health issues, prefer harness_diagnose — it combines multiple API calls with domain-specific analysis. Call harness_describe to discover available resource_types and which support diagnosis.",
      inputSchema: {
        resource_type: z.string().describe("The type of resource to get (e.g. pipeline, service, environment). Auto-detected from url if provided.").optional(),
        resource_id: z.string().describe("The primary identifier of the resource. Auto-detected from url if provided.").optional(),
        url: z.string().describe("A Harness UI URL — org, project, resource type, and ID are extracted automatically").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers for nested resources (e.g. pipeline_id, environment_id, agent_id, repo_id, version_label). Call harness_describe for required fields per resource_type.").optional(),
      },
      annotations: {
        title: "Get Harness Resource",
        readOnlyHint: true,
        openWorldHint: true,
      },
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

        const def = registry.getResource(resourceType);

        // Map resource_id to the primary identifier field
        if (def.identifierFields.length > 0 && resourceId) {
          input[def.identifierFields[0]] = resourceId;
        }

        const result = await registry.dispatch(client, resourceType, "get", input);
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
