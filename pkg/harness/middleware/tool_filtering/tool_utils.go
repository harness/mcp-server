package tool_filtering

import (
	"log/slog"

	"github.com/harness/harness-mcp/pkg/toolsets"
)

// findToolGroup finds the toolset associated with a given tool name
// It uses the global toolset tracker to look up the toolset name
// If the tool is found, it logs the tool name and toolset name
// If the tool is not found, it returns an empty string
func findToolGroup(toolName string, logger *slog.Logger) string {
	// Use the centralized tracker to look up the toolset for this tool
	tracker := toolsets.GetMainToolTracker()
	if toolset, exists := tracker.GetGroupForTool(toolName); exists {
		logger.Debug("Tool found in tracker", "tool_name", toolName, "toolset", toolset)
		return toolset
	}
	return ""
}
