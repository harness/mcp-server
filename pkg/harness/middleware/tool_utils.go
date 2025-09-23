package middleware

import (
	"log/slog"
	"strings"

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

	// Fallback to pattern-based mapping when tracker is not available
	fallbackToolset := getFallbackToolsetMapping(toolName, logger)
	if fallbackToolset != "" {
		logger.Debug("Tool mapped using fallback pattern", "tool_name", toolName, "toolset", fallbackToolset)
		return fallbackToolset
	}

	// Default to pipelines (CORE) for unknown tools
	logger.Debug("Tool not found, defaulting to pipelines", "tool_name", toolName)
	return "pipelines"
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

// getFallbackToolsetMapping provides pattern-based tool-to-toolset mapping
// when the centralized tracker is not available (e.g., during tests)
func getFallbackToolsetMapping(toolName string, logger *slog.Logger) string {
	// Define common tool patterns and their corresponding toolsets
	toolPatterns := map[string]string{
		// Pipeline tools
		"get_pipeline":           "pipelines",
		"list_pipelines":         "pipelines",
		"create_pipeline":        "pipelines",
		"update_pipeline":        "pipelines",
		"delete_pipeline":        "pipelines",
		"execute_pipeline":       "pipelines",
		"get_pipeline_execution": "pipelines",
		
		// Connector tools
		"list_connectors":   "connectors",
		"get_connector":     "connectors",
		"create_connector":  "connectors",
		"update_connector":  "connectors",
		"delete_connector":  "connectors",
		"test_connector":    "connectors",
		
		// Dashboard tools
		"get_dashboard":     "dashboards",
		"list_dashboards":   "dashboards",
		"create_dashboard":  "dashboards",
		"update_dashboard":  "dashboards",
		"delete_dashboard":  "dashboards",
		
		// Audit tools
		"get_audit_logs":    "audit",
		"list_audit_events": "audit",
		"search_audit":      "audit",
		
		// CI tools
		"get_build_details":     "ci",
		"list_builds":           "ci",
		"trigger_build":         "ci",
		"get_build_logs":        "ci",
		"cancel_build":          "ci",
		"get_test_results":      "ci",
		
		// CD tools
		"get_deployment_status": "cd",
		"list_deployments":      "cd",
		"trigger_deployment":    "cd",
		"rollback_deployment":   "cd",
		"get_service_details":   "cd",
		
		// CCM tools
		"get_cost_analysis":     "ccm",
		"list_cost_categories":  "ccm",
		"get_budget_details":    "ccm",
		"create_budget":         "ccm",
		
		// STO tools
		"get_security_scan":     "sto",
		"list_vulnerabilities":  "sto",
		"get_scan_results":      "sto",
		"trigger_security_scan": "sto",
	}
	
	// Check for exact match first
	if toolset, exists := toolPatterns[toolName]; exists {
		return toolset
	}
	
	// Check for pattern matches using prefixes
	for pattern, toolset := range toolPatterns {
		if strings.HasPrefix(toolName, strings.Split(pattern, "_")[0]) {
			return toolset
		}
	}
	
	return ""
}
