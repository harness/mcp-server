package harness

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetRepoFileContentTool creates a tool for getting content of a specific file from a repository
func GetRepoFileContentTool(config *config.Config, client *client.RepoFilesService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_repo_file_content",
			mcp.WithDescription("Get content of a specific file from a Harness repository."),
			mcp.WithString("repo_id",
				mcp.Required(),
				mcp.Description("The ID of the repository"),
			),
			mcp.WithString("file_path",
				mcp.Required(),
				mcp.Description("The path to the file within the repository"),
			),
			mcp.WithString("git_ref",
				mcp.Description("The git reference (branch / tag / commitID) to retrieve the file from. If not provided, the default branch is used."),
			),
			mcp.WithBoolean("include_commit",
				mcp.Description("Whether to include commit information in the response"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoID, err := requiredParam[string](request, "repo_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			filePath, err := requiredParam[string](request, "file_path")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.RepoFileContentOptions{}

			if gitRef, ok := request.Params.Arguments["git_ref"].(string); ok && gitRef != "" {
				opts.GitRef = gitRef
			}

			if includeCommit, ok := request.Params.Arguments["include_commit"].(bool); ok {
				opts.IncludeCommit = includeCommit
			}

			data, err := client.GetContent(ctx, scope, repoID, filePath, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to get repository file content: %w", err)
			}

			result := map[string]interface{}{
				"path":     data.Path,
				"content":  data.Content.Data,
				"encoding": data.Content.Encoding,
				"size":     data.Content.Size,
			}

			if data.SHA != "" {
				result["commit_sha"] = data.SHA
			}

			jsonResult, err := json.Marshal(result)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			return mcp.NewToolResultText(string(jsonResult)), nil
		}
}
