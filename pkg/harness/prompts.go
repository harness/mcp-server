package harness

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
	// The prompt below improves perspective creation flow
	prompts.Append(
		p.NewPrompt().SetName("get_ccm_overview").
			SetDescription("Ensure parameters are provided correctly and in the right format. ").
			SetResultDescription("Input parameters validation").
			SetText(createPerspectivePrompt).
			Build())

	p.AddPrompts(prompts, mcpServer)
}


var createPerspectivePrompt = `
When the user requests to create a Perspective, the LLM should perform the following:

1. Collect core inputs
– Required fields: name, folderId, viewTimeRange, groupBy, aggregationFunction.
– Ask for any missing field, don't use default unless user ask for that.

2. Build filters
2.1 Dynamic filters – For filters whose values come from other CCM/GraphQL APIs (e.g., awsAccount, clusterId, namespace, etc.), do the following:
  a. Formulate the GraphQL query needed to fetch candidate values.
  b. If an appropriate value is not derivable from previous answers or the query fails, ask the user to choose from returned or static options.

2.2 Static filters – For type, allow only: "type1", "type2", "type3".

3. Summarize → confirm
Before calling POST /v2/perspectives show a recap JSON containing every field+value.
Ask: “Please confirm to create this Perspective (yes/no).”
Only proceed when the user replies “yes”.

4. Call create Perspective
Invoke the REST endpoint using the confirmed payload.

5. Return result
On success: brief success note + Perspective ID.
On failure: surface the API error message.
`
