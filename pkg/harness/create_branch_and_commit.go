package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// FileChangeInput represents a file change for the combined create branch and commit operation
type FileChangeInput struct {
	Action  string `json:"action"`
	Path    string `json:"path"`
	Content string `json:"content,omitempty"`
}

// CreateBranchAndCommitRequest represents the request body for creating a branch and committing changes
type CreateBranchAndCommitRequest struct {
	BranchName   string           `json:"branch_name"`
	BaseBranch   string           `json:"base_branch"`
	Title        string           `json:"title"`
	Message      string           `json:"message,omitempty"`
	FileChanges  []FileChangeInput `json:"file_changes"`
	BypassRules  bool             `json:"bypass_rules"`
}

// CreateBranchAndCommitTool creates a tool for creating a branch and committing changes in one operation
func CreateBranchAndCommitTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_branch_and_commit",
			mcp.WithDescription("Create a branch and commit multiple file changes in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("branch_name",
				mcp.Required(),
				mcp.Description("The name of the new branch to create"),
			),
			mcp.WithString("base_branch",
				mcp.DefaultString("master"),
				mcp.Description("The base branch from which to create the new branch"),
			),
			mcp.WithString("commit_title",
				mcp.Required(),
				mcp.Description("The title of the commit"),
			),
			mcp.WithString("commit_message",
				mcp.Description("Optional detailed commit message"),
			),
			mcp.WithArray("file_changes",
				mcp.Required(),
				mcp.Description("Array of file changes to commit"),
			),
			mcp.WithBoolean("bypass_rules",
				mcp.Description("Whether to bypass branch protection rules"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoIdentifier, err := requiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			branchName, err := requiredParam[string](request, "branch_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			baseBranch, err := OptionalParam[string](request, "base_branch")
			if err != nil || baseBranch == "" {
				baseBranch = "master"
			}

			commitTitle, err := requiredParam[string](request, "commit_title")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			commitMessage, _ := OptionalParam[string](request, "commit_message")
			bypassRules, _ := OptionalParam[bool](request, "bypass_rules")

			// Extract file changes
			fileChangesRaw, err := requiredParam[interface{}](request, "file_changes")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			
			fileChangesArray, ok := fileChangesRaw.([]interface{})
			if !ok {
				return mcp.NewToolResultError("file_changes must be an array"), nil
			}

			if len(fileChangesArray) == 0 {
				return mcp.NewToolResultError("file_changes cannot be empty"), nil
			}

			// Convert file changes to the expected format
			fileChanges := make([]FileChangeInput, 0, len(fileChangesArray))
			for _, changeRaw := range fileChangesArray {
				changeMap, ok := changeRaw.(map[string]interface{})
				if !ok {
					return mcp.NewToolResultError("each file change must be an object"), nil
				}

				action, ok := changeMap["action"].(string)
				if !ok || action == "" {
					return mcp.NewToolResultError("action is required for each file change"), nil
				}

				path, ok := changeMap["path"].(string)
				if !ok || path == "" {
					return mcp.NewToolResultError("path is required for each file change"), nil
				}

				content, _ := changeMap["content"].(string)

				fileChanges = append(fileChanges, FileChangeInput{
					Action:  action,
					Path:    path,
					Content: content,
				})
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Step 1: Create the branch
			createBranchRequestBody := map[string]interface{}{
				"name":         branchName,
				"target":       fmt.Sprintf("refs/heads/%s", baseBranch),
				"bypass_rules": bypassRules,
			}

			branchURL := fmt.Sprintf("%sgateway/code/api/v1/repos/%s/%s/%s/%s/+/branches?routingId=%s",
				config.BaseURL, config.AccountID, scope.OrgID, scope.ProjectID, repoIdentifier, config.AccountID)

			// Make HTTP request to create branch
			branchResult, err := makeAPIRequest(ctx, http.MethodPost, branchURL, createBranchRequestBody, config.APIKey)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to create branch: %s", err.Error())), nil
			}

			// Step 2: Convert file changes to the format expected by commit_changes
			commitFileChanges := make([]FileChange, 0, len(fileChanges))
			for _, change := range fileChanges {
				commitFileChanges = append(commitFileChanges, FileChange{
					Action:  change.Action,
					Path:    change.Path,
					Payload: change.Content,
				})
			}

			// Step 3: Commit the changes
			commitRequest := CommitRequest{
				Actions:     commitFileChanges,
				Branch:      branchName,
				Title:       commitTitle,
				Message:     commitMessage,
				BypassRules: bypassRules,
			}

			commitURL := fmt.Sprintf("%sgateway/code/api/v1/repos/%s/%s/%s/%s/+/commits?routingId=%s",
				config.BaseURL, config.AccountID, scope.OrgID, scope.ProjectID, repoIdentifier, config.AccountID)

			// Make HTTP request to commit changes
			commitResult, err := makeAPIRequest(ctx, http.MethodPost, commitURL, commitRequest, config.APIKey)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to commit changes: %s", err.Error())), nil
			}

			// Combine results
			result := map[string]interface{}{
				"branch_creation": branchResult,
				"commit_result":   commitResult,
			}

			resultBytes, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal combined result: %w", err)
			}

			return mcp.NewToolResultText(string(resultBytes)), nil
		}
}

// makeAPIRequest is a helper function to make HTTP requests to the Harness API
func makeAPIRequest(ctx context.Context, method, url string, body interface{}, apiKey string) (map[string]interface{}, error) {
	client := &http.Client{}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("request failed with status code %d", resp.StatusCode)
	}

	var responseData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return responseData, nil
}
