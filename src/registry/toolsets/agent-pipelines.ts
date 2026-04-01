import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough } from "../extractors.js";

/**
 * Generate a UID from an agent name by converting to lowercase and replacing
 * spaces/special chars with underscores. E.g., "DevOps Assistant" -> "devops_assistant"
 */
function generateAgentUid(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores
}

const agentCreateSchema: BodySchema = {
  description: "Agent creation request. The 'spec' field contains the YAML specification defining the agent's behavior, stages, steps, rules, skills, MCP servers, and inputs. The API validates the spec format server-side.",
  fields: [
    { name: "uid", type: "string", required: true, description: "Unique identifier for the agent. Must be unique within the scope (account/org/project). Use lowercase with underscores, no spaces or colons (e.g., 'code_reviewer', 'devops_assistant'). Cannot conflict with system agent UIDs." },
    { name: "name", type: "string", required: true, description: "Display name of the agent (e.g., 'Code Reviewer', 'DevOps Assistant')" },
    { name: "description", type: "string", required: false, description: "Brief description of the agent's purpose and capabilities" },
    { name: "spec", type: "string", required: true, description: "Agent YAML specification. Defines stages, steps, container image, task, rules, skills, MCP servers, and inputs. See harness_describe or create-agent prompt for examples." },
    { name: "wiki", type: "string", required: false, description: "Markdown documentation for the agent (usage guide, features, examples)" },
    { name: "logo", type: "string", required: false, description: "URL to the agent's logo image" },
  ],
};

const agentUpdateSchema: BodySchema = {
  description: "Agent update request. All fields are optional. Only provided fields will be updated. The 'spec' field replaces the entire agent specification.",
  fields: [
    { name: "name", type: "string", required: false, description: "Updated display name" },
    { name: "description", type: "string", required: false, description: "Updated description" },
    { name: "spec", type: "string", required: false, description: "Updated agent YAML specification (full replacement)" },
    { name: "wiki", type: "string", required: false, description: "Updated markdown documentation" },
    { name: "logo", type: "string", required: false, description: "Updated logo URL" },
  ],
};

// Execute schema - matches OpenAPI ExecuteAgentRequest
// TODO: Uncomment when execute endpoint is ready for production use
// const agentExecuteSchema: BodySchema = {
//   description: "Agent execution request. Provide runtime inputs as YAML string with 'inputs:' top-level key. The inputs should match the agent's input schema defined in the spec.",
//   fields: [
//     { name: "inputs_yaml", type: "string", required: false, description: "YAML-formatted runtime inputs for the agent. Must have 'inputs:' as top-level key. Example: 'inputs:\\n  anthropicKey: myKey\\n  repo: hello-world\\n  branch: main'" },
//   ],
// };

export const agentPipelinesToolset: ToolsetDefinition = {
  name: "agent-pipelines",
  displayName: "Agent Pipelines",
  description: "Custom AI agent definitions, configurations, and executions. Build agents that clone repos, run tasks, integrate with MCP servers, and execute multi-stage workflows.",
  resources: [
    {
      resourceType: "agent",
      displayName: "AI Agent",
      description: "Custom or system AI agent definition. Agents execute tasks using LLMs, can clone repos, run in containers, use MCP servers, and follow rules/skills. Supports CRUD and execution.",
      toolset: "agent-pipelines",
      scope: "project",
      scopeOptional: false,
      identifierFields: ["agent_id"],
      executeHint: "Before executing, inspect the agent's spec (harness_get) to see required inputs. Then provide inputs as YAML via the inputs_yaml field.",
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/agents/{agentIdentifier}/details",
      operations: {
        list: {
          method: "GET",
          path: "/gateway/agents/api/v1/agents",
          responseExtractor: passthrough,
          description: "List all agents (system and custom) scoped to the account/org/project context",
        },
        get: {
          method: "GET",
          path: "/gateway/agents/api/v1/agents/{agentIdentifier}",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "Get agent details including YAML spec, role, status, timestamps, wiki, and logo",
        },
        create: {
          method: "POST",
          path: "/gateway/agents/api/v1/agents",
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body) throw new Error("body is required for agent creation");

            // Ensure uid is present - generate from name if not provided
            if (!body.uid && body.name) {
              body.uid = generateAgentUid(body.name as string);
            }

            if (!body.uid) {
              throw new Error("uid is required (or name must be provided to generate uid)");
            }

            return body;
          },
          responseExtractor: passthrough,
          description: "Create a new custom agent with YAML specification. System agents cannot be created via API. The uid field is required and must be unique within the scope.",
          bodySchema: agentCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/gateway/agents/api/v1/agents/{agentIdentifier}",
          pathParams: { agent_id: "agentIdentifier" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body) throw new Error("body is required for agent update");
            return body;
          },
          responseExtractor: passthrough,
          description: "Update a custom agent. All fields are optional. Only custom agents can be updated (role='custom').",
          bodySchema: agentUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/gateway/agents/api/v1/agents/{agentIdentifier}",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: passthrough,
          description: "Delete a custom agent (soft delete - sets status to 'deleted'). Only custom agents can be deleted.",
        },
      },
      // Execute endpoint - matches POST /api/v1/agents/{agent_id}/execute from OpenAPI spec
      // TODO: Uncomment when backend endpoint is ready for production use
      // executeActions: {
      //   run: {
      //     method: "POST",
      //     path: "/gateway/agents/api/v1/agents/{agentIdentifier}/execute",
      //     pathParams: { agent_id: "agentIdentifier" },
      //     bodyBuilder: (input) => {
      //       const body = input.body as Record<string, unknown> | undefined;
      //       // Handle inputs_yaml field - optional per OpenAPI spec
      //       const inputs_yaml = body?.inputs_yaml ?? "";
      //       return { inputs_yaml };
      //     },
      //     responseExtractor: passthrough,
      //     actionDescription: "Execute an agent with runtime inputs. Returns execution_details with execution_id and status. Check the agent's spec first to see required inputs.",
      //     bodySchema: agentExecuteSchema,
      //   },
      // },
    },
    {
      resourceType: "agent_run",
      displayName: "Agent Execution Run",
      description: "Agent execution history. Lists past runs for a specific agent with execution ID, status, and timestamps.",
      toolset: "agent-pipelines",
      scope: "project",
      scopeOptional: false,
      identifierFields: ["agent_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/agents/{agentIdentifier}/runs",
      operations: {
        list: {
          method: "GET",
          path: "/gateway/agents/api/v1/agents/{agentIdentifier}/runs",
          pathParams: { agent_id: "agentIdentifier" },
          responseExtractor: (raw) => {
            const resp = raw as { runs?: unknown[] };
            return resp.runs ?? [];
          },
          description: "List execution runs for an agent. Returns execution_id, status, started_at, finished_at.",
        },
      },
    },
  ],
};
