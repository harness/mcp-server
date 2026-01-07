package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg"
	"github.com/harness/mcp-server/common/pkg/prompts"
	"github.com/harness/mcp-server/common/pkg/types/enum"
	tools "github.com/harness/mcp-server/pkg"
	"github.com/harness/mcp-server/pkg/middleware"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	_ "github.com/harness/mcp-server/client"
	_ "github.com/harness/mcp-server/pkg/modules"
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
		Use:     "mcp-server",
		Short:   "Harness MCP Server",
		Long:    `A Harness MCP server that handles various tools and resources.`,
		Version: fmt.Sprintf("Version: %s\nCommit: %s\nBuild Date: %s", version, commit, date),
	}

	httpServerCmd = &cobra.Command{
		Use:   "http-server",
		Short: "Start MCP as a standalone server with HTTP transport",
		Long:  `Start a standalone MCP server with HTTP transport`,
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			transportType := enum.TransportHTTP

			apiKey := viper.GetString("api_key")
			if apiKey == "" {
				return fmt.Errorf("API key not provided")
			}
			accountID, err := extractAccountIDFromAPIKey(apiKey)
			if err != nil {
				return fmt.Errorf("failed to extract account ID from API key: %w", err)
			}

			var toolsets []string
			err = viper.UnmarshalKey("toolsets", &toolsets)
			if err != nil {
				return fmt.Errorf("failed to unmarshal toolsets: %w", err)
			}

			var logFormat enum.LogFormatType = enum.LogFormatText
			if viper.GetString("log_format") == "json" {
				logFormat = enum.LogFormatJSON
			}

			cfg := config.McpServerConfig{
				Version:   version,
				ReadOnly:  viper.GetBool("read_only"),
				Debug:     viper.GetBool("debug"),
				Transport: transportType,
				HTTP: struct {
					Port int    `envconfig:"MCP_HTTP_PORT" default:"8080"`
					Path string `envconfig:"MCP_HTTP_PATH" default:"/mcp"`
				}{
					Port: viper.GetInt("http_port"),
					Path: viper.GetString("http_path"),
				},
				Toolsets:         toolsets,
				LogFormat:        logFormat,
				AccountID:        accountID,
				APIKey:           apiKey,
				BaseURL:          viper.GetString("base_url"),
				OutputDir:        viper.GetString("output_dir"),
				DefaultOrgID:     viper.GetString("default_org_id"),
				DefaultProjectID: viper.GetString("default_project_id"),
				LogFilePath:      viper.GetString("log_file_path"),
			}

			return runHTTPServer(ctx, cfg)
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

			var logFormat enum.LogFormatType = enum.LogFormatText
			if viper.GetString("log_format") == "json" {
				logFormat = enum.LogFormatJSON
			}

			cfg := config.McpServerConfig{
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
				OutputDir:        viper.GetString("output_dir"),
				LogFormat:        logFormat,
			}

			if err := runStdioServer(ctx, cfg); err != nil {
				return fmt.Errorf("failed to run stdio server: %w", err)
			}
			return nil
		},
	}
)

func initConfig() {
	// Initialize Viper configuration
	viper.SetEnvPrefix("harness")
	viper.AutomaticEnv()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.SetVersionTemplate("{{.Short}}\n{{.Version}}\n")

	rootCmd.PersistentFlags().StringSlice("toolsets", []string{}, "An optional comma separated list of groups of tools to allow, defaults to enabling all")
	rootCmd.PersistentFlags().Bool("read-only", false, "Restrict the server to read-only operations")
	rootCmd.PersistentFlags().String("log-file", "harness-mcp.log", "Path to log file (default: harness-mcp.log)")
	rootCmd.PersistentFlags().Bool("debug", false, "Enable debug logging")
	rootCmd.PersistentFlags().String("output-dir", "", "Directory where the tool writes output files (e.g., pipeline logs)")
	rootCmd.PersistentFlags().String("log-format", "text", "Log format (text or json)")
	rootCmd.PersistentFlags().String("api-key", "", "API key for authentication")
	rootCmd.PersistentFlags().String("base-url", "https://app.harness.io", "Base URL for Harness")
	rootCmd.PersistentFlags().String("default-org-id", "", "Default organization ID")
	rootCmd.PersistentFlags().String("default-project-id", "", "Default project ID")
	httpServerCmd.PersistentFlags().Int("http-port", 8080, "HTTP server port (when transport is 'http')")
	httpServerCmd.PersistentFlags().String("http-path", "/mcp", "HTTP server path (when transport is 'http')")

	_ = viper.BindPFlag("toolsets", rootCmd.PersistentFlags().Lookup("toolsets"))
	_ = viper.BindPFlag("read_only", rootCmd.PersistentFlags().Lookup("read-only"))
	_ = viper.BindPFlag("log_file", rootCmd.PersistentFlags().Lookup("log-file"))
	_ = viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))
	_ = viper.BindPFlag("output_dir", rootCmd.PersistentFlags().Lookup("output-dir"))
	_ = viper.BindPFlag("log_format", rootCmd.PersistentFlags().Lookup("log-format"))
	_ = viper.BindPFlag("api_key", rootCmd.PersistentFlags().Lookup("api-key"))
	_ = viper.BindPFlag("base_url", rootCmd.PersistentFlags().Lookup("base-url"))
	_ = viper.BindPFlag("default_org_id", rootCmd.PersistentFlags().Lookup("default-org-id"))
	_ = viper.BindPFlag("default_project_id", rootCmd.PersistentFlags().Lookup("default-project-id"))
	_ = viper.BindPFlag("http_port", httpServerCmd.PersistentFlags().Lookup("http-port"))
	_ = viper.BindPFlag("http_path", httpServerCmd.PersistentFlags().Lookup("http-path"))

	rootCmd.AddCommand(httpServerCmd)
	rootCmd.AddCommand(stdioCmd)
}

