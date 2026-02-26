package tools_test

import (
	"context"
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	tools "github.com/harness/mcp-server/pkg"
	"github.com/harness/mcp-server/pkg/test"
	"github.com/mark3labs/mcp-go/mcp"
)

// legacyToolNames contains existing tools that predate naming conventions.
// New tools must follow {module}_{verb}_{noun} pattern.
// Do not add new entries here - fix the tool name instead.
var legacyToolNames = []string{
	"revoke_delegate_token",
	"invite_users",
	"list_experiments",
	"get_experiment",
	"get_experiment_run_result",
	"execute_experiment",
	"list_probes",
	"get_probe",
	"list_experiment_templates",
	"list_experiment_variables",
	"create_experiment_from_template",
	"list_linux_infrastructures",
	"create_sample_loadtest",
	"delete_loadtest_instance",
	"get_loadtest_instance",
	"list_loadtest_instances",
	"execute_loadtest_instance",
	"stop_loadtest_run",
	"sei_productivity_feature_metrics",
	"sei_efficiency_lead_time",
	"sei_deployment_frequency",
	"sei_change_failure_rate",
	"sei_mttr",
	"sei_deployment_frequency_drilldown",
	"sei_change_failure_rate_drilldown",
	"list_global_exemptions",
	"promote_and_approve_exemptions",
	"reject_and_approve_exemptions",
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
	"create_ccm_perspective",
	"create_delegate_token",
	"create_jira_ticket_for_ccm_recommendation",
	"create_opa_policy",
	"create_resource_group",
	"create_role",
	"create_role_assignment",
	"create_service_account",
	"create_snow_ticket_for_ccm_rec",
	"create_user_group",
	"delete_ccm_perspective",
	"delete_delegate_token",
	"delete_resource_group",
	"delete_role",
	"delete_service_account",
	"delete_user_group",
	"download_sbom",
	"execute_workflow",
	"get_repository_compliance_results",
	"get_execution_url",
	"list_security_issues",
	"list_artifact_sources",
	"list_source_artifacts",
	"get_artifact_overview",
	"get_artifact_component_view",
	"get_artifact_component_remediation",
	"move_environment_config",
	"move_infrastructure_config",
	"get_all_users",
	"get_artifact_chain_of_custody",
	"get_audit_yaml",
	"get_autonomous_code_maintenance_task_executions",
	"get_azure_vm_recommendation_detail",
	"get_ccm_anomalies_for_perspective",
	"get_ccm_anomalies_summary",
	"get_ccm_commitment_coverage",
	"get_ccm_commitment_ec2_analysis",
	"get_ccm_commitment_estimated_savings",
	"get_ccm_commitment_savings",
	"get_ccm_commitment_utilisation",
	"get_ccm_cost_category",
	"get_ccm_metadata",
	"get_ccm_overview",
	"get_ccm_perspective",
	"get_ccm_recommendations_stats",
	"get_code_repository_overview",
	"get_connector",
	"get_dashboard",
	"get_delegate_token",
	"get_ec2_recommendation_detail",
	"get_ecs_service_recommendation_detail",
	"get_entity",
	"get_environment",
	"get_execution",
	"get_feature_flag",
	"get_input_set",
	"get_last_period_cost_ccm_perspective",
	"get_last_twelve_months_cost_ccm_perspective",
	"get_node_pool_recommendation_detail",
	"get_pipeline",
	"get_pipeline_summary",
	"get_prompt",
	"get_pull_request",
	"list_pull_request_activities",
	"list_pull_request_checks",
	"get_registry",
	"get_repository",
	"get_role_info",
	"get_score_summary",
	"get_scorecard",
	"get_scorecard_check",
	"get_scorecard_check_stats",
	"get_scorecard_stats",
	"list_scores",
	"get_secret",
	"get_service",
	"get_service_account",
	"get_user_group_info",
	"get_user_info",
	"get_workload_recommendation_detail",
	"list_all_ccm_anomalies",
	"list_artifact_files",
	"list_artifact_versions",
	"list_artifacts",
	"list_artifacts_scs",
	"list_available_permissions",
	"list_available_roles",
	"list_ccm_anomalies",
	"list_ccm_cost_categories",
	"list_ccm_cost_categories_detail",
	"list_ccm_ignored_anomalies",
	"list_ccm_perspectives_detail",
	"list_ccm_recommendations",
	"list_ccm_recommendations_by_resource_type",
	"list_connector_catalog",
	"list_connectors",
	"list_dashboards",
	"list_delegate_tokens",
	"list_entities",
	"list_environments",
	"list_executions",
	"list_filter_values_ccm_anomalies",
	"list_feature_flag_environments",
	"list_feature_flags",
	"list_workspaces",
	"list_infrastructures",
	"list_input_sets",
	"list_jira_issue_types",
	"list_jira_projects",
	"list_pipelines",
	"list_prompts",
	"list_pull_requests",
	"list_registries",
	"list_repositories",
	"list_role_assignments",
	"list_scorecard_checks",
	"list_scorecards",
	"list_code_repositories",
	"list_secrets",
	"list_services",
	"list_settings",
	"list_templates",
	"list_triggers",
	"list_audit_events",
	"search_tech_docs",
	"update_ccm_perspective",
	"update_ccm_recommendation_state",
}

