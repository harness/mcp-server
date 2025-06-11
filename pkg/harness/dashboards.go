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

// ListDashboardsTool creates a tool for listing all dashboards in Harness
func ListDashboardsTool(config *config.Config, client *client.DashboardService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_dashboards",
			mcp.WithDescription("Lists all available Harness dashboards"),
			mcp.WithString("filter",
				mcp.Description("Optional filter to apply when listing dashboards"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get filter from request if present
			filter, _ := OptionalParam[string](request, "filter")

			// Set up parameters for API call
			tags := ""
			if filter != "" {
				tags = filter
			}

			// Get the dashboards with direct parameters - no scope required
			response, err := client.ListDashboards(ctx, 1, 100, "", tags)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to list dashboards: %v", err)), nil
			}

			// Process result, organizing dashboards by model categories only to optimize token usage
			categories := make(map[string][]map[string]string)

			for _, dashboard := range response.Resource {
				// Create dashboard entry with essential fields
				dashboardEntry := map[string]string{
					"id":    dashboard.ID,
					"title": dashboard.Title,
					"type":  dashboard.Type,
				}

				// Categorize dashboard by models
				modelCategories := dashboard.Models
				if len(modelCategories) == 0 {
					// If no models, categorize as "custom"
					if _, exists := categories["custom"]; !exists {
						categories["custom"] = []map[string]string{}
					}
					categories["custom"] = append(categories["custom"], dashboardEntry)
				} else {
					// Add to each model category
					for _, model := range modelCategories {
						if _, exists := categories[model]; !exists {
							categories[model] = []map[string]string{}
						}
						categories[model] = append(categories[model], dashboardEntry)
					}
				}
			}

			// Convert only categories to JSON string to save tokens
			resultJSON, err := json.Marshal(categories)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal result: %v", err)), nil
			}

			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetDashboardDataTool creates a tool for retrieving data from a specific dashboard
func GetDashboardDataTool(config *config.Config, client *client.DashboardService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_dashboard_data",
			mcp.WithDescription("Retrieves the data from a specific Harness dashboard"),
			mcp.WithString("dashboard_id",
				mcp.Required(),
				mcp.Description("The ID of the dashboard to retrieve data from"),
			),
			mcp.WithNumber("reporting_timeframe",
				mcp.Description("Reporting timeframe in days (default: 30)"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get required parameters
			dashboardID, err := requiredParam[string](request, "dashboard_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get reporting timeframe (defaulting to 30 if not present)
			reportingTimeframe, err := OptionalParam[float64](request, "reporting_timeframe")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			// Convert to int and use default if not set
			timeframeInt := int(reportingTimeframe)
			if timeframeInt <= 0 {
				timeframeInt = 30 // Default to 30 days
			}

			// Fetch the dashboard data
			dashboardData, err := client.GetDashboardData(ctx, dashboardID, timeframeInt)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get dashboard data: %v", err)), nil
			}

			// Convert dashboard data to JSON string
			resultJSON, err := json.Marshal(map[string]interface{}{
				"dashboard_id": dashboardID,
				"data":         dashboardData,
			})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal result: %v", err)), nil
			}

			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}
