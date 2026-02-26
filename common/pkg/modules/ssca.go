package modules

import (
	"context"
	"fmt"
	"net/http"
	"time"

	config "github.com/harness/mcp-server/common"
	scs "github.com/harness/mcp-server/common/client/scs/generated"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// SSCAModule implements the Module interface for Software Supply Chain Assurance
type SSCAModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewSSCAModule creates a new instance of SSCAModule
func NewSSCAModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *SSCAModule {
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
		"supply_chain",
	}
}

// RegisterToolsets registers all toolsets in the SSCA module
func (m *SSCAModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "supply_chain":
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
func RegisterSCS(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Create base client for SCS
	c, err := DefaultClientProvider.CreateClient(config, "scs", 30*time.Second)
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

	scsClient, err := scs.NewClientWithResponses(c.BaseURL.String(), scs.WithHTTPClient(c),
		scs.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return fmt.Errorf("failed to create generated SCS client: %w", err)
	}

	scsToolset := toolsets.NewToolset("supply_chain", "Harness Supply Chain Security tools").
		AddReadTools(
			toolsets.NewServerTool(tools.ListSCSCodeReposTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetCodeRepositoryOverviewTool(config, scsClient)),
			toolsets.NewServerTool(tools.FetchComplianceResultsByArtifactTool(config, scsClient)),
			toolsets.NewServerTool(tools.ListArtifactSourcesTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactChainOfCustodyV2Tool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactDetailComponentViewTool(config, scsClient)),
			toolsets.NewServerTool(tools.GetArtifactComponentRemediationByPurlTool(config, scsClient)),
			toolsets.NewServerTool(tools.CreateOPAPolicyTool(config, scsClient)),
			toolsets.NewServerTool(tools.DownloadSbomTool(config, scsClient)),
		)
	tsg.AddToolset(scsToolset)
	return nil
}
