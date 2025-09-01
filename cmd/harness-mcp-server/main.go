package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/types/enum"
)

var version = "0.1.0"
var commit = "dev"
var date = "unknown"

// extractAccountIDFromAPIKey extracts the account ID from a Harness API key
// API key format: pat.ACCOUNT_ID.TOKEN_ID.<>
func extractAccountIDFromAPIKey(apiKey string) (string, error) {
	parts := strings.Split(apiKey, ".")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid API key format")
	}
	return parts[1], nil
}

var (
	rootCmd = &cobra.Command{
		Use:     "harness-mcp-server",
		Short:   "Harness MCP Server",
		Long:    `A Harness MCP server that handles various tools and resources.`,
		Version: fmt.Sprintf("Version: %s\nCommit: %s\nBuild Date: %s", version, commit, date),
	}

	serverCmd = &cobra.Command{
		Use:   "server",
		Short: "Start MCP as a standalone server",
		Long:  `Start a standalone MCP server with HTTP or stdio transport.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			transportMode := viper.GetString("transport")
			var transportType enum.TransportType
			if transportMode == "" {
				transportType = enum.TransportStdio
			} else {
				transportType = enum.ParseTransportType(transportMode)
			}

			var toolsets []string
			err := viper.UnmarshalKey("toolsets", &toolsets)
			if err != nil {
				return fmt.Errorf("failed to unmarshal toolsets: %w", err)
			}

			var enableModules []string
			err = viper.UnmarshalKey("enable_modules", &enableModules)
			if err != nil {
				return fmt.Errorf("failed to unmarshal enabled modules: %w", err)
			}

			cfg := config.Config{
				Version:       version,
				ReadOnly:      viper.GetBool("read_only"),
				LogFilePath:   viper.GetString("log_file"),
				Debug:         viper.GetBool("debug"),
				EnableLicense: viper.GetBool("enable_license"),
				Transport:     transportType,
				HTTP: struct {
					Port int    `envconfig:"MCP_HTTP_PORT" default:"8080"`
					Path string `envconfig:"MCP_HTTP_PATH" default:"/mcp"`
				}{
					Port: viper.GetInt("http_port"),
					Path: viper.GetString("http_path"),
				},
				Toolsets:         toolsets,
				EnableModules:    enableModules,
			}

			return runMCPServer(ctx, cfg)
		},
	}

	stdioCmd = &cobra.Command{
		Use:   "stdio",
		Short: "Start stdio server",
		Long:  `Start a server that communicates via standard input/output streams using JSON-RPC messages.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			apiKey := viper.GetString("api_key")
			if apiKey == "" {
				return fmt.Errorf("API key not provided")
			}

			// Extract account ID from API key
			accountID, err := extractAccountIDFromAPIKey(apiKey)
			if err != nil {
				return fmt.Errorf("failed to extract account ID from API key: %w", err)
			}

			var toolsets []string
			err = viper.UnmarshalKey("toolsets", &toolsets)
			if err != nil {
				return fmt.Errorf("failed to unmarshal toolsets: %w", err)
			}

			var enableModules []string
			err = viper.UnmarshalKey("enable_modules", &enableModules)
			if err != nil {
				return fmt.Errorf("failed to unmarshal enabled modules: %w", err)
			}

			cfg := config.Config{
				Version:          version,
				BaseURL:          viper.GetString("base_url"),
				AccountID:        accountID,
				DefaultOrgID:     viper.GetString("default_org_id"),
				DefaultProjectID: viper.GetString("default_project_id"),
				APIKey:           apiKey,
				ReadOnly:         viper.GetBool("read_only"),
				Toolsets:         toolsets,
				LogFilePath:      viper.GetString("log_file"),
				Debug:            viper.GetBool("debug"),
				EnableModules:    enableModules,
				EnableLicense:    viper.GetBool("enable_license"),
			}

			if err := runStdioServer(ctx, cfg); err != nil {
				return fmt.Errorf("failed to run stdio server: %w", err)
			}
			return nil
		},
	}
)

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.SetVersionTemplate("{{.Short}}\n{{.Version}}\n")

	// Add global flags
	rootCmd.PersistentFlags().StringSlice("toolsets", harness.DefaultTools,
		"An optional comma separated list of groups of tools to allow, defaults to enabling all")
	rootCmd.PersistentFlags().StringSlice("enable-modules", []string{}, "Comma separated list of modules to enable")
	rootCmd.PersistentFlags().Bool("enable-license", false, "Enable license validation")
	rootCmd.PersistentFlags().Bool("read-only", false, "Restrict the server to read-only operations")
	rootCmd.PersistentFlags().String("log-file", "", "Path to log file")
	rootCmd.PersistentFlags().Bool("debug", false, "Enable debug logging")

	// Add transport configuration flags to server command
	serverCmd.PersistentFlags().String("transport", "stdio", "Transport mode: 'stdio' or 'http'")
	serverCmd.PersistentFlags().Int("http-port", 8080, "HTTP server port (when transport is 'http')")
	serverCmd.PersistentFlags().String("http-path", "/mcp", "HTTP server path (when transport is 'http')")

	// Add stdio-specific flags
	stdioCmd.Flags().String("base-url", "https://app.harness.io", "Base URL for Harness")
	stdioCmd.Flags().String("api-key", "", "API key for authentication")
	stdioCmd.Flags().String("default-org-id", "",
		"Default org ID to use. If not specified, it would need to be passed in the query (if required)")
	stdioCmd.Flags().String("default-project-id", "",
		"Default project ID to use. If not specified, it would need to be passed in the query (if required)")

	// Bind global flags to viper
	_ = viper.BindPFlag("toolsets", rootCmd.PersistentFlags().Lookup("toolsets"))
	_ = viper.BindPFlag("enable_modules", rootCmd.PersistentFlags().Lookup("enable-modules"))
	_ = viper.BindPFlag("enable_license", rootCmd.PersistentFlags().Lookup("enable-license"))
	_ = viper.BindPFlag("read_only", rootCmd.PersistentFlags().Lookup("read-only"))
	_ = viper.BindPFlag("log_file", rootCmd.PersistentFlags().Lookup("log-file"))
	_ = viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))

	// Bind transport configuration flags to viper
	_ = viper.BindPFlag("transport", serverCmd.PersistentFlags().Lookup("transport"))
	_ = viper.BindPFlag("http_port", serverCmd.PersistentFlags().Lookup("http-port"))
	_ = viper.BindPFlag("http_path", serverCmd.PersistentFlags().Lookup("http-path"))

	// Bind stdio-specific flags to viper
	_ = viper.BindPFlag("base_url", stdioCmd.Flags().Lookup("base-url"))
	_ = viper.BindPFlag("api_key", stdioCmd.Flags().Lookup("api-key"))
	_ = viper.BindPFlag("default_org_id", stdioCmd.Flags().Lookup("default-org-id"))
	_ = viper.BindPFlag("default_project_id", stdioCmd.Flags().Lookup("default-project-id"))

	// Add subcommands
	rootCmd.AddCommand(serverCmd)
	rootCmd.AddCommand(stdioCmd)
}

