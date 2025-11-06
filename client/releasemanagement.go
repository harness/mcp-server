package client

import (
	"context"
	"fmt"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Release Management API paths
	releaseSummaryPath                 = "/api/release/summary"
	releaseTasksPath                   = "/api/release/%s/tasks"
	releaseApprovalsPath               = "/api/release/%s/approvals"
	releaseExecutionPhasesPath         = "/api/orchestration/execution/%s/phases"
	releaseExecutionPhaseOutputPath    = "/api/orchestration/execution/release/%s/phase/%s/output"
	releaseExecutionActivityOutputPath = "/api/orchestration/execution/release/%s/phase/%s/activity/%s/output"
)

// ReleaseManagementService provides methods to interact with Release Management API
type ReleaseManagementService struct {
	Client *Client
}

// GetReleaseSummary fetches releases based on time ranges and optional filters
func (r *ReleaseManagementService) GetReleaseSummary(ctx context.Context, scope dto.Scope, request *dto.ReleaseSummaryRequest, searchTerm string, releaseGroupIds []string, releaseType string, status []string) (*dto.ReleaseSummaryResponse, error) {
	// Set up query parameters (release management API uses header for account, not query params)
	params := make(map[string]string)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	if searchTerm != "" {
		params["searchTerm"] = searchTerm
	}
	if len(releaseGroupIds) > 0 {
		params["releaseGroupIds"] = strings.Join(releaseGroupIds, ",")
	}
	if releaseType != "" {
		params["releaseType"] = releaseType
	}
	if len(status) > 0 {
		params["status"] = strings.Join(status, ",")
	}

	headers := make(map[string]string)
	addHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.ReleaseSummaryResponse)
	err := r.Client.Post(ctx, releaseSummaryPath, params, request, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to get release summary: %w", err)
	}

	return result, nil
}

// GetReleaseTasks fetches all tasks for a specific release using releaseId (simplified endpoint)
func (r *ReleaseManagementService) GetReleaseTasks(ctx context.Context, scope dto.Scope, releaseId string, cursor string, limit int, status []string) (*dto.ExecutionTasksListResponse, error) {
	path := fmt.Sprintf(releaseTasksPath, releaseId)

	// Set up query parameters (release management API uses header for account, not query params)
	params := make(map[string]string)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	// Optional parameters
	if cursor != "" {
		params["cursor"] = cursor
	}
	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}
	if len(status) > 0 {
		params["status"] = strings.Join(status, ",")
	}

	headers := make(map[string]string)
	addHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.ExecutionTasksListResponse)
	err := r.Client.Get(ctx, path, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to get release tasks: %w", err)
	}

	return result, nil
}

// GetReleaseApprovals fetches pending approvals for a specific release
func (r *ReleaseManagementService) GetReleaseApprovals(ctx context.Context, scope dto.Scope, releaseId string, searchTerm string, status []string, page int, size int, sort string) (*dto.ReleaseApprovalsResponse, error) {
	path := fmt.Sprintf(releaseApprovalsPath, releaseId)

	// Set up query parameters (release management API uses header for account, not query params)
	params := make(map[string]string)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	if searchTerm != "" {
		params["searchTerm"] = searchTerm
	}
	if len(status) > 0 {
		params["status"] = strings.Join(status, ",")
	}
	if page > 0 {
		params["page"] = fmt.Sprintf("%d", page)
	}
	if size > 0 {
		params["size"] = fmt.Sprintf("%d", size)
	}
	if sort != "" {
		params["sort"] = sort
	}

	headers := make(map[string]string)
	addHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.ReleaseApprovalsResponse)
	err := r.Client.Get(ctx, path, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to get release approvals: %w", err)
	}

	return result, nil
}

// GetReleasePhases fetches all phases for a specific release
func (r *ReleaseManagementService) GetReleasePhases(ctx context.Context, scope dto.Scope, releaseId string, status string) (*dto.PhasesExecutionResponse, error) {
	path := fmt.Sprintf(releaseExecutionPhasesPath, releaseId)

	// Set up query parameters (release management API uses header for account, not query params)
	params := make(map[string]string)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	if status != "" {
		params["status"] = status
	}

	headers := make(map[string]string)
	addHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.PhasesExecutionResponse)
	err := r.Client.Get(ctx, path, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to get release phases: %w", err)
	}

	return result, nil
}

// GetPhaseOutputs fetches outputs for a specific phase execution
func (r *ReleaseManagementService) GetPhaseOutputs(ctx context.Context, scope dto.Scope, releaseId string, phaseIdentifier string) (*dto.ExecutionOutputsResponse, error) {
	path := fmt.Sprintf(releaseExecutionPhaseOutputPath, releaseId, phaseIdentifier)

	// Set up query parameters (release management API uses header for account, not query params)
	params := make(map[string]string)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	headers := make(map[string]string)
	addHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.ExecutionOutputsResponse)
	err := r.Client.Get(ctx, path, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase outputs: %w", err)
	}

	return result, nil
}

// GetActivityOutputs fetches outputs for a specific activity execution
func (r *ReleaseManagementService) GetActivityOutputs(ctx context.Context, scope dto.Scope, releaseId string, phaseIdentifier string, activityIdentifier string) (*dto.ExecutionOutputsResponse, error) {
	path := fmt.Sprintf(releaseExecutionActivityOutputPath, releaseId, phaseIdentifier, activityIdentifier)

	// Set up query parameters (release management API uses header for account, not query params)
	params := make(map[string]string)
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	headers := make(map[string]string)
	addHarnessAccountToHeaders(ctx, scope, headers)

	// Make the request
	result := new(dto.ExecutionOutputsResponse)
	err := r.Client.Get(ctx, path, params, headers, result)
	if err != nil {
		return nil, fmt.Errorf("failed to get activity outputs: %w", err)
	}

	return result, nil
}
