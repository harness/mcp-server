package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os/exec"
	"regexp"
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"log/slog"
)

// GitInfo contains Git repository information
type GitInfo struct {
	RepoURL    string
	Branch     string
	CommitHash string
}

// GetPipelineFailureLogsTool creates a tool for retrieving failure logs from pipeline executions
func GetPipelineFailureLogsTool(config *config.Config, logClient *client.LogService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pipeline_failure_logs",
			mcp.WithDescription("Retrieves failure logs from Harness pipeline executions with Git context"),
			mcp.WithString("workspace_path",
				mcp.Description("Workspace path to extract Git context from"),
			),
			mcp.WithString("execution_id",
				mcp.Description("Optional: Specific execution ID to get logs for"),
			),
			mcp.WithString("execution_url",
				mcp.Description("Optional: Direct Harness pipeline execution URL"),
			),
			mcp.WithNumber("max_pages",
				mcp.Description("Optional: Maximum number of pages to search through (default: 20)"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			executionID, err := OptionalParam[string](request, "execution_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			executionURL, err := OptionalParam[string](request, "execution_url")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			workspacePath, err := OptionalParam[string](request, "workspace_path")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			maxPages, err := OptionalIntParamWithDefault(request, "max_pages", 20)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create base scope from config (will be overridden if URL provides values)
			urlScope := &dto.Scope{}
			
			// Extract data from URL if provided
			if executionURL != "" {
				// Parse URL to extract scope and execution ID
				extractedScope, parsedID, err := extractScopeFromURL(executionURL)
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("Failed to extract information from URL: %v", err)), nil
				}
				
				// Set execution ID if not already provided
				if executionID == "" {
					executionID = parsedID
				}
				
				// Store extracted scope
				urlScope = extractedScope
			}

			var gitInfo *GitInfo
			if workspacePath != "" {
				gitInfo, err = extractGitInfo(workspacePath)
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("Failed to extract Git info: %v", err)), nil
				}
			}

			// Create clients for the required services
			pipelineClient := &client.PipelineService{Client: logClient.Client}
			
			// Merge scope values - Only use org and project from URL, as PAT is account-specific
			requestScope := scope
			// Do NOT override the account ID from config as the PAT is account-specific
			// We ignore urlScope.AccountID even if it's present
			
			// Use org ID from URL if available
			if urlScope.OrgID != "" {
				slog.Info("Using org ID from URL", "orgID", urlScope.OrgID)
				requestScope.OrgID = urlScope.OrgID
			}
			
			// Use project ID from URL if available
			if urlScope.ProjectID != "" {
				slog.Info("Using project ID from URL", "projectID", urlScope.ProjectID)
				requestScope.ProjectID = urlScope.ProjectID
			}

			failureResponse := &dto.FailureLogResponse{}
			if executionID != "" {
				// If execution ID is provided (directly or from URL), get logs directly for that execution
				failureResponse, err = getFailureLogsForExecution(ctx, pipelineClient, logClient, requestScope, executionID)
				if err != nil {
					// Format error in a clean, readable way
					errorMsg := fmt.Sprintf("Couldn't fetch details for execution %s, ERROR: %v", 
						executionID, err)
					return mcp.NewToolResultError(errorMsg), nil
				}
			} else if gitInfo != nil {
				// Otherwise, search for matching executions
				failureResponse, err = findMatchingExecutionAndGetLogs(ctx, pipelineClient, logClient, requestScope, gitInfo, maxPages)
				if err != nil {
					// Format error in a clean, readable way
					errorMsg := fmt.Sprintf("Couldn't find matching executions for git repo %s, ERROR: %v", 
						gitInfo.RepoURL, err)
					return mcp.NewToolResultError(errorMsg), nil
				}
			} else {
				return mcp.NewToolResultError("Either execution_id, execution_url, or workspace_path must be provided"), nil
			}

			// Marshal the response to JSON
			responseJSON, err := json.MarshalIndent(failureResponse, "", "  ")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(responseJSON)), nil
		}
}

