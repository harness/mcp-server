package middleware

import (
    "context"
    "github.com/harness/mcp-server/common"
    "net/http"
)

// AuthMiddlewareProvider is the interface for creating authentication middleware
// Different implementations can be provided for internal and external modes
type AuthMiddlewareProvider interface {
	// CreateAuthMiddleware creates an HTTP middleware that handles authentication
    // and context enrichment based on the deployment mode
    CreateAuthMiddleware(ctx context.Context, config *config.Config, next http.Handler) http.Handler
}

// DefaultAuthMiddlewareProvider holds the active auth middleware provider implementation
// This will be set by the specific implementation (internal or external) during initialization
var DefaultAuthMiddlewareProvider AuthMiddlewareProvider

// SetAuthMiddlewareProvider allows setting a custom auth middleware provider
// This is useful for testing or custom implementations
func SetAuthMiddlewareProvider(provider AuthMiddlewareProvider) {
    DefaultAuthMiddlewareProvider = provider
}