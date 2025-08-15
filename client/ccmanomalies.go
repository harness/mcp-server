package client

import (
	"context"
	"fmt"

	"log/slog"
)

const (
	ccmAnomaliesSummaryPath     = ccmBasePath + "/anomaly/v2/summary?accountIdentifier=%s"
	ccmIgnoredAnomaliesListPath = ccmBasePath + "/anomaly/v2/listIgnoredAnomalies?accountIdentifier=%s"
	ccmAnomaliesListPath        = ccmBasePath + "/anomaly/v2/list?accountIdentifier=%s"
)

func (r *CloudCostManagementService) GetAnomaliesSummary(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmAnomaliesSummaryPath)
}

func (r *CloudCostManagementService) ListIgnoredAnomalies(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmIgnoredAnomaliesListPath)
}

func (r *CloudCostManagementService) ListAnomalies(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmAnomaliesListPath)
}

func (r *CloudCostManagementService) getAnomalies(
	ctx context.Context,
	accountId string,
	options map[string]any,
	url string,
) (*map[string]any, error) {

	path := fmt.Sprintf(url, accountId)
	params := make(map[string]string)

	items := new(map[string]any)

	slog.Debug("Fetching anomalies", "body", options)
	err := r.Client.Post(ctx, path, params, options, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management anomalies: %w", err)
	}

	return items, nil
}
