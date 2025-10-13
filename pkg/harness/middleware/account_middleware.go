package middleware

import (
	"context"
	"net/http"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/harness/harness-mcp/pkg/harness/logging"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ConversationIDHeader is the header name for the conversation ID
const ConversationIDHeader = "X-Conversation-Id"

// WithHarnessScope creates a middleware that extracts the scope from the request
// and adds it to the context for all tool handlers
func WithHarnessScope(config *config.Config) server.ToolHandlerMiddleware {
	return func(next server.ToolHandlerFunc) server.ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract scope from the request
			scope, err := common.FetchScope(ctx, config, request, false)
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


// MetadataMiddleware extracts the conversation ID from the request header
// and adds it to the request context for logging
func MetadataMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract conversation ID from header
		conversationID := r.Header.Get(ConversationIDHeader)
		// If conversation ID exists, add it to context
		if conversationID != "" {
			// Add to request context
			ctx := logging.AppendCtx(r.Context(), conversationID)
			// Update request with new context
			r = r.WithContext(ctx)
		}
		// Pass the request to the next handler
		next.ServeHTTP(w, r)
	})
}