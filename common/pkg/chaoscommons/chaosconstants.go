package chaoscommons

// Tool names
const (
	ToolExperimentsList                    = "chaos_experiments_list"
	ToolExperimentDescribe                 = "chaos_experiment_describe"
	ToolExperimentRunResult                = "chaos_experiment_run_result"
	ToolExperimentRun                      = "chaos_experiment_run"
	ToolProbesList                         = "chaos_probes_list"
	ToolProbeDescribe                      = "chaos_probe_describe"
	ToolCreateExperimentFromTemplate       = "chaos_create_experiment_from_template"
	ToolListExperimentTemplates            = "chaos_list_experiment_templates"
	ToolGetExperimentTemplate              = "chaos_get_experiment_template"
	ToolDeleteExperimentTemplate           = "chaos_delete_experiment_template"
	ToolListExperimentTemplateRevisions    = "chaos_list_experiment_template_revisions"
	ToolGetExperimentTemplateVariables     = "chaos_get_experiment_template_variables"
	ToolGetExperimentTemplateYaml          = "chaos_get_experiment_template_yaml"
	ToolCompareExperimentTemplateRevisions = "chaos_compare_experiment_template_revisions"
	ToolExperimentVariablesList            = "chaos_experiment_variables_list"
	ToolListLinuxInfrastructures           = "chaos_list_linux_infrastructures"
	ToolListFaultTemplates                 = "chaos_list_fault_templates"
	ToolGetFaultTemplate                   = "chaos_get_fault_template"
	ToolDeleteFaultTemplate                = "chaos_delete_fault_template"
	ToolListFaultTemplateRevisions         = "chaos_list_fault_template_revisions"
	ToolGetFaultTemplateVariables          = "chaos_get_fault_template_variables"
	ToolGetFaultTemplateYaml               = "chaos_get_fault_template_yaml"
	ToolCompareFaultTemplateRevisions      = "chaos_compare_fault_template_revisions"
	ToolListProbeTemplates                 = "chaos_list_probe_templates"
	ToolGetProbeTemplate                   = "chaos_get_probe_template"
	ToolDeleteProbeTemplate                = "chaos_delete_probe_template"
	ToolGetProbeTemplateVariables          = "chaos_get_probe_template_variables"
	ToolListActionTemplates                = "chaos_list_action_templates"
	ToolGetActionTemplate                  = "chaos_get_action_template"
	ToolDeleteActionTemplate               = "chaos_delete_action_template"
	ToolListActionTemplateRevisions        = "chaos_list_action_template_revisions"
	ToolGetActionTemplateVariables         = "chaos_get_action_template_variables"
	ToolCompareActionTemplateRevisions     = "chaos_compare_action_template_revisions"
	ToolListHubs                           = "chaos_list_hubs"
	ToolGetHub                             = "chaos_get_hub"
	ToolListHubFaults                      = "chaos_list_hub_faults"
	ToolDeleteHub                          = "chaos_delete_hub"
	ToolCreateHub                          = "chaos_create_hub"
	ToolUpdateHub                          = "chaos_update_hub"
	ToolListChaosGuardConditions           = "chaos_list_chaosguard_conditions"
	ToolGetChaosGuardCondition             = "chaos_get_chaosguard_condition"
	ToolDeleteChaosGuardCondition          = "chaos_delete_chaosguard_condition"
	ToolListChaosGuardRules                = "chaos_list_chaosguard_rules"
	ToolGetChaosGuardRule                  = "chaos_get_chaosguard_rule"
	ToolDeleteChaosGuardRule               = "chaos_delete_chaosguard_rule"
	ToolEnableChaosGuardRule               = "chaos_enable_chaosguard_rule"
)

// Parameter names used across chaos tool definitions.
const (
	ParamExperimentID          = "experimentID"
	ParamExperimentRunID       = "experimentRunID"
	ParamInputsetIdentity      = "inputsetIdentity"
	ParamExperimentVariables   = "experimentVariables"
	ParamTasks                 = "tasks"
	ParamProbeID               = "probeId"
	ParamTemplateID            = "templateId"
	ParamInfraID               = "infraId"
	ParamEnvironmentID         = "environmentId"
	ParamHubIdentity           = "hubIdentity"
	ParamName                  = "name"
	ParamIdentity              = "identity"
	ParamInfrastructureType    = "infrastructureType"
	ParamInfrastructure        = "infrastructure"
	ParamSearch                = "search"
	ParamSortField             = "sortField"
	ParamSortAscending         = "sortAscending"
	ParamIncludeAllScope       = "includeAllScope"
	ParamTags                  = "tags"
	ParamRevision              = "revision"
	ParamRevision1             = "revision1"
	ParamRevision2             = "revision2"
	ParamRevisionToCompare     = "revisionToCompare"
	ParamStatus                = "status"
	ParamType                  = "type"
	ParamIsEnterprise          = "isEnterprise"
	ParamCategory              = "category"
	ParamPermissionsRequired   = "permissionsRequired"
	ParamInfraType             = "infraType"
	ParamEntityType            = "entityType"
	ParamVerbose               = "verbose"
	ParamDescription           = "description"
	ParamConnectorRef          = "connectorRef"
	ParamRepoName              = "repoName"
	ParamRepoBranch            = "repoBranch"
	ParamEnabled               = "enabled"
	ParamOnlyTemplatisedFaults = "onlyTemplatisedFaults"
)

