package test

import (
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	"github.com/harness/mcp-server/pkg/modules"
	"github.com/mark3labs/mcp-go/mcp"
)

// GetAllTools registers all modules using NoOp providers and returns all tool definitions.
// This allows introspection of tool metadata without requiring real API credentials.
func GetAllTools() ([]mcp.Tool, error) {
	cleanup := useNoOpProviders()
	defer cleanup()

	tsg := toolsets.NewToolsetGroup(true)
	registry := modules.NewModuleRegistry(&config.McpServerConfig{}, tsg)

	for _, m := range registry.GetAllModules() {
		if err := m.RegisterToolsets(); err != nil {
			return nil, fmt.Errorf("module %s: %w", m.ID(), err)
		}
	}

	// Extract tools from all toolsets
	var tools []mcp.Tool
	for _, toolset := range tsg.Toolsets {
		for _, st := range toolset.GetAvailableTools() {
			tools = append(tools, st.Tool)
		}
	}
	return tools, nil
}
