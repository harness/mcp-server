package modules

import (
	"fmt"
	"strings"
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

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
		"delegateTokens",
		"dashboards",
		"access_control",
		"templates",
		"logs",
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
		case "logs":
			err := RegisterLogs(m.config, m.tsg)
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

// RegisterPipelines registers the pipelines toolset
func RegisterPipelines(config *config.Config, tsg *toolsets.ToolsetGroup) error {

	// Create base client for pipelines
	c, err := DefaultClientProvider.CreateClient(config, "pipelines")
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
		)

	// Add toolset to the group
	tsg.AddToolset(pipelines)
	return nil
}

// RegisterConnectors registers the connectors toolset
func RegisterConnectors(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	connectorClient, err := DefaultClientProvider.CreateClient(config, "ngMan")
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
	delegateTokenClient, err := DefaultClientProvider.CreateClient(config, "ngMan")
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

	// Create base client for dashboards
	customTimeout := 30 * time.Second
	c, err := DefaultClientProvider.CreateClient(config, "dashboards", customTimeout)
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

	c, err := DefaultClientProvider.CreateClient(config, "audit")
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
	// To handle unique ingress for log-service
	var logServiceClient *client.Client
	var err error
	if strings.Contains(config.BaseURL, "/gateway") {
		logServiceClient, err = DefaultClientProvider.CreateClient(config, "log-service")
	} else {
		logServiceClient, err = DefaultClientProvider.CreateClient(config, "gateway/log-service")
	}

	if err != nil {
		return err
	}

	// Create base client for pipelines
	pipelineClient, err := DefaultClientProvider.CreateClient(config, "pipelines")
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
	// Create base client for templates
	c, err := DefaultClientProvider.CreateClient(config, "templates")
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

func RegisterAccessControl(config *config.Config, tsg *toolsets.ToolsetGroup) error {

	c, err := DefaultClientProvider.CreateClient(config, "acl")
	if err != nil {
		return err
	}

	principalC, err := DefaultClientProvider.CreateClient(config, "ngMan")
	if err != nil {
		return err
	}

	resourceC, err := DefaultClientProvider.CreateClient(config, "resourcegroup")
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

func RegisterSettings(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Create base client for settings
	c, err := DefaultClientProvider.CreateClient(config, "ngMan")
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
	// Create base client for secrets
	c, err := DefaultClientProvider.CreateClient(config, "ngMan")
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
