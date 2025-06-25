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

// ListInfrastructuresTool creates a tool for listing infrastructures
// https://apidocs.harness.io/tag/Infrastructures#operation/getInfrastructureList
func ListInfrastructuresTool(config *config.Config, client *client.InfrastructureClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_infrastructures",
			mcp.WithDescription("List infrastructure definitions in Harness."),
			mcp.WithString("deploymentType",
				mcp.Description("Optional filter for deployment type (e.g., Kubernetes, ECS)"),
			),
			mcp.WithString("environmentIdentifier",
				mcp.Required(),
				mcp.Description("Filter for environment"),
			),
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
				mcp.Description("Number of infrastructures per page"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.InfrastructureOptions{}

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

			// Handle filters
			deploymentType, err := OptionalParam[string](request, "deploymentType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if deploymentType != "" {
				opts.DeploymentType = deploymentType
			}

			environmentIdentifier, err := requiredParam[string](request, "environmentIdentifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if environmentIdentifier != "" {
				opts.EnvironmentIdentifier = environmentIdentifier
			}

			// Handle sorting
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

			infrastructures, totalCount, err := client.List(ctx, scope, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list infrastructures: %w", err)
			}

			// Create response with infrastructures and metadata
			response := map[string]interface{}{
				"infrastructures": infrastructures,
				"totalCount":      totalCount,
				"pageSize":        opts.Limit,
				"pageNumber":      opts.Page,
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal infrastructures list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// MoveInfrastructureConfigsTool creates a tool for moving configurations between infrastructures
// https://apidocs.harness.io/tag/Infrastructures#operation/moveInfraConfigs
func MoveInfrastructureConfigsTool(config *config.Config, client *client.InfrastructureClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("move_infrastructure_configs",
			mcp.WithDescription("Move infrastructure YAML from inline to remote or vice versa in Harness."),
			mcp.WithString("infra_identifier",
				mcp.Required(),
				mcp.Description("Infrastructure identifier to move"),
			),
			mcp.WithString("environment_identifier",
				mcp.Required(),
				mcp.Description("Environment identifier for the infrastructure"),
			),
			mcp.WithString("move_config_type",
				mcp.Required(),
				mcp.Description("Specifies the direction of the move operation. Options: INLINE_TO_REMOTE, REMOTE_TO_INLINE"),
			),
			mcp.WithString("org_identifier",
				mcp.Description("Organization identifier"),
			),
			mcp.WithString("project_identifier",
				mcp.Description("Project identifier"),
			),
			mcp.WithString("connector_ref",
				mcp.Description("Identifier of connector needed for operations on the entity"),
			),
			mcp.WithString("repo_name",
				mcp.Description("Name of the repository"),
			),
			mcp.WithString("branch",
				mcp.Description("Name of the branch"),
			),
			mcp.WithString("file_path",
				mcp.Description("File path of the entity"),
			),
			mcp.WithString("commit_msg",
				mcp.Description("Commit message to use for the merge commit"),
			),
			mcp.WithBoolean("is_new_branch",
				mcp.Description("Checks the new branch"),
			),
			mcp.WithString("base_branch",
				mcp.Description("Name of the default branch"),
			),
			mcp.WithBoolean("is_harness_code_repo",
				mcp.Description("Is Harness code repo enabled"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get scope
			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Extract required parameters
			infraIdentifier, err := requiredParam[string](request, "infra_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environmentIdentifier, err := requiredParam[string](request, "environment_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			moveConfigTypeStr, err := requiredParam[string](request, "move_config_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Validate move config type
			if moveConfigTypeStr != string(dto.InlineToRemote) && moveConfigTypeStr != string(dto.RemoteToInline) {
				return mcp.NewToolResultError("move_config_type must be either INLINE_TO_REMOTE or REMOTE_TO_INLINE"), nil
			}
			moveConfigType := dto.MoveConfigType(moveConfigTypeStr)

			// Extract optional parameters
			orgIdentifier, err := OptionalParam[string](request, "org_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			projectIdentifier, err := OptionalParam[string](request, "project_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
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

			// Create move request
			moveRequest := &dto.MoveInfraConfigsRequest{
				InfraIdentifier:       infraIdentifier,
				EnvironmentIdentifier: environmentIdentifier,
				AccountIdentifier:     scope.AccountID,
				OrgIdentifier:         orgIdentifier,
				ProjectIdentifier:     projectIdentifier,
				ConnectorRef:          connectorRef,
				RepoName:              repoName,
				Branch:                branch,
				FilePath:              filePath,
				CommitMsg:             commitMsg,
				MoveConfigType:        moveConfigType,
			}

			// Set boolean pointers if values were provided
			if isNewBranchProvided, ok := request.Params.Arguments["is_new_branch"]; ok && isNewBranchProvided != nil {
				moveRequest.IsNewBranch = &isNewBranch
			}

			if isHarnessCodeRepoProvided, ok := request.Params.Arguments["is_harness_code_repo"]; ok && isHarnessCodeRepoProvided != nil {
				moveRequest.IsHarnessCodeRepo = &isHarnessCodeRepo
			}

			// Add the base branch if provided
			if baseBranch != "" {
				moveRequest.BaseBranch = baseBranch
			}

			// Execute the move operation
			response, err := client.MoveConfigs(ctx, scope, moveRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to move infrastructure configurations: %w", err)
			}

			// Create the response
			result := map[string]interface{}{
				"identifier": response.Data.Identifier,
				"success":    response.Data.Success,
			}

			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
