package modules

import (
	"fmt"
	"strings"
	"time"

	config "github.com/harness/mcp-server/common"
	client "github.com/harness/mcp-server/common/client"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// ExtendedCoreModule extends the common CoreModule with internal-only toolsets
type ExtendedCoreModule struct {
	*commonModules.CoreModule // Embed the common CoreModule
	config                    *config.McpServerConfig
	tsg                       *toolsets.ToolsetGroup
}

// NewExtendedCoreModule creates a new instance of ExtendedCoreModule
func NewExtendedCoreModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *ExtendedCoreModule {
	return &ExtendedCoreModule{
		CoreModule: commonModules.NewCoreModule(config, tsg),
		config:     config,
		tsg:        tsg,
	}
}

// Toolsets returns all toolsets (common + internal)
func (m *ExtendedCoreModule) Toolsets() []string {
	// Get common toolsets
	commonToolsets := m.CoreModule.Toolsets()

	// Add internal-only toolsets
	additionalToolsets := []string{
		"logs",
		"default",
	}

	return append(commonToolsets, additionalToolsets...)
}

func (m *ExtendedCoreModule) RegisterToolsets() error {
	m.CoreModule.RegisterToolsets()

	// Register additional toolsets
	RegisterLogs(m.config, m.tsg)
	RegisterDefaultToolsets(m.config, m.tsg)
	return nil
}

func RegisterDefaultToolsets(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create pipeline service client
	pipelineClient, err := commonModules.DefaultClientProvider.CreateClient(config, "pipelines", 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to create client for pipeline service: %w", err)
	}
	pipelineServiceClient := &client.PipelineService{Client: pipelineClient}

	// Create connector service client
	connectorClient, err := commonModules.DefaultClientProvider.CreateClient(config, "ngMan", 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create dashboard service client
	customTimeout := 30 * time.Second
	dashboardClient, err := commonModules.DefaultClientProvider.CreateClient(config, "dashboards", customTimeout)
	if err != nil {
		return fmt.Errorf("failed to create client for dashboard service: %w", err)
	}
	dashboardServiceClient := &client.DashboardService{Client: dashboardClient}

	// Create the default toolset with essential tools
	defaultToolset := toolsets.NewToolset("default", "Default essential Harness tools").AddReadTools(
		// Connector Management tools
		toolsets.NewServerTool(tools.GetConnectorDetailsTool(config, connectorServiceClient)),
		toolsets.NewServerTool(tools.ListConnectorCatalogueTool(config, connectorServiceClient)),
		toolsets.NewServerTool(tools.ListConnectorsTool(config, connectorServiceClient)),

		// Pipeline Management tools
		toolsets.NewServerTool(tools.ListPipelinesTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.GetPipelineTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.FetchExecutionURLTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.GetExecutionTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(tools.ListExecutionsTool(config, pipelineServiceClient)),

		// Dashboard tools
		toolsets.NewServerTool(tools.ListDashboardsTool(config, dashboardServiceClient)),
		toolsets.NewServerTool(tools.GetDashboardDataTool(config, dashboardServiceClient)),
	)

	// Add the default toolset to the group
	tsg.AddToolset(defaultToolset)
	return nil
}

// RegisterLogs registers the logs toolset
func RegisterLogs(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// To handle unique ingress for log-service
	var logServiceClient *client.Client
	var err error
	if strings.Contains(config.BaseURL, "/gateway") {
		logServiceClient, err = commonModules.DefaultClientProvider.CreateClient(config, "log-service")
	} else {
		logServiceClient, err = commonModules.DefaultClientProvider.CreateClient(config, "gateway/log-service")
	}

	if err != nil {
		return err
	}

	// Create base client for pipelines
	pipelineClient, err := commonModules.DefaultClientProvider.CreateClient(config, "pipelines")
	if err != nil {
		return err
	}

	logClient := &client.LogService{LogServiceClient: logServiceClient, PipelineClient: pipelineClient}
	extendedLogClient := tools.NewExtendedLogService(logClient)

	// Create the logs toolset
	logs := toolsets.NewToolset("logs", "Harness Logs related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.DownloadExecutionLogsTool(config, extendedLogClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(logs)
	return nil
}
