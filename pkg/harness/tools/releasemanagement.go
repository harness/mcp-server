package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	// Status values - used multiple times and important for API consistency
	StatusRunning = "Running"
	StatusSuccess = "Success"

	// Default/limit values - configuration that might change
	DefaultDaysBack = 7
	DefaultLimit    = 50
	MaxDaysBack     = 30
	MaxLimit        = 100

	// Output levels - used in multiple places
	OutputLevelPhase    = "phase"
	OutputLevelActivity = "activity"
)

// SearchReleasesTool creates a tool for searching releases with optional status filter
func SearchReleasesTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("search_releases",
			mcp.WithDescription("Search for releases using a search term. Can filter by status (default: Running). If no releases found with requested status, returns the last successful release."),
			mcp.WithString("search_term",
				mcp.Required(),
				mcp.Description("Search term to find releases (required)"),
			),
			mcp.WithString("status",
				mcp.DefaultString(StatusRunning),
				mcp.Description("Optional status filter (Running, Success, Failed, Scheduled, Paused, Aborted). Defaults to 'Running'"),
			),
			mcp.WithNumber("days_back",
				mcp.DefaultNumber(DefaultDaysBack),
				mcp.Min(1),
				mcp.Max(MaxDaysBack),
				mcp.Description("Number of days to look back for releases (default: 7, max: 30)"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(DefaultLimit),
				mcp.Min(1),
				mcp.Max(MaxLimit),
				mcp.Description("Maximum number of releases to return (default: 50, max: 100)"),
			),
			common.WithScope(config, false),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			searchTerm, err := RequiredParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			statusParam, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if statusParam == "" {
				statusParam = StatusRunning
			}

			daysBack, err := OptionalIntParamWithDefault(request, "days_back", DefaultDaysBack)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limit, err := OptionalIntParamWithDefault(request, "limit", DefaultLimit)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Ensure days_back doesn't exceed MaxDaysBack
			if daysBack > MaxDaysBack {
				daysBack = MaxDaysBack
			}
			if daysBack < 1 {
				daysBack = 1
			}

			// Ensure limit doesn't exceed MaxLimit
			if limit > MaxLimit {
				limit = MaxLimit
			}
			if limit < 1 {
				limit = 1
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create time range for the request (specified days back to current + 7 days future)
			now := time.Now()
			startTime := now.AddDate(0, 0, -daysBack).UnixMilli()
			endTime := now.AddDate(0, 0, 7).UnixMilli()

			summaryRequest := &dto.ReleaseSummaryRequest{
				TimeRanges: []dto.TimeRangeDTO{
					{
						StartTime: startTime,
						EndTime:   endTime,
					},
				},
			}

			// Get releases with the specified status and search term filter
			releases, err := client.GetReleaseSummary(ctx, scope, summaryRequest, searchTerm, nil, "", []string{statusParam})
			if err != nil {
				return nil, fmt.Errorf("failed to get releases: %w", err)
			}

			// Apply limit to the results
			limitedReleases := releases.Releases
			if len(limitedReleases) > limit {
				limitedReleases = limitedReleases[:limit]
			}

			// If no releases found with requested status and it was "Running", try to get last successful
			if len(limitedReleases) == 0 && statusParam == StatusRunning {
				slog.InfoContext(ctx, "No running releases found, fetching last successful release")
				successfulReleases, err := client.GetReleaseSummary(ctx, scope, summaryRequest, searchTerm, nil, "", []string{StatusSuccess})
				if err != nil {
					slog.WarnContext(ctx, "Failed to get successful releases", "error", err)
				} else if len(successfulReleases.Releases) > 0 {
					// Get the most recent successful release (apply limit here too)
					lastSuccessReleases := successfulReleases.Releases
					if len(lastSuccessReleases) > limit {
						lastSuccessReleases = lastSuccessReleases[:limit]
					}
					lastSuccess := lastSuccessReleases[len(lastSuccessReleases)-1]

					result := map[string]interface{}{
						"active_releases":         []dto.ReleaseDTO{},
						"message":                 "No active releases found",
						"last_successful_release": lastSuccess,
						"days_searched":           daysBack,
						"limit_applied":           limit,
						"search_term":             searchTerm,
					}

					resultJSON, _ := json.Marshal(result)
					return mcp.NewToolResultText(string(resultJSON)), nil
				}
			}

			result := map[string]interface{}{
				"active_releases": limitedReleases,
				"total_count":     len(limitedReleases),
				"total_found":     len(releases.Releases),
				"status_filter":   statusParam,
				"days_searched":   daysBack,
				"limit_applied":   limit,
				"search_term":     searchTerm,
			}

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetReleaseStatusTool creates a tool for getting detailed release status and phase information
func GetReleaseStatusTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_release_status",
			mcp.WithDescription("Get detailed status and phase information for a specific release"),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The UUID of the release to get status for. If the release UUID is unknown, use the search_releases tool first to find the release and get its ID"),
			),
			common.WithScope(config, false),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			releaseId, err := RequiredParam[string](request, "release_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get release phases
			phases, err := client.GetReleasePhases(ctx, scope, releaseId, "")
			if err != nil {
				return nil, fmt.Errorf("failed to get release phases: %w", err)
			}

			result := map[string]interface{}{
				"release_id":   releaseId,
				"phases":       phases.Phases,
				"total_phases": len(phases.Phases),
			}

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetPendingTasksTool creates a tool for getting all pending manual tasks for a release using the simplified API
func GetPendingTasksTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_pending_tasks",
			mcp.WithDescription("Get all pending manual tasks (status = TODO) for a specific release using the simplified tasks API"),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The UUID of the release to get pending tasks for. If the release UUID is unknown, use the search_releases tool first to find the release and get its ID"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(50),
				mcp.Min(1),
				mcp.Max(100),
				mcp.Description("Maximum number of tasks to return (default: 50, max: 100)"),
			),
			common.WithScope(config, false),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			releaseId, err := RequiredParam[string](request, "release_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			limit, err := OptionalIntParamWithDefault(request, "limit", 50)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Ensure limit doesn't exceed 100
			if limit > 100 {
				limit = 100
			}
			if limit < 1 {
				limit = 1
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Use the new simplified endpoint to get tasks with TODO status filter
			tasks, err := client.GetReleaseTasks(ctx, scope, releaseId, "", limit, []string{"TODO"})
			if err != nil {
				return nil, fmt.Errorf("failed to get release tasks: %w", err)
			}

			// Transform tasks for response
			var pendingTasks []map[string]interface{}
			for _, task := range tasks.Tasks {
				taskInfo := map[string]interface{}{
					"task_id":           task.Identifier,
					"task_name":         task.Name,
					"task_description":  task.Description,
					"status":            task.Status,
					"required":          task.Required,
					"users":             task.Users,
					"user_groups":       task.UserGroups,
					"expected_duration": task.ExpectedDuration,
				}
				pendingTasks = append(pendingTasks, taskInfo)
			}

			resultJSON, _ := json.Marshal(pendingTasks)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetExecutionOutputsTool creates a tool for getting outputs from phase or activity executions
func GetExecutionOutputsTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_execution_outputs",
			mcp.WithDescription("Get outputs from phase or activity executions. Can fetch outputs at phase level or activity level."),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The UUID of the release. If the release UUID is unknown, use the search_releases tool first to find the release and get its ID"),
			),
			mcp.WithString("phase_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the phase"),
			),
			mcp.WithString("activity_identifier",
				mcp.Description("The identifier of the activity (optional - if provided, gets activity outputs, otherwise gets phase outputs)"),
			),
			common.WithScope(config, false),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			releaseId, err := RequiredParam[string](request, "release_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			phaseIdentifier, err := RequiredParam[string](request, "phase_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			activityIdentifier, err := OptionalParam[string](request, "activity_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var outputs *dto.ExecutionOutputsResponse
			outputLevel := "phase"

			// If activity identifier is provided, get activity outputs, otherwise get phase outputs
			if activityIdentifier != "" {
				outputs, err = client.GetActivityOutputs(ctx, scope, releaseId, phaseIdentifier, activityIdentifier)
				outputLevel = "activity"
			} else {
				outputs, err = client.GetPhaseOutputs(ctx, scope, releaseId, phaseIdentifier)
			}

			if err != nil {
				return nil, fmt.Errorf("failed to get %s outputs: %w", outputLevel, err)
			}

			result := map[string]interface{}{
				"release_id":          releaseId,
				"phase_identifier":    phaseIdentifier,
				"activity_identifier": activityIdentifier,
				"outputs":             outputs.Outputs,
			}

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}
