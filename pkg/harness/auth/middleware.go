package auth

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
)

// AuthMiddleware creates an HTTP middleware that extracts bearer tokens from
// Authorization headers and authenticates the session using the provided secret.
// The authenticated session is added to the request context.
func AuthMiddleware(config *config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract the Authorization header
		bearerToken := r.Header.Get("Authorization")
		token := bearerToken
		if strings.HasPrefix(strings.ToLower(bearerToken), "bearer ") {
			token = bearerToken[7:] // Remove "Bearer " prefix (7 characters)
		}
		if config.McpSvcSecret != "" && token != "" {
			// Authenticate the session
			session, err := AuthenticateSession(token, config.McpSvcSecret)
			if err != nil {
				slog.Error("failed to authenticate session", "error", err)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}

			// Update the config with the account ID from the session
			if session.Principal.AccountID != "" {
				config.AccountID = session.Principal.AccountID
				slog.Info("Updated config with account ID from session", "accountID", config.AccountID)
			}

			// Create a new context with the authenticated session
			newCtx := WithAuthSession(r.Context(), session)

			// Update request with new context
			r = r.WithContext(newCtx)
		}

		// Pass the request to the next handler
		next.ServeHTTP(w, r)
	})
}
