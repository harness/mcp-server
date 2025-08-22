package middleware

import (
	"context"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// WithAccountID creates a middleware that extracts the scope from the request
// and adds it to the context for all tool handlers
func WithAccountID(config *config.Config) server.ToolHandlerMiddleware {
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

			// For backward compatibility, also add account ID directly
			if scope.AccountID != "" {
				ctx = context.WithValue(ctx, common.AccountIDKey{}, scope.AccountID)
			}

			// Call the next handler with the enriched context
			return next(ctx, request)
		}
	}
}

// GetAccountID retrieves the account ID from the context
func GetAccountID(ctx context.Context) (string, error) {
	return common.GetAccountIDFromContext(ctx)
}