// extractGitInfo extracts Git repository information from a workspace path
func extractGitInfo(workspacePath string) (*GitInfo, error) {
	// Function to run git commands
	runGitCommand := func(args ...string) (string, error) {
		cmd := exec.Command("git", args...)
		cmd.Dir = workspacePath
		output, err := cmd.Output()
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(output)), nil
	}

	// Get repo URL
	repoURL, err := runGitCommand("config", "--get", "remote.origin.url")
	if err != nil {
		return nil, fmt.Errorf("failed to get repo URL: %w", err)
	}

	// Get branch name
	branch, err := runGitCommand("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return nil, fmt.Errorf("failed to get branch name: %w", err)
	}

	// Get commit hash
	commitHash, err := runGitCommand("rev-parse", "HEAD")
	if err != nil {
		return nil, fmt.Errorf("failed to get commit hash: %w", err)
	}

	return &GitInfo{
		RepoURL:    normalizeGitURL(repoURL),
		Branch:     branch,
		CommitHash: commitHash,
	}, nil
}

// normalizeGitURL normalizes Git URLs for comparison
func normalizeGitURL(url string) string {
	// Remove .git suffix if present
	url = strings.TrimSuffix(url, ".git")

	// Convert SSH URLs to HTTPS format
	sshPattern := regexp.MustCompile(`^git@([^:]+):(.+)$`)
	if matches := sshPattern.FindStringSubmatch(url); len(matches) == 3 {
		url = fmt.Sprintf("https://%s/%s", matches[1], matches[2])
	}

	return url
}

// extractScopeFromURL extracts account, org, project, and execution IDs from a Harness pipeline URL
func extractScopeFromURL(executionURL string) (*dto.Scope, string, error) {
	if executionURL == "" {
		return nil, "", fmt.Errorf("empty execution URL provided")
	}

	// Parse the URL
	parsedURL, err := url.Parse(executionURL)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse URL: %v", err)
	}

	// Check if it's a valid Harness URL (any subdomain of harness.io)
	if !strings.HasSuffix(parsedURL.Host, "harness.io") {
		return nil, "", fmt.Errorf("not a valid Harness execution URL: %s", executionURL)
	}

	// Initialize scope
	scope := &dto.Scope{}
	
	// Extract path segments
	pathSegments := strings.Split(parsedURL.Path, "/")
	
	// Extract execution ID
	executionID := ""
	for i, segment := range pathSegments {
		// Extract account ID (follows "account" segment)
		if segment == "account" && i+1 < len(pathSegments) {
			scope.AccountID = pathSegments[i+1]
		}
		
		// Extract org ID (follows "orgs" segment)
		if segment == "orgs" && i+1 < len(pathSegments) {
			scope.OrgID = pathSegments[i+1]
		}
		
		// Extract project ID (follows "projects" segment)
		if segment == "projects" && i+1 < len(pathSegments) {
			scope.ProjectID = pathSegments[i+1]
		}
		
		// Extract execution ID (follows "executions" or "deployments" segment)
		if (segment == "executions" || segment == "deployments") && i+1 < len(pathSegments) {
			executionID = pathSegments[i+1]
		}
	}

	// Check for execution ID in query parameters if not found in path
	if executionID == "" {
		queryParams := parsedURL.Query()
		if id := queryParams.Get("executionId"); id != "" {
			executionID = id
		}
	}

	// Validate we found the execution ID
	if executionID == "" {
		return nil, "", fmt.Errorf("could not extract execution ID from URL: %s", executionURL)
	}

	return scope, executionID, nil
}

// findMatchingExecutionAndGetLogs finds executions that match the Git context and returns failure logs
func findMatchingExecutionAndGetLogs(ctx context.Context, pipelineClient *client.PipelineService, logClient *client.LogService, scope dto.Scope, gitInfo *GitInfo, maxPages int) (*dto.FailureLogResponse, error) {
	// Start with a small page size to quickly find recent failures
	pageSize := 5
	seenExecutions := make(map[string]bool)

	for page := 0; page < maxPages; page++ {
		// List pipeline executions with pagination
		opts := &dto.PipelineExecutionOptions{
			PaginationOptions: dto.PaginationOptions{
				Page: page,
				Size: pageSize,
			},
		}

		executions, err := pipelineClient.ListExecutions(ctx, scope, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list executions: %w", err)
		}

		// No more executions to process
		if len(executions.Data.Content) == 0 {
			break
		}

		// Check each execution for matching Git context
		for _, execution := range executions.Data.Content {
			// Skip if we've already checked this execution
			if seenExecutions[execution.PlanExecutionId] {
				continue
			}
			seenExecutions[execution.PlanExecutionId] = true

			if isMatchingExecution(execution, gitInfo) {
				return getFailureLogsForExecution(ctx, pipelineClient, logClient, scope, execution.PlanExecutionId)
			}
		}

		// If we've seen all available pages, stop
		if executions.Data.Last || len(executions.Data.Content) < pageSize {
			break
		}

		// Increase page size for subsequent requests to reduce API calls
		if page == 0 {
			pageSize = 20
		}
	}

	return nil, fmt.Errorf("no matching failed execution found after checking %d pages", maxPages)
}

