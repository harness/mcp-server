package main

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"io"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/harness/harness-mcp/pkg/harness/auth"
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
				EnabledModules:   harness.EnabledModules,
			}

			if err := runStdioServer(ctx, cfg); err != nil {
				return fmt.Errorf("failed to run stdio server: %w", err)
			}
			return nil
		},
	}

	// TODO: this will move to streamable HTTP once the service is setup
	internalCmd = &cobra.Command{
		Use:   "internal",
		Short: "Start stdio server in internal mode",
		Long:  `Start a server that communicates via standard input/output streams using JSON-RPC messages with additional internal credentials.`,
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			// TODO: get this from request header and add in the context once we move to streamable HTTP
			bearerToken := viper.GetString("bearer_token")
			if bearerToken == "" {
				return fmt.Errorf("bearer token not provided")
			}

			mcpSecret := viper.GetString("mcp_svc_secret")
			if mcpSecret == "" {
				return fmt.Errorf("MCP service secret not provided")
			}

			// Move this out to middleware once we move to streamable HTTP
			session, err := auth.AuthenticateSession(bearerToken, mcpSecret)
			if err != nil {
				return fmt.Errorf("Failed to authenticate session: %w", err)
			}

			// Store the authenticated session in the context
			ctx = auth.WithAuthSession(ctx, session)

			var toolsets []string
			err = viper.UnmarshalKey("toolsets", &toolsets)
			if err != nil {
				return fmt.Errorf("Failed to unmarshal toolsets: %w", err)
			}

			cfg := config.Config{
				// Common fields
				Version:        version,
				ReadOnly:       true, // we keep it read-only for now
				Toolsets:       toolsets,
				EnabledModules: harness.EnabledModules,
				LogFilePath:    viper.GetString("log_file"),
				Debug:          viper.GetBool("debug"),
				Internal:       true,
				AccountID:      session.Principal.AccountID,
				// Internal mode specific fields
				BearerToken:             viper.GetString("bearer_token"),
				PipelineSvcBaseURL:      viper.GetString("pipeline_svc_base_url"),
				PipelineSvcSecret:       viper.GetString("pipeline_svc_secret"),
				NgManagerBaseURL:        viper.GetString("ng_manager_base_url"),
				NgManagerSecret:         viper.GetString("ng_manager_secret"),
				ChatbotBaseURL:          viper.GetString("chatbot_base_url"),
				ChatbotSecret:           viper.GetString("chatbot_secret"),
				GenaiBaseURL:            viper.GetString("genai_base_url"),
				GenaiSecret:             viper.GetString("genai_secret"),
				ArtifactRegistryBaseURL: viper.GetString("artifact_registry_base_url"),
				ArtifactRegistrySecret:  viper.GetString("artifact_registry_secret"),
				NextgenCEBaseURL:        viper.GetString("nextgen_ce_base_url"),
				NextgenCESecret:         viper.GetString("nextgen_ce_secret"),
				IDPSvcBaseURL:           viper.GetString("idp_svc_base_url"),
				IDPSvcSecret:            viper.GetString("idp_svc_secret"),
				McpSvcSecret:            viper.GetString("mcp_svc_secret"),
				ChaosManagerSvcBaseURL:  viper.GetString("chaos_manager_svc_base_url"),
				ChaosManagerSvcSecret:   viper.GetString("chaos_manager_svc_secret"),
				TemplateSvcBaseURL:      viper.GetString("template_svc_base_url"),
				TemplateSvcSecret:       viper.GetString("template_svc_secret"),
				IntelligenceSvcBaseURL:  viper.GetString("intelligence_svc_base_url"),
				IntelligenceSvcSecret:   viper.GetString("intelligence_svc_secret"),
				CodeSvcBaseURL:          viper.GetString("code_svc_base_url"),
				CodeSvcSecret:           viper.GetString("code_svc_secret"),
				LogSvcBaseURL:           viper.GetString("log_svc_base_url"),
				LogSvcSecret:            viper.GetString("log_svc_secret"),
				SCSSvcSecret:            viper.GetString("scs_svc_secret"),
				SCSSvcBaseURL:           viper.GetString("scs_svc_base_url"),
				STOSvcSecret:            viper.GetString("sto_svc_secret"),
				STOSvcBaseURL:           viper.GetString("sto_svc_base_url"),
				AuditSvcBaseURL:         viper.GetString("audit_svc_base_url"),
				AuditSvcSecret:          viper.GetString("audit_svc_secret"),
				DBOpsSvcBaseURL:         viper.GetString("dbops_svc_base_url"),
				DBOpsSvcSecret:          viper.GetString("dbops_svc_secret"),
				RBACSvcBaseURL:          viper.GetString("rbac_svc_base_url"),
				RBACSvcSecret:           viper.GetString("rbac_svc_secret"),
				ResourceGroupSvcBaseURL: viper.GetString("resource_group_svc_base_url"),
				ResourceGroupSvcSecret:  viper.GetString("resource_group_svc_secret"),
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
	rootCmd.PersistentFlags().Bool("read-only", false, "Restrict the server to read-only operations")
	rootCmd.PersistentFlags().String("log-file", "", "Path to log file")
	rootCmd.PersistentFlags().Bool("debug", false, "Enable debug logging")

	// Add stdio-specific flags
	stdioCmd.Flags().String("base-url", "https://app.harness.io", "Base URL for Harness")
	stdioCmd.Flags().String("api-key", "", "API key for authentication")
	stdioCmd.Flags().String("default-org-id", "",
		"Default org ID to use. If not specified, it would need to be passed in the query (if required)")
	stdioCmd.Flags().String("default-project-id", "",
		"Default project ID to use. If not specified, it would need to be passed in the query (if required)")

	// Add internal-specific flags
	internalCmd.Flags().String("bearer-token", "", "Bearer token for authentication")
	internalCmd.Flags().String("pipeline-svc-base-url", "", "Base URL for pipeline service")
	internalCmd.Flags().String("pipeline-svc-secret", "", "Secret for pipeline service")
	internalCmd.Flags().String("ng-manager-base-url", "", "Base URL for NG manager")
	internalCmd.Flags().String("ng-manager-secret", "", "Secret for NG manager")
	internalCmd.Flags().String("chatbot-base-url", "", "Base URL for chatbot service")
	internalCmd.Flags().String("chatbot-secret", "", "Secret for chatbot service")
	internalCmd.Flags().String("genai-base-url", "", "Base URL for genai service")
	internalCmd.Flags().String("genai-secret", "", "Secret for genai service")
	internalCmd.Flags().String("mcp-svc-secret", "", "Secret for MCP service")
	internalCmd.Flags().String("artifact-registry-base-url", "", "Base URL for artifact registry service")
	internalCmd.Flags().String("artifact-registry-secret", "", "Secret for artifact registry service")
	internalCmd.Flags().String("nextgen-ce-base-url", "", "Base URL for Nextgen CE service")
	internalCmd.Flags().String("nextgen-ce-secret", "", "Secret for Nextgen CE service")
	internalCmd.Flags().String("chaos-manager-svc-base-url", "", "Base URL for chaos manager service")
	internalCmd.Flags().String("chaos-manager-svc-secret", "", "Secret for chaos manager service")
	internalCmd.Flags().String("code-svc-base-url", "", "Base URL for code service")
	internalCmd.Flags().String("code-svc-secret", "", "Secret for code service")
	internalCmd.Flags().String("dashboard-svc-base-url", "", "Base URL for dashboard service")
	internalCmd.Flags().String("dashboard-svc-secret", "", "Secret for dashboard service")
	internalCmd.Flags().String("log-svc-base-url", "", "Base URL for log service")
	internalCmd.Flags().String("log-service-secret", "", "Secret for log service")
	internalCmd.Flags().String("scs-svc-secret", "", "Secret for SCS service")
	internalCmd.Flags().String("scs-svc-base-url", "", "Base URL for SCS service")
	internalCmd.Flags().String("sto-svc-secret", "", "Secret for STO service")
	internalCmd.Flags().String("sto-svc-base-url", "", "Base URL for STO service")
	internalCmd.Flags().String("audit-svc-base-url", "", "Base URL for audit service")
	internalCmd.Flags().String("audit-svc-secret", "", "Secret for audit service")
	internalCmd.Flags().String("dbops-svc-base-url", "", "Base URL for dbops service")
	internalCmd.Flags().String("dbops-svc-secret", "", "Secret for dbops service")
	internalCmd.Flags().String("rbac-svc-base-url", "", "Base URL for RBAC service")
	internalCmd.Flags().String("rbac-svc-secret", "", "Secret for RBAC service")
	internalCmd.Flags().String("resource-group-svc-base-url", "", "Base URL for resource group service")
	internalCmd.Flags().String("resource-group-svc-secret", "", "Secret for resource group service")

	// Bind global flags to viper
	_ = viper.BindPFlag("toolsets", rootCmd.PersistentFlags().Lookup("toolsets"))
	_ = viper.BindPFlag("read_only", rootCmd.PersistentFlags().Lookup("read-only"))
	_ = viper.BindPFlag("log_file", rootCmd.PersistentFlags().Lookup("log-file"))
	_ = viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))

	// Bind stdio-specific flags to viper
	_ = viper.BindPFlag("base_url", stdioCmd.Flags().Lookup("base-url"))
	_ = viper.BindPFlag("api_key", stdioCmd.Flags().Lookup("api-key"))
	_ = viper.BindPFlag("default_org_id", stdioCmd.Flags().Lookup("default-org-id"))
	_ = viper.BindPFlag("default_project_id", stdioCmd.Flags().Lookup("default-project-id"))

	// Bind internal-specific flags to viper
	_ = viper.BindPFlag("bearer_token", internalCmd.Flags().Lookup("bearer-token"))
	_ = viper.BindPFlag("pipeline_svc_base_url", internalCmd.Flags().Lookup("pipeline-svc-base-url"))
	_ = viper.BindPFlag("pipeline_svc_secret", internalCmd.Flags().Lookup("pipeline-svc-secret"))
	_ = viper.BindPFlag("ng_manager_base_url", internalCmd.Flags().Lookup("ng-manager-base-url"))
	_ = viper.BindPFlag("ng_manager_secret", internalCmd.Flags().Lookup("ng-manager-secret"))
	_ = viper.BindPFlag("chatbot_base_url", internalCmd.Flags().Lookup("chatbot-base-url"))
	_ = viper.BindPFlag("chatbot_secret", internalCmd.Flags().Lookup("chatbot-secret"))
	_ = viper.BindPFlag("genai_base_url", internalCmd.Flags().Lookup("genai-base-url"))
	_ = viper.BindPFlag("genai_secret", internalCmd.Flags().Lookup("genai-secret"))
	_ = viper.BindPFlag("mcp_svc_secret", internalCmd.Flags().Lookup("mcp-svc-secret"))
	_ = viper.BindPFlag("artifact_registry_base_url", internalCmd.Flags().Lookup("artifact-registry-base-url"))
	_ = viper.BindPFlag("artifact_registry_secret", internalCmd.Flags().Lookup("artifact-registry-secret"))
	_ = viper.BindPFlag("nextgen_ce_base_url", internalCmd.Flags().Lookup("nextgen-ce-base-url"))
	_ = viper.BindPFlag("nextgen_ce_secret", internalCmd.Flags().Lookup("nextgen-ce-secret"))
	_ = viper.BindPFlag("template_svc_base_url", internalCmd.Flags().Lookup("template-svc-base-url"))
	_ = viper.BindPFlag("template_svc_secret", internalCmd.Flags().Lookup("template-svc-secret"))
	_ = viper.BindPFlag("intelligence_svc_base_url", internalCmd.Flags().Lookup("intelligence-svc-base-url"))
	_ = viper.BindPFlag("intelligence_svc_secret", internalCmd.Flags().Lookup("intelligence-svc-secret"))
	_ = viper.BindPFlag("chaos_manager_svc_base_url", internalCmd.Flags().Lookup("chaos-manager-svc-base-url"))
	_ = viper.BindPFlag("chaos_manager_svc_secret", internalCmd.Flags().Lookup("chaos-manager-svc-secret"))
	_ = viper.BindPFlag("code_svc_base_url", internalCmd.Flags().Lookup("code-svc-base-url"))
	_ = viper.BindPFlag("code_svc_secret", internalCmd.Flags().Lookup("code-svc-secret"))
	_ = viper.BindPFlag("dashboard_svc_base_url", internalCmd.Flags().Lookup("dashboard-svc-base-url"))
	_ = viper.BindPFlag("dashboard_svc_secret", internalCmd.Flags().Lookup("dashboard-svc-secret"))
	_ = viper.BindPFlag("log_svc_base_url", internalCmd.Flags().Lookup("log-svc-base-url"))
	_ = viper.BindPFlag("log_svc_secret", internalCmd.Flags().Lookup("log-svc-secret"))
	_ = viper.BindPFlag("scs_svc_secret", internalCmd.Flags().Lookup("scs-svc-secret"))
	_ = viper.BindPFlag("scs_svc_base_url", internalCmd.Flags().Lookup("scs-svc-base-url"))
	_ = viper.BindPFlag("sto_svc_secret", internalCmd.Flags().Lookup("sto-svc-secret"))
	_ = viper.BindPFlag("sto_svc_base_url", internalCmd.Flags().Lookup("sto-svc-base-url"))
	_ = viper.BindPFlag("audit_svc_base_url", internalCmd.Flags().Lookup("audit-svc-base-url"))
	_ = viper.BindPFlag("audit_svc_secret", internalCmd.Flags().Lookup("audit-svc-secret"))
	_ = viper.BindPFlag("dbops_svc_base_url", internalCmd.Flags().Lookup("dbops-svc-base-url"))
	_ = viper.BindPFlag("dbops_svc_secret", internalCmd.Flags().Lookup("dbops-svc-secret"))
	_ = viper.BindPFlag("rbac_svc_base_url", internalCmd.Flags().Lookup("rbac-svc-base-url"))
	_ = viper.BindPFlag("rbac_svc_secret", internalCmd.Flags().Lookup("rbac-svc-secret"))
	_ = viper.BindPFlag("resource_group_svc_base_url", internalCmd.Flags().Lookup("resource-group-svc-base-url"))
	_ = viper.BindPFlag("resource_group_svc_secret", internalCmd.Flags().Lookup("resource-group-svc-secret"))

	// Add subcommands
	rootCmd.AddCommand(stdioCmd)
	stdioCmd.AddCommand(internalCmd)
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

func runStdioServer(ctx context.Context, config config.Config) error {
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
	harnessServer := tools.NewServer(version, server.WithHooks(hooks), server.WithRecovery())

	// Initialize toolsets
	toolsets, err := harness.InitToolsets(&config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

	// Set the guidelines prompts
	tools.RegisterPrompts(harnessServer)

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
