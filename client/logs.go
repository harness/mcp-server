package client

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	logDownloadPath = "/blob/download"
	logTokenPath    = "/token"
)

// LogService handles operations related to pipeline logs
type LogService struct {
	LogServiceClient *Client
	PipelineClient   *Client
}

// GetDownloadLogsURL fetches a download URL for pipeline execution logs
// If logKey is not empty, it will use that log key to fetch logs instead of building one from execution details
// If token is not empty, it will be passed as X-Harness-Token header
func (l *LogService) GetDownloadLogsURL(ctx context.Context, scope dto.Scope, planExecutionID string, logKey string, token string) (string, error) {
	// Use custom log key if provided, otherwise build it from execution details
	var finalLogKey string
	var err error
	if logKey != "" {
		slog.InfoContext(ctx, "Using custom log key for log download", "logKey", logKey)
		finalLogKey = logKey
	} else {
		slog.InfoContext(ctx, "Building log key for log download from execution details")
		// First, get the pipeline execution details to determine the prefix format
		pipelineService := &PipelineService{Client: l.PipelineClient} // TODO: needs to be changed for internal case, we should move this above
		execution, err := pipelineService.GetExecutionWithLogKeys(ctx, scope, planExecutionID, "", "")
		if err != nil {
			return "", fmt.Errorf("failed to get execution details: %w", err)
		}

		// Build the log key based on the execution details
		if execution.Data.Execution.ShouldUseSimplifiedBaseKey {
			// Simplified key format
			finalLogKey = fmt.Sprintf("%s/pipeline/%s/%d/-%s",
				scope.AccountID,
				execution.Data.Execution.PipelineIdentifier,
				execution.Data.Execution.RunSequence,
				planExecutionID)
		} else {
			// Standard key format
			finalLogKey = fmt.Sprintf("accountId:%s/orgId:%s/projectId:%s/pipelineId:%s/runSequence:%d/level0:pipeline",
				scope.AccountID,
				execution.Data.Execution.OrgIdentifier,
				execution.Data.Execution.ProjectIdentifier,
				execution.Data.Execution.PipelineIdentifier,
				execution.Data.Execution.RunSequence)
		}
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountID"] = scope.AccountID
	params["prefix"] = finalLogKey

	// Prepare headers
	headers := make(map[string]string)
	if token != "" {
		headers["X-Harness-Token"] = token
	}

	// Initialize the response object
	response := &dto.LogDownloadResponse{}

	// Make the POST request with retry logic
	maxAttempts := 3
	timeBetweenAttempts := 3 * time.Second
	successObtained := false
	var lastErr error

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		response = &dto.LogDownloadResponse{}
		err = l.LogServiceClient.Post(ctx, logDownloadPath, params, nil, headers, response)
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

// GetLogToken fetches a log service token for the given account ID
func (l *LogService) GetLogToken(ctx context.Context, accountID string) (string, error) {
	if accountID == "" {
		return "", fmt.Errorf("accountID cannot be empty")
	}

	// Prepare query parameters
	params := make(map[string]string)
	params["accountID"] = accountID

	// The response is a raw token string, not JSON
	var token string

	// Make the GET request
	err := l.LogServiceClient.Get(ctx, logTokenPath, params, map[string]string{}, &token)
	if err != nil {
		return "", fmt.Errorf("failed to fetch log token: %w", err)
	}
	return token, nil
}
