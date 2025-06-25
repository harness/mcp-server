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

	p.AddPrompts(prompts, mcpServer)
}
