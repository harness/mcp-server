// Package modules implements MCP server modules
// Package modules implements MCP server modules
package modules

import (
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/mcp"
	"github.com/harness/harness-mcp/pkg/server"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// SEIModule implements the Module interface for the SEI module
type SEIModule struct {
	config  *config.Config
	tsg     *toolsets.ToolsetGroup
	enabled bool
}

// NewSEIModule creates a new SEI module
func NewSEIModule(config *config.Config, tsg *toolsets.ToolsetGroup) *SEIModule {
	return &SEIModule{
		config:  config,
		tsg:     tsg,
		enabled: false,
	}
}

// ID returns the identifier for the module
func (m *SEIModule) ID() string {
	return "sei"
}

// Name returns the name of the module
func (m *SEIModule) Name() string {
	return "Software Engineering Insights"
}

// Toolsets returns the names of toolsets provided by this module
func (m *SEIModule) Toolsets() []string {
	return []string{"sei"}
}

// RegisterToolsets registers all toolsets in the SEI module
func (m *SEIModule) RegisterToolsets() error {
	return RegisterSEI(m.config, m.tsg)
}

// EnableToolsets enables all toolsets in the SEI module
func (m *SEIModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *SEIModule) IsDefault() bool {
	return false
}

// RegisterSEI creates an SEI client and registers SEI tools to the toolset group
func RegisterSEI(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for SEI service
	baseURL := utils.BuildServiceURL(config, config.SEISvcBaseURL, config.BaseURL, "sei")
	secret := config.SEISvcSecret

	// Create the SEI client
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	seiClient := &client.SEIService{
		Client: c,
	}

	// Import the tool functions directly
	// These are from pkg/harness/tools/sei.go
	type toolFactoryFunc func(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc)

	// Create the SEI toolset
	sei := toolsets.NewToolset("sei", "Harness Software Engineering Insights related tools")

	// Import and register the tool functions from pkg/harness/tools/sei.go
	sei.AddReadTools(
		// We need to use a regular import to access these functions
		// Call the external package directly with a qualified name
		toolsets.NewServerTool(
			getDORAMetricsTool(config, seiClient),
		),
		toolsets.NewServerTool(
			getBusinessAlignmentMetricsTool(config, seiClient),
		),
		toolsets.NewServerTool(
			listBusinessAlignmentDrilldownTool(config, seiClient),
		),
		toolsets.NewServerTool(
			getProductivityFeatureMetricsTool(config, seiClient),
		),
		toolsets.NewServerTool(
			getProductivityFeatureBreakdownTool(config, seiClient),
		),
		toolsets.NewServerTool(
			getProductivityFeatureDrilldownTool(config, seiClient),
		),
		toolsets.NewServerTool(
			getProductivityFeatureIndividualDrilldownTool(config, seiClient),
		),
	)

	// Add toolset to the group
	tsg.AddToolset(sei)

	return nil
}

// Tool factory functions - we need to redeclare these here to avoid the package issue
// They call the actual implementations from pkg/harness/tools/sei.go

func getDORAMetricsTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	// Directly call the implementation in pkg/harness/tools/sei.go
	// This is a simple wrapper to allow us to use the functions without importing the package
	return mcp.NewTool("get_dora_metrics",
		mcp.WithDescription("Get DORA metrics for the specified account, organization, and project"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
		mcp.WithString("startDate",
			mcp.Description("Start date for metrics in YYYY-MM-DD format"),
		),
		mcp.WithString("endDate",
			mcp.Description("End date for metrics in YYYY-MM-DD format"),
		),
		mcp.WithString("integrationId",
			mcp.Description("Integration ID to filter metrics by"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := request.GetParams()
		
		// Required params
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)
		
		// Build params map for additional parameters
		additionalParams := make(map[string]string)
		
		// Optional params
		if startDate, ok := params["startDate"].(string); ok && startDate != "" {
			additionalParams["startDate"] = startDate
		}
		if endDate, ok := params["endDate"].(string); ok && endDate != "" {
			additionalParams["endDate"] = endDate
		}
		if integrationID, ok := params["integrationId"].(string); ok && integrationID != "" {
			additionalParams["integrationId"] = integrationID
		}
		
		// Call API
		resp, err := client.GetDORAMetrics(ctx, accountID, orgID, projectID, additionalParams)
		if err != nil {
			return nil, err
		}
		
		return mcp.NewCallToolResult(resp), nil
	}
}

func getBusinessAlignmentMetricsTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("ccm_business_alignment_metrics",
		mcp.WithDescription("Get Business Alignment metrics for the specified account, organization, and project"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Implementation placeholder - would call client.GetBusinessAlignmentMetrics
		return mcp.NewCallToolResult(map[string]interface{}{
			"message": "Business Alignment Metrics implementation",
		}), nil
	}
}

func listBusinessAlignmentDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("ccm_business_alignment_drilldown",
		mcp.WithDescription("Get Business Alignment drilldown for the specified account, organization, and project"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Implementation placeholder - would call client.ListBusinessAlignmentDrilldown
		return mcp.NewCallToolResult(map[string]interface{}{
			"message": "Business Alignment Drilldown implementation",
		}), nil
	}
}

func getProductivityFeatureMetricsTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_metrics",
		mcp.WithDescription("Get Productivity Feature metrics"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Implementation placeholder - would call client.GetProductivityFeatureMetrics
		return mcp.NewCallToolResult(map[string]interface{}{
			"message": "Productivity Feature Metrics implementation",
		}), nil
	}
}

func getProductivityFeatureBreakdownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_breakdown",
		mcp.WithDescription("Get Productivity Feature breakdown"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Implementation placeholder - would call client.GetProductivityFeatureBreakdown
		return mcp.NewCallToolResult(map[string]interface{}{
			"message": "Productivity Feature Breakdown implementation",
		}), nil
	}
}

func getProductivityFeatureDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_drilldown",
		mcp.WithDescription("Get Productivity Feature drilldown"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Implementation placeholder - would call client.GetProductivityFeatureDrilldown
		return mcp.NewCallToolResult(map[string]interface{}{
			"message": "Productivity Feature Drilldown implementation",
		}), nil
	}
}

func getProductivityFeatureIndividualDrilldownTool(config *config.Config, client *client.SEIService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("sei_productivity_feature_individual_drilldown",
		mcp.WithDescription("Get Productivity Feature Individual drilldown"),
		mcp.WithString("accountId",
			mcp.Required(),
			mcp.Description("Harness Account ID"),
		),
		mcp.WithString("orgId",
			mcp.Required(),
			mcp.Description("Harness Organization ID"),
		),
		mcp.WithString("projectId",
			mcp.Required(),
			mcp.Description("Harness Project ID"),
		),
	), func(ctx server.ToolCallContext, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Implementation placeholder - would call client.GetProductivityFeatureIndividualDrilldown
		return mcp.NewCallToolResult(map[string]interface{}{
			"message": "Productivity Feature Individual Drilldown implementation",
		}), nil
	}
}

// SEIModule implements the Module interface for the SEI module.
type SEIModule struct {
	config  *config.Config
	tsg     *toolsets.ToolsetGroup
	enabled bool
}

// NewSEIModule creates a new SEI module.
func NewSEIModule(config *config.Config, tsg *toolsets.ToolsetGroup) *SEIModule {
	return &SEIModule{
		config:  config,
		tsg:     tsg,
		enabled: false,
	}
}

// ID returns the ID of the module.
func (m *SEIModule) ID() string {
	return "sei"
}

// Name returns the name of the module.
func (m *SEIModule) Name() string {
	return "Software Engineering Insights"
}

// Toolsets returns the toolsets registered by the module.
func (m *SEIModule) Toolsets() []string {
	return []string{"sei"}
}

// RegisterToolsets registers the module's toolsets.
func (m *SEIModule) RegisterToolsets() error {
	return RegisterSEI(m.config, m.tsg)
}