func initConfig() {
	// Initialize Viper configuration
	viper.SetEnvPrefix("harness")
	viper.AutomaticEnv()
}

func initLogger(outPath string, debug bool) error {
	if outPath == "" {
		return nil
	}

	file, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	handlerOpts := &slog.HandlerOptions{}
	if debug {
		handlerOpts.Level = slog.LevelDebug
	}

	logger := slog.New(slog.NewTextHandler(file, handlerOpts))
	slog.SetDefault(logger)
	return nil
}


// runMCPServer starts the MCP server with the specified transport (stdio or http)
func runMCPServer(ctx context.Context, config config.Config) error {
	err := initLogger(config.LogFilePath, config.Debug)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	slog.Info("Starting server (runMCPServer)", "transport", config.Transport)
	slog.Info("Using config (runMCPServer)", "config", config)

	// Define beforeInit function to add client info to user agent
	beforeInit := func(_ context.Context, _ any, message *mcp.InitializeRequest) {
		slog.Info("Client connected", "name", message.Params.ClientInfo.Name, "version",
			message.Params.ClientInfo.Version)
	}

	// Setup server hooks
	hooks := &server.Hooks{
		OnBeforeInitialize: []server.OnBeforeInitializeFunc{beforeInit},
	}

	// Create server
	// WithRecovery makes sure panics are logged and don't crash the server
	harnessServer := harness.NewServer(version, server.WithHooks(hooks), server.WithRecovery())

	// Initialize toolsets
	toolsets, err := harness.InitToolsets(ctx, &config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

	// Set the guidelines prompts
	prompts.RegisterPrompts(harnessServer)

	// Handle different transport modes
	if config.Transport == "http" {
		return runHTTPServer(ctx, harnessServer, config)
	} else {
		return runMCPStdioServer(ctx, harnessServer, config)
	}
}

// runHTTPServer starts the MCP server with HTTP transport
func runHTTPServer(ctx context.Context, harnessServer *server.MCPServer, config config.Config) error {
	// Create HTTP server
	httpServer := server.NewStreamableHTTPServer(harnessServer)
	// Start server
	address := fmt.Sprintf(":%d", config.HTTP.Port)
	slog.Info("Harness MCP Server running on HTTP", "version", version, "address", address, "path", config.HTTP.Path)
	errChan := make(chan error, 1)
	go func() {
		errChan <- httpServer.Start(address)
	}()

	// Wait for shutdown signal
	select {
	case <-ctx.Done():
		slog.Info("shutting down HTTP server...")
		return nil
	case err := <-errChan:
		if err != nil {
			slog.Error("error running HTTP server", "error", err)
			return fmt.Errorf("error running HTTP server: %w", err)
		}
		return nil
	}
}

// runStdioServer starts the MCP server with stdio transport
func runStdioServer(ctx context.Context, config config.Config) error {
	// Initialize the MCP server as before
	err := initLogger(config.LogFilePath, config.Debug)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	slog.Info("Starting server", "url", config.BaseURL)
	slog.Debug("Using ", "Config ->", config)

	// Define beforeInit function to add client info to user agent
	beforeInit := func(_ context.Context, _ any, message *mcp.InitializeRequest) {
		slog.Info("Client connected", "name", message.Params.ClientInfo.Name, "version",
			message.Params.ClientInfo.Version)
	}

	// Setup server hooks
	hooks := &server.Hooks{
		OnBeforeInitialize: []server.OnBeforeInitializeFunc{beforeInit},
	}

	// Create server
	// WithRecovery makes sure panics are logged and don't crash the server
	harnessServer := harness.NewServer(version, server.WithHooks(hooks), server.WithRecovery())

	// Initialize toolsets
	toolsets, err := harness.InitToolsets(ctx, &config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

	// Create module registry
	moduleRegistry := modules.NewModuleRegistry(&config, toolsets)

	// Register prompts generic
	prompts.RegisterPrompts(harnessServer)

	// Register prompts from all enabled modules
	err = moduleRegistry.RegisterPrompts(harnessServer)
	if err != nil {
		return fmt.Errorf("failed to register module prompts: %w", err)
	}

	// Create stdio server
	stdioServer := server.NewStdioServer(harnessServer)

	// Set error logger
	stdioServer.SetErrorLogger(slog.NewLogLogger(slog.Default().Handler(), slog.LevelError))

	// Start listening for messages
	errC := make(chan error, 1)
	go func() {
		in, out := io.Reader(os.Stdin), io.Writer(os.Stdout)
		errC <- stdioServer.Listen(ctx, in, out)
	}()

	// Output startup message
	slog.Info("Harness MCP Server running on stdio", "version", version)

	// Wait for shutdown signal
	select {
	case <-ctx.Done():
		slog.Info("shutting down server...")
	case err := <-errC:
		if err != nil {
			slog.Error("error running server", "error", err)
			return fmt.Errorf("error running server: %w", err)
		}
	}

	return nil
}

// runMCPStdioServer is the internal function that handles stdio transport with an existing server
func runMCPStdioServer(ctx context.Context, harnessServer *server.MCPServer, config config.Config) error {
	// Create stdio server
	stdioServer := server.NewStdioServer(harnessServer)

	// Set error logger
	stdioServer.SetErrorLogger(slog.NewLogLogger(slog.Default().Handler(), slog.LevelError))

	// Start listening for messages
	errC := make(chan error, 1)
	go func() {
		in, out := io.Reader(os.Stdin), io.Writer(os.Stdout)
		errC <- stdioServer.Listen(ctx, in, out)
	}()

	// Output startup message
	slog.Info("Harness MCP Server running on stdio (runMCPStdioServer)", "version", version)

	// Wait for shutdown signal
	select {
	case <-ctx.Done():
		slog.Info("shutting down server...")
	case err := <-errC:
		if err != nil {
			slog.Error("error running server", "error", err)
			return fmt.Errorf("error running server: %w", err)
		}
	}

	return nil
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
