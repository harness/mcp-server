package modules

import (
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// CODEModule implements the Module interface for Code Repository Management
type CODEModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewCODEModule creates a new instance of CODEModule
func NewCODEModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *CODEModule {
	return &CODEModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *CODEModule) ID() string {
	return "CODE"
}

// Name returns the name of module
func (m *CODEModule) Name() string {
	return "Code Repository Management"
}

// Toolsets returns the names of toolsets provided by this module
func (m *CODEModule) Toolsets() []string {
	return []string{
		"repositories",
		"pullrequests",
	}
}

// RegisterToolsets registers all toolsets in the CODE module
func (m *CODEModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "repositories":
			if err := RegisterRepositories(m.config, m.tsg); err != nil {
				return err
			}
		case "pullrequests":
			if err := RegisterPullRequests(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the CODE module
func (m *CODEModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *CODEModule) IsDefault() bool {
	return false
}

// RegisterRepositories registers the repositories toolset
func RegisterRepositories(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for repositories with code service identity
	c, err := DefaultClientProvider.CreateClient(config, "code")
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

// RegisterPullRequests registers the pull requests toolset
func RegisterPullRequests(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {

	// Create base client for pull requests with code service identity
	c, err := DefaultClientProvider.CreateClient(config, "code")
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
