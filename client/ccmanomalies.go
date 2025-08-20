package client

import (
	"context"
	"fmt"

	"log/slog"
)

const (
	ccmAnomaliesSummaryPath       = ccmBasePath + "/anomaly/v2/summary?accountIdentifier=%s"
	ccmIgnoredAnomaliesListPath   = ccmBasePath + "/anomaly/listIgnoredAnomalies?accountIdentifier=%s"
	ccmAnomaliesListPath          = ccmBasePath + "/anomaly/v2/list?accountIdentifier=%s"
	ccmAnomalyPath                = ccmBasePath + "/anomaly/anomaly?accountIdentifier=%s"
	ccmAnomalyFilterValuesPath    = ccmBasePath + "/anomaly/anomaly/filter-values?accountIdentifier=%s"
	ccmAnomaliesByPerspectivePath = ccmBasePath + "/anomaly/perspective/%s?accountIdentifier=%s"
	ccmReportAnomalyFeedbackPath  = ccmBasePath + "/anomaly/feedback?accountIdentifier=%s&anomalyId=%s"
)

var emptyMap = map[string]string{}

func (r *CloudCostManagementService) GetAnomaliesSummary(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmAnomaliesSummaryPath)
}

func (r *CloudCostManagementService) ListIgnoredAnomalies(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmIgnoredAnomaliesListPath)
}

func (r *CloudCostManagementService) ListAllAnomalies(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmAnomaliesListPath)
}

func (r *CloudCostManagementService) ListAnomalies(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	return r.getAnomalies(ctx, accountId, options, ccmAnomalyPath)
}

func (r *CloudCostManagementService) ListFilterFieldAnomalies(ctx context.Context, accountId string, options []string) (*map[string]any, error) {
	return r.getFilterValuesAnomalies(ctx, accountId, options)
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
	err := r.Client.Post(ctx, path, params, options, emptyMap, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management anomalies: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) getFilterValuesAnomalies(
	ctx context.Context,
	accountId string,
	options []string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmAnomalyFilterValuesPath, accountId)
	params := make(map[string]string)

	items := new(map[string]any)

	slog.Debug("Fetching anomalies", "body", options)
	err := r.Client.Post(ctx, path, params, options, emptyMap, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management anomalies: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) GetAnomaliesForPerspective(
	ctx context.Context,
	accountId string,
	perspectiveId string,
	options map[string]any,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmAnomaliesByPerspectivePath, perspectiveId, accountId)
	params := make(map[string]string)

	items := new(map[string]any)

	slog.Debug("Fetching anomalies by perspective", "body", options)
	err := r.Client.Post(ctx, path, params, options, emptyMap, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management anomalies by perspective: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) ReportAnomalyFeedback(
	ctx context.Context,
	accountId string,
	anomalyId string,
	feedback string,
) (*map[string]any, error) {

	path := fmt.Sprintf(ccmReportAnomalyFeedbackPath, accountId, anomalyId)

	options := map[string]any{
		"feedback": feedback,
	}
	items := new(map[string]any)

	err := r.Client.Put(ctx, path, nil, options, &items)
	if err != nil {
		return nil, fmt.Errorf("Failed to list cloud cost management anomalies: %w", err)
	}

	return items, nil
}
