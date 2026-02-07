package client

import (
	"context"
	"fmt"

	"github.com/harness/mcp-server/common/client/dto"
)

const (
	loadTestListPath = "v1/load-tests"
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
