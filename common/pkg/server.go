package pkg

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/middleware"
	"github.com/mark3labs/mcp-go/server"
)

// NewServer creates a new Harness MCP server
func NewServer(version string, config *config.McpServerConfig, opts ...server.ServerOption) *server.MCPServer {
	// Default options
	defaultOpts := []server.ServerOption{
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
		server.WithPromptCapabilities(true),
		server.WithLogging(),
		server.WithToolHandlerMiddleware(middleware.WithHarnessScope(config)),
	}
	opts = append(defaultOpts, opts...)

	// Create a new MCP server
	s := server.NewMCPServer(
		"mcp-server",
		version,
		opts...,
	)
	s.EnableSampling()
	return s
}
