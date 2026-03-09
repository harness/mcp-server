package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/harness/mcp-server/common/pkg/event"
	"github.com/harness/mcp-server/common/pkg/event/types"
	"github.com/harness/mcp-server/common/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	CCMCostCategoryCostTargetsEventType = "cost_category_cost_targets"

	// CCM Cost Category Key Values Event Tool
	CCMReportCostCategoryKeyValuesToolID = "ccm_report_cost_category_key_values_event"

	// Event name used in event.NewCustomEvent() for UI compatibility
	CCMCostCategoryKeyValuesEventName = "ccm_cost_category_key_values_event"

	// Event name constants for ccm_cost_category_key_values_event
	CCMEventNamePresentCheckbox = "present_checkbox"
	CCMEventNameDropDownList    = "drop_down_list"
)

// CheckboxItem represents a single item in the present_checkbox event data
type CheckboxItem struct {
	Key       string  `json:"key"`
	TotalCost float64 `json:"total_cost"`
}

// DropdownValue represents a value within a cost category dropdown
type DropdownValue struct {
	Value     string  `json:"value"`
	TotalCost float64 `json:"total_cost"`
}

// DropdownGroup represents a grouped cost category with its values
type DropdownGroup struct {
	CostCategoryName string          `json:"cost_category_name"`
	ValueList        []DropdownValue `json:"value_list"`
}

// JSON Schema definitions for documentation and validation
var (
	checkboxSchemaExample = `[
  {"key": "label_key_1", "total_cost": 100.50},
  {"key": "label_key_2", "total_cost": 200.75}
]`

	dropdownSchemaExample = `[
  {
    "cost_category_name": "Environment",
    "value_list": [
      {"value": "production", "total_cost": 1000.00},
      {"value": "staging", "total_cost": 500.00}
    ]
  }
]`

	costCategoryKeyValuesToolDescription = fmt.Sprintf(`Sends cost category key/value data to UI for user interaction.

Event Types and Behavior:
- 'present_checkbox': Displays checkboxes for user selection. Agent WAITS for user response before continuing.
- 'drop_down_list': Displays semantically grouped dropdown menus. Agent continues without waiting.

JSON Schema for 'present_checkbox':
%s

JSON Schema for 'drop_down_list':
%s`, checkboxSchemaExample, dropdownSchemaExample)
)

// validateCheckboxData validates data for present_checkbox event
func validateCheckboxData(data []any) ([]CheckboxItem, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("data array cannot be empty")
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	var items []CheckboxItem
	if err := json.Unmarshal(jsonBytes, &items); err != nil {
		return nil, fmt.Errorf("invalid checkbox data format: %w. Expected: %s", err, checkboxSchemaExample)
	}

	// Validate required fields
	for i, item := range items {
		if item.Key == "" {
			return nil, fmt.Errorf("item[%d]: 'key' field is required and cannot be empty", i)
		}
	}

	return items, nil
}

// validateDropdownData validates data for drop_down_list event
func validateDropdownData(data []any) ([]DropdownGroup, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("data array cannot be empty")
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}

	var groups []DropdownGroup
	if err := json.Unmarshal(jsonBytes, &groups); err != nil {
		return nil, fmt.Errorf("invalid dropdown data format: %w. Expected: %s", err, dropdownSchemaExample)
	}

	// Validate required fields
	for i, group := range groups {
		if group.CostCategoryName == "" {
			return nil, fmt.Errorf("item[%d]: 'cost_category_name' field is required and cannot be empty", i)
		}
		if len(group.ValueList) == 0 {
			return nil, fmt.Errorf("item[%d]: 'value_list' must contain at least one value", i)
		}
		for j, val := range group.ValueList {
			if val.Value == "" {
				return nil, fmt.Errorf("item[%d].value_list[%d]: 'value' field is required and cannot be empty", i, j)
			}
		}
	}

	return groups, nil
}

