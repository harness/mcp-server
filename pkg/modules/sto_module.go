package modules

import (
	"context"
	"fmt"
	"net/http"

	"github.com/harness/harness-mcp/client"
	sto "github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/tools"
	"github.com/harness/harness-mcp/pkg/modules/utils"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// STOModule implements the Module interface for Security Test Orchestration
type STOModule struct {
	config *config.Config
	tsg    *toolsets.ToolsetGroup
}

// NewSTOModule creates a new instance of STOModule
func NewSTOModule(config *config.Config, tsg *toolsets.ToolsetGroup) *STOModule {
	return &STOModule{
		config: config,
		tsg:    tsg,
	}
}

// ID returns the identifier for this module
func (m *STOModule) ID() string {
	return "STO"
}

// Name returns the name of module
func (m *STOModule) Name() string {
	return "Security Test Orchestration"
}

// Toolsets returns the names of toolsets provided by this module
func (m *STOModule) Toolsets() []string {
	return []string{
		"sto",
	}
}

// RegisterToolsets registers all toolsets in the STO module
func (m *STOModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "sto":
			if err := RegisterSTO(m.config, m.tsg); err != nil {
				return err
			}
		}
	}
	return nil
}

// EnableToolsets enables all toolsets in the STO module
func (m *STOModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return ModuleEnableToolsets(m, tsg)
}

// IsDefault indicates if this module should be enabled by default
func (m *STOModule) IsDefault() bool {
	return false
}

// RegisterSTO registers the Security Test Orchestration toolset
func RegisterSTO(config *config.Config, tsg *toolsets.ToolsetGroup) error {
	baseURL := utils.BuildServiceURL(config, config.STOSvcBaseURL, config.BaseURL, "/sto")
	secret := config.STOSvcSecret

	baseURLPrincipal := utils.BuildServiceURL(config, config.NgManagerBaseURL, config.BaseURL, "ng/api")
	principalSecret := config.NgManagerSecret

	c, err := utils.CreateClient(baseURL, config, secret)
	if err != nil {
		return err
	}

	cPrincipal, err := utils.CreateClient(baseURLPrincipal, config, principalSecret)
	if err != nil {
		return err
	}
	principalClient := &client.PrincipalService{Client: cPrincipal}

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
			toolsets.NewServerTool(tools.StoAllIssuesListTool(config, stoClient)),
			toolsets.NewServerTool(tools.StoGlobalExemptionsTool(config, stoClient, principalClient)),
			toolsets.NewServerTool(tools.ExemptionsPromoteExemptionTool(config, stoClient, principalClient)),
			toolsets.NewServerTool(tools.ExemptionsApproveExemptionTool(config, stoClient, principalClient)),
		)
	tsg.AddToolset(sto)
	return nil
}
