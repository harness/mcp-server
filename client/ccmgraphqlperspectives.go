package client

import (
	"context"
	"fmt"
	"time"
	"strings"
	"log/slog"
	"github.com/harness/harness-mcp/client/dto"
	//"github.com/harness/harness-mcp/pkg/utils"
)

const (
	ccmGraphQLBasePath = "gateway/" + ccmBasePath + "/graphql"
	ccmPerspectiveGridPath = ccmGraphQLBasePath + "?accountIdentifier=%s&routingId=%s"
)

//https://qa.harness.io/gateway/ccm/api/graphql?accountIdentifier=Z60xsRGoTeqOoAFRCsmlBQ&routingId=Z60xsRGoTeqOoAFRCsmlBQ

func (r *CloudCostManagementService) PerspectiveGrid(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveGridOptions) (*dto.CCMPerspectiveGridResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGridPath, options.AccountId, options.AccountId) 

	const gqlQuery = `
	query FetchperspectiveGrid(
		$filters: [QLCEViewFilterWrapperInput], 
		$groupBy: [QLCEViewGroupByInput], 
		$limit: Int, 
		$offset: Int, 
		$aggregateFunction: [QLCEViewAggregationInput], 
		$isClusterOnly: Boolean!, 
		$isClusterHourlyData: Boolean = null, 
		$preferences: ViewPreferencesInput
	) {
		perspectiveGrid(
			aggregateFunction: $aggregateFunction
			filters: $filters
			groupBy: $groupBy
			limit: $limit
			offset: $offset
			preferences: $preferences
			isClusterHourlyData: $isClusterHourlyData
			sortCriteria: [{sortType: COST, sortOrder: DESCENDING}]
		) {
			data {
				name
				id
				cost
				costTrend
				__typename
			}
			__typename
		}
		perspectiveTotalCount(
			filters: $filters
			groupBy: $groupBy
			isClusterQuery: $isClusterOnly
			isClusterHourlyData: $isClusterHourlyData
		)
	}`

	variables := map[string]any{
		"filters":            buildFilters(options),
		"groupBy":            buildGroupBy(options.GroupBy, outputFields, outputKeyValueFields),
		"limit":              15,
		"offset":             0,
		"aggregateFunction":  buildAggregateFunction(),
		"isClusterOnly":      false,
		"isClusterHourlyData": false,
		"preferences":        buildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchperspectiveGrid",
		"variables":     variables,
	}

	slog.Debug("PerspectiveGrid", "Payload", payload)
	result := new(dto.CCMPerspectiveGridResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective grid: %w", err)
	}
	return result, nil
}

func buildFilters(options *dto.CCMPerspectiveGridOptions) ([]map[string]any) {
	filters := []map[string]any{}
	viewFilter := []map[string]any{
		{
			"viewMetadataFilter": map[string]any{
				//"viewId": options.ViewId,
				"viewId": "VZf-WROOTyeczYa4FMkhYg",
				"isPreview": false,
			},
		},
	}

	filters = append(filters, viewFilter...)
	filters = append(filters, buildTimeFilters(options)...)
	filters = append(filters, buildFieldFilters(options.Filters, outputFields)...)
	filters = append(filters, buildKeyValueFieldFilters(options.KeyValueFilters, outputKeyValueFields)...)

	slog.Debug("PerspectiveGrid", "FILTERS", filters)

	return filters
}

func buildTimeFilters(options *dto.CCMPerspectiveGridOptions) []map[string]any {
	start, end := GetTimeRangeFromFilter(options.TimeFilter, time.Now())
	return []map[string]any{
		{
			"timeFilter": map[string]any{
				"field": map[string]any{
					"fieldId":    "startTime",
					"fieldName":  "startTime",
					"identifier": "COMMON",
				},
				"operator": "AFTER",
				"value":    start.UnixMilli(),
			},
		},
		{
			"timeFilter": map[string]any{
				"field": map[string]any{
					"fieldId":    "startTime",
					"fieldName":  "startTime",
					"identifier": "COMMON",
				},
				"operator": "BEFORE",
				"value":    end.UnixMilli(),
			},
		},
	}
} 

func buildAggregateFunction() ([]map[string]any) {

	return []map[string]any{
		{
			"operationType": "SUM",
			"columnName": "cost",
		},
	}
} 

func buildPreferences() (map[string]any) {
	return map[string]any{
		"includeOthers": false,
		"includeUnallocatedCost": false,
		"awsPreferences": map[string]any{
			"includeDiscounts": false,
			"includeCredits": false,
			"includeRefunds": false,
			"includeTaxes": false,
			"awsCost": "UNBLENDED",
		},
		"gcpPreferences": nil,
		"azureViewPreferences": nil,
		"showAnomalies": false,
	}
}

