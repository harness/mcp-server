package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/ccmcommons"
	"github.com/harness/harness-mcp/pkg/harness/event"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var defaultLimit int32 = 15
var defaultOffset int32 = 0

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

			viewId, err := RequiredParamOK[string](request, "view_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limit := getLimit(request)
			offset := getOffset(request)

			timeFilter, err := OptionalParam[string](request, "time_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			groupBy, err := OptionalParam[map[string]any](request, "group_by")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
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
			params.Limit = limit
			params.Offset = offset
			params.TimeFilter = timeFilter
			params.Filters = filters
			params.KeyValueFilters = keyValueFilters
			params.GroupBy = groupBy
			data, err := client.PerspectiveGrid(ctx, scope, params)
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

			viewId, err := RequiredParamOK[string](request, "view_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limit := getLimit(request)
			offset := getOffset(request)

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

			scope, err := FetchScope(config, request, false)
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
			params.ViewId = viewId
			params.Limit = limit
			params.Offset = offset
			params.TimeFilter = timeFilter
			params.TimeGroupBy = timeGroupBy
			params.Filters = filters
			params.KeyValueFilters = keyValueFilters
			params.GroupBy = groupBy
			data, err := client.PerspectiveTimeSeries(ctx, scope, params)
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

func CcmPerspectiveSummaryWithBudgetTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("ccm_perspective_summary_with_budget", ccmcommons.CCMPerspectiveSummaryWithBudgetDescription,
			perspectiveGridJsonSchema(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			// Account Id for querystring.
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			viewId, err := RequiredParamOK[string](request, "view_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limit := getLimit(request)
			offset := getOffset(request)

			timeFilter, err := OptionalParam[string](request, "time_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			groupBy, err := OptionalParam[map[string]any](request, "group_by")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
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
			params.Limit = limit
			params.Offset = offset
			params.TimeFilter = timeFilter
			params.Filters = filters
			params.KeyValueFilters = keyValueFilters
			params.GroupBy = groupBy
			data, err := client.PerspectiveSummaryWithBudget(ctx, scope, params)
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

func CcmPerspectiveBudgetTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ccm_perspective_budget",
			mcp.WithDescription("Get the budget information for a perspective in Harness Cloud Cost Management"),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			perspectiveId, err := OptionalParam[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMPerspectiveBudgetOptions{}
			params.AccountId = accountId
			params.PerspectiveId = perspectiveId

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.PerspectiveBudget(ctx, scope, params)
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

func CcmMetadataTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_ccm_metadata",
			mcp.WithDescription(ccmcommons.CCMGetCcmMetadataDescription),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetCcmMetadata(ctx, scope, accountId)
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

func CcmPerspectiveRecommendationsTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewToolWithRawSchema("ccm_perspective_recommendations", ccmcommons.CCMPerspectiveRecommendationsDescription,
			perspectiveRecommendationsJsonSchema(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			// Account Id for querystring.
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			viewId, err := RequiredParamOK[string](request, "view_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limit := getLimit(request)
			offset := getOffset(request)

			timeFilter, err := OptionalParam[string](request, "time_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
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

			params := new(dto.CCMPerspectiveRecommendationsOptions)
			params.AccountId = accountId
			params.ViewId = viewId
			params.Limit = limit
			params.Offset = offset
			params.TimeFilter = timeFilter
			params.Filters = filters
			params.KeyValueFilters = keyValueFilters
			params.MinSaving = 1
			params.RecommendationStates = []string{"OPEN"}
			data, err := client.PerspectiveRecommendations(ctx, scope, params)
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

func CcmPerspectiveFilterValuesTool(config *config.Config, client *client.CloudCostManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {

	return mcp.NewTool("ccm_perspective_filter_values",
			mcp.WithDescription(ccmcommons.CCMPerspectiveFilterValuesDescription),
			mcp.WithString("perspective_id",
				mcp.Description("Required perspective identifier."),
				mcp.Required(),
			),
			mcp.WithString("time_filter",
				mcp.Description("Time filter for the query. Values: "+strings.Join(dto.TimeFilterValues, ", ")+". Default: "+dto.TimeFilterLast30Days),
				mcp.DefaultString(dto.TimeFilterLast30Days),
				mcp.Enum(dto.TimeFilterValues...),
			),
			mcp.WithString("value_type",
				mcp.Description("Required. Defines the type of values to include in the data list, such as categories."+strings.Join(dto.ValueTypes, ", ")),
				mcp.Required(),
				mcp.Enum(dto.ValueTypes...),
			),
			mcp.WithString("value_subtype",
				mcp.Description("Used when filter by Label, LabelV2 and Cost Categories."),
			),
			mcp.WithBoolean("is_cluster_hourly_data",
				mcp.Description("Specify if you want to filter results cluster hourly data."),
				mcp.DefaultBool(false),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(100),
				mcp.Max(100),
				mcp.Description("Number of items per page"),
			),
			mcp.WithNumber("offset",
				mcp.DefaultNumber(1),
				mcp.Description("Offset or page number for pagination"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			// Account Id for querystring.
			accountId, err := getAccountID(config, request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			viewId, err := RequiredParamOK[string](request, "perspective_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			timeFilter, err := OptionalParam[string](request, "time_filter")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if timeFilter == "" {
				timeFilter = dto.TimeFilterLast30Days
			}

			valueType, err := OptionalParam[string](request, "value_type")
			if valueType == "" {
				return mcp.NewToolResultError("value_type is required"), nil
			}

			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			valueSubType, err := OptionalParam[string](request, "value_subtype")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if valueType == dto.ValueTypeCostCategory || valueType == dto.ValueTypeLabel || valueType == dto.ValueTypeLabelV2 {
				if valueSubType == "" {
					return mcp.NewToolResultError("value_subtype is required"), nil
				}
			}

			isClusterHourlyData, err := OptionalParam[bool](request, "is_cluster_hourly_data")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := new(dto.CCMPerspectiveFilterValuesOptions)
			params.AccountId = accountId
			params.ViewId = viewId
			params.Limit = getLimitWithDefault(request, 100)
			params.Offset = getOffset(request)
			params.TimeFilter = timeFilter
			params.ValueType = valueType
			params.ValueSubType = valueSubType
			params.IsClusterHourlyData = isClusterHourlyData
			data, err := client.PerspectiveFilterValues(ctx, scope, params)
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

// ValidatePerspectiveFilterValuesTool creates a tool for validating filter values for specific field types
func CcmPerspectiveFilterValuesToolEvent(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("ccm_perspective_filter_values_event",
			mcp.WithDescription("Do not call this tool unless explicitly asked. Filter values for specified field types in Harness Cloud Cost Management"),
			mcp.WithString("field_type",
				mcp.Description("The field type to validate filter values for. Must be one of: "+
					"business_mapping (Cost Category), awsUsageaccountid (AWS Account), awsBillingEntity, "+
					"awsInstancetype, awsLineItemType, awspayeraccountid, awsServicecode, awsUsageType, "+
					"region, product, cloudProvider, label, label_key, label_v2, or label_v2_key"),
				mcp.Required(),
				mcp.Enum(dto.ValueTypes...),
			),
			mcp.WithArray("filter_values",
				mcp.WithStringItems(),
				mcp.Description("Array of values to validate for the specified field type"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			fieldType, err := RequiredParamOK[string](request, "field_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get filter values from the array parameter
			filterValuesAny, err := OptionalAnyArrayParam(request, "filter_values")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Convert to string array
			filterValues := make([]string, 0, len(filterValuesAny))
			for _, v := range filterValuesAny {
				if str, ok := v.(string); ok {
					filterValues = append(filterValues, str)
				}
			}

			responseContents := []mcp.Content{}

			// Create an event with the validated filter values
			filterValuesEvent := event.NewCustomEvent("ccm_perspective_filter_values_event", map[string]any{
				"fieldType":    fieldType,
				"filterValues": filterValues,
			}, event.WithContinue(true), event.WithDisplayOrder(100))

			// Create embedded resource for the filter values event
			eventResource, err := filterValuesEvent.CreateEmbeddedResource()
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

func buildFilters(filterFields []map[string]string, request mcp.CallToolRequest) (map[string][]string, error) {

	filters := make(map[string][]string)
	for _, field := range filterFields {
		name := field["name"]
		val, err := OptionalStringArrayParam(request, name)
		if err != nil {
			return nil, err
		}
		if val != nil && len(val) > 0 {
			filters[name] = val
		}
	}

	slog.Debug("buildFilters", "filters", filters)
	return filters, nil
}

func buildKeyValueFilters(keyValueFilterFields []map[string]string, request mcp.CallToolRequest) (map[string]map[string]any, error) {

	keyValueFilters := make(map[string]map[string]any)
	for _, field := range keyValueFilterFields {
		name := field["name"]
		val, err := OptionalParam[map[string]any](request, name)
		if err != nil {
			return nil, err
		}
		if val != nil && len(val) > 0 {
			keyValueFilters[name] = val
		}
	}
	slog.Debug("buildKeyValueFilters", "keyValueFilters", keyValueFilters)
	return keyValueFilters, nil
}

func perspectiveGridJsonSchema() json.RawMessage {
	return commonGraphQLJSONSchema(nil, nil)
}

func perspectiveFilterValuesJsonSchema() json.RawMessage {

	field := map[string]any{
		"is_cluster_hourly_data": map[string]any{
			"type":        "bool",
			"default":     false,
			"description": "Filter results by is_cluster_hourly_data",
		},
	}
	return commonGraphQLJSONSchema(field, []string{"group_by"})
}

func perspectiveTimeSeriesJsonSchema() json.RawMessage {
	timeGroupBy := map[string]any{
		"time_group_by": map[string]any{
			"type":        "string",
			"description": "Time filter for the query",
			"default":     dto.TimeGroupByDay,
			"enum": []string{
				dto.TimeGroupByDay,
				dto.TimeGroupByWeek,
				dto.TimeGroupByMonth,
			},
		},
	}
	return commonGraphQLJSONSchema(timeGroupBy, nil)
}

func perspectiveSummaryWithBudgetJsonSchema() json.RawMessage {
	return commonGraphQLJSONSchema(nil, nil)
}

func perspectiveRecommendationsJsonSchema() json.RawMessage {
	states := map[string]any{
		"recomendation_status": map[string]any{
			"type":        "array",
			"description": "Array respresenting the status of the recommendation to query",
			"items":       map[string]any{"type": "string"},
		},
	}

	return commonGraphQLJSONSchema(states, []string{"group_by"})
}

func commonGraphQLJSONSchema(extras map[string]any, removeFields []string) json.RawMessage {
	group_by_options := fmt.Sprintf("value is in (%s, %q, %q)", dto.GridGroupByLabel, dto.GridGroupByLabelV2, dto.GridGroupByCostCategory)
	properties := map[string]any{
		"view_id": map[string]any{
			"type":        "string",
			"description": "The perspective (view) identifier",
		},
		"limit": map[string]any{
			"type":        "number",
			"default":     defaultLimit,
			"description": "Rows page limit",
		},
		"offset": map[string]any{
			"type":        "number",
			"description": "Rows page offset",
			"default":     defaultOffset,
		},
		"time_filter": map[string]any{
			"type":        "string",
			"description": "Time filter for the query",
			"default":     dto.TimeFilterLast30Days,
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
			"type":        "object",
			"description": fmt.Sprintf("Group by field or field and value when field %s. The format for this field is: {\"field\": \"field_name\", \"value\": \"field_value\"}.", group_by_options),
			"properties": map[string]any{
				"field": map[string]any{
					"type":    "string",
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
					"type":        "string",
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
					"type":        "string",
					"description": field["description"],
				},
				"filterL2": map[string]any{
					"type":        "array",
					"description": field["l2Description"],
					"items":       map[string]any{"type": "string"},
				},
			},
		}
	}

	if extras != nil && len(extras) > 0 {
		for k, v := range extras {
			properties[k] = v
		}
	}

	if removeFields != nil {
		for _, field := range removeFields {
			delete(properties, field)
		}
	}

	schema := map[string]any{
		"type":       "object",
		"properties": properties,
		"required":   []string{"view_id", "time_filter", "limit", "offset", "group_by"},
	}
	b, _ := json.Marshal(schema)
	return json.RawMessage(b)
}

func getLimit(request mcp.CallToolRequest) int32 {
	return getLimitWithDefault(request, defaultLimit)
}

func getLimitWithDefault(request mcp.CallToolRequest, defaultValue int32) int32 {
	limit, err := OptionalParam[int32](request, "limit")
	if err != nil || limit == 0 {
		limit = defaultValue
	}
	return limit
}

func getOffset(request mcp.CallToolRequest) int32 {
	offset, err := OptionalParam[int32](request, "offset")

	if err != nil {
		offset = defaultOffset
	}
	return offset
}