// isMatchingExecution checks if an execution matches the given Git info
func isMatchingExecution(execution dto.PipelineExecution, gitInfo *GitInfo) bool {
	// Skip non-failed executions
	if execution.Status != "Failed" {
		return false
	}

	// Extract CI module info
	ciInfo, ok := execution.ModuleInfo["ci"]
	if !ok {
		return false
	}

	ciMap, ok := ciInfo.(map[string]interface{})
	if !ok {
		return false
	}

	// Get SCM details
	scmDetailsList, ok := ciMap["scmDetailsList"].([]interface{})
	if !ok || len(scmDetailsList) == 0 {
		return false
	}

	// Get first SCM details
	scmDetails, ok := scmDetailsList[0].(map[string]interface{})
	if !ok {
		return false
	}

	// Get SCM URL
	scmURL, ok := scmDetails["scmUrl"].(string)
	if !ok || scmURL == "" {
		return false
	}

	// Normalize both URLs for comparison
	normScmURL := normalizeGitURL(scmURL)
	normRepoURL := normalizeGitURL(gitInfo.RepoURL)

	// Check if the repository URL is a substring match
	// This handles cases where URLs might have different schemes or .git suffix
	return strings.Contains(normScmURL, normRepoURL) ||
		strings.Contains(normRepoURL, normScmURL) ||
		strings.HasSuffix(normScmURL, "/"+normRepoURL) ||
		strings.HasSuffix(normRepoURL, "/"+normScmURL)
}

// getFailureLogsForExecution retrieves failure logs for a specific execution
func getFailureLogsForExecution(ctx context.Context, pipelineClient *client.PipelineService, logClient *client.LogService, scope dto.Scope, executionID string) (*dto.FailureLogResponse, error) {
	// Get execution details
	execution, err := pipelineClient.GetExecution(ctx, scope, executionID)
	if err != nil {
		// Extract status code if available in the error message
		statusCode := ""
		if strings.Contains(err.Error(), "status code 403") {
			statusCode = "403"
		} else if strings.Contains(err.Error(), "status code 401") {
			statusCode = "401"
		} else if strings.Contains(err.Error(), "status code 404") {
			statusCode = "404"
		}
		
		if statusCode != "" {
			return nil, fmt.Errorf("%s: %w", statusCode, err)
		}
		return nil, fmt.Errorf("failed to get execution details: %w", err)
	}

	// Check if execution is failed
	if execution.Data.Status != "Failed" {
		return nil, fmt.Errorf("execution is not in Failed state: %s", execution.Data.Status)
	}

	// Get execution graph for more details
	graph, err := pipelineClient.GetExecutionGraph(ctx, scope, executionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution graph: %w", err)
	}

	// Extract failed nodes and log keys
	var failedNodes []dto.FailedNodeInfo
	for nodeID, node := range graph.NodeMap {
		if node.Status == "Failed" {
			failureMessage := ""
			// Extract failure message if available
			if stepParams, ok := node.StepParameters["failureInfo"].(map[string]interface{}); ok {
				if message, ok := stepParams["message"].(string); ok {
					failureMessage = message
				}
			}

			// Extract step and stage IDs
			stageID := ""
			stepID := ""
			if baseFqn := strings.Split(node.BaseFqn, "."); len(baseFqn) > 2 {
				stageID = baseFqn[2]
			}
			stepID = node.Identifier

			failedNodes = append(failedNodes, dto.FailedNodeInfo{
				NodeID:         nodeID,
				StageID:        stageID,
				StepID:         stepID,
				FailureMessage: failureMessage,
			})
		}
	}

	// Extract Git context
	gitContext := extractGitContextFromExecution(execution.Data)

	// Get log service token
	token, err := logClient.GetLogServiceToken(ctx, scope.AccountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get log service token: %w", err)
	}

	// Prepare response
	response := &dto.FailureLogResponse{
		PipelineID:  execution.Data.PipelineIdentifier,
		ExecutionID: executionID,
		Status:      execution.Data.Status,
		GitContext:  gitContext,
		Failures:    []dto.FailureDetails{},
	}

	// Get logs for each failed node
	for _, failedNode := range failedNodes {
		node := graph.NodeMap[failedNode.NodeID]

		// Get log key - first try from executable responses, then fall back to logBaseKey
		var logKey string
		if len(node.ExecutableResponses) > 0 && len(node.ExecutableResponses[0].Async.LogKeys) > 0 {
			// Get the first log key
			for _, key := range node.ExecutableResponses[0].Async.LogKeys {
				logKey = key
				break
			}
		}

		// Fall back to logBaseKey if executable responses don't have log keys
		if logKey == "" && node.LogBaseKey != "" {
			logKey = node.LogBaseKey
		}

		if logKey == "" {
			// No log key found, skip this node
			continue
		}

		// Get logs
		logs, err := logClient.GetStepLogs(
			ctx,
			scope.AccountID,
			execution.Data.OrgIdentifier,
			execution.Data.ProjectIdentifier,
			execution.Data.PipelineIdentifier,
			logKey,
			token,
		)
		if err != nil {
			slog.Warn("Failed to get logs for node", "nodeID", failedNode.NodeID, "error", err)
			continue
		}

		// Format logs
		formattedLogs := formatLogs(logs)

		// Add to response
		response.Failures = append(response.Failures, dto.FailureDetails{
			Stage:   failedNode.StageID,
			Step:    failedNode.StepID,
			Message: failedNode.FailureMessage,
			Logs:    formattedLogs,
		})
	}

	return response, nil
}

