package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/auth"
	"github.com/harness/mcp-server/common/pkg/common"
	commonMiddleware "github.com/harness/mcp-server/common/pkg/middleware"
)

// ExternalAccountExtractorMiddlewareProvider implements AccountExtractorMiddlewareProvider for external mode
type ExternalAccountExtractorMiddlewareProvider struct{}

// CreateAccountExtractorMiddleware creates a middleware that:
// 1. Extracts authentication from incoming request headers
// 2. Extracts account ID from JWT claims if JWT is provided
// 3. Injects the account scope into the context
// 4. Passes authentication headers to downstream services via context
func (p *ExternalAccountExtractorMiddlewareProvider) CreateAccountExtractorMiddleware(ctx context.Context, config *config.McpServerConfig, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		newCtx := r.Context()

		// Extract authentication from incoming request
		// Priority: JWT Authorization header, then x-api-key header
		authHeader := r.Header.Get("Authorization")
		apiKeyHeader := r.Header.Get("x-api-key")
		accountIdHeader := r.Header.Get("Harness-Account")

		var accountID string
		var authErr error

		if authHeader != "" && strings.HasPrefix(authHeader, "IdentityService ") {
			// JWT token authentication
			slog.InfoContext(newCtx, "Received JWT authentication, extracting account ID from claims")

			// Check if the token is present in the header
			_, err := auth.ParseAuthorizationHeader(authHeader)
			if err != nil {
				slog.ErrorContext(newCtx, "Failed to parse Authorization header", "error", err)
				http.Error(w, "Invalid Authorization header", http.StatusUnauthorized)
				return
			}

			// Using the Harness-Account header as the account ID
			accountID = accountIdHeader

			slog.InfoContext(newCtx, "Successfully extracted account ID from Harness-Account header", "accountID", accountID)

			// Store the full auth header for pass-through to downstream services
			newCtx = auth.WithAuthInContext(newCtx, "Authorization", authHeader)

		} else if apiKeyHeader != "" {
			// API Key authentication
			slog.InfoContext(newCtx, "Received API Key authentication")

			// Extract account ID from API key
			accountID, authErr = extractAccountIDFromAPIKey(apiKeyHeader)
			if authErr != nil {
				slog.ErrorContext(newCtx, "Failed to extract account ID from API key", "error", authErr)
				http.Error(w, "Invalid API key format", http.StatusUnauthorized)
				return
			}

			slog.InfoContext(newCtx, "Successfully extracted account ID from API key", "accountID", accountID)

			// Store the API key for pass-through to downstream services
			newCtx = auth.WithAuthInContext(newCtx, "x-api-key", apiKeyHeader)

		} else {
			// No auth header provided in the request
			// Check if server has a configured API key to use as fallback
			if config.APIKey != "" {
				slog.InfoContext(newCtx, "No auth headers in request, using server's configured API key")
				accountID = config.AccountID
				// The ContextProvider will fall back to config.APIKey automatically
			} else {
				// No auth anywhere - reject the request
				slog.WarnContext(newCtx, "No authentication headers found in request and no fallback API key configured")
				http.Error(w, "Missing authentication headers (Authorization or x-api-key required)", http.StatusUnauthorized)
				return
			}
		}

		// Inject scope into context with the extracted account ID
		newCtx = common.WithScopeContext(newCtx, dto.Scope{
			AccountID: accountID,
		})

		r = r.WithContext(newCtx)
		next.ServeHTTP(w, r)
	})
}

// extractAccountIDFromAPIKey extracts the account ID from a Harness API key
// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
func extractAccountIDFromAPIKey(apiKey string) (string, error) {
	parts := strings.Split(apiKey, ".")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid API key format")
	}
	return parts[1], nil
}

// init registers the external auth middleware provider as the default
func init() {
	commonMiddleware.DefaultAccountExtractorMiddlewareProvider = &ExternalAccountExtractorMiddlewareProvider{}
}