// Parameter descriptions for chaos tool parameters.
var (
	DescExperimentID    = `Unique Identifier for an experiment.`
	DescExperimentRunID = `Unique Identifier for an experiment run.`

	DescInputsetIdentity    = `Optional inputset identity to use for the experiment run.`
	DescExperimentVariables = `Optional experiment variables as an array of objects where each object has a name and value.`
	DescTasks               = `Optional task-level variables as a map where key is task name and value is an object of variable name-value pairs.`

	DescProbeID       = `Unique Identifier for a probe.`
	DescTemplateID    = `Unique Identifier for a experiment template.`
	DescInfraID       = `Unique Identifier for a infrastructure.`
	DescEnvironmentID = `Unique Identifier for a environment.`

	DescHubIdentity             = `Unique Identifier for a chaos hub. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityExact        = `The unique identity of the ChaosHub. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityOwner        = `Unique identifier for the chaos hub that owns the template. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityDelete       = `The unique identity of the ChaosHub to delete. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityUpdate       = `The unique identity of the ChaosHub to update. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityFault        = `Unique identifier for the chaos hub that owns the fault template. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityProbe        = `Unique identifier for the chaos hub the probe template belongs to. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityAction       = `Unique identifier for the chaos hub the action template belongs to. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityList         = `Unique identifier for the chaos hub to list fault templates from. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityListProbe    = `Unique identifier for the chaos hub to list probe templates from. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityListAction   = `Unique identifier for the chaos hub to list action templates from. Use chaos_list_hubs to find hub identities.`
	DescHubIdentityFaultsFilter = `Filter faults by a specific ChaosHub identity. Use chaos_list_hubs to find hub identities.`

	DescName     = `User defined name of the experiment.`
	DescIdentity = `User defined identity of the experiment.`

	DescIdentityExperimentTemplate       = `Unique identifier for the experiment template. Use chaos_list_experiment_templates to find template identities.`
	DescIdentityExperimentTemplateDelete = `Unique identifier for the experiment template to delete. Use chaos_list_experiment_templates to find template identities.`
	DescIdentityFaultTemplate            = `Unique identifier for the fault template. Use chaos_list_fault_templates to find template identities.`
	DescIdentityFaultTemplateDelete      = `Unique identifier for the fault template to delete. Use chaos_list_fault_templates to find template identities.`
	DescIdentityProbeTemplate            = `Unique identifier for the probe template. Use chaos_list_probe_templates to find template identities.`
	DescIdentityProbeTemplateDelete      = `Unique identifier for the probe template to delete. Use chaos_list_probe_templates to find template identities.`
	DescIdentityActionTemplate           = `Unique identifier for the action template. Use chaos_list_action_templates to find template identities.`
	DescIdentityActionTemplateDelete     = `Unique identifier for the action template to delete. Use chaos_list_action_templates to find template identities.`
	DescIdentityChaosHub                 = `Unique identifier (slug) for the ChaosHub.
Must be unique within the project scope. Cannot be 'enterprise-chaoshub'.`
	DescIdentityChaosGuardCondition       = `The unique identifier of the ChaosGuard condition. Use chaos_list_chaosguard_conditions to find condition identities.`
	DescIdentityChaosGuardConditionDelete = `The unique identifier of the ChaosGuard condition to delete. Use chaos_list_chaosguard_conditions to find condition identities.`
	DescIdentityChaosGuardRule            = `The unique identifier of the ChaosGuard rule. Use chaos_list_chaosguard_rules to find rule identities.`
	DescIdentityChaosGuardRuleDelete      = `The unique identifier of the ChaosGuard rule to delete. Use chaos_list_chaosguard_rules to find rule identities.`

	DescInfrastructureType       = `Infrastructure type filter (e.g. Kubernetes).`
	DescInfrastructure           = `Infrastructure filter (e.g. KubernetesV2).`
	DescInfrastructureTypeFilter = `Filter by infrastructure type.`
	DescInfraType                = `Infrastructure type filter (e.g. Kubernetes).`
	DescInfraTypeFilter          = `Filter by infrastructure type (e.g. Kubernetes, Linux, Windows).`

	DescSearch                = `Search templates by name or identity.`
	DescSearchConditions      = `Search conditions by name (case-insensitive).`
	DescSearchRules           = `Search rules by name (case-insensitive).`
	DescSearchHubs            = `Search hubs by name (case-insensitive).`
	DescSearchFaults          = `Search faults by name (case-insensitive).`
	DescSearchProbe           = `Search probe templates by name or identity.`
	DescSearchAction          = `Search action templates by name or identity.`
	DescSearchActionRevisions = `Search revisions by name.`
	DescSearchFaultTemplates  = `Search fault templates by name or identity.`

	DescSortField     = `Field to sort results by.`
	DescSortAscending = `When true, sort in ascending order. Defaults to false (descending).`

	DescIncludeAllScope = `When true, returns templates from all orgs and projects in the account.
When false (default), returns only templates in the current org and project.`
	DescIncludeAllScopeFault = `When true, returns fault templates from all orgs and projects in the account.
When false (default), returns only fault templates in the current org and project.`
	DescIncludeAllScopeProbe = `When true, returns probe templates from all orgs and projects in the account.
When false (default), returns only probe templates in the current org and project.`
	DescIncludeAllScopeAction = `When true, returns action templates from all orgs and projects in the account.
When false (default), returns only action templates in the current org and project.`
	DescIncludeAllScopeRevisions = `When true, returns revisions from all orgs and projects in the account.
When false (default), returns only revisions in the current org and project.`
	DescIncludeAllScopeHubs   = `When true, returns hubs from all scopes (account, org, project). Defaults to false (project scope only).`
	DescIncludeAllScopeFaults = `When true, returns faults from all scopes. Defaults to false.`

	DescTags        = `Comma-separated list of tags to filter by. Templates must have ALL specified tags (AND filter).`
	DescTagsFilter  = `Comma-separated list of tags to filter by.`
	DescTagsHub     = `Comma-separated list of tags for the ChaosHub.`
	DescTagsFault   = `Comma-separated list of tags to filter by. Fault templates must have ALL specified tags (AND filter).`
	DescTagsReplace = `Comma-separated list of tags for the ChaosHub.
Replaces all existing tags; if omitted or empty, all tags will be removed.
To preserve tags, pass the current values from chaos_get_hub.`

	DescRevision              = `Specific revision of the template to retrieve. If omitted, the latest revision is returned.`
	DescRevisionOptional      = `Specific revision of the template. If omitted, the latest revision is used.`
	DescRevisionFault         = `Specific revision of the fault template to retrieve. If omitted, the latest revision is returned.`
	DescRevisionFaultOptional = `Specific revision of the fault template. If omitted, the latest revision is used.`
	DescRevisionProbe         = `Specific revision number to retrieve. Defaults to the latest revision (0) if not provided.`
	DescRevisionProbeDelete   = `Specific revision number to delete. When 0 or not provided, all revisions are deleted.`
	DescRevisionProbeVars     = `Revision number to get variables for. Defaults to latest revision (0) if not provided.`
	DescRevisionAction        = `Specific revision number to retrieve. Defaults to the latest revision (0) if not provided.`
	DescRevisionActionDelete  = `Specific revision number to delete. When 0 or not provided, all revisions are deleted.`
	DescRevisionActionVars    = `Revision number to get variables for. Defaults to latest revision (0) if not provided.`
	DescRevisionActionCompare = `First revision number to compare.`
	DescRevisionToCompare     = `Second revision number to compare.`
	DescRevision1             = `First revision identifier for comparison.`
	DescRevision2             = `Second revision identifier for comparison.`

	DescStatus = `Filter by infra status. Defaults to 'Active'. Use 'All' to list all infras regardless of status.`

	DescFaultType               = `Fault type filter.`
	DescIsEnterprise            = `When true, filter for enterprise faults only.`
	DescCategory                = `Comma-separated list of categories to filter by (e.g. Kubernetes,AWS,Linux).`
	DescPermissionsRequired     = `Filter by permissions required field.`
	DescPermissionsRequiredEnum = `Filter by permission level required.`

	DescEntityTypeProbe  = `Probe type filter (e.g. httpProbe, cmdProbe).`
	DescEntityTypeAction = `Action type filter.`
	DescEntityTypeFault  = `Filter by fault category (e.g. Kubernetes, AWS, GCP, Azure, Linux, Windows, VMWare, Load).`

	DescVerbose = `When true, enables verbose server-side logging for debugging.`

	DescHubDescription       = `Description of the ChaosHub.`
	DescHubDescriptionUpdate = `Updated description for the ChaosHub.
If omitted or empty, the existing description will be cleared.
To preserve it, pass the current value from chaos_get_hub.`
	DescHubName       = `Display name for the ChaosHub.`
	DescHubNameUpdate = `Updated display name for the ChaosHub.`

	DescConnectorRef = `Harness connector reference for Git authentication (e.g. 'account.myConnector' or 'org.myConnector').`
	DescRepoName     = `Name of the Git repository.`
	DescRepoBranch   = `Git branch to use for the ChaosHub.`

	DescEnabled               = `Set to true to enable the rule, false to disable it.`
	DescOnlyTemplatisedFaults = `When true, only returns faults that have templates available. Defaults to false.`
)

