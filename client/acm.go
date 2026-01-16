package client

import (
	"context"
	"fmt"

	dto "github.com/harness/mcp-server/client/dto"
	commonClient "github.com/harness/mcp-server/common/client"
	commonDto "github.com/harness/mcp-server/common/client/dto"
	"log/slog"
)

const (
	acmCreateTaskPath = "/api/v1/accounts/%s/tasks"
	acmRunTaskPath    = "/api/v1/accounts/%s/executions"
)

// ACMService provides methods to interact with the Autonomous Code Maintenance API
type ACMService struct {
	Client *commonClient.Client
}

// CreateTask creates a new autonomous code maintenance task
func (s *ACMService) CreateTask(ctx context.Context, scope commonDto.Scope, params *dto.CreateACMTaskRequest) (*dto.ACMTaskResponse, error) {
	// Build the path
	path := fmt.Sprintf(acmCreateTaskPath, scope.AccountID)

	// Set up query parameters
	queryParams := make(map[string]string)

	headers := make(map[string]string)
	commonClient.AddHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.ACMTaskResponse)
	err := s.Client.Post(ctx, path, queryParams, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to create ACM task: %w", err)
	}

	return result, nil
}

// ListTaskExecutions lists executions of an autonomous code maintenance task
func (s *ACMService) ListTaskExecutions(ctx context.Context, scope commonDto.Scope, params *dto.GetACMExecutionsRequest) (*dto.ACMExecutionsListResponse, error) {
	// Build the path
	path := fmt.Sprintf(acmRunTaskPath, scope.AccountID)

	// Set up query parameters
	queryParams := make(map[string]string)

	headers := make(map[string]string)
	commonClient.AddHarnessAccountToHeaders(ctx, scope, headers)

	// Add specific query parameters for this endpoint
	queryParams["task_id"] = params.TaskID
	queryParams["page"] = fmt.Sprintf("%d", params.Page)
	queryParams["limit"] = fmt.Sprintf("%d", params.Limit)

	// Make the request
	result := new(dto.ACMExecutionsListResponse)
	err := s.Client.Get(ctx, path, queryParams, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to list ACM task executions: %w", err)
	}

	return result, nil
}

// TriggerTaskExecution triggers execution of an autonomous code maintenance task
func (s *ACMService) TriggerTaskExecution(ctx context.Context, scope commonDto.Scope, params *dto.TriggerACMTaskExecutionRequest) (*dto.ACMExecution, error) {
	// Build the path
	path := fmt.Sprintf(acmRunTaskPath, scope.AccountID)

	// Set up query parameters
	queryParams := make(map[string]string)

	headers := make(map[string]string)
	commonClient.AddHarnessAccountToHeaders(ctx, scope, headers)

	slog.InfoContext(ctx, "triggering ACM task execution", "task_id", params.TaskID, "repository_id", params.RepositoryID, "source_branch", params.SourceBranch)

	// Make the request
	result := new(dto.ACMExecution)
	err := s.Client.Post(ctx, path, queryParams, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to trigger ACM task execution: %w", err)
	}

	return result, nil
}
