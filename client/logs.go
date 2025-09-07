package client

import (
	"context"
	"fmt"
	"time"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	logDownloadPath = "/blob/download"
)

// LogService handles operations related to pipeline logs
type LogService struct {
	LogServiceClient *Client
	PipelineClient   *Client
}

// DownloadLogs fetches a download URL for pipeline execution logs
func (l *LogService) DownloadLogs(ctx context.Context, scope dto.Scope, planExecutionID string) (string, error) {
	// First, get the pipeline execution details to determine the prefix format
	pipelineService := &PipelineService{Client: l.PipelineClient} // TODO: needs to be changed for internal case, we should move this above
	execution, err := pipelineService.GetExecutionWithLogKeys(ctx, scope, planExecutionID, "")
	if err != nil {
		return "", fmt.Errorf("failed to get execution details: %w", err)
	}

	// Build the prefix based on the execution details
	var prefix string
	if execution.Data.Execution.ShouldUseSimplifiedBaseKey {
		// Simplified key format
		prefix = fmt.Sprintf("%s/pipeline/%s/%d/-%s",
			scope.AccountID,
			execution.Data.Execution.PipelineIdentifier,
			execution.Data.Execution.RunSequence,
			planExecutionID)
	} else {
		// Standard key format
		prefix = fmt.Sprintf("accountId:%s/orgId:%s/projectId:%s/pipelineId:%s/runSequence:%d/level0:pipeline",
			scope.AccountID,
			execution.Data.Execution.OrgIdentifier,
			execution.Data.Execution.ProjectIdentifier,
			execution.Data.Execution.PipelineIdentifier,
			execution.Data.Execution.RunSequence)
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountID"] = scope.AccountID
	params["prefix"] = prefix

	// Initialize the response object
	response := &dto.LogDownloadResponse{}

	// Make the POST request with retry logic
	maxAttempts := 3
	timeBetweenAttempts := 3 * time.Second
	successObtained := false
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		response = &dto.LogDownloadResponse{}
		err = l.LogServiceClient.Post(ctx, logDownloadPath, params, nil, map[string]string{}, response)
		if err != nil {
			lastErr = fmt.Errorf("failed to fetch log download URL (attempt %d): %w", attempt, err)
			if attempt == maxAttempts {
				break
			}
			time.Sleep(timeBetweenAttempts)
			continue
		}

		if response.Status == "success" {
			successObtained = true
			break
		}

		if attempt == maxAttempts {
			lastErr = fmt.Errorf("status did not become success after %d attempts, last status: %s", maxAttempts, response.Status)
			break
		}

		time.Sleep(timeBetweenAttempts)
	}

	if !successObtained {
		return "", lastErr
	}

	return response.Link, nil
}
