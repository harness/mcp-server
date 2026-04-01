import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreateAgentPrompt(server: McpServer): void {
  server.registerPrompt(
    "create-agent",
    {
      description: "Guide to create or update a custom AI agent with rules, skills, MCP servers, and multi-stage execution",
      argsSchema: {
        agent_name: z.string().describe("Name for the custom agent"),
        task_description: z.string().describe("What the agent should do"),
        org_id: z.string().describe("Organization identifier").optional(),
        project_id: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ agent_name, task_description, org_id, project_id }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create or update a custom AI agent pipeline for:

**Agent Name**: ${agent_name}
**Task**: ${task_description}
**Scope**: ${org_id ? `Org: ${org_id}` : "Account-level"}${project_id ? `, Project: ${project_id}` : ""}

> **This is INTERACTIVE — show YAML for review and wait for confirmation before creating/updating the agent.**

---

## Step 1: Check Existing Agents

Before creating a new agent, check if an existing one can solve the use case.

1. Call \`harness_list(resource_type="agent"${org_id ? `, org_id="${org_id}"` : ""}${project_id ? `, project_id="${project_id}"` : ""})\` to list existing agents
2. If a matching agent exists, offer to update it instead via \`harness_get\` → \`harness_update\`

## Step 2: Gather Requirements

Ask the user to clarify:
1. **Goal**: What specific outcome should the agent achieve?
2. **Inputs**: What data/context does the agent need? (repo, branch, secrets, thresholds)
3. **Outputs**: What artifacts or actions should result? (files, PRs, comments, reports)
4. **Workflow**: Step-by-step process — what happens in order?
5. **Constraints**: Rules, coding standards, limitations the agent must follow
6. **MCP servers**: External services needed? (GitHub, Slack, Harness, Jira, etc.)
7. **Definition of done**: How do you know the agent succeeded?

## Step 3: Build the Agent Spec

Use \`harness_schema(resource_type="agent-pipeline")\` for a top-level summary. Drill into sections with the \`path\` parameter (e.g. \`path="Agent"\` for agent structure, \`path="stages"\` for stages).

**CRITICAL**: Agent specs use \`version: 1\` + \`agent:\` format, NOT \`pipeline:\` format. The agent YAML extends pipeline constructs — you can mix agent steps (\`agent:\` with \`task\`, \`rules\`, \`mcp_servers\`) and traditional steps (\`run:\` with \`shell\`/\`script\`).

Assemble the spec:
1. Start with \`version: 1\` and \`agent:\`
2. Add \`clone:\` if the task requires a repository (depth: 1000 for PRs, depth: 1 for branches)
3. Create \`stages:\` with platform (linux/arm64) and steps
4. For each agent step, include:
   - \`container:\` — use \`account.harnessImage\` connector with Claude Code plugin image
   - \`env:\` — Bedrock configuration (ANTHROPIC_MODEL, AWS_BEARER_TOKEN_BEDROCK, AWS_REGION, CLAUDE_CODE_USE_BEDROCK)
   - \`task:\` — detailed step-by-step instructions for the agent
   - \`rules:\` — user preferences and constraints as bullet points
   - \`mcp_servers:\` — external service connections with auth headers
   - \`with.allowed_tools:\` — tools the agent can use (e.g. \`Read,Write,Bash,mcp__github__*\`)
   - \`max_turns:\` — 100–200 depending on complexity
5. Add \`inputs:\` section only if runtime parameters are needed (types: string, secret, boolean; reference with \`<+inputs.fieldName>\`)

**Defaults** (use unless user specifies otherwise):
- Platform: linux/arm64
- Container: \`pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/claude-code-plugin:main\`
- Secrets: reference via \`<+secrets.getValue("key")>\` — remind user to create in Harness UI
- Connectors: reference by identifier — must exist before execution

**MCP server connections:**
- GitHub: \`url: https://api.githubcopilot.com/mcp/\` with \`Authorization: Bearer <+secrets.getValue("github_pat")>\`
- Other MCPs: use their public URL with Bearer token auth via secrets
- Allow MCP tools with: \`mcp__<server_name>__*\` in \`allowed_tools\`

## Step 4: Present for Review

Show the complete agent configuration:
- Agent metadata (name, uid, description)
- Full spec YAML
- List of required secrets and connectors the user must set up

**Wait for explicit confirmation before proceeding.**

## Step 5: Create or Update

After confirmation:
- **New agent**: \`harness_create(resource_type="agent", body={uid, name, description, spec, wiki?, logo?})\`
  - \`uid\` auto-generates from \`name\` if not provided (e.g. "Code Coverage Agent" → "code_coverage_agent")
- **Update existing**: \`harness_update(resource_type="agent", agent_id="...", body={...only changed fields...})\`
  - Only custom agents (role='custom') can be updated
  - \`spec\` replaces the entire specification when provided

Use \`harness_describe(resource_type="agent")\` to see all supported fields and operations.`,
        },
      }],
    }),
  );
}
