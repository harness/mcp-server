package client

import (
	"context"
	"fmt"

	"github.com/harness/mcp-server/common/client/dto"
)

const (
	loadTestListPath = "v1/load-tests"
	loadTestGetPath  = "v1/load-tests/%s"
	loadTestRunPath  = "v1/load-tests/%s/runs"
	loadTestStopPath = "v1/runs/%s/stop"
)

// LoadTestService provides methods to interact with the Load Test API
type LoadTestService struct {
	Client *Client
}

// ListLoadTests lists all load tests in the project
func (l *LoadTestService) ListLoadTests(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions) (*dto.ListLoadTestResponse, error) {
	var (
		path   = loadTestListPath
		params = make(map[string]string)
	)

	// Set default pagination
	setDefaultPagination(pagination)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)

	// Add scope parameters
	params["accountIdentifier"] = scope.AccountID
	params["orgIdentifier"] = scope.OrgID
	params["projectIdentifier"] = scope.ProjectID

	listLoadTests := new(dto.ListLoadTestResponse)
	err := l.Client.Get(ctx, path, params, nil, listLoadTests)
	if err != nil {
		return nil, fmt.Errorf("failed to list load tests: %w", err)
	}

	return listLoadTests, nil
}

// GetLoadTest retrieves details of a specific load test
func (l *LoadTestService) GetLoadTest(ctx context.Context, scope dto.Scope, loadTestID string) (*dto.LoadTest, error) {
	var (
		path   = fmt.Sprintf(loadTestGetPath, loadTestID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["accountIdentifier"] = scope.AccountID
	params["orgIdentifier"] = scope.OrgID
	params["projectIdentifier"] = scope.ProjectID

	loadTest := new(dto.LoadTest)
	err := l.Client.Get(ctx, path, params, nil, loadTest)
	if err != nil {
		return nil, fmt.Errorf("failed to get load test: %w", err)
	}

	return loadTest, nil
}

// RunLoadTest starts a new run for a load test
func (l *LoadTestService) RunLoadTest(ctx context.Context, scope dto.Scope, loadTestID string, request *dto.RunLoadTestRequest) (*dto.LoadTestRunResponse, error) {
	var (
		path   = fmt.Sprintf(loadTestRunPath, loadTestID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["accountIdentifier"] = scope.AccountID
	params["orgIdentifier"] = scope.OrgID
	params["projectIdentifier"] = scope.ProjectID

	runResponse := new(dto.LoadTestRunResponse)
	err := l.Client.Post(ctx, path, params, request, nil, runResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to run load test: %w", err)
	}

	return runResponse, nil
}

// StopLoadTest stops a running load test run
func (l *LoadTestService) StopLoadTest(ctx context.Context, scope dto.Scope, runID string) (*dto.StopLoadTestResponse, error) {
	var (
		path   = fmt.Sprintf(loadTestStopPath, runID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["accountIdentifier"] = scope.AccountID
	params["orgIdentifier"] = scope.OrgID
	params["projectIdentifier"] = scope.ProjectID

	stopResponse := new(dto.StopLoadTestResponse)
	err := l.Client.Post(ctx, path, params, nil, nil, stopResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to stop load test run: %w", err)
	}

	return stopResponse, nil
}
