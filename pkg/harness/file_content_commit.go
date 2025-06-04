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

// GetFileContentFromCommitTool creates a tool for retrieving file content from a specific commit
func GetFileContentFromCommitTool(config *config.Config, client *client.RepositoryService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_file_content_from_commit",
			mcp.WithDescription("Get file content from a specific commit in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("file_path",
				mcp.Required(),
				mcp.Description("The path to the file within the repository"),
			),
			mcp.WithString("commit_id",
				mcp.Required(),
				mcp.Description("The commit ID (SHA) to retrieve the file from"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			repoIdentifier, err := requiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			filePath, err := requiredParam[string](request, "file_path")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			commitID, err := requiredParam[string](request, "commit_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get scope
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create request object
			fileContentReq := &dto.FileContentRequest{
				Path:   filePath,
				GitRef: commitID,
			}

			// Call client method
			data, err := client.GetFileContent(ctx, scope, repoIdentifier, fileContentReq)
			if err != nil {
				return nil, fmt.Errorf("failed to get file content from commit: %w", err)
			}

			// Marshal the result
			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal file content: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
