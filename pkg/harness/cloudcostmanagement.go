package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/harness/harness-mcp/pkg/utils"
	"strconv"
	"time"
)

// GetCcmOverview creates a tool for getting a ccm overview from an account
func GetCcmOverviewTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	now := time.Now()
	defaultStartTime := now.AddDate(0, 0, -60).UnixMilli()
	defaultEndTime := now.UnixMilli()
	return mcp.NewTool("get_ccm_overview",
			mcp.WithDescription("Get an overview for an specific account in Harness Cloud Cost Management"),
			mcp.WithString("accountIdentifier",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("startTime",
				mcp.DefaultString(fmt.Sprintf("%d", defaultStartTime)),
				mcp.Description("Start time of the period in Unix epoch **milliseconds** (e.g. 1743465600000 for April 1, 2025)"),
			),
			mcp.WithString("endTime",
				mcp.DefaultString(fmt.Sprintf("%d", defaultEndTime)),
				mcp.Description("End time of the period in Unix epoch **milliseconds** (e.g. 1743465600000 for April 1, 2025)"),
			),
			mcp.WithString("groupBy",
				mcp.Description("Optional type to group by period"),
				mcp.DefaultString(dto.PeriodTypeHour),
				mcp.Enum(dto.PeriodTypeHour, dto.PeriodTypeDay, dto.PeriodTypeMonth, dto.PeriodTypeWeek, dto.PeriodTypeQuarter, dto.PeriodTypeYear),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accID, err := OptionalParam[string](request, "accountIdentifier")
			if accID == "" {
				accID, err = getAccountID(config, request)
			}
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			startTimeStr, err := requiredParam[string](request, "startTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTime, err := strconv.ParseInt(startTimeStr, 10, 64)

			endTimeStr, err := requiredParam[string](request, "endTime")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			endTime, err := strconv.ParseInt(endTimeStr, 10, 64)
			groupBy, err := requiredParam[string](request, "groupBy")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetOverview(ctx, accID, startTime, endTime, groupBy)
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

<<<<<<< HEAD
func ListCcmCostCategoriesTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_cost_categories",
			mcp.WithDescription("List the cost categories for an account in Harness Cloud Cost Management"),
=======

func ListCcmCostCategoriesTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_cost_categories",
			mcp.WithDescription("List the cost categories from an account in Harness Cloud Cost Management"),
>>>>>>> 1554fc7 (Added List Cloud Cost Management tool)
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("cost_category",
				mcp.Description("Optional to search for specific category"),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional search term to filter cost categories"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := OptionalParam[string](request, "account_id")
			if accountId == "" {
				accountId, err = getAccountID(config, request)
			}
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CcmListCostCategoriesOptions{}
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

<<<<<<< HEAD
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
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("search_key",
				mcp.Description("Optional search key to filter cost categories"),
			),
			mcp.WithString("sort_type",
				mcp.Description("Sort type for the results (e.g., NAME, LAST_EDIT)"),
			),
			mcp.WithString("sort_order",
				mcp.Description("Sort order for the results (e.g., ASCENDING, DESCENDING)"),
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
			accountId, err := OptionalParam[string](request, "account_id")
			if accountId == "" {
				accountId, err = getAccountID(config, request)
			}
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
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("id",
				mcp.Description("Required Cost Category ID to retrieve a specific cost category"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := OptionalParam[string](request, "account_id")
			if accountId == "" {
				accountId, err = getAccountID(config, request)
			}
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
=======
			data, err := client.CloudCostManagement.ListCostCategories(ctx, scope, params)
>>>>>>> 1554fc7 (Added List Cloud Cost Management tool)
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
	scope, scopeErr := fetchScope(config, request, true)
	if scopeErr != nil {
		return "", nil
	}
	return scope.AccountID, nil
}
