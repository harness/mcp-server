package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	// "github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"time"
)

const (
    minPage = 0
    maxPage = 100
    minSize = 1
    maxSize = 100
)

func maxMin(val, min, max int) int {
    if(val < min) {
        return min
    }
    if(val > max) {
        return max
    }
    return val
}

// ListUserPipelineRunsTool creates a tool for listing all pipeline IDs run by a specific user.
func ListUserPipelineRunsTool(config *config.Config, auditClient *client.AuditService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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

        page = maxMin(page, minPage, maxPage)
        size = maxMin(size, minSize, maxSize)

		startTime, _ := OptionalParam[int64](request, "start_time")
		endTime, _ := OptionalParam[int64](request, "end_time")

        toGetModules := []string{"PMS", "CORE"}
        modules, _ := OptionalParam[[]string](request, "modules")
        if modules != nil {
            toGetModules = modules
        }

        data, err := auditClient.ListPipelineExecutionsByUser(ctx, scope, userID, toGetModules, page, size, startTime, endTime, nil)
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