package middleware

import (
    "context"
    "net/http"

    config "github.com/harness/mcp-server/common"
    commonMiddleware "github.com/harness/mcp-server/common/pkg/middleware"
)

// AuthMiddleware creates authentication middleware using the configured provider
// This function maintains backward compatibility while delegating to the provider pattern
func AuthMiddleware(ctx context.Context, config *config.Config, next http.Handler) http.Handler {
    if commonMiddleware.DefaultAuthMiddlewareProvider == nil {
        panic("AuthMiddlewareProvider not initialized")
    }
    return commonMiddleware.DefaultAuthMiddlewareProvider.CreateAuthMiddleware(ctx, config, next)
}
