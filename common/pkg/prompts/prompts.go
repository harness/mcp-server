package prompts

import (
	"github.com/mark3labs/mcp-go/server"
)

// RegisterPrompts initializes and registers predefined prompts with the MCP server.
// This is a convenience function that uses the default PromptRegistrar implementation.
// For backward compatibility, this function delegates to the interface-based implementation.
func RegisterPrompts(mcpServer *server.MCPServer) {
	registrar := NewPromptRegistrar()
	registrar.RegisterPrompts(mcpServer)
}
