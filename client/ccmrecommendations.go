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
		return nil, fmt.Errorf("failed to list cloud cost management List Recommendations: %w", err)
	}

	return items, nil
}