// extractGitContextFromExecution extracts Git context from execution data
func extractGitContextFromExecution(execution dto.PipelineExecution) dto.GitContext {
	gitContext := dto.GitContext{}

	// Extract CI module info if available
	ciInfo, ok := execution.ModuleInfo["ci"]
	if !ok {
		return gitContext
	}

	// Extract data from the CI module info map
	ciMap, ok := ciInfo.(map[string]interface{})
	if !ok {
		return gitContext
	}

	// Try to get branch, tag and repo name
	if branch, ok := ciMap["branch"].(string); ok {
		gitContext.Branch = branch
	}
	if tag, ok := ciMap["tag"].(string); ok {
		gitContext.Tag = tag
	}

	// Try to get commit info from ciExecutionInfoDTO
	ciExecutionInfo, ok := ciMap["ciExecutionInfoDTO"].(map[string]interface{})
	if ok {
		branchInfo, ok := ciExecutionInfo["branch"].(map[string]interface{})
		if ok {
			commits, ok := branchInfo["commits"].([]interface{})
			if ok && len(commits) > 0 {
				commit, ok := commits[0].(map[string]interface{})
				if ok {
					if commitHash, ok := commit["id"].(string); ok {
						gitContext.CommitHash = commitHash
					}
					if commitMsg, ok := commit["message"].(string); ok {
						gitContext.CommitMessage = commitMsg
					}
				}
			}
		}
	}

	// Try to get repo URL
	scmDetailsList, ok := ciMap["scmDetailsList"].([]interface{})
	if ok && len(scmDetailsList) > 0 {
		scmDetails, ok := scmDetailsList[0].(map[string]interface{})
		if ok {
			if scmURL, ok := scmDetails["scmUrl"].(string); ok {
				gitContext.RepoURL = scmURL
			}
		}
	}

	return gitContext
}

// formatLogs formats the raw logs for better readability
func formatLogs(rawLogs string) string {
	// Remove ANSI color codes
	ansiPattern := regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)
	logs := ansiPattern.ReplaceAllString(rawLogs, "")

	// Try to parse as JSON log entries
	var formattedLogs strings.Builder
	lines := strings.Split(logs, "\n")

	for _, line := range lines {
		if line == "" {
			continue
		}

		// Try to parse as JSON
		var logEntry struct {
			Level string `json:"level"`
			Pos   int    `json:"pos"`
			Out   string `json:"out"`
			Time  string `json:"time"`
		}

		if err := json.Unmarshal([]byte(line), &logEntry); err == nil && logEntry.Out != "" {
			// Format as timestamp + message
			formattedLogs.WriteString(fmt.Sprintf("[%s] %s", logEntry.Time, logEntry.Out))
			formattedLogs.WriteString("\n")
		} else {
			// Just include the line as is
			formattedLogs.WriteString(line)
			formattedLogs.WriteString("\n")
		}
	}

	return formattedLogs.String()
}
