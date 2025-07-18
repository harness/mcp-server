package client

import (
	"context"
	"fmt"
	"time"
	"strings"
	"encoding/json"
	"github.com/rs/zerolog/log"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/client/ccmcommons"
)

const (
	ccmGraphQLBasePath = ccmBasePath + "/graphql"
	ccmPerspectiveGraphQLPath = ccmGraphQLBasePath + "?accountIdentifier=%s&routingId=%s"
)

func (r *CloudCostManagementService) PerspectiveGrid(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveGridOptions) (*dto.CCMPerspectiveGridResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, options.AccountId, options.AccountId) 

	gqlQuery := ccmcommons.CCMPerspectiveGridQuery
	variables := map[string]any{
		"filters":            buildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
		"groupBy":            buildGroupBy(options.GroupBy, outputFields, outputKeyValueFields),
		"limit":              options.Limit,
		"offset":             options.Offset,
		"aggregateFunction":  buildAggregateFunction(),
		"isClusterOnly":     false, 
		"isClusterHourlyData": false, 
		"preferences":        buildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchperspectiveGrid",
		"variables":     variables,
	}

	debugPayload("PerspectiveGrid", payload)
	result := new(dto.CCMPerspectiveGridResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective grid: %w", err)
	}
	return result, nil
}

func (r *CloudCostManagementService) PerspectiveTimeSeries(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveTimeSeriesOptions) (*dto.CCMPerspectiveTimeSeriesResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, options.AccountId, options.AccountId) 

	gqlQuery := ccmcommons.CCMPerspectiveTimeSeriesQuery
	timeTruncGroupBy := map[string]any{
		"timeTruncGroupBy": map[string]any{"resolution": options.TimeGroupBy},
	}


	entityGroupBy := buildGroupBy(options.GroupBy, outputFields, outputKeyValueFields)
	if len(entityGroupBy) == 0 {
		return nil, fmt.Errorf("Missing Group by entity clause")
	}

	variables := map[string]any{
		"filters":            buildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
		"groupBy":           []map[string]any{timeTruncGroupBy, entityGroupBy[0]},
		"limit":              options.Limit,
		"offset":             options.Offset,
		"aggregateFunction":  buildAggregateFunction(),
		"isClusterOnly":     false, 
		"isClusterHourlyData": false, 
		"preferences":        buildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchPerspectiveTimeSeries",
		"variables":     variables,
	}

	log.Debug().Interface("Payload", payload).Msg("PerspectiveTimeSeries")
	result := new(dto.CCMPerspectiveTimeSeriesResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective grid: %w", err)
	}
	return result, nil
}

func (r *CloudCostManagementService) PerspectiveSummaryWithBudget(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveSummaryWithBudgetOptions) (*dto.CCMPerspectiveSummaryWithBudgetResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, options.AccountId, options.AccountId) 

	gqlQuery := ccmcommons.CCMPerspectiveSummaryWithBudgetQuery
	variables := map[string]any{
		"filters":            buildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
		"groupBy":            buildGroupBy(options.GroupBy, outputFields, outputKeyValueFields),
		"limit":              options.Limit,
		"offset":             options.Offset,
		"aggregateFunction":  buildAggregateFunction(),
		"isClusterOnly":     false, 
		"isClusterHourlyData": false, 
		"preferences":        buildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchPerspectiveDetailsSummaryWithBudget",
		"variables":     variables,
	}

	debugPayload("PerspectiveSummaryWithBudget", payload)
	result := new(dto.CCMPerspectiveSummaryWithBudgetResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective grid: %w", err)
	}
	return result, nil
}

func (r *CloudCostManagementService) PerspectiveBudget(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveBudgetOptions) (*dto.CCMPerspectiveBudgetResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, options.AccountId, options.AccountId) 

	gqlQuery := ccmcommons.CCMPerspectiveBudgetQuery
	variables := map[string]any{
		"perspectiveId":     options.PerspectiveId, 
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchPerspectiveBudget",
		"variables":     variables,
	}

	debugPayload("PerspectiveBudget", payload)
	result := new(dto.CCMPerspectiveBudgetResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective budget: %w", err)
	}
	return result, nil
}

