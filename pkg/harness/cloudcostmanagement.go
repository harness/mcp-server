package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/pkg/utils"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"time"
)

// GetCcmOverview creates a tool for getting a ccm overview from an account
func GetCcmOverviewTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	now := time.Now()
	defaultStartTime := utils.FormatUnixToMMDDYYYY(now.AddDate(0, 0, -60).Unix()) 
	defaultEndTime:= utils.CurrentMMDDYYYY(); 
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			startTimeStr, err := requiredParam[string](request, "startTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			endTimeStr, err := requiredParam[string](request, "endTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTime, err :=  utils.FormatMMDDYYYYToUnixMillis(startTimeStr)
			endTime, err := utils.FormatMMDDYYYYToUnixMillis(endTimeStr)
			groupBy, err := requiredParam[string](request, "groupBy")

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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
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

			scope, err := fetchScope(config, request, false)
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
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

			scope, err := fetchScope(config, request, false)
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
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
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
			scope, err := fetchScope(config, request, false)
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

// getAccountID retrieves AccountID from the config file
func getAccountID(config *config.Config, request mcp.CallToolRequest) (string, error) {
	scope, _ := fetchScope(config, request, true)
	// Error ignored because it can be related to project or org id
	// which are not required for CCM
	if scope.AccountID != "" {
		return scope.AccountID, nil 
	}
	return "", fmt.Errorf("Account ID is required")
}
