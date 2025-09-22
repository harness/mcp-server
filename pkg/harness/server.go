package harness

import (
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/middleware"
	"github.com/mark3labs/mcp-go/server"
)

// NewServer creates a new Harness MCP server
func NewServer(version string, config *config.Config, opts ...server.ServerOption) *server.MCPServer {
	// Default options
	defaultOpts := []server.ServerOption{
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
		server.WithPromptCapabilities(true),
		server.WithLogging(),
		server.WithToolHandlerMiddleware(
			chainMiddleware(
				middleware.WithDynamicToolFiltering(&middleware.DynamicToolFilteringConfig{
					HeaderExtractor: &middleware.DefaultHeaderExtractor{},
					CacheTTL:       5 * time.Minute,
					Logger:         slog.Default(),
					Config:         config,
				}),
				middleware.WithHarnessScope(config),
			),
		),
	}
	opts = append(defaultOpts, opts...)

	// Create a new MCP server
	s := server.NewMCPServer(
		"harness-mcp-server",
		version,
		opts...,
	)
	s.EnableSampling()
	return s
}

// chainMiddleware chains multiple tool handler middlewares together
func chainMiddleware(middlewares ...server.ToolHandlerMiddleware) server.ToolHandlerMiddleware {
	return func(next server.ToolHandlerFunc) server.ToolHandlerFunc {
		// Apply middlewares in reverse order so they execute in the correct order
		handler := next
		for i := len(middlewares) - 1; i >= 0; i-- {
			handler = middlewares[i](handler)
		}
		return handler
	}
}