// EnableToolsets enables the module's toolsets.
func (m *SEIModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault returns whether the module is enabled by default.
func (m *SEIModule) IsDefault() bool {
	return false
}

// RegisterSEI creates an SEI client and registers SEI tools to the toolset group
func RegisterSEI(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for SEI service
	baseURL := utils.BuildServiceURL(config, config.SEISvcBaseURL, config.BaseURL, "sei")
	secret := config.SEISvcSecret

	// Create the SEI client
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	seiClient := &client.SEIService{
		Client: c,
	}

	// Create the SEI toolset
	sei := toolsets.NewToolset("sei", "Harness Software Engineering Insights related tools").AddReadTools(
		// DORA metrics tools
		toolsets.NewServerTool(tools.GetDORAMetricsTool(config, seiClient)),

		// Business Alignment tools
		toolsets.NewServerTool(tools.GetBusinessAlignmentMetricsTool(config, seiClient)),
		toolsets.NewServerTool(tools.ListBusinessAlignmentDrilldownTool(config, seiClient)),

		// Productivity tools
		toolsets.NewServerTool(getProductivityFeatureMetrics(config, seiClient)),
		toolsets.NewServerTool(getProductivityFeatureBreakdown(config, seiClient)),
		toolsets.NewServerTool(getProductivityFeatureDrilldown(config, seiClient)),
		toolsets.NewServerTool(getProductivityFeatureIndividualDrilldown(config, seiClient)),
	)

	// Add toolset to the group
	tsg.AddToolset(sei)

	return nil
}

// The following functions create tools for SEI functionality

// getDORAMetricsTool returns a tool for fetching DORA metrics
func getDORAMetricsTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("get_dora_metrics",
		mcp.WithDescription("Get DORA metrics for the specified account, organization, and project"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)

		return client.GetDORAMetrics(accountID, orgID, projectID)
	}

	return toolsets.NewServerTool(tool, handler)
}

// getBusinessAlignmentMetricsTool returns a tool for fetching Business Alignment metrics
func getBusinessAlignmentMetricsTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("get_business_alignment_metrics",
		mcp.WithDescription("Get Business Alignment metrics for the specified account, organization, and project"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)

		return client.GetBusinessAlignmentMetrics(accountID, orgID, projectID)
	}

	return toolsets.NewServerTool(tool, handler)
}

// listBusinessAlignmentDrilldownTool returns a tool for fetching Business Alignment drilldown data
func listBusinessAlignmentDrilldownTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("list_business_alignment_drilldown",
		mcp.WithDescription("List drilldown data for Business Alignment metrics"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)

		return client.GetBusinessAlignmentDrilldown(accountID, orgID, projectID)
	}

	return toolsets.NewServerTool(tool, handler)
}

// getProductivityFeatureMetricsTool returns a tool for fetching productivity feature metrics
func getProductivityFeatureMetricsTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("get_productivity_feature_metrics",
		mcp.WithDescription("Get productivity feature metrics for the specified account, organization, and project"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)

		return client.GetProductivityFeatureMetrics(accountID, orgID, projectID)
	}

	return toolsets.NewServerTool(tool, handler)
}

// getProductivityFeatureBreakdownTool returns a tool for fetching productivity feature breakdown data
func getProductivityFeatureBreakdownTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("get_productivity_feature_breakdown",
		mcp.WithDescription("Get productivity feature breakdown data"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)

		return client.GetProductivityFeatureBreakdown(accountID, orgID, projectID)
	}

	return toolsets.NewServerTool(tool, handler)
}

// getProductivityFeatureDrilldownTool returns a tool for fetching productivity feature drilldown data
func getProductivityFeatureDrilldownTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("get_productivity_feature_drilldown",
		mcp.WithDescription("Get productivity feature drilldown data"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)

		return client.GetProductivityFeatureDrilldown(accountID, orgID, projectID)
	}

	return toolsets.NewServerTool(tool, handler)
}

// getProductivityFeatureIndividualDrilldownTool returns a tool for fetching productivity feature drilldown data for an individual user
func getProductivityFeatureIndividualDrilldownTool(config *config.Config, client *client.SEIService) *toolsets.ServerTool {
	tool := mcp.NewTool("get_productivity_feature_individual_drilldown",
		mcp.WithDescription("Get productivity feature drilldown data for an individual user"),
		mcp.WithString("accountId", 
			mcp.Required(),
			mcp.WithDescription("Harness Account ID")),
		mcp.WithString("orgId",
			mcp.Optional("default"),
			mcp.WithDescription("Optional ID of the organization.")),
		mcp.WithString("projectId",
			mcp.Optional("SEI_Harness_Prod"),
			mcp.WithDescription("Optional ID of the project.")),
		mcp.WithString("userId",
			mcp.Required(),
			mcp.WithDescription("User ID for individual drilldown")),
	)

	handler := func(ctx context.Context, agent server.Agent, params map[string]any) (any, error) {
		accountID := params["accountId"].(string)
		orgID := params["orgId"].(string)
		projectID := params["projectId"].(string)
		userID := params["userId"].(string)

		return client.GetProductivityFeatureIndividualDrilldown(accountID, orgID, projectID, userID)
	}

	return toolsets.NewServerTool(tool, handler)
}
