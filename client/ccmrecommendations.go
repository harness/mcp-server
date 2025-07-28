package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)
const (
	ccmRecommendationsListPath = ccmBasePath + "/recommendation/overview/list?accountIdentifier=%s"
	ccmRecommendationsByResourceTypeListPath = ccmBasePath + "/recommendation/overview/resource-type/stats?accountIdentifier=%s"
	ccmRecommendationsStatsPath = ccmBasePath + "/recommendation/overview/stats?accountIdentifier=%s"
	ccmUpdateRecommendationState = ccmBasePath + "/recommendation/overview/change-state?accountIdentifier=%s"
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

func (r *CloudCostManagementService)UpdateRecommendationState(
	ctx context.Context, 
	scope dto.Scope, 
	accountId string, 
	recommendationId,
	state string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmUpdateRecommendationState, accountId)
	params := make(map[string]string)
	params["recommendationId"] = recommendationId 
	params["state"] = state

	items := new(map[string]any)

	err := r.Client.Post(ctx, path, params, nil, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to update cloud cost management Recommendation state: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService)getRecommendations(
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
		return nil, fmt.Errorf("Failed to list cloud cost management Recommendations: %w", err)
	}

	return items, nil
}
