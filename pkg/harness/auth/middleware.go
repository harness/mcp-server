package auth

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
)

// AuthMiddleware creates an HTTP middleware that extracts bearer tokens from
// Authorization headers and authenticates the session using the provided secret.
// The authenticated session is added to the request context.
func AuthMiddleware(ctx context.Context, config *config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		if config.APIKey != "" {
			newCtx := common.WithScopeContext(r.Context(), dto.Scope{
				AccountID: config.AccountID,
			})
			r = r.WithContext(newCtx)
			next.ServeHTTP(w, r)
			return
		}

		// Extract the Authorization header
		authHeader := r.Header.Get("Authorization")
		parts := strings.Split(authHeader, " ")

		if len(parts) != 2 || parts[0] != "Bearer" {
			slog.ErrorContext(ctx, "invalid authorization header")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		token := parts[1]
		session, err := AuthenticateSession(token, config.McpSvcSecret)
		if err != nil {
			slog.ErrorContext(ctx, "failed to authenticate session", "error", err)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		// Add scope and session to the context
		newCtx := common.WithScopeContext(WithAuthSession(r.Context(), session), dto.Scope{
			AccountID: session.Principal.AccountID,
		})

		// Update request with new context
		r = r.WithContext(newCtx)

		// Pass the request to the next handler
		next.ServeHTTP(w, r)
	})
}
