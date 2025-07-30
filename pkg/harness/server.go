package harness

import (
	"github.com/mark3labs/mcp-go/server"
)

// NewServer creates a new Harness MCP server
func NewServer(version string, opts ...server.ServerOption) *server.MCPServer {
	// Default options
	defaultOpts := []server.ServerOption{
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
		server.WithLogging(),
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
