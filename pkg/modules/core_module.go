package modules

import (
	"context"
	"fmt"
	generated2 "github.com/harness/harness-mcp/client/dbops/generated"
	"net/http"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dbops"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Default timeout for GenAI service
const defaultGenaiTimeout = 300 * time.Second

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
		"dbops",
		"logs",
		"genai",
		"intelligence",
case "chatbot":
	err := RegisterChatbot(m.config, m.tsg)
	if err != nil {
		return err
	}
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
		case "genai":
			err := RegisterGenAI(m.config, m.tsg)
			if err != nil {
				return err
			}
		case "intelligence":
			err := RegisterIntelligence(m.config, m.tsg)
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
		)

	tsg.AddToolset(connectors)
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
	logServiceBaseURL := utils.BuildServiceURL(config, config.LogSvcBaseURL, config.BaseURL, "log-service")
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

// RegisterGenAI registers the genai toolset
func RegisterGenAI(config *config.Config, tsg *toolsets.ToolsetGroup) error {

	// Skip registration for external mode for now
	if !config.Internal {
		return nil
	}

	// Determine the base URL and secret for genai service
	baseURL := config.GenaiBaseURL // Only used in internal mode
	secret := config.GenaiSecret

	// Create base client for genai with the default timeout
	c, err := utils.CreateClient(baseURL, config, secret, defaultGenaiTimeout)
	if err != nil {
		return err
	}

	genaiClient := &client.GenaiService{Client: c}

	// Create the genai toolset
	genai := toolsets.NewToolset("genai", "Harness GenAI tools").
		AddReadTools(
			toolsets.NewServerTool(tools.AIDevOpsAgentTool(config, genaiClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(genai)
	return nil
}

// RegisterTemplates registers the templates toolset
func RegisterTemplates(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for templates
	baseURL := utils.BuildServiceURL(config, config.TemplateSvcBaseURL, config.BaseURL, "")
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
	c, err := utils.CreateClientWithIdentity(baseURL, config, secret, utils.AiServiceIdentity)
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
		)

	// Add toolset to the group
	tsg.AddToolset(intelligence)
	return nil
}

// RegisterDbops registers the database operations toolset
func RegisterDbops(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for dbops service
	baseURL := utils.BuildServiceURL(config, config.DBOpsSvcBaseURL, config.BaseURL, "dbops")
	secret := config.DBOpsSvcSecret

	// Create base client for dbops
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return fmt.Errorf("failed to create client for dbops: %w", err)
	}

	// Create the generated client for dbops
	requestEditorFn := func(ctx context.Context, req *http.Request) error {
		if c.AuthProvider == nil {
			return fmt.Errorf("auth provider is not initialized")
		}
		k, v, err := c.AuthProvider.GetHeader(ctx)
		if err != nil {
			return err
		}
		req.Header.Set(k, v)
		return nil
	}

	dbopsGenClient, err := generated2.NewClientWithResponses(baseURL, generated2.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return err
	}

	// Create connector client for JDBC connector operations
	connectorClient, err := utils.CreateServiceClient(config, config.NgManagerBaseURL, config.BaseURL, "ng/api", config.NgManagerSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create the dbops client
	dbopsClient := dbops.NewClient(dbopsGenClient, connectorServiceClient)

	// Create the dbops toolset
	dbopsToolset := toolsets.NewToolset("dbops", "Database operations related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetDatabaseInfoTool(config, dbopsClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(dbopsToolset)
	return nil
}

func RegisterAccessControl(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for access control service
	baseURLRBAC := utils.BuildServiceURL(config, config.RBACSvcBaseURL, config.BaseURL, "authz")
	secret := config.RBACSvcSecret

	baseURLPrincipal := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	principalSecret := config.NgManagerSecret

	c, err := utils.CreateClient(baseURLRBAC, config, secret)
	if err != nil {
		return err
	}

	principalC, err := utils.CreateClient(baseURLPrincipal, config, principalSecret)
	if err != nil {
		return err
	}

	rbacClient := &client.RBACService{Client: c}
	principalClient := &client.PrincipalService{Client: principalC}

	accessControl := toolsets.NewToolset("access_control", "Access control related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListAvailableRolesTool(config, rbacClient)),
			toolsets.NewServerTool(tools.ListAvailablePermissions(config, rbacClient)),
			toolsets.NewServerTool(tools.ListRoleAssignmentsTool(config, rbacClient)),
			toolsets.NewServerTool(tools.GetUserInfoTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetUserGroupInfoTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetServiceAccountTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetAllUsersTool(config, principalClient)),
			toolsets.NewServerTool(tools.GetRoleInfoTool(config, rbacClient)),
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
