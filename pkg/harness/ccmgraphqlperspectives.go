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
	"github.com/harness/harness-mcp/pkg/ccmcommons"
)

func CcmPerspectiveGridTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("ccm_perspective_grid", ccmcommons.CCMPerspectiveGridDescription,
		perspectiveGridJsonSchema(),
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

		filters, err := buildFilters(ccmcommons.CCMFilterFields, request) 
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		keyValueFilters, err := buildKeyValueFilters(ccmcommons.CCMKeyValueFilterFields, request) 
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		
		params := new(dto.CCMPerspectiveGridOptions)
		params.AccountId = accountId
		params.ViewId = viewId
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

func CcmPerspectiveTimeSeriesTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("ccm_perspective_time_series", ccmcommons.CCMPerspectiveTimeSeriesDescription,
		perspectiveTimeSeriesJsonSchema(),
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

		timeGroupBy, err := OptionalParam[string](request, "time_group_by")
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

		filters, err := buildFilters(ccmcommons.CCMFilterFields, request) 
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		keyValueFilters, err := buildKeyValueFilters(ccmcommons.CCMKeyValueFilterFields, request) 
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}
		
		params := new(dto.CCMPerspectiveTimeSeriesOptions)
		params.AccountId = accountId
		//params.ViewId = viewId
		params.TimeFilter = timeFilter
		params.TimeGroupBy = timeGroupBy
		params.Filters = filters
		params.KeyValueFilters = keyValueFilters
		params.GroupBy = groupBy
		data, err := client.PerspectiveTimeSeries(ctx, scope, params)
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

func buildFilters(filterFields []map[string]string, request mcp.CallToolRequest) (map[string][]string, error) {

	filters := make(map[string][]string)
	for _, field := range filterFields {
		name := field["name"]
		val, err := OptionalStringArrayParam(request, name)
		if err != nil {
			// return mcp.NewToolResultError(err.Error()), nil
			return nil, err
		}
		if val != nil && len(val) > 0 {
			filters[name] = val
		}
	}
	return filters, nil
}

func buildKeyValueFilters(keyValueFilterFields []map[string]string, request mcp.CallToolRequest) (map[string]map[string]any, error) {

	keyValueFilters := make(map[string]map[string]any)
	for _, field := range keyValueFilterFields {
		name := field["name"]
		val, err := OptionalParam[map[string]any](request, name)
		if err != nil {
			// return mcp.NewToolResultError(err.Error()), nil
			return nil, err
		}
		// slog.Debug("PGridTool", "KV Field ID filter", name)
		// slog.Debug("PGridTool", "KV Field ID value", val)
		if val != nil && len(val) > 0 {
			keyValueFilters[name] = val
		}
	}

	return keyValueFilters, nil
}

func perspectiveGridJsonSchema() json.RawMessage {
	return commonGraphQLJSONSchema(nil)
}

func perspectiveTimeSeriesJsonSchema() json.RawMessage {	
	timeGroupBy :=map[string]any{
		"time_group_by": map[string]any{
			"type":        "string",
			"description": "Time filter for the query",
			"default": dto.TimeGroupByDay,
			"enum": []string{
				dto.TimeGroupByDay,
				dto.TimeGroupByWeek,
				dto.TimeGroupByMonth,
			},
		},
	}
	return commonGraphQLJSONSchema(timeGroupBy)
}

func commonGraphQLJSONSchema(extras map[string]any) json.RawMessage {
	group_by_options := fmt.Sprintf("value is in (%s, %q, %q)", dto.GridGroupByLabel, dto.GridGroupByLabelV2, dto.GridGroupByCostCategory)
	properties := map[string]any{
		"view_id": map[string]any{
			"type":        "string",
			"description": "The perspective (view) identifier",
		},
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

	for _, field := range ccmcommons.CCMFilterFields {
		properties[field["name"]] = map[string]any{
			"type":        "array",
			"description": field["description"],
			"items":       map[string]any{"type": "string"},
		}
	}

	for _, field := range ccmcommons.CCMKeyValueFilterFields {
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

	if extras != nil && len(extras) > 0 {
		for k, v := range extras {
		 	slog.Debug("KEY Value extra", "key", k)
		 	slog.Debug("KEY Value extra", "value", v)
			properties[k] = v
		}
	}

	schema := map[string]any{
		"type":       "object",
		"properties": properties,
	}
	b, _ := json.Marshal(schema)
	return json.RawMessage(b)
}
