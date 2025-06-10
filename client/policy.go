package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	policyDashboardMetricsPath = "v1/dashboard/metrics"
	policyEvaluationsListPath  = "v1/evaluations"
)

type PolicyClient struct {
	Client *Client
}

// GetDashboardMetrics fetches policy dashboard metrics
// https://apidocs.harness.io/tag/dashboard#operation/dashboard_metrics
func (p *PolicyClient) GetDashboardMetrics(ctx context.Context, scope dto.Scope) (*dto.DashboardMetrics, error) {
	params := make(map[string]string)
	addScope(scope, params)

	var response dto.DashboardMetrics
	err := p.Client.Get(ctx, policyDashboardMetricsPath, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get dashboard metrics: %w", err)
	}

	return &response, nil
}

// setDefaultPaginationForPolicy sets default pagination values for PolicyOptions
func setDefaultPaginationForPolicy(opts *dto.PolicyOptions) {
	if opts == nil {
		return
	}
	if opts.Page <= 0 {
		opts.Page = 0 // API uses 0-based indexing
	}

	if opts.Limit <= 0 {
		opts.Limit = defaultPageSize
	} else if opts.Limit > maxPageSize {
		opts.Limit = maxPageSize
	}
}

// ListEvaluations retrieves a list of policy evaluations based on the provided options
// https://apidocs.harness.io/tag/evaluations#operation/evaluations_list
func (p *PolicyClient) ListEvaluations(ctx context.Context, scope dto.Scope, opts *dto.PolicyOptions) ([]dto.Evaluation, int, error) {
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.PolicyOptions{}
	}

	setDefaultPaginationForPolicy(opts)

	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Limit)

	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}
	if opts.Result != "" {
		params["result"] = opts.Result
	}
	if opts.StartTime > 0 {
		params["startTime"] = fmt.Sprintf("%d", opts.StartTime)
	}
	if opts.EndTime > 0 {
		params["endTime"] = fmt.Sprintf("%d", opts.EndTime)
	}

	var response dto.EvaluationListResponse
	err := p.Client.Get(ctx, policyEvaluationsListPath, params, nil, &response)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list policy evaluations: %w", err)
	}

	return response.Data.Content, response.Data.TotalElements, nil
}
