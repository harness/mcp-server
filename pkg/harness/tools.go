package harness

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	scs "github.com/harness/harness-mcp/client/scs/generated"
	sto "github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Default tools to enable
var DefaultTools = []string{"all"}

// Service identity for JWT auth
const serviceIdentity = "genaiservice" // TODO: can change once we have our own service, not needed at the moment
const aiServiceIdentity = "aifoundation"

// Default JWT token lifetime
var defaultJWTLifetime = 1 * time.Hour

// Default timeout for GenAI service
const defaultGenaiTimeout = 300 * time.Second

// InitToolsets initializes and returns the toolset groups
func InitToolsets(config *config.Config) (*toolsets.ToolsetGroup, error) {
	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Register pipelines
	if err := registerPipelines(config, tsg); err != nil {
		return nil, err
	}

	// Register chatbot
	if err := registerChatbot(config, tsg); err != nil {
		return nil, err
	}

	// Register genai
	if err := registerGenai(config, tsg); err != nil {
		return nil, err
	}

	// TODO: support internal mode for other endpoints as well eventually
	if err := registerPullRequests(config, tsg); err != nil {
		return nil, err
	}

	if err := registerRepositories(config, tsg); err != nil {
		return nil, err
	}

	if err := registerRegistries(config, tsg); err != nil {
		return nil, err
	}

	if err := registerLogs(config, tsg); err != nil {
		return nil, err
	}

	if err := registerCloudCostManagement(config, tsg); err != nil {
		return nil, err
	}

	if err := registerServices(config, tsg); err != nil {
		return nil, err
	}

	if err := registerEnvironments(config, tsg); err != nil {
		return nil, err
	}

	if err := registerInfrastructure(config, tsg); err != nil {
		return nil, err
	}

	if err := registerConnectors(config, tsg); err != nil {
		return nil, err
	}

	if err := registerDashboards(config, tsg); err != nil {
		return nil, err
	}

	if err := registerChaos(config, tsg); err != nil {
		return nil, err
	}

	if err := registerTemplates(config, tsg); err != nil {
		return nil, err
	}

	if err := registerIntelligence(config, tsg); err != nil {
		return nil, err
	}

	if err := registerInternalDeveloperPortal(config, tsg); err != nil {
		return nil, err
	}

	if err := registerSCS(config, tsg); err != nil {
		return nil, err
	}

	if err := registerSTO(config, tsg); err != nil {
		return nil, err
	}

	if err := registerAudit(config, tsg); err != nil {
		return nil, err
	}

	// Enable requested toolsets
	if err := tsg.EnableToolsets(config.Toolsets); err != nil {
		return nil, err
	}

	return tsg, nil
}

func buildServiceURL(config *config.Config, internalBaseURL, externalBaseURL string, externalPathPrefix string) string {
	if config.Internal {
		return internalBaseURL
	}
	return externalBaseURL + "/" + externalPathPrefix
}

// createClient creates a client with the appropriate authentication method based on the config
// An optional customTimeout can be provided to override the config's DefaultTimeout
// An optional custom service identity can be provided to override the default service identity
func createClient(baseURL string, config *config.Config, secret string, timeout ...time.Duration) (*client.Client, error) {
	return createClientWithIdentity(baseURL, config, secret, serviceIdentity, timeout...)
}

