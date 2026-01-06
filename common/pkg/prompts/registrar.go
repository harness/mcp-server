package prompts

import "github.com/mark3labs/mcp-go/server"

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
}