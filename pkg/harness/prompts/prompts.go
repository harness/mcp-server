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
			SetText(`When calling get_ccm_overview, ensure you have: accountIdentifier, groupBy, startDate, and endDate.
					- If any are missing, ask the user for the specific value(s).
					- Always send startDate and endDate in the following format: 'MM/DD/YYYY' (e.g. '10/30/2025')
					- If no dates are supplied, default startDate to 60 days ago and endDate to now.`).
			Build())

	prompts.Append(
		p.NewPrompt().SetName("ask_confirmation_for_update_and_delete_operations").
			SetDescription("Ensure that Update or Delete operations are executed ONLY after user confirmation.").
			SetResultDescription("Execute operation if user input 'yes', cancel otherwise.").
			SetText(`			
				**Confirmation Policy**:
				When a function/tool description contains the tag <INSERT_TOOL>, <UPDATE_TOOL> or <DELETE_TOOL>, **BEFORE** calling it you **ALWAYS** must:

				- Present a clear, minimal summary of the impending change (show key fields/values).
				- Ask: 'Please confirm to proceed (yes/no).'
				- **ONLY** invoke the tool if the user’s next message is exactly “yes” (case-insensitive).
				- If the user’s answer is anything other than “yes”, do not call the tool; instead, offer to adjust or cancel.
				- Never assume consent; always re-ask if the context is ambiguous or stale.
			`).
			Build())

	// Pipeline summarization prompt
	prompts.Append(
		p.NewPrompt().SetName("pipeline_summarizer").
			SetDescription("Summarize a Harness pipeline's structure, purpose, and behavior.").
			SetResultDescription("Comprehensive pipeline summary with key details.").
			SetText(`I need you to summarise the pipeline with the input pipeline identifier.

1. **What to do?**
   - Fetch any required metadata or definitions for the pipeline.
   - Analyze its configuration and structure.
   - Make the necessary tool calls to get the pipeline related details.
   - Produce a concise, accurate summary of the pipeline's design and behavior.

2. **What tools to call?**
   - get_pipeline  
   - list_pipelines        
   - get_environment
   - get_service

3. **Must-have details in the output** (acceptance criteria):
   - **Purpose and Objective**: What this pipeline is designed to accomplish (e.g. "Builds and deploys a Node.js microservice to staging and production.")
   - **High-Level Architecture**: Major components and phases (build, test, security scanning, deployment).
   - **Environment Flow**: How the execution moves through environments.
   - **Key Technologies**: Languages, frameworks, deployment targets, and tools used.
   - **Trigger Conditions**: What events start the pipeline (Git commits, manual triggers, schedules).
   - **Approval Gates**: Any manual approvals required, and who must sign off.
   - **Dependencies**: External dependencies such as environments, infrastructures, connectors, services, other pipelines this one relies on, etc with their ids if available.
   - **Success Criteria**: What defines a successful run.

4. **Output format**
   Return the following data ONLY in a markdown format, DO NOT use JSON literals:
   {
     "purpose":       string,
     "architecture":  string,
     "environment":   string,
     "technologies":  string[],
     "triggers":      string[],
     "approvals":     string[],
     "dependencies":  string[],
     "success_criteria": string
   }`).
			Build())

	p.AddPrompts(prompts, mcpServer)
}