func GetTimeRangeFromFilter(filter string, now time.Time) (start, end time.Time) {
	end = now
	switch filter {
	case dto.TimeFilterLast7:
		start = now.AddDate(0, 0, -7)
	case dto.TimeFilterThisMonth:
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	case dto.TimeFilterLast30Days:
		start = now.AddDate(0, 0, -30)
	case dto.TimeFilterThisQuarter:
		month := ((int(now.Month())-1)/3)*3 + 1
		start = time.Date(now.Year(), time.Month(month), 1, 0, 0, 0, 0, now.Location())
	case dto.TimeFilterThisYear:
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	case dto.TimeFilterLastMonth:
		firstOfThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		lastMonth := firstOfThisMonth.AddDate(0, -1, 0)
		start = lastMonth
		end = firstOfThisMonth.Add(-time.Nanosecond)
	case dto.TimeFilterLastQuarter:
		month := ((int(now.Month())-1)/3)*3 + 1
		firstOfThisQuarter := time.Date(now.Year(), time.Month(month), 1, 0, 0, 0, 0, now.Location())
		lastQuarter := firstOfThisQuarter.AddDate(0, -3, 0)
		start = lastQuarter
		end = firstOfThisQuarter.Add(-time.Nanosecond)
	case dto.TimeFilterLastYear:
		start = time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, now.Location())
		end = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
	case dto.TimeFilterLast3Months:
		start = now.AddDate(0, -3, 0)
	case dto.TimeFilterLast6Months:
		start = now.AddDate(0, -6, 0)
	case dto.TimeFilterLast12Months:
		start = now.AddDate(0, -12, 0)
	default:
		start = now
	}
	return start, end
}

var outputFields = []map[string]string{
	{
		"fieldId":        "region",
		"fieldName":      "Region",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
	{
		"fieldId":        "awsUsageaccountid",
		"fieldName":      "Account",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsServicecode",
		"fieldName":      "Service",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsBillingEntity",
		"fieldName":      "Billing Entity",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsUsageaccountid",
		"fieldName":      "Account",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsInstancetype",
		"fieldName":      "Instance Type",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsLineItemType",
		"fieldName":      "Line Item Type",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awspayeraccountid",
		"fieldName":      "Payer Account",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsUsageType",
		"fieldName":      "Usage Type",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "cloudProvider",
		"fieldName":      "Cloud Provider",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
	{
		"fieldId":        "none",
		"fieldName":      "None",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
	{
		"fieldId":        "product",
		"fieldName":      "Product",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
}

var outputKeyValueFields = []map[string]string{
	{
		"fieldId":        "labels.value",
		"fieldName":      "", // Label name
		"identifier":     "LABEL",
		"identifierName": "Label",
	},
	{
		"fieldId":        "labels.value",
		"fieldName":      "", // Label name
		"identifier":     "LABEL_V2",
		"identifierName": "Label V2",
	},
	{
		"fieldId":        "", // Cost Category Id
		"fieldName":      "", // Cost Category Name
		"identifier":     "BUSINESS_MAPPING",
		"identifierName": "Cost Categories",
	},
}

func buildFieldFilters(input map[string][]string, output []map[string]string) []map[string]any {
	result := make([]map[string]any, 0)
	for fName, values := range input {
		slog.Debug("PerspectiveGrid", "Field ID ", fName)
		for _, out := range output {
			slog.Debug("PerspectiveGrid", "Field ID OUT", out["fieldId"])
			if strings.EqualFold(fName, out["fieldId"]) {
				var idFilterMap = map[string]any{
					"idFilter": map[string]any{
						"values":   values,
						"operator": "LIKE",
						"field": out,
					},
				}

			result = append(result, idFilterMap)
			}
		}
	}

	slog.Debug("PerspectiveGrid", "Field ID filters", result)
	return result
}

func buildKeyValueFieldFilters(input map[string]map[string]any, output []map[string]string) []map[string]any {
	result := make([]map[string]any, 0)
	for fName, values := range input {
		slog.Debug("PerspectiveGrid", "KV Field ID ", fName)
		for _, out := range output {
			slog.Debug("PerspectiveGrid", "KV Field ID OUT", out["fieldId"])
			slog.Debug("PerspectiveGrid", "KV Field identifier OUT", out["identifier"])
			if strings.EqualFold(fName, out["identifier"]) {
				fieldName, ok := values["filterL1"].(string)
				slog.Debug("PerspectiveGrid", "KV Field filterL1 OK", fieldName)
				if ok {
					slog.Debug("PerspectiveGrid", "Is OK", fieldName)
					out["fieldName"] = fieldName 
					var idFilterMap = map[string]any{
						"idFilter": map[string]any{
							"values":   values["filterL2"],
							"operator": "LIKE",
							"field": out,
						},
					}
				result = append(result, idFilterMap)
				}
			}
		}
	}
	slog.Debug("PerspectiveGrid", "KV Field ID filters", result)
	return result
}

func buildGroupBy(input map[string]any, outputFields []map[string]string, outputKeyValueFields []map[string]string) []map[string]any {
	// Get the value when grouping by field only.
	field, ok1 := input["field"].(string)
	if ok1 == false {
		return nil
	}	

	for _, out := range outputFields {
		if strings.EqualFold(field, out["fieldId"]) {
			return []map[string]any{
				{
					"entityGroupBy": out,
				},
			}
		}
	}

	// Get the value when grouping by key,value.
	value, ok2 := input["value"].(string)
	if ok2 == false {
		return nil
	}
	for _, out := range outputKeyValueFields {
		if strings.EqualFold(field, out["identifier"]) {
			out["fieldName"] = value
			return []map[string]any{
				{
					"entityGroupBy": out,
				},
			}
		}
	}
	return nil
}
