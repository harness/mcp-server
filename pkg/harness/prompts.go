package harness

import (
	"log/slog"
	"context"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

type Role int
const (
	User Role = iota // 0
	Assistant        // 1
)

type Prompt struct {
	Name        string
	Description string
	ResultDescription string
	Text string
	Role Role 
}

func NewPrompt() *Prompt {
	prompt := &Prompt{}
	prompt.Role = User // Default role is User
	return prompt
}

func (b *Prompt) SetName(name string) *Prompt {
	b.Name = name
	return b
}

func (b *Prompt) SetDescription(description string) *Prompt {
	b.Description = description
	return b
}

func (b *Prompt) SetResultDescription(resultDescription string) *Prompt {
	b.ResultDescription = resultDescription
	return b
}

func (b *Prompt) SetText(text string) *Prompt {
	b.Text = text
	return b
}

func (b *Prompt) Build() *Prompt {
	return &Prompt{
		Name:              b.Name,
		Description:       b.Description,
		ResultDescription: b.ResultDescription,
		Text:              b.Text,
		Role:			   b.Role, 
	}
}

type Prompts struct {
	Prompts []*Prompt
}

func (p *Prompts) Append(prompt *Prompt) {
	p.Prompts = append(p.Prompts, prompt)
}

func (p *Prompts) GetPrompts() []*Prompt {
	return p.Prompts
}

func RegisterPrompts(mcpServer *server.MCPServer ) {
	prompts := Prompts{} 

	prompts.Append(
			NewPrompt().SetName("get_ccm_overview").
			SetDescription("Ensure parameters are provided correctly and in the right format. ").
			SetResultDescription("Input parameters validation").
			SetText(`Before calling get_ccm_overview, ensure you have: accountIdentifier, groupBy, startDate, and endDate.
					- If any are missing, ask the user for the specific value(s).
					- Always send startDate and endDate as Unix‐epoch milliseconds.
					- If no dates are supplied, default startDate to 60 days ago and endDate to now.`).
			Build())

	addPrompts(prompts, mcpServer)
}

func addPrompts(prompts Prompts, mcpServer *server.MCPServer) {
	// Register the prompts with the MCP server
	for _, prompt := range prompts.GetPrompts() {
		mcpServer.AddPrompt(createPrompt(prompt))
		slog.Debug("Registered prompt", "name", prompt.Name, "description", prompt.Description)
	}
}

func createPrompt(prompt *Prompt) (mcp.Prompt, server.PromptHandlerFunc) {
	role := mcp.RoleUser
	if prompt.Role == Assistant {
		role = mcp.RoleAssistant
	}

	return mcp.NewPrompt(prompt.Name, mcp.WithPromptDescription(prompt.Description)), 
	func(ctx context.Context, request mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		return mcp.NewGetPromptResult(
			prompt.ResultDescription,
			[]mcp.PromptMessage {mcp.NewPromptMessage(role, mcp.NewTextContent(prompt.Text))},
		), nil
	}
}
