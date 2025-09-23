package toolsets

import (
	"sync"
)

// ToolGroupTracker keeps track of which tools belong to which groups
// This eliminates the need for hardcoded mappings by learning the relationships
// when tools are registered.
type ToolGroupTracker interface {
	// GetGroupForTool returns the group name for a given tool name
	GetGroupForTool(toolName string) (string, bool)

	// GetAllToolMappings returns a copy of all tool-to-group mappings
	GetAllToolMappings() map[string]string

	// RegisterToolGroup registers a tool group and captures its tool mappings
	RegisterToolGroup(toolset *Toolset) error

	// Clear removes all registered mappings (useful for testing)
	Clear()

	// GetRegisteredGroups returns all registered group names
	GetRegisteredGroups() []string
}

// SimpleToolGroupTracker is the simple implementation of ToolGroupTracker
type SimpleToolGroupTracker struct {
	// toolToGroupMap maps tool names to their containing group names
	toolToGroupMap map[string]string

	// groupNames tracks all registered group names
	groupNames map[string]bool

	// mu protects concurrent access to the maps
	mu sync.RWMutex
}

// NewSimpleToolGroupTracker creates a new instance of SimpleToolGroupTracker
func NewSimpleToolGroupTracker() *SimpleToolGroupTracker {
	return &SimpleToolGroupTracker{
		toolToGroupMap: make(map[string]string),
		groupNames:     make(map[string]bool),
	}
}

// GetGroupForTool returns the group name for a given tool name
func (r *SimpleToolGroupTracker) GetGroupForTool(toolName string) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	group, exists := r.toolToGroupMap[toolName]
	return group, exists
}

// GetAllToolMappings returns a copy of all tool-to-group mappings
func (r *SimpleToolGroupTracker) GetAllToolMappings() map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Return a copy to prevent external modification
	mappings := make(map[string]string, len(r.toolToGroupMap))
	for tool, group := range r.toolToGroupMap {
		mappings[tool] = group
	}
	return mappings
}

// RegisterToolGroup registers a tool group and captures its tool mappings
func (r *SimpleToolGroupTracker) RegisterToolGroup(toolset *Toolset) error {
	if toolset == nil {
		return nil // Gracefully handle nil toolsets
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	// Track the group name
	r.groupNames[toolset.Name] = true

	// Extract tool names from all available tools (both read and write)
	allTools := toolset.GetAvailableTools()

	for _, serverTool := range allTools {
		toolName := serverTool.Tool.Name
		if toolName != "" {
			r.toolToGroupMap[toolName] = toolset.Name
		}
	}

	return nil
}

// Clear removes all registered mappings (useful for testing)
func (r *SimpleToolGroupTracker) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.toolToGroupMap = make(map[string]string)
	r.groupNames = make(map[string]bool)
}

// GetRegisteredGroups returns all registered group names
func (r *SimpleToolGroupTracker) GetRegisteredGroups() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	groups := make([]string, 0, len(r.groupNames))
	for name := range r.groupNames {
		groups = append(groups, name)
	}
	return groups
}

// Global tracker instance - this will be used throughout the application
var globalTracker ToolGroupTracker = NewSimpleToolGroupTracker()

// GetMainToolTracker returns the main tool group tracker instance
func GetMainToolTracker() ToolGroupTracker {
	return globalTracker
}

// SetMainToolTracker sets the main tool group tracker (useful for testing)
func SetMainToolTracker(tracker ToolGroupTracker) {
	globalTracker = tracker
}

// AutoRegisteringToolGroup wraps a ToolsetGroup and automatically registers tool groups
type AutoRegisteringToolGroup struct {
	*ToolsetGroup
	tracker ToolGroupTracker
}

// NewAutoRegisteringToolGroup creates a new auto-registering tool group
func NewAutoRegisteringToolGroup(readOnly bool, tracker ToolGroupTracker) *AutoRegisteringToolGroup {
	if tracker == nil {
		tracker = GetMainToolTracker()
	}

	return &AutoRegisteringToolGroup{
		ToolsetGroup: NewToolsetGroup(readOnly),
		tracker:      tracker,
	}
}

// AddToolset adds a toolset to the group and registers it with the tracker
func (artg *AutoRegisteringToolGroup) AddToolset(ts *Toolset) {
	// Add to the underlying toolset group
	artg.ToolsetGroup.AddToolset(ts)

	// Register with the tracker to capture tool mappings
	if artg.tracker != nil {
		artg.tracker.RegisterToolGroup(ts)
	}
}

// CreateAutoRegisteringGroup creates an AutoRegisteringToolGroup that automatically registers with the main tracker
// This function can be used as a drop-in replacement for NewToolsetGroup
func CreateAutoRegisteringGroup(readOnly bool) *AutoRegisteringToolGroup {
	return NewAutoRegisteringToolGroup(readOnly, nil)
}
