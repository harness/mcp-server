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

// FileChange represents a change to a file in a commit
type FileChange struct {
	Action  string `json:"action"`
	Path    string `json:"path"`
	Payload string `json:"payload,omitempty"`
	Sha     string `json:"sha,omitempty"`
}

// CommitRequest represents the request body for committing changes
type CommitRequest struct {
	Actions     []FileChange `json:"actions"`
	Branch      string       `json:"branch"`
	NewBranch   string       `json:"new_branch"`
	Title       string       `json:"title"`
	Message     string       `json:"message"`
	BypassRules bool         `json:"bypass_rules"`
}

// CommitChangesTool creates a tool for committing changes to files in a repository
func CommitChangesTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("commit_changes",
			mcp.WithDescription("Commit changes to files in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("branch",
				mcp.Required(),
				mcp.Description("The branch to commit changes to"),
			),
			mcp.WithString("new_branch",
				mcp.Description("Optional new branch to create for this commit. Leave empty to commit to existing branch."),
			),
			mcp.WithString("title",
				mcp.Required(),
				mcp.Description("The title of the commit"),
			),
			mcp.WithString("message",
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

			branch, err := requiredParam[string](request, "branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			title, err := requiredParam[string](request, "title")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			newBranch, _ := OptionalParam[string](request, "new_branch")
			message, _ := OptionalParam[string](request, "message")
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
			fileChanges := make([]FileChange, 0, len(fileChangesArray))
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

				payload, _ := changeMap["payload"].(string)
				sha, _ := changeMap["sha"].(string)

				fileChanges = append(fileChanges, FileChange{
					Action:  action,
					Path:    path,
					Payload: payload,
					Sha:     sha,
				})
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create request body
			commitRequest := CommitRequest{
				Actions:     fileChanges,
				Branch:      branch,
				NewBranch:   newBranch,
				Title:       title,
				Message:     message,
				BypassRules: bypassRules,
			}

			// Build URL
			url := fmt.Sprintf("%sgateway/code/api/v1/repos/%s/%s/%s/%s/+/commits?routingId=%s",
				config.BaseURL, config.AccountID, scope.OrgID, scope.ProjectID, repoIdentifier, config.AccountID)

			// Make HTTP request
			client := &http.Client{}
			bodyBytes, err := json.Marshal(commitRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}

			req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(bodyBytes)))
			if err != nil {
				return nil, fmt.Errorf("failed to create request: %w", err)
			}

			req.Header.Set("Content-Type", "application/json")
			// Add auth header from config
			if config.APIKey != "" {
				req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))
			}

			resp, err := client.Do(req)
			if err != nil {
				return nil, fmt.Errorf("failed to execute request: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
				return nil, fmt.Errorf("failed to commit changes: received status code %d", resp.StatusCode)
			}

			var responseData map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
				return nil, fmt.Errorf("failed to decode response: %w", err)
			}

			r, err := json.Marshal(responseData)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
