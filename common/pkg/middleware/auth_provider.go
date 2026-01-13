package middleware

import (
	"context"
	"net/http"

	config "github.com/harness/mcp-server/common"
)

// AccountExtractorMiddlewareProvider is the interface for creating authentication middleware
// Different implementations can be provided for internal and external modes
type AccountExtractorMiddlewareProvider interface {
	// AccountExtractorMiddleware creates an HTTP middleware that injects the account scope into the context
	// For external mode, authentication is handled via API keys in the HTTP client
	CreateAccountExtractorMiddleware(ctx context.Context, config *config.McpServerConfig, next http.Handler) http.Handler
}

// DefaultAccountExtractorMiddlewareProvider holds the active account extractor middleware provider implementation
// This will be set by the specific implementation (internal or external) during initialization
var DefaultAccountExtractorMiddlewareProvider AccountExtractorMiddlewareProvider

// SetAccountExtractorMiddlewareProvider allows setting a custom account extractor middleware provider
// This is useful for testing or custom implementations
func SetAccountExtractorMiddlewareProvider(provider AccountExtractorMiddlewareProvider) {
	DefaultAccountExtractorMiddlewareProvider = provider
}