// Tool descriptions for chaos tools.
var (
	DescToolExperimentsList = `List the chaos experiments.`

	DescToolExperimentDescribe = `Retrieves information about a chaos experiment,
allowing users to get an overview and detailed insights for each experiment.`

	DescToolExperimentRunResult = `Retrieves run result of chaos experiment runs,
helping to describe and summarize the details of each experiment run.`

	DescToolExperimentRun = `Run the chaos experiment.`

	DescToolProbesList = `List the chaos probes.`

	DescToolProbeDescribe = `Retrieves information about a chaos probe,
allowing users to get an overview and detailed insights for each probe.`

	DescToolCreateExperimentFromTemplate = `Create a chaos experiment from a template.`

	DescToolListExperimentTemplates = `List chaos experiment templates from chaos hubs.`

	DescToolGetExperimentTemplate = `Retrieves detailed information about a specific chaos experiment template by its identity,
including its spec, variables, revision, and metadata.`

	DescToolDeleteExperimentTemplate = `Deletes a chaos experiment template by its identity (soft delete).
The template must not be referenced by any existing experiment, otherwise the delete will be rejected.`

	DescToolListExperimentTemplateRevisions = `Lists all revisions of a specific chaos experiment template by its identity.
Supports pagination, search, sort, and filtering.`

	DescToolGetExperimentTemplateVariables = `Retrieves the input variables (faults, probes, actions) of a specific chaos experiment template.
Useful for understanding what inputs are needed before launching an experiment from a template.`

	DescToolGetExperimentTemplateYaml = `Retrieves the YAML representation of a specific chaos experiment template.
Returns the raw template YAML string for a given revision.`

	DescToolCompareExperimentTemplateRevisions = `Compares two revisions of a chaos experiment template,
returning the YAML of both revisions for diff comparison. Both revision1 and revision2 are required.`

	DescToolExperimentVariablesList = `List the chaos experiment variables.`

	DescToolListLinuxInfrastructures = `List available Linux infrastructure for chaos engineering and load testing.
Returns chaos Linux infrastructures (load infrastructures) with their IDs, names, and status.
Infra IDs are needed when creating sample load tests via chaos_create_sample_loadtest.
By default only active infrastructures are returned; set status to 'All' to list all.`

	DescToolListFaultTemplates = `List chaos fault templates from chaos hubs.
Supports filtering by hub, type, infrastructure, category, tags, and pagination.`

	DescToolGetFaultTemplate = `Retrieves detailed information about a specific chaos fault template by its identity,
including its spec, variables, revision, and metadata.`

	DescToolDeleteFaultTemplate = `Deletes a chaos fault template by its identity (soft delete).`

	DescToolListFaultTemplateRevisions = `Lists all revisions of a specific chaos fault template by its identity.
Supports pagination.`

	DescToolGetFaultTemplateVariables = `Retrieves the runtime input variables of a specific chaos fault template,
grouped into variables, faultTargets, faultTunable, and faultAuthentication.`

	DescToolGetFaultTemplateYaml = `Retrieves the YAML representation of a specific chaos fault template.
Returns the raw template YAML string for a given revision.`

	DescToolCompareFaultTemplateRevisions = `Compares two revisions of a chaos fault template,
returning the YAML of both revisions for diff comparison. Both revision1 and revision2 are required.`

	DescToolListProbeTemplates = `List chaos probe templates.
Supports filtering by hub, infrastructure type, probe entity type, search, and pagination.`

	DescToolGetProbeTemplate = `Retrieves detailed information about a specific chaos probe template by its identity,
including its type, properties, run properties, and metadata.`

	DescToolDeleteProbeTemplate = `Deletes a chaos probe template by its identity. Requires hubIdentity.
When revision is 0 or not provided, all revisions are deleted.
The template must not be referenced by any experiments for deletion to succeed.`

	DescToolGetProbeTemplateVariables = `Retrieves the runtime input variables for a chaos probe template,
including probe properties and run properties.`

	DescToolListActionTemplates = `List chaos action templates.
Supports filtering by hub, infrastructure type, action entity type, search, and pagination.`

	DescToolGetActionTemplate = `Retrieves detailed information about a specific chaos action template by its identity,
including its spec, variables, revision, and metadata.`

	DescToolDeleteActionTemplate = `Deletes a chaos action template by its identity. Requires hubIdentity.
When revision is 0 or not provided, all revisions are deleted.
The template must not be referenced by any experiments for deletion to succeed.`

	DescToolListActionTemplateRevisions = `Lists all revisions of a chaos action template by its identity,
with pagination and optional filtering support.`

	DescToolGetActionTemplateVariables = `Retrieves the runtime input variables for a chaos action template,
including action properties and run properties.`

	DescToolCompareActionTemplateRevisions = `Compares two revisions of a chaos action template side by side.
Requires the template identity, hub identity, and two revision numbers.`

	DescToolListHubs = `List ChaosHubs (Git-connected repositories containing fault, experiment, probe, and action templates).
Returns hub details including repository info, connector configuration, template counts, and sync status.
Supports search, pagination, and cross-scope inclusion.`

	DescToolGetHub = `Get a ChaosHub by its identity.
Returns full hub details including repository URL, branch, connector info, template counts, sync status, and metadata.`

	DescToolListHubFaults = `List faults available in ChaosHubs.
Returns fault details including name, category, infrastructure type, permissions required, and platform support.
Also returns fault category counts for each infrastructure type.
Supports filtering by hub, infrastructure type, category, permissions, and search.`

	DescToolDeleteHub = `Delete a ChaosHub by its identity.
Removes the hub and its associated resources. The default Enterprise ChaosHub cannot be deleted.`

	DescToolCreateHub = `Create a new ChaosHub in the given Harness scope (account, org, project).
The hub record stores a Git repo and connector reference that provides chaos fault, experiment, probe, and action templates.
The hub identity cannot be 'enterprise-chaoshub' as that is reserved for the default hub.`

	DescToolUpdateHub = `Update the editable fields of a ChaosHub (name, description, tags) by its identity.
IMPORTANT: The API uses a replace-all model — all fields are fully replaced, not merged.
Omitted or empty values will overwrite and clear existing data.
To preserve existing description or tags when changing only some fields,
fetch the current hub via chaos_get_hub first and pass through the values you want to keep.`

	DescToolListChaosGuardConditions = `List ChaosGuard conditions.
Conditions define the infrastructure, fault, and application constraints that ChaosGuard rules evaluate against chaos experiments.
Supports filtering by infrastructure type, tags, search, sorting, and pagination.`

	DescToolGetChaosGuardCondition = `Get a ChaosGuard condition by its identifier.
Returns the full condition details including infrastructure type, fault specifications, K8s/machine specs, associated rules, and tags.`

	DescToolDeleteChaosGuardCondition = `Delete (soft-delete) a ChaosGuard condition by its identifier.
The condition is marked as removed and will no longer appear in listings or be evaluated by rules,
but is not permanently erased from the database.`

	DescToolListChaosGuardRules = `List ChaosGuard governance rules.
ChaosGuard rules define security policies that control when and how chaos experiments can run,
including user group restrictions, time windows, and conditions.
Supports filtering by infrastructure type, tags, search, sorting, and pagination.`

	DescToolGetChaosGuardRule = `Get a ChaosGuard rule by its identifier.
Returns the full rule details including name, description, conditions, time windows, user group restrictions, and enabled status.`

	DescToolDeleteChaosGuardRule = `Delete (soft-delete) a ChaosGuard rule by its identifier.
The rule is marked as removed and will no longer appear in listings or be enforced,
but is not permanently erased from the database.`

	DescToolEnableChaosGuardRule = `Enable or disable a ChaosGuard rule.
When enabled, the rule actively enforces its governance conditions on chaos experiments.
When disabled, the rule is inactive and does not affect experiment execution.`
)
