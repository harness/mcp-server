package harness

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetRepositoryTool creates a tool for getting a specific repository
func GetRepositoryTool(config *config.Config, client *client.RepositoryService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_repository",
			mcp.WithDescription("Get details of a specific repository in Harness."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoIdentifier, err := requiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Get(ctx, scope, repoIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get repository: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal repository: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListRepositoriesTool creates a tool for listing repositories
func ListRepositoriesTool(config *config.Config, client *client.RepositoryService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_repositories",
			mcp.WithDescription("List repositories in Harness."),
			mcp.WithString("query",
				mcp.Description("Optional search term to filter repositories"),
			),
			mcp.WithString("sort",
				mcp.Description("Optional field to sort by (e.g., identifier)"),
			),
			mcp.WithString("order",
				mcp.Description("Optional sort order (asc or desc)"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(1),
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of items per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.RepositoryOptions{}

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if page > 0 {
				opts.Page = int(page)
			}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle other optional parameters
			query, err := OptionalParam[string](request, "query")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if query != "" {
				opts.Query = query
			}

			sort, err := OptionalParam[string](request, "sort")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sort != "" {
				opts.Sort = sort
			}

			order, err := OptionalParam[string](request, "order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if order != "" {
				opts.Order = order
			}

			data, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list repositories: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal repository list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetFileContentTool creates a tool for retrieving file content from a repository
func GetFileContentTool(config *config.Config, client *client.RepositoryService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_file_content",
			mcp.WithDescription("Get file content from a repository in Harness."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("file_path",
				mcp.Required(),
				mcp.Description("The path to the file within the repository"),
			),
			mcp.WithString("git_ref",
				mcp.Description("The git reference (branch, tag, or commit SHA). Can be a branch name like 'master', a tag, or a full commit SHA."),
			),
			mcp.WithString("routing_id",
				mcp.Description("Optional routing ID for the request. If not provided, the account ID will be used."),
			),
			mcp.WithBoolean("decode_content",
				mcp.DefaultBool(true),
				mcp.Description("Whether to decode the base64-encoded content. Set to false to get the raw encoded content."),
			),
			mcp.WithBoolean("include_metadata",
				mcp.DefaultBool(true),
				mcp.Description("Whether to include file metadata and commit information in the response. Set to false to get only the file content."),
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

			gitRef, err := OptionalParam[string](request, "git_ref")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			routingID, err := OptionalParam[string](request, "routing_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			decodeContent, err := OptionalParam[bool](request, "decode_content")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			includeMetadata, err := OptionalParam[bool](request, "include_metadata")
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
				Path:      filePath,
				GitRef:    gitRef,
				RoutingID: routingID,
				OrgID:     scope.OrgID,
				ProjectID: scope.ProjectID,
			}

			// Call client method
			data, err := client.GetFileContent(ctx, scope, repoIdentifier, fileContentReq)
			if err != nil {
				return nil, fmt.Errorf("failed to get file content: %w", err)
			}

			// Handle case where the file doesn't exist or isn't a file
			if data.Type != "file" || data.Content == nil {
				return nil, fmt.Errorf("path does not point to a valid file or file content is empty")
			}

			// If requested, decode the base64 content
			if decodeContent && data.Content.Encoding == "base64" && data.Content.Data != "" {
				decodedBytes, err := base64.StdEncoding.DecodeString(data.Content.Data)
				if err != nil {
					return nil, fmt.Errorf("failed to decode base64 content: %w", err)
				}
				
				// If metadata is not requested, return only the decoded content
				if !includeMetadata {
					return mcp.NewToolResultText(string(decodedBytes)), nil
				}
				
				// Create a response with both file metadata and decoded content
				response := struct {
					Type          string       `json:"type"`
					Sha           string       `json:"sha"`
					Name          string       `json:"name"`
					Path          string       `json:"path"`
					LatestCommit  *dto.Commit   `json:"latest_commit,omitempty"`
					DecodedContent string       `json:"decoded_content"`
					ContentSize    int          `json:"content_size"`
				}{
					Type:          data.Type,
					Sha:           data.Sha,
					Name:          data.Name,
					Path:          data.Path,
					LatestCommit:  data.LatestCommit,
					DecodedContent: string(decodedBytes),
					ContentSize:    len(decodedBytes),
				}
				
				// Marshal the response
				r, err := json.Marshal(response)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal file content: %w", err)
				}
				
				return mcp.NewToolResultText(string(r)), nil
			}

			// Return only the raw content if metadata is not requested
			if !includeMetadata && data.Content != nil {
				rawContent := struct {
					Encoding string `json:"encoding"`
					Data     string `json:"data"`
					Size     int    `json:"size"`
				}{
					Encoding: data.Content.Encoding,
					Data:     data.Content.Data,
					Size:     data.Content.Size,
				}
				
				r, err := json.Marshal(rawContent)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal raw content: %w", err)
				}
				
				return mcp.NewToolResultText(string(r)), nil
			}

			// Marshal the original response if no special handling was needed
			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal file content: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
