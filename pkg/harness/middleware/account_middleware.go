package middleware

import (
	"context"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// WithHarnessScope creates a middleware that extracts the scope from the request
// and adds it to the context for all tool handlers
func WithHarnessScope(config *config.Config) server.ToolHandlerMiddleware {
	return func(next server.ToolHandlerFunc) server.ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract scope from the request
			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				// If we can't get the scope, continue with the request
				// The tool handler will handle this error if needed
				return next(ctx, request)
			}

			// Add the entire scope to the context
			ctx = common.WithScopeContext(ctx, scope)

			// Call the next handler with the enriched context
			return next(ctx, request)
		}
	}
}
