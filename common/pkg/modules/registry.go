package modules

import (
	"context"
	"fmt"
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// ModuleRegistry holds all available modules
type ModuleRegistry struct {
	modules          []Module
	config           *config.Config
	tsg              *toolsets.ToolsetGroup
	moduleToToolsets map[string][]string // Maps module IDs to their toolsets
	toolsetToModule  map[string]string   // Maps toolset names to their modules
}

// NewModuleRegistry creates a new module registry with all available modules
func NewModuleRegistry(config *config.Config, tsg *toolsets.ToolsetGroup) *ModuleRegistry {
	registry := &ModuleRegistry{
		modules: []Module{
			NewCoreModule(config, tsg),
			NewCIModule(config, tsg),
			NewCDModule(config, tsg),
			NewUnlicensedModule(config, tsg),
			NewCHAOSModule(config, tsg),
			NewSEIModule(config, tsg),
			NewSTOModule(config, tsg),
			NewSSCAModule(config, tsg),
			NewCODEModule(config, tsg),
			NewCCMModule(config, tsg),
			NewIDPModule(config, tsg),
			NewHARModule(config, tsg),
			NewACMModule(config, tsg),
		},
		config:           config,
		tsg:              tsg,
		moduleToToolsets: make(map[string][]string),
		toolsetToModule:  make(map[string]string),
	}

	// Populate the moduleToToolsets mapping
	for _, module := range registry.modules {
		registry.moduleToToolsets[module.ID()] = module.Toolsets()

		for _, toolset := range module.Toolsets() {
			registry.toolsetToModule[toolset] = module.ID()
		}
	}

	return registry
}

// GetAllModules returns all available modules
func (r *ModuleRegistry) GetAllModules() []Module {
	return r.modules
}

// GetToolsetsForModule returns the toolsets associated with a module ID
func (r *ModuleRegistry) GetToolsetsForModule(moduleID string) []string {
	if toolsets, exists := r.moduleToToolsets[moduleID]; exists {
		return toolsets
	}
	return []string{}
}

// GetToolsetGroup returns the underlying toolset group
func (r *ModuleRegistry) GetToolsetGroup() *toolsets.ToolsetGroup {
	return r.tsg
}

// Global registry instance
var globalRegistry *ModuleRegistry

// SetGlobalRegistry sets the global module registry instance
func SetGlobalRegistry(registry *ModuleRegistry) {
	globalRegistry = registry
}

// GetGlobalRegistry returns the global module registry instance
func GetGlobalRegistry() *ModuleRegistry {
	return globalRegistry
}

// ValidateToolsets checks if the given toolsets are allowed based on licensed modules
// Returns:
// - allowedToolsets: list of toolsets the user can use
// - deniedToolsets: list of toolsets the user cannot use (with reasons)
func (r *ModuleRegistry) ValidateToolsets(
	requestedToolsets []string,
	licensedModules map[string]bool,
) (allowedToolsets []string, deniedToolsets map[string]string) {

	deniedToolsets = make(map[string]string)
	allowedToolsets = []string{}

	for _, toolset := range requestedToolsets {
		// Check if toolset exists
		moduleID, exists := r.toolsetToModule[toolset]
		if !exists {
			deniedToolsets[toolset] = "toolset does not exist"
			continue
		}

		// Check if the module is licensed
		// Handle special case for CCM -> CE mapping
		licenseKey := moduleID
		if moduleID == "CCM" {
			licenseKey = "CE"
		}

		// Check if module is default (always allowed) or licensed
		module := r.getModuleByID(moduleID)
		if module != nil && (module.IsDefault() || licensedModules[licenseKey]) {
			allowedToolsets = append(allowedToolsets, toolset)
		} else {
			deniedToolsets[toolset] = fmt.Sprintf("module %s is not licensed", moduleID)
		}
	}

	return allowedToolsets, deniedToolsets
}

// Helper method to get module by ID
func (r *ModuleRegistry) getModuleByID(moduleID string) Module {
	for _, module := range r.modules {
		if module.ID() == moduleID {
			return module
		}
	}
	return nil
}

func RegisterDefaultToolsets(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Create pipeline service client
	pipelineClient, err := DefaultClientProvider.CreateClient(config, "pipelines", 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to create client for pipeline service: %w", err)
	}
	pipelineServiceClient := &client.PipelineService{Client: pipelineClient}

	// Create connector service client
	connectorClient, err := DefaultClientProvider.CreateClient(config, "ngMan", 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &client.ConnectorService{Client: connectorClient}

	// Create dashboard service client
	customTimeout := 30 * time.Second
	dashboardClient, err := DefaultClientProvider.CreateClient(config, "dashboards", customTimeout)
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

func RegisterAllowedToolsets(ctx context.Context, tsg *toolsets.ToolsetGroup, config *config.Config, toolsets []string) error {
	for _, toolset := range toolsets {
		switch toolset {
		case "default":
			if err := RegisterDefaultToolsets(config, tsg); err != nil {
				return err
			}
		case "pipelines":
			if err := RegisterPipelines(config, tsg); err != nil {
				return err
			}
		case "pullrequests":
			if err := RegisterPullRequests(config, tsg); err != nil {
				return err
			}
		case "repositories":
			if err := RegisterRepositories(config, tsg); err != nil {
				return err
			}
		case "registries":
			if err := RegisterRegistries(config, tsg); err != nil {
				return err
			}
		case "logs":
			if err := RegisterLogs(config, tsg); err != nil {
				return err
			}
		case "ccm":
			if err := RegisterCloudCostManagement(config, tsg); err != nil {
				return err
			}
		case "services":
			if err := RegisterServices(config, tsg); err != nil {
				return err
			}
		case "connectors":
			if err := RegisterConnectors(config, tsg); err != nil {
				return err
			}
		case "delegateTokens":
			if err := RegisterDelegateTokens(config, tsg); err != nil {
				return err
			}
		case "dashboards":
			if err := RegisterDashboards(config, tsg); err != nil {
				return err
			}
		case "audit":
			if err := RegisterAudit(config, tsg); err != nil {
				return err
			}
		case "templates":
			if err := RegisterTemplates(config, tsg); err != nil {
				return err
			}
		case "access_control":
			if err := RegisterAccessControl(config, tsg); err != nil {
				return err
			}
		case "scs":
			if err := RegisterSCS(config, tsg); err != nil {
				return err
			}
		case "sto":
			if err := RegisterSTO(config, tsg); err != nil {
				return err
			}
		case "idp":
			if err := RegisterInternalDeveloperPortal(config, tsg); err != nil {
				return err
			}
		case "chaos":
			if err := RegisterChaos(config, tsg); err != nil {
				return err
			}
		case "environments":
			if err := RegisterEnvironments(config, tsg); err != nil {
				return err
			}
		case "infrastructure":
			if err := RegisterInfrastructure(config, tsg); err != nil {
				return err
			}
		case "acm":
			if err := RegisterACM(config, tsg); err != nil {
				return err
			}
		case "settings":
			if err := RegisterSettings(config, tsg); err != nil {
				return err
			}
		case "secrets":
			if err := RegisterSecrets(config, tsg); err != nil {
				return err
			}
		case "prompts":
			if err := RegisterPromptTools(config, tsg); err != nil {
				return err
			}
		case "sei":
			if err := RegisterSoftwareEngineeringInsights(config, tsg); err != nil {
				return err
			}
		case "fme":
			if err := RegisterFeatureManagementAndExperimentation(config, tsg); err != nil {
				return err
			}
		}
	}
	return nil
}