// createClientWithIdentity is like createClient but allows specifying a custom service identity
func createClientWithIdentity(baseURL string, config *config.Config, secret string, serviceIdentity string, timeout ...time.Duration) (*client.Client, error) {
	var authProvider auth.Provider
	var err error

	if config.Internal {
		// Use JWT auth for internal mode
		authProvider = auth.NewJWTProvider(secret, serviceIdentity, &defaultJWTLifetime)
	} else {
		// Use API key auth for external mode
		authProvider = auth.NewAPIKeyProvider(config.APIKey)
	}

	client, err := client.NewWithAuthProvider(baseURL, authProvider, timeout...)
	if err != nil {
		log.Printf("Failed to create client: %v", err)
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	return client, nil
}

// registerPipelines registers the pipelines toolset
func registerPipelines(config *config.Config, tsg *toolsets.ToolsetGroup) error {

	// Determine the base URL and secret for pipeline service
	baseURL := buildServiceURL(config, config.PipelineSvcBaseURL, config.BaseURL, "pipeline")
	secret := config.PipelineSvcSecret

	// Create base client for pipelines
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	pipelineClient := &client.PipelineService{Client: c}

	// Create the pipelines toolset
	pipelines := toolsets.NewToolset("pipelines", "Harness Pipeline related tools").
		AddReadTools(
			toolsets.NewServerTool(ListPipelinesTool(config, pipelineClient)),
			toolsets.NewServerTool(GetPipelineTool(config, pipelineClient)),
			toolsets.NewServerTool(FetchExecutionURLTool(config, pipelineClient)),
			toolsets.NewServerTool(GetExecutionTool(config, pipelineClient)),
			toolsets.NewServerTool(ListExecutionsTool(config, pipelineClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(pipelines)
	return nil
}

// registerSCS registers the Supply Chain Security toolset
func registerSCS(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := buildServiceURL(config, config.SCSSvcBaseURL, config.BaseURL, "/ssca-manager")
	secret := config.SCSSvcSecret

	// Create base client for SCS
	c, err := createClient(baseURL, config, secret)
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
			toolsets.NewServerTool(ListSCSCodeReposTool(config, scsClient)),
			toolsets.NewServerTool(GetCodeRepositoryOverviewTool(config, scsClient)),
			toolsets.NewServerTool(FetchComplianceResultsByArtifactTool(config, scsClient)),
			toolsets.NewServerTool(ListArtifactSourcesTool(config, scsClient)),
			toolsets.NewServerTool(ArtifactListV2Tool(config, scsClient)),
			toolsets.NewServerTool(GetArtifactV2OverviewTool(config, scsClient)),
			toolsets.NewServerTool(GetArtifactChainOfCustodyV2Tool(config, scsClient)),
		)
	tsg.AddToolset(scs)
	return nil
}

// registerSTO registers the Security Test Orchestration toolset
func registerSTO(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := buildServiceURL(config, config.STOSvcBaseURL, config.BaseURL, "/sto")
	secret := config.STOSvcSecret

	c, err := createClient(baseURL, config, secret)
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
			toolsets.NewServerTool(FrontendAllIssuesListTool(config, stoClient)),
		)
	tsg.AddToolset(sto)
	return nil
}

// registerPullRequests registers the pull requests toolset
func registerPullRequests(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for pull requests
	baseURL := buildServiceURL(config, config.CodeSvcBaseURL, config.BaseURL, "code")
	secret := config.CodeSvcSecret

	// Create base client for pull requests with code service identity
	c, err := createClientWithIdentity(baseURL, config, secret, aiServiceIdentity)
	if err != nil {
		return err
	}

	pullRequestClient := &client.PullRequestService{Client: c}

	// Create the pull requests toolset
	pullrequests := toolsets.NewToolset("pullrequests", "Harness Pull Request related tools").
		AddReadTools(
			toolsets.NewServerTool(GetPullRequestTool(config, pullRequestClient)),
			toolsets.NewServerTool(ListPullRequestsTool(config, pullRequestClient)),
			toolsets.NewServerTool(GetPullRequestChecksTool(config, pullRequestClient)),
			toolsets.NewServerTool(GetPullRequestActivitiesTool(config, pullRequestClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(CreatePullRequestTool(config, pullRequestClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(pullrequests)
	return nil
}

// registerRepositories registers the repositories toolset
func registerRepositories(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for repositories
	baseURL := buildServiceURL(config, config.CodeSvcBaseURL, config.BaseURL, "code")
	secret := config.CodeSvcSecret

	// Create base client for repositories with code service identity
	c, err := createClientWithIdentity(baseURL, config, secret, aiServiceIdentity)
	if err != nil {
		return err
	}

	repositoryClient := &client.RepositoryService{Client: c}

	// Create the repositories toolset
	repositories := toolsets.NewToolset("repositories", "Harness Repository related tools").
		AddReadTools(
			toolsets.NewServerTool(GetRepositoryTool(config, repositoryClient)),
			toolsets.NewServerTool(ListRepositoriesTool(config, repositoryClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(repositories)
	return nil
}

// registerRegistries registers the registries toolset
func registerRegistries(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for registries
	// The AR client expects the full base URL including API version path
	baseURL := buildServiceURL(config, config.ArtifactRegistryBaseURL+"/api/v1", config.BaseURL, "har/api/v1")
	secret := config.ArtifactRegistrySecret

	// Create client with appropriate auth based on internal mode
	var c *client.Client
	var err error

	if config.Internal {
		authProvider := auth.NewJWTProvider(secret, "Basic", &defaultJWTLifetime)
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
			toolsets.NewServerTool(GetRegistryTool(config, arClient)),
			toolsets.NewServerTool(ListRegistriesTool(config, arClient)),
			toolsets.NewServerTool(ListArtifactsTool(config, arClient)),
			toolsets.NewServerTool(ListArtifactVersionsTool(config, arClient)),
			toolsets.NewServerTool(ListArtifactFilesTool(config, arClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(registries)
	return nil
}

// registerChatbot registers the chatbot toolset
func registerChatbot(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for external mode (no external service exposed)
	if !config.Internal {
		return nil
	}

	// Determine the base URL and secret for chatbot service
	baseURL := config.ChatbotBaseURL
	secret := config.ChatbotSecret

	// Create base client for chatbot
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	chatbotClient := &client.ChatbotService{Client: c}

	// Create the chatbot toolset
	chatbot := toolsets.NewToolset("chatbot", "Harness Documentation Bot tools").
		AddReadTools(
			toolsets.NewServerTool(AskChatbotTool(config, chatbotClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(chatbot)
	return nil
}

// registerConnectors registers the connectors toolset
func registerConnectors(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := buildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}

	connectorService := &client.ConnectorService{Client: c}

	// Create the connectors toolset
	connectors := toolsets.NewToolset("connectors", "Harness Connector related tools").
		AddReadTools(
			toolsets.NewServerTool(ListConnectorCatalogueTool(config, connectorService)),
			toolsets.NewServerTool(GetConnectorDetailsTool(config, connectorService)),
		)

	tsg.AddToolset(connectors)
	return nil
}

// registerInfrastructure registers the infrastructure toolset
func registerInfrastructure(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for infrastructure
	baseURL := buildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for infrastructure
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	infrastructureClient := &client.InfrastructureClient{Client: c}

	// Create the infrastructure toolset
	infrastructure := toolsets.NewToolset("infrastructure", "Harness Infrastructure related tools").
		AddReadTools(
			toolsets.NewServerTool(ListInfrastructuresTool(config, infrastructureClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(MoveInfrastructureConfigsTool(config, infrastructureClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(infrastructure)
	return nil
}

// registerEnvironments registers the environments toolset
func registerEnvironments(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for environments
	baseURL := buildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for environments
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	environmentClient := &client.EnvironmentClient{Client: c}

	// Create the environments toolset
	environments := toolsets.NewToolset("environments", "Harness Environment related tools").
		AddReadTools(
			toolsets.NewServerTool(GetEnvironmentTool(config, environmentClient)),
			toolsets.NewServerTool(ListEnvironmentsTool(config, environmentClient)),
		).
		AddWriteTools(
			toolsets.NewServerTool(MoveEnvironmentConfigsTool(config, environmentClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(environments)
	return nil
}

// registerServices registers the services toolset
func registerServices(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for services
	baseURL := buildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	secret := config.NgManagerSecret

	// Create base client for services
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	serviceClient := &client.ServiceClient{Client: c}

	// Create the services toolset
	services := toolsets.NewToolset("services", "Harness Service related tools").
		AddReadTools(
			toolsets.NewServerTool(GetServiceTool(config, serviceClient)),
			toolsets.NewServerTool(ListServicesTool(config, serviceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(services)
	return nil
}

// registerLogs registers the logs toolset
func registerLogs(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for internal mode for now
	if config.Internal {
		return nil
	}
	// Determine the base URL and secret for logs
	logServiceBaseURL := buildServiceURL(config, config.LogSvcBaseURL, config.BaseURL, "log-service")
	logServiceSecret := config.LogSvcSecret

	// Create base client for logs
	logServiceClient, err := createClient(logServiceBaseURL, config, logServiceSecret)
	if err != nil {
		return err
	}

	// Determine the base URL and secret for pipeline service
	baseURL := buildServiceURL(config, config.PipelineSvcBaseURL, config.BaseURL, "pipeline")
	pipelineServiceSecret := config.PipelineSvcSecret

	// Create base client for pipelines
	pipelineClient, err := createClient(baseURL, config, pipelineServiceSecret)
	if err != nil {
		return err
	}

	logClient := &client.LogService{LogServiceClient: logServiceClient, PipelineClient: pipelineClient}

	// Create the logs toolset
	logs := toolsets.NewToolset("logs", "Harness Logs related tools").
		AddReadTools(
			toolsets.NewServerTool(DownloadExecutionLogsTool(config, logClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(logs)
	return nil
}

func registerCloudCostManagement(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for CCM
	baseURL := buildServiceURL(config, config.NextgenCEBaseURL, config.BaseURL, "")
	secret := config.NextgenCESecret

	// Create base client for CCM
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	ccmClient := &client.CloudCostManagementService{
		Client: c,
	}

	// Create the CCM toolset
	ccm := toolsets.NewToolset("ccm", "Harness Cloud Cost Management related tools").
		AddReadTools(
			toolsets.NewServerTool(GetCcmOverviewTool(config, ccmClient)),
			toolsets.NewServerTool(ListCcmCostCategoriesTool(config, ccmClient)),
			toolsets.NewServerTool(ListCcmCostCategoriesDetailTool(config, ccmClient)),
			toolsets.NewServerTool(GetCcmCostCategoryTool(config, ccmClient)),
			toolsets.NewServerTool(ListCcmPerspectivesDetailTool(config, ccmClient)),
			toolsets.NewServerTool(GetCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(GetLastPeriodCostCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(GetLastTwelveMonthsCostCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(CreateCcmPerspectiveTool(config, ccmClient)),
			toolsets.NewServerTool(CcmPerspectiveGridTool(config, ccmClient)),
			toolsets.NewServerTool(CcmPerspectiveTimeSeriesTool(config, ccmClient)),
			toolsets.NewServerTool(CcmPerspectiveSummaryWithBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(CcmPerspectiveBudgetTool(config, ccmClient)),
			toolsets.NewServerTool(CcmMetadataTool(config, ccmClient)),
			toolsets.NewServerTool(CcmPerspectiveRecommendationsTool(config, ccmClient)),
			toolsets.NewServerTool(FetchCommitmentCoverageTool(config, ccmClient)),
			toolsets.NewServerTool(FetchCommitmentSavingsTool(config, ccmClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(ccm)
	return nil
}

// registerGenai registers the genai toolset
func registerGenai(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Skip registration for external mode for now
	if !config.Internal {
		return nil
	}

	// Determine the base URL and secret for genai service
	baseURL := config.GenaiBaseURL // Only used in internal mode
	secret := config.GenaiSecret

	// Create base client for genai with the default timeout
	c, err := createClient(baseURL, config, secret, defaultGenaiTimeout)
	if err != nil {
		return err
	}

	genaiClient := &client.GenaiService{Client: c}

	// Create the genai toolset
	genai := toolsets.NewToolset("genai", "Harness GenAI tools").
		AddReadTools(
			toolsets.NewServerTool(AIDevOpsAgentTool(config, genaiClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(genai)
	return nil
}

// registerDashboards registers the dashboards toolset
func registerDashboards(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := buildServiceURL(config, config.DashboardSvcBaseURL, config.BaseURL, "dashboard")
	secret := config.DashboardSvcSecret

	// Create base client for dashboards
	customTimeout := 30 * time.Second
	c, err := createClient(baseURL, config, secret, customTimeout)
	if err != nil {
		return err
	}

	dashboardClient := &client.DashboardService{Client: c}

	// Create the dashboards toolset
	dashboards := toolsets.NewToolset("dashboards", "Harness Dashboards related tools").
		AddReadTools(
			toolsets.NewServerTool(ListDashboardsTool(config, dashboardClient)),
			toolsets.NewServerTool(GetDashboardDataTool(config, dashboardClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(dashboards)
	return nil
}

// registerChaos registers the chaos toolset
func registerChaos(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for CHAOS
	baseURL := buildServiceURL(config, config.ChaosManagerSvcBaseURL, config.BaseURL, "chaos/manager")
	secret := config.ChaosManagerSvcSecret

	// Create base client for CHAOS
	customTimeout := 30 * time.Second
	c, err := createClient(baseURL, config, secret, customTimeout)
	if err != nil {
		return err
	}

	chaosClient := &client.ChaosService{Client: c}

	// Create the CHAOS toolset
	chaos := toolsets.NewToolset("chaos", "Harness Chaos Engineering related tools").
		AddReadTools(
			toolsets.NewServerTool(ListExperimentsTool(config, chaosClient)),
			toolsets.NewServerTool(GetExperimentsTool(config, chaosClient)),
			toolsets.NewServerTool(GetExperimentRunsTool(config, chaosClient)),
			toolsets.NewServerTool(RunExperimentTool(config, chaosClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(chaos)
	return nil
}

// registerTemplates registers the templates toolset
func registerTemplates(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for templates
	baseURL := config.BaseURL
	secret := config.TemplateSvcSecret
	if config.Internal {
		baseURL = config.TemplateSvcBaseURL
	}

	// Create base client for templates
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	templateClient := &client.TemplateService{
		Client:           c,
		UseInternalPaths: config.Internal,
	}

	// Create the templates toolset
	templates := toolsets.NewToolset("templates", "Harness Template related tools").
		AddReadTools(
			toolsets.NewServerTool(ListTemplates(config, templateClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(templates)
	return nil
}

// registerIntelligence registers the intelligence toolset
func registerIntelligence(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for intelligence
	baseURL := buildServiceURL(config, config.IntelligenceSvcBaseURL, config.BaseURL, "harness-intelligence")
	secret := config.IntelligenceSvcSecret

	// Create base client for intelligence service
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	intelligenceClient := &client.IntelligenceService{
		Client: c,
	}

	// Create the intelligence toolset
	intelligence := toolsets.NewToolset("intelligence", "Harness Intelligence related tools").
		AddReadTools(
			toolsets.NewServerTool(FindSimilarTemplates(config, intelligenceClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(intelligence)
	return nil
}

func registerInternalDeveloperPortal(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for IDP service
	baseURL := buildServiceURL(config, config.IDPSvcBaseURL, config.BaseURL, "")
	secret := config.IDPSvcSecret

	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	idpClient := &client.IDPService{
		Client: c,
	}

	idp := toolsets.NewToolset("Internal Developer Portal", "Harness Internal Developer Portal catalog related tools for managing catalog Entities which represent the core components of your system").
		AddReadTools(
			toolsets.NewServerTool(ListEntitiesTool(config, idpClient)),
			toolsets.NewServerTool(GetEntityTool(config, idpClient)),
			toolsets.NewServerTool(GetScorecardTool(config, idpClient)),
			toolsets.NewServerTool(ListScorecardsTool(config, idpClient)),
			toolsets.NewServerTool(GetScoreSummaryTool(config, idpClient)),
			toolsets.NewServerTool(GetScoresTool(config, idpClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(idp)
	return nil
}
func registerAudit(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for audit service
	baseURL := buildServiceURL(config, config.AuditSvcBaseURL, config.BaseURL, "audit")
	secret := config.AuditSvcSecret

	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}
	auditService := &client.AuditService{Client: c}
	audit := toolsets.NewToolset("audit", "Audit log related tools").
		AddReadTools(
			toolsets.NewServerTool(ListUserAuditTrailTool(config, auditService)),
		)

	// Add toolset to the group
	tsg.AddToolset(audit)
	return nil
}
