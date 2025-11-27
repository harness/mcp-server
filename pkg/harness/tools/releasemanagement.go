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

// buildReleaseContext builds a standardized release context object
func buildReleaseContext(releaseDetails *dto.ReleaseDetailsResponse, err error) (map[string]interface{}, []string) {
	warnings := []string{}
	context := map[string]interface{}{
		"release_identifier": "",
		"name":               "",
		"version":            "",
	}

	if err != nil {
		warnings = append(warnings, fmt.Sprintf("Failed to fetch release details: %v", err))
		return context, warnings
	}

	if releaseDetails != nil {
		release := releaseDetails.ReleaseInfo
		context["release_identifier"] = release.Identifier
		context["name"] = release.Name
		context["version"] = release.Version

		// Add timestamps if available
		timestamps := make(map[string]string)
		if release.ActualStartTs > 0 {
			timestamps["started_at"] = dto.FormatUnixMillisToRFC3339(release.ActualStartTs)
		}
		if release.ExpectedEndTs > 0 {
			timestamps["expected_end"] = dto.FormatUnixMillisToRFC3339(release.ExpectedEndTs)
		}
		if release.ActualEndTs > 0 {
			timestamps["completed_at"] = dto.FormatUnixMillisToRFC3339(release.ActualEndTs)
		}
		if release.ExpectedStartTs > 0 {
			timestamps["expected_start"] = dto.FormatUnixMillisToRFC3339(release.ExpectedStartTs)
		}
		if len(timestamps) > 0 {
			context["timestamps"] = timestamps
		}

		if release.HasConflict {
			context["has_conflict"] = true
		}
	}

	return context, warnings
}

// buildStandardResponse builds a standardized response structure
func buildStandardResponse(releaseContext map[string]interface{}, data interface{}, metadata map[string]interface{}, warnings []string) map[string]interface{} {
	result := map[string]interface{}{
		"release": releaseContext,
		"data":    data,
	}

	if len(metadata) > 0 {
		result["metadata"] = metadata
	}

	if len(warnings) > 0 {
		result["warnings"] = warnings
		result["data_completeness"] = "partial"
	} else {
		result["data_completeness"] = "complete"
	}

	return result
}

