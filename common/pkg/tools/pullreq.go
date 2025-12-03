package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetPullRequestTool creates a tool for getting a specific pull request
func GetPullRequestTool(config *config.Config, client *client.PullRequestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pull_request",
			mcp.WithDescription("Get details of a specific pull request in a Harness repository."),
			mcp.WithString("repo_id",
				mcp.Required(),
				mcp.Description("The ID of the repository"),
			),
			mcp.WithNumber("pr_number",
				mcp.Required(),
				mcp.Description("The number of the pull request"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoID, err := RequiredParam[string](request, "repo_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			prNumberFloat, err := RequiredParam[float64](request, "pr_number")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			prNumber := int(prNumberFloat)

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.Get(ctx, scope, repoID, prNumber)
			if err != nil {
				return nil, fmt.Errorf("failed to get pull request: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pull request: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListPullRequestsTool creates a tool for listing pull requests
// TODO: more options can be added (sort, order, timestamps, etc)
func ListPullRequestsTool(config *config.Config, client *client.PullRequestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_pull_requests",
			mcp.WithDescription("List pull requests in a Harness repository."),
			mcp.WithString("repo_id",
				mcp.Required(),
				mcp.Description("The ID of the repository"),
			),
			mcp.WithString("state",
				mcp.Description("Optional comma-separated states to filter pull requests (possible values: open,closed,merged)"),
			),
			mcp.WithString("source_branch",
				mcp.Description("Optional source branch to filter pull requests"),
			),
			mcp.WithString("target_branch",
				mcp.Description("Optional target branch to filter pull requests"),
			),
			mcp.WithString("query",
				mcp.Description("Optional search query to filter pull requests"),
			),
			mcp.WithBoolean("include_checks",
				mcp.Description("Optional flag to include CI check information for builds ran in the PR"),
			),
			mcp.WithNumber("page",
				mcp.DefaultNumber(1),
				mcp.Description("Page number for pagination"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Description("Number of items per page"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoID, err := RequiredParam[string](request, "repo_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			opts := &dto.PullRequestOptions{}

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
			stateStr, err := OptionalParam[string](request, "state")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if stateStr != "" {
				opts.State = parseCommaSeparatedList(stateStr)
			}

			sourceBranch, err := OptionalParam[string](request, "source_branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if sourceBranch != "" {
				opts.SourceBranch = sourceBranch
			}

			targetBranch, err := OptionalParam[string](request, "target_branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if targetBranch != "" {
				opts.TargetBranch = targetBranch
			}

			query, err := OptionalParam[string](request, "query")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if query != "" {
				opts.Query = query
			}

			authorIDStr, err := OptionalParam[string](request, "author_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if authorIDStr != "" {
				authorID, err := strconv.Atoi(authorIDStr)
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid author_id: %s", authorIDStr)), nil
				}
				opts.AuthorID = authorID
			}

			includeChecks, err := OptionalParam[bool](request, "include_checks")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			opts.IncludeChecks = includeChecks

			data, err := client.List(ctx, scope, repoID, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list pull requests: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pull request list: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// Helper function to parse comma-separated list
func parseCommaSeparatedList(input string) []string {
	if input == "" {
		return nil
	}
	return splitAndTrim(input, ",")
}

// splitAndTrim splits a string by the given separator and trims spaces from each element
func splitAndTrim(s, sep string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// GetPullRequestChecksTool creates a tool for getting pull request status checks
func GetPullRequestChecksTool(config *config.Config, client *client.PullRequestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pull_request_checks",
			mcp.WithDescription("Get status checks for a specific pull request in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithNumber("pr_number",
				mcp.Required(),
				mcp.Description("The number of the pull request"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoIdentifier, err := RequiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			prNumberFloat, err := RequiredParam[float64](request, "pr_number")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			prNumber := int(prNumberFloat)

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetChecks(ctx, scope, repoIdentifier, prNumber)
			if err != nil {
				return nil, fmt.Errorf("failed to get pull request checks: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pull request checks: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CreatePullRequestTool creates a tool for creating a new pull request
func CreatePullRequestTool(config *config.Config, client *client.PullRequestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_pull_request",
			mcp.WithDescription("Create a new pull request in a Harness repository."),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the repository"),
			),
			mcp.WithString("title",
				mcp.Required(),
				mcp.Description("The title of the pull request"),
			),
			mcp.WithString("description",
				mcp.Description("The description of the pull request"),
			),
			mcp.WithString("source_branch",
				mcp.Required(),
				mcp.Description("The source branch for the pull request"),
			),
			mcp.WithString("target_branch",
				mcp.Description("The target branch for the pull request"),
				mcp.DefaultString("main"),
			),
			mcp.WithBoolean("is_draft",
				mcp.Description("Whether the pull request should be created as a draft"),
				mcp.DefaultBool(false),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoIdentifier, err := RequiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			title, err := RequiredParam[string](request, "title")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			description, err := OptionalParam[string](request, "description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			sourceBranch, err := RequiredParam[string](request, "source_branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			isDraft, err := OptionalParam[bool](request, "is_draft")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			targetBranch, err := OptionalParam[string](request, "target_branch")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			createRequest := &dto.CreatePullRequest{
				Title:        title,
				SourceBranch: sourceBranch,
				TargetBranch: targetBranch,
				IsDraft:      isDraft,
				Description:  description,
			}

			data, err := client.Create(ctx, scope, repoIdentifier, createRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to create pull request: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal pull request: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetPullRequestActivitiesTool creates a tool for getting activities (including comments) for a specific pull request
func GetPullRequestActivitiesTool(config *config.Config, client *client.PullRequestService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pull_request_activities",
			mcp.WithDescription("Get activities and comments for a specific pull request in a Harness repository."),
			mcp.WithString("repo_id",
				mcp.Required(),
				mcp.Description("The ID of the repository"),
			),
			mcp.WithNumber("pr_number",
				mcp.Required(),
				mcp.Description("The number of the pull request"),
			),
			mcp.WithString("kind",
				mcp.Description("Optional comma-separated kinds of the pull request activity to include in the result."),
				mcp.Enum("change-comment", "comment", "system"),
			),
			mcp.WithString("type",
				mcp.Description("Optional comma-separated types of the pull request activity to include in the result."),
				mcp.Enum("branch-delete", "branch-restore", "branch-update", "code-comment", "comment", "label-modify", "merge", "review-submit", "reviewer-add", "reviewer-delete", "state-change", "target-branch-change", "title-change"),
			),
			mcp.WithNumber("after",
				mcp.Description("The result should contain only entries created at and after this timestamp (unix millis)."),
			),
			mcp.WithNumber("before",
				mcp.Description("The result should contain only entries created before this timestamp (unix millis)."),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(20),
				mcp.Description("The maximum number of results to return (1-100)."),
				mcp.Max(100),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			repoID, err := RequiredParam[string](request, "repo_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			prNumberFloat, err := RequiredParam[float64](request, "pr_number")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			prNumber := int(prNumberFloat)

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create the options struct
			opts := &dto.PullRequestActivityOptions{}

			limit, err := OptionalParam[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if limit > 0 {
				opts.Limit = int(limit)
			}

			// Handle filtering parameters
			kindStr, err := OptionalParam[string](request, "kind")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if kindStr != "" {
				opts.Kind = parseCommaSeparatedList(kindStr)
			}

			typeStr, err := OptionalParam[string](request, "type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if typeStr != "" {
				opts.Type = parseCommaSeparatedList(typeStr)
			}

			after, err := OptionalParam[float64](request, "after")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if after > 0 {
				opts.After = int64(after)
			}

			before, err := OptionalParam[float64](request, "before")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if before > 0 {
				opts.Before = int64(before)
			}

			// Set scope identifiers
			opts.AccountIdentifier = scope.AccountID
			opts.OrgIdentifier = scope.OrgID
			opts.ProjectIdentifier = scope.ProjectID

			data, err := client.GetActivities(ctx, scope, repoID, prNumber, opts)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get pull request activities: %s", err.Error())), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal pull request activities: %s", err.Error())), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
