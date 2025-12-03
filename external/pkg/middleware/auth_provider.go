package middleware

import (
	"context"
	"net/http"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	commonMiddleware "github.com/harness/mcp-server/common/pkg/middleware"
)

// ExternalAuthMiddlewareProvider implements AuthMiddlewareProvider for external mode
// It provides simple scope injection without authentication validation
type ExternalAuthMiddlewareProvider struct{}

// CreateAuthMiddleware creates a middleware that injects the account scope into the context
// For external mode, authentication is handled via API keys in the HTTP client
func (p *ExternalAuthMiddlewareProvider) CreateAuthMiddleware(ctx context.Context, config *config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		newCtx := common.WithScopeContext(r.Context(), dto.Scope{
			AccountID: config.AccountID,
		})
		r = r.WithContext(newCtx)
		next.ServeHTTP(w, r)
	})
}

// init registers the external auth middleware provider as the default
func init() {
	commonMiddleware.DefaultAuthMiddlewareProvider = &ExternalAuthMiddlewareProvider{}
}
