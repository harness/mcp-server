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

// ListAuditsOfUser creates a tool for listing the audit trail.
func ListUserAuditTrail(config *config.Config, auditClient *client.AuditService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_user_audits",
			mcp.WithDescription("List the audit trail of the user."),
			mcp.WithString("user_id",
				mcp.Required(),
				mcp.Description("The user id used to retrieve the audit trail."),
			),
			mcp.WithNumber("start_time",
				mcp.Description("Optional start time in milliseconds"),
				mcp.DefaultNumber(0),
			),
			mcp.WithNumber("end_time",
				mcp.Description("Optional end time in milliseconds"),
				mcp.DefaultNumber(float64(time.Now().UnixMilli())),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			userID, err := requiredParam[string](request, "user_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := fetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := fetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			startTime, _ := OptionalParam[int64](request, "start_time")
			endTime, _ := OptionalParam[int64](request, "end_time")

			data, err := auditClient.ListUserAuditTrail(ctx, scope, userID, page, size, startTime, endTime, nil)
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
