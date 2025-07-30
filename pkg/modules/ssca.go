package modules

import (
	"context"
	"fmt"
	"net/http"
	"time"

	scs "github.com/harness/harness-mcp/client/scs/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// SSCAModule implements the Module interface for Software Supply Chain Assurance
type SSCAModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewSSCAModule creates a new instance of SSCAModule
func NewSSCAModule(config *config.Config, tsg *toolsets.ToolsetGroup) *SSCAModule {
	return &SSCAModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *SSCAModule) ID() string {
	return "SSCA"
}

// Name returns the name of module
func (m *SSCAModule) Name() string {
	return "Software Supply Chain Assurance"
}

// Toolsets returns the names of toolsets provided by this module
func (m *SSCAModule) Toolsets() []string {
	return []string{
		"scs",
	}
}

// RegisterToolsets registers all toolsets in the SSCA module
func (m *SSCAModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "scs":
			if err := RegisterSCS(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the SSCA module
func (m *SSCAModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *SSCAModule) IsDefault() bool {
	return false
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

	scsToolset := toolsets.NewToolset("scs", "Harness Supply Chain Security tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListSCSCodeReposTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetCodeRepositoryOverviewTool(config, scsClient)),
			toolsets.NewServerTool(tools.FetchComplianceResultsByArtifactTool(config, scsClient)),
			toolsets.NewServerTool(tools.ListArtifactSourcesTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactV2OverviewTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactChainOfCustodyV2Tool(config, scsClient)),
			toolsets.NewServerTool(tools.CreateOPAPolicyTool(config, scsClient)),
			toolsets.NewServerTool(tools.ArtifactListV2Tool(config, scsClient)),
		)
	tsg.AddToolset(scsToolset)
	return nil
}
