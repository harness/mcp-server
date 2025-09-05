package prompts

import (
	p "github.com/harness/harness-mcp/pkg/prompts"
	"github.com/mark3labs/mcp-go/server"
)

// RegisterPrompts initializes and registers predefined prompts with the MCP server.
func RegisterPrompts(mcpServer *server.MCPServer) {
	prompts := p.Prompts{}

	// This prompt is intended to make the LLM handle the date parameters in the correct format because fields descriptions where not enough.
	prompts.Append(
		p.NewPrompt().SetName("get_ccm_overview").
			SetDescription("Ensure parameters are provided correctly and in the right format. ").
			SetResultDescription("Input parameters validation").
			SetText(`{"standard": "When calling get_ccm_overview, ensure you have: accountIdentifier, groupBy, startDate, and endDate.\n\t\t\t\t\t- If any are missing, ask the user for the specific value(s).\n\t\t\t\t\t- Always send startDate and endDate in the following format: 'MM/DD/YYYY' (e.g. '10/30/2025')\n\t\t\t\t\t- If no dates are supplied, default startDate to 60 days ago and endDate to now."}`).
			Build())

	prompts.Append(
		p.NewPrompt().SetName("ask_confirmation_for_update_and_delete_operations").
			SetDescription("Ensure that Update or Delete operations are executed ONLY after user confirmation.").
			SetResultDescription("Execute operation if user input 'yes', cancel otherwise.").
			SetText(`{"standard": "**Confirmation Policy**:\nWhen a function/tool description contains the tag <INSERT_TOOL>, <UPDATE_TOOL> or <DELETE_TOOL>, **BEFORE** calling it you **ALWAYS** must:\n\n- Present a clear, minimal summary of the impending change (show key fields/values).\n- Ask: 'Please confirm to proceed (yes/no).'\n- **ONLY** invoke the tool if the user's next message is exactly \"yes\" (case-insensitive).\n- If the user's answer is anything other than \"yes\", do not call the tool; instead, offer to adjust or cancel.\n- Never assume consent; always re-ask if the context is ambiguous or stale."}`).
			Build())

	// Pipeline summarization prompt
	prompts.Append(
		p.NewPrompt().SetName("pipeline_summarizer").
			SetDescription("Summarize a Harness pipeline's structure, purpose, and behavior.").
			SetResultDescription("Comprehensive pipeline summary with key details.").
			SetText(`{"standard": "I need you to summarise the pipeline with the input pipeline identifier.\n\n1. **What to do?**\n   - Fetch any required metadata or definitions for the pipeline.\n   - Analyze its configuration and structure.\n   - Make the necessary tool calls to get the pipeline related details.\n   - Produce a concise, accurate summary of the pipeline's design and behavior.\n\n2. **Tools to call to get a complete overview of pipeline**\n   - get_pipeline\n   - get_pipeline_summary\n   - list_pipelines\n   - get_environment\n   - get_service\n   - list_settings (with category as NOTIFICATIONS)\n   - get_secret\n   - list_triggers\n\n3. **Must-have details in the output** (acceptance criteria):\n   - **Purpose and Objective**: What this pipeline is designed to accomplish (e.g. \"Builds and deploys a Node.js microservice to staging and production.\")\n   - **High-Level Architecture**: Major components and phases (build, test, security scanning, deployment).\n   - **Environment Flow**: How the execution moves through environments.\n   - **Key Technologies**: Languages, frameworks, deployment targets, and tools used.\n   - **Trigger Conditions**: What events start the pipeline (Git commits, manual triggers, schedules).\n   - **Approval Gates**: Any manual approvals required, and who must sign off.\n   - **Dependencies**: External dependencies such as environments, infrastructures, connectors, services, other pipelines this one relies on, etc with their ids if available.\n   - **Success Criteria**: What defines a successful run.\n\n4. **Output format**\n   Return the following data ONLY in a markdown format, DO NOT use JSON literals:\n   {\n     \"purpose\":       string,\n     \"architecture\":  string,\n     \"environment\":   string,\n     \"technologies\":  string[],\n     \"triggers\":      string[],\n     \"approvals\":     string[],\n     \"dependencies\":  string[],\n     \"success_criteria\": string,\n     \"past_execution_details\": string[]\n   }"}`).
			Build())

	prompts.Append(
		p.NewPrompt().SetName("ask_release_agent_prompt").
			SetDescription("Prompt for the Ask Release Agent tool").
			SetResultDescription("Ask Release Agent prompt").
			SetText(`{"standard": "When calling ask_release_agent, ensure you have the required parameters for release process operations:\n- First, clarify the user's release requirements; echo back your understanding before calling the tool.\n- Include relevant context for release processes, such as:\n  - Release process requirements\n- The RMG AI DevOps Agent specializes in creating release processes and will automatically use the CREATE_PROCESS action.\n- Provide detailed requirements to get the most accurate release process configuration.\n- Do not use the words \"pipeline\" or \"stages\" in your response."}`).
			Build())

	p.AddPrompts(prompts, mcpServer)
}
