package modules

import (
	"context"
	"net/http"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/ar"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// HARModule implements the Module interface for Harness Artifact Registry
type HARModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewHARModule creates a new instance of HARModule
func NewHARModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *HARModule {
	return &HARModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *HARModule) ID() string {
	return "HAR"
}

// Name returns the name of module
func (m *HARModule) Name() string {
	return "Harness Artifact Registry"
}

// Toolsets returns the names of toolsets provided by this module
func (m *HARModule) Toolsets() []string {
	return []string{
		"artifact_registry",
	}
}

// RegisterToolsets registers all toolsets in the HAR module
func (m *HARModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "artifact_registry":
			if err := RegisterRegistries(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the HAR module
func (m *HARModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *HARModule) IsDefault() bool {
	return false
}

// RegisterRegistries registers the HAR registries toolset
func RegisterRegistries(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	// Determine the base URL and secret for registries
	// The AR client expects the full base URL including API version path
	c, err := DefaultClientProvider.CreateClient(config, "ar")
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

	arClient, err := ar.NewClientWithResponses(c.BaseURL.String(), ar.WithHTTPClient(c),
		ar.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		return err
	}

	// Create the registries toolset
	registries := toolsets.NewToolset("artifact_registry", "Harness Artifact Registry related tools").
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
