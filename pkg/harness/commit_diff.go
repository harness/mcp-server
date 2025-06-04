package harness

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetCommitDiffTool creates a tool for retrieving the diff of a specific commit
func GetCommitDiffTool(appConfig *config.Config, harnessClient *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_commit_diff",
			mcp.WithDescription("Get the diff for a specific commit in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("commit_id",
				mcp.Required(),
				mcp.Description("The commit ID (SHA) to retrieve the diff for"),
			),
			WithScope(appConfig, true), // Indicates org_id, project_id are parameters, account_id from config
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			repoIdentifier, err := requiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			commitID, err := requiredParam[string](request, "commit_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID, err := OptionalParam[string](request, "org_id")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Error parsing org_id: %v", err.Error())), nil
			}
			if orgID == "" {
				orgID = appConfig.DefaultOrgID
			}
			if orgID == "" {
				return mcp.NewToolResultError("Organization ID (org_id) is required but not provided and no default is set."), nil
			}

			projectID, err := OptionalParam[string](request, "project_id")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Error parsing project_id: %v", err.Error())), nil
			}
			if projectID == "" {
				projectID = appConfig.DefaultProjectID
			}
			if projectID == "" {
				return mcp.NewToolResultError("Project ID (project_id) is required but not provided and no default is set."), nil
			}

			accountID := appConfig.AccountID
			if accountID == "" {
				return mcp.NewToolResultError("Harness Account ID (HARNESS_ACCOUNT_ID) not configured in the MCP server environment."), nil
			}

			// Construct the URL path
			// Example: /gateway/code/api/v1/repos/{account_id}/{org_id}/{project_id}/{repo_identifier}/+/commits/{commit_id}/diff
			relativePath := fmt.Sprintf("/gateway/code/api/v1/repos/%s/%s/%s/%s/+/commits/%s/diff",
				accountID,
				orgID,
				projectID,
				repoIdentifier,
				commitID,
			)

			url := strings.TrimSuffix(harnessClient.BaseURL.String(), "/") + relativePath

			req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to create request: %w", err)
			}

			// Add routingId query parameter
			q := req.URL.Query()
			q.Add("routingId", accountID)
			req.URL.RawQuery = q.Encode()

			// Set headers
			req.Header.Set("Accept", "text/plain")

			authHeaderKey, authHeaderValue, err := harnessClient.AuthProvider.GetHeader(ctx)
			if err != nil {
				return nil, fmt.Errorf("failed to get auth header: %w", err)
			}
			req.Header.Set(authHeaderKey, authHeaderValue)

			resp, err := harnessClient.Do(req) // Use the Do method of client.Client
			if err != nil {
				return nil, fmt.Errorf("failed to execute request: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				bodyBytes, _ := io.ReadAll(resp.Body)
				return nil, fmt.Errorf("API request to %s failed with status %s: %s", url, resp.Status, string(bodyBytes))
			}

			diffBytes, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, fmt.Errorf("failed to read response body: %w", err)
			}

			return mcp.NewToolResultText(string(diffBytes)), nil
		}
}