// SearchReleasesTool creates a tool for searching releases with optional status filter
func SearchReleasesTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("search_releases",
			mcp.WithDescription("Search and retrieve releases from Harness Release Management. This tool allows you to find releases by search term (e.g., release name or identifier) with optional status filtering. By default, it searches for 'Running' releases. If no running releases are found, it automatically falls back to return the most recent successful release. Returns release details including ID, identifier, name, version, status, and other metadata. Use this tool first to discover releases and obtain their release_id before using other release management tools."),
			mcp.WithString("search_term",
				mcp.Required(),
				mcp.Description("Search term to find releases. Can match release name, identifier. This is a required parameter."),
			),
			mcp.WithString("status",
				mcp.DefaultString(StatusRunning),
				mcp.Description("Filter releases by status. Valid values: Running, Success, Failed, Scheduled, Paused, Aborted. Defaults to 'Running'. If no running releases are found, the tool automatically returns the last successful release."),
			),
			mcp.WithNumber("days_back",
				mcp.DefaultNumber(DefaultDaysBack),
				mcp.Min(1),
				mcp.Max(MaxDaysBack),
				mcp.Description("Number of days to look back in history when searching for releases. The search includes releases from this many days ago up to 7 days in the future. Default: 7 days, Maximum: 30 days."),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(DefaultLimit),
				mcp.Min(1),
				mcp.Max(MaxLimit),
				mcp.Description("Maximum number of releases to return in the results. Default: 50, Maximum: 100. Results are sorted by relevance and recency."),
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
			mcp.WithDescription("Retrieve comprehensive status and execution phase information for a specific release. This tool returns the release identifier, name, version, and detailed information about all execution phases including their identifiers, names, and current status. Use this tool to monitor release progress, check which phases have completed, are running, or have failed. Requires the release_id which can be obtained using the search_releases tool if not present in context."),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The unique identifier (UUID) of the release. This is the 'id' field returned by the search_releases tool. Required to fetch release status and phase information."),
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

			var warnings []string
			releaseContext, releaseWarnings := buildReleaseContext(nil, nil)

			// Get release details to get identifier, name, and version
			releaseDetails, err := client.GetRelease(ctx, scope, releaseId)
			if err != nil {
				slog.WarnContext(ctx, "Failed to get release details", "release_id", releaseId, "error", err)
				warnings = append(warnings, fmt.Sprintf("Release details unavailable: %v", err))
				// Continue with phases even if release details fail
			} else {
				releaseContext, releaseWarnings = buildReleaseContext(releaseDetails, nil)
				warnings = append(warnings, releaseWarnings...)
			}

			// Get release phases
			phases, err := client.GetReleasePhases(ctx, scope, releaseId, "")
			if err != nil {
				return nil, fmt.Errorf("failed to get release phases: %w", err)
			}

			// Transform phases to include human-readable timestamps
			var formattedPhases []map[string]interface{}
			for _, phase := range phases.Phases {
				phaseData := map[string]interface{}{
					"identifier": phase.Identifier,
					"name":       phase.Name,
					"status":     phase.Status,
				}

				if phase.Description != "" {
					phaseData["description"] = phase.Description
				}

				// Add formatted timestamps
				if phase.StartTs > 0 {
					phaseData["started_at"] = dto.FormatUnixMillisToRFC3339(phase.StartTs)
				}
				if phase.EndTs > 0 {
					phaseData["completed_at"] = dto.FormatUnixMillisToRFC3339(phase.EndTs)
				}

				if phase.PhaseExecutionId != "" {
					phaseData["phase_execution_id"] = phase.PhaseExecutionId
				}

				phaseData["completed_activities"] = phase.CompletedActivities
				phaseData["total_activities"] = phase.TotalActivities

				if len(phase.Owners) > 0 {
					phaseData["owners"] = phase.Owners
				}

				if len(phase.DependsOn) > 0 {
					phaseData["depends_on"] = phase.DependsOn
				}

				formattedPhases = append(formattedPhases, phaseData)
			}

			// Build phase summary
			summary := map[string]interface{}{
				"total_phases": len(phases.Phases),
			}

			if len(phases.Phases) > 0 {
				statusCounts := make(map[string]int)
				totalCompletedActivities := 0
				totalActivities := 0

				for _, phase := range phases.Phases {
					statusCounts[phase.Status]++
					totalCompletedActivities += phase.CompletedActivities
					totalActivities += phase.TotalActivities
				}

				summary["status_breakdown"] = statusCounts
				summary["total_completed_activities"] = totalCompletedActivities
				summary["total_activities"] = totalActivities

				if totalActivities > 0 {
					summary["overall_progress_percentage"] = (totalCompletedActivities * 100) / totalActivities
				}
			}

			metadata := map[string]interface{}{
				"summary": summary,
			}

			result := buildStandardResponse(releaseContext, map[string]interface{}{
				"phases": formattedPhases,
			}, metadata, warnings)

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetActivitiesSummaryTool creates a tool for getting a summary of activities for a release phase
func GetActivitiesSummaryTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_activities_summary",
			mcp.WithDescription("Retrieve a comprehensive summary of activities for a specific release phase. This tool provides aggregated statistics including total activities, running activities, status breakdown, and activity-level summaries. Each activity summary includes key information such as identifier, name, status, timestamps, dependencies, and execution details (pipeline_execution_id for pipeline activities, or subprocess_release_id for subprocess activities if applicable). Use this tool to quickly understand the state and progress of activities within a phase without needing detailed activity information. Requires the release_id and phase_identifier which can be obtained using the search_releases and get_release_status tools."),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The unique identifier (UUID) of the release. This is the 'id' field returned by the search_releases tool. Required to fetch activities summary for the release."),
			),
			mcp.WithString("phase_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the phase. This can be obtained from the get_release_status tool which returns phase identifiers. Required to fetch activities for the specific phase."),
			),
			mcp.WithString("phase_execution_id",
				mcp.Description("Optional. The ID of the phase execution. If provided, filters activities for the specific phase execution instance."),
			),
			mcp.WithString("status",
				mcp.Description("Optional filter to return only activities with a specific status. If not provided, all activities regardless of status will be included in the summary."),
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

			phaseExecutionId, _ := OptionalParam[string](request, "phase_execution_id")
			status, _ := OptionalParam[string](request, "status")

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			var warnings []string
			releaseContext, releaseWarnings := buildReleaseContext(nil, nil)

			// Get release details to get identifier, name, and version
			releaseDetails, err := client.GetRelease(ctx, scope, releaseId)
			if err != nil {
				slog.WarnContext(ctx, "Failed to get release details", "release_id", releaseId, "error", err)
				warnings = append(warnings, fmt.Sprintf("Release details unavailable: %v", err))
			} else {
				releaseContext, releaseWarnings = buildReleaseContext(releaseDetails, nil)
				warnings = append(warnings, releaseWarnings...)
			}

			// If phase_execution_id is not provided, derive it from phase_identifier using the phases endpoint
			if phaseExecutionId == "" {
				//Todo: Add a filter of phaseIdentifier in the main endpoint
				phases, err := client.GetReleasePhases(ctx, scope, releaseId, "")
				if err != nil {
					slog.WarnContext(ctx, "Failed to get release phases to derive phase_execution_id", "release_id", releaseId, "phase_identifier", phaseIdentifier, "error", err)
					warnings = append(warnings, fmt.Sprintf("Could not derive phase_execution_id from phase_identifier: %v", err))
				} else {
					// Find the matching phase by identifier
					for _, phase := range phases.Phases {
						if phase.Identifier == phaseIdentifier {
							if phase.PhaseExecutionId != "" {
								phaseExecutionId = phase.PhaseExecutionId
								break
							}
						}
					}
					if phaseExecutionId == "" {
						warnings = append(warnings, fmt.Sprintf("Could not find phase_execution_id for phase_identifier: %s", phaseIdentifier))
					}
				}
			}

			// Build status filter - if status is provided, use it; otherwise get all activities
			var statusFilter []string
			if status != "" {
				statusFilter = []string{status}
			}

			// Get release activities for the phase
			// If we have phase_execution_id, pass it; otherwise pass empty string (API will use phaseIdentifier only)
			activities, err := client.GetReleaseActivities(ctx, scope, releaseId, phaseIdentifier, phaseExecutionId, statusFilter)
			if err != nil {
				return nil, fmt.Errorf("failed to get release activities: %w", err)
			}

			// Build activity summaries with key metrics
			var activitySummaries []map[string]interface{}
			statusCounts := make(map[string]int)

			for _, activity := range activities.Activities {
				statusCounts[activity.Status]++

				activitySummary := map[string]interface{}{
					"activity_identifier": activity.Identifier,
					"activity_name":       activity.Name,
					"status":              activity.Status,
				}

				if activity.Description != "" {
					activitySummary["description"] = activity.Description
				}

				// Add timestamps
				if activity.StartTs > 0 {
					activitySummary["started_at"] = dto.FormatUnixMillisToRFC3339(activity.StartTs)
				}
				if activity.EndTs > 0 {
					activitySummary["completed_at"] = dto.FormatUnixMillisToRFC3339(activity.EndTs)
				}

				if activity.ActivityExecutionId != "" {
					activitySummary["activity_execution_id"] = activity.ActivityExecutionId
				}

				if activity.RetryIndex > 0 {
					activitySummary["retry_index"] = activity.RetryIndex
				}

				if len(activity.DependsOn) > 0 {
					activitySummary["depends_on"] = activity.DependsOn
				}

				// Add execution details if available
				if activity.Pipeline != nil {
					activitySummary["pipeline_execution_id"] = activity.Pipeline.ExecutionId
				}

				if activity.Subprocess != nil {
					activitySummary["subprocess_release_id"] = activity.Subprocess.ReleaseId
				}

				activitySummaries = append(activitySummaries, activitySummary)
			}

			// Build overall summary statistics
			summary := map[string]interface{}{
				"total_activities":         len(activities.Activities),
				"total_running_activities": activities.TotalRunningActivities,
			}

			if len(activities.Activities) > 0 {
				summary["status_breakdown"] = statusCounts
			}

			if activities.ProcessExecutionID != "" {
				summary["process_execution_id"] = activities.ProcessExecutionID
			}

			if activities.PhaseExecutionID != "" {
				summary["phase_execution_id"] = activities.PhaseExecutionID
			}

			metadata := map[string]interface{}{
				"summary":          summary,
				"phase_identifier": phaseIdentifier,
			}

			if phaseExecutionId != "" {
				metadata["phase_execution_id"] = phaseExecutionId
			}

			if status != "" {
				metadata["status_filter"] = status
			} else {
				metadata["status_filter"] = "all"
			}

			result := buildStandardResponse(releaseContext, map[string]interface{}{
				"activities": activitySummaries,
			}, metadata, warnings)

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetTasksForReleaseTool creates a tool for getting tasks for a release with optional status filter
func GetTasksForReleaseTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_tasks_for_release",
			mcp.WithDescription("Retrieve tasks for a specific release with optional status filtering. This tool returns tasks that match the specified status filter (if provided) or all tasks if no status is specified. Each task includes details such as task identifier, name, description, status, assigned users or user groups, whether it's required, expected duration, and timestamps. Use this tool to identify tasks at various stages of execution (pending, in-progress, completed, failed, or blocked). The response includes release context (identifier, name, version) along with task details. Requires the release_id which can be obtained using the search_releases tool if not present in context."),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The unique identifier (UUID) of the release. This is the 'id' field returned by the search_releases tool. Required to fetch tasks for the release."),
			),
			mcp.WithString("status",
				mcp.Description("Optional filter to return only tasks with a specific status. Valid values: TODO, IN_PROGRESS, SUCCEEDED, FAILED, BLOCKED. If not provided, all tasks regardless of status will be returned."),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(50),
				mcp.Min(1),
				mcp.Max(100),
				mcp.Description("Maximum number of tasks to return. Default: 50, Maximum: 100."),
			),
			common.WithScope(config, false),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			releaseId, err := RequiredParam[string](request, "release_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			status, _ := OptionalParam[string](request, "status")

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

			var warnings []string
			releaseContext, releaseWarnings := buildReleaseContext(nil, nil)

			// Get release details to get identifier, name, and version
			releaseDetails, err := client.GetRelease(ctx, scope, releaseId)
			if err != nil {
				slog.WarnContext(ctx, "Failed to get release details", "release_id", releaseId, "error", err)
				warnings = append(warnings, fmt.Sprintf("Release details unavailable: %v", err))
			} else {
				releaseContext, releaseWarnings = buildReleaseContext(releaseDetails, nil)
				warnings = append(warnings, releaseWarnings...)
			}

			// Build status filter - if status is provided, use it; otherwise get all tasks
			var statusFilter []string
			if status != "" {
				statusFilter = []string{status}
			}

			// Use the simplified endpoint to get tasks with optional status filter
			tasks, err := client.GetReleaseTasks(ctx, scope, releaseId, "", limit, statusFilter)
			if err != nil {
				return nil, fmt.Errorf("failed to get release tasks: %w", err)
			}

			// Transform tasks for response (without duplicating release info in each task)
			var taskList []map[string]interface{}
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

				// Add task timestamps if available
				if task.CreatedAt > 0 {
					taskInfo["created_at"] = dto.FormatUnixMillisToRFC3339(task.CreatedAt)
				}
				if task.LastUpdatedAt > 0 {
					taskInfo["last_updated_at"] = dto.FormatUnixMillisToRFC3339(task.LastUpdatedAt)
				}
				if task.ActualDuration != "" {
					taskInfo["actual_duration"] = task.ActualDuration
				}
				if task.TaskExecutionId != "" {
					taskInfo["task_execution_id"] = task.TaskExecutionId
				}

				taskList = append(taskList, taskInfo)
			}

			metadata := map[string]interface{}{
				"total_tasks":   len(taskList),
				"limit_applied": limit,
			}

			if status != "" {
				metadata["status_filter"] = status
			} else {
				metadata["status_filter"] = "all"
			}

			result := buildStandardResponse(releaseContext, map[string]interface{}{
				"tasks": taskList,
			}, metadata, warnings)

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}

