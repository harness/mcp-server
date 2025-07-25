package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)
const (
	ccmRecommendationsListPath = ccmBasePath + "/recommendation/overview/list?accountIdentifier=%s"
)

func (r *CloudCostManagementService) ListRecommendations(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*dto.CCMListRecommendationsResponse, error) {

	path := fmt.Sprintf(ccmRecommendationsListPath, accountId)
	params := make(map[string]string)
	addScope(scope, params)

	items := new(dto.CCMListRecommendationsResponse)

	err := r.Client.Post(ctx, path, params, options, &items)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost management List Recommendations: %w", err)
	}

	return items, nil
}
