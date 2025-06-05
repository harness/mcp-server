package harness

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetAccessHeatmapTool returns a tool for generating access heatmap data from Keycloak events
func GetAccessHeatmapTool(config *config.Config, authClient *client.AuthService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_access_heatmap",
			mcp.WithDescription("Generate access heatmap data from Keycloak events"),
			mcp.WithString("timeRange",
				mcp.Required(),
				mcp.Description("Time range for the heatmap data"),
				mcp.Enum("1h", "24h", "7d", "30d"),
			),
			mcp.WithArray("eventTypes",
				mcp.Required(),
				mcp.Description("Types of events to include in the heatmap"),
			),
			mcp.WithString("userId",
				mcp.Description("Optional user ID to filter events"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			timeRange, err := OptionalParam[string](request, "timeRange")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			eventTypesInterface, err := OptionalParam[[]interface{}](request, "eventTypes")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			// Convert []interface{} to []string
			eventTypes := make([]string, len(eventTypesInterface))
			for i, v := range eventTypesInterface {
				if str, ok := v.(string); ok {
					eventTypes[i] = str
				} else {
					return mcp.NewToolResultError("eventTypes must be an array of strings"), nil
				}
			}

			userId, err := OptionalParam[string](request, "userId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Generate access heatmap using the auth client
			heatmapData, err := authClient.GetAccessHeatmap(ctx, timeRange, eventTypes, userId)
			if err != nil {
				return nil, fmt.Errorf("failed to get access heatmap: %w", err)
			}

			result := map[string]interface{}{
				"status": "success",
				"data":   heatmapData,
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal access heatmap data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetUserEventsTool
func GetUserEventsTool(config *config.Config, authClient *client.AuthService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_user_events",
			mcp.WithDescription("Get user events"),
			mcp.WithString("userId",
				mcp.Description("Optional user ID to filter events"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			events, err := authClient.GetEvents(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to get user events: %w", err)
			}
			result := map[string]interface{}{
				"status": "success",
				"data":   events,
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal user events data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetUserSessionsTool returns a tool for getting active user sessions and devices
func GetUserSessionsTool(config *config.Config, authClient *client.AuthService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_user_sessions",
			mcp.WithDescription("Get active user sessions and devices"),
			mcp.WithString("userId",
				mcp.Description("Optional user ID to filter sessions"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			sessions, err := authClient.GetUserSessions(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to get user sessions: %w", err)
			}
			result := map[string]interface{}{
				"status": "success",
				"data":   sessions,
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal user sessions data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetSecurityEventsTool returns a tool for getting security events and anomalies
func GetSecurityEventsTool(config *config.Config, authClient *client.AuthService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_security_events",
			mcp.WithDescription("Get security events and anomalies"),
			mcp.WithString("severity",
				mcp.Required(),
				mcp.Description("Severity level of events to retrieve"),
				mcp.Enum("low", "medium", "high"),
			),
			mcp.WithNumber("limit",
				mcp.Description("Maximum number of events to return"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Implementation would go here
			result := map[string]interface{}{
				"status": "success",
				"data":   "Security events data would be returned here",
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal security events data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GenerateComplianceReportTool returns a tool for generating security compliance reports
func GenerateComplianceReportTool(config *config.Config, authClient *client.AuthService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("generate_compliance_report",
			mcp.WithDescription("Generate security compliance report"),
			mcp.WithString("reportType",
				mcp.Required(),
				mcp.Description("Type of compliance report to generate"),
				mcp.Enum("access", "admin", "full"),
			),
			mcp.WithString("dateRange",
				mcp.Required(),
				mcp.Description("Date range for the report"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Implementation would go here
			result := map[string]interface{}{
				"status": "success",
				"data":   "Compliance report data would be returned here",
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal compliance report data: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
