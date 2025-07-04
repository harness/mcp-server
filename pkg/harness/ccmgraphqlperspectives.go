package harness

import (
	"context"
	"encoding/json"
	"fmt"
	// "log/slog"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)


var ccmPerspectiveGridDescription = `
Query detailed cost perspective grid data in Harness Cloud Cost Management.
This tool allows you to retrieve tabular cost data for a given perspective (view) with advanced filtering, grouping, and aggregation options.
You can filter by AWS account, service, region, product, and custom labels, as well as group results by fields such as product, region, or cost category.

For example, you can:
- Get the total AWS EC2 cost per region for the last 30 days.
- Retrieve cost trends for specific products or business mappings across multiple accounts.

Supports LIKE-style filtering for arrays and key-value filters for business mappings and labels.
`

func CcmPerspectiveGridTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("ccm_perspective_grid", ccmPerspectiveGridDescription,
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

		groupBy, err := OptionalParam[map[string]any](request, "group_by")
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
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if val != nil && len(val) > 0 {
				filters[name] = val
			}
		}

		keyValueFilters := make(map[string]map[string]any)
		for _, field := range keyValueFilterFields {
			name := field["name"]
			val, err := OptionalParam[map[string]any](request, name)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// slog.Debug("PGridTool", "KV Field ID filter", name)
			// slog.Debug("PGridTool", "KV Field ID value", val)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if val != nil && len(val) > 0 {
				keyValueFilters[name] = val
			}
		}
		
		params := new(dto.CCMPerspectiveGridOptions)
		params.AccountId = accountId
		//params.ViewId = viewId
		params.TimeFilter = timeFilter
		params.Filters = filters
		params.KeyValueFilters = keyValueFilters
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

var common_filter_desc = `It is applied using LIKE operator in an array. Example: ["value1", "value2", ...]`
var filterFields = []map[string]string{
	{
		"name":        "aws_account",
		"description": fmt.Sprintf("Filter results by AWS account identifier. %s", common_filter_desc),
	},
	{
		"name":        "aws_billing_entity",
		"description": fmt.Sprintf("Filter results by AWS billing entity. %s", common_filter_desc),

	},
	{
		"name":        "aws_instance_type",
		"description": fmt.Sprintf("Filter results by AWS instance type. %s", common_filter_desc),

	},
	{
		"name":        "aws_line_item_type",
		"description": fmt.Sprintf("Filter results by AWS line item type. %s", common_filter_desc),
	},
	{
		"name":        "aws_payer_account",
		"description": fmt.Sprintf("Filter results by AWS payer account. %s", common_filter_desc),
	},
	{
		"name":        "aws_service",
		"description": fmt.Sprintf("Filter results by AWS service. %s", common_filter_desc),
	},
	{
		"name":        "aws_usage_type",
		"description": fmt.Sprintf("Filter results by AWS usage type. %s", common_filter_desc),
	},
	{
		"name":        "region",
		"description": fmt.Sprintf("Filter results by region. %s", common_filter_desc),
	},
	{
		"name":        "cloud_provider",
		"description": fmt.Sprintf("Filter results by cloud provider. %s", common_filter_desc),
	},
	{
		"name":        "product",
		"description": fmt.Sprintf("Filter results by product. %s", common_filter_desc),
	},
}

var common_kv_filter_desc = `Values are provided in the format '{"filterL1": "value1", "filterL2": ["value2", "value3", ...]}', where 'filterL1' represents the selected `
var keyValueFilterFields = []map[string]string{
	{
		"name":        "bussines_mapping",
		"description": fmt.Sprintf("Filter results by Cost Category and Bucket. Values have to be retrieved from list of Cost Categories names. %s Cost Category and 'filterL2' corresponds to the Buckets within that category.", common_kv_filter_desc),
		"filterL2": "bucket",
		"l2Description": "Buckets corresponding to the Cost Category",
	},
	{
		"name":        "label",
		"description": fmt.Sprintf("Filter results by  Label and Sub Label. Values for this field corresponds to labels list .%s Label and 'filterL2' corresponds to the Sub Label within that Label.", common_kv_filter_desc),
		"filterL2": "value",
		"l2Description": "Value within the label.",
	},
	{
		"name":        "label_v2",
		"description": fmt.Sprintf("Filter results by Label V2 and Sub Label. Values for this field are listed in label v2 list. %s Label and 'filterL2' corresponds to the Sub Label within that Label.", common_kv_filter_desc),
		"filterL2": "value",
		"l2Description": "Value within the label.",
	},
}


func filterMcpOptionsJSONSchema() json.RawMessage {
	group_by_options := fmt.Sprintf("value is in (%s, %q, %q)", dto.GridGroupByLabel, dto.GridGroupByLabelV2, dto.GridGroupByCostCategory)
	properties := map[string]any{
		// "view_id": map[string]any{
		// 	"type":        "string",
		// 	"description": "The perspective (view) identifier",
		// },
		"time_filter": map[string]any{
			"type":        "string",
			"description": "Time filter for the query",
			"default": dto.TimeFilterLast30Days,
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
			"type": "object",
			"description": "Group by field or field and value when field " + group_by_options,
			"properties": map[string]any{
				"field": map[string]any{
					"type": "string",
					"default": dto.GridGroupByProduct,
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
				"value": map[string]any{
					"type": "string",
					"description": fmt.Sprintf("This field is used when the 'field' property %s", group_by_options),
				},
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

	for _, field := range keyValueFilterFields {
		properties[field["name"]] = map[string]any{
			"type":        "object",
			"description": field["description"],
			"properties": map[string]any{
				"filterL1": map[string]any{
			    	"type": "string",
					"description": field["description"],
				},
				"filterL2": map[string]any{
					"type": "array",
					"description": field["l2Description"],
					"items":  map[string]any{"type": "string"},
				},
			},
		}
	}
	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	b, _ := json.Marshal(schema)
	return json.RawMessage(b)
}
