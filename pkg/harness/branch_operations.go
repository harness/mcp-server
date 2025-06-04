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

// CreateBranchOperationTool creates a tool for creating a new branch in a repository
func CreateBranchOperationTool(config *config.Config, client *client.BranchOperationsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_branch_operation",
			mcp.WithDescription("Create a new branch in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("branch_name",
				mcp.Required(),
				mcp.Description("The name of the new branch to create"),
			),
			mcp.WithString("start_point",
				mcp.Description("The starting point for the branch (commit SHA or branch name). Defaults to the default branch if not specified."),
			),
			WithScope(config, true),
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

			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			createBranchReq := &dto.BranchCreateRequest{
				BranchName: branchName,
			}

			// Handle optional start point
			startPoint, err := OptionalParam[string](request, "start_point")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if startPoint != "" {
				createBranchReq.StartPoint = startPoint
			}

			data, err := client.CreateBranch(ctx, scope, repoIdentifier, createBranchReq)
			if err != nil {
				return nil, fmt.Errorf("failed to create branch: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal branch creation response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CommitFileOperationTool creates a tool for committing a file change to a branch
func CommitFileOperationTool(config *config.Config, client *client.BranchOperationsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("commit_file_operation",
			mcp.WithDescription("Commit a file change to a branch in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("branch",
				mcp.Required(),
				mcp.Description("The branch to commit to"),
			),
			mcp.WithString("file_path",
				mcp.Required(),
				mcp.Description("The path of the file to commit"),
			),
			mcp.WithString("content",
				mcp.Required(),
				mcp.Description("The content to write to the file"),
			),
			mcp.WithString("commit_msg",
				mcp.Required(),
				mcp.Description("The commit message"),
			),
			mcp.WithBoolean("is_new_file",
				mcp.Description("Whether this is a new file or an update to an existing file"),
			),
			WithScope(config, true),
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

			filePath, err := requiredParam[string](request, "file_path")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			content, err := requiredParam[string](request, "content")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			commitMsg, err := requiredParam[string](request, "commit_msg")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get is_new_file parameter with default false
			isNewFile, err := OptionalParam[bool](request, "is_new_file")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			commitFileReq := &dto.FileCommitRequest{
				Branch:    branch,
				FilePath:  filePath,
				Content:   content,
				CommitMsg: commitMsg,
				IsNewFile: isNewFile,
			}

			data, err := client.CommitFile(ctx, scope, repoIdentifier, commitFileReq)
			if err != nil {
				return nil, fmt.Errorf("failed to commit file: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal commit file response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CommitMultipleFilesOperationTool creates a tool for committing multiple file changes in a single commit
func CommitMultipleFilesOperationTool(config *config.Config, client *client.BranchOperationsService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("commit_multiple_files_operation",
			mcp.WithDescription("Commit multiple file changes in a single commit to a branch in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("branch",
				mcp.Required(),
				mcp.Description("The branch to commit to"),
			),
			mcp.WithString("commit_msg",
				mcp.Required(),
				mcp.Description("The commit message"),
			),
			mcp.WithObject("files",
				mcp.Required(),
				mcp.Description("Array of file operations to commit. Each file should have file_path, content, and is_new_file properties."),
			),
			WithScope(config, true),
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

			commitMsg, err := requiredParam[string](request, "commit_msg")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			filesRaw, err := requiredParam[interface{}](request, "files")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Parse files array
			filesData, ok := filesRaw.([]interface{})
			if !ok {
				return mcp.NewToolResultError("files parameter must be an array"), nil
			}

			files := make([]dto.FileOperation, 0, len(filesData))
			for _, fileRaw := range filesData {
				fileMap, ok := fileRaw.(map[string]interface{})
				if !ok {
					return mcp.NewToolResultError("each file must be an object"), nil
				}

				filePath, ok := fileMap["file_path"].(string)
				if !ok || filePath == "" {
					return mcp.NewToolResultError("each file must have a file_path property"), nil
				}

				content, ok := fileMap["content"].(string)
				if !ok {
					return mcp.NewToolResultError("each file must have a content property"), nil
				}

				isNewFile, _ := fileMap["is_new_file"].(bool)

				files = append(files, dto.FileOperation{
					FilePath:  filePath,
					Content:   content,
					IsNewFile: isNewFile,
				})
			}

			commitReq := &dto.MultiFileCommitRequest{
				Branch:    branch,
				CommitMsg: commitMsg,
				Files:     files,
			}

			data, err := client.CommitMultipleFiles(ctx, scope, repoIdentifier, commitReq)
			if err != nil {
				return nil, fmt.Errorf("failed to commit multiple files: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal commit response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
