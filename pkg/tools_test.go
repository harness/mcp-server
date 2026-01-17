package tools_test

import (
	"context"
	"net/url"
	"testing"
	"time"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/pkg/auth"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	mcplint "github.com/harness/mcp-server/mcp-lint"
	"github.com/harness/mcp-server/pkg/modules"
	"github.com/mark3labs/mcp-go/mcp"
)

// legacyToolNames contains existing tools that predate naming conventions.
// New tools must follow conventions; these are allowed for backwards compatibility.
// Do not add new entries here - fix the tool name instead.
var legacyToolNames = []string{
	"revoke_delegate_token",
	"invite_users",
	"chaos_experiments_list",
	"chaos_experiment_describe",
	"chaos_experiment_run_result",
	"chaos_experiment_run",
	"chaos_probes_list",
	"chaos_probe_describe",
	"chaos_experiment_template_list",
	"chaos_experiment_variables_list",
	"sei_productivity_feature_metrics",
	"sei_efficiency_lead_time",
	"sei_deployment_frequency",
	"sei_change_failure_rate",
	"sei_mttr",
	"sei_deployment_frequency_drilldown",
	"sei_change_failure_rate_drilldown",
	"sto_global_exemptions",
	"sto_exemptions_promote_and_approve",
	"exemptions_reject_and_approve",
	"validate_ccm_perspective_rules",
	"ccm_perspective_grid",
	"ccm_perspective_time_series",
	"ccm_perspective_summary_with_budget",
	"ccm_perspective_budget",
	"ccm_perspective_recommendations",
	"ccm_perspective_filter_values",
	"ccm_perspective_filter_values_event",
	"override_ccm_recommendation_savings",
	"report_ccm_anomaly_feedback",
}

func isLegacyTool(name string) bool {
	for _, legacy := range legacyToolNames {
		if legacy == name {
			return true
		}
	}
	return false
}

/*
Test setup for tool name validation:
1. Define NoOp providers that return dummy clients (no real API calls)
2. Swap global providers with NoOps before module registration
3. Register all modules to collect tool definitions
4. Restore original providers via cleanup function

This avoids needing real credentials to validate tool names.
*/

// noopAuthProvider implements auth.Provider for testing.
type noopAuthProvider struct{}

func (p *noopAuthProvider) GetHeader(_ context.Context) (string, string, error) {
	return "x-api-key", "test-key", nil
}

// noopClientProvider implements commonModules.ClientProvider for testing.
type noopClientProvider struct{}

func (p *noopClientProvider) CreateClient(_ *config.McpServerConfig, _ string, _ ...time.Duration) (*client.Client, error) {
	return &client.Client{
		BaseURL:      &url.URL{Scheme: "http", Host: "localhost"},
		AuthProvider: &noopAuthProvider{},
	}, nil
}

func (p *noopClientProvider) CreateClientWithIdentity(_ *config.McpServerConfig, _ string, _ string, timeout ...time.Duration) (*client.Client, error) {
	return p.CreateClient(nil, "", timeout...)
}

// useNoOpProviders swaps in NoOp providers and returns a cleanup function.
func useNoOpProviders() func() {
	origClient := commonModules.DefaultClientProvider
	origCode := commonModules.DefaultCodeClientFactory
	origNgManager := commonModules.DefaultNgManagerAuthProviderFactory

	commonModules.DefaultClientProvider = &noopClientProvider{}
	commonModules.DefaultCodeClientFactory = func(_ *config.McpServerConfig) (*client.Client, error) {
		return (&noopClientProvider{}).CreateClient(nil, "")
	}
	commonModules.DefaultNgManagerAuthProviderFactory = func(_ *config.McpServerConfig) auth.Provider {
		return &noopAuthProvider{}
	}

	return func() {
		commonModules.DefaultClientProvider = origClient
		commonModules.DefaultCodeClientFactory = origCode
		commonModules.DefaultNgManagerAuthProviderFactory = origNgManager
	}
}

// getAllTools registers all modules using NoOp providers and returns all tool definitions.
func getAllTools(t *testing.T) []mcp.Tool {
	t.Helper()

	cleanup := useNoOpProviders()
	defer cleanup()

	tsg := toolsets.NewToolsetGroup(true)
	registry := modules.NewModuleRegistry(&config.McpServerConfig{}, tsg)

	for _, m := range registry.GetAllModules() {
		if err := m.RegisterToolsets(); err != nil {
			t.Fatalf("Failed to register module %s: %v", m.ID(), err)
		}
	}

	return tsg.GetAllTools()
}

// TestToolNameValidation validates that all tool names follow naming conventions.
// Legacy tools are skipped; new tools must comply.
func TestToolNameValidation(t *testing.T) {
	tools := getAllTools(t)
	if len(tools) == 0 {
		t.Fatal("No tools registered")
	}

	// Filter out legacy tools
	var newTools []mcp.Tool
	for _, tool := range tools {
		if !isLegacyTool(tool.Name) {
			newTools = append(newTools, tool)
		}
	}

	t.Logf("Validating %d tools (%d legacy)...", len(newTools), len(tools)-len(newTools))

	errors := mcplint.ValidateTools(newTools)
	for _, err := range errors {
		t.Errorf("%v", err)
	}
}
