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

// GetEnvironmentTool creates a tool for getting details of a specific environment
// https://apidocs.harness.io/tag/Environments#operation/getEnvironmentV2
func GetEnvironmentTool(config *config.Config, client *client.EnvironmentClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_environment",
			mcp.WithDescription("Get details of a specific environment in Harness."),
			mcp.WithString("environment_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the environment"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			environmentIdentifier, err := requiredParam[string](request, "environment_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Get(ctx, scope, environmentIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get environment: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environment: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListEnvironmentsTool creates a tool for listing environments
// https://apidocs.harness.io/tag/Environments#operation/getEnvironmentList
func ListEnvironmentsTool(config *config.Config, client *client.EnvironmentClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_environments",
			mcp.WithDescription("List environments in Harness."),
			mcp.WithString("sort",
				mcp.Description("Optional field to sort by (e.g., name)"),
			),
			mcp.WithString("order",
				mcp.Description("Optional sort order (asc or desc)"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(0),
				mcp.Description("Page number for pagination (0-based)"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of environments per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.EnvironmentOptions{}

			// Handle pagination
			page, err := OptionalParam[float64](request, "page")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if page >= 0 {
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

			environments, totalCount, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list environments: %w", err)
			}

			// Create response with environments and metadata
			response := map[string]interface{}{
				"environments": environments,
				"totalCount":   totalCount,
				"pageSize":     opts.Limit,
				"pageNumber":   opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal environment list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// MoveEnvironmentConfigsTool creates a tool for moving environment YAML from inline to remote
// https://apidocs.harness.io/tag/Environments#operation/moveEnvironmentConfigs
func MoveEnvironmentConfigsTool(config *config.Config, client *client.EnvironmentClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("move_environment_configs",
			mcp.WithDescription("Move environment YAML from inline to remote in Harness. Note: Moving from remote to inline is not supported for environments."),
			mcp.WithString("environment_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the environment"),
			),
			mcp.WithString("account_identifier",
				mcp.Required(),
				mcp.Description("Account Identifier for the Entity."),
			),
			mcp.WithString("org_identifier",
				mcp.Description("Organization Identifier for the Entity."),
			),
			mcp.WithString("project_identifier",
				mcp.Description("Project Identifier for the Entity."),
			),
			mcp.WithString("connector_ref",
				mcp.Description("Identifier of Connector needed for CRUD operations on the respective Entity"),
			),
			mcp.WithString("repo_name",
				mcp.Description("Name of the repository."),
			),
			mcp.WithString("branch",
				mcp.Description("Name of the branch."),
			),
			mcp.WithString("file_path",
				mcp.Description("File Path of the Entity."),
			),
			mcp.WithString("commit_msg",
				mcp.Description("Commit Message to use for the merge commit."),
			),
			mcp.WithBoolean("is_new_branch",
				mcp.Description("Checks the new branch"),
			),
			mcp.WithString("base_branch",
				mcp.Description("Name of the default branch."),
			),
			mcp.WithBoolean("is_harness_code_repo",
				mcp.Description("Is Harness code repo enabled"),
			),
			mcp.WithString("move_config_type",
				mcp.Required(),
				mcp.Description("Specifies the direction of the move operation. Currently only INLINE_TO_REMOTE is supported for environments."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environmentIdentifier, err := requiredParam[string](request, "environment_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			accountIdentifier, err := requiredParam[string](request, "account_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgIdentifier, err := OptionalParam[string](request, "org_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			projectIdentifier, err := OptionalParam[string](request, "project_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			moveConfigType, err := requiredParam[string](request, "move_config_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if moveConfigType != string(dto.InlineToRemote) {
				return mcp.NewToolResultError("move_config_type must be INLINE_TO_REMOTE. The REMOTE_TO_INLINE operation is not supported for environments."), nil
			}

			connectorRef, err := OptionalParam[string](request, "connector_ref")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			repoName, err := OptionalParam[string](request, "repo_name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			branch, err := OptionalParam[string](request, "branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			filePath, err := OptionalParam[string](request, "file_path")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			commitMsg, err := OptionalParam[string](request, "commit_msg")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			isNewBranch, err := OptionalParam[bool](request, "is_new_branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			baseBranch, err := OptionalParam[string](request, "base_branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			isHarnessCodeRepo, err := OptionalParam[bool](request, "is_harness_code_repo")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create move request with the new structure
			moveRequest := &dto.MoveEnvironmentConfigsRequest{
				EnvironmentIdentifier: environmentIdentifier,
				AccountIdentifier:     accountIdentifier,
				OrgIdentifier:         orgIdentifier,
				ProjectIdentifier:     projectIdentifier,
				ConnectorRef:          connectorRef,
				RepoName:              repoName,
				Branch:                branch,
				FilePath:              filePath,
				CommitMsg:             commitMsg,
				MoveConfigType:        dto.MoveConfigType(moveConfigType),
			}

			// Set boolean pointers if values were provided
			if isNewBranchProvided, ok := request.Params.Arguments["is_new_branch"]; ok && isNewBranchProvided != nil {
				val := isNewBranch
				moveRequest.IsNewBranch = &val
			}

			if isHarnessCodeRepoProvided, ok := request.Params.Arguments["is_harness_code_repo"]; ok && isHarnessCodeRepoProvided != nil {
				val := isHarnessCodeRepo
				moveRequest.IsHarnessCodeRepo = &val
			}

			// Add the base branch if provided
			if baseBranch != "" {
				moveRequest.BaseBranch = baseBranch
			}

			// Execute the move operation
			success, err := client.MoveConfigs(ctx, scope, moveRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to move environment configurations: %w", err)
			}

			// Create the response
			result := map[string]interface{}{
				"success": success,
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
