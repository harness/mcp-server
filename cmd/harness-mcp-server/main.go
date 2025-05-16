package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
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

	stdioCmd = &cobra.Command{
		Use:   "stdio",
		Short: "Start stdio server",
		Long:  `Start a server that communicates via standard input/output streams using JSON-RPC messages.`,
		RunE: func(_ *cobra.Command, _ []string) error {
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
				return fmt.Errorf("Failed to unmarshal toolsets: %w", err)
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
			}

			if err := runStdioServer(cfg); err != nil {
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
	rootCmd.PersistentFlags().Bool("read-only", false, "Restrict the server to read-only operations")
	rootCmd.PersistentFlags().String("log-file", "", "Path to log file")
	rootCmd.PersistentFlags().Bool("debug", false, "Enable debug logging")
	rootCmd.PersistentFlags().String("base-url", "https://app.harness.io", "Base URL for Harness")
	rootCmd.PersistentFlags().String("api-key", "", "API key for authentication")
	rootCmd.PersistentFlags().String("default-org-id", "",
		"Default org ID to use. If not specified, it would need to be passed in the query (if required)")
	rootCmd.PersistentFlags().String("default-project-id", "",
		"Default project ID to use. If not specified, it would need to be passed in the query (if required)")

	// Bind flags to viper
	_ = viper.BindPFlag("toolsets", rootCmd.PersistentFlags().Lookup("toolsets"))
	_ = viper.BindPFlag("read_only", rootCmd.PersistentFlags().Lookup("read-only"))
	_ = viper.BindPFlag("log_file", rootCmd.PersistentFlags().Lookup("log-file"))
	_ = viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))
	_ = viper.BindPFlag("base_url", rootCmd.PersistentFlags().Lookup("base-url"))
	_ = viper.BindPFlag("api_key", rootCmd.PersistentFlags().Lookup("api-key"))
	_ = viper.BindPFlag("default_org_id", rootCmd.PersistentFlags().Lookup("default-org-id"))
	_ = viper.BindPFlag("default_project_id", rootCmd.PersistentFlags().Lookup("default-project-id"))

	// Add subcommands
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

type runConfig struct {
	readOnly        bool
	logger          *log.Logger
	logCommands     bool
	enabledToolsets []string
}

func runStdioServer(config config.Config) error {
	// Create app context
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	err := initLogger(config.LogFilePath, config.Debug)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}

	slog.Info("Starting server", "url", config.BaseURL)

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

	client, err := client.NewWithToken(config.BaseURL, config.APIKey)
	if err != nil {
		slog.Error("Failed to create client", "error", err)
		return fmt.Errorf("failed to create client: %w", err)
	}

	// Initialize toolsets
	toolsets, err := harness.InitToolsets(client, &config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

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

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
