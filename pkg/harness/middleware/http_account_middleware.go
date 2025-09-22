package middleware

import (
	"log/slog"
	"net/http"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
)

const harnessAccountHeader = "Harness-Account"

// HTTPAccountMiddleware creates an HTTP middleware that extracts account information
// from headers and adds it to the request context.
func HTTPAccountMiddleware(config *config.Config, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract account ID from headers
			accountID := extractAccountIDFromHeaders(r, logger)

			// Create scope object
			scope := dto.Scope{
				AccountID: accountID,
			}

			// Add scope to context
			if scope.AccountID != "" {
				ctx := common.WithScopeContext(r.Context(), scope)
				r = r.WithContext(ctx)
			}

			// Pass the request to the next handler
			next.ServeHTTP(w, r)
		})
	}
}

// extractAccountIDFromHeaders extracts the account ID from request headers
func extractAccountIDFromHeaders(r *http.Request, logger *slog.Logger) string {
	// Try to extract account ID from headers
	if accountID := r.Header.Get(harnessAccountHeader); accountID != "" {
		return accountID
	}

	logger.Debug("No account ID found in request headers")
	return ""
}
