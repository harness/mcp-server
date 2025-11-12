package config

import (
	"fmt"
	"time"

	"github.com/harness/harness-mcp/pkg/types/enum"
	"github.com/spf13/viper"
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
	OutputDir     string
	LogFormat     enum.LogFormatType

	// Server configuration
	Transport enum.TransportType
	HTTP      struct {
		Port int    `envconfig:"MCP_HTTP_PORT" default:"8080"`
		Path string `envconfig:"MCP_HTTP_PATH" default:"/mcp"`
	}

	// Metrics configuration
	Metrics struct {
		Port int `envconfig:"MCP_METRICS_PORT" default:"8889"`
	}

	Internal  bool
	APIKey    string
	BaseURL   string
	AccountID string

	// Only used for external mode
	DefaultOrgID     string
	DefaultProjectID string

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
	CCMCommOrchBaseURL      string
	CCMCommOrchSecret       string
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
	SEISvcBaseURL           string // Added for SEI toolset
	SEISvcSecret            string // Added for SEI toolset
	AuditSvcBaseURL         string
	AuditSvcSecret          string
	DBOpsSvcBaseURL         string
	DBOpsSvcSecret          string
	ACLSvcBaseURL           string
	ACLSvcSecret            string

	LicenseCacheTTL           time.Duration
	LicenseCacheCleanInterval time.Duration
}

// unmarshalWithDefault unmarshals a value from viper with a default fallback
// It takes a key name, a default value, and a pointer to store the result
// Returns an error if unmarshaling fails
func unmarshalWithDefault[T any](key string, defaultValue T, result *T) error {
	*result = defaultValue
	if viper.IsSet(key) {
		err := viper.UnmarshalKey(key, result)
		if err != nil {
			return fmt.Errorf("failed to unmarshal %s: %w", key, err)
		}
	}
	return nil
}

// ConfigureLicenseCache configures the license cache TTL and clean interval from viper configuration
// Returns the configured values and any error encountered during configuration
func ConfigureLicenseCache() (time.Duration, time.Duration, error) {
	// Set default license cache TTL to 30 minutes
	var licenseCacheTTL time.Duration
	err := unmarshalWithDefault("license_cache_ttl", 30*time.Minute, &licenseCacheTTL)
	if err != nil {
		return 0, 0, err
	}

	// Set default license cache clean interval to 5 minutes
	var licenseCacheCleanInterval time.Duration
	err = unmarshalWithDefault("license_cache_clean_interval", 5*time.Minute, &licenseCacheCleanInterval)
	if err != nil {
		return 0, 0, err
	}

	return licenseCacheTTL, licenseCacheCleanInterval, nil
}