// validateCostCategoryKeyValuesData validates data based on event name
func validateCostCategoryKeyValuesData(eventName string, data []any) error {
	switch eventName {
	case CCMEventNamePresentCheckbox:
		_, err := validateCheckboxData(data)
		return err
	case CCMEventNameDropDownList:
		_, err := validateDropdownData(data)
		return err
	default:
		return fmt.Errorf("unknown event name: %s", eventName)
	}
}

// GetCcmOverview creates a tool for getting a ccm overview from an account
func GetCcmOverviewTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	now := time.Now()
	defaultStartTime := utils.FormatUnixToMMDDYYYY(now.AddDate(0, 0, -60).Unix())
	defaultEndTime := utils.CurrentMMDDYYYY()
	return mcp.NewTool("get_ccm_overview",
			mcp.WithDescription("Get an overview for an specific account in Harness Cloud Cost Management"),
			mcp.WithString("startTime",
				mcp.Required(),
				mcp.DefaultString(defaultStartTime),
				mcp.Description("Start time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)"),
			),
			mcp.WithString("endTime",
				mcp.Required(),
				mcp.DefaultString(defaultEndTime),
				mcp.Description("End time of the period in format MM/DD/YYYY. (e.g. 10/30/2025)"),
			),
			mcp.WithString("groupBy",
				mcp.Required(),
				mcp.Description("Type to group by period"),
				mcp.DefaultString(dto.PeriodTypeHour),
				mcp.Enum(dto.PeriodTypeHour, dto.PeriodTypeDay, dto.PeriodTypeMonth, dto.PeriodTypeWeek, dto.PeriodTypeQuarter, dto.PeriodTypeYear),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			startTimeStr, err := RequiredParam[string](request, "startTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			endTimeStr, err := RequiredParam[string](request, "endTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTime, err := utils.FormatMMDDYYYYToUnixMillis(startTimeStr)
			endTime, err := utils.FormatMMDDYYYYToUnixMillis(endTimeStr)
			groupBy, err := RequiredParam[string](request, "groupBy")

			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetOverview(ctx, accountId, startTime, endTime, groupBy)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Overview: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Overview: %w", err)
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListCcmCostCategoriesTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_cost_categories",
			mcp.WithDescription("List the cost categories for an account in Harness Cloud Cost Management"),
			mcp.WithString("cost_category",
				mcp.Description("Optional to search for specific category"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter cost categories"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMListCostCategoriesOptions{}
			params.AccountIdentifier = accountId

			// Handle cost category parameter
			costCategory, ok, err := OptionalParamOK[string](request, "cost_category")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && costCategory != "" {
				params.CostCategory = costCategory
			}

			// Handle search parameter
			searchTerm, ok, err := OptionalParamOK[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && searchTerm != "" {
				params.SearchTerm = searchTerm
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListCostCategories(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Cost Categories: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Cost Category: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func ListCcmCostCategoriesDetailTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_cost_categories_detail",
			mcp.WithDescription("List the cost categories with advanced options in Harness Cloud Cost Management"),
			mcp.WithString("search_key",
				mcp.Description("Optional search key to filter cost categories"),
			),
			mcp.WithString("sort_type",
				mcp.Description("Sort type for the results (e.g., NAME, LAST_EDIT)"),
				mcp.Enum(dto.SortTypeName, dto.SortTypeLastEdit),
			),
			mcp.WithString("sort_order",
				mcp.Description("Sort order for the results (e.g., ASCENDING, DESCENDING)"),
				mcp.Enum(dto.SortOrderAsc, dto.SortOrderDesc),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of items per page"),
			),
			mcp.WithNumber("offset",
				mcp.DefaultNumber(1),
				mcp.Description("Offset or page number for pagination"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMListCostCategoriesDetailOptions{}
			params.AccountIdentifier = accountId

			// Handle search key parameter
			searchKey, ok, err := OptionalParamOK[string](request, "search_key")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && searchKey != "" {
				params.SearchKey = searchKey
			}

			// Handle sort type parameter
			sortType, ok, err := OptionalParamOK[string](request, "sort_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortType != "" {
				params.SortType = sortType
			}

			// Handle sort order parameter
			sortOrder, ok, err := OptionalParamOK[string](request, "sort_order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortOrder != "" {
				params.SortOrder = sortOrder
			}

			// Handle limit parameter
			limit, ok, err := OptionalParamOK[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.Limit = utils.SafeFloatToInt32(limit, 5)
			}

			// Handle offset parameter
			offset, ok, err := OptionalParamOK[float64](request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.Offset = utils.SafeFloatToInt32(offset, 1)
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.ListCostCategoriesDetail(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Cost Categories: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Cost Category: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func GetCcmCostCategoryTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_cost_category",
			mcp.WithDescription("Retrieve the details of a cost category by its ID from a specific account in Harness Cloud Cost Management."),
			mcp.WithString("id",
				mcp.Description("Required Cost Category ID to retrieve a specific cost category"),
				mcp.Required(),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMGetCostCategoryOptions{}
			params.AccountIdentifier = accountId
			// Handle cost category parameter
			costCategoryId, ok, err := OptionalParamOK[string](request, "id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && costCategoryId != "" {
				params.CostCategoryId = costCategoryId
			}
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCostCategory(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Cost Categories: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Cost Category: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func getAccountID(ctx context.Context, config *config.McpServerConfig, request mcp.CallToolRequest) (string, error) {
	scope, _ := common.FetchScope(ctx, config, request, true)
	// Error ignored because it can be related to project or org id
	// which are not required for CCM
	if scope.AccountID != "" {
		return scope.AccountID, nil
	}
	return "", fmt.Errorf("Account ID is required")
}

func FetchCommitmentCoverageTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_commitment_coverage",
			mcp.WithDescription("Get commitment coverage information for an account in Harness Cloud Cost Management"),
			mcp.WithString("start_date",
				mcp.Required(),
				mcp.Description("Start date to filter commitment coverage"),
			),
			mcp.WithString("end_date",
				mcp.Required(),
				mcp.Description("End date to filter commitment coverage"),
			),
			mcp.WithString("service",
				mcp.Description("Optional service to filter commitment coverage"),
			),
			mcp.WithArray("cloud_account_ids",
				mcp.WithStringItems(),
				mcp.Description("Optional cloud account IDs to filter commitment coverage"),
			),
			mcp.WithString("group_by",
				mcp.Required(),
				mcp.Description("Specify how to group commitment coverage data - options include 'Commitment Type' (default), 'Instance Family', or 'Regions'"),
				mcp.Enum(dto.CommitmentType, dto.CommitmentInstanceFamily, dto.CommitmentRegion),
				mcp.DefaultString(dto.CommitmentType),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMCommitmentOptions{}
			params.AccountIdentifier = &accountId

			// Handle service parameter
			service, ok, err := OptionalParamOK[string](request, "service")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && service != "" {
				params.Service = &service
			}
			cloudAccountIDs, err := OptionalStringArrayParam(request, "cloud_account_ids")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if len(cloudAccountIDs) > 0 {
				params.CloudAccountIDs = cloudAccountIDs
			}

			// Handle start date parameter
			startDate, ok, err := OptionalParamOK[string](request, "start_date")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && startDate != "" {
				params.StartDate = &startDate
			}

			// Handle end date parameter
			endDate, ok, err := OptionalParamOK[string](request, "end_date")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && endDate != "" {
				params.EndDate = &endDate
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Handle group by
			groupBy, ok, err := OptionalParamOK[string](request, "group_by")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && groupBy != "" {
				params.GroupBy = &groupBy
			}

			data, err := client.GetComputeCoverage(ctx, scope, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment coverage: %s", err)), nil
			}

			if len(groupBy) > 0 && groupBy != dto.CommitmentType {
				return processCommitmentCoverageGrouped(data, groupBy)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment coverage: %s", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func FetchCommitmentSavingsTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_commitment_savings",
			mcp.WithDescription("Get current commitment savings generated for an account in Harness Cloud Cost Management"),
			mcp.WithString("start_date",
				mcp.Required(),
				mcp.Description("Start date to filter commitment savings"),
			),
			mcp.WithString("end_date",
				mcp.Required(),
				mcp.Description("End date to filter commitment savings"),
			),
			mcp.WithBoolean("is_harness_managed",
				mcp.Description("Filter results to show only Harness-managed commitments when set to true. When false or omitted, shows all commitments including both Harness-managed and non-Harness-managed ones."),
			),
			mcp.WithString("service",
				mcp.Description("Optional service to filter commitment savings"),
			),
			mcp.WithArray("cloud_account_ids",
				mcp.WithStringItems(),
				mcp.Description("Optional cloud account IDs to filter commitment coverage"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMCommitmentOptions{}
			params.AccountIdentifier = &accountId

			// Handle service parameter
			service, ok, err := OptionalParamOK[string](request, "service")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && service != "" {
				params.Service = &service
			}

			// Handle cloud account IDs parameter
			cloudAccountIDs, err := OptionalStringArrayParam(request, "cloud_account_ids")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if len(cloudAccountIDs) > 0 {
				params.CloudAccountIDs = cloudAccountIDs
			}

			// Handle start date parameter
			startDate, ok, err := OptionalParamOK[string](request, "start_date")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && startDate != "" {
				params.StartDate = &startDate
			}

			// Handle end date parameter
			endDate, ok, err := OptionalParamOK[string](request, "end_date")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && endDate != "" {
				params.EndDate = &endDate
			}
			// Handle is_harness_managed parameter
			isHarnessManaged, ok, err := OptionalParamOK[bool](request, "is_harness_managed")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.IsHarnessManaged = &isHarnessManaged
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCommitmentSavings(ctx, scope, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment savings: %s", err)), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment savings: %s", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func FetchCommitmentUtilisationTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_commitment_utilisation",
			mcp.WithDescription("Get commitment utilisation information for an account in Harness Cloud Cost Management broken down by Reserved Instances and Savings Plans in day wise granularity"),
			mcp.WithString("start_date",
				mcp.Description("Start date to filter commitment utilisation (optional, defaults to 30 days ago)"),
			),
			mcp.WithString("end_date",
				mcp.Description("End date to filter commitment utilisation (optional, defaults to current date)"),
			),
			mcp.WithString("service",
				mcp.Description("Optional service to filter commitment utilisation"),
			),
			mcp.WithArray("cloud_account_ids",
				mcp.WithStringItems(),
				mcp.Description("Optional cloud account IDs to filter commitment utilisation"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(ctx, config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMCommitmentOptions{}
			params.AccountIdentifier = &accountId

			// Handle service parameter
			service, ok, err := OptionalParamOK[string](request, "service")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && service != "" {
				params.Service = &service
			}

			// Handle cloud account IDs parameter
			cloudAccountIDs, err := OptionalStringArrayParam(request, "cloud_account_ids")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if len(cloudAccountIDs) > 0 {
				params.CloudAccountIDs = cloudAccountIDs
			}

			// Handle start date parameter
			startDate, ok, err := OptionalParamOK[string](request, "start_date")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && startDate != "" {
				params.StartDate = &startDate
			}

			// Handle end date parameter
			endDate, ok, err := OptionalParamOK[string](request, "end_date")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && endDate != "" {
				params.EndDate = &endDate
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCommitmentUtilisation(ctx, scope, params)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get commitment utilisation: %s", err)), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment utilisation: %s", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// getCoverageStatus determines the status based on coverage percentage
func getCoverageStatus(coveragePercentage *float64) string {
	if coveragePercentage == nil {
		return ""
	}

	coverage := *coveragePercentage
	if coverage > 95 {
		return dto.CommitmentCoverageStatusWellOptimized
	} else if coverage > 85 {
		return dto.CommitmentCoverageStatusGood
	} else if coverage > 80 {
		return dto.CommitmentCoverageStatusAdequate
	}
	return "Low Coverage" // Default status for anything below 80%
}

func processCommitmentCoverageGrouped(data *dto.CCMCommitmentBaseResponse, groupBy string) (*mcp.CallToolResult, error) {
	response := make(map[string]*dto.ComputeCoveragesDetail)

	jsonBytes, err := json.Marshal(data.Response)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to marshal commitment savings: %s", err)), nil
	}

	if err := json.Unmarshal(jsonBytes, &response); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to unmarshal commitment savings: %s", err)), nil
	}

	// Sort by CoveragePercentage
	type keyValuePair struct {
		Key   string
		Value *dto.ComputeCoveragesDetailTable
	}

	// Convert map to slice for sorting
	var sortedPairs []keyValuePair
	for k, v := range response {
		if v != nil && v.Table != nil {
			sortedPairs = append(sortedPairs, keyValuePair{k, v.Table})
		}
	}

	// Sort the slice based on CoveragePercentage
	sort.Slice(sortedPairs, func(i, j int) bool {
		// Handle nil cases
		if sortedPairs[i].Value == nil || sortedPairs[i].Value.CoveragePercentage == nil {
			return false
		}
		if sortedPairs[j].Value == nil || sortedPairs[j].Value.CoveragePercentage == nil {
			return true
		}

		// Sort by CoveragePercentage in descending order
		return *sortedPairs[i].Value.CoveragePercentage > *sortedPairs[j].Value.CoveragePercentage
	})

	var groupedResponse []*dto.CommitmentCoverageRow

	for _, pair := range sortedPairs {
		// Get coverage status based on percentage
		coverageStatus := getCoverageStatus(pair.Value.CoveragePercentage)

		groupedResponse = append(groupedResponse, &dto.CommitmentCoverageRow{
			Key:                &pair.Key,
			CoveragePercentage: pair.Value.CoveragePercentage,
			Cost:               pair.Value.TotalCost,
			CoverageStatus:     &coverageStatus,
			OndemandCost:       pair.Value.OnDemandCost,
			Grouping:           groupBy,
		})
	}

	responseContents := []mcp.Content{}

	commitmentCoverageEvent := event.NewCustomEvent(CCMCommitmentCoverageEventType, groupedResponse, event.WithContinue(false))

	// Create embedded resources for the event
	eventResource, err := commitmentCoverageEvent.CreateEmbeddedResource()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	} else {
		responseContents = append(responseContents, eventResource)
	}

	promptResource, err := processCoverageFollowUpPrompts(groupBy)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}

	responseContents = append(responseContents, promptResource)

	return &mcp.CallToolResult{
		Content: responseContents,
	}, nil
}

func processCoverageFollowUpPrompts(groupBy string) (mcp.Content, error) {
	var promptEvent event.CustomEvent

	if len(groupBy) > 0 && groupBy == dto.CommitmentRegion {
		promptEvent = types.NewActionEvent([]string{FollowUpGroupCommitmentCoverageBySavingsPrompt}, event.WithContinue(false))
	} else {
		promptEvent = types.NewActionEvent([]string{FollowUpGroupCommitmentCoverageByRegionsPrompt}, event.WithContinue(false))
	}

	// Convert to an embedded resource
	promptResource, err := promptEvent.CreateEmbeddedResource()
	if err != nil {
		return nil, err
	}

	return promptResource, nil
}

// extractGroupingFields extracts and validates title, keys, values from a grouping map.
func extractGroupingFields(groupingMap map[string]interface{}) (title string, keys []string, values []string, err error) {
	titleVal, ok := groupingMap["title"].(string)
	if !ok {
		return "", nil, nil, fmt.Errorf("Error extracting title from cost target grouping")
	}
	keysInterface, ok := groupingMap["keys"].([]interface{})
	if !ok {
		return "", nil, nil, fmt.Errorf("Error extracting keys from cost target grouping")
	}
	keys = make([]string, len(keysInterface))
	for i, k := range keysInterface {
		keyStr, ok := k.(string)
		if !ok {
			return "", nil, nil, fmt.Errorf("Error: keys must be an array of strings")
		}
		keys[i] = keyStr
	}
	valuesInterface, ok := groupingMap["values"].([]interface{})
	if !ok {
		return "", nil, nil, fmt.Errorf("Error extracting values from cost target grouping")
	}
	values = make([]string, len(valuesInterface))
	for i, v := range valuesInterface {
		valueStr, ok := v.(string)
		if !ok {
			return "", nil, nil, fmt.Errorf("Error: values must be an array of strings")
		}
		values[i] = valueStr
	}
	return titleVal, keys, values, nil
}

// buildViewConditionRules creates one CCMRule per key using the LABEL_V2 / "IN" operator pattern.
func buildViewConditionRules(keys []string, values []string) []dto.CCMRule {
	var rules []dto.CCMRule
	for _, key := range keys {
		rules = append(rules, dto.CCMRule{
			ViewConditions: []interface{}{
				map[string]interface{}{
					"viewField": map[string]interface{}{
						"fieldId":        "labels.value",
						"fieldName":      key,
						"identifier":     "LABEL_V2",
						"identifierName": "Label V2",
					},
					"viewOperator": "IN",
					"values":       values,
				},
			},
		})
	}
	return rules
}

func CreateCostCategoriesCostTargetsEventTool(config *config.McpServerConfig, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ccm_create_cost_categories_cost_targets_event",
			mcp.WithDescription("Create a cost category by defining cost target groupings based on cloud labels. Cost categories let you group cloud costs into buckets (e.g., by environment or team). Returns a UI event for user confirmation."),
			mcp.WithString("cost_category_name",
				mcp.Required(),
				mcp.Description("Name for the Cost Category"),
			),
			mcp.WithArray(
				"cost_target_groupings",
				mcp.Required(),
				mcp.Description("Array of cost buckets for the cost category"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"title": map[string]any{
							"type":        "string",
							"description": "Display title for the cost bucket (e.g., 'Production Environments')",
						},
						"keys": map[string]any{
							"type":        "array",
							"description": "List of unique identifier key for this cost bucket (e.g., 'env', 'Environment')",
							"items": map[string]any{
								"type": "string",
							},
						},
						"values": map[string]any{
							"type":        "array",
							"description": "List of values that belong to this cost bucket (e.g., 'prod', 'dev', 'qa')",
							"items": map[string]any{
								"type": "string",
							},
						},
					},
					"required": []string{"title", "keys", "values"},
				}),
			),
			mcp.WithArray(
				"shared_cost_groupings",
				mcp.Description("Optional array of shared cost buckets for the cost category"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"title": map[string]any{
							"type":        "string",
							"description": "Display title for the shared cost bucket (e.g., 'Shared Costs')",
						},
						"keys": map[string]any{
							"type":        "array",
							"description": "List of label keys for this shared cost bucket",
							"items": map[string]any{
								"type": "string",
							},
						},
						"values": map[string]any{
							"type":        "array",
							"description": "List of values that belong to this shared cost bucket (e.g., 'prod', 'dev', 'qa')",
							"items": map[string]any{
								"type": "string",
							},
						},
						"strategy": map[string]any{
							"type":        "string",
							"description": "Sharing strategy for this shared cost bucket",
							"enum":        []string{"EQUAL", "PROPORTIONAL", "FIXED"},
						},
						"splits": map[string]any{
							"type":        "array",
							"description": "Required when strategy is FIXED. Array of split allocations across cost targets.",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"cost_target_name": map[string]any{
										"type":        "string",
										"description": "Name of the cost target bucket to allocate to",
									},
									"percentage_contribution": map[string]any{
										"type":        "number",
										"description": "Percentage of shared cost to allocate (0-100)",
									},
								},
								"required": []string{"cost_target_name", "percentage_contribution"},
							},
						},
					},
					"required": []string{"title", "keys", "values", "strategy"},
				}),
			),
			mcp.WithObject("unallocated_cost",
				mcp.Description("Optional unallocated cost configuration"),
				mcp.Properties(map[string]any{
					"strategy": map[string]any{
						"type":        "string",
						"description": "How to handle unallocated costs",
						"enum":        []string{"HIDE", "DISPLAY_NAME"},
					},
					"label": map[string]any{
						"type":        "string",
						"description": "Display label when strategy is DISPLAY_NAME (defaults to 'Unattributed')",
					},
				}),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			costTargetGroupingsInput, ok := request.GetArguments()["cost_target_groupings"]
			if !ok || costTargetGroupingsInput == nil {
				return mcp.NewToolResultError("Error extracting cost target groupings from request. Check JSON format"), nil
			}

			slog.Debug("Received cost_target_groupings",
				"type", fmt.Sprintf("%T", costTargetGroupingsInput),
				"value", costTargetGroupingsInput)

			var costTargets []dto.CCMCostTarget

			costTargetGroupings, ok := costTargetGroupingsInput.([]interface{})
			if !ok {
				return mcp.NewToolResultError(fmt.Sprintf("Error: cost_target_groupings must be an array. Got type %T with value: %v", costTargetGroupingsInput, costTargetGroupingsInput)), nil
			}

			slog.Debug("Successfully extracted cost_target_groupings array", "length", len(costTargetGroupings))

			for _, costTargetGrouping := range costTargetGroupings {
				if costTargetGroupingMap, ok := costTargetGrouping.(map[string]interface{}); ok {
					title, keys, values, err := extractGroupingFields(costTargetGroupingMap)
					if err != nil {
						return mcp.NewToolResultError(err.Error()), nil
					}
					rules := buildViewConditionRules(keys, values)
					costTargets = append(costTargets, dto.CCMCostTarget{
						Name:  title,
						Rules: rules,
					})
				}
			}

			// Build the wrapper payload
			payload := dto.CCMCostCategoryEventPayload{
				CostTargets: costTargets,
			}

			// Extract required cost_category_name
			costCategoryName, err := RequiredParam[string](request, "cost_category_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			payload.Name = costCategoryName

			// Extract optional shared_cost_groupings
			sharedCostGroupingsInput, sharedOk := request.GetArguments()["shared_cost_groupings"]
			if sharedOk && sharedCostGroupingsInput != nil {
				sharedCostGroupings, ok := sharedCostGroupingsInput.([]interface{})
				if !ok {
					return mcp.NewToolResultError(fmt.Sprintf("Error: shared_cost_groupings must be an array. Got type %T", sharedCostGroupingsInput)), nil
				}
				var sharedCosts []dto.CCMSharedCost
				for _, scg := range sharedCostGroupings {
					scgMap, ok := scg.(map[string]interface{})
					if !ok {
						return mcp.NewToolResultError("Error: each shared_cost_grouping must be an object"), nil
					}
					title, keys, values, err := extractGroupingFields(scgMap)
					if err != nil {
						return mcp.NewToolResultError(err.Error()), nil
					}
					strategy, ok := scgMap["strategy"].(string)
					if !ok || strategy == "" {
						return mcp.NewToolResultError("Error: strategy is required for each shared cost grouping"), nil
					}
					rules := buildViewConditionRules(keys, values)
					sc := dto.CCMSharedCost{
						Name:     title,
						Rules:    rules,
						Strategy: strategy,
					}
					// Extract splits if strategy is FIXED
					if strategy == "FIXED" {
						if splitsInput, splitsOk := scgMap["splits"]; splitsOk && splitsInput != nil {
							splitsArray, ok := splitsInput.([]interface{})
							if !ok {
								return mcp.NewToolResultError("Error: splits must be an array"), nil
							}
							var splits []dto.CCMSplit
							for _, s := range splitsArray {
								splitMap, ok := s.(map[string]interface{})
								if !ok {
									return mcp.NewToolResultError("Error: each split must be an object"), nil
								}
								costTargetName, ok := splitMap["cost_target_name"].(string)
								if !ok {
									return mcp.NewToolResultError("Error: cost_target_name is required in each split"), nil
								}
								pctContrib, ok := splitMap["percentage_contribution"].(float64)
								if !ok {
									return mcp.NewToolResultError("Error: percentage_contribution is required in each split"), nil
								}
								splits = append(splits, dto.CCMSplit{
									CostTargetName:         &costTargetName,
									PercentageContribution: &pctContrib,
								})
							}
							sc.Splits = splits
						}
					}
					sharedCosts = append(sharedCosts, sc)
				}
				payload.SharedCosts = sharedCosts
			}

			// Extract optional unallocated_cost
			unallocatedCostInput, unallocatedOk := request.GetArguments()["unallocated_cost"]
			if unallocatedOk && unallocatedCostInput != nil {
				ucMap, ok := unallocatedCostInput.(map[string]interface{})
				if !ok {
					return mcp.NewToolResultError(fmt.Sprintf("Error: unallocated_cost must be an object. Got type %T", unallocatedCostInput)), nil
				}
				strategy, ok := ucMap["strategy"].(string)
				if !ok || strategy == "" {
					return mcp.NewToolResultError("Error: strategy is required for unallocated_cost"), nil
				}
				uc := dto.CCMUnallocatedCost{
					Strategy: strategy,
				}
				if strategy == "DISPLAY_NAME" {
					label, ok := ucMap["label"].(string)
					if !ok || label == "" {
						label = "Unattributed"
					}
					uc.Label = label
				}
				payload.UnallocatedCost = &uc
			}

			costCategoryCostTargetsEvent := event.NewCustomEvent(CCMCostCategoryCostTargetsEventType, payload, event.WithContinue(true))
			responseContents := []mcp.Content{}
			// Create embedded resources for the event
			eventResource, err := costCategoryCostTargetsEvent.CreateEmbeddedResource()
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			} else {
				responseContents = append(responseContents, eventResource)
			}
			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}
}

func ReportCostCategoryKeyValuesEventTool(config *config.McpServerConfig) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(CCMReportCostCategoryKeyValuesToolID,
			mcp.WithDescription(costCategoryKeyValuesToolDescription),
			mcp.WithString("ccm_event_name",
				mcp.Required(),
				mcp.Description("Event type determining UI presentation and response behavior. "+
					"'present_checkbox' waits for user selection, 'drop_down_list' displays data and continues."),
				mcp.Enum(CCMEventNamePresentCheckbox, CCMEventNameDropDownList),
			),
			mcp.WithArray("data",
				mcp.Required(),
				mcp.Description("Event payload array - MUST match the JSON schema for the specified ccm_event_name. "+
					"See tool description for exact schema format."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			eventName, err := RequiredParamOK[string](request, "ccm_event_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get data from the array parameter
			data, err := OptionalAnyArrayParam(request, "data")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Validate data against the schema for the specified event name
			if err := validateCostCategoryKeyValuesData(eventName, data); err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("schema validation failed: %s", err.Error())), nil
			}

			// Determine continue flag based on event name
			// present_checkbox: wait for user response (continue = false)
			// drop_down_list: display and continue (continue = true)
			shouldContinue := eventName == CCMEventNameDropDownList

			// Create event with appropriate continue behavior
			ccmEvent := event.NewCustomEvent(CCMCostCategoryKeyValuesEventName, map[string]any{
				"ccm_event_name": eventName,
				"data":           data,
			}, event.WithContinue(shouldContinue), event.WithDisplayOrder(100))

			eventResource, err := ccmEvent.CreateEmbeddedResource()
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			return &mcp.CallToolResult{
				Content: []mcp.Content{eventResource},
			}, nil
		}
}
