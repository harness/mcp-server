package client

import (
	"context"
	"fmt"
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
		"groupBy":            buildGroupBy(),
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
	return []map[string]any{
		{
			"viewMetadataFilter": map[string]any{
				"viewId": options.ViewId,
				"isPreview": false,
			},
		},
		{
			"timeFilter": map[string]any{
				"field": map[string]any{
					"fieldId": "startTime",
					"fieldName": "startTime",
					"identifier": "COMMON",
				},
				"operator": "AFTER",
				"value": 1748649600000, // your start timestamp (ms)
			},
		},
		{
			"timeFilter": map[string]any{
				"field": map[string]any{
					"fieldId": "startTime",
					"fieldName": "startTime",
					"identifier": "COMMON",
				},
				"operator": "BEFORE",
				"value": 1751327999000, // your end timestamp (ms)
			},
		},
	}
}

func buildGroupBy() ([]map[string]any) {

	return []map[string]any{
		{
			"entityGroupBy": map[string]any{
				"fieldId": "product",
				"fieldName": "Product",
				"identifier": "COMMON",
				"identifierName": "Common",
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
