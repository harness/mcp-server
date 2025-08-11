package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
	"strconv"
)
const (
	ccmRecommendationsListPath = ccmBasePath + "/recommendation/overview/list?accountIdentifier=%s"
	ccmRecommendationsByResourceTypeListPath = ccmBasePath + "/recommendation/overview/resource-type/stats?accountIdentifier=%s"
	ccmRecommendationsStatsPath = ccmBasePath + "/recommendation/overview/stats?accountIdentifier=%s"
	ccmUpdateRecommendationState = ccmBasePath + "/recommendation/overview/change-state?accountIdentifier=%s"
	ccmOverrideRecommendationSavings = ccmBasePath + "/recommendation/overview/override-savings?accountIdentifier=%s"
)

func (r *CloudCostManagementService) ListRecommendations(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, scope, accountId, options, ccmRecommendationsListPath)
}

func (r *CloudCostManagementService) ListRecommendationsByResourceType(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, scope, accountId, options, ccmRecommendationsByResourceTypeListPath)
}

func (r *CloudCostManagementService) GetRecommendationsStats(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {

	return r.getRecommendations(ctx, scope, accountId, options, ccmRecommendationsStatsPath)
}

func (r *CloudCostManagementService) UpdateRecommendationState(
	ctx context.Context, 
	scope dto.Scope, 
	accountId string, 
	recommendationId string,
	state string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmUpdateRecommendationState, accountId)
	params := make(map[string]string)
	params["recommendationId"] = recommendationId 
	params["state"] = state

	resp := new(map[string]any)

	err := r.Client.Post(ctx, path, params, nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to update cloud cost management Recommendation state: %w", err)
	}

	return resp, nil
}

func (r *CloudCostManagementService) OverrideRecommendationSavings(
	ctx context.Context, 
	scope dto.Scope, 
	accountId string, 
	recommendationId string,
	savings float64,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmOverrideRecommendationSavings, accountId)
	params := make(map[string]string)
	params["recommendationId"] = recommendationId 
	params["overriddenSavings"] = strconv.FormatFloat(savings, 'f', -1, 64)

	resp := new(map[string]any)

	err := r.Client.Put(ctx, path, params, nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("Failed to override cloud cost management Recommendation savings: %w", err)
	}

	return resp, nil
}

func (r *CloudCostManagementService) getRecommendations(
	ctx context.Context, 
	scope dto.Scope, 
	accountId string, 
	options map[string]any,
	url string,
) (*map[string]any, error) {

	path := fmt.Sprintf(url, accountId)
	params := make(map[string]string)
	addScope(scope, params)

	items := new(map[string]any)

	err := r.Client.Post(ctx, path, params, options, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management recommendations: %w", err)
	}

	return items, nil
}
