package client

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	logDownloadPath     = "log-service/blob/download"
	logServiceTokenPath = "gateway/log-service/token"
	logServiceBlobPath  = "gateway/log-service/blob"
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

// GetLogServiceToken retrieves a token for accessing the log serviceAdd commentMore actions
func (l *LogService) GetLogServiceToken(ctx context.Context, accountID string) (string, error) {
	// Prepare query parameters
	params := make(map[string]string)
	params["accountID"] = accountID

	// Create URL with parameters
	url := *l.Client.BaseURL
	url.Path = logServiceTokenPath
	q := url.Query()
	for k, v := range params {
		q.Add(k, v)
	}
	url.RawQuery = q.Encode()

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url.String(), nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Add auth header using the auth provider
	k, v, err := l.Client.AuthProvider.GetHeader(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get auth header: %w", err)
	}
	req.Header.Set(k, v)

	// Make the request
	resp, err := l.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get log service token: %w", err)
	}
	defer resp.Body.Close()

	// Read the raw response body
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	tokenString := string(body)
	if err != nil {
		return "", fmt.Errorf("failed to get log service token: %w", err)
	}

	return tokenString, nil
}

// GetStepLogs retrieves logs for a specific step using the log key
func (l *LogService) GetStepLogs(ctx context.Context, accountID, orgID, projectID, pipelineID, logKey, token string) (string, error) {
	// The log service uses a different authentication mechanism with a token
	// rather than the API key, so we need to construct the URL and make the request manually
	baseURL := l.Client.BaseURL.String()
	logURL, err := url.Parse(fmt.Sprintf("%s/%s", baseURL, logServiceBlobPath))
	if err != nil {
		return "", fmt.Errorf("failed to parse log URL: %w", err)
	}

	// Add query parameters
	query := logURL.Query()
	query.Add("accountID", accountID)
	query.Add("orgId", orgID)
	query.Add("projectId", projectID)
	query.Add("pipelineId", pipelineID)
	query.Add("X-Harness-Token", token)
	query.Add("key", logKey)
	logURL.RawQuery = query.Encode()

	// Make the HTTP request
	resp, err := http.Get(logURL.String())
	if err != nil {
		return "", fmt.Errorf("failed to get logs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// Read the response body
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	return string(body), nil
}
