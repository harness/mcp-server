package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// WithDashboardPagination adds page and size parameters with dashboard-specific defaults
func WithDashboardPagination() mcp.ToolOption {
	return func(tool *mcp.Tool) {
		mcp.WithNumber("page",
			mcp.Description("Page number for pagination - page 1 is the first page"),
			mcp.Min(1),
			mcp.DefaultNumber(1),
		)(tool)
		mcp.WithNumber("size",
			mcp.Description("Number of items per page"),
			mcp.DefaultNumber(100),
			mcp.Max(100),
		)(tool)
	}
}

// fetchDashboardPagination fetches pagination parameters from the request with dashboard-specific defaults
func fetchDashboardPagination(request mcp.CallToolRequest) (page, size int, err error) {
	pageVal, err := OptionalIntParamWithDefault(request, "page", 1)
	if err != nil {
		return 0, 0, err
	}
	page = int(pageVal)

	sizeVal, err := OptionalIntParamWithDefault(request, "size", 100)
	if err != nil {
		return 0, 0, err
	}
	size = int(sizeVal)

	return page, size, nil
}

// ListDashboardsTool creates a tool for listing all dashboards in Harness
func ListDashboardsTool(config *config.Config, client *client.DashboardService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_dashboards",
			mcp.WithDescription("Lists all available Harness dashboards"),
			WithDashboardPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Default tags - set all module tags to true
			defaultTags := "HARNESS=true&CD=true&CE=true&CET=true&CF=true&CHAOS=true&CI=true&DBOPS=true&IACM=true&IDP=true&SSCA=true&STO=true&SRM=true"

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get pagination parameters from the request
			page, size, err := fetchDashboardPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the updated ListDashboards method with pagination parameters from the request
			response, err := client.ListDashboards(ctx, scope, page, size, "", defaultTags)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to list dashboards: %v", err)), nil
			}

			// Define friendly names for categories to improve readability
			categoryNames := map[string]string{
				"CD":        "Continuous Delivery",
				"CE":        "Cloud Cost Management (CCM)",
				"CET":       "Customer Experience",
				"CF":        "Cloud Formation",
				"CHAOS":     "Chaos Engineering",
				"CI":        "Continuous Integration",
				"CI_TI":     "Test Intelligence",
				"DBOPS":     "Database Operations",
				"IACM":      "Infrastructure as Code",
				"IDP":       "Internal Developer Platform",
				"SSCA":      "Software Supply Chain",
				"STO":       "Security Testing",
				"SRM":       "Service Reliability Management",
				"custom":    "Custom Dashboards",
				"UNIVERSAL": "Universal Dashboards",
			}

			// Process result, organizing dashboards by model categories with chat-friendly format
			formattedCategories := make(map[string][]string)

			// Track which categories have dashboards
			activeCategoryOrder := []string{}
			// Maps categories to dashboard entries
			categoryDashboards := make(map[string][]dto.Dashboard)

			for _, dashboard := range response.Resource {
				// We can use the dashboard object directly since we're now using dto.Dashboard

				// Format the dashboard display as "ID: {id} - {title}"
				displayFormat := fmt.Sprintf("ID: %s - %s", dashboard.ID, dashboard.Title)

				// Categorize dashboard by models
				modelCategories := dashboard.Models
				if len(modelCategories) == 0 {
					// If no models, categorize as "custom"
					category := "custom"
					if _, exists := formattedCategories[category]; !exists {
						formattedCategories[category] = []string{}
						activeCategoryOrder = append(activeCategoryOrder, category)
					}
					formattedCategories[category] = append(formattedCategories[category], displayFormat)

					// Also keep the original structure for compatibility
					if _, exists := categoryDashboards[category]; !exists {
						categoryDashboards[category] = []dto.Dashboard{}
					}
					categoryDashboards[category] = append(categoryDashboards[category], dashboard)
				} else {
					// Add to each model category
					for _, model := range modelCategories {
						if _, exists := formattedCategories[model]; !exists {
							formattedCategories[model] = []string{}
							activeCategoryOrder = append(activeCategoryOrder, model)
						}
						formattedCategories[model] = append(formattedCategories[model], displayFormat)

						// Also keep the original structure for compatibility
						if _, exists := categoryDashboards[model]; !exists {
							categoryDashboards[model] = []dto.Dashboard{}
						}
						categoryDashboards[model] = append(categoryDashboards[model], dashboard)
					}
				}
			}

			// Create a well-structured response object designed for chat display
			responseObj := map[string]interface{}{
				"display_format": "list", // Hint to LLM to use list format instead of tables
				"total_count":    response.Items,
				"categories":     formattedCategories,
				"category_names": categoryNames,
				"category_order": activeCategoryOrder,
				"raw_data":       categoryDashboards,
				"format_example": "Category Name:\n- ID: 123 - Dashboard Name\n- ID: 456 - Another Dashboard", // Example of preferred formatting
			}

			// Convert to JSON
			resultJSON, err := json.Marshal(responseObj)
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
				mcp.Description("Reporting timeframe in days"),
				mcp.DefaultNumber(30),
				mcp.Min(1),
				mcp.Max(365),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get required parameters
			dashboardID, err := RequiredParam[string](request, "dashboard_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get reporting timeframe
			reportingTimeframe, err := OptionalParam[float64](request, "reporting_timeframe")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Convert to int
			timeframeInt := int(reportingTimeframe)

			// Get scope from the request
			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch the dashboard data
			dashboardData, err := client.GetDashboardData(ctx, scope, dashboardID, timeframeInt)
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
