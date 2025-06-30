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
	//"github.com/harness/harness-mcp/pkg/utils"
)


func CcmPerspectiveGridTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ccm_perspective_grid",
		mcp.WithDescription("Query perspective grid data in Harness Cloud Cost Management"),
		mcp.WithString("view_id",
			mcp.Description("The perspective (view) identifier"),
		),
		mcp.WithString("time_filter",
			mcp.Enum(
				dto.TimeFilterLast7,
				dto.TimeFilterThisMonth,
				dto.TimeFilterLast30Days,
				dto.TimeFilterThisQuarter,
				dto.TimeFilterThisYear,
				dto.TimeFilterLastMonth,
				dto.TimeFilterLastQuarter,
				dto.TimeFilterLastYear,
				dto.TimeFilterLast3Months,
				dto.TimeFilterLast6Months,
				dto.TimeFilterLast12Months,
			),
			mcp.Description("Time filter for the query"),
		),
		mcp.WithBoolean("is_cluster_only",
			mcp.Description("Whether to include only cluster data"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("is_cluster_hourly_data",
			mcp.Description("Whether to use cluster hourly data"),
			mcp.DefaultBool(false),
		),
		mcp.WithNumber("limit",
			mcp.Description("Limit for pagination"),
			mcp.DefaultNumber(15),
		),
		mcp.WithNumber("offset",
			mcp.Description("Offset for pagination"),
			mcp.DefaultNumber(0),
		),
		mcp.WithString("group_by",
			mcp.Enum(
				dto.GridGroupByCostCategory,
				dto.GridGroupByAWSAccount,
				dto.GridGroupByAWSBillingEntity,
				dto.GridGroupByAWSInstanceType,
				dto.GridGroupByAWSLineItemType,
				dto.GridGroupByAWSPayerAccount,
				dto.GridGroupByAWSService,
				dto.GridGroupByAWSUsageType,
				dto.GridGroupByRegion,
				dto.GridGroupByProduct,
				dto.GridGroupByCloudProvider,
				dto.GridGroupByLabel,
				dto.GridGroupByLabelV2,
				dto.GridGroupByNone,
			),
			mcp.Description("Group by field"),
		),
		mcp.WithBoolean("include_others",
			mcp.Description("Show 'Others' in results"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("include_anomalies",
			mcp.Description("Show anomalies in results"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("include_unallocated_cost",
			mcp.Description("Show unallocated cost in results"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("aws_include_discounts",
			mcp.Description("Include AWS discounts"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("aws_include_credits",
			mcp.Description("Include AWS credits"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("aws_include_refunds",
			mcp.Description("Include AWS refunds"),
			mcp.DefaultBool(false),
		),
		mcp.WithBoolean("aws_include_taxes",
			mcp.Description("Include AWS taxes"),
			mcp.DefaultBool(false),
		),
		mcp.WithString("aws_cost",
		mcp.Enum(dto.AwsCostAmortised, dto.AwsCostNetAmortised, dto.AwsCostBlended, dto.AwsCostUnblended, dto.AwsCostEffective),
			mcp.Description("AWS cost calculation method"),
		),
		WithScope(config, false),
	),
	func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

		// Account Id for querystring.
		accountId, err := getAccountID(config, request)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		viewId, err := OptionalParam[string](request, "view_id")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

// 		timeFilter, err := OptionalParam[string](request, "time_filter")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		isClusterOnly, err := OptionalParam[bool](request, "is_cluster_only")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		isClusterHourlyData, err := OptionalParam[bool](request, "is_cluster_hourly_data")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		limit, err := OptionalParam[float64](request, "limit")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		offset, err := OptionalParam[float64](request, "offset")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		groupBy, err := OptionalParam[string](request, "group_by")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		includeOthers, err := OptionalParam[bool](request, "include_others")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		includeAnomalies, err := OptionalParam[bool](request, "include_anomalies")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		includeUnallocatedCost, err := OptionalParam[bool](request, "include_unallocated_cost")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		awsIncludeDiscounts, err := OptionalParam[bool](request, "aws_include_discounts")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		awsIncludeCredits, err := OptionalParam[bool](request, "aws_include_credits")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		awsIncludeRefunds, err := OptionalParam[bool](request, "aws_include_refunds")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		awsIncludeTaxes, err := OptionalParam[bool](request, "aws_include_taxes")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

// 		awsCost, err := OptionalParam[string](request, "aws_cost")
// 		if err != nil {
// 			return mcp.NewToolResultError(err.Error()), nil
// 		}

		scope, err := fetchScope(config, request, false)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

// 		params := &dto.CCMPerspectiveGridOptions{
// 			AccountId:             accountId,
// 			ViewId:                viewId,
// 			TimeFilter:            timeFilter,
// 			IsClusterOnly:         isClusterOnly,
// 			IsClusterHourlyData:   isClusterHourlyData,
// 			Limit:                 utils.SafeFloatToInt32(limit, 15),
// 			Offset:                utils.SafeFloatToInt32(offset, 0),
// 			GroupBy:               groupBy,
// 			IncludeOthers:         includeOthers,
// 			IncludeAnomalies:      includeAnomalies,
// 			IncludeUnallocatedCost: includeUnallocatedCost,
// 			AwsIncludeDiscounts:   awsIncludeDiscounts,
// 			AwsIncludeCredits:     awsIncludeCredits,
// 			AwsIncludeRefunds:     awsIncludeRefunds,
// 			AwsIncludeTaxes:       awsIncludeTaxes,
// 			AwsCost:               awsCost,
// 		}

		params := new(dto.CCMPerspectiveGridOptions)
		params.AccountId = accountId
		params.ViewId = viewId
		data, err := client.PerspectiveGrid(ctx, scope, params)
		if err != nil {
			return nil, fmt.Errorf("failed to get CCM Perspective Grid: %w", err)
		}

		r, err := json.Marshal(data)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal CCM Perspective Grid: %w", err)
		}

		return mcp.NewToolResultText(string(r)), nil
	}
}
