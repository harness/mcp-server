package client

import (
	"context"
	"fmt"
	"log/slog"
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
		"filters":            ccmcommons.BuildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
		"groupBy":            ccmcommons.BuildGroupBy(options.GroupBy, ccmcommons.OutputFields, ccmcommons.OutputKeyValueFields),
		"limit":              options.Limit,
		"offset":             options.Offset,
		"aggregateFunction":  ccmcommons.BuildAggregateFunction(),
		"isClusterOnly":     false, 
		"isClusterHourlyData": false, 
		"preferences":        ccmcommons.BuildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchperspectiveGrid",
		"variables":     variables,
	}

	ccmcommons.DebugPayload("PerspectiveGrid", payload)
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


	entityGroupBy := ccmcommons.BuildGroupBy(options.GroupBy, ccmcommons.OutputFields, ccmcommons.OutputKeyValueFields)
	if len(entityGroupBy) == 0 {
		return nil, fmt.Errorf("Missing Group by entity clause")
	}

	variables := map[string]any{
		"filters":           ccmcommons.BuildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
		"groupBy":           []map[string]any{timeTruncGroupBy, entityGroupBy[0]},
		"limit":              options.Limit,
		"offset":             options.Offset,
		"aggregateFunction":  ccmcommons.BuildAggregateFunction(),
		"isClusterOnly":     false, 
		"isClusterHourlyData": false, 
		"preferences":        ccmcommons.BuildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchPerspectiveTimeSeries",
		"variables":     variables,
	}

	slog.Debug("PerspectiveTimeSeries", "Payload", payload)
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
		"filters":            ccmcommons.BuildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
		"groupBy":            ccmcommons.BuildGroupBy(options.GroupBy, ccmcommons.OutputFields, ccmcommons.OutputKeyValueFields),
		"limit":              options.Limit,
		"offset":             options.Offset,
		"aggregateFunction":  ccmcommons.BuildAggregateFunction(),
		"isClusterOnly":     false, 
		"isClusterHourlyData": false, 
		"preferences":        ccmcommons.BuildPreferences(),
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchPerspectiveDetailsSummaryWithBudget",
		"variables":     variables,
	}

	ccmcommons.DebugPayload("PerspectiveSummaryWithBudget", payload)
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

	ccmcommons.DebugPayload("PerspectiveBudget", payload)
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

	ccmcommons.DebugPayload("FetchCcmMetadata", payload)
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
			"perspectiveFilters": ccmcommons.BuildFilters(options.ViewId, options.TimeFilter, options.Filters, options.KeyValueFilters),
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

	ccmcommons.DebugPayload("PerspectiveRecommendations", payload)
	result := new(dto.CCMPerspectiveRecommendationsResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective recommendations: %w", err)
	}
	return result, nil
}

func (r *CloudCostManagementService) PerspectiveFilterValues(ctx context.Context, scope dto.Scope, options *dto.CCMPerspectiveFilterValuesOptions) (*dto.CCMPerspectiveFilterValuesResponse, error) {
	path := fmt.Sprintf(ccmPerspectiveGraphQLPath, options.AccountId, options.AccountId) 

	gqlQuery := ccmcommons.CCMFetchPerspectiveFiltersValueQuery

	variables := map[string]any{
		"filters":            ccmcommons.BuildFilterValues(options),
		"limit":              options.Limit,
		"offset":             options.Offset,
		"isClusterHourlyData": options.IsClusterHourlyData,
		"sortCriteria": []map[string]any{
			{
				"sortOrder": "ASCENDING",
				"sortType":  "NAME",
			},
		},
	}

	payload := map[string]any{
		"query":         gqlQuery,
		"operationName": "FetchPerspectiveFiltersValue",
		"variables":     variables,
	}

	ccmcommons.DebugPayload("FetchPerspectiveFilterValues", payload)
	result := new(dto.CCMPerspectiveFilterValuesResponse)
	err := r.Client.Post(ctx, path, nil, payload, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get perspective filter values: %w", err)
	}
	return result, nil
}
