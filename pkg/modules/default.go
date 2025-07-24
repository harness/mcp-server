package modules

import (
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"time"
)

// DefaultModule implements the Module interface and contains all default toolsets
type DefaultModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewDefaultModule creates a new instance of DefaultModule
func NewDefaultModule(config *config.Config, tsg *toolsets.ToolsetGroup) *DefaultModule {
	return &DefaultModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *DefaultModule) ID() string {
	return "default"
}

// Name returns the name of module
func (m *DefaultModule) Name() string {
	return "Default Module"
}

// Toolsets returns the names of toolsets provided by this module
func (m *DefaultModule) Toolsets() []string {
	return []string{
		"default",
	}
}

// RegisterToolsets registers all toolsets in the default module
func (m *DefaultModule) RegisterToolsets() error {
	// Create pipeline service client
	pipelineClient, err := utils.CreateServiceClient(m.config, m.config.PipelineSvcBaseURL, m.config.BaseURL, "pipeline", m.config.PipelineSvcSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for pipeline service: %w", err)
	}
	pipelineServiceClient := &client.PipelineService{Client: pipelineClient}

	// Create connector service client
	connectorClient, err := utils.CreateServiceClient(m.config, m.config.NgManagerBaseURL, m.config.BaseURL, "ng/api", m.config.NgManagerSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create dashboard service client
	customTimeout := 30 * time.Second
	dashboardClient, err := utils.CreateServiceClient(m.config, m.config.DashboardSvcBaseURL, m.config.BaseURL, "dashboard", m.config.DashboardSvcSecret, customTimeout)
	if err != nil {
		return fmt.Errorf("failed to create client for dashboard service: %w", err)
	}
	dashboardServiceClient := &client.DashboardService{Client: dashboardClient}

	// Create the default toolset with essential tools
	defaultToolset := toolsets.NewToolset(m.Toolsets()[0], "Default essential Harness tools").AddReadTools(
		// Connector Management tools
		toolsets.NewServerTool(tools.GetConnectorDetailsTool(m.config, connectorServiceClient)),
		toolsets.NewServerTool(tools.ListConnectorCatalogueTool(m.config, connectorServiceClient)),

		// Pipeline Management tools
		toolsets.NewServerTool(tools.ListPipelinesTool(m.config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.GetPipelineTool(m.config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.FetchExecutionURLTool(m.config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.GetExecutionTool(m.config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.ListExecutionsTool(m.config, pipelineServiceClient)),

		// Dashboard tools
		toolsets.NewServerTool(tools.ListDashboardsTool(m.config, dashboardServiceClient)),
		toolsets.NewServerTool(tools.GetDashboardDataTool(m.config, dashboardServiceClient)),
	)

	// Add the default toolset to the group
	m.tsg.AddToolset(defaultToolset)
	return nil
}

// IsDefault indicates if this module should be enabled by default
func (m *DefaultModule) IsDefault() bool {
	return true
}
