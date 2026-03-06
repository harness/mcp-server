import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError } from "../utils/errors.js";

export function registerGetTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_get",
    "Get a specific Harness resource by ID. Call harness_describe to discover available resource_types, or harness_describe with search_term to find specific ones.",
    {
      resource_type: z.string().describe("The type of resource to get (e.g. pipeline, service, environment)"),
      resource_id: z.string().describe("The primary identifier of the resource"),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      // Secondary identifiers for nested resources
      pipeline_id: z.string().describe("Pipeline ID (for triggers, input sets)").optional(),
      environment_id: z.string().describe("Environment ID (for infrastructure)").optional(),
      agent_id: z.string().describe("GitOps agent ID (for agent sub-resources)").optional(),
      repo_id: z.string().describe("Repository ID (for pull requests)").optional(),
      registry_id: z.string().describe("Registry ID (for artifacts)").optional(),
      artifact_id: z.string().describe("Artifact ID (for versions)").optional(),
      environment: z.string().describe("Feature flag environment").optional(),
      version_label: z.string().describe("Template version label").optional(),
    },
    async (args) => {
      try {
        const def = registry.getResource(args.resource_type);

        // Map resource_id to the primary identifier field
        const input: Record<string, unknown> = { ...args };
        if (def.identifierFields.length > 0 && args.resource_id) {
          input[def.identifierFields[0]] = args.resource_id;
        }

        const result = await registry.dispatch(client, args.resource_type, "get", input);
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
