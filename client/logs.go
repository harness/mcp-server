package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	logDownloadPath = "log-service/blob/download"
)

// LogService handles operations related to pipeline logs
type LogService struct {
	Client *Client
}

// DownloadLogs fetches a download URL for pipeline execution logs
func (l *LogService) DownloadLogs(ctx context.Context, scope dto.Scope, planExecutionID string) (string, error) {
	// First, get the pipeline execution details to determine the prefix format
	pipelineService := &PipelineService{Client: l.Client} // TODO: needs to be changed for internal case, we should move this above
	execution, err := pipelineService.GetExecution(ctx, scope, planExecutionID)
	if err != nil {
		return "", fmt.Errorf("failed to get execution details: %w", err)
	}

	// Build the prefix based on the execution details
	var prefix string
	if execution.Data.ShouldUseSimplifiedBaseKey {
		// Simplified key format
		prefix = fmt.Sprintf("%s/pipeline/%s/%d/-%s",
			scope.AccountID,
			execution.Data.PipelineIdentifier,
			execution.Data.RunSequence,
			planExecutionID)
	} else {
		// Standard key format
		prefix = fmt.Sprintf("accountId:%s/orgId:%s/projectId:%s/pipelineId:%s/runSequence:%d/level0:pipeline",
			scope.AccountID,
			execution.Data.OrgIdentifier,
			execution.Data.ProjectIdentifier,
			execution.Data.PipelineIdentifier,
			execution.Data.RunSequence)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountID"] = scope.AccountID
	params["prefix"] = prefix

	// Initialize the response object
	response := &dto.LogDownloadResponse{}

	// Make the POST request
	err = l.Client.Post(ctx, logDownloadPath, params, nil, response)
	if err != nil {
		return "", fmt.Errorf("failed to fetch log download URL: %w", err)
	}

	return response.Link, nil
}
