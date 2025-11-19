package modules

import (
	"fmt"
	"strings"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Default timeout for GenAI service
const defaultGenaiTimeout = 300 * time.Second

// Default timeout for Intelligence service
const defaultIntelligenceTimeout = 300 * time.Second

// CoreModule implements the Module interface and contains all default toolsets
type CoreModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewCoreModule creates a new instance of CoreModule
func NewCoreModule(config *config.Config, tsg *toolsets.ToolsetGroup) *CoreModule {
	return &CoreModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *CoreModule) ID() string {
	return "CORE"
}

// Name returns the name of module
func (m *CoreModule) Name() string {
	return "Core Module"
}

// Toolsets returns the names of toolsets provided by this module
func (m *CoreModule) Toolsets() []string {
	return []string{
		"pipelines",
		"connectors",
		"audit",
		"dashboards",
		"access_control",
		"templates",
		"logs",
		"genai",
		"intelligence",
		"chatbot",
		"settings",
		"secrets",
		"prompts",
	}
}

// RegisterToolsets registers all toolsets in the default module
func (m *CoreModule) RegisterToolsets() error {

	for _, i := range m.Toolsets() {
		switch i {
		case "pipelines":
			err := RegisterPipelines(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "connectors":
			err := RegisterConnectors(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "delegateTokens":
			err := RegisterDelegateTokens(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "audit":
			err := RegisterAudit(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "dashboards":
			err := RegisterDashboards(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "access_control":
			err := RegisterAccessControl(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "templates":
			err := RegisterTemplates(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "dbops":
			err := RegisterDbops(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "logs":
			err := RegisterLogs(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "intelligence":
			err := RegisterIntelligence(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "chatbot":
			err := RegisterChatbot(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "settings":
			err := RegisterSettings(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "secrets":
			err := RegisterSecrets(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "prompts":
			err := RegisterPromptTools(m.config, m.tsg)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the Core module
func (m *CoreModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *CoreModule) IsDefault() bool {
	return true
}

// GetGenAIClient creates and returns a GenAI client if in internal mode, otherwise returns nil
func GetGenAIClient(config *config.Config) (*client.GenaiService, error) {
	// Skip registration for external mode for now
	if !config.Internal {
		return nil, nil
	}

	// Determine the base URL and secret for genai service
	baseURL := config.GenaiBaseURL // Only used in internal mode
	secret := config.GenaiSecret

	// Create base client for genai with the default timeout
	c, err := utils.CreateClient(baseURL, config, secret, defaultGenaiTimeout)
	if err != nil {
		return nil, err
	}

	return &client.GenaiService{Client: c}, nil
}

// RegisterPipelines registers the pipelines toolset
func RegisterPipelines(config *config.Config, tsg *toolsets.ToolsetGroup) error {

	// Determine the base URL and secret for pipeline service
	baseURL := utils.BuildServiceURL(config, config.PipelineSvcBaseURL, config.BaseURL, "pipeline")
	secret := config.PipelineSvcSecret

	// Create base client for pipelines
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	pipelineClient := &client.PipelineService{Client: c}

	// Create the pipelines toolset
	pipelines := toolsets.NewToolset("pipelines", "Harness Pipeline related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListPipelinesTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.GetPipelineTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.FetchExecutionURLTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.GetExecutionTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.ListExecutionsTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.GetInputSetTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.ListInputSetsTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.GetPipelineSummaryTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.ListTriggersTool(config, pipelineClient)),
			toolsets.NewServerTool(tools.CreateFollowUpPromptTool(config, pipelineClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(pipelines)
	return nil
}

// RegisterConnectors registers the connectors toolset
func RegisterConnectors(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	connectorClient, err := utils.CreateServiceClient(config, config.NgManagerBaseURL, config.BaseURL, "ng/api", config.NgManagerSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create the connectors toolset
	connectors := toolsets.NewToolset("connectors", "Harness Connector related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListConnectorCatalogueTool(config, connectorServiceClient)),
			toolsets.NewServerTool(tools.GetConnectorDetailsTool(config, connectorServiceClient)),
			toolsets.NewServerTool(tools.ListConnectorsTool(config, connectorServiceClient)),
		)

	tsg.AddToolset(connectors)
	return nil
}

// RegisterDelegateTokens registers the DelegateTokens toolset
func RegisterDelegateTokens(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	delegateTokenClient, err := utils.CreateServiceClient(config, config.NgManagerBaseURL, config.BaseURL, "ng/api", config.NgManagerSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for DelegateTokens: %w", err)
	}
	delegateTokenServiceClient := &client.DelegateTokenClient{Client: delegateTokenClient}

	// Create the delegateTokens toolset
	delegateTokens := toolsets.NewToolset("delegateTokens", "Harness DelegateTokens related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListDelegateTokensTool(config, delegateTokenServiceClient)),
			toolsets.NewServerTool(tools.GetDelegateTokenTool(config, delegateTokenServiceClient)),
			toolsets.NewServerTool(tools.CreateDelegateTokenTool(config, delegateTokenServiceClient)),
			toolsets.NewServerTool(tools.RevokeDelegateTokenTool(config, delegateTokenServiceClient)),
			toolsets.NewServerTool(tools.DeleteDelegateTokenTool(config, delegateTokenServiceClient)),
		)

	tsg.AddToolset(delegateTokens)
	return nil
}

// RegisterDashboards registers the dashboards toolset
func RegisterDashboards(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.DashboardSvcBaseURL, config.BaseURL, "dashboard")
	secret := config.DashboardSvcSecret

	// Create base client for dashboards
	customTimeout := 30 * time.Second
	c, err := utils.CreateClient(baseURL, config, secret, customTimeout)
	if err != nil {
		return err
	}

	dashboardClient := &client.DashboardService{Client: c}

	// Create the dashboards toolset
	dashboards := toolsets.NewToolset("dashboards", "Harness Dashboards related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListDashboardsTool(config, dashboardClient)),
			toolsets.NewServerTool(tools.GetDashboardDataTool(config, dashboardClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(dashboards)
	return nil
}

func RegisterAudit(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for audit service
	baseURL := utils.BuildServiceURL(config, config.AuditSvcBaseURL, config.BaseURL, "audit")
	secret := config.AuditSvcSecret

	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}
	auditService := &client.AuditService{Client: c}
	audit := toolsets.NewToolset("audit", "Audit log related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListUserAuditTrailTool(config, auditService)),
			toolsets.NewServerTool(tools.GetAuditYamlTool(config, auditService)),
		)

	// Add toolset to the group
	tsg.AddToolset(audit)
	return nil
}

// RegisterLogs registers the logs toolset
func RegisterLogs(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for internal mode for now
	if config.Internal {
		return nil
	}

	// Determine the base URL and secret for logs
	logServiceBaseURL := ""
	// To handle unique ingress for log-service
	if strings.Contains(config.BaseURL, "/gateway") {
		logServiceBaseURL = utils.BuildServiceURL(config, config.LogSvcBaseURL, config.BaseURL, "log-service")
	} else {
		logServiceBaseURL = utils.BuildServiceURL(config, config.LogSvcBaseURL, config.BaseURL, "gateway/log-service")
	}
	logServiceSecret := config.LogSvcSecret

	// Create base client for logs
	logServiceClient, err := utils.CreateClient(logServiceBaseURL, config, logServiceSecret)
	if err != nil {
		return err
	}

	// Determine the base URL and secret for pipeline service
	baseURL := utils.BuildServiceURL(config, config.PipelineSvcBaseURL, config.BaseURL, "pipeline")
	pipelineServiceSecret := config.PipelineSvcSecret

	// Create base client for pipelines
	pipelineClient, err := utils.CreateClient(baseURL, config, pipelineServiceSecret)
	if err != nil {
		return err
	}

	logClient := &client.LogService{LogServiceClient: logServiceClient, PipelineClient: pipelineClient}

	// Create the logs toolset
	logs := toolsets.NewToolset("logs", "Harness Logs related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.DownloadExecutionLogsTool(config, logClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(logs)
	return nil
}

// RegisterTemplates registers the templates toolset
func RegisterTemplates(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for templates
	baseURL := utils.BuildServiceURL(config, config.TemplateSvcBaseURL, config.BaseURL, "template")
	secret := config.TemplateSvcSecret

	// Create base client for templates
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	templateClient := &client.TemplateService{
		Client: c,
	}

	// Create the templates toolset
	templates := toolsets.NewToolset("templates", "Harness Template related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListTemplates(config, templateClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(templates)
	return nil
}

// RegisterIntelligence registers the intelligence toolset
func RegisterIntelligence(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for intelligence
	baseURL := utils.BuildServiceURL(config, config.IntelligenceSvcBaseURL, config.BaseURL, "harness-intelligence")
	secret := config.IntelligenceSvcSecret

	// Create base client for intelligence service
	c, err := utils.CreateClientWithIdentity(baseURL, config, secret, utils.AiServiceIdentity, defaultIntelligenceTimeout)
	if err != nil {
		return err
	}

	intelligenceClient := &client.IntelligenceService{
		Client: c,
	}

	// Create the intelligence toolset
	intelligence := toolsets.NewToolset("intelligence", "Harness Intelligence related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.FindSimilarTemplates(config, intelligenceClient)),
			toolsets.NewServerTool(tools.AIDevOpsAgentTool(config, intelligenceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(intelligence)
	return nil
}

func RegisterAccessControl(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for access control service
	baseURLACL := utils.BuildServiceURL(config, config.ACLSvcBaseURL, config.BaseURL, "authz")
	secret := config.ACLSvcSecret

	baseURLPrincipal := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	principalSecret := config.NgManagerSecret

	baseURLResource := utils.BuildServiceURL(config, config.AuditSvcBaseURL, config.BaseURL, "resourcegroup")
	resourceSecret := config.AuditSvcSecret

	c, err := utils.CreateClient(baseURLACL, config, secret)
	if err != nil {
		return err
	}

	principalC, err := utils.CreateClient(baseURLPrincipal, config, principalSecret)
	if err != nil {
		return err
	}

	resourceC, err := utils.CreateClient(baseURLResource, config, resourceSecret)
	if err != nil {
		return err
	}

	aclClient := &client.ACLService{Client: c}
	principalClient := &client.PrincipalService{Client: principalC}
	resourceClient := &client.ResourceGroupService{Client: resourceC}

	accessControl := toolsets.NewToolset("access_control", "Access control related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListAvailableRolesTool(config, aclClient)),
			toolsets.NewServerTool(tools.ListAvailablePermissions(config, aclClient)),
			toolsets.NewServerTool(tools.ListRoleAssignmentsTool(config, aclClient)),
			toolsets.NewServerTool(tools.GetUserInfoTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetUserGroupInfoTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetServiceAccountTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetAllUsersTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetRoleInfoTool(config, aclClient)),
			toolsets.NewServerTool(tools.CreateUserGroupTool(config, principalClient)),
			toolsets.NewServerTool(tools.CreateRoleAssignmentTool(config, aclClient)),
			toolsets.NewServerTool(tools.CreateServiceAccountTool(config, principalClient)),
			toolsets.NewServerTool(tools.CreateResourceGroupTool(config, resourceClient)),
			toolsets.NewServerTool(tools.CreateRoleTool(config, aclClient)),
			toolsets.NewServerTool(tools.InviteUsersTool(config, principalClient)),
			toolsets.NewServerTool(tools.DeleteUserGroupTool(config, principalClient)),
			toolsets.NewServerTool(tools.DeleteServiceAccountTool(config, principalClient)),
			toolsets.NewServerTool(tools.DeleteRoleTool(config, aclClient)),
			toolsets.NewServerTool(tools.DeleteResourceGroupTool(config, resourceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(accessControl)
	return nil
}

// RegisterChatbot registers the chatbot toolset
func RegisterChatbot(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for external mode (no external service exposed)
	if !config.Internal {
		return nil
	}

	// Determine the base URL and secret for chatbot service
	baseURL := config.ChatbotBaseURL
	secret := config.ChatbotSecret

	// Create base client for chatbot
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	chatbotClient := &client.ChatbotService{Client: c}

	// Create the chatbot toolset
	chatbot := toolsets.NewToolset("chatbot", "Harness Documentation Bot tools").
		AddReadTools(
			toolsets.NewServerTool(tools.AskChatbotTool(config, chatbotClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(chatbot)
	return nil
}

func RegisterSettings(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for settings
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for settings
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	settingsClient := &client.SettingsClient{Client: c}

	// Create the settings toolset
	settings := toolsets.NewToolset("settings", "Harness Settings related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListSettingsTool(config, settingsClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(settings)
	return nil
}

func RegisterSecrets(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for secrets service
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for secrets
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	secretsClient := &client.SecretsClient{Client: c}

	// Create the secrets toolset
	secrets := toolsets.NewToolset("secrets", "Harness Secrets related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetSecretTool(config, secretsClient)),
			toolsets.NewServerTool(tools.ListSecretsTool(config, secretsClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(secrets)
	return nil
}

func RegisterPromptTools(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Create the prompt toolset with both tools
	prompt := toolsets.NewToolset("prompt", "Harness MCP Prompts tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetPromptTool(config)),
			toolsets.NewServerTool(tools.ListPromptsTool(config)),
		)

	// Add toolset to the group
	tsg.AddToolset(prompt)
	return nil
}
