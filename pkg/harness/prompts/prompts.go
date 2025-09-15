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
			SetText(`{
				"standard": "I need you to summarise the pipeline with the input pipeline identifier.\n    1. What to do?\n       - Fetch any required metadata or definitions for the pipeline.\n       - Analyze its configuration and structure.\n       - Make the necessary tool calls to get the pipeline related details.\n       - Before making any tool call, for all other tool calls you MUST send a message on what tool you are going to call and why.\n       - Produce a concise, accurate summary of the pipeline's design and behavior.\n    2. Tools to call to get a complete overview of pipeline:\n       - get_pipeline\n       - get_pipeline_summary\n       - list_pipelines\n       - get_environment\n       - get_service\n       - list_settings (with category as NOTIFICATIONS)\n       - get_secret\n       - list_triggers\n       - list_executions\n       - create_follow_up_prompt\n    3. Must-have details in the summary (acceptance criteria):\n       - Purpose and Objective: What this pipeline is designed to accomplish (e.g. 'Builds and deploys a Node.js microservice to staging and production.')\n       - High-Level Architecture: Major components and phases (build, test, security scanning, deployment).\n       - Environment Flow: How the execution moves through environments.\n       - Key Technologies: Languages, frameworks, deployment targets, and tools used.\n       - Trigger Conditions: What events start the pipeline (Git commits, manual triggers, schedules).\n       - Approval Gates: Any manual approvals required, and who must sign off.\n       - Dependencies: External dependencies such as environments, infrastructures, connectors, services, other pipelines this one relies on, etc with their ids if available.\n       - Success Criteria: What defines a successful run.\n    4. Instructions for calling create_follow_up_prompt tool:\n       Follow these steps in order:\n       a. Make a tool call to list_executions to fetch the execution ID of the latest execution of the given pipeline\n       b. Make a tool call to create_follow_up_prompt with these parameters:\n          - action_data: The following JSON data stringified:\n            {\"actions\": [\n              {\n                \"text\": \"View Latest Execution\",\n                \"action\": \"OPEN_ENTITY_NEW_TAB\",\n                \"data\": {\n                  \"pageName\": \"ExecutionPipelineView\",\n                  \"metadata\": {\n                     \"executionId\": \"executionId-value\",\n                     \"pipelineId\": \"pipeline-id\"\n                  }\n                }\n              },\n              {\n                \"text\": \"View Pipeline\",\n                \"action\": \"OPEN_ENTITY_NEW_TAB\",\n                \"data\": {\n                  \"pageName\": \"PipelineStudio\",\n                  \"metadata\": {\n                     \"id\": \"pipeline-id\"\n                  }\n                }\n              }\n            ]}\n          - Replace \"executionId-value\" with the actual execution ID from the list_executions response\n          - Replace \"pipeline-id\" with the pipeline identifier\n          - If there are no executions available, MUST use this JSON data instead(with only option view pipeline):\n            {\"actions\": [\n              {\n                \"text\": \"View Pipeline\",\n                \"action\": \"OPEN_ENTITY_NEW_TAB\",\n                \"data\": {\n                  \"pageName\": \"PIPELINE_STUDIO\",\n                  \"metadata\": {\n                     \"id\": \"pipeline-id\"\n                  }\n                }\n              }\n            ]}\n\n    5. Output format:\n       Return the following summary data ONLY in a markdown format, DO NOT use JSON literals:\n       {\n         \"### Purpose\":       string,\n         \"### Architecture\":  string,\n         \"### Environment\":   string,\n         \"### Technologies\":  string[],\n         \"### Triggers\":      string[],\n         \"### Approvals\":     string[],\n         \"### Dependencies\":  string[],\n         \"### Success Criteria\": string,\n         \"### Past Execution Details\": string[]\n       } \n       Return the tool response exactly as received, in markdown format. DO NOT use JSON literals. The pipeline summary should the final response."
			  }`).
			Build())

	p.AddPrompts(prompts, mcpServer)
}
