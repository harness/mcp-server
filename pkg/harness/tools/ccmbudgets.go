package tools

import (
	"context"
	"encoding/json"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func ListAllCcmBudgetsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_all_ccm_budgets",
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

func GetCcmBudgetDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_budget_detail",
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

func ListCcmBudgetsForPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_budgets_for_perspective",
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

func GetCcmBudgetCostDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_budget_cost_detail",
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

func CloneCcmBudgetTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("clone_ccm_budget",
			mcp.WithDescription("Clones a budget in Harness Cloud Cost Management"),
			mcp.WithString("budgetId", mcp.Required(), mcp.Description("Budget ID")),
			mcp.WithString("cloneName", mcp.Required(), mcp.Description("Name for the cloned budget")),
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
			cloneName, err := RequiredParam[string](request, "cloneName")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if budgetId == "" {
				return mcp.NewToolResultError("BudgetId must be provided"), nil
			}

			if cloneName == "" {
				return mcp.NewToolResultError("CloneName must be provided"), nil
			}

			data, err := client.CloneBudget(ctx, accountId, budgetId, cloneName)
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

func DeleteCcmBudgetTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("delete_ccm_budget",
			mcp.WithDescription("Deletes a budget in Harness Cloud Cost Management"),
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

			if budgetId == "" {
				return mcp.NewToolResultError("BudgetId must be provided"), nil
			}

			data, err := client.DeleteBudget(ctx, accountId, budgetId)
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

func CreateCcmBudgetTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createOrUpdateCcmBudgetTool(config, client, true)
}

func UpdateCcmBudgetTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return createOrUpdateCcmBudgetTool(config, client, false)
}

func createOrUpdateCcmBudgetTool(config *config.Config, client *client.CloudCostManagementService, create bool,
) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	toolName := "create_ccm_budget"
	toolDescription := "Create a budget in Harness Cloud Cost Management"
	if !create {
		toolName = "update_ccm_budget"
		toolDescription = "Update a budget in Harness Cloud Cost Management"
	}

	return mcp.NewToolWithRawSchema(toolName, toolDescription,
			createOrUpdateBudgetDefinition(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			return createOrUpdateBudgetHandler(config, ctx, request, client, create)
		}
}

func createOrUpdateBudgetHandler(
	config *config.Config,
	ctx context.Context,
	request mcp.CallToolRequest,
	client *client.CloudCostManagementService,
	create bool,
) (*mcp.CallToolResult, error) {

	accountId, err := getAccountID(config, request)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	uuid, err := OptionalParam[string](request, "uuid")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if !create && uuid == "" {
		return mcp.NewToolResultError("uuid must be provided for update"), nil
	}

	name, err := OptionalParam[string](request, "name")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if name == "" {
		return mcp.NewToolResultError("name must be provided"), nil
	}

	scope, err := OptionalParam[map[string]any](request, "scope")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	budgetType, err := OptionalParam[string](request, "type")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	budgetMonthlyBreakdown, err := OptionalParam[map[string]any](request, "budgetMonthlyBreakdown")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	budgetAmount, err := OptionalParam[float64](request, "budgetAmount")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	period, err := OptionalParam[string](request, "period")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	growthRate, err := OptionalParam[float64](request, "growthRate")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	actualCost, err := OptionalParam[float64](request, "actualCost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	forecastCost, err := OptionalParam[float64](request, "forecastCost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	lastMonthCost, err := OptionalParam[float64](request, "lastMonthCost")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	alertThresholds, err := OptionalAnyArrayParam(request, "alertThresholds")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	emailAddresses, err := OptionalStringArrayParam(request, "emailAddresses")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	userGroupIds, err := OptionalStringArrayParam(request, "userGroupIds")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	parentBudgetGroupId, err := OptionalParam[string](request, "parentBudgetGroupId")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	notifyOnSlack, err := OptionalParam[bool](request, "notifyOnSlack")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	isNgBudget, err := OptionalParam[bool](request, "isNgBudget")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	startTimeStr, err := OptionalParam[string](request, "startTime")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	if startTimeStr == "" {
		return mcp.NewToolResultError("startTime must be provided"), nil
	}

	startTime, err := utils.FormatMMDDYYYYToUnixMillis(startTimeStr)
	if err != nil {
		return mcp.NewToolResultError("Error parsing start date" + err.Error()), nil
	}
	endTimeStr, err := OptionalParam[string](request, "endTime")
	if err != nil {
		return mcp.NewToolResultError("Error parsing end date" + err.Error()), nil
	}

	endTime := int64(0)
	if endTimeStr != "" {
		endTime, err = utils.FormatMMDDYYYYToUnixMillis(endTimeStr)
		if err != nil {
			return mcp.NewToolResultError("Error getting end time" + err.Error()), nil
		}
	}

	budgetHistory, err := OptionalParam[map[string]any](request, "budgetHistory")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	disableCurrencyWarning, err := OptionalParam[bool](request, "disableCurrencyWarning")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	ngBudget, err := OptionalParam[bool](request, "ngBudget")
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	params := map[string]any{
		"uuid":                   uuid,
		"accountId":              accountId,
		"name":                   name,
		"scope":                  scope,
		"type":                   budgetType,
		"budgetMonthlyBreakdown": budgetMonthlyBreakdown,
		"budgetAmount":           budgetAmount,
		"period":                 period,
		"growthRate":             growthRate,
		"actualCost":             actualCost,
		"forecastCost":           forecastCost,
		"lastMonthCost":          lastMonthCost,
		"alertThresholds":        alertThresholds,
		"emailAddresses":         emailAddresses,
		"userGroupIds":           userGroupIds,
		"parentBudgetGroupId":    parentBudgetGroupId,
		"notifyOnSlack":          notifyOnSlack,
		"isNgBudget":             isNgBudget,
		"startTime":              startTime,
		"endTime":                endTime,
		"budgetHistory":          budgetHistory,
		"disableCurrencyWarning": disableCurrencyWarning,
		"ngBudget":               ngBudget,
	}

	data, err := createOrUpdateRequest(accountId, params, ctx, client, create)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	r, err := json.Marshal(data)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	return mcp.NewToolResultText(string(r)), nil
}

func createOrUpdateRequest(
	accountId string,
	params map[string]any,
	ctx context.Context,
	client *client.CloudCostManagementService,
	create bool,
) (*map[string]any, error) {
	if create {
		return client.CreateBudget(ctx, accountId, params)
	} else {
		return client.UpdateBudget(ctx, accountId, params)
	}
}

func createOrUpdateBudgetDefinition() json.RawMessage {
	return toRawMessage(createOrUpdateBudgetDefinitionMap(), []string{})
}

func createOrUpdateBudgetDefinitionMap() map[string]any {

	now := time.Now()
	defaultStartTime := utils.FormatUnixToMMDDYYYY(now.AddDate(0, 0, -60).Unix())

	return map[string]any{
		"uuid": map[string]any{
			"type":        "string",
			"description": "Unique identifier for the budget.",
		},
		"name": map[string]any{
			"type":        "string",
			"description": "Name of the budget.",
		},
		"scope": map[string]any{
			"type":        "object",
			"description": "Scope of the budget.",
			"properties": map[string]any{
				"budgetScopeType": map[string]any{"type": "string"},
				"entityIds":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"entityNames":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
				"type":            map[string]any{"type": "string"},
			},
		},
		"type": map[string]any{
			"type":        "string",
			"description": "Type of the budget (e.g., SPECIFIED_AMOUNT).",
			"enum":        GetBudgetTypes(),
			"default":     dto.BudgetTypeSpecifiedAmount,
		},
		"budgetMonthlyBreakdown": map[string]any{
			"type":        "object",
			"description": "Monthly breakdown details for the budget.",
			"properties": map[string]any{
				"budgetBreakdown": map[string]any{
					"type":    "string",
					"enum":    GetBudgetBreakdowns(),
					"default": dto.BudgetBreakdownMonthly,
				},
				"budgetMonthlyAmount": map[string]any{
					"type": "array",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"time":  map[string]any{"type": "number"},
							"value": map[string]any{"type": "number"},
						},
					},
				},
				"actualMonthlyCost":      map[string]any{"type": "array", "items": map[string]any{"type": "number"}},
				"forecastMonthlyCost":    map[string]any{"type": "array", "items": map[string]any{"type": "number"}},
				"yearlyLastPeriodCost":   map[string]any{"type": "array", "items": map[string]any{"type": "number"}},
				"forecastCostConfigured": map[string]any{"type": "boolean"},
			},
		},
		"budgetAmount": map[string]any{
			"type":        "number",
			"description": "Total budget amount.",
		},
		"period": map[string]any{
			"type":        "string",
			"description": "Budget period (e.g., DAILY).",
			"enum":        GetBudgetPeriods(),
			"default":     dto.BudgetPeriodDaily,
		},
		"growthRate": map[string]any{
			"type":        "number",
			"description": "Growth rate for the budget.",
			"default":     0,
		},
		"actualCost": map[string]any{
			"type":        "number",
			"description": "Actual cost incurred.",
		},
		"forecastCost": map[string]any{
			"type":        "number",
			"description": "Forecasted cost.",
		},
		"lastMonthCost": map[string]any{
			"type":        "number",
			"description": "Cost for the last month.",
		},
		"alertThresholds": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"percentage": map[string]any{"type": "number"},
					"basedOn": map[string]any{
						"type": "string",
						"enum": GetBudgetThresholdBases(),
					},
					"emailAddresses": map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					"userGroupIds":   map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					"slackWebhooks":  map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
					"alertsSent":     map[string]any{"type": "number"},
					"crossedAt":      map[string]any{"type": "number"},
				},
			},
		},
		"emailAddresses": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
		"userGroupIds": map[string]any{
			"type":  "array",
			"items": map[string]any{"type": "string"},
		},
		"parentBudgetGroupId": map[string]any{
			"type":        "string",
			"description": "Parent budget group ID.",
		},
		"notifyOnSlack": map[string]any{
			"type":        "boolean",
			"description": "Notify on Slack.",
		},
		"isNgBudget": map[string]any{
			"type":        "boolean",
			"description": "Is NG budget.",
		},
		"startTime": map[string]any{
			"type":        "string",
			"description": "Start time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)",
			"default":     defaultStartTime,
		},
		"endTime": map[string]any{
			"type":        "string",
			"description": "End time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)",
		},
		"budgetHistory": map[string]any{
			"type":        "object",
			"description": "Budget history keyed by property.",
			"additionalProperties": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"time":                     map[string]any{"type": "number"},
					"endTime":                  map[string]any{"type": "number"},
					"actualCost":               map[string]any{"type": "number"},
					"forecastCost":             map[string]any{"type": "number"},
					"budgeted":                 map[string]any{"type": "number"},
					"budgetVariance":           map[string]any{"type": "number"},
					"budgetVariancePercentage": map[string]any{"type": "number"},
				},
			},
		},
		"disableCurrencyWarning": map[string]any{
			"type":        "boolean",
			"description": "Disable currency warning.",
		},
		"ngBudget": map[string]any{
			"type":        "boolean",
			"description": "NG budget flag.",
		},
	}

}

func GetBudgetTypes() []string {
	return []string{
		dto.BudgetTypeSpecifiedAmount,
		dto.BudgetTypePreviousMonthSpend,
		dto.BudgetTypePreviousPeriodSpend,
	}
}

func GetBudgetBreakdowns() []string {
	return []string{
		dto.BudgetBreakdownYearly,
		dto.BudgetBreakdownMonthly,
	}
}

func GetBudgetPeriods() []string {
	return []string{
		dto.BudgetPeriodDaily,
		dto.BudgetPeriodWeekly,
		dto.BudgetPeriodMonthly,
		dto.BudgetPeriodQuarterly,
		dto.BudgetPeriodYearly,
	}
}

func GetBudgetThresholdBases() []string {
	return []string{
		dto.BudgetThresholdBaseActualCost,
		dto.BudgetThresholdBaseForecastedCost,
		dto.BudgetThresholdBasePartialCost,
	}
}
