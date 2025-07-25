package harness

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/modules/utils"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/client/dbops"
	"github.com/harness/harness-mcp/client/dbops/generated"
	scs "github.com/harness/harness-mcp/client/scs/generated"
	sto "github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// DefaultTools Default tools to enable
var DefaultTools = []string{}
var EnabledModules = []string{"all"}

// Default timeout for GenAI service
const defaultGenaiTimeout = 300 * time.Second

// InitToolsets initializes and returns the toolset groups
func InitToolsets(config *config.Config) (*toolsets.ToolsetGroup, error) {
	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Phase 1 Only register default module
	mr := modules.NewModuleRegistry(config, tsg)
	enabledModules := mr.GetEnabledModules()
	for _, m := range enabledModules {
		err := m.RegisterToolsets()
		if err != nil {
			return nil, err
		}
	}

	// Register pipelines
	if err := RegisterPipelines(config, tsg); err != nil {
		return nil, err
	}

	// Register chatbot
	if err := RegisterChatbot(config, tsg); err != nil {
		return nil, err
	}

	// Register genai
	if err := registerGenai(config, tsg); err != nil {
		return nil, err
	}

	// TODO: support internal mode for other endpoints as well eventually
	if err := RegisterPullRequests(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterRepositories(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterRegistries(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterLogs(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterCloudCostManagement(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterServices(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterEnvironments(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterInfrastructure(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterConnectors(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterDashboards(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterChaos(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterTemplates(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterIntelligence(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterInternalDeveloperPortal(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterSCS(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterSTO(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterAudit(config, tsg); err != nil {
		return nil, err
	}

	if err := RegisterDbops(config, tsg); err != nil {
		return nil, err
	}

	if err := registerAccessControl(config, tsg); err != nil {
		return nil, err
	}

	// Enable requested toolsets
	if err := tsg.EnableToolsets(config.Toolsets); err != nil {
		return nil, err
	}

	return tsg, nil
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

// RegisterSCS registers the Supply Chain Security toolset
func RegisterSCS(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.SCSSvcBaseURL, config.BaseURL, "/ssca-manager")
	secret := config.SCSSvcSecret
	// Create base client for SCS
	c, err := utils.CreateClient(baseURL, config, secret, 30*time.Second)
	if err != nil {
		return err
	}

	requestEditorFn := func(ctx context.Context, req *http.Request) error {
		k, v, err := c.AuthProvider.GetHeader(ctx)
		if err != nil {
			return err
		}
		req.Header.Set(k, v)
		return nil
	}

	scsClient, err := scs.NewClientWithResponses(baseURL, scs.WithHTTPClient(c),
		scs.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return fmt.Errorf("failed to create generated SCS client: %w", err)
	}

	scs := toolsets.NewToolset("scs", "Harness Supply Chain Security tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListSCSCodeReposTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetCodeRepositoryOverviewTool(config, scsClient)),
			toolsets.NewServerTool(tools.FetchComplianceResultsByArtifactTool(config, scsClient)),
			toolsets.NewServerTool(tools.ListArtifactSourcesTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactV2OverviewTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactChainOfCustodyV2Tool(config, scsClient)),
			toolsets.NewServerTool(tools.CreateOPAPolicyTool(config, scsClient)),
		)
	tsg.AddToolset(scs)
	return nil
}

// RegisterSTO registers the Security Test Orchestration toolset
func RegisterSTO(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.STOSvcBaseURL, config.BaseURL, "/sto")
	secret := config.STOSvcSecret

	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	requestEditorFn := func(ctx context.Context, req *http.Request) error {
		k, v, err := c.AuthProvider.GetHeader(ctx)
		if err != nil {
			return err
		}
		req.Header.Set(k, v)
		return nil
	}

	stoClient, err := sto.NewClientWithResponses(baseURL, sto.WithHTTPClient(c),
		sto.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return fmt.Errorf("failed to create generated STO client: %w", err)
	}
	sto := toolsets.NewToolset("sto", "Harness Security Test Orchestration tools").
		AddReadTools(
			toolsets.NewServerTool(tools.FrontendAllIssuesListTool(config, stoClient)),
		)
	tsg.AddToolset(sto)
	return nil
}

// RegisterPullRequests registers the pull requests toolset
func RegisterPullRequests(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for pull requests
	baseURL := utils.BuildServiceURL(config, config.CodeSvcBaseURL, config.BaseURL, "code")
	secret := config.CodeSvcSecret

	// Create base client for pull requests with code service identity
	c, err := utils.CreateClientWithIdentity(baseURL, config, secret, utils.AiServiceIdentity)
	if err != nil {
		return err
	}

	pullRequestClient := &client.PullRequestService{Client: c}

	// Create the pull requests toolset
	pullrequests := toolsets.NewToolset("pullrequests", "Harness Pull Request related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetPullRequestTool(config, pullRequestClient)),
			toolsets.NewServerTool(tools.ListPullRequestsTool(config, pullRequestClient)),
			toolsets.NewServerTool(tools.GetPullRequestChecksTool(config, pullRequestClient)),
			toolsets.NewServerTool(tools.GetPullRequestActivitiesTool(config, pullRequestClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(tools.CreatePullRequestTool(config, pullRequestClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(pullrequests)
	return nil
}

// RegisterRepositories registers the repositories toolset
func RegisterRepositories(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for repositories
	baseURL := utils.BuildServiceURL(config, config.CodeSvcBaseURL, config.BaseURL, "code")
	secret := config.CodeSvcSecret

	// Create base client for repositories with code service identity
	c, err := utils.CreateClientWithIdentity(baseURL, config, secret, utils.AiServiceIdentity)
	if err != nil {
		return err
	}

	repositoryClient := &client.RepositoryService{Client: c}

	// Create the repositories toolset
	repositories := toolsets.NewToolset("repositories", "Harness Repository related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetRepositoryTool(config, repositoryClient)),
			toolsets.NewServerTool(tools.ListRepositoriesTool(config, repositoryClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(repositories)
	return nil
}

// RegisterRegistries registers the registries toolset
func RegisterRegistries(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for registries
	// The AR client expects the full base URL including API version path
	baseURL := utils.BuildServiceURL(config, config.ArtifactRegistryBaseURL+"/api/v1", config.BaseURL, "har/api/v1")
	secret := config.ArtifactRegistrySecret

	// Create client with appropriate auth based on internal mode
	var c *client.Client
	var err error

	if config.Internal {
		authProvider := auth.NewJWTProvider(secret, "Basic", &utils.DefaultJWTLifetime)
		c, err = client.NewWithAuthProvider(baseURL, authProvider)
	} else {
		authProvider := auth.NewAPIKeyProvider(config.APIKey)
		c, err = client.NewWithAuthProvider(baseURL, authProvider)
	}

	if err != nil {
		return err
	}

	requestEditorFn := func(ctx context.Context, req *http.Request) error {
		k, v, err := c.AuthProvider.GetHeader(ctx)
		if err != nil {
			return err
		}
		req.Header.Set(k, v)
		req.Header.Set("Accept", "application/json")
		return nil
	}

	arClient, err := ar.NewClientWithResponses(baseURL, ar.WithHTTPClient(c),
		ar.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return err
	}

	// Create the registries toolset
	registries := toolsets.NewToolset("registries", "Harness Artifact Registry related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetRegistryTool(config, arClient)),
			toolsets.NewServerTool(tools.ListRegistriesTool(config, arClient)),
			toolsets.NewServerTool(tools.ListArtifactsTool(config, arClient)),
			toolsets.NewServerTool(tools.ListArtifactVersionsTool(config, arClient)),
			toolsets.NewServerTool(tools.ListArtifactFilesTool(config, arClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(registries)
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

// createConnectorClient creates and returns a connector client
func createConnectorClient(config *config.Config) (*client.ConnectorService, error) {
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return nil, fmt.Errorf("failed to create client for connectors: %w", err)
	}

	return &client.ConnectorService{Client: c}, nil
}

// RegisterConnectors registers the connectors toolset
func RegisterConnectors(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	connectorService, err := createConnectorClient(config)
	if err != nil {
		return err
	}

	// Create the connectors toolset
	connectors := toolsets.NewToolset("connectors", "Harness Connector related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListConnectorCatalogueTool(config, connectorService)),
			toolsets.NewServerTool(tools.GetConnectorDetailsTool(config, connectorService)),
		)

	tsg.AddToolset(connectors)
	return nil
}

// RegisterInfrastructure registers the infrastructure toolset
func RegisterInfrastructure(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for infrastructure
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for infrastructure
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	infrastructureClient := &client.InfrastructureClient{Client: c}

	// Create the infrastructure toolset
	infrastructure := toolsets.NewToolset("infrastructure", "Harness Infrastructure related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListInfrastructuresTool(config, infrastructureClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(tools.MoveInfrastructureConfigsTool(config, infrastructureClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(infrastructure)
	return nil
}

// RegisterEnvironments registers the environments toolset
func RegisterEnvironments(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for environments
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for environments
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	environmentClient := &client.EnvironmentClient{Client: c}

	// Create the environments toolset
	environments := toolsets.NewToolset("environments", "Harness Environment related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetEnvironmentTool(config, environmentClient)),
			toolsets.NewServerTool(tools.ListEnvironmentsTool(config, environmentClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(tools.MoveEnvironmentConfigsTool(config, environmentClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(environments)
	return nil
}

// RegisterServices registers the services toolset
func RegisterServices(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for services
	baseURL := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for services
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	serviceClient := &client.ServiceClient{Client: c}

	// Create the services toolset
	services := toolsets.NewToolset("services", "Harness Service related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetServiceTool(config, serviceClient)),
			toolsets.NewServerTool(tools.ListServicesTool(config, serviceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(services)
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

func RegisterCloudCostManagement(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for CCM
	baseURL := utils.BuildServiceURL(config, config.NextgenCEBaseURL, config.BaseURL, "")
	secret := config.NextgenCESecret

	// Create base client for CCM
	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	ccmClient := &client.CloudCostManagementService{
		Client: c,
	}

	// Create the CCM toolset
	ccm := toolsets.NewToolset("ccm", "Harness Cloud Cost Management related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetCcmOverviewTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmCostCategoriesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmCostCategoriesDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmCostCategoryTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmPerspectivesDetailTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetLastPeriodCostCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetLastTwelveMonthsCostCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CreateCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveGridTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveTimeSeriesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveSummaryWithBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmMetadataTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveRecommendationsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.CcmPerspectiveFilterValuesTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmRecommendationsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.ListCcmRecommendationsByResourceTypeTool(config, ccmClient)),
			toolsets.NewServerTool(tools.GetCcmRecommendationsStatsTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentCoverageTool(config, ccmClient)),
			toolsets.NewServerTool(tools.FetchCommitmentSavingsTool(config, ccmClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(ccm)
	return nil
}

// RegisterGenai registers the genai toolset
func registerGenai(config *config.Config, tsg *toolsets.ToolsetGroup) error {

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

// RegisterChaos registers the chaos toolset
func RegisterChaos(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for CHAOS
	baseURL := utils.BuildServiceURL(config, config.ChaosManagerSvcBaseURL, config.BaseURL, "chaos/manager")
	secret := config.ChaosManagerSvcSecret

	// Create base client for CHAOS
	customTimeout := 30 * time.Second
	c, err := utils.CreateClient(baseURL, config, secret, customTimeout)
	if err != nil {
		return err
	}

	chaosClient := &client.ChaosService{Client: c}

	// Create the CHAOS toolset
	chaos := toolsets.NewToolset("chaos", "Harness Chaos Engineering related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListExperimentsTool(config, chaosClient)),
			toolsets.NewServerTool(tools.GetExperimentsTool(config, chaosClient)),
			toolsets.NewServerTool(tools.GetExperimentRunsTool(config, chaosClient)),
			toolsets.NewServerTool(tools.RunExperimentTool(config, chaosClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(chaos)
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

func RegisterInternalDeveloperPortal(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for IDP service
	baseURL := utils.BuildServiceURL(config, config.IDPSvcBaseURL, config.BaseURL, "")
	secret := config.IDPSvcSecret

	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	idpClient := &client.IDPService{
		Client: c,
	}

	idp := toolsets.NewToolset("Internal Developer Portal", "Harness Internal Developer Portal catalog related tools for managing catalog Entities which represent the core components of your system").
		AddReadTools(
			toolsets.NewServerTool(tools.ListEntitiesTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetEntityTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetScorecardTool(config, idpClient)),
			toolsets.NewServerTool(tools.ListScorecardsTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetScoreSummaryTool(config, idpClient)),
			toolsets.NewServerTool(tools.GetScoresTool(config, idpClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(idp)
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

	dbopsGenClient, err := generated.NewClientWithResponses(baseURL, generated.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return err
	}

	// Create connector client for JDBC connector operations
	connectorClient, err := createConnectorClient(config)
	if err != nil {
		return err
	}

	// Create the dbops client
	dbopsClient := dbops.NewClient(dbopsGenClient, connectorClient)

	// Create the dbops toolset
	dbopsToolset := toolsets.NewToolset("dbops", "Database operations related tools").
		AddReadTools(
			toolsets.NewServerTool(tools.GetDatabaseInfoTool(config, dbopsClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(dbopsToolset)
	return nil
}

func registerAccessControl(config *config.Config, tsg *toolsets.ToolsetGroup) error {
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
