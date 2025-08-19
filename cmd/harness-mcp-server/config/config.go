package config

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Common fields for both modes
	Version       string
	ReadOnly      bool
	Toolsets      []string
	EnableModules []string
	LogFilePath   string
	Debug         bool
	EnableLicense bool

	// Server configuration
	Transport string // "stdio" or "http"
	HTTP      struct {
		Port int    `envconfig:"MCP_HTTP_PORT" default:"8080"`
		Path string `envconfig:"MCP_HTTP_PATH" default:"/mcp"`
	}

	Internal bool

	// Only used for external mode
	BaseURL          string
	AccountID        string
	DefaultOrgID     string
	DefaultProjectID string
	APIKey           string

	// Only used for internal mode
	BearerToken             string
	PipelineSvcBaseURL      string
	PipelineSvcSecret       string
	NgManagerBaseURL        string
	NgManagerSecret         string
	ChatbotBaseURL          string
	ChatbotSecret           string
	GenaiBaseURL            string
	GenaiSecret             string
	ArtifactRegistryBaseURL string
	ArtifactRegistrySecret  string
	NextgenCEBaseURL        string
	NextgenCESecret         string
	IDPSvcBaseURL           string
	IDPSvcSecret            string
	McpSvcSecret            string
	ChaosManagerSvcBaseURL  string
	ChaosManagerSvcSecret   string
	TemplateSvcBaseURL      string
	TemplateSvcSecret       string
	IntelligenceSvcBaseURL  string
	IntelligenceSvcSecret   string
	CodeSvcBaseURL          string
	CodeSvcSecret           string
	LogSvcBaseURL           string
	LogSvcSecret            string
	DashboardSvcBaseURL     string
	DashboardSvcSecret      string
	SCSSvcSecret            string // Added for SCS toolset
	SCSSvcBaseURL           string // Added for SCS toolset
	STOSvcSecret            string // Added for STO toolset
	STOSvcBaseURL           string // Added for STO toolset
	AuditSvcBaseURL         string
	AuditSvcSecret          string
	DBOpsSvcBaseURL         string
	DBOpsSvcSecret          string
	RBACSvcBaseURL          string
	RBACSvcSecret           string
	IsInternal              bool // Flag to determine if the server is running in internal mode
}