func (r *CloudCostManagementService) GetCcmMetadata(ctx context.Context, scope dto.Scope, accountId string) (*dto.CCMMetadataResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, accountId, accountId) 

	gqlQuery := ccmcommons.CCMMetadataQuery
	variables := map[string]any{
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchCcmMetaData",
		"variables":     variables,
	}

	debugPayload("FetchCcmMetadata", payload)
	result := new(dto.CCMMetadataResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective budget: %w", err)
	}
	return result, nil
}

func (r *CloudCostManagementService) PerspectiveRecommendations(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveRecommendationsOptions) (*dto.CCMPerspectiveRecommendationsResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, options.AccountId, options.AccountId) 

	gqlQuery := ccmcommons.CCMPerspectiveRecommendationsQuery

	variables := map[string]any{
		"filter": map[string]any{
			"perspectiveFilters": buildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
			"limit":              options.Limit,
			"offset":             options.Offset,
			"minSaving":     options.MinSaving, 
			"recommendationStates": options.RecommendationStates,
		},
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "PerspectiveRecommendations",
		"variables":     variables,
	}

	debugPayload("PerspectiveRecommendations", payload)
	result := new(dto.CCMPerspectiveRecommendationsResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective recommendations: %w", err)
	}
	return result, nil
}

func buildFilters(viewId string ,timeFilters string, idFilters dto.CCMGraphQLFilters, keyValueFilters dto.CCMGraphQLKeyValueFilters) ([]map[string]any) {
	filters := []map[string]any{}
	viewFilter := []map[string]any{
		{
			"viewMetadataFilter": map[string]any{
				"viewId": viewId,
				"isPreview": false,
			},
		},
	}

	filters = append(filters, viewFilter...)
	filters = append(filters, buildTimeFilters(timeFilters)...)
	filters = append(filters, buildFieldFilters(idFilters, outputFields)...)
	filters = append(filters, buildKeyValueFieldFilters(keyValueFilters, outputKeyValueFields)...)

	return filters
}

func buildTimeFilters(timeFilter string) []map[string]any {
	start, end := GetTimeRangeFromFilter(timeFilter, time.Now())
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
		log.Debug().Str("Field ID", fName).Msg("PerspectiveGrid")
		for _, out := range output {
			log.Debug().Interface("Field ID OUT", out["fieldId"]).Msg("PerspectiveGrid")
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

	log.Debug().Interface("Field ID filters", result).Msg("PerspectiveGrid")
	return result
}

func buildKeyValueFieldFilters(input dto.CCMGraphQLKeyValueFilters, output []map[string]string) []map[string]any {
	result := make([]map[string]any, 0)
	for fName, values := range input {
		log.Debug().Str("KV Field ID", fName).Msg("PerspectiveGrid")
		for _, out := range output {
			log.Debug().Interface("KV Field ID OUT", out["fieldId"]).Msg("PerspectiveGrid")
			log.Debug().Interface("KV Field identifier OUT", out["identifier"]).Msg("PerspectiveGrid")
			if strings.EqualFold(fName, out["identifier"]) {
				fieldName, ok := values["filterL1"].(string)
				log.Debug().Str("KV Field filterL1 OK", fieldName).Msg("PerspectiveGrid")
				if ok {
					log.Debug().Str("Is OK", fieldName).Msg("PerspectiveGrid")
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
	log.Debug().Interface("KV Field ID filters", result).Msg("PerspectiveGrid")
	return result
}

var defaultGroupBy = []map[string]any{ 
		{	
			"entityGroupBy": map[string]any{
				"fieldId":        "product",
				"fieldName":      "Product",
				"identifier":     "COMMON",
				"identifierName": "Common",
			},
		},
	}
func buildGroupBy(input map[string]any, outputFields []map[string]string, outputKeyValueFields []map[string]string) []map[string]any {
	// Get the value when grouping by field only.
	field, ok1 := input["field"].(string)
	if ok1 == false {
		return defaultGroupBy 
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
		return defaultGroupBy 
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
	return defaultGroupBy 
}

func debugPayload(operation string, payload map[string]any) {
	jsonPayload := mapToJSONString(payload)
	log.Debug().Msg("-----------")
	log.Debug().Str("operation", operation).Interface("Payload", jsonPayload).Msg("GraphQL Request")
	log.Debug().Msg("-----------")
}

func mapToJSONString(m map[string]any) (string) {
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return ""
	}
	return string(b)
}
