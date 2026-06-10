import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreateAgentPrompt(server: McpServer): void {
  server.registerPrompt(
    "create-agent",
    {
      description: "Create and update Harness AI agent instances - standalone templates used as building blocks in pipelines. Agents contain a single agent step with connector-driven architecture requiring llmConnector (LLM access) and optional mcpConnectors (GitHub, Slack, Harness platform). Supports runtime inputs and task/rules-based instruction.",
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
   - Identify what needs to be changed (spec, name, description, wiki, logo)
   - Use \`harness_update\` (not \`harness_create\`) to update the agent with only the fields that need modification

---

## Phase 2: Requirements Gathering

If creating a new agent or updating an existing one, collect the following before generating YAML:

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

1. **Task instructions** (\`PLUGIN_TASK\` env var):
   - Break down the goal into detailed step-by-step instructions
   - Include specific commands, file paths, and expected outcomes
   - Reference inputs using \`\${{inputs.fieldName}}\` syntax inside \`PLUGIN_TASK\` and other env vars
   - Add \`## RULES\` section at the end with constraints formatted as markdown bullet points

2. **Runtime inputs** (\`inputs\` section in spec):
   - Only add if user confirms runtime parameters are needed
   - Map each input to what the agent needs (repo, branch, executionId, thresholds, etc.)
   - **Always set a \`default\` value for every non-required input** — if \`\${{inputs.fieldName}}\` is referenced in \`PLUGIN_TASK\` or any env var and no value is supplied at runtime nor a default exists, the agent will error at execution time

3. **Connectors**:
   - LLM connector for model access (required for all agents) - User must create via Harness UI or MCP
   - MCP connectors for external services (GitHub, Slack, Harness platform, etc.) - only if needed
   - All authentication and secrets are managed within the connectors

**Present this recommended configuration to the user and iterate until confirmed.**

### 4. Default Configuration & Inputs

**Agent Structure:** Agents use \`agent.step.group.steps\` format — the run step is nested inside a named step group.

**Default structure:**
\`\`\`yaml
version: 1
agent:
  step:
    group:
      steps:
        - name: Agent
          if: <+Always>
          id: agent
          run:
            container:
              image: pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/harness-ai-agent:latest
            env:
              PLUGIN_TASK: |
                <step-by-step task instructions>
              PLUGIN_MAX_TURNS: 150
              PLUGIN_HARNESS_CONNECTOR: \${{inputs.llmConnector.id}}
\`\`\`

**Required environment variables:**
\`\`\`yaml
env:
  PLUGIN_TASK: |                                   # Task instructions go here as a multiline string
    <step-by-step instructions>
  PLUGIN_MAX_TURNS: 150                            # Adjust 100-200 based on task complexity
  PLUGIN_HARNESS_CONNECTOR: \${{inputs.llmConnector.id}}  # References llmConnector input's id property
\`\`\`

**MCP configuration (only if external services needed):**
\`\`\`yaml
env:
  PLUGIN_MCP_FORMAT: harness
  PLUGIN_MCP_SERVERS: <+connectorInputs.resolveList(<+inputs.mcpConnectors>)>  # References mcpConnectors input
\`\`\`

**Optional model override (only if user explicitly requests it):**
\`\`\`yaml
env:
  ANTHROPIC_MODEL: \${{inputs.modelName}}  # Only add when user insists on a modelName input
\`\`\`

**Required inputs (always include):**
\`\`\`yaml
agent:
  inputs:
    llmConnector:
      type: connector
      required: true
      default: your_llm_connector_id  # User must replace with actual connector ID
      ui:
        connectorCategories:
          - AI
\`\`\`

**Optional inputs (add as needed):**
\`\`\`yaml
    # MCP connectors - only if agent needs external services
    mcpConnectors:
      type: array
      default:
        - your_github_mcp_connector  # User must replace
        - your_slack_mcp_connector   # User must replace
      ui:
        component: array
        input:
          inputType: connector
          inputConfig:
            connectorTypes:
              - Mcp

    # Model name override - ONLY add if user explicitly requests it
    modelName:
      type: string
      default: your_model_arn_or_id  # User must replace with their model ARN or ID

    # Custom parameters
    repo_name:
      type: string
      default: my-org/my-repo
\`\`\`

**\`layout\` block (always include, only list fields that are present as inputs):**

The \`layout\` block controls what appears in the agent configuration UI. It contains **at most three items** — \`llmConnector\`, \`modelName\`, and \`mcpConnectors\` — and only those that exist as first-class input fields in the \`inputs\` section. Never include any other fields (e.g. custom inputs like \`repo_name\`) in the layout block:

\`\`\`yaml
agent:
  layout:
    - title: Agent Configuration
      items:
        - llmConnector          # always present
        - modelName             # only if modelName input exists
        - mcpConnectors         # only if mcpConnectors input exists
\`\`\`

**Supported input types:** \`string\`, \`secret\`, \`boolean\`, \`connector\`, \`array\`

**IMPORTANT:** Users must create connectors via Harness UI or \`harness_create\` with \`resource_type="connector"\` before running the agent.

---

## Phase 3: Generate Agent Spec

Assemble the complete agent YAML specification (\`spec\` field):

1. Start with \`version: 1\` and \`agent:\` structure
2. Create \`agent.step.group.steps\` block with a single step entry:
   - \`name: Agent\`, \`if: <+Always>\`, \`id: agent\`
   - \`run.container.image: pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/harness-ai-agent:latest\`
   - \`run.env\` section (all task config lives here as env vars):
     - \`PLUGIN_TASK:\` — multiline string with step-by-step instructions and \`## RULES\` section
     - \`PLUGIN_MAX_TURNS: 150\` (adjust 100-200 based on complexity)
     - \`PLUGIN_HARNESS_CONNECTOR: \${{inputs.llmConnector.id}}\`
     - \`PLUGIN_MCP_FORMAT: harness\` (only if MCPs needed)
     - \`PLUGIN_MCP_SERVERS: <+connectorInputs.resolveList(<+inputs.mcpConnectors>)>\` (only if MCPs needed)
     - \`ANTHROPIC_MODEL: \${{inputs.modelName}}\` (**only** if user explicitly requests a \`modelName\` input)
3. Add \`agent.inputs\` section with:
   - \`llmConnector\` (required) with \`ui.connectorCategories: [AI]\`
   - \`mcpConnectors\` (optional - only if needed) with \`ui.component: array\`, \`ui.input.inputType: connector\`, and \`ui.input.inputConfig.connectorTypes: [Mcp]\`
   - \`modelName\` (optional - **only** if user explicitly requests it)
   - Custom inputs (as needed)
4. Add \`agent.layout\` block — only include items that are present as inputs:
   - Always include \`llmConnector\`
   - Include \`modelName\` only if that input exists
   - Include \`mcpConnectors\` only if that input exists

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
- \`spec\` (required): The full agent YAML specification as a string (includes \`version: 1\`, \`agent:\`, \`agent.step.group.steps\`, \`agent.inputs\`, and \`agent.layout\`)
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
- Use \`harness_get\` first to retrieve the current agent configuration before updating

---

## Example: Code Review Agent

\`\`\`yaml
version: 1
agent:
  step:
    group:
      steps:
        - name: Agent
          if: <+Always>
          id: agent
          run:
            container:
              image: pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/harness-ai-agent:latest
            env:
              PLUGIN_TASK: |
                Review the pull request for repository \${{inputs.repo_name}} on branch \${{inputs.branch}}.

                1. Analyze code changes for security vulnerabilities
                2. Check for code quality issues
                3. Verify test coverage
                4. Post review comments using GitHub MCP tools

                ## RULES
                - Focus on critical security issues first
                - Be constructive in feedback
                - Suggest specific code improvements
              PLUGIN_MAX_TURNS: 150
              PLUGIN_HARNESS_CONNECTOR: \${{inputs.llmConnector.id}}
              PLUGIN_MCP_FORMAT: harness
              PLUGIN_MCP_SERVERS: <+connectorInputs.resolveList(<+inputs.mcpConnectors>)>

  inputs:
    llmConnector:
      type: connector
      required: true
      default: your_llm_connector_id  # User must replace with actual connector ID
      ui:
        connectorCategories:
          - AI

    mcpConnectors:
      type: array
      default:
        - your_github_mcp_connector  # User must replace with actual connector ID
      ui:
        component: array
        input:
          inputType: connector
          inputConfig:
            connectorTypes:
              - Mcp

    repo_name:
      type: string
      default: my-org/my-repo

    branch:
      type: string
      default: main

  layout:
    - title: Agent Configuration
      items:
        - llmConnector
        - mcpConnectors
\`\`\`

---

## CRITICAL GUIDELINES

**These are essential rules you MUST follow when creating/updating agents:**

| Guideline                  | Rule                                                                                                                                     |
| ----------------------------| ------------------------------------------------------------------------------------------------------------------------------------------|
| **Check existing first**   | Always call \`harness_list(resource_type="agent")\` to see if an existing agent can solve the use case before creating new                                                     |
| **Updating agents**        | Use \`harness_get\` to retrieve current config, then \`harness_update\` (not \`harness_create\`) to modify. Only custom agents can be updated.                                     |
| **Generate UID**           | Always derive \`uid\` as \`ca_<slug>\` (e.g. "Code Coverage Agent" → \`ca_code_coverage_agent\`) — matches platform UI \`nameToUid()\`. Pass it explicitly; do not rely on create API fallback. |
| **Agent spec format**      | The \`spec\` field uses \`agent.step.group.steps\` structure — the run step is nested inside a named group with \`name: Agent\`, \`if: <+Always>\`, \`id: agent\`                     |
| **Task in env**            | Task instructions go in \`PLUGIN_TASK\` env var (multiline string). Max turns in \`PLUGIN_MAX_TURNS\`. There is no \`with:\` block.                                                |
| **Expression syntax**      | Use \`\${{inputs.fieldName}}\` inside env values. Use \`<+connectorInputs.resolveList(...)>\` for MCP server resolution.                                                          |
| **modelName is optional**  | Do NOT add \`modelName\` input or \`ANTHROPIC_MODEL\` env var by default — only add when the user explicitly requests it                                                         |
| **Input defaults**         | Every non-required input that is referenced via \`\${{inputs.fieldName}}\` **must have a \`default\` value** — omitting it causes a runtime error if the caller does not supply the value  |
| **Connector placeholders** | Always use placeholders like \`your_llm_connector_id\` and \`your_mcp_connector_id\` and notify users to replace both LLM and MCP connector IDs with actual values before running the agent |
| **No clone/platform**      | Do NOT add \`clone\`, \`platform\`, \`os\`, \`arch\`, or \`allowed_tools\` sections — agents are standalone with simplified structure                                                  |
| **Quality first**          | Agent quality is paramount — verify YAML structure, validate all references, ensure complete task instructions before creating                                                |`
        }
      }]
    })
  );
}
