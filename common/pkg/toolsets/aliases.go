package toolsets

// ToolAliases maps old tool names to their new names for backward compatibility.
// When a tool call arrives with an old name, it should be resolved to the new name.
var ToolAliases = map[string]string{
	// Chaos tools
	"chaos_experiments_list":                "list_experiments",
	"chaos_experiment_describe":             "get_experiment",
	"chaos_experiment_run":                  "execute_experiment",
	"chaos_experiment_run_result":           "get_experiment_run_result",
	"chaos_probes_list":                     "list_probes",
	"chaos_probe_describe":                  "get_probe",
	"chaos_create_experiment_from_template": "create_experiment_from_template",
	"chaos_experiment_template_list":        "list_experiment_templates",
	"chaos_experiment_variables_list":       "list_experiment_variables",
	"chaos_list_linux_infrastructures":      "list_linux_infrastructures",

	// Chaos loadtest tools
	"chaos_create_sample_loadtest":   "create_sample_loadtest",
	"chaos_delete_loadtest_instance": "delete_loadtest_instance",
	"chaos_get_loadtest_instance":    "get_loadtest_instance",
	"chaos_list_loadtest_instances":  "list_loadtest_instances",
	"chaos_run_loadtest_instance":    "execute_loadtest_instance",
	"chaos_stop_loadtest_run":        "stop_loadtest_run",

	// SCS → supply_chain tools
	"scs_list_artifact_sources":                   "list_artifact_sources",
	"scs_list_artifacts_per_source":               "list_source_artifacts",
	"scs_get_artifact_overview":                   "get_artifact_overview",
	"scs_get_artifact_chain_of_custody":           "get_artifact_chain_of_custody",
	"scs_fetch_compliance_results_for_repo_by_id": "get_repository_compliance_results",
	"scs_get_code_repository_overview":            "get_code_repository_overview",
	"scs_list_code_repos":                         "list_code_repositories",
	"scs_create_opa_policy":                       "create_opa_policy",
	"scs_download_sbom":                           "download_sbom",
	"scs_get_artifact_component_remediation":      "get_artifact_component_remediation",
	"scs_get_artifact_component_view":             "get_artifact_component_view",

	// STO → security_testing tools
	"get_all_security_issues":            "list_security_issues",
	"sto_global_exemptions":              "list_global_exemptions",
	"sto_exemptions_promote_and_approve": "promote_and_approve_exemptions",
	"exemptions_reject_and_approve":      "reject_and_approve_exemptions",

	// FME → feature_flags tools
	"list_fme_workspaces":             "list_workspaces",
	"list_fme_environments":           "list_feature_flag_environments",
	"list_fme_feature_flags":          "list_feature_flags",
	"get_fme_feature_flag_definition": "get_feature_flag",

	// IDP → developer_portal tools
	"get_scores": "list_scores",

	// Connector tools
	"get_connector_details":    "get_connector",
	"list_connector_catalogue": "list_connector_catalog",

	// Dashboard tools
	"get_dashboard_data": "get_dashboard",

	// Pipeline tools
	"fetch_execution_url": "get_execution_url",

	// Pull request tools
	"get_pull_request_checks":     "list_pull_request_checks",
	"get_pull_request_activities": "list_pull_request_activities",

	// Environment tools
	"move_environment_configs": "move_environment_config",

	// Infrastructure tools
	"move_infrastructure_configs": "move_infrastructure_config",

	// Audit tools
	"list_user_audits": "list_audit_events",

	// Database tools (internal)
	"get_database_schema_info": "get_schema",

	// Release management tools (internal)
	"releasemgmt_search_releases":         "search_releases",
	"releasemgmt_get_release_status":      "get_release_status",
	"releasemgmt_get_tasks_for_release":   "get_release_tasks",
	"releasemgmt_get_release_outputs":     "get_release_outputs",
	"releasemgmt_list_release_activities": "list_release_activities",
}

// ToolsetAliases maps old toolset names to their new names for backward compatibility.
// When a toolset is requested with an old name, it should be resolved to the new name.
var ToolsetAliases = map[string]string{
	"default":           "core",
	"pullrequests":      "pull_requests",
	"infrastructure":    "infrastructures",
	"registries":        "artifact_registry",
	"scs":               "supply_chain",
	"sto":               "security_testing",
	"fme":               "feature_flags",
	"idp":               "developer_portal",
	"dbops":             "database",
	"releasemanagement": "release_management",
}

// ResolveToolAlias resolves an old tool name to its new name.
// If the name is not an alias, returns the original name unchanged.
func ResolveToolAlias(name string) string {
	if newName, ok := ToolAliases[name]; ok {
		return newName
	}
	return name
}

// ResolveToolsetAlias resolves an old toolset name to its new name.
// If the name is not an alias, returns the original name unchanged.
func ResolveToolsetAlias(name string) string {
	if newName, ok := ToolsetAliases[name]; ok {
		return newName
	}
	return name
}

// ResolveToolsetAliases resolves a list of toolset names, replacing any old names with new ones.
func ResolveToolsetAliases(names []string) []string {
	resolved := make([]string, len(names))
	for i, name := range names {
		resolved[i] = ResolveToolsetAlias(name)
	}
	return resolved
}
