package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/event"
	"github.com/harness/harness-mcp/pkg/harness/event/types"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetCcmOverview creates a tool for getting a ccm overview from an account
func GetCcmOverviewTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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

func ListCcmCostCategoriesTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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

			scope, err := common.FetchScope(config, request, false)
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

func ListCcmCostCategoriesDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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

			scope, err := common.FetchScope(config, request, false)
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

func GetCcmCostCategoryTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_cost_category",
			mcp.WithDescription("Retrieve the details of a cost category by its ID from a specific account in Harness Cloud Cost Management."),
			mcp.WithString("id",
				mcp.Description("Required Cost Category ID to retrieve a specific cost category"),
				mcp.Required(),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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
			scope, err := common.FetchScope(config, request, false)
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

func getAccountID(config *config.Config, request mcp.CallToolRequest) (string, error) {
	scope, _ := common.FetchScope(config, request, true)
	// Error ignored because it can be related to project or org id
	// which are not required for CCM
	if scope.AccountID != "" {
		return scope.AccountID, nil
	}
	return "", fmt.Errorf("Account ID is required")
}

func FetchCommitmentCoverageTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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

			scope, err := common.FetchScope(config, request, false)
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

func FetchCommitmentSavingsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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

			scope, err := common.FetchScope(config, request, false)
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

func FetchCommitmentUtilisationTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Add account ID to context for this request
			if accountId == "" {
				return mcp.NewToolResultError("account_id is required"), nil
			}
			ctx = context.WithValue(ctx, "accountID", accountId)

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

			scope, err := common.FetchScope(config, request, false)
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
