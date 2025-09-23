package middleware

import (
	"log/slog"

	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// findToolGroup determines which toolset/group a tool belongs to by first checking
// the centralized tracker, then falling back to pattern matching for unknown tools.
// Special handling for "default" toolset - maps it to appropriate CORE toolsets.
func findToolGroup(toolName string, logger *slog.Logger) string {
	// Use the centralized tracker to look up the toolset for this tool
	tracker := toolsets.GetMainToolTracker()
	if toolset, exists := tracker.GetGroupForTool(toolName); exists {
		logger.Debug("Tool found in tracker", "tool_name", toolName, "toolset", toolset)

		// Handle "default" toolset specially - map to appropriate CORE toolset
		if toolset == "default" {
			mappedToolset := mapDefaultToolToCoreToolsetUsingRegistry(toolName, logger)
			if mappedToolset != "" {
				logger.Debug("Mapped default tool to CORE toolset", "tool_name", toolName, "original_toolset", "default", "mapped_toolset", mappedToolset)
				return mappedToolset
			}
			logger.Debug("Could not map default tool to CORE toolset, keeping as default", "tool_name", toolName)
		}

		return toolset
	}

	return ""
}

// mapDefaultToolToCoreToolsetUsingRegistry maps tools from the "default" toolset to their appropriate CORE toolsets
// using the module registry to find which toolset a tool should belong to based on actual registrations
func mapDefaultToolToCoreToolsetUsingRegistry(toolName string, logger *slog.Logger) string {
	// Get the global registry
	registry := modules.GetGlobalRegistry()
	if registry == nil {
		logger.Warn("Global registry not available for default tool mapping", "tool_name", toolName)
		return ""
	}

	// Get all CORE module toolsets
	coreToolsets := registry.GetToolsetsForModule("CORE")
	logger.Debug("CORE toolsets available", "toolsets", coreToolsets, "tool_name", toolName)

	// Check each CORE toolset to see if it contains this tool
	toolsetGroup := registry.GetToolsetGroup()
	for _, toolsetName := range coreToolsets {
		// Get the toolset from the toolset group
		if toolset, exists := toolsetGroup.Toolsets[toolsetName]; exists {
			// Check if this toolset contains the tool
			allTools := toolset.GetAvailableTools()
			for _, serverTool := range allTools {
				if serverTool.Tool.Name == toolName {
					logger.Debug("Found tool in CORE toolset", "tool_name", toolName, "toolset", toolsetName)
					return toolsetName
				}
			}
		}
	}

	// If no mapping found, return empty string to keep as "default"
	logger.Debug("No CORE toolset mapping found for default tool", "tool_name", toolName)
	return ""
}
