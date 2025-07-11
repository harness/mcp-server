package config

type Config struct {
	// Common fields for both modes
	Version     string
	ReadOnly    bool
	Toolsets    []string
	LogFilePath string
	Debug       bool

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
	CodeSvcBaseURL          string
	CodeSvcSecret           string
	LogSvcBaseURL           string
	LogSvcSecret            string
	DashboardSvcBaseURL     string
	DashboardSvcSecret      string
	AuditSvcBaseURL         string
	AuditSvcSecret          string
}