func isLegacyTool(name string) bool {
	for _, legacy := range legacyToolNames {
		if legacy == name {
			return true
		}
	}
	return false
}

// TestToolNameValidation validates that all tool names follow naming conventions.
// Legacy tools are skipped; new tools must comply with {module}_{verb}_{noun} pattern.
func TestToolNameValidation(t *testing.T) {
	tools, err := test.GetAllTools()
	if err != nil {
		t.Fatalf("Failed to get tools: %v", err)
	}
	if len(tools) == 0 {
		t.Fatal("No tools registered")
	}

	var newTools []mcp.Tool
	for _, tool := range tools {
		if !isLegacyTool(tool.Name) {
			newTools = append(newTools, tool)
		}
	}

	t.Logf("Validating %d tools (%d legacy)...", len(newTools), len(tools)-len(newTools))

	for _, err := range test.ValidateTools(newTools) {
		t.Errorf("%v", err)
	}
}

func TestRegisterAllowedToolsets_EnableAll(t *testing.T) {
	cleanup := test.UseNoOpProviders()
	defer cleanup()

	tsg := toolsets.NewToolsetGroup(true)
	cfg := &config.McpServerConfig{}

	err := tools.RegisterAllowedToolsets(context.Background(), tsg, cfg, nil, true)
	if err != nil {
		t.Fatalf("RegisterAllowedToolsets failed: %v", err)
	}

	// Verify that multiple toolsets were registered
	if len(tsg.Toolsets) == 0 {
		t.Fatal("No toolsets registered when enableAll=true")
	}

	// Check that key toolsets are present
	expectedToolsets := []string{"acm", "pipelines", "connectors", "dashboards", "audit"}
	for _, name := range expectedToolsets {
		if _, exists := tsg.Toolsets[name]; !exists {
			t.Errorf("Expected toolset %q not found when enableAll=true", name)
		}
	}

	t.Logf("Registered %d toolsets with enableAll=true", len(tsg.Toolsets))
}

func TestRegisterAllowedToolsets_SelectiveRegistration(t *testing.T) {
	cleanup := test.UseNoOpProviders()
	defer cleanup()

	tsg := toolsets.NewToolsetGroup(true)
	cfg := &config.McpServerConfig{}

	// Register only specific toolsets
	allowedToolsets := []string{"pipelines", "connectors"}
	err := tools.RegisterAllowedToolsets(context.Background(), tsg, cfg, allowedToolsets, false)
	if err != nil {
		t.Fatalf("RegisterAllowedToolsets failed: %v", err)
	}

	// Verify that only the specified toolsets were registered
	if len(tsg.Toolsets) != 2 {
		t.Errorf("Expected 2 toolsets, got %d", len(tsg.Toolsets))
	}

	for _, name := range allowedToolsets {
		if _, exists := tsg.Toolsets[name]; !exists {
			t.Errorf("Expected toolset %q not found", name)
		}
	}

	// Verify that non-requested toolsets were NOT registered
	unexpectedToolsets := []string{"acm", "dashboards", "audit"}
	for _, name := range unexpectedToolsets {
		if _, exists := tsg.Toolsets[name]; exists {
			t.Errorf("Toolset %q should not have been registered", name)
		}
	}
}

func TestRegisterAllowedToolsets_EmptyList(t *testing.T) {
	cleanup := test.UseNoOpProviders()
	defer cleanup()

	tsg := toolsets.NewToolsetGroup(true)
	cfg := &config.McpServerConfig{}

	// Register with empty list and enableAll=false
	err := tools.RegisterAllowedToolsets(context.Background(), tsg, cfg, []string{}, false)
	if err != nil {
		t.Fatalf("RegisterAllowedToolsets failed: %v", err)
	}

	// Verify that no toolsets were registered
	if len(tsg.Toolsets) != 0 {
		t.Errorf("Expected 0 toolsets with empty list, got %d", len(tsg.Toolsets))
	}
}

func TestRegisterAllowedToolsets_SingleToolset(t *testing.T) {
	cleanup := test.UseNoOpProviders()
	defer cleanup()

	testCases := []string{"pipelines", "connectors", "dashboards", "audit", "acm", "gitops"}

	for _, toolsetName := range testCases {
		t.Run(toolsetName, func(t *testing.T) {
			tsg := toolsets.NewToolsetGroup(true)
			cfg := &config.McpServerConfig{}

			err := tools.RegisterAllowedToolsets(context.Background(), tsg, cfg, []string{toolsetName}, false)
			if err != nil {
				t.Fatalf("RegisterAllowedToolsets failed for %q: %v", toolsetName, err)
			}

			if len(tsg.Toolsets) != 1 {
				t.Errorf("Expected 1 toolset for %q, got %d", toolsetName, len(tsg.Toolsets))
			}

			if _, exists := tsg.Toolsets[toolsetName]; !exists {
				t.Errorf("Toolset %q not found after registration", toolsetName)
			}
		})
	}
}
