package tools

import (
	"context"
	"encoding/json"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func ListAllBudgetsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_all_budgets",
			mcp.WithDescription("List all budgets for a specific account in Harness Cloud Cost Management"),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListAllBudgets(ctx, accountId, nil)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetBudgetDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_budget_detail",
			mcp.WithDescription("Get budget detail for a specific budget in Harness Cloud Cost Management"),
			mcp.WithString("budgetId", mcp.Required(), mcp.Description("Budget ID")),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			budgetId, err := RequiredParam[string](request, "budgetId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, err := client.GetBudgetDetail(ctx, accountId, budgetId)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListBudgetsForPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_budgets_for_perspective",
			mcp.WithDescription("List budgets for a specific perspective in Harness Cloud Cost Management"),
			mcp.WithString("perspectiveId", mcp.Required(), mcp.Description("Perspective ID")),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			perspectiveId, err := RequiredParam[string](request, "perspectiveId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			data, err := client.ListBudgetsForPerspective(ctx, accountId, perspectiveId)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetBudgetCostDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_budget_cost_detail",
			mcp.WithDescription("Get budget cost detail for a specific account in Harness Cloud Cost Management"),
			mcp.WithString("budgetId", mcp.Required(), mcp.Description("Budget ID")),
			mcp.WithString("breakdown",
				mcp.Required(),
				mcp.Enum(dto.BudgetBreakdownMonthly, dto.BudgetBreakdownYearly),
				mcp.DefaultString(dto.BudgetBreakdownMonthly),
				mcp.Description("Breakdown type, e.g., 'MONTHLY', 'YEARLY'"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := RequiredParam[string](request, "accountId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			budgetId, err := OptionalParam[string](request, "budgetId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if budgetId == "" {
				return mcp.NewToolResultError("BudgetId must be provided"), nil
			}
			breakdown, err := OptionalParam[string](request, "breakdown")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if breakdown == "" {
				return mcp.NewToolResultError("Breakdown must be provided"), nil
			}
			data, err := client.GetBudgetCostDetail(ctx, accountId, budgetId, breakdown)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}
