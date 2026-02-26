package toolsets

import (
	"fmt"
	"log/slog"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// NewServerTool creates a new server tool with the given tool and handler
func NewServerTool(tool mcp.Tool, handler server.ToolHandlerFunc) server.ServerTool {
	return server.ServerTool{Tool: tool, Handler: handler}
}

// Toolset represents a group of related tools
type Toolset struct {
	Name        string
	Description string
	Enabled     bool
	readOnly    bool
	writeTools  []server.ServerTool
	readTools   []server.ServerTool
}

// GetActiveTools returns all active tools based on toolset state
func (t *Toolset) GetActiveTools() []server.ServerTool {
	if t.Enabled {
		if t.readOnly {
			return t.readTools
		}
		return append(t.readTools, t.writeTools...)
	}
	return nil
}

// GetAvailableTools returns all available tools regardless of enabled state
func (t *Toolset) GetAvailableTools() []server.ServerTool {
	if t.readOnly {
		return t.readTools
	}
	return append(t.readTools, t.writeTools...)
}

// RegisterTools registers all enabled tools with the server
func (t *Toolset) RegisterTools(s *server.MCPServer) {
	if !t.Enabled {
		return
	}
	for _, tool := range t.readTools {
		s.AddTool(tool.Tool, tool.Handler)
	}
	if !t.readOnly {
		for _, tool := range t.writeTools {
			s.AddTool(tool.Tool, tool.Handler)
		}
	}
}

// SetReadOnly sets the toolset to read-only mode
func (t *Toolset) SetReadOnly() {
	t.readOnly = true
}

// AddWriteTools adds write tools to the toolset
func (t *Toolset) AddWriteTools(tools ...server.ServerTool) *Toolset {
	if !t.readOnly {
		t.writeTools = append(t.writeTools, tools...)
	}
	return t
}

// AddReadTools adds read tools to the toolset
func (t *Toolset) AddReadTools(tools ...server.ServerTool) *Toolset {
	t.readTools = append(t.readTools, tools...)
	return t
}

// ToolsetGroup manages multiple toolsets
type ToolsetGroup struct {
	Toolsets     map[string]*Toolset
	everythingOn bool
	readOnly     bool
}

// NewToolsetGroup creates a new toolset group
func NewToolsetGroup(readOnly bool) *ToolsetGroup {
	return &ToolsetGroup{
		Toolsets:     make(map[string]*Toolset),
		everythingOn: false,
		readOnly:     readOnly,
	}
}

// AddToolset adds a toolset to the group
func (tg *ToolsetGroup) AddToolset(ts *Toolset) {
	if tg.readOnly {
		ts.SetReadOnly()
	}
	tg.Toolsets[ts.Name] = ts
}

// NewToolset creates a new toolset with the given name and description
func NewToolset(name string, description string) *Toolset {
	return &Toolset{
		Name:        name,
		Description: description,
		Enabled:     false,
		readOnly:    false,
	}
}

// IsEnabled checks if a toolset is enabled
func (tg *ToolsetGroup) IsEnabled(name string) bool {
	if tg.everythingOn {
		return true
	}

	feature, exists := tg.Toolsets[name]
	if !exists {
		return false
	}
	return feature.Enabled
}

// EnableToolsets enables multiple toolsets by name
func (tg *ToolsetGroup) EnableToolsets(names []string) error {
	if len(names) == 0 {
		err := tg.EnableToolset("core")
		if err != nil {
			return err
		}
		return nil
	}

	// Resolve any old toolset names to new names
	names = ResolveToolsetAliases(names)

	for _, name := range names {
		if name == "all" {
			tg.everythingOn = true
			break
		}
		err := tg.EnableToolset(name)
		if err != nil {
			return err
		}
	}

	if tg.everythingOn {
		for name := range tg.Toolsets {
			err := tg.EnableToolset(name)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// EnableToolset enables a specific toolset by name
func (tg *ToolsetGroup) EnableToolset(name string) error {
	// Resolve any old toolset name to new name
	name = ResolveToolsetAlias(name)

	toolset, exists := tg.Toolsets[name]
	if !exists {
		return fmt.Errorf("toolset %s does not exist", name)
	}

	// Only log if not already enabled
	if !toolset.Enabled {
		toolset.Enabled = true
		tg.Toolsets[name] = toolset

		// Log each tool in this toolset
		for _, tool := range toolset.GetAvailableTools() {
			slog.Info("Tool enabled", "toolset", name, "tool", tool.Tool.Name)
		}
	}

	return nil
}

// RegisterTools registers all enabled toolsets with the server
func (tg *ToolsetGroup) RegisterTools(s *server.MCPServer) {
	if tg == nil || len(tg.Toolsets) == 0 {
		return
	}

	for _, toolset := range tg.Toolsets {
		if toolset != nil {
			toolset.RegisterTools(s)
		}
	}
}
