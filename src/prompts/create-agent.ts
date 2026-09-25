import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreateAgentPrompt(server: McpServer): void {
  server.registerPrompt(
    "create-agent",
    {
      description: "Create and update Harness AI agent instances - standalone templates used as building blocks in pipelines. New agents instantiate the shared harnessAI@1.0.0 base template via agent.uses/agent.with, requiring a connector (LLM access) and optional mcp connectors (GitHub, Slack, Harness platform). Updating an existing agent detects and preserves its current spec format (current agent.uses format, or legacy agent.step.group.steps format) rather than migrating it. Supports runtime inputs and task/rules-based instruction.",
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
          text: `Create or update a custom AI agent for:

**Agent Name**: ${agent_name}
**Task**: ${task_description}
**Scope**: ${org_id ? `Org: ${org_id}` : "Account-level"}${project_id ? `, Project: ${project_id}` : ""}

> **This is INTERACTIVE — show YAML for review and wait for confirmation before creating/updating the agent.**

---

## Phase 1: Check Existing Solutions First

**IMPORTANT: Before creating a new agent, check if an existing one can solve the use case.**

1. **List existing agents** — Call \`harness_list\` with \`resource_type="agent"\`${org_id ? ` and \`org_id="${org_id}"\`` : ""}${project_id ? ` and \`project_id="${project_id}"\`` : ""}
   - Check if any system or custom agents already exist that can handle this task
   - Ask user if they want to use/modify an existing agent instead of creating new

2. **For updating existing agents** — Use \`harness_get\` with \`resource_type="agent"\` and \`agent_id\` to retrieve the current agent configuration
   - Review the current \`spec\`, \`name\`, \`description\`, and other fields
   - **Detect the spec format before doing anything else** — this determines which path (Current Format or Legacy Format) the rest of Phase 2/3 must follow:
     - \`agent.uses\` present (e.g. \`uses: harnessAI@1.0.0\`) → **Current Format**
     - **Anything else → Legacy Format.** \`agent.step.group.steps\` is the most common legacy shape, but legacy agents also appear as \`agent.step.run\` with the container step directly under \`step\`, and task config in either a \`run.env\` \`PLUGIN_*\` block or a \`run.with\` block (\`task\`, \`max_turns\`, \`mcp_format\`, \`mcp_servers\`). If the spec is not \`agent.uses\`, treat it as Legacy Format and edit it in place, preserving its existing shape.
     - A \`with:\` block on its own is **not** a Current Format signal — legacy \`agent.step.run\` specs have one too. Only \`agent.uses\` at the top of \`agent\` means Current Format.
     - When Legacy Format is detected, read the \`agent-docs:///legacy-format\` MCP resource in full **now**, before proceeding to Phase 2. It is self-contained (structure, spec-generation steps, worked example, and v0-pipeline usage) — reading it once here covers the rest of this workflow, so you should not need to re-read it at later phases.
   - Identify what needs to be changed (spec, name, description, wiki, logo)
   - Use \`harness_update\` (not \`harness_create\`) to update the agent with only the fields that need modification
   - **Never convert a Legacy Format agent to Current Format (or vice versa) during a routine update.** Keep editing in whatever format the agent already uses unless the user explicitly asks for a migration to the current format.

---

## Phase 2: Requirements Gathering

If creating a new agent or updating an existing one, collect the following before generating YAML.

**Format applies throughout Phase 2 §3–4 and Phase 3: creating a new agent always targets Current Format. Updating an existing agent targets whichever format Phase 1 detected for that agent — Current Format or Legacy Format.**

### 1. Agent Metadata
- **Name**: Display name for the agent (e.g. "Code Coverage Agent", "PR Reviewer")
- **Description**: Brief description of the agent's purpose (optional)
- **UID/UUID**: Always generate this from the name and pass it explicitly to create/update APIs. Do not rely on the create API fallback.
  - Generation rule: prefix with \`ca_\`, then lowercase the name, convert spaces and hyphens (\`-\`) to \`_\`, replace any remaining non-alphanumeric runs with \`_\`, collapse duplicate \`_\`, and trim leading/trailing \`_\` from the slug portion (e.g. "Code Coverage Agent" → \`ca_code_coverage_agent\`, "PR Reviewer" → \`ca_pr_reviewer\`)
  - If the generated UID conflicts with an existing agent, ask the user whether to reuse/update that agent or append a short suffix

### 2. Task Details

**This is an INTERACTIVE requirements gathering process. Ask clarifying questions and verify understanding with the user before proceeding.**

Ask and clarify the following with the user:

1. **Agent's exact goal**: What specific outcome should the agent achieve? Be specific — avoid vague goals.

2. **Inputs the agent needs**: Repository info? Execution context? Configuration? Secrets?

3. **Outputs the agent produces**: Files? External actions? Data/metrics?

4. **What the agent works on**: Specific file paths? External services? Databases/APIs?

5. **Task workflow**: Step-by-step workflow (do 1, then 2, then 3, etc.)

6. **Constraints and preferences**: Limitations, rules, or coding standards (e.g., "Use idiomatic Go code", "Do not modify existing tests")

7. **Definition of done**: How do you know the agent succeeded? Specific criteria, artifacts, or exit conditions.

### 3. Recommend Configuration

Based on requirements, recommend and verify with the user:

1. **Task instructions**:
   - Break down the goal into detailed step-by-step instructions
   - Include specific commands, file paths, and expected outcomes
   - **Current Format**: put instructions in \`with.prompt\`; reference custom inputs using \`<+inputs.fieldName>\` syntax
   - **Legacy Format**: put instructions in \`PLUGIN_TASK\` env var (or \`with.task\` on \`agent.step.run\` specs); reference inputs using whichever of \`\${{inputs.fieldName}}\` or \`<+inputs.fieldName>\` the existing spec already uses
   - Add \`## RULES\` section at the end with constraints formatted as markdown bullet points (same convention in both formats)

2. **Runtime inputs** (custom \`inputs\` declared on the agent, beyond what the base template/legacy structure already provides):
   - Only add if user confirms runtime parameters are needed (repo, branch, executionId, thresholds, etc.)
   - **Always set a \`default\` value for every non-required input** — if it's referenced from the spec at all and no value is supplied at runtime nor a default exists, the agent will error at execution time
   - **Current Format**: always confirm \`allowed_domains\` (comma-separated hosts/wildcards/regexes; default \`"harness.io"\`) so users understand and control non-LLM/non-MCP network access
   - **Legacy Format**: always confirm \`allowedDomains\` (regex patterns separated by \`|\`; default \`""\`)

3. **Connectors**:
   - LLM connector for model access (required for all agents) - User must create via Harness UI or MCP
   - MCP connectors for external services (GitHub, Slack, Harness platform, etc.) - only if needed
   - All authentication and secrets are managed within the connectors
   - **If the user wants to pin a specific model** (Current Format only): ask which provider the LLM connector uses (Anthropic, OpenAI, Copilot, etc.) — the model-override env var key depends on it and cannot be inferred from a placeholder connector ID. See "Model override" below.

**Present this recommended configuration to the user and iterate until confirmed.**

### 4. Default Configuration & Inputs

**Use Current Format for every new agent, and for updates to an agent Phase 1 detected as Current Format. Use Legacy Format only when updating an agent Phase 1 detected as Legacy Format (see \`agent-docs:///legacy-format\`, already read in Phase 1).**

**Agent structure (Current Format):** the spec instantiates the shared \`harnessAI@1.0.0\` base template via \`uses:\` / \`with:\`. It does **not** redeclare a container, step, or layout — those live on the base template itself.

**Default structure:**
\`\`\`yaml
agent:
  uses: harnessAI@1.0.0
  with:
    prompt: |
      <step-by-step task instructions>
    connector: your_llm_connector_id
\`\`\`

**Core \`with:\` fields (always present):**
\`\`\`yaml
with:
  prompt: |                              # Task instructions, multiline string, ends with a ## RULES section
    <step-by-step instructions>
  connector: your_llm_connector_id       # LLM connector ref — user must replace with actual connector ID
\`\`\`

**Commonly added \`with:\` fields (include only if the use case needs them):**
\`\`\`yaml
with:
  mcp:                                             # Only if external services (GitHub, Slack, etc.) are needed
    - your_mcp_connector_id                        # User must replace
  allowed_domains: "github.com,api.github.com"     # Comma-separated hosts/wildcards/regexes; default "harness.io"
  max_turns: "150"                                 # Adjust based on task complexity; default "150"
\`\`\`

**Model override (only if user explicitly requests a specific model):** the env var key depends on the connector's underlying provider — this cannot be inferred from a placeholder connector ID, so ask the user which provider their connector uses:

| Connector provider | env var key |
|---|---|
| Anthropic | \`ANTHROPIC_MODEL\` |
| OpenAI | \`OPENAI_MODEL\` |
| Copilot | \`MODEL\` |
| Anything else, or unsure | **Ask the user to confirm the correct key — do not guess** |

\`\`\`yaml
with:
  env:
    ANTHROPIC_MODEL: your-model-name     # Example for an Anthropic connector; swap the key per the table above
\`\`\`

This mapping may collapse to a single generic \`MODEL\` key across all connectors in a future platform update — if the user's environment has already migrated, confirm with them before assuming this table still applies.

**Advanced \`with:\` fields (ask before adding — only if the use case calls for them; do not include any of these by default):**
- \`docker_connector\` — custom image/registry connector, only if needed (default \`account.harnessImage\`)
- \`image\` — non-default runner image, only if needed (default \`harness/harness-ai-agent:latest\`)
- \`skill\` — path to a \`SKILL.md\` to install before the run
- \`allowed_tools\` — comma-separated tool allowlist (empty = default allowlist)
- \`output\` — path to a file the agent must produce; verified after the run
- \`workdir\` — working directory (default \`/harness\`, the CI workspace)
- \`backend\` — \`claude | deepagent | openai | codex | copilot\` (empty = runner default)

**Custom inputs (only if the use case needs runtime parameters beyond the fields above):**
\`\`\`yaml
agent:
  uses: harnessAI@1.0.0
  with:
    prompt: |
      Review the pull request for repository <+inputs.repo_name> on branch <+inputs.branch>.
    connector: your_llm_connector_id
  inputs:
    repo_name:
      type: string
      default: my-org/my-repo
    branch:
      type: string
      default: main
\`\`\`
- Declare custom inputs under \`agent.inputs\` (same \`type\` / \`default\` / \`ui\` shape as before)
- Reference them inside any \`with:\` value using \`<+inputs.fieldName>\` — **not** \`\${{inputs.fieldName}}\` (that syntax is Legacy Format only)
- There is **no** per-agent \`layout\` block in Current Format — layout is owned entirely by the \`harnessAI\` base template

**Network access:** \`allowed_domains\` controls additional non-LLM/non-MCP network access. Current Format accepts comma-separated exact hosts, \`*.\` wildcards, or regexes — this replaces the old pipe-\`|\`-separated regex-only convention.

**Supported input types:** \`string\`, \`secret\`, \`boolean\`, \`connector\`, \`array\`

**IMPORTANT:** Users must create connectors via Harness UI or \`harness_create\` with \`resource_type="connector"\` before running the agent.

---

## Phase 3: Generate Agent Spec

Assemble the complete agent YAML specification (\`spec\` field). **Use Current Format when creating a new agent, or updating an agent Phase 1 detected as Current Format. Use Legacy Format only when updating an agent Phase 1 detected as Legacy Format (\`agent-docs:///legacy-format\`).**

1. Start directly with \`agent:\` — there is no top-level \`version:\` key in the spec itself
2. Add \`agent.uses: harnessAI@1.0.0\`
3. Add \`agent.with\` section (all task config lives here):
   - \`prompt:\` — multiline string with step-by-step instructions and \`## RULES\` section
   - \`connector: your_llm_connector_id\` (always required)
   - \`mcp:\` (only if MCPs needed) — array of MCP connector refs
   - \`allowed_domains:\` (only if the use case needs extra network access) — comma-separated hosts/wildcards/regexes
   - \`max_turns:\` (only if a non-default turn budget is needed) — string, default \`"150"\`
   - \`env.<PROVIDER>_MODEL\` or \`env.MODEL\` (**only** if user explicitly requests a specific model) — pick the key from the "Model override" table in Phase 2 §4 based on the connector's provider; ask the user if the provider isn't clear, never guess
   - Advanced fields (\`docker_connector\`, \`image\`, \`skill\`, \`allowed_tools\`, \`output\`, \`workdir\`, \`backend\`) — **only** if the use case calls for them
4. Add \`agent.inputs\` section **only** for custom, agent-specific runtime parameters not covered by \`with:\` fields above (e.g. \`repo_name\`, \`branch\`) — reference them from \`with:\` values using \`<+inputs.fieldName>\`
5. Do **not** add an \`agent.layout\` block — layout is owned by the \`harnessAI\` base template, not the per-agent spec

**Always notify users to create connectors and replace placeholder IDs before running the agent.**

---

## Phase 4: Present for Review

Present the complete agent configuration to the user:
- Agent metadata (name, description, uid)
- Full spec YAML
- Required connectors

**Wait for explicit confirmation before creating/updating the agent.**

---

## Phase 5: Create or Update Agent

Only after confirmation, use \`harness_create\` to create a new agent or \`harness_update\` to update an existing one:

### Creating a New Agent

\`\`\`
Call MCP tool: harness_create
Parameters:
  resource_type: "agent"
  org_id: "<organization>"
  project_id: "<project>"
  body: {
    uid: "<generated_from_agent_name>",
    name: "<Agent Display Name>",
    description: "<Brief description of agent purpose>",
    spec: "<agent YAML spec as a string>",
    wiki: "<optional: markdown documentation>"
  }
\`\`\`

**Key fields for creation:**
- \`uid\` (required): Unique identifier. Always generate from \`name\` as \`ca_<slug>\` and send explicitly (e.g. "Code Coverage Agent" → \`ca_code_coverage_agent\`). Do not omit it or rely on API-side auto-generation.
- \`name\` (required): Display name for the agent
- \`description\` (optional): Brief description
- \`spec\` (required): The full agent YAML specification as a string. New agents always use Current Format (\`agent:\`, \`agent.uses: harnessAI@1.0.0\`, \`agent.with\`, optional \`agent.inputs\` — see Phase 3)
- \`wiki\` (optional): Markdown documentation for the agent

### Updating an Existing Agent

\`\`\`
Call MCP tool: harness_update
Parameters:
  resource_type: "agent"
  resource_id: "<agent_identifier>"
  org_id: "<organization>"
  project_id: "<project>"
  body: {
    name: "<Updated Display Name>",           # optional
    description: "<Updated description>",     # optional
    spec: "<updated agent YAML spec>",        # optional
    wiki: "<updated markdown docs>"           # optional
  }
\`\`\`

**Key notes for updates:**
- All fields in the body are optional — only provide fields you want to update
- Only custom agents (role='custom') can be updated; system agents cannot be modified
- The \`spec\` field replaces the entire agent specification when provided
- Use \`harness_get\` first to retrieve the current agent configuration before updating, and detect its format (Current vs Legacy — see Phase 1) before generating the updated \`spec\`
- The updated \`spec\` must stay in the **same format** the agent already uses (Current Format in, Current Format out; Legacy Format in, Legacy Format out) unless the user explicitly asked for a migration

---

## Example: Code Review Agent (Current Format)

Use this example for all new agents, and for updates to any agent already on Current Format.

\`\`\`yaml
agent:
  uses: harnessAI@1.0.0
  with:
    prompt: |
      Review the pull request for repository <+inputs.repo_name> on branch <+inputs.branch>.

      1. Analyze code changes for security vulnerabilities
      2. Check for code quality issues
      3. Verify test coverage
      4. Post review comments using GitHub MCP tools

      ## RULES
      - Focus on critical security issues first
      - Be constructive in feedback
      - Suggest specific code improvements
    connector: your_llm_connector_id  # User must replace with actual connector ID
    allowed_domains: "github.com,api.github.com"
    max_turns: "150"
    mcp:
      - your_github_mcp_connector  # User must replace with actual connector ID
  inputs:
    repo_name:
      type: string
      default: my-org/my-repo

    branch:
      type: string
      default: main
\`\`\`

Notes:
- \`max_turns\` is shown here for reference — omit it when the default (\`"150"\`) is fine
- A model-override \`env\` entry is deliberately **not** shown here — only add one (see the "Model override" table above) when the user explicitly requests a pinned model, using the key that matches the connector's provider (\`ANTHROPIC_MODEL\`, \`OPENAI_MODEL\`, \`MODEL\`, etc.). Never default to \`ANTHROPIC_MODEL\` regardless of connector.
- \`repo_name\` and \`branch\` are custom inputs, referenced from \`with.prompt\` via \`<+inputs.fieldName>\`
- No \`version:\`, \`layout:\`, or \`step:\` blocks — those either don't exist in Current Format or are owned by the \`harnessAI\` base template

For a worked example in Legacy Format (only for updating agents already on this format), read the "Worked Example: Code Review Agent" section of the \`agent-docs:///legacy-format\` resource (already read in Phase 1 if detected).

---

## CRITICAL GUIDELINES

**These are essential rules you MUST follow when creating/updating agents:**

| Guideline                  | Rule                                                                                                                                     |
| ----------------------------| ------------------------------------------------------------------------------------------------------------------------------------------|
| **Check existing first**   | Always call \`harness_list(resource_type="agent")\` to see if an existing agent can solve the use case before creating new                                                     |
| **Format detection**       | Before updating, detect the existing agent's format: \`agent.uses\` = Current, anything else (\`agent.step.group.steps\`, \`agent.step.run\`, …) = Legacy. Keep the update in that **same** format — never silently migrate. New agents always start in Current Format. Read \`agent-docs:///legacy-format\` in full when Legacy Format is detected. |
| **Updating agents**        | Use \`harness_get\` to retrieve current config, then \`harness_update\` (not \`harness_create\`) to modify. Only custom agents can be updated.                                     |
| **Generate UID**           | Always derive \`uid\` as \`ca_<slug>\` (e.g. "Code Coverage Agent" → \`ca_code_coverage_agent\`) — matches platform UI \`nameToUid()\`. Pass it explicitly; do not rely on create API fallback. |
| **Agent spec format (Current)** | The \`spec\` field instantiates \`agent.uses: harnessAI@1.0.0\` with an \`agent.with\` block. There is no \`step\`, \`container\`, or \`layout\` in the per-agent spec — those live on the base template. |
| **Task location**          | Current Format: task instructions go in \`with.prompt\` (multiline string), turn budget in \`with.max_turns\`. Legacy Format: task instructions go in \`PLUGIN_TASK\` env var, turn budget in \`PLUGIN_MAX_TURNS\`. |
| **Expression syntax**      | Use \`<+inputs.fieldName>\` in Current Format. Legacy specs resolve both \`\${{inputs.fieldName}}\` and \`<+inputs.fieldName>\` (Harness's own legacy agent examples use \`<+…>\`, and MCP resolution is always \`<+connectorInputs.resolveList(<+inputs.mcpConnectors>)>\`) — match the syntax the existing spec already uses instead of rewriting working expressions. |
| **Model override is optional & provider-dependent** | Do NOT add a model-override env var by default. When the user explicitly requests one: Current Format uses \`with.env.<PROVIDER>_MODEL\` where the key depends on the connector's provider (Anthropic → \`ANTHROPIC_MODEL\`, OpenAI → \`OPENAI_MODEL\`, Copilot → \`MODEL\`; ask if unsure, never guess). Legacy Format uses a \`modelName\` input plus a fixed \`ANTHROPIC_MODEL\` env var. |
| **Allowed domains**       | Current Format: \`with.allowed_domains\` is comma-separated hosts/wildcards/regexes, default \`"harness.io"\`. Legacy Format: \`allowedDomains\` input is \`|\`-separated regexes, default \`""\`. Confirm the right convention for the detected format before writing it. |
| **Input defaults**         | Every non-required input that is referenced from the spec **must have a \`default\` value** — omitting it causes a runtime error if the caller does not supply the value  |
| **Connector placeholders** | Always use placeholders like \`your_llm_connector_id\` and \`your_mcp_connector_id\` and notify users to replace both LLM and MCP connector IDs with actual values before running the agent |
| **No clone/platform**      | Do NOT add \`clone\`, \`platform\`, \`os\`, or \`arch\` sections — agents are standalone with a simplified structure. (\`allowed_tools\` is a legitimate Current Format \`with:\` field — this rule does not apply to it.) |
| **Quality first**          | Agent quality is paramount — verify YAML structure, validate all references, ensure complete task instructions before creating                                                |`
        }
      }]
    })
  );
}
