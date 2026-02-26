package modules

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	sto "github.com/harness/mcp-server/common/client/sto/generated"
	"github.com/harness/mcp-server/common/pkg/tools"
	"github.com/harness/mcp-server/common/pkg/toolsets"
)

// STOModule implements the Module interface for Security Test Orchestration
type STOModule struct {
	config *config.McpServerConfig
	tsg    *toolsets.ToolsetGroup
}

// NewSTOModule creates a new instance of STOModule
func NewSTOModule(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) *STOModule {
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
		"security_testing",
	}
}

// RegisterToolsets registers all toolsets in the STO module
func (m *STOModule) RegisterToolsets() error {
	for _, t := range m.Toolsets() {
		switch t {
		case "security_testing":
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
func RegisterSTO(config *config.McpServerConfig, tsg *toolsets.ToolsetGroup) error {
	c, err := DefaultClientProvider.CreateClient(config, "sto", 30*time.Second)
	if err != nil {
		return err
	}

	cPrincipal, err := DefaultClientProvider.CreateClient(config, "ngMan", 30*time.Second)
	if err != nil {
		slog.Warn("Failed to create principal client for STO toolset", "error", err)
		return nil
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
	stoClient, err := sto.NewClientWithResponses(c.BaseURL.String(), sto.WithHTTPClient(c),
		sto.WithRequestEditorFn(requestEditorFn))
	if err != nil {
		slog.Warn("Failed to create generated STO client. STO toolset will not be available", "error", err)
		return nil
	}
	sto := toolsets.NewToolset("security_testing", "Harness Security Test Orchestration tools").
		AddReadTools(
			toolsets.NewServerTool(tools.StoAllIssuesListTool(config, stoClient)),
			toolsets.NewServerTool(tools.StoGlobalExemptionsTool(config, stoClient, principalClient)),
			toolsets.NewServerTool(tools.ExemptionsPromoteExemptionTool(config, stoClient, principalClient)),
			toolsets.NewServerTool(tools.ExemptionsApproveExemptionTool(config, stoClient, principalClient)),
		)
	tsg.AddToolset(sto)
	return nil
}
