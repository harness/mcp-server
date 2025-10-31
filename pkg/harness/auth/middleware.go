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

		if config.SkipAuthForLocal {
			account_id := r.Header.Get("harness-account")
			if account_id == "" {
				slog.ErrorContext(ctx, "account id not provided")
				w.WriteHeader(http.StatusUnauthorized)
				return
			}

			// Create a mock session for local development
			session := &Session{
				Principal: Principal{
					ID:          1,
					UID:         "local-dev-user",
					Email:       "local-dev@harness.io",
					Type:        "USER",
					DisplayName: "Local Dev User",
					AccountID:   account_id,
				},
			}

			// Add session to context
			newCtx := WithAuthSession(r.Context(), session)

			// Also add scope to context
			newCtx = common.WithScopeContext(newCtx, dto.Scope{
				AccountID: account_id,
			})

			// Update request with new context
			r = r.WithContext(newCtx)
			// Pass the request to the next handler
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
