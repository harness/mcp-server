package harness

import (
	"context"
	"encoding/json" // Added missing import
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/client/dto" // Added missing import
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"github.com/mark3labs/mcp-go/mcp"    // Added missing import
	"github.com/mark3labs/mcp-go/server" // Added for server.ToolHandlerFunc
)

// Default tools to enable
var DefaultTools = []string{"all"}

// Service identity for JWT auth
const serviceIdentity = "genaiservice" // TODO: can change once we have our own service, not needed at the moment

// Default JWT token lifetime
var defaultJWTLifetime = 1 * time.Hour

// ListConnectorCatalogueTool creates a new mcp.Tool and handler for listing the connector catalogue.
func ListConnectorCatalogueTool(harnessConfig *config.Config, c *client.Client) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_connector_catalogue",
			mcp.WithDescription("List the Harness connector catalogue."),
			// Define scope parameters (org_id, project_id) similar to other tools if needed by API
			// For getConnectorCatalogue, it seems to primarily use AccountID from scope, but org/project might be for filtering or future use.
			mcp.WithString("org_id", 
				mcp.Description("Optional ID of the organization."),
			),
			mcp.WithString("project_id", 
				mcp.Description("Optional ID of the project."),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			orgID, _ := OptionalParam[string](request, "org_id") // Allow empty if not provided
			projectID, _ := OptionalParam[string](request, "project_id")

			scope := dto.Scope{
				AccountID: harnessConfig.AccountID,
				OrgID:     orgID,
				ProjectID: projectID,
			}

			// If OrgID or ProjectID are not provided in params, use defaults from config
			if scope.OrgID == "" {
				scope.OrgID = harnessConfig.DefaultOrgID
			}
			if scope.ProjectID == "" {
				scope.ProjectID = harnessConfig.DefaultProjectID
			}

			connectorService := client.ConnectorService{Client: c}
			catalogue, err := connectorService.ListConnectorCatalogue(ctx, scope)
			if err != nil {
				// Using fmt.Errorf for the error that will be wrapped by the MCP framework
				return nil, fmt.Errorf("failed to list connector catalogue: %w", err)
			}

			responseBytes, err := json.Marshal(catalogue)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connector catalogue: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

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

	// Enable requested toolsets
	if err := tsg.EnableToolsets(config.Toolsets); err != nil {
		return nil, err
	}

	return tsg, nil
}

// createClient creates a client with the appropriate authentication method based on the config
func createClient(baseURL string, config *config.Config, secret string) (*client.Client, error) {
	var authProvider auth.Provider
	var err error

	if config.Internal {
		// Use JWT auth for internal mode
		authProvider = auth.NewJWTProvider(secret, serviceIdentity, &defaultJWTLifetime)
	} else {
		// Use API key auth for external mode
		authProvider = auth.NewAPIKeyProvider(config.APIKey)
	}

	client, err := client.NewWithAuthProvider(baseURL, authProvider)
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
		Client:          c,
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
	if config.Internal {
		return nil
	}

	authProvider := auth.NewAPIKeyProvider(config.APIKey)

	// Create base client for registries
	c, err := client.NewWithAuthProvider(baseURL, authProvider)
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

	arClient, err := ar.NewClientWithResponses(baseURL+"/har/api/v1", ar.WithHTTPClient(c),
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
	secret := ""
	if config.Internal {
		return nil
	}

	// Create base client for CCM
	c, err := createClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	ccmClient := &client.CloudCostManagementService{Client: c}

	// Create the CCM toolset
	ccm := toolsets.NewToolset("ccm", "Harness Cloud Cost Management related tools").
		AddReadTools(
			toolsets.NewServerTool(GetCcmOverviewTool(config, ccmClient)),
			toolsets.NewServerTool(ListCcmCostCategoriesTool(config, ccmClient)),
		)

	// Add toolset to the group
	tsg.AddToolset(ccm)
	return nil
}
