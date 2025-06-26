package prompts

import (
	"context"
	"log/slog"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// harness.prompts is intended to make adding guideline prompts easier by hidding mcp framework details.
// It also wraps the mcp-go framework so that it can be "easily" replaced if necessary.

// Role represents the role of the prompt creator, either User or Assistant.
type Role int

const (
	User      Role = iota // 0
	Assistant             // 1
)

// Prompt represents the prompt data needed to add to the MCP server.
type Prompt struct {
	Name              string
	Description       string
	ResultDescription string
	Text              string
	Role              Role
}

// Prompts is a collection of Prompt instances.
type Prompts struct {
	Prompts []*Prompt
}

// NewPrompt creates a new Prompt instance with default values.
func NewPrompt() *Prompt {
	prompt := &Prompt{}
	prompt.Role = User // Default role is User
	return prompt
}

// SetName sets the name of the prompt and returns the updated Prompt instance.
func (b *Prompt) SetName(name string) *Prompt {
	b.Name = name
	return b
}

// SetDescription sets the description of the prompt and returns the updated Prompt instance.
func (b *Prompt) SetDescription(description string) *Prompt {
	b.Description = description
	return b
}

// SetResultDescription sets the result description of the prompt and returns the updated Prompt instance.
func (b *Prompt) SetResultDescription(resultDescription string) *Prompt {
	b.ResultDescription = resultDescription
	return b
}

// SetText sets the text content of the prompt and returns the updated Prompt instance.
func (b *Prompt) SetText(text string) *Prompt {
	b.Text = text
	return b
}

// Build constructs and returns a new Prompt instance based on the current state.
func (b *Prompt) Build() *Prompt {
	return &Prompt{
		Name:              b.Name,
		Description:       b.Description,
		ResultDescription: b.ResultDescription,
		Text:              b.Text,
		Role:              b.Role,
	}
}

// Append adds a new Prompt to the Prompts collection.
func (p *Prompts) Append(prompt *Prompt) {
	p.Prompts = append(p.Prompts, prompt)
}

// GetPrompts retrieves all prompts from the Prompts collection.
func (p *Prompts) GetPrompts() []*Prompt {
	return p.Prompts
}

// addPrompts registers a collection of prompts with the MCP server and logs the registration.
func AddPrompts(prompts Prompts, mcpServer *server.MCPServer) {
	// Register the prompts with the MCP server
	for _, prompt := range prompts.GetPrompts() {
		mcpServer.AddPrompt(createPrompt(prompt))
		slog.Debug("Registered prompt", "name", prompt.Name, "description", prompt.Description)
	}
}

// createPrompt converts a Prompt into an MCP prompt and defines its handler function.
func createPrompt(prompt *Prompt) (mcp.Prompt, server.PromptHandlerFunc) {
	role := mcp.RoleUser
	if prompt.Role == Assistant {
		role = mcp.RoleAssistant
	}

	return mcp.NewPrompt(prompt.Name, mcp.WithPromptDescription(prompt.Description)),
		func(ctx context.Context, request mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
			return mcp.NewGetPromptResult(
				prompt.ResultDescription,
				[]mcp.PromptMessage{mcp.NewPromptMessage(role, mcp.NewTextContent(prompt.Text))},
			), nil
		}
}
