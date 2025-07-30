package modules

import (
	"context"
	"net/http"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/ar"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// HARModule implements the Module interface for Harness Artifact Registry
type HARModule struct {
	DefaultModulePrompts // Embed DefaultModulePrompts to satisfy the Module interface
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewHARModule creates a new instance of HARModule
func NewHARModule(config *config.Config, tsg *toolsets.ToolsetGroup) *HARModule {
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
		"registries",
	}
}

// RegisterToolsets registers all toolsets in the HAR module
func (m *HARModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "registries":
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
