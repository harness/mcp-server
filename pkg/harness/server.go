package harness

import (
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
		server.WithToolHandlerMiddleware(middleware.WithAccountID(config)),
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
