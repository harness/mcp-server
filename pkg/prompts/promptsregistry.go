package prompts

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// harness.prompts is intended to make adding guideline prompts easier by hidding mcp framework details.
// It also wraps the mcp-go framework so that it can be "easily" replaced if necessary.

// Role represents the role of the prompt creator, either User or Assistant.
type Role int

type Mode string

const (
	User      Role = iota // 0
	Assistant             // 1
)

const (
	Standard Mode = "standard"
	Architect Mode = "architect"
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

func createPrompt(prompt *Prompt) (mcp.Prompt, server.PromptHandlerFunc) {
	role := mcp.RoleUser
	if prompt.Role == Assistant {
		role = mcp.RoleAssistant
	}

	return mcp.NewPrompt(
			prompt.Name,
			mcp.WithPromptDescription(prompt.Description),
			mcp.WithArgument("mode", mcp.ArgumentDescription("Selects the prompt mode: 'standard' or 'architect'")),
		),
		func(ctx context.Context, request mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
			// Determine mode (default to "standard") and return different prompt text accordingly.
			mode := string(Standard) // Default to standard mode
            if v, ok := request.Params.Arguments["mode"]; ok && v != "" {
                mode = v
            }

            // Parse the JSON-encoded map of prompt contents
            var modeContents map[string]string
            if err := json.Unmarshal([]byte(prompt.Text), &modeContents); err != nil {
                slog.Error("Failed to parse prompt content JSON", "error", err, "promptName", prompt.Name)
                return nil, err
            }

            // Get the content for the requested mode, fallback to standard if not found
            text, ok := modeContents[mode]
            if !ok {
                // If the requested mode is not available, fall back to standard mode
                text, ok = modeContents[string(Standard)]
                if !ok {
                    return nil, fmt.Errorf("prompt mode %s not found for prompt %s", mode, prompt.Name)
                }
            }

            return mcp.NewGetPromptResult(
                prompt.ResultDescription,
                []mcp.PromptMessage{mcp.NewPromptMessage(role, mcp.NewTextContent(text))},
            ), nil
		}
}