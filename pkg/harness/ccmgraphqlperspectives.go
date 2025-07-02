package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	//"github.com/harness/harness-mcp/pkg/utils"
)


func CcmPerspectiveGridTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("ccm_perspective_grid", "Query perspective grid data in Harness Cloud Cost Management",
		filterMcpOptionsJSONSchema(),
		),
	func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

		// Account Id for querystring.
		accountId, err := getAccountID(config, request)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// viewId, err := OptionalParam[string](request, "view_id")
		// if err != nil {
		// 	return mcp.NewToolResultError(err.Error()), nil
		// }


		timeFilter, err := OptionalParam[string](request, "time_filter")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		groupBy, err := OptionalParam[string](request, "group_by")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}


		scope, err := fetchScope(config, request, false)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		filters := make(map[string][]string)
		
		for _, field := range filterFields {
			name := field["name"]
			val, err := OptionalStringArrayParam(request, name)
			slog.Debug("PGridTool", "Field ID filter", name)
			slog.Debug("PGridTool", "Field ID value", val)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if val != nil && len(val) > 0 {
				filters[name] = val
			}
		}
		
		params := new(dto.CCMPerspectiveGridOptions)
		params.AccountId = accountId
		//params.ViewId = viewId
		params.TimeFilter = timeFilter
		params.Filters = filters
		params.GroupBy = groupBy
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

var filterFields = []map[string]string{
	{
		"name":        "aws_account",
		"description": "Filter results by AWS account identifier.",
	},
	{
		"name":        "aws_billing_entity",
		"description": "Filter results by AWS billing entity.",
	},
	{
		"name":        "aws_instance_type",
		"description": "Filter results by AWS instance type.",
	},
	{
		"name":        "aws_line_item_type",
		"description": "Filter results by AWS line item type.",
	},
	{
		"name":        "aws_payer_account",
		"description": "Filter results by AWS payer account.",
	},
	{
		"name":        "aws_service",
		"description": "Filter results by AWS service.",
	},
	{
		"name":        "aws_usage_type",
		"description": "Filter results by AWS usage type.",
	},
	{
		"name":        "region",
		"description": "Filter results by region.",
	},
	{
		"name":        "cloud_provider",
		"description": "Filter results by cloud provider.",
	},
	{
		"name":        "product",
		"description": "Filter results by product.",
	},
}

func filterMcpOptionsJSONSchema() json.RawMessage {
	properties := map[string]any{
		// "view_id": map[string]any{
		// 	"type":        "string",
		// 	"description": "The perspective (view) identifier",
		// },
		"time_filter": map[string]any{
			"type":        "string",
			"description": "Time filter for the query",
			"enum": []string{
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
			},
		},
		"group_by": map[string]any{
			"type":        "string",
			"description": "Group by field",
			"enum": []string{
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
			},
		},
	}
	for _, field := range filterFields {
		properties[field["name"]] = map[string]any{
			"type":        "array",
			"description": field["description"],
			"items":       map[string]any{"type": "string"},
		}
	}
	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	b, _ := json.Marshal(schema)
	return json.RawMessage(b)

}
