import type { ToolsetDefinition, BodySchema } from "../types.js";
import { passthrough, v1ListExtract } from "../extractors.js";

/**
 * Generate a UID from an agent name by converting to lowercase and replacing
 * spaces/special chars with underscores. E.g., "DevOps Assistant" -> "devops_assistant"
 */
function generateAgentUid(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const agentCreateSchema: BodySchema = {
  description: "Agent creation request. The 'spec' field contains the YAML specification defining the agent's behavior, stages, steps, rules, skills, MCP servers, and inputs. The API validates the spec format server-side.",
  fields: [
    { name: "uid", type: "string", required: true, description: "Unique identifier for the agent. Must be unique within the scope (account/org/project). Use lowercase with underscores, no spaces or colons (e.g., 'code_reviewer', 'devops_assistant'). Cannot conflict with system agent UIDs." },
    { name: "name", type: "string", required: true, description: "Display name of the agent (e.g., 'Code Reviewer', 'DevOps Assistant')" },
    { name: "description", type: "string", required: false, description: "Brief description of the agent's purpose and capabilities" },
    { name: "spec", type: "string", required: true, description: "Agent YAML specification. Defines stages, steps, container image, task, rules, skills, MCP servers, and inputs. Use harness_schema(resource_type='agent-pipeline') to explore the YAML structure." },
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

export const agentPipelinesToolset: ToolsetDefinition = {
  name: "agent-pipelines",
  displayName: "Agent Pipelines",
  description: "Custom AI agent definitions, configurations, and executions. Build agents that clone repos, run tasks, integrate with MCP servers, and execute multi-stage workflows.",
  resources: [
    {
      resourceType: "agent",
      displayName: "AI Agent",
      description: "Custom or system AI agent definition. Agents execute tasks using LLMs, can clone repos, run in containers, use MCP servers, and follow rules/skills. Supports CRUD operations.",
      toolset: "agent-pipelines",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["agent_id"],
      diagnosticHint:
        "If agent creation fails: (1) verify uid is unique and uses only lowercase/underscores, " +
        "(2) validate spec YAML with harness_schema(resource_type='agent-pipeline'), " +
        "(3) ensure connectors referenced in spec exist (e.g., account.harnessImage), " +
        "(4) confirm secrets referenced via <+secrets.getValue(...)> are created in Harness. " +
        "Only custom agents (role='custom') can be updated or deleted; system agents are read-only.",
      listFilterFields: [
        { name: "search_term", description: "Filter agents by name or keyword" },
        { name: "role", description: "Filter by agent role", enum: ["system", "custom"] },
        { name: "status", description: "Filter by agent status", enum: ["active", "inactive", "deleted"] },
      ],
      relatedResources: [
        { resourceType: "agent_run", relationship: "child", description: "Execution runs for this agent" },
        { resourceType: "pipeline", relationship: "related", description: "Agents extend pipeline constructs and share schema elements" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/agents/{agentIdentifier}/details",
      operations: {
        list: {
          method: "GET",
          path: "/gateway/agents/api/v1/agents",
          queryParams: {
            search_term: "searchTerm",
            role: "role",
            status: "status",
            page: "page",
            size: "size",
          },
          responseExtractor: v1ListExtract(),
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
          description: "Delete a custom agent (soft delete — sets status to 'deleted'). Only custom agents can be deleted.",
        },
      },
    },
    {
      resourceType: "agent_run",
      displayName: "Agent Execution Run",
      description: "Agent execution history. Lists past runs for a specific agent with execution ID, status, and timestamps.",
      toolset: "agent-pipelines",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["agent_id"],
      diagnosticHint:
        "Runs are scoped to a specific agent — you must provide agent_id. " +
        "If no runs appear, verify the agent has been executed at least once.",
      relatedResources: [
        { resourceType: "agent", relationship: "parent", description: "The agent definition this run belongs to" },
      ],
      listFilterFields: [
        { name: "agent_id", description: "Agent identifier to list runs for", required: true },
        { name: "status", description: "Execution status filter", enum: ["pending", "running", "success", "failed"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/agents/{agentIdentifier}/runs",
      operations: {
        list: {
          method: "GET",
          path: "/gateway/agents/api/v1/agents/{agentIdentifier}/runs",
          pathParams: { agent_id: "agentIdentifier" },
          queryParams: {
            status: "status",
            page: "page",
            size: "size",
          },
          responseExtractor: (raw: unknown): { items: unknown[]; total: number } => {
            const resp = raw as { runs?: unknown[]; total?: number };
            const items = resp.runs ?? (Array.isArray(raw) ? raw as unknown[] : []);
            return { items, total: resp.total ?? items.length };
          },
          description: "List execution runs for an agent. Returns execution_id, status, started_at, finished_at.",
        },
      },
    },
  ],
};
