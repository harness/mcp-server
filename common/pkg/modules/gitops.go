package modules

import (
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

type GitOpsModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

func NewGitOpsModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *GitOpsModule {
	return &GitOpsModule{
		config: config,
		tsg:    tsg,
	}
}

func (m *GitOpsModule) ID() string {
	return "GITOPS"
}

func (m *GitOpsModule) Name() string {
	return "GitOps"
}

func (m *GitOpsModule) Toolsets() []string {
	return []string{"gitops"}
}

func (m *GitOpsModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "gitops":
			if err := RegisterGitOps(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *GitOpsModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

func (m *GitOpsModule) IsDefault() bool {
	return false
}

func RegisterGitOps(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	customTimeout := 30 * time.Second
	c, err := DefaultClientProvider.CreateClient(config, "gitops", customTimeout)
	if err != nil {
		return err
	}

	gitopsClient := &client.GitOpsService{Client: c}

	gitops := toolsets.NewToolset("gitops", "Harness GitOps (ArgoCD) tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListAgentsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetAgentTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.ListApplicationsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetApplicationTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetApplicationResourceTreeTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.ListApplicationEventsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetPodLogsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetManagedResourcesTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.ListResourceActionsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.ListApplicationSetsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetApplicationSetTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.ListClustersTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetClusterTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GitOpsListRepositoriesTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GitOpsGetRepositoryTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.ListRepoCredentialsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetRepoCredentialsTool(config, gitopsClient)),
			toolsets.NewServerTool(tools.GetDashboardOverviewTool(config, gitopsClient)),
		)

	tsg.AddToolset(gitops)
	return nil
}

