package prompts

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/mark3labs/mcp-go/server"
)

//go:embed sei_ai_insights_agentic.txt
var seiAgenticPromptText string

// PromptRegistrar defines the interface for registering prompts with the MCP server.
// This interface allows different implementations for internal and external repos.
type PromptRegistrar interface {
	RegisterPrompts(mcpServer *server.MCPServer)
}

type BasePromptRegistrar struct{}

// NewPromptRegistrar creates a new prompt registrar.
func NewPromptRegistrar() PromptRegistrar {
	return &BasePromptRegistrar{}
}

// RegisterPrompts registers common prompts available in both internal and external modes.
func (b *BasePromptRegistrar) RegisterPrompts(mcpServer *server.MCPServer) {
	prompts := Prompts{}

	// Register common prompts
	b.RegisterCommonPrompts(&prompts)

	// Add all prompts to server
	AddPrompts(prompts, mcpServer)
}

// registerCommonPrompts adds prompts that are common to both internal and external modes.
// This method can be called by derived implementations to include common prompts.
func (b *BasePromptRegistrar) RegisterCommonPrompts(prompts *Prompts) {
	// CCM overview prompt - ensures date parameters are in correct format
	prompts.Append(
		NewPrompt().SetName("get_ccm_overview").
			SetDescription("Ensure parameters are provided correctly and in the right format. ").
			SetResultDescription("Input parameters validation").
			SetText(`{"standard": "When calling get_ccm_overview, ensure you have: accountIdentifier, groupBy, startDate, and endDate.\n\t\t\t\t\t- If any are missing, ask the user for the specific value(s).\n\t\t\t\t\t- Always send startDate and endDate in the following format: 'MM/DD/YYYY' (e.g. '10/30/2025')\n\t\t\t\t\t- If no dates are supplied, default startDate to 60 days ago and endDate to now."}`).
			Build())

	prompts.Append(
		NewPrompt().SetName("ask_confirmation_for_update_and_delete_operations").
			SetDescription("Ensure that Update or Delete operations are executed ONLY after user confirmation.").
			SetResultDescription("Execute operation if user input 'yes', cancel otherwise.").
			SetText(`{"standard": "**Confirmation Policy**:\nWhen a function/tool description contains the tag <INSERT_TOOL>, <UPDATE_TOOL> or <DELETE_TOOL>, **BEFORE** calling it you **ALWAYS** must:\n\n- Present a clear, minimal summary of the impending change (show key fields/values).\n- Ask: 'Please confirm to proceed (yes/no).'\n- **ONLY** invoke the tool if the user's next message is exactly \"yes\" (case-insensitive).\n- If the user's answer is anything other than \"yes\", do not call the tool; instead, offer to adjust or cancel.\n- Never assume consent; always re-ask if the context is ambiguous or stale."}`).
			Build())

	// SEI AI Insights prompt - ensures all required parameters are provided
	prompts.Append(
		NewPrompt().SetName("sei_ai_insights").
			SetDescription("Guidelines for calling SEI AI Insights tools to analyze AI coding assistant adoption and productivity metrics.").
			SetResultDescription("SEI AI Insights parameter guidance").
			SetText(`{"standard": "**SEI AI Insights Tools Usage Guide**:\n\nWhen calling any SEI AI Insights tool (sei_get_ai_usage_summary, sei_get_ai_adoptions, sei_get_ai_raw_metrics_v2, etc.), ensure ALL required parameters are provided:\n\n**Required for ALL SEI tools:**\n- org_id: Organization identifier (default: 'default')\n- project_id: Project identifier (default: 'Sprint_Insights')\n- accountId: Harness Account ID\n- teamRefId: Team reference ID (use sei_get_teams_list to find available teams)\n- startDate: Start date in 'YYYY-MM-DD' format\n- endDate: End date in 'YYYY-MM-DD' format\n\n**Tool-specific required parameters:**\n- sei_get_ai_adoptions: requires 'granularity' (DAILY, WEEKLY, or MONTHLY) and 'integrationType' (cursor or windsurf)\n- sei_get_ai_usage_metrics: requires 'granularity' and 'metricType' (linesAddedPerContributor, linesSuggested, linesAccepted, acceptanceRatePercentage, DAILY_ACTIVE_USERS)\n\n**Defaults:**\n- If dates not provided: default to last 30 days\n- If integrationType not specified: default to 'cursor'\n- If granularity not specified: default to 'WEEKLY'\n\n**Team Resolution:**\n- If user mentions a team by name, first call sei_get_teams_list to find the teamRefId\n- Never guess teamRefId - always look it up"}`).
			Build())

	// SEI AI Insights Agentic prompt - full analysis instructions for agentic mode
	// The prompt text is embedded from sei_ai_insights_agentic.txt and JSON-encoded
	// so it can be stored in the {"standard": "..."} mode map format.
	escapedAgenticPrompt, _ := json.Marshal(seiAgenticPromptText)
	prompts.Append(
		NewPrompt().SetName("sei_ai_insights_agentic").
			SetDescription("Agentic analysis instructions for SEI AI Insights - defines which tools to call, analysis approach, and output format for automated AI metrics analysis.").
			SetResultDescription("SEI AI Insights agentic analysis prompt").
			SetText(fmt.Sprintf(`{"standard": %s}`, string(escapedAgenticPrompt))).
			Build())
}
