package harness

import (
	"log/slog"
	"os"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/logging"
	"github.com/harness/harness-mcp/pkg/harness/middleware"
	"github.com/mark3labs/mcp-go/server"
)

// NewServer creates a new Harness MCP server
func NewServer(version string, config *config.Config, opts ...server.ServerOption) *server.MCPServer {
	// Setup structured logging
	logger := setupLogger()

	// Default options
	defaultOpts := []server.ServerOption{
		server.WithToolCapabilities(true),
		server.WithResourceCapabilities(true, true),
		server.WithPromptCapabilities(true),
		server.WithLogging(),
		// Add error handling middleware (applied in order)
		server.WithToolHandlerMiddleware(middleware.ErrorRecoveryMiddleware(logger)),
		server.WithToolHandlerMiddleware(middleware.ErrorHandlerMiddleware(logger)),
		server.WithToolHandlerMiddleware(middleware.WithHarnessScope(config)),
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

// setupLogger creates and configures the structured logger
func setupLogger() *logging.StructuredLogger {
	// Create a JSON logger with appropriate level
	level := slog.LevelInfo
	if envLevel := os.Getenv("LOG_LEVEL"); envLevel != "" {
		switch envLevel {
		case "DEBUG":
			level = slog.LevelDebug
		case "INFO":
			level = slog.LevelInfo
		case "WARN":
			level = slog.LevelWarn
		case "ERROR":
			level = slog.LevelError
		}
	}

	handler := logging.NewLoggingHandler(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))

	logger := slog.New(handler)
	return logging.NewStructuredLogger(logger)
}