// Environment variable names
const (
	// Server configuration
	EnvAPIKey      = "HARNESS_API_KEY"
	EnvBearerToken = "HARNESS_BEARER_TOKEN"
	EnvHTTPPort    = "HARNESS_HTTP_PORT"
	EnvHTTPPath    = "HARNESS_HTTP_PATH"
	EnvTransport   = "HARNESS_TRANSPORT"
	EnvDebug       = "HARNESS_DEBUG"
	EnvLogFile     = "HARNESS_LOG_FILE"
	EnvReadOnly    = "HARNESS_READ_ONLY"
	EnvToolsets    = "HARNESS_TOOLSETS"
	EnvModules     = "HARNESS_ENABLE_MODULES"
	EnvIsInternal  = "HARNESS_IS_INTERNAL"

	// Base URLs for services
	EnvBaseURL             = "HARNESS_BASE_URL"
	EnvPipelineSvcBaseURL  = "HARNESS_PIPELINE_SVC_BASE_URL"
	EnvNGManagerBaseURL    = "HARNESS_NG_MANAGER_BASE_URL"
	EnvChatbotBaseURL      = "HARNESS_CHATBOT_BASE_URL"
	EnvGenAIBaseURL        = "HARNESS_GENAI_BASE_URL"
	EnvArtifactRegistryURL = "HARNESS_ARTIFACT_REGISTRY_BASE_URL"
	EnvNextgenCEBaseURL    = "HARNESS_NEXTGEN_CE_BASE_URL"
	EnvTemplateSvcBaseURL  = "HARNESS_TEMPLATE_SVC_BASE_URL"
	EnvIntelligenceSvcURL  = "HARNESS_INTELLIGENCE_SVC_BASE_URL"
	EnvChaosManagerSvcURL  = "HARNESS_CHAOS_MANAGER_SVC_BASE_URL"
	EnvCodeSvcBaseURL      = "HARNESS_CODE_SVC_BASE_URL"
	EnvDashboardSvcBaseURL = "HARNESS_DASHBOARD_SVC_BASE_URL"
	EnvLogSvcBaseURL       = "HARNESS_LOG_SVC_BASE_URL"
	EnvSCSSvcBaseURL       = "HARNESS_SCS_SVC_BASE_URL"
	EnvSTOSvcBaseURL       = "HARNESS_STO_SVC_BASE_URL"
	EnvAuditSvcBaseURL     = "HARNESS_AUDIT_SVC_BASE_URL"
	EnvDBOpsSvcBaseURL     = "HARNESS_DBOPS_SVC_BASE_URL"
	EnvRBACSvcBaseURL      = "HARNESS_RBAC_SVC_BASE_URL"

	// Service secrets
	EnvPipelineSvcSecret  = "HARNESS_PIPELINE_SVC_SECRET"
	EnvNGManagerSecret    = "HARNESS_NG_MANAGER_SECRET"
	EnvChatbotSecret      = "HARNESS_CHATBOT_SECRET"
	EnvGenAISecret        = "HARNESS_GENAI_SECRET"
	EnvMCPSvcSecret       = "HARNESS_MCP_SVC_SECRET"
	EnvArtifactRegSecret  = "HARNESS_ARTIFACT_REGISTRY_SECRET"
	EnvNextgenCESecret    = "HARNESS_NEXTGEN_CE_SECRET"
	EnvTemplateSvcSecret  = "HARNESS_TEMPLATE_SVC_SECRET"
	EnvIntelligenceSvcSec = "HARNESS_INTELLIGENCE_SVC_SECRET"
	EnvChaosManagerSvcSec = "HARNESS_CHAOS_MANAGER_SVC_SECRET"
	EnvCodeSvcSecret      = "HARNESS_CODE_SVC_SECRET"
	EnvDashboardSvcSecret = "HARNESS_DASHBOARD_SVC_SECRET"
	EnvLogSvcSecret       = "HARNESS_LOG_SVC_SECRET"
	EnvSCSSvcSecret       = "HARNESS_SCS_SVC_SECRET"
	EnvSTOSvcSecret       = "HARNESS_STO_SVC_SECRET"
	EnvAuditSvcSecret     = "HARNESS_AUDIT_SVC_SECRET"
	EnvDBOpsSvcSecret     = "HARNESS_DBOPS_SVC_SECRET"
	EnvRBACSvcSecret      = "HARNESS_RBAC_SVC_SECRET"

	// Default organization and project
	EnvDefaultOrgID     = "HARNESS_DEFAULT_ORG_ID"
	EnvDefaultProjectID = "HARNESS_DEFAULT_PROJECT_ID"
)

