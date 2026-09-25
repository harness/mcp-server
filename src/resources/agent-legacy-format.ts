import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Legacy custom-agent spec format reference (agent.step.group.steps / PLUGIN_TASK).
 *
 * New agents always use the current format (agent.uses: harnessAI@1.0.0 + agent.with).
 * This resource is only read by the create-agent prompt flow when harness_get reveals
 * that an *existing* agent being updated still uses the legacy structure, so the update
 * can be authored in that same format instead of silently migrating it.
 */
export const AGENT_LEGACY_FORMAT_CONTENT = `# Legacy Agent Spec Format Reference

Use this reference only when updating an existing agent whose \`spec\` (from \`harness_get\` with \`resource_type="agent"\`) contains \`agent.step.group.steps\`. Never use this format for a new agent — new agents always use the current format (\`agent.uses: harnessAI@1.0.0\`, see the \`create-agent\` prompt for that flow).

## Agent Structure

Agents use \`agent.step.group.steps\` format — the run step is nested inside a named step group.

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
              PLUGIN_ALLOWED_DOMAINS: \${{inputs.allowedDomains}}
\`\`\`

**Required environment variables:**
\`\`\`yaml
env:
  PLUGIN_TASK: |                                   # Task instructions go here as a multiline string
    <step-by-step instructions>
  PLUGIN_MAX_TURNS: 150                            # Adjust 100-200 based on task complexity
  PLUGIN_HARNESS_CONNECTOR: \${{inputs.llmConnector.id}}  # References llmConnector input's id property
  PLUGIN_ALLOWED_DOMAINS: \${{inputs.allowedDomains}}      # Regexes for additional network access
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

    allowedDomains:
      type: string
      default: ""
\`\`\`

**Network access:** Agent network access is limited to the LLM connector, configured MCP connectors, and domains matching \`allowedDomains\`. \`allowedDomains\` accepts regexes separated by \`|\`. Default to an empty string if the user does not specify domains; if they do specify domains, work with them to build the right regex.

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

The \`layout\` block controls what appears in the agent configuration UI. It contains **at most four items** — \`llmConnector\`, \`allowedDomains\`, \`modelName\`, and \`mcpConnectors\` — and only those that exist as first-class input fields in the \`inputs\` section. Never include any other fields (e.g. custom inputs like \`repo_name\`) in the layout block:

\`\`\`yaml
agent:
  layout:
    - title: Agent Configuration
      items:
        - llmConnector          # always present
        - allowedDomains        # always present
        - modelName             # only if modelName input exists
        - mcpConnectors         # only if mcpConnectors input exists
\`\`\`

**Supported input types:** \`string\`, \`secret\`, \`boolean\`, \`connector\`, \`array\`

**IMPORTANT:** Users must create connectors via Harness UI or \`harness_create\` with \`resource_type="connector"\` before running the agent.

## Generating the Spec

1. Start with \`version: 1\` and \`agent:\` structure
2. Create \`agent.step.group.steps\` block with a single step entry:
   - \`name: Agent\`, \`if: <+Always>\`, \`id: agent\`
   - \`run.container.image: pkg.harness.io/vrvdt5ius7uwygso8s0bia/harness-agents/harness-ai-agent:latest\`
   - \`run.env\` section (all task config lives here as env vars):
     - \`PLUGIN_TASK:\` — multiline string with step-by-step instructions and \`## RULES\` section
     - \`PLUGIN_MAX_TURNS: 150\` (adjust 100-200 based on complexity)
     - \`PLUGIN_HARNESS_CONNECTOR: \${{inputs.llmConnector.id}}\`
     - \`PLUGIN_ALLOWED_DOMAINS: \${{inputs.allowedDomains}}\`
     - \`PLUGIN_MCP_FORMAT: harness\` (only if MCPs needed)
     - \`PLUGIN_MCP_SERVERS: <+connectorInputs.resolveList(<+inputs.mcpConnectors>)>\` (only if MCPs needed)
     - \`ANTHROPIC_MODEL: \${{inputs.modelName}}\` (**only** if user explicitly requests a \`modelName\` input)
3. Add \`agent.inputs\` section with:
   - \`llmConnector\` (required) with \`ui.connectorCategories: [AI]\`
   - \`allowedDomains\` (default \`""\`) to allow additional network domains using regexes
   - \`mcpConnectors\` (optional - only if needed) with \`ui.component: array\`, \`ui.input.inputType: connector\`, and \`ui.input.inputConfig.connectorTypes: [Mcp]\`
   - \`modelName\` (optional - **only** if user explicitly requests it)
   - Custom inputs (as needed)
4. Add \`agent.layout\` block — only include items that are present as inputs:
   - Always include \`llmConnector\`
   - Always include \`allowedDomains\`
   - Include \`modelName\` only if that input exists
   - Include \`mcpConnectors\` only if that input exists

**Always notify users to create connectors and replace placeholder IDs before running the agent.**

## Worked Example: Code Review Agent

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
              PLUGIN_ALLOWED_DOMAINS: \${{inputs.allowedDomains}}
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

    allowedDomains:
      type: string
      default: ""

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
        - allowedDomains
        - mcpConnectors
\`\`\`

## Using a Legacy Format Agent in a v0 Pipeline

\`agentSettings\` is a **plain YAML map**. Use it to override \`llmConnector\`, \`modelName\`, and \`mcpConnectors\` as well as any custom inputs — check the agent's actual \`agent.inputs\` (via \`harness_get\`) rather than assuming all three connector/model fields exist on a given agent.

\`\`\`yaml
pipeline:
  stages:
    - stage:
        type: Deployment
        spec:
          execution:
            steps:
              - stepGroup:
                  stepGroupInfra:
                    type: KubernetesDirect
                  steps:
                    - step:
                        type: Agent
                        name: ReviewPRAgent
                        identifier: ReviewPRAgent
                        spec:
                          agentName: ca_code_review_agent
                          agentSettings:
                            repo_name: my-org/my-repo
                            branch: feature/new-feature
                            llmConnector: your_llm_connector_id
                            modelName: your_model_arn_or_id
                            mcpConnectors:
                              - your_github_mcp_connector
                              - your_slack_mcp_connector
\`\`\`

**Key fields explained:**

- \`agentSettings\` (optional) - map containing whatever inputs the agent's spec declares:
  - **Custom inputs**: Agent-specific fields like \`repo_name\`, \`branch\`, thresholds, etc.
  - **llmConnector**: LLM connector ID
  - **modelName**: Model ARN or ID — only present if the agent was created with a \`modelName\` input
  - **mcpConnectors**: MCP connector ID(s) — a YAML list in map form

Check the specific agent's \`agent.inputs\` before assuming all of the above are present — \`modelName\` in particular is optional, and the agent's custom inputs vary per agent.

**Precedence rules:**
1. Values in \`agentSettings\` have **highest precedence** - they override the agent's input defaults
2. If not provided, the agent's default configuration from the template is used

For v1 pipelines using a legacy-format agent: \`llmConnector\` and \`mcpConnectors\` are configured at the agent level by default, and \`modelName\` is present only if the agent was created with it. These may optionally be overridden at the pipeline level using the standard \`uses:\`/\`with:\` template mechanics.

## CRITICAL GUIDELINES (legacy format)

| Guideline                  | Rule                                                                                                                                     |
| ----------------------------| ------------------------------------------------------------------------------------------------------------------------------------------|
| **Never migrate silently** | Keep the update in \`agent.step.group.steps\` format — never rewrite a legacy agent into the current format unless the user explicitly asks for a migration. |
| **Agent spec format**      | The \`spec\` field uses \`agent.step.group.steps\` structure — the run step is nested inside a named group with \`name: Agent\`, \`if: <+Always>\`, \`id: agent\`                     |
| **Task in env**            | Task instructions go in \`PLUGIN_TASK\` env var (multiline string). Max turns in \`PLUGIN_MAX_TURNS\`. There is no \`with:\` block.                                                |
| **Expression syntax**      | Use \`\${{inputs.fieldName}}\` inside env values — never \`<+inputs.fieldName>\` (that syntax is current-format only). Use \`<+connectorInputs.resolveList(...)>\` for MCP server resolution. |
| **modelName is optional**  | Do NOT add \`modelName\` input or \`ANTHROPIC_MODEL\` env var by default — only add when the user explicitly requests it                                                         |
| **Allowed domains**       | Always include \`PLUGIN_ALLOWED_DOMAINS: \${{inputs.allowedDomains}}\`, an \`allowedDomains\` string input with default \`""\`, and \`allowedDomains\` in layout. If the user specifies domains, help build the regex. |
| **Input defaults**         | Every non-required input that is referenced via \`\${{inputs.fieldName}}\` **must have a \`default\` value** — omitting it causes a runtime error if the caller does not supply the value  |
| **Connector placeholders** | Always use placeholders like \`your_llm_connector_id\` and \`your_mcp_connector_id\` and notify users to replace both LLM and MCP connector IDs with actual values before running the agent |
`;

export function registerAgentLegacyFormatResource(server: McpServer): void {
  server.registerResource(
    "agent-legacy-format",
    "agent-docs:///legacy-format",
    {
      title: "Legacy Agent Spec Format Reference",
      description:
        "Full reference for the legacy custom-agent spec format (agent.step.group.steps / PLUGIN_TASK env vars). " +
        "Read this only when updating an existing agent whose spec already uses this legacy structure — " +
        "new agents always use the current agent.uses/agent.with format described in the create-agent prompt.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: AGENT_LEGACY_FORMAT_CONTENT,
        },
      ],
    }),
  );
}
