package harness

import (
	"fmt"
	"slices"
	"time"

	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/modules/utils"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// DefaultTools Default tools to enable
var DefaultTools = []string{}

// InitToolsets initializes and returns the toolset groups
func InitToolsets(config *config.Config) (*toolsets.ToolsetGroup, error) {
	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Check if license validation is enabled
	if config.EnableLicense {
		// Create a module registry
		registry := modules.NewModuleRegistry(config, tsg)

		// Get enabled modules based on configuration
		enabledModules := registry.GetEnabledModules()

		// Register toolsets for enabled modules
		for _, module := range enabledModules {
			if err := module.RegisterToolsets(); err != nil {
				return nil, fmt.Errorf("failed to register toolsets for module %s: %w", module.ID(), err)
			}

			// Enable toolsets for this module
			if err := module.EnableToolsets(tsg); err != nil {
				return nil, fmt.Errorf("failed to enable toolsets for module %s: %w", module.ID(), err)
			}
		}
	} else {
		// License validation is disabled, use legacy toolset registration
		if err := initLegacyToolsets(config, tsg); err != nil {
			return nil, err
		}
	}

	return tsg, nil
}

func initLegacyToolsets(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Check if specific toolsets are enabled
	if len(config.Toolsets) == 0 {
		// Only register default toolset
		if err := RegisterDefault(config, tsg); err != nil {
			return err
		}
	} else {
		// Check if "all" is in the toolsets list
		allToolsets := slices.Contains(config.Toolsets, "all")

		if allToolsets {
			// Register all available toolsets
			if err := modules.RegisterPipelines(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterChatbot(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterGenAI(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterPullRequests(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterRepositories(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterRegistries(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterLogs(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterCloudCostManagement(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterServices(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterConnectors(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterDashboards(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterAudit(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterTemplates(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterIntelligence(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterDbops(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterAccessControl(config, tsg); err != nil {
				return err
			}
		} else {
			// Register specified toolsets
			for _, toolset := range config.Toolsets {
				switch toolset {
				case "default":
					if err := RegisterDefault(config, tsg); err != nil {
						return err
					}
				case "pipelines":
					if err := modules.RegisterPipelines(config, tsg); err != nil {
						return err
					}
				case "chatbot":
					if err := modules.RegisterChatbot(config, tsg); err != nil {
						return err
					}
				case "genai":
					if err := modules.RegisterGenAI(config, tsg); err != nil {
						return err
					}
				case "pullrequests":
					if err := modules.RegisterPullRequests(config, tsg); err != nil {
						return err
					}
				case "repositories":
					if err := modules.RegisterRepositories(config, tsg); err != nil {
						return err
					}
				case "registries":
					if err := modules.RegisterRegistries(config, tsg); err != nil {
						return err
					}
				case "logs":
					if err := modules.RegisterLogs(config, tsg); err != nil {
						return err
					}
				case "ccm":
					if err := modules.RegisterCloudCostManagement(config, tsg); err != nil {
						return err
					}
				case "services":
					if err := modules.RegisterServices(config, tsg); err != nil {
						return err
					}
				case "connectors":
					if err := modules.RegisterConnectors(config, tsg); err != nil {
						return err
					}
				case "dashboards":
					if err := modules.RegisterDashboards(config, tsg); err != nil {
						return err
					}
				case "audit":
					if err := modules.RegisterAudit(config, tsg); err != nil {
						return err
					}
				case "templates":
					if err := modules.RegisterTemplates(config, tsg); err != nil {
						return err
					}
				case "intelligence":
					if err := modules.RegisterIntelligence(config, tsg); err != nil {
						return err
					}
				case "dbops":
					if err := modules.RegisterDbops(config, tsg); err != nil {
						return err
					}
				case "access_control":
					if err := modules.RegisterAccessControl(config, tsg); err != nil {
						return err
					}
				}
			}
		}
	}

	// Enable requested toolsets
	if err := tsg.EnableToolsets(config.Toolsets); err != nil {
		return err
	}

	return nil
}

func RegisterDefault(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Create pipeline service client
	pipelineClient, err := utils.CreateServiceClient(config, config.PipelineSvcBaseURL, config.BaseURL, "pipeline", config.PipelineSvcSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for pipeline service: %w", err)
	}
	pipelineServiceClient := &client.PipelineService{Client: pipelineClient}

	// Create connector service client
	connectorClient, err := utils.CreateServiceClient(config, config.NgManagerBaseURL, config.BaseURL, "ng/api", config.NgManagerSecret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create dashboard service client
	customTimeout := 30 * time.Second
	dashboardClient, err := utils.CreateServiceClient(config, config.DashboardSvcBaseURL, config.BaseURL, "dashboard", config.DashboardSvcSecret, customTimeout)
	if err != nil {
		return fmt.Errorf("failed to create client for dashboard service: %w", err)
	}
	dashboardServiceClient := &client.DashboardService{Client: dashboardClient}

	// Create the default toolset with essential tools
	defaultToolset := toolsets.NewToolset("default", "Default essential Harness tools").AddReadTools(
		// Connector Management tools
		toolsets.NewServerTool(tools.GetConnectorDetailsTool(config, connectorServiceClient)),
		toolsets.NewServerTool(tools.ListConnectorCatalogueTool(config, connectorServiceClient)),

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
