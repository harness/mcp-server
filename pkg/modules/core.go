package modules

import (
	"strings"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
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
	}

	return append(commonToolsets, additionalToolsets...)
}

func (m *ExtendedCoreModule) RegisterToolsets() error {
	m.CoreModule.RegisterToolsets()

	// Register additional toolsets
	RegisterLogs(m.config, m.tsg)
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
