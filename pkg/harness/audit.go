package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	minPage = 0
	maxPage = 1000
	minSize = 1
	maxSize = 1000
)

func convertDateToMilliseconds(timestamp string) int64 {
	t, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		panic(err)
	}

	year := t.Year()
	month := int(t.Month())
	day := t.Day()
	hour := t.Hour()
	minute := t.Minute()
	second := t.Second()

	t = time.Date(year, time.Month(month), day, hour, minute, second, 0, time.Local)

	// Convert to Unix milliseconds
	unixMillis := t.UnixNano() / int64(time.Millisecond)

	return unixMillis

}

func getCurrentTime() string {
	now := time.Now().UTC().Format(time.RFC3339)
	return now
}

func previousWeek() string {
	oneWeekAgo := time.Now().AddDate(0, 0, -7).UTC().Format(time.RFC3339)
	return oneWeekAgo
}

// ListAuditsOfUser creates a tool for listing the audit trail.
func ListUserAuditTrailTool(config *config.Config, auditClient *client.AuditService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_user_audits",
			mcp.WithDescription("List the audit trail."),
			mcp.WithString("user_id_list",
				mcp.Description("Enter one or more user email IDs (comma-separated) to filter the audit trail; leave blank to include all users."),
			),
			mcp.WithString("start_time",
				mcp.Description("Optional start time in ISO 8601 format (e.g., '2025-07-10T08:00:00Z')"),
				mcp.DefaultString(previousWeek()),
			),
			mcp.WithString("end_time",
				mcp.Description("Optional end time in ISO 8601 format (e.g., '2025-07-10T08:00:00Z')"),
				mcp.DefaultString(getCurrentTime()),
			),
			mcp.WithString("actions",
				mcp.Description("Optional actions to filter by. For multiple actions, use comma-separated values."),
				mcp.Enum("CREATE", "UPDATE", "RESTORE", "DELETE", "FORCE_DELETE", "UPSERT", "INVITE", "RESEND_INVITE", "REVOKE_INVITE",
					"ADD_COLLABORATOR", "REMOVE_COLLABORATOR", "CREATE_TOKEN", "REVOKE_TOKEN", "LOGIN", "LOGIN2FA", "UNSUCCESSFUL_LOGIN",
					"ADD_MEMBERSHIP", "REMOVE_MEMBERSHIP", "ERROR_BUDGET_RESET", "START", "END", "STAGE_START", "STAGE_END", "PAUSE", "RESUME", "ABORT", "TIMEOUT", "SIGNED_EULA",
					"ROLE_ASSIGNMENT_CREATED", "ROLE_ASSIGNMENT_UPDATED", "ROLE_ASSIGNMENT_DELETED", "MOVE", "ENABLED", "DISABLED", "DISMISS_ANOMALY", "RERUN", "BYPASS", "STABLE_VERSION_CHANGED",
					"SYNC_START", "START_IMPERSONATION", "END_IMPERSONATION", "MOVE_TO_GIT", "FREEZE_BYPASS", "EXPIRED", "FORCE_PUSH"),
			),
			WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			userIDList, err := OptionalParam[string](request, "user_id_list")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			actionsList, err := OptionalParam[string](request, "actions")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			startTime, _ := OptionalParam[string](request, "start_time")
			endTime, _ := OptionalParam[string](request, "end_time")

			startTimeMilliseconds := convertDateToMilliseconds(startTime)
			endTimeMilliseconds := convertDateToMilliseconds(endTime)

			data, err := auditClient.ListUserAuditTrail(ctx, scope, userIDList, actionsList, page, size, startTimeMilliseconds, endTimeMilliseconds, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to list the audit logs: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal the audit logs: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
