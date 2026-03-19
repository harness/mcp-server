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
	ToolListChaosEnvironments              = "chaos_list_environments"
	ToolListKubernetesInfrastructures      = "chaos_list_k8s_infrastructures"
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
	ParamImportType            = "importType"
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
	ParamSearchTerm            = "searchTerm"
	ParamIncludeLegacyInfra    = "includeLegacyInfra"
	ParamEnvironmentType       = "environmentType"
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
	DescInfraID       = `Unique Identifier for a infrastructure. Use chaos_list_k8s_infrastructures to find available infrastructure IDs for the selected environment.`
	DescEnvironmentID = `Unique Identifier for a environment. Use chaos_list_environments to find available environment IDs.`

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

	DescName           = `User defined name of the experiment.`
	DescIdentity       = `User defined identity of the experiment.`
	DescExperimentDesc = `Optional description for the experiment.`
	DescExperimentTags = `Optional tags for the experiment as an array of strings.`
	DescImportType     = `How to link the experiment to its template source: 'LOCAL' copies the template into the project (default), 'REFERENCE' keeps a live reference to the hub template.`

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
	DescRevisionActionCompare = `First revision number to compare. Use chaos_list_action_template_revisions to find available revisions.`
	DescRevisionToCompare     = `Second revision number to compare. Use chaos_list_action_template_revisions to find available revisions.`
	DescRevision1             = `First revision identifier for comparison. Use the corresponding list revisions tool to find available revisions.`
	DescRevision2             = `Second revision identifier for comparison. Use the corresponding list revisions tool to find available revisions.`

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

	DescConnectorRef = `Harness connector reference for Git authentication (e.g. 'account.myConnector' or 'org.myConnector'). Optional at creation, but required before template operations.`
	DescRepoName     = `Name of the Git repository. Optional at creation, but required before template operations.`
	DescRepoBranch   = `Git branch to use for the ChaosHub. Optional at creation, but required before template operations.`

	DescEnabled               = `Set to true to enable the rule, false to disable it.`
	DescOnlyTemplatisedFaults = `When true, only returns faults that have templates available. Defaults to false.`
)

