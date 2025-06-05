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

// CreateBranchTool creates a tool for creating a new branch in a repository
func CreateBranchTool(config *config.Config) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_branch",
			mcp.WithDescription("Create a new branch in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("branch_name",
				mcp.Required(),
				mcp.Description("The name of the new branch to create"),
			),
			mcp.WithString("target_branch",
				mcp.DefaultString("master"),
				mcp.Description("The target branch from which to create the new branch"),
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

			targetBranch, err := OptionalParam[string](request, "target_branch")
			if err != nil || targetBranch == "" {
				targetBranch = "master"
			}

			bypassRules, _ := OptionalParam[bool](request, "bypass_rules")

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create request body
			requestBody := map[string]interface{}{
				"name":         branchName,
				"target":       fmt.Sprintf("refs/heads/%s", targetBranch),
				"bypass_rules": bypassRules,
			}

			// Build URL
			url := fmt.Sprintf("%sgateway/code/api/v1/repos/%s/%s/%s/%s/+/branches?routingId=%s",
				config.BaseURL, config.AccountID, scope.OrgID, scope.ProjectID, repoIdentifier, config.AccountID)

			// Make HTTP request
			client := &http.Client{}
			bodyBytes, err := json.Marshal(requestBody)
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
				return nil, fmt.Errorf("failed to create branch: received status code %d", resp.StatusCode)
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
