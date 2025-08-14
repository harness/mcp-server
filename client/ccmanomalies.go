package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	ccmAnomaliesListPath        = ccmBasePath + "/anomaly/summary?accountIdentifier=%s"
	ccmIgnoredAnomaliesListPath = ccmBasePath + "/anomaly/listIgnoredAnomalies?accountIdentifier=%s"
)

func (r *CloudCostManagementService) ListAnomalies(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, scope, accountId, options, ccmAnomaliesListPath)
}

func (r *CloudCostManagementService) ListIgnoredAnomalies(ctx context.Context, scope dto.Scope, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, scope, accountId, options, ccmIgnoredAnomaliesListPath)
}

func (r *CloudCostManagementService) getAnomalies(
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
		return nil, fmt.Errorf("Failed to list cloud cost management anomalies: %w", err)
	}

	return items, nil
}
