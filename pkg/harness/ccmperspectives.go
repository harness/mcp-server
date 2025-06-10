package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"strconv"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/harness/harness-mcp/pkg/utils"
)

func ListCcmPerspectivesDetailTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_perspectives_detail",
			mcp.WithDescription("List the cost perspectives with advanced options in Harness Cloud Cost Management"),
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("search_key",
				mcp.Description("Optional search key to filter perspectives"),
			),
			mcp.WithString("sort_type",
				mcp.Description("Sort type for the results (e.g., NAME, LAST_EDIT)"),
				mcp.DefaultString(dto.SortByTime),
				mcp.Enum(dto.SortByTime, dto.SortByCost, dto.SortByClusterCost, dto.SortByName),
			),
			mcp.WithString("sort_order",
				mcp.Description("Sort order for the results (e.g., ASCENDING, DESCENDING)"),
				mcp.DefaultString(dto.SortOrderDescending),
				mcp.Enum(dto.SortOrderAscending, dto.SortOrderDescending),
			),
			mcp.WithString("cloud_filter",
				mcp.Description("Filters for cloud and clusters (e.g., AWS, GCP, AZURE)"),
				mcp.Enum(dto.FilterByAws, dto.FilterByAzure, dto.FilterByGcp, dto.FilterByCluster, dto.FilterByDefault),
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

			params := &dto.CCMListPerspectivesDetailOptions{}
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

			data, err := client.ListPerspectivesDetail(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspectives: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspectives: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
	}

func GetCcmPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_perspective",
			mcp.WithDescription("Get a perspective with advanced options in Harness Cloud Cost Management"),
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := OptionalParam[string](request, "account_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			perspectiveId, err := OptionalParam[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMGetPerspectiveOptions{}
			params.AccountIdentifier = accountId
			params.PerspectiveId = perspectiveId

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetPerspective(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspective: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspective: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
	}

func GetLastPeriodCostCcmPerspectiveTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	now := time.Now()
	defaultStartTime := now.AddDate(0, 0, -60).UnixMilli()
	return mcp.NewTool("get_last_period_cost_ccm_perspective",
			mcp.WithDescription("Get the last period cost for a perspective in Harness Cloud Cost Management"),
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
			),
			mcp.WithString("start_time",
				mcp.DefaultString(fmt.Sprintf("%d", defaultStartTime)),
				mcp.Description("Start time of the period in Unix epoch **milliseconds** (e.g. 1743465600000 for April 1, 2025)"),
			),
			mcp.WithString("period",
				mcp.Description("Required period to get the cost for"),
				mcp.DefaultString(dto.PeriodMonthly),
				mcp.Enum(dto.PeriodDaily, dto.PeriodWeekly, dto.PeriodMonthly, dto.PeriodQuarterly, dto.PeriodYearly),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := OptionalParam[string](request, "account_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			perspectiveId, err := OptionalParam[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTimeStr, err := OptionalParam[string](request, "start_time")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			startTime, err := strconv.ParseInt(startTimeStr, 10, 64) 
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			period, err := OptionalParam[string](request, "period")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMGetLastPeriodCostPerspectiveOptions{}
			params.AccountIdentifier = accountId
			params.PerspectiveId = perspectiveId
			params.StartTime = startTime
			params.Period = period

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetLastCostPerspective(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Perspective: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Perspective: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
	}