func initLogging(config config.McpServerConfig) error {
	debug := config.Debug
	logFormat := config.LogFormat
	outPath := config.LogFilePath
	handlerOpts := &slog.HandlerOptions{}
	if debug {
		handlerOpts.Level = slog.LevelDebug
	}

	var writer io.Writer = os.Stderr
	if outPath != "" {
		file, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			return fmt.Errorf("failed to open log file: %w", err)
		}
		writer = file
	}

	// Create the appropriate handler based on format
	var handler slog.Handler
	if logFormat == enum.LogFormatJSON {
		handler = slog.NewJSONHandler(writer, handlerOpts)
	} else {
		handler = slog.NewTextHandler(writer, handlerOpts)
	}

	slog.SetDefault(slog.New(handler))
	return nil
}

func runHTTPServer(ctx context.Context, config config.McpServerConfig) error {
	err := initLogging(config)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	slog.Info("Starting server (runHTTPServer)", "transport", config.Transport)
	slog.Info("Using config (runHTTPServer)", "config", config)

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
	harnessServer := pkg.NewServer(version, &config, server.WithHooks(hooks), server.WithRecovery())

	// Initialize toolsets
	toolsets, err := tools.InitToolsets(ctx, &config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

	// Set the guidelines prompts
	prompts.RegisterPrompts(harnessServer)

	// Create HTTP server
	httpServer := server.NewStreamableHTTPServer(harnessServer)

	// Add middleware
	authMiddleware := middleware.AuthMiddleware(ctx, &config, httpServer)

	mux := http.NewServeMux()
	mux.Handle(config.HTTP.Path, authMiddleware)

	// Add health endpoint for Kubernetes probes
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	address := fmt.Sprintf(":%d", config.HTTP.Port)
	slog.Info("Harness MCP Server running on HTTP",
		"version", version,
		"address", address,
		"path", config.HTTP.Path,
	)

	srv := &http.Server{
		Addr:    address,
		Handler: mux,
	}

	errChan := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- err
		}
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

func runStdioServer(ctx context.Context, config config.McpServerConfig) error {
	err := initLogging(config)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	slog.Info("Starting server (runStdioServer)", "transport", config.Transport)
	slog.Info("Using config (runStdioServer)", "config", config)

	// Define beforeInit function to add client info to user agent
	beforeInit := func(_ context.Context, _ any, message *mcp.InitializeRequest) {
		slog.Info("Client connected", "name", message.Params.ClientInfo.Name, "version",
			message.Params.ClientInfo.Version)
	}

	hooks := &server.Hooks{
		OnBeforeInitialize: []server.OnBeforeInitializeFunc{beforeInit},
	}

	// Create server
	// WithRecovery makes sure panics are logged and don't crash the server
	harnessServer := pkg.NewServer(version, &config, server.WithHooks(hooks), server.WithRecovery())

	toolsets, err := tools.InitToolsets(ctx, &config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

	// Set the guidelines prompts
	prompts.RegisterPrompts(harnessServer)

	stdioServer := server.NewStdioServer(harnessServer)

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

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
