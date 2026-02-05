package tools

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"time"

	config "github.com/harness/mcp-server/common"
	commonClient "github.com/harness/mcp-server/common/client"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
	commonTools "github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	tool_registration_utils "github.com/harness/mcp-server/common/pkg/utils"
	"github.com/harness/mcp-server/pkg/modules"

	_ "github.com/harness/mcp-server/pkg/tools/utils"
)

func InitToolsets(ctx context.Context, config *config.McpServerConfig) (*toolsets.ToolsetGroup, error) {
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Initialize license validation
	licenseInfo, err := tool_registration_utils.InitLicenseValidation(ctx, config)
	if err != nil {
		return nil, err
	}

	// Create module registry
	registry := modules.NewModuleRegistry(config, tsg)

	if !licenseInfo.IsValid || len(config.Toolsets) == 0 {
		RegisterDefaultToolsets(config, tsg)

		if err := tsg.EnableToolset("default"); err != nil {
			return nil, fmt.Errorf("failed to enable toolsets: %w", err)
		}
		tool_registration_utils.RegisterAllToolsetsWithTracker(ctx, tsg)
		return tsg, nil
	}

	// Validate requested toolsets against licenses
	allowedToolsets, deniedToolsets := registry.ValidateToolsets(
		config.Toolsets,
		licenseInfo.ModuleLicenses,
	)

	RegisterAllowedToolsets(ctx, tsg, config, allowedToolsets, false)
	// Log denied toolsets
	for toolset, reason := range deniedToolsets {
		slog.WarnContext(ctx, "Toolset denied",
			"toolset", toolset,
			"reason", reason)
	}

	// Only enable allowed toolsets
	if err := tsg.EnableToolsets(allowedToolsets); err != nil {
		return nil, fmt.Errorf("failed to enable toolsets: %w", err)
	}

	slog.InfoContext(ctx, "Toolsets validated",
		"allowed", len(allowedToolsets),
		"denied", len(deniedToolsets))

	tool_registration_utils.RegisterAllToolsetsWithTracker(ctx, tsg)
	return tsg, nil
}

func RegisterDefaultToolsets(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create pipeline service client
	pipelineClient, err := commonModules.DefaultClientProvider.CreateClient(config, "pipelines", 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to create client for pipeline service: %w", err)
	}
	pipelineServiceClient := &commonClient.PipelineService{Client: pipelineClient}

	// Create connector service client
	connectorClient, err := commonModules.DefaultClientProvider.CreateClient(config, "ngMan", 30*time.Second)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}
	connectorServiceClient := &commonClient.ConnectorService{Client: connectorClient}

	// Create dashboard service client
	customTimeout := 30 * time.Second
	dashboardClient, err := commonModules.DefaultClientProvider.CreateClient(config, "dashboards", customTimeout)
	if err != nil {
		return fmt.Errorf("failed to create client for dashboard service: %w", err)
	}
	dashboardServiceClient := &commonClient.DashboardService{Client: dashboardClient}

	// Create the default toolset with essential tools
	defaultToolset := toolsets.NewToolset("default", "Default essential Harness tools").AddReadTools(
		// Connector Management tools
		toolsets.NewServerTool(commonTools.GetConnectorDetailsTool(config, connectorServiceClient)),
		toolsets.NewServerTool(commonTools.ListConnectorCatalogueTool(config, connectorServiceClient)),
		toolsets.NewServerTool(commonTools.ListConnectorsTool(config, connectorServiceClient)),

		// Pipeline Management tools
		toolsets.NewServerTool(commonTools.ListPipelinesTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(commonTools.GetPipelineTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(commonTools.FetchExecutionURLTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(commonTools.GetExecutionTool(config, pipelineServiceClient)),
		toolsets.NewServerTool(commonTools.ListExecutionsTool(config, pipelineServiceClient)),

		// Dashboard tools
		toolsets.NewServerTool(commonTools.ListDashboardsTool(config, dashboardServiceClient)),
		toolsets.NewServerTool(commonTools.GetDashboardDataTool(config, dashboardServiceClient)),
	)

	// Add the default toolset to the group
	tsg.AddToolset(defaultToolset)
	return nil
}

// RegisterAllowedToolsets registers toolsets based on the allowedToolsets list or all toolsets if enableAll is true.
// To add a new toolset, add a new if block below - this is the single source of truth for available toolsets.
func RegisterAllowedToolsets(ctx context.Context, tsg *toolsets.ToolsetGroup, config *config.McpServerConfig, allowedToolsets []string, enableAll bool) error {
	if enableAll || slices.Contains(allowedToolsets, "acm") {
		if err := modules.RegisterACM(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "default") {
		if err := RegisterDefaultToolsets(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "pipelines") {
		if err := commonModules.RegisterPipelines(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "pullrequests") {
		if err := commonModules.RegisterPullRequests(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "repositories") {
		if err := commonModules.RegisterRepositories(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "registries") {
		if err := commonModules.RegisterRegistries(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "logs") {
		if err := modules.RegisterLogs(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "ccm") {
		if err := commonModules.RegisterCloudCostManagement(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "services") {
		if err := commonModules.RegisterServices(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "connectors") {
		if err := commonModules.RegisterConnectors(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "delegateTokens") {
		if err := commonModules.RegisterDelegateTokens(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "delegate") {
		if err := commonModules.RegisterDelegates(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "dashboards") {
		if err := commonModules.RegisterDashboards(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "audit") {
		if err := commonModules.RegisterAudit(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "templates") {
		if err := commonModules.RegisterTemplates(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "access_control") {
		if err := commonModules.RegisterAccessControl(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "scs") {
		if err := commonModules.RegisterSCS(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "sto") {
		if err := commonModules.RegisterSTO(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "idp") {
		if err := commonModules.RegisterInternalDeveloperPortal(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "chaos") {
		if err := commonModules.RegisterChaos(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "environments") {
		if err := commonModules.RegisterEnvironments(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "infrastructure") {
		if err := commonModules.RegisterInfrastructure(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "settings") {
		if err := commonModules.RegisterSettings(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "secrets") {
		if err := commonModules.RegisterSecrets(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "prompts") {
		if err := commonModules.RegisterPromptTools(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "sei") {
		if err := commonModules.RegisterSoftwareEngineeringInsights(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "fme") {
		if err := commonModules.RegisterFeatureManagementAndExperimentation(config, tsg); err != nil {
			return err
		}
	}
	if enableAll || slices.Contains(allowedToolsets, "gitops") {
		if err := commonModules.RegisterGitOps(config, tsg); err != nil {
			return err
		}
	}
	return nil
}
