package client

import (
	"context"
	"fmt"

	dto "github.com/harness/mcp-server/client/dto"
	commonClient "github.com/harness/mcp-server/common/client"
	commonDto "github.com/harness/mcp-server/common/client/dto"
)

const (
	loadTestListPath = "v1/load-tests"
)

// LoadTestService provides methods to interact with the Load Test API
type LoadTestService struct {
	Client *commonClient.Client
}

// ListLoadTests lists all load tests in the project
func (l *LoadTestService) ListLoadTests(ctx context.Context, scope commonDto.Scope, pagination *commonDto.PaginationOptions) (*dto.ListLoadTestResponse, error) {
	var (
		path   = loadTestListPath
		params = make(map[string]string)
	)

	// Add pagination parameters
	if pagination != nil {
		params["page"] = fmt.Sprintf("%d", pagination.Page)
		params["limit"] = fmt.Sprintf("%d", pagination.Size)
	}

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

