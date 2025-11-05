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

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/harness/logging"
	"github.com/harness/harness-mcp/pkg/harness/middleware"
	"github.com/harness/harness-mcp/pkg/harness/middleware/metrics"
	"github.com/harness/harness-mcp/pkg/harness/middleware/tool_filtering"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/types/enum"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

var version = "0.1.0"
var commit = "dev"

// startMetricsServer starts a separate Prometheus metrics server
func startMetricsServer(config *config.Config) (*metrics.MetricsServer, error) {
	metricsServer := metrics.NewMetricsServer(config.Metrics.Port, slog.Default())
	if err := metricsServer.Start(); err != nil {
		return nil, fmt.Errorf("failed to start metrics server: %w", err)
	}
	return metricsServer, nil
}

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

	httpServerCmd = &cobra.Command{
		Use:   "http-server",
		Short: "Start MCP as a standalone server with HTTP transport",
		Long:  `Start a standalone MCP server with HTTP transport`,
		RunE: func(_ *cobra.Command, _ []string) error {
			ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
			defer stop()

			transportType := enum.TransportHTTP

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

			var logFormat enum.LogFormatType = enum.LogFormatText
			if viper.GetString("log_format") == "json" {
				logFormat = enum.LogFormatJSON
			}
			// Configure license cache TTL and clean interval
			licenseCacheTTL, licenseCacheCleanInterval, err := config.ConfigureLicenseCache()
			if err != nil {
				return err
			}

			cfg := config.Config{
				Version:                   version,
				ReadOnly:                  viper.GetBool("read_only"),
				Debug:                     viper.GetBool("debug"),
				EnableLicense:             false,
				LicenseCacheTTL:           licenseCacheTTL,
				LicenseCacheCleanInterval: licenseCacheCleanInterval,
				Transport:                 transportType,
				HTTP: struct {
					Port int    `envconfig:"MCP_HTTP_PORT" default:"8080"`
					Path string `envconfig:"MCP_HTTP_PATH" default:"/mcp"`
				}{
					Port: viper.GetInt("http_port"),
					Path: viper.GetString("http_path"),
				},
				Metrics: struct {
					Port int `envconfig:"MCP_METRICS_PORT" default:"8889"`
				}{
					Port: viper.GetInt("metrics_port"),
				},
				Internal:                true,
				Toolsets:                []string{"all"},
				EnableModules:           []string{"all"},
				LogFormat:               logFormat,
				PipelineSvcBaseURL:      viper.GetString("pipeline_svc_base_url"),
				PipelineSvcSecret:       viper.GetString("pipeline_svc_secret"),
				McpSvcSecret:            viper.GetString("mcp_svc_secret"),
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
				CCMCommOrchBaseURL:      viper.GetString("ccm_comm_orch_base_url"),
				CCMCommOrchSecret:       viper.GetString("ccm_comm_orch_secret"),
				IDPSvcBaseURL:           viper.GetString("idp_svc_base_url"),
				IDPSvcSecret:            viper.GetString("idp_svc_secret"),
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
				SEISvcSecret:            viper.GetString("sei_svc_secret"),
				SEISvcBaseURL:           viper.GetString("sei_svc_base_url"),
				AuditSvcBaseURL:         viper.GetString("audit_svc_base_url"),
				AuditSvcSecret:          viper.GetString("audit_svc_secret"),
				DBOpsSvcBaseURL:         viper.GetString("dbops_svc_base_url"),
				DBOpsSvcSecret:          viper.GetString("dbops_svc_secret"),
				ACLSvcBaseURL:           viper.GetString("acl_svc_base_url"),
				ACLSvcSecret:            viper.GetString("acl_svc_secret"),
				OutputDir:               viper.GetString("output_dir"),
				SkipAuthForLocal:        viper.GetBool("skip_auth_for_local"),
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

			var enableModules []string
			err = viper.UnmarshalKey("enable_modules", &enableModules)
			if err != nil {
				return fmt.Errorf("failed to unmarshal enabled modules: %w", err)
			}

			var logFormat enum.LogFormatType = enum.LogFormatText
			if viper.GetString("log_format") == "json" {
				logFormat = enum.LogFormatJSON
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
				OutputDir:        viper.GetString("output_dir"),
				LogFormat:        logFormat,
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
				return fmt.Errorf("failed to authenticate session: %w", err)
			}

			// Store the authenticated session in the context
			ctx = auth.WithAuthSession(ctx, session)

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

			var logFormat enum.LogFormatType = enum.LogFormatText
			if viper.GetString("log_format") == "json" {
				logFormat = enum.LogFormatJSON
			}

			cfg := config.Config{
				// Common fields
				Version:       version,
				ReadOnly:      true, // we keep it read-only for now
				Toolsets:      toolsets,
				EnableModules: enableModules,
				LogFilePath:   viper.GetString("log_file"),
				Debug:         viper.GetBool("debug"),
				EnableLicense: viper.GetBool("enable_license"),
				Internal:      true,
				OutputDir:     viper.GetString("output_dir"),
				AccountID:     session.Principal.AccountID,
				// Internal mode specific fields
				LogFormat:               logFormat,
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
				CCMCommOrchBaseURL:      viper.GetString("ccm_comm_orch_base_url"),
				CCMCommOrchSecret:       viper.GetString("ccm_comm_orch_secret"),
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
				SEISvcSecret:            viper.GetString("sei_svc_secret"),
				SEISvcBaseURL:           viper.GetString("sei_svc_base_url"),
				AuditSvcBaseURL:         viper.GetString("audit_svc_base_url"),
				AuditSvcSecret:          viper.GetString("audit_svc_secret"),
				DBOpsSvcBaseURL:         viper.GetString("dbops_svc_base_url"),
				DBOpsSvcSecret:          viper.GetString("dbops_svc_secret"),
				ACLSvcBaseURL:           viper.GetString("acl_svc_base_url"),
				ACLSvcSecret:            viper.GetString("acl_svc_secret"),
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
	rootCmd.PersistentFlags().String("output-dir", "", "Directory where the tool writes output files (e.g., pipeline logs)")
	rootCmd.PersistentFlags().String("log-format", "text", "Log format (text or json)")

	httpServerCmd.PersistentFlags().Int("http-port", 8080, "HTTP server port (when transport is 'http')")
	httpServerCmd.PersistentFlags().String("http-path", "/mcp", "HTTP server path (when transport is 'http')")
	httpServerCmd.Flags().String("pipeline-svc-base-url", "", "Base URL for pipeline service")
	httpServerCmd.Flags().String("pipeline-svc-secret", "", "Secret for pipeline service")
	httpServerCmd.Flags().String("mcp-svc-secret", "", "Secret for MCP service")
	httpServerCmd.Flags().String("ng-manager-base-url", "", "Base URL for NG manager")
	httpServerCmd.Flags().String("ng-manager-secret", "", "Secret for NG manager")
	httpServerCmd.Flags().String("chatbot-base-url", "", "Base URL for chatbot service")
	httpServerCmd.Flags().String("chatbot-secret", "", "Secret for chatbot service")
	httpServerCmd.Flags().String("genai-base-url", "", "Base URL for genai service")
	httpServerCmd.Flags().String("genai-secret", "", "Secret for genai service")
	httpServerCmd.Flags().String("artifact-registry-base-url", "", "Base URL for artifact registry service")
	httpServerCmd.Flags().String("artifact-registry-secret", "", "Secret for artifact registry service")
	httpServerCmd.Flags().String("nextgen-ce-base-url", "", "Base URL for Nextgen CE service")
	httpServerCmd.Flags().String("nextgen-ce-secret", "", "Secret for Nextgen CE service")
	httpServerCmd.Flags().String("ccm-comm-orch-base-url", "", "Base URL for CCM Communication Orchestration service")
	httpServerCmd.Flags().String("ccm-comm-orch-secret", "", "Secret for CCM Communication Orchestration service")
	httpServerCmd.Flags().String("idp-svc-base-url", "", "Base URL for IDP service")
	httpServerCmd.Flags().String("idp-svc-secret", "", "Secret for IDP service")
	httpServerCmd.Flags().String("template-svc-base-url", "", "Base URL for Template service")
	httpServerCmd.Flags().String("template-svc-secret", "", "Secret for Template service")
	httpServerCmd.Flags().String("chaos-manager-svc-base-url", "", "Base URL for chaos manager service")
	httpServerCmd.Flags().String("chaos-manager-svc-secret", "", "Secret for chaos manager service")
	httpServerCmd.Flags().String("intelligence-svc-base-url", "", "Base URL for intelligence service")
	httpServerCmd.Flags().String("intelligence-svc-secret", "", "Secret for intelligence service")
	httpServerCmd.Flags().String("code-svc-base-url", "", "Base URL for code service")
	httpServerCmd.Flags().String("code-svc-secret", "", "Secret for code service")
	httpServerCmd.Flags().String("dashboard-svc-base-url", "", "Base URL for dashboard service")
	httpServerCmd.Flags().String("dashboard-svc-secret", "", "Secret for dashboard service")
	httpServerCmd.Flags().String("log-svc-base-url", "", "Base URL for log service")
	httpServerCmd.Flags().String("log-svc-secret", "", "Secret for log service")
	httpServerCmd.Flags().String("scs-svc-secret", "", "Secret for SCS service")
	httpServerCmd.Flags().String("scs-svc-base-url", "", "Base URL for SCS service")
	httpServerCmd.Flags().String("sto-svc-secret", "", "Secret for STO service")
	httpServerCmd.Flags().String("sto-svc-base-url", "", "Base URL for STO service")
	httpServerCmd.Flags().String("sei-svc-base-url", "", "Base URL for SEI service")
	httpServerCmd.Flags().String("sei-svc-secret", "", "Secret for SEI service")
	httpServerCmd.Flags().String("audit-svc-base-url", "", "Base URL for audit service")
	httpServerCmd.Flags().String("audit-svc-secret", "", "Secret for audit service")
	httpServerCmd.Flags().String("dbops-svc-base-url", "", "Base URL for dbops service")
	httpServerCmd.Flags().String("dbops-svc-secret", "", "Secret for dbops service")
	httpServerCmd.Flags().String("acl-svc-base-url", "", "Base URL for ACL service")
	httpServerCmd.Flags().String("acl-svc-secret", "", "Secret for ACL service")
	httpServerCmd.Flags().Bool("skip-auth-for-local", false, "Skip authentication for local development")

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
	internalCmd.Flags().String("ccm-comm-orch-base-url", "", "Base URL for CCM Communication Orchestration service")
	internalCmd.Flags().String("ccm-comm-orch-secret", "", "Secret for CCM Communication Orchestration service")
	internalCmd.Flags().String("idp-svc-base-url", "", "Base URL for IDP service")
	internalCmd.Flags().String("idp-svc-secret", "", "Secret for IDP service")
	internalCmd.Flags().String("template-svc-base-url", "", "Base URL for Template service")
	internalCmd.Flags().String("template-svc-secret", "", "Secret for Template service")
	internalCmd.Flags().String("chaos-manager-svc-base-url", "", "Base URL for chaos manager service")
	internalCmd.Flags().String("chaos-manager-svc-secret", "", "Secret for chaos manager service")
	internalCmd.Flags().String("code-svc-base-url", "", "Base URL for code service")
	internalCmd.Flags().String("code-svc-secret", "", "Secret for code service")
	internalCmd.Flags().String("dashboard-svc-base-url", "", "Base URL for dashboard service")
	internalCmd.Flags().String("dashboard-svc-secret", "", "Secret for dashboard service")
	internalCmd.Flags().String("log-svc-base-url", "", "Base URL for log service")
	internalCmd.Flags().String("log-svc-secret", "", "Secret for log service")
	internalCmd.Flags().String("scs-svc-secret", "", "Secret for SCS service")
	internalCmd.Flags().String("scs-svc-base-url", "", "Base URL for SCS service")
	internalCmd.Flags().String("sto-svc-secret", "", "Secret for STO service")
	internalCmd.Flags().String("sto-svc-base-url", "", "Base URL for STO service")
	internalCmd.Flags().String("sei-svc-secret", "", "Secret for SEI service")
	internalCmd.Flags().String("sei-svc-base-url", "", "Base URL for SEI service")
	internalCmd.Flags().String("audit-svc-base-url", "", "Base URL for audit service")
	internalCmd.Flags().String("audit-svc-secret", "", "Secret for audit service")
	internalCmd.Flags().String("dbops-svc-base-url", "", "Base URL for dbops service")
	internalCmd.Flags().String("dbops-svc-secret", "", "Secret for dbops service")
	internalCmd.Flags().String("acl-svc-base-url", "", "Base URL for ACL service")
	internalCmd.Flags().String("acl-svc-secret", "", "Secret for ACL service")
	internalCmd.Flags().String("intelligence-svc-base-url", "", "Base URL for intelligence service")
	internalCmd.Flags().String("intelligence-svc-secret", "", "Secret for intelligence service")

	// Bind global flags to viper
	_ = viper.BindPFlag("toolsets", rootCmd.PersistentFlags().Lookup("toolsets"))
	_ = viper.BindPFlag("enable_modules", rootCmd.PersistentFlags().Lookup("enable-modules"))
	_ = viper.BindPFlag("enable_license", rootCmd.PersistentFlags().Lookup("enable-license"))
	_ = viper.BindPFlag("read_only", rootCmd.PersistentFlags().Lookup("read-only"))
	_ = viper.BindPFlag("log_file", rootCmd.PersistentFlags().Lookup("log-file"))
	_ = viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))
	_ = viper.BindPFlag("output_dir", rootCmd.PersistentFlags().Lookup("output-dir"))
	_ = viper.BindPFlag("log_format", rootCmd.PersistentFlags().Lookup("log-format"))
	// Bind transport configuration flags to viper
	_ = viper.BindPFlag("http_port", httpServerCmd.PersistentFlags().Lookup("http-port"))
	_ = viper.BindPFlag("http_path", httpServerCmd.PersistentFlags().Lookup("http-path"))
	_ = viper.BindPFlag("pipeline_svc_base_url", httpServerCmd.Flags().Lookup("pipeline-svc-base-url"))
	_ = viper.BindPFlag("pipeline_svc_secret", httpServerCmd.Flags().Lookup("pipeline-svc-secret"))
	_ = viper.BindPFlag("mcp_svc_secret", httpServerCmd.Flags().Lookup("mcp-svc-secret"))
	_ = viper.BindPFlag("ng_manager_base_url", httpServerCmd.Flags().Lookup("ng-manager-base-url"))
	_ = viper.BindPFlag("ng_manager_secret", httpServerCmd.Flags().Lookup("ng-manager-secret"))
	_ = viper.BindPFlag("chatbot_base_url", httpServerCmd.Flags().Lookup("chatbot-base-url"))
	_ = viper.BindPFlag("chatbot_secret", httpServerCmd.Flags().Lookup("chatbot-secret"))
	_ = viper.BindPFlag("genai_base_url", httpServerCmd.Flags().Lookup("genai-base-url"))
	_ = viper.BindPFlag("genai_secret", httpServerCmd.Flags().Lookup("genai-secret"))
	_ = viper.BindPFlag("artifact_registry_base_url", httpServerCmd.Flags().Lookup("artifact-registry-base-url"))
	_ = viper.BindPFlag("artifact_registry_secret", httpServerCmd.Flags().Lookup("artifact-registry-secret"))
	_ = viper.BindPFlag("nextgen_ce_base_url", httpServerCmd.Flags().Lookup("nextgen-ce-base-url"))
	_ = viper.BindPFlag("nextgen_ce_secret", httpServerCmd.Flags().Lookup("nextgen-ce-secret"))
	_ = viper.BindPFlag("ccm_comm_orch_base_url", httpServerCmd.Flags().Lookup("ccm-comm-orch-base-url"))
	_ = viper.BindPFlag("ccm_comm_orch_secret", httpServerCmd.Flags().Lookup("ccm-comm-orch-secret"))
	_ = viper.BindPFlag("idp_svc_base_url", httpServerCmd.Flags().Lookup("idp-svc-base-url"))
	_ = viper.BindPFlag("idp_svc_secret", httpServerCmd.Flags().Lookup("idp-svc-secret"))
	_ = viper.BindPFlag("template_svc_base_url", httpServerCmd.Flags().Lookup("template-svc-base-url"))
	_ = viper.BindPFlag("template_svc_secret", httpServerCmd.Flags().Lookup("template-svc-secret"))
	_ = viper.BindPFlag("intelligence_svc_base_url", httpServerCmd.Flags().Lookup("intelligence-svc-base-url"))
	_ = viper.BindPFlag("intelligence_svc_secret", httpServerCmd.Flags().Lookup("intelligence-svc-secret"))
	_ = viper.BindPFlag("chaos_manager_svc_base_url", httpServerCmd.Flags().Lookup("chaos-manager-svc-base-url"))
	_ = viper.BindPFlag("chaos_manager_svc_secret", httpServerCmd.Flags().Lookup("chaos-manager-svc-secret"))
	_ = viper.BindPFlag("code_svc_base_url", httpServerCmd.Flags().Lookup("code-svc-base-url"))
	_ = viper.BindPFlag("code_svc_secret", httpServerCmd.Flags().Lookup("code-svc-secret"))
	_ = viper.BindPFlag("dashboard_svc_base_url", httpServerCmd.Flags().Lookup("dashboard-svc-base-url"))
	_ = viper.BindPFlag("dashboard_svc_secret", httpServerCmd.Flags().Lookup("dashboard-svc-secret"))
	_ = viper.BindPFlag("log_svc_base_url", httpServerCmd.Flags().Lookup("log-svc-base-url"))
	_ = viper.BindPFlag("log_svc_secret", httpServerCmd.Flags().Lookup("log-svc-secret"))
	_ = viper.BindPFlag("scs_svc_secret", httpServerCmd.Flags().Lookup("scs-svc-secret"))
	_ = viper.BindPFlag("scs_svc_base_url", httpServerCmd.Flags().Lookup("scs-svc-base-url"))
	_ = viper.BindPFlag("sto_svc_secret", httpServerCmd.Flags().Lookup("sto-svc-secret"))
	_ = viper.BindPFlag("sto_svc_base_url", httpServerCmd.Flags().Lookup("sto-svc-base-url"))
	_ = viper.BindPFlag("sei_svc_base_url", httpServerCmd.Flags().Lookup("sei-svc-base-url"))
	_ = viper.BindPFlag("sei_svc_secret", httpServerCmd.Flags().Lookup("sei-svc-secret"))
	_ = viper.BindPFlag("audit_svc_base_url", httpServerCmd.Flags().Lookup("audit-svc-base-url"))
	_ = viper.BindPFlag("audit_svc_secret", httpServerCmd.Flags().Lookup("audit-svc-secret"))
	_ = viper.BindPFlag("dbops_svc_base_url", httpServerCmd.Flags().Lookup("dbops-svc-base-url"))
	_ = viper.BindPFlag("dbops_svc_secret", httpServerCmd.Flags().Lookup("dbops-svc-secret"))
	_ = viper.BindPFlag("acl_svc_base_url", httpServerCmd.Flags().Lookup("acl-svc-base-url"))
	_ = viper.BindPFlag("acl_svc_secret", httpServerCmd.Flags().Lookup("acl-svc-secret"))
	_ = viper.BindPFlag("skip_auth_for_local", httpServerCmd.Flags().Lookup("skip-auth-for-local"))

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
	_ = viper.BindPFlag("ccm_comm_orch_base_url", internalCmd.Flags().Lookup("ccm-comm-orch-base-url"))
	_ = viper.BindPFlag("ccm_comm_orch_secret", internalCmd.Flags().Lookup("ccm-comm-orch-secret"))
	_ = viper.BindPFlag("idp_svc_base_url", internalCmd.Flags().Lookup("idp-svc-base-url"))
	_ = viper.BindPFlag("idp_svc_secret", internalCmd.Flags().Lookup("idp-svc-secret"))
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
	_ = viper.BindPFlag("sei_svc_secret", internalCmd.Flags().Lookup("sei-svc-secret"))
	_ = viper.BindPFlag("sei_svc_base_url", internalCmd.Flags().Lookup("sei-svc-base-url"))
	_ = viper.BindPFlag("audit_svc_base_url", internalCmd.Flags().Lookup("audit-svc-base-url"))
	_ = viper.BindPFlag("audit_svc_secret", internalCmd.Flags().Lookup("audit-svc-secret"))
	_ = viper.BindPFlag("dbops_svc_base_url", internalCmd.Flags().Lookup("dbops-svc-base-url"))
	_ = viper.BindPFlag("dbops_svc_secret", internalCmd.Flags().Lookup("dbops-svc-secret"))
	_ = viper.BindPFlag("acl_svc_base_url", internalCmd.Flags().Lookup("acl-svc-base-url"))
	_ = viper.BindPFlag("acl_svc_secret", internalCmd.Flags().Lookup("acl-svc-secret"))

	// Add subcommands
	rootCmd.AddCommand(httpServerCmd)
	rootCmd.AddCommand(stdioCmd)
	stdioCmd.AddCommand(internalCmd)
}

func initConfig() {
	// Initialize Viper configuration
	viper.SetEnvPrefix("harness")
	viper.AutomaticEnv()
}

func initTracing() *sdktrace.TracerProvider {
	ctx := context.Background()

	// Get the headers from environment variable
	headersEnv := os.Getenv("OTEL_EXPORTER_OTLP_HEADERS")
	headers := make(map[string]string)

	// Only extract Authorization if the header exists and has the correct format
	if strings.HasPrefix(headersEnv, "Authorization=") {
		authValue := headersEnv[len("Authorization="):]
		headers["Authorization"] = authValue
	}

	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
		otlptracehttp.WithHeaders(headers),
	)
	if err != nil {
		slog.Error("Failed to create trace exporter", "error", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			"",
			attribute.String("service.name", "mcp-server"),
		)),
	)

	otel.SetTracerProvider(tp)

	// Explicitly set the text map propagator to use W3C Trace Context
	// This is critical for proper trace context propagation between services
	otel.SetTextMapPropagator(propagation.TraceContext{})

	slog.Info("OpenTelemetry tracing initialized with W3C Trace Context propagator")

	return tp
}

