package harness

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Default tools to enable
var DefaultTools = []string{"all"}

// Service identity for JWT auth
const serviceIdentity = "genaiservice" // TODO: can change once we have our own service, not needed at the moment

// Default JWT token lifetime
var defaultJWTLifetime = 1 * time.Hour

// Default timeout for GenAI service
const defaultGenaiTimeout = 60 * time.Second

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

	// Enable requested toolsets
	if err := tsg.EnableToolsets(config.Toolsets); err != nil {
		return nil, err
	}

	return tsg, nil
}

// createClient creates a client with the appropriate authentication method based on the config
// An optional customTimeout can be provided to override the config's DefaultTimeout
func createClient(baseURL string, config *config.Config, secret string, timeout ...time.Duration) (*client.Client, error) {
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
		slog.Error("Failed to create client", "error", err)
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	return client, nil
}

// registerPipelines registers the pipelines toolset
func registerPipelines(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for pipeline service
	baseURL := config.BaseURL
	secret := config.PipelineSvcSecret
	if config.Internal {
		baseURL = config.PipelineSvcBaseURL
	}

	// Create base client for pipelines
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	pipelineClient := &client.PipelineService{
		Client:           c,
		UseInternalPaths: config.Internal,
	}

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

// registerPullRequests registers the pull requests toolset
func registerPullRequests(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for pull requests
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

	// Create base client for pull requests
	c, err := createClient(baseURL, config, secret)
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
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

	// Create base client for repositories
	c, err := createClient(baseURL, config, secret)
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
	baseURL := config.BaseURL
	secret := config.ArtifactRegistrySecret
	if config.Internal {
		baseURL = config.ArtifactRegistryBaseURL
	}

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

	// Different API paths for internal vs external mode
	apiPath := "/har/api/v1"
	if config.Internal {
		apiPath = "/api/v1"
	}

	arClient, err := ar.NewClientWithResponses(baseURL+apiPath, ar.WithHTTPClient(c),
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
	// Connector catalogue API uses standard auth and doesn't have a specific service URL or secret beyond the main client config.
	baseURL := config.BaseURL
	secret := "" // No specific secret for this general API endpoint

	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return fmt.Errorf("failed to create client for connectors: %w", err)
	}

	// Create the connectors toolset
	connectors := toolsets.NewToolset("connectors", "Harness Connector related tools").
		AddReadTools(
			toolsets.NewServerTool(ListConnectorCatalogueTool(config, c)),
			toolsets.NewServerTool(GetConnectorDetailsTool(config, c)),
		)

	tsg.AddToolset(connectors)
	return nil
}

// registerInfrastructure registers the infrastructure toolset
func registerInfrastructure(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for infrastructure
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

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
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

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
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

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
	// Determine the base URL and secret for logs
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

	// Create base client for logs
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	logClient := &client.LogService{Client: c}

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
	baseURL := config.BaseURL
	secret := config.NextgenCESecret
	if config.Internal {
		baseURL = config.NextgenCEBaseURL
	}

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
	baseURL := config.GenaiBaseURL
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
	// Determine the base URL for dashboards
	baseURL := config.BaseURL
	secret := ""
	if config.Internal {
		return nil
	}

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
