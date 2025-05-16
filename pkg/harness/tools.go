package harness

import (
	"context"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// Default tools to enable
var DefaultTools = []string{"all"}

// InitToolsets initializes and returns the toolset groups
func InitToolsets(client *client.Client, config *config.Config) (*toolsets.ToolsetGroup, error) {

	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Create the pipelines toolset
	pipelines := toolsets.NewToolset("pipelines", "Harness Pipeline related tools").
		AddReadTools(
			toolsets.NewServerTool(ListPipelinesTool(config, client)),
			toolsets.NewServerTool(GetPipelineTool(config, client)),
			toolsets.NewServerTool(FetchExecutionURLTool(config, client)),
			toolsets.NewServerTool(GetExecutionTool(config, client)),
			toolsets.NewServerTool(ListExecutionsTool(config, client)),
		)

	// Create the pull requests toolset
	pullrequests := toolsets.NewToolset("pullrequests", "Harness Pull Request related tools").
		AddReadTools(
			toolsets.NewServerTool(GetPullRequestTool(config, client)),
			toolsets.NewServerTool(ListPullRequestsTool(config, client)),
			toolsets.NewServerTool(GetPullRequestChecksTool(config, client)),
		).
		AddWriteTools(
			toolsets.NewServerTool(CreatePullRequestTool(config, client)),
		)

	// Create the repositories toolset
	repositories := toolsets.NewToolset("repositories", "Harness Repository related tools").
		AddReadTools(
			toolsets.NewServerTool(GetRepositoryTool(config, client)),
			toolsets.NewServerTool(ListRepositoriesTool(config, client)),
		)

	registries := toolsets.NewToolset("registries", "Harness Artifact Registry related tools").
		AddReadTools(
			toolsets.NewServerTool(GetRegistryTool(config, client)),
			toolsets.NewServerTool(ListRegistriesTool(config, client)),
			toolsets.NewServerTool(ListArtifactsTool(config, client)),
			toolsets.NewServerTool(ListVersionsTool(config, client)),
			toolsets.NewServerTool(ListFilesTool(config, client)),
		)

	// Create the logs toolset
	logs := toolsets.NewToolset("logs", "Harness Logs related tools").
		AddReadTools(
			toolsets.NewServerTool(DownloadExecutionLogsTool(config, client)),
		)

	// Add toolsets to the group
	tsg.AddToolset(pullrequests)
	tsg.AddToolset(pipelines)
	tsg.AddToolset(repositories)
	tsg.AddToolset(registries)
	tsg.AddToolset(logs)

	// Enable requested toolsets
	if err := tsg.EnableToolsets(config.Toolsets); err != nil {
		return nil, err
	}

	return tsg, nil
}

// SetupContextWithApiKey sets up the context with the API key
func SetupContextWithApiKey(ctx context.Context, apiKey string) context.Context {
	return context.WithValue(ctx, "apiKey", apiKey)
}

// SetupContextWithBearerToken sets up the context with the bearer token
func SetupContextWithBearerToken(ctx context.Context, bearerToken string) context.Context {
	return context.WithValue(ctx, "bearerToken", bearerToken)
}