func initLogger(config config.Config) error {
	debug := config.Debug
	logFormat := config.LogFormat
	outPath := config.LogFilePath
	handlerOpts := &slog.HandlerOptions{}
	if debug {
		handlerOpts.Level = slog.LevelDebug
	}

	var writer io.Writer = os.Stdout
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

	// Always wrap with our conversation ID logger, regardless of transport mode
	handler = logging.NewLoggingHandler(handler)
	slog.SetDefault(slog.New(handler))
	return nil
}

// runHTTPServer starts the MCP server with http transport
func runHTTPServer(ctx context.Context, config config.Config) error {
	// Initialize tracing
	tp := initTracing()
	defer tp.Shutdown(ctx)
	err := initLogger(config)
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
	harnessServer := harness.NewServer(version, &config, server.WithHooks(hooks), server.WithRecovery())

	// Initialize toolsets
	toolsets, err := harness.InitToolsets(ctx, &config)
	if err != nil {
		slog.Error("Failed to initialize toolsets", "error", err)
	}

	// Create module registry for HTTP mode
	moduleRegistry := modules.NewModuleRegistry(&config, toolsets)
	// Set the global registry for use by middleware
	modules.SetGlobalRegistry(moduleRegistry)

	// Register prompts from all enabled modules
	err = moduleRegistry.RegisterPrompts(harnessServer)
	if err != nil {
		return fmt.Errorf("failed to register module prompts: %w", err)
	}

	// Register the tools with the server
	toolsets.RegisterTools(harnessServer)

	// Set the guidelines prompts
	prompts.RegisterPrompts(harnessServer)

	// Start metrics server
	metricsServer, err := startMetricsServer(&config)
	if err != nil {
		return fmt.Errorf("failed to start metrics server: %w", err)
	}
	defer func() {
		if err := metricsServer.Stop(ctx); err != nil {
			slog.Error("error stopping metrics server", "error", err)
		}
	}()

	// Create HTTP server
	httpServer := server.NewStreamableHTTPServer(harnessServer)

	// Create middleware chain: Auth -> Metrics -> ToolFiltering -> MCP Server
	toolFilter := tool_filtering.NewHTTPToolFilteringMiddleware(ctx, slog.Default(), &config).Wrap(httpServer)
	metricsMiddleware := metrics.NewHTTPMetricsMiddleware(slog.Default(), &config).Wrap(toolFilter)
	authHandler := auth.AuthMiddleware(ctx, &config, metricsMiddleware)
	loggingHandler := middleware.MetadataMiddleware(authHandler)
	tracingHandler := middleware.TracingMiddleware(&config, loggingHandler)

	mux := http.NewServeMux()
	// tracingHandler -> loggingHandler -> authHandler -> metrics -> toolFilter -> httpServer
	mux.Handle(config.HTTP.Path, tracingHandler)

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
		"metrics_port", config.Metrics.Port,
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

// runStdioServer starts the MCP server with stdio transport
func runStdioServer(ctx context.Context, config config.Config) error {
	// Initialize the MCP server as before
	err := initLogger(config)
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
	harnessServer := harness.NewServer(version, &config, server.WithHooks(hooks), server.WithRecovery())

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

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