// GetExecutionOutputsTool creates a tool for getting outputs from phase or activity executions
func GetExecutionOutputsTool(config *config.Config, client *client.ReleaseManagementService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_release_outputs",
			mcp.WithDescription("Retrieve execution outputs (variables, artifacts, or other runtime data) from release execution phases or activities. "+
				"This tool can fetch outputs at two levels: "+
				"(1) Phase level - returns all outputs from an entire execution phase (provide only release_id and phase_identifier), or "+
				"(2) Activity level - returns outputs from a specific activity within a phase (provide release_id, phase_identifier, and activity_identifier). "+
				"Outputs include key-value pairs with their names and values (e.g., strings, numbers, artifacts). "+
				"Use this tool when asked about 'outputs', 'variables', 'artifacts', or 'runtime data' from a phase or activity. "+
				"Examples: 'what are the outputs of activityA in phase1?', 'get outputs from phase deployment', 'show me variables from activity build'. "+
				"Required parameters: release_id (UUID from search_releases tool), phase_identifier (from get_release_status tool's phases array). "+
				"Optional parameter: activity_identifier (from get_activities_summary tool or get_release_status tool) - required when querying specific activity outputs. "+
				"If release_id is not in context, first use search_releases to find the release. "+
				"If phase_identifier or activity_identifier are not in context, use get_release_status to get phase identifiers, or get_activities_summary to get activity identifiers."),
			mcp.WithString("release_id",
				mcp.Required(),
				mcp.Description("The unique identifier (UUID) of the release. This is the 'id' field returned by the search_releases tool. Required to fetch execution outputs."),
			),
			mcp.WithString("phase_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the execution phase. This can be obtained from the 'phases' array returned by the get_release_status tool. Each phase has an 'identifier' field. Required to specify which phase's outputs to retrieve."),
			),
			mcp.WithString("activity_identifier",
				mcp.Description("Optional: The identifier of a specific activity within the phase. If provided, returns outputs only for that activity. If omitted, returns all outputs from the entire phase. Use this to get granular output data from specific activities."),
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

			var warnings []string
			releaseContext, releaseWarnings := buildReleaseContext(nil, nil)

			// Get release details to get identifier, name, and version
			releaseDetails, err := client.GetRelease(ctx, scope, releaseId)
			if err != nil {
				slog.WarnContext(ctx, "Failed to get release details", "release_id", releaseId, "error", err)
				warnings = append(warnings, fmt.Sprintf("Release details unavailable: %v", err))
			} else {
				releaseContext, releaseWarnings = buildReleaseContext(releaseDetails, nil)
				warnings = append(warnings, releaseWarnings...)
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

			metadata := map[string]interface{}{
				"output_level":     outputLevel,
				"total_outputs":    len(outputs.Outputs),
				"phase_identifier": phaseIdentifier,
			}

			if activityIdentifier != "" {
				metadata["activity_identifier"] = activityIdentifier
			}

			result := buildStandardResponse(releaseContext, map[string]interface{}{
				"outputs": outputs.Outputs,
			}, metadata, warnings)

			resultJSON, _ := json.Marshal(result)
			return mcp.NewToolResultText(string(resultJSON)), nil
		}
}