// Tool descriptions for chaos tools.
var (
	DescToolExperimentsList = `List the chaos experiments.
Returns a paginated list of experiments with experimentID, name, description, infra details (identity, environmentId), timestamps, and workflow type.`

	DescToolExperimentDescribe = `Retrieves detailed information about a chaos experiment by its experimentID.
Returns experiment details including ExperimentID, Identity, InfraID, InfraType, ExperimentType,
revisions (with manifest YAML), and recent run details (ExperimentRunID, ResiliencyScore, Phase).`

	DescToolExperimentRunResult = `Retrieves the execution result of a specific chaos experiment run.
Returns status, resiliencyScore, duration, runSequence, and per-step fault/action/probe nodes
with their individual status, chaosData, and error details.`

	DescToolExperimentRun = `Run a chaos experiment by its experimentID.
If the experiment has required variables, they must be provided via experimentVariables and tasks parameters;
use chaos_experiment_variables_list to discover them beforehand.
Returns the initiated run details including experimentRunId, experimentId, and experimentName.`

	DescToolProbesList = `List the chaos probes.
Returns totalNoOfProbes and a list of probes with identity, probeId, name, type, infrastructureType,
isEnabled, runProperties, recentProbeRuns, and probeReferenceCount.`

	DescToolProbeDescribe = `Retrieves detailed information about a chaos probe by its probeId.
Returns probe details including identity, probeId, name, type, infrastructureType, isEnabled,
description, tags, runProperties, recentProbeRuns, and probeReferenceCount.`

	DescToolCreateExperimentFromTemplate = `Create a new chaos experiment from an experiment template.
Recommended workflow:
(1) Use chaos_list_hubs to fetch available hubs and ask the user to select one (hubIdentity).
(2) Use chaos_list_experiment_templates filtered by the selected hubIdentity to fetch available templates
    and ask the user to select one (templateId). Note the template's infraType for the next step.
(3) Use chaos_list_environments to fetch available environments and ask the user to select one (environmentId).
(4) Use chaos_list_k8s_infrastructures with the selected environmentId (and optionally filter by the
    template's infraType) to fetch available infrastructures and ask the user to select one (infraId).
    Only infrastructures where status is 'ACTIVE' AND isChaosEnabled is true can be used.
    If the user selects one that is inactive or has isChaosEnabled: false, inform them it cannot be used
    and ask them to pick a different one.
(5) Ask the user for a name and optionally an identity for the new experiment.
Name and identity are auto-generated if not provided; both must match the pattern ^[a-z][a-z0-9-]*[a-z0-9]$.
The infraId is automatically prefixed with environmentId if needed.
Use importType to control how the experiment is linked: 'LOCAL' (copy into project, default) or 'REFERENCE' (keep a reference to the template hub).
Returns the created experiment details including id, identity, name, infraType, infraId, and manifest.`

	DescToolListExperimentTemplates = `List chaos experiment templates from chaos hubs.
Returns a paginated list of templates with identity, name, description, tags, revision, infraType,
hub identity, and audit info (createdBy, updatedBy, timestamps).`

	DescToolGetExperimentTemplate = `Retrieves detailed information about a specific chaos experiment template by its identity.
Returns the full template including name, identity, description, tags, kind, apiVersion, revision, isDefault,
and spec (infraType, faults, probes, actions, vertices, cleanupPolicy).`

	DescToolDeleteExperimentTemplate = `Deletes a chaos experiment template by its identity (soft delete).
The template must not be referenced by any existing experiment, otherwise the delete will be rejected.`

	DescToolListExperimentTemplateRevisions = `Lists all revisions of a specific chaos experiment template by its identity.
Returns a paginated list of revisions with identity, name, revision, isDefault, infraType, and audit info.
Supports pagination, search by name, sort, and filtering by infrastructure type, infrastructure, and tags.`

	DescToolGetExperimentTemplateVariables = `Retrieves the input variables of a specific chaos experiment template, grouped by faults, probes, and actions.
Each group contains a list of variable definitions with name, value, path, category, type, description, required flag, and allowed values.
Useful for understanding what inputs are needed before launching an experiment from a template.`

	DescToolGetExperimentTemplateYaml = `Retrieves the YAML representation of a specific chaos experiment template.
Returns a JSON object with a 'template' field containing the raw YAML string for the given revision.
Use when you need the raw YAML definition; use chaos_get_experiment_template for structured JSON with parsed fields.`

	DescToolCompareExperimentTemplateRevisions = `Compares two revisions of a chaos experiment template side by side.
Returns a JSON object with 'template1' and 'template2' fields containing the YAML strings of each revision for diff comparison.
Both revision1 and revision2 are required.`

	DescToolExperimentVariablesList = `List the runtime input variables for a chaos experiment.
Returns variables grouped into experiment-level variables and per-task variables (keyed by task name).
Each variable includes name, value, type, description, required flag, and allowed values.
Useful for understanding what inputs are needed before running an experiment via chaos_experiment_run.`

	DescToolListLinuxInfrastructures = `List available Linux infrastructure for chaos engineering and load testing.
Returns chaos Linux infrastructures (load infrastructures) with their IDs, names, and status.
Infra IDs are needed when creating sample load tests via chaos_create_sample_loadtest.
By default only active infrastructures are returned; set status to 'All' to list all.`

	DescToolListFaultTemplates = `List chaos fault templates from chaos hubs.
Returns a paginated list of templates with identity, name, category, infraType, revision, variables, tags, and audit info.
Supports filtering by hub, type, infrastructure, category, tags, and pagination.`

	DescToolGetFaultTemplate = `Retrieves detailed information about a specific chaos fault template by its identity.
Returns the template data (identity, name, category, infraType, revision, variables, tags, template YAML)
and the parsed fault object with spec details.`

	DescToolDeleteFaultTemplate = `Deletes a chaos fault template by its identity (soft delete).
The template must not be used by any experiment template, and must not be referenced by any faults, otherwise the delete will be rejected.
Returns {"deleted":true} on success.`

	DescToolListFaultTemplateRevisions = `Lists all revisions of a specific chaos fault template by its identity.
Returns a paginated list of revisions with identity, name, revision, isDefault, category, infraType, and audit info.`

	DescToolGetFaultTemplateVariables = `Retrieves the runtime input variables of a specific chaos fault template.
Returns variables grouped into: variables, faultTargets, faultTunable, and faultAuthentication.
Each variable includes name, value, path, category, type, description, required flag, and allowed values.`

	DescToolGetFaultTemplateYaml = `Retrieves the YAML representation of a specific chaos fault template.
Returns a JSON object with a 'template' field containing the raw YAML string for the given revision.
Use when you need the raw YAML definition; use chaos_get_fault_template for structured JSON with parsed fields.`

	DescToolCompareFaultTemplateRevisions = `Compares two revisions of a chaos fault template side by side.
Returns a JSON object with 'template1' and 'template2' fields containing the YAML strings of each revision for diff comparison.
Both revision1 and revision2 are required.`

	DescToolListProbeTemplates = `List chaos probe templates.
Returns a paginated list of templates with identity, name, type, infrastructureType, revision, probeProperties, runProperties, and audit info.
Supports filtering by hub, infrastructure type, probe entity type, search, and pagination.`

	DescToolGetProbeTemplate = `Retrieves detailed information about a specific chaos probe template by its identity.
Returns the template data including type, probeProperties, runProperties, variables, revision, and audit info.`

	DescToolDeleteProbeTemplate = `Deletes a chaos probe template by its identity. Requires hubIdentity.
When revision is 0 or not provided, all revisions are deleted.
Cannot delete from the Enterprise ChaosHub. The template must not be referenced by any experiment templates.
Cannot delete the default revision when targeting a specific revision.
Returns {"deleted":true} or {"deleted":false} on success.`

	DescToolGetProbeTemplateVariables = `Retrieves the runtime input variables for a chaos probe template.
Returns variables grouped into: variables, probeProperties, and probeRunProperty.
Each variable includes name, value, path, category, type, description, required flag, and allowed values.`

	DescToolListActionTemplates = `List chaos action templates.
Returns a paginated list of templates with identity, name, type, infrastructureType, revision, actionProperties, runProperties, and audit info.
Supports filtering by hub, infrastructure type, action entity type, search, and pagination.`

	DescToolGetActionTemplate = `Retrieves detailed information about a specific chaos action template by its identity.
Returns the template data including type, actionProperties, runProperties, variables, revision, and audit info.`

	DescToolDeleteActionTemplate = `Deletes a chaos action template by its identity. Requires hubIdentity.
When revision is 0 or not provided, all revisions are deleted.
The template must not be referenced by any experiment templates. Cannot delete the default revision when targeting a specific revision.
Returns {"deleted":true} or {"deleted":false} on success.`

	DescToolListActionTemplateRevisions = `Lists all revisions of a chaos action template by its identity.
Returns a paginated list of revisions with identity, name, type, revision, isDefault, and audit info.
Supports pagination and search.`

	DescToolGetActionTemplateVariables = `Retrieves the runtime input variables for a chaos action template.
Returns variables grouped into: variables, actionProperties, and actionRunProperty.
Each variable includes name, value, path, category, type, description, required flag, and allowed values.`

	DescToolCompareActionTemplateRevisions = `Compares two revisions of a chaos action template side by side.
Returns a paginated list containing the two requested revisions for diff comparison.
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
The hub must have no fault templates, action templates, or probe templates — remove them before deleting.
At least one hub must remain after deletion. The default Enterprise ChaosHub cannot be deleted.
Returns a success message on completion.`

	DescToolCreateHub = `Create a new ChaosHub in the given Harness scope (account, org, project).
The hub record stores a Git repo and connector reference that provides chaos fault, experiment, probe, and action templates.
connectorRef, repoName, and repoBranch are optional at creation but must be configured (via chaos_update_hub) before template operations can be performed on the hub.
The hub identity cannot be 'enterprise-chaoshub' as that is reserved for the default hub.
Returns the created hub details including identity, name, repository info, connector configuration, and template counts.`

	DescToolUpdateHub = `Update the editable fields of a ChaosHub (name, description, tags) by its identity.
IMPORTANT: The API uses a replace-all model — all fields are fully replaced, not merged.
Omitted or empty values will overwrite and clear existing data.
To preserve existing description or tags when changing only some fields,
fetch the current hub via chaos_get_hub first and pass through the values you want to keep.
Returns the updated hub details including identity, name, repository info, and template counts.`

	DescToolListChaosGuardConditions = `List ChaosGuard conditions.
Conditions define the infrastructure, fault, and application constraints that ChaosGuard rules evaluate against chaos experiments.
Returns a paginated list of conditions with name, description, infraType, faultSpec, associated rules, tags, and audit info.
Supports filtering by infrastructure type, tags, search, sorting, and pagination.`

	DescToolGetChaosGuardCondition = `Get a ChaosGuard condition by its identifier.
Returns the full condition details including infrastructure type, fault specifications, K8s/machine specs, associated rules, and tags.`

	DescToolDeleteChaosGuardCondition = `Delete (soft-delete) a ChaosGuard condition by its identifier.
The condition is marked as removed and will no longer appear in listings or be evaluated by rules,
but is not permanently erased from the database.
Returns a JSON object with success status and message.`

	DescToolListChaosGuardRules = `List ChaosGuard governance rules.
ChaosGuard rules define security policies that control when and how chaos experiments can run,
including user group restrictions, time windows, and conditions.
Returns a paginated list of rules with name, description, conditions, time windows, userGroupIds, isEnabled, and audit info.
Supports filtering by infrastructure type, tags, search, sorting, and pagination.`

	DescToolGetChaosGuardRule = `Get a ChaosGuard rule by its identifier.
Returns the full rule details including name, description, conditions, time windows, user group restrictions, and enabled status.`

	DescToolDeleteChaosGuardRule = `Delete (soft-delete) a ChaosGuard rule by its identifier.
The rule is marked as removed and will no longer appear in listings or be enforced,
but is not permanently erased from the database.
Returns a JSON object with success status and message.`

	DescToolEnableChaosGuardRule = `Enable or disable a ChaosGuard rule.
When enabled, the rule actively enforces its governance conditions on chaos experiments.
When disabled, the rule is inactive and does not affect experiment execution.
Returns a success message on completion.`

	DescToolListChaosEnvironments = `List Harness environments available for chaos experiments.
Returns a paginated list of environments with their identifier, name, type (Production/PreProduction), and timestamps.
Use the environment identifier with chaos_list_k8s_infrastructures to find available infrastructure within that environment.
Supports search by name and sort by lastModifiedAt or name.`

	DescToolListKubernetesInfrastructures = `List Kubernetes chaos infrastructures available for running experiments.
Use chaos_list_environments first to get an environmentId, then pass it here to filter infrastructures for that environment.
Returns infrastructure details including identity, infraID, name, environmentID, status, infraType, and infraScope.
The infraID is used as the infraId parameter in chaos_create_experiment_from_template.
Supports filtering by status (ACTIVE, INACTIVE, PENDING) and optional inclusion of legacy V1 infrastructures.`

	DescSearchTermEnv      = `Search environments by name (case-insensitive).`
	DescSortEnv            = `Sort field and direction as a combined string (e.g. "lastModifiedAt,DESC" or "name,ASC"). Defaults to lastModifiedAt,DESC.`
	DescStatusK8sInfra     = `Filter by infrastructure status. Use 'ACTIVE' (default), 'INACTIVE', 'PENDING', or 'All' for no filter.`
	DescIncludeLegacyInfra = `When true, also includes V1 (legacy) Kubernetes infrastructures alongside V2 ones. Defaults to false.`
	DescEnvironmentType    = `Filter environments by type: 'PreProduction' or 'Production'. Leave empty to return all types.`
	DescSearchK8sInfra     = `Search infrastructures by name (case-insensitive).`
)
