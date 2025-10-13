package middleware

import (
	"net/http"

	"github.com/harness/harness-mcp/pkg/harness/logging"
)

// ConversationIDHeader is the header name for the conversation ID
const ConversationIDHeader = "X-Conversation-Id"

// LoggingMiddleware extracts the conversation ID from the request header
// and adds it to the request context for logging
func LoggingMiddleware(next http.Handler) http.Handler {
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