// LoadEnvConfig loads configuration from environment variables
// This function will override any values already set in the config with values from environment variables
func (cfg *Config) LoadEnvConfig() {
	// Load server configuration
	if val := os.Getenv(EnvAPIKey); val != "" {
		cfg.APIKey = val
		slog.Debug("Loaded API key from environment")
	}

	if val := os.Getenv(EnvBearerToken); val != "" {
		cfg.BearerToken = val
		slog.Debug("Loaded bearer token from environment")
	}

	if val := os.Getenv(EnvHTTPPort); val != "" {
		if port, err := strconv.Atoi(val); err == nil {
			cfg.HTTP.Port = port
			slog.Debug("Loaded HTTP port from environment", "port", port)
		} else {
			slog.Warn("Invalid HTTP port in environment variable", "value", val, "error", err)
		}
	}

	if val := os.Getenv(EnvHTTPPath); val != "" {
		cfg.HTTP.Path = val
		slog.Debug("Loaded HTTP path from environment", "path", val)
	}

	if val := os.Getenv(EnvTransport); val != "" {
		cfg.Transport = val
		slog.Debug("Loaded transport mode from environment", "transport", val)
	}

	if val := os.Getenv(EnvDebug); val != "" {
		cfg.Debug = strings.ToLower(val) == "true"
		slog.Debug("Loaded debug mode from environment", "debug", cfg.Debug)
	}

	if val := os.Getenv(EnvLogFile); val != "" {
		cfg.LogFilePath = val
		slog.Debug("Loaded log file path from environment", "path", val)
	}

	if val := os.Getenv(EnvReadOnly); val != "" {
		cfg.ReadOnly = strings.ToLower(val) == "true"
		slog.Debug("Loaded read-only mode from environment", "readonly", cfg.ReadOnly)
	}

	if val := os.Getenv(EnvToolsets); val != "" {
		cfg.Toolsets = strings.Split(val, ",")
		slog.Debug("Loaded toolsets from environment", "toolsets", cfg.Toolsets)
	}

	if val := os.Getenv(EnvModules); val != "" {
		cfg.EnableModules = strings.Split(val, ",")
		slog.Debug("Loaded enabled modules from environment", "modules", cfg.EnableModules)
	}

	if val := os.Getenv(EnvIsInternal); val != "" {
		cfg.IsInternal = strings.ToLower(val) == "true"
		slog.Debug("Loaded internal mode from environment", "internal", cfg.IsInternal)
	}

	// Load base URLs
	if val := os.Getenv(EnvBaseURL); val != "" {
		cfg.BaseURL = val
		slog.Debug("Loaded base URL from environment")
	}

	if val := os.Getenv(EnvPipelineSvcBaseURL); val != "" {
		cfg.PipelineSvcBaseURL = val
		slog.Debug("Loaded pipeline service base URL from environment")
	}

	if val := os.Getenv(EnvNGManagerBaseURL); val != "" {
		cfg.NgManagerBaseURL = val
		slog.Debug("Loaded NG manager base URL from environment")
	}

	if val := os.Getenv(EnvChatbotBaseURL); val != "" {
		cfg.ChatbotBaseURL = val
		slog.Debug("Loaded chatbot base URL from environment")
	}

	if val := os.Getenv(EnvGenAIBaseURL); val != "" {
		cfg.GenaiBaseURL = val
		slog.Debug("Loaded GenAI base URL from environment")
	}

	if val := os.Getenv(EnvArtifactRegistryURL); val != "" {
		cfg.ArtifactRegistryBaseURL = val
		slog.Debug("Loaded artifact registry base URL from environment")
	}

	if val := os.Getenv(EnvNextgenCEBaseURL); val != "" {
		cfg.NextgenCEBaseURL = val
		slog.Debug("Loaded Nextgen CE base URL from environment")
	}

	if val := os.Getenv(EnvTemplateSvcBaseURL); val != "" {
		cfg.TemplateSvcBaseURL = val
		slog.Debug("Loaded template service base URL from environment")
	}

	if val := os.Getenv(EnvIntelligenceSvcURL); val != "" {
		cfg.IntelligenceSvcBaseURL = val
		slog.Debug("Loaded intelligence service base URL from environment")
	}

	if val := os.Getenv(EnvChaosManagerSvcURL); val != "" {
		cfg.ChaosManagerSvcBaseURL = val
		slog.Debug("Loaded chaos manager service base URL from environment")
	}

	if val := os.Getenv(EnvCodeSvcBaseURL); val != "" {
		cfg.CodeSvcBaseURL = val
		slog.Debug("Loaded code service base URL from environment")
	}

	if val := os.Getenv(EnvDashboardSvcBaseURL); val != "" {
		cfg.DashboardSvcBaseURL = val
		slog.Debug("Loaded dashboard service base URL from environment")
	}

	if val := os.Getenv(EnvLogSvcBaseURL); val != "" {
		cfg.LogSvcBaseURL = val
		slog.Debug("Loaded log service base URL from environment")
	}

	if val := os.Getenv(EnvSCSSvcBaseURL); val != "" {
		cfg.SCSSvcBaseURL = val
		slog.Debug("Loaded SCS service base URL from environment")
	}

	if val := os.Getenv(EnvSTOSvcBaseURL); val != "" {
		cfg.STOSvcBaseURL = val
		slog.Debug("Loaded STO service base URL from environment")
	}

	if val := os.Getenv(EnvAuditSvcBaseURL); val != "" {
		cfg.AuditSvcBaseURL = val
		slog.Debug("Loaded audit service base URL from environment")
	}

	if val := os.Getenv(EnvDBOpsSvcBaseURL); val != "" {
		cfg.DBOpsSvcBaseURL = val
		slog.Debug("Loaded DBOps service base URL from environment")
	}

	if val := os.Getenv(EnvRBACSvcBaseURL); val != "" {
		cfg.RBACSvcBaseURL = val
		slog.Debug("Loaded RBAC service base URL from environment")
	}

	// Load service secrets
	if val := os.Getenv(EnvPipelineSvcSecret); val != "" {
		cfg.PipelineSvcSecret = val
		slog.Debug("Loaded pipeline service secret from environment")
	}

	if val := os.Getenv(EnvNGManagerSecret); val != "" {
		cfg.NgManagerSecret = val
		slog.Debug("Loaded NG manager secret from environment")
	}

	if val := os.Getenv(EnvChatbotSecret); val != "" {
		cfg.ChatbotSecret = val
		slog.Debug("Loaded chatbot secret from environment")
	}

	if val := os.Getenv(EnvGenAISecret); val != "" {
		cfg.GenaiSecret = val
		slog.Debug("Loaded GenAI secret from environment")
	}

	if val := os.Getenv(EnvMCPSvcSecret); val != "" {
		cfg.McpSvcSecret = val
		slog.Debug("Loaded MCP service secret from environment")
	}

	if val := os.Getenv(EnvArtifactRegSecret); val != "" {
		cfg.ArtifactRegistrySecret = val
		slog.Debug("Loaded artifact registry secret from environment")
	}

	if val := os.Getenv(EnvNextgenCESecret); val != "" {
		cfg.NextgenCESecret = val
		slog.Debug("Loaded Nextgen CE secret from environment")
	}

	if val := os.Getenv(EnvTemplateSvcSecret); val != "" {
		cfg.TemplateSvcSecret = val
		slog.Debug("Loaded template service secret from environment")
	}

	if val := os.Getenv(EnvIntelligenceSvcSec); val != "" {
		cfg.IntelligenceSvcSecret = val
		slog.Debug("Loaded intelligence service secret from environment")
	}

	if val := os.Getenv(EnvChaosManagerSvcSec); val != "" {
		cfg.ChaosManagerSvcSecret = val
		slog.Debug("Loaded chaos manager service secret from environment")
	}

	if val := os.Getenv(EnvCodeSvcSecret); val != "" {
		cfg.CodeSvcSecret = val
		slog.Debug("Loaded code service secret from environment")
	}

	if val := os.Getenv(EnvDashboardSvcSecret); val != "" {
		cfg.DashboardSvcSecret = val
		slog.Debug("Loaded dashboard service secret from environment")
	}

	if val := os.Getenv(EnvLogSvcSecret); val != "" {
		cfg.LogSvcSecret = val
		slog.Debug("Loaded log service secret from environment")
	}

	if val := os.Getenv(EnvSCSSvcSecret); val != "" {
		cfg.SCSSvcSecret = val
		slog.Debug("Loaded SCS service secret from environment")
	}

	if val := os.Getenv(EnvSTOSvcSecret); val != "" {
		cfg.STOSvcSecret = val
		slog.Debug("Loaded STO service secret from environment")
	}

	if val := os.Getenv(EnvAuditSvcSecret); val != "" {
		cfg.AuditSvcSecret = val
		slog.Debug("Loaded audit service secret from environment")
	}

	if val := os.Getenv(EnvDBOpsSvcSecret); val != "" {
		cfg.DBOpsSvcSecret = val
		slog.Debug("Loaded DBOps service secret from environment")
	}

	if val := os.Getenv(EnvRBACSvcSecret); val != "" {
		cfg.RBACSvcSecret = val
		slog.Debug("Loaded RBAC service secret from environment")
	}

	// Load default organization and project
	if val := os.Getenv(EnvDefaultOrgID); val != "" {
		cfg.DefaultOrgID = val
		slog.Debug("Loaded default organization ID from environment")
	}

	if val := os.Getenv(EnvDefaultProjectID); val != "" {
		cfg.DefaultProjectID = val
		slog.Debug("Loaded default project ID from environment")
	}
}
