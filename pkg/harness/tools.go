package harness

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/license"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// DefaultTools Default tools to enable
var DefaultTools = []string{}

// LicenseInfo holds information about account licenses
type LicenseInfo struct {
	AccountID      string
	ModuleLicenses map[string]bool // Map of module ID to license status
	IsValid        bool
}

// getEnabledModules returns a list of enabled modules based on configuration and license information
func getEnabledModules(configEnabledModules []modules.Module, licenseInfo *LicenseInfo) []modules.Module {

	// Filter modules based on license entitlements
	var licensedModules []modules.Module

	// If license is not valid, return default modules
	if !licenseInfo.IsValid {
		for _, module := range configEnabledModules {
			// Default modules are always enabled
			if module.IsDefault() {
				licensedModules = append(licensedModules, module)
			}
		}
		return licensedModules
	}

	for _, module := range configEnabledModules {
		// Default modules are always enabled
		if module.IsDefault() {
			licensedModules = append(licensedModules, module)
			continue
		}

		// Check if module has a valid license
		moduleID := module.ID()
		if isLicensed, exists := licenseInfo.ModuleLicenses[moduleID]; exists && isLicensed {
			licensedModules = append(licensedModules, module)
			slog.Info("Module enabled by license", "moduleID", moduleID)
		} else {
			slog.Warn("Module disabled due to missing or invalid license", "moduleID", moduleID)
		}
	}

	return licensedModules
}

// initLicenseValidation creates a license client and validates licenses
func initLicenseValidation(config *config.Config) (*LicenseInfo, error) {
	// Initialize license info with default values
	licenseInfo := &LicenseInfo{
		AccountID:      config.AccountID,
		ModuleLicenses: make(map[string]bool),
		IsValid:        false,
	}

	// Use the NextgenCE service for license validation
	licenseClient, err := utils.CreateLicenseClient(
		config,
		config.NgManagerBaseURL,
		config.BaseURL,
		"ng/api",
		config.NgManagerSecret,
	)
	if err != nil {
		slog.Error("Failed to create license client", "error", err)
		// Continue without license validation if client creation fails
		slog.Warn("Continuing without license validation")
		return licenseInfo, err
	}

	slog.Info("Successfully created license client", "baseURL", config.NgManagerBaseURL)

	// Call GetAccountLicensesWithResponse to get account licenses
	ctx := context.Background()
	includeAllLifeCycleStages := false

	// Create params with account identifier
	params := &license.GetAccountLicensesParams{
		AccountIdentifier:         &config.AccountID,
		IncludeAllLifeCycleStages: &includeAllLifeCycleStages,
	}

	// Make the API call
	response, err := licenseClient.GetAccountLicensesWithResponse(ctx, params)
	if err != nil {
		slog.Error("Failed to get account licenses", "error", err)
		return licenseInfo, err
	}

	// Check response status
	if response.HTTPResponse.StatusCode == 200 {
		// Print license information
		slog.Info("Successfully retrieved account licenses",
			"status", response.HTTPResponse.Status,
			"accountId", config.AccountID)

		// If response has JSON data, process it
		if response.JSON200 != nil {
			slog.Info("License response data",
				"hasData", response.JSON200.Data != nil,
				"status", response.JSON200.Status)

			// Process account license details if available
			if response.JSON200.Data != nil {
				// Set license info as valid
				licenseInfo.IsValid = true

				// Process module licenses from allModuleLicenses field
				if response.JSON200.Data.AllModuleLicenses != nil {
					// Iterate through all module types in allModuleLicenses
					for moduleType, licenses := range *response.JSON200.Data.AllModuleLicenses {
						// Check if there are any licenses for this module type
						if len(licenses) > 0 {
							// Use the first license to determine status (assuming one license per module type)
							license := licenses[0]

							// Check if the module license is valid (ACTIVE)
							isValid := false
							if license.Status != nil && *license.Status == "ACTIVE" {
								isValid = true
							}

							// Store the license status in our map
							licenseInfo.ModuleLicenses[moduleType] = isValid

							// Log the license status
							slog.Info("Module license status",
								"moduleType", moduleType,
								"isValid", isValid,
								"edition", license.Edition,
								"expiryTime", license.ExpiryTime)
						}
					}
				}

				// Log summary
				slog.Info("Account license details",
					"accountId", response.JSON200.Data.AccountId,
					"licenseCount", len(licenseInfo.ModuleLicenses))
			}
		}
	} else {
		slog.Error("Unexpected response status", "status", response.HTTPResponse.Status)
		return licenseInfo, fmt.Errorf("unexpected response status: %s", response.HTTPResponse.Status)
	}

	return licenseInfo, nil
}

// InitToolsets initializes and returns the toolset groups
func InitToolsets(config *config.Config) (*toolsets.ToolsetGroup, error) {
	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Initialize license validation if enabled
	var licenseInfo *LicenseInfo
	var err error
	if config.EnableLicense {
		licenseInfo, err = initLicenseValidation(config)
		if err != nil {
			slog.Warn("License validation failed, continuing with default modules", "error", err)
			// Continue with default modules if license validation fails
			licenseInfo = &LicenseInfo{
				AccountID:      config.AccountID,
				ModuleLicenses: make(map[string]bool),
				IsValid:        false,
			}
		}

		// Create a module registry
		registry := modules.NewModuleRegistry(config, tsg)

		// Get all modules that are enabled based on configuration
		configEnabledModules := registry.GetEnabledModules()

		// Get enabled modules based on configuration and license
		enabledModules := getEnabledModules(configEnabledModules, licenseInfo)

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
			if err := modules.RegisterSCS(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterSTO(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterInternalDeveloperPortal(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterChaos(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterEnvironments(config, tsg); err != nil {
				return err
			}
			if err := modules.RegisterInfrastructure(config, tsg); err != nil {
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
				case "scs":
					if err := modules.RegisterSCS(config, tsg); err != nil {
						return err
					}
				case "sto":
					if err := modules.RegisterSTO(config, tsg); err != nil {
						return err
					}
				case "idp":
					if err := modules.RegisterInternalDeveloperPortal(config, tsg); err != nil {
						return err
					}
				case "chaos":
					if err := modules.RegisterChaos(config, tsg); err != nil {
						return err
					}
				case "environments":
					if err := modules.RegisterEnvironments(config, tsg); err != nil {
						return err
					}
				case "infrastructure":
					if err := modules.RegisterInfrastructure(config, tsg); err != nil {
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
