// ── Toolset ──────────────────────────────────────────────────────────

export const descToolsetChaos = `Harness Chaos Engineering — experiments, probes, hubs, faults, ChaosGuard rules/conditions, Kubernetes and Linux infrastructure, network maps, recommendations, risks, load tests, and templates (experiment, fault, probe, action)`;

// ── Resource Descriptions ────────────────────────────────────────────

export const descChaosExperiment = `Chaos experiment definition. Supports list, get, and execute actions: run, stop. Use chaos_experiment_variable list to discover required runtime inputs before running.`;

export const descChaosExperimentRun = `Result of a chaos experiment run. Supports get.`;

export const descChaosProbe = `Chaos resilience probe. Supports list, get, delete, and execute actions: enable, verify, get_manifest.`;

export const descChaosExperimentTemplate = `Reusable, versioned chaos experiment template stored in a ChaosHub (Git-backed repository).
Templates are pre-configured experiment blueprints that standardize chaos practices across teams — they support version control, revision history, typed input variables, and rendered YAML.
Scopes: templates can be account-level (shared across all orgs/projects), org-level, or project-level.
Workflow: list templates → get_variables to discover required inputs → create_from_template to launch an experiment.
Supports list, get, delete, plus execute actions: list_revisions, get_variables, get_yaml, compare_revisions, and create_from_template.`;

export const descChaosExperimentVariable = `Variables for a chaos experiment. List variables to discover required runtime inputs before running an experiment.`;

export const descChaosInfrastructure = `Linux/machine infrastructure registered for chaos experiments and load testing. For Kubernetes infrastructure, use chaos_k8s_infrastructure. Supports list.`;

export const descChaosLoadtest = `Load test instance. Supports list, get, create, and delete. Run/stop via execute actions.`;

export const descChaosK8sInfrastructure = `Kubernetes chaos infrastructure available for running experiments.
Use chaos_environment list first to get an environmentId, then pass it here to filter infrastructures for that environment.
Returns infrastructure details including identity, infraID, name, environmentID, status, infraType, and infraScope.
The infraID is used as the infra_ref parameter in create_from_template.
Supports filtering by status (ACTIVE, INACTIVE, PENDING), search, and optional inclusion of legacy V1 infrastructures.`;

export const descChaosHub = `ChaosHub — a Git-backed repository that provides version-controlled chaos fault, experiment, probe, and action templates.
Every project includes a default Enterprise ChaosHub with pre-built templates; custom hubs can be created to bring in organization-specific chaos artifacts.
Supports list, get, create, update, and delete.
Returns hub details including repository URL, branch, connector configuration, template counts, sync status, and metadata.`;

export const descChaosFault = `Chaos fault definition (e.g. pod-delete, network-loss, CPU stress). Supports list, get, delete, plus get_variables, get_yaml, and list_experiment_runs execute actions.`;

export const descChaosNetworkMap = `Network map (application map) for chaos blast radius visualization. Supports list and get.`;

export const descChaosGuardCondition = `ChaosGuard condition — defines the infrastructure, fault, and application constraints that ChaosGuard rules evaluate against chaos experiments.
Returns name, description, infraType, faultSpec, associated rules, tags, and audit info.
Supports list, get, and delete. List supports filtering by infrastructure type, tags, search, and sorting.`;

export const descChaosGuardRule = `ChaosGuard governance rule — defines security policies that control when and how chaos experiments can run, including user group restrictions, time windows, and conditions.
Returns name, description, conditions, time windows, userGroupIds, isEnabled, and audit info.
Supports list, get, delete, and enable/disable action. List supports filtering by infrastructure type, tags, search, and sorting.`;

export const descChaosRecommendation = `Chaos resilience recommendation based on experiment results. Supports list and get.`;

export const descChaosRisk = `Chaos risk assessment for services and infrastructure. Supports list and get.`;

export const descChaosFaultTemplate = `Versioned, structured chaos fault template stored in the database with full CRUD support.
Supports list, get, delete, plus revision history, variables, YAML retrieval, and revision comparison via execute actions.
Used for modern flows: experiment template builder, ChaosHub fault listing, and creating custom faults.`;

export const descChaosProbeTemplate = `Versioned chaos probe template stored in a ChaosHub.
Probe templates define reusable resilience probe configurations (HTTP, CMD, Prometheus, K8s, SLO, Datadog, Dynatrace, Container, APM).
Supports list, get, delete, and get_variables actions.
Returns identity, name, type, infrastructureType, revision, probeProperties, runProperties, and audit info.`;

export const descChaosActionTemplate = `Versioned chaos action template stored in a ChaosHub.
Action templates define reusable actions (delay, customScript, container) that can be embedded in experiment workflows.
Supports list, get, delete, list_revisions, get_variables, and compare_revisions actions.
Returns identity, name, type, infrastructureType, revision, actionProperties, runProperties, and audit info.`;

export const descChaosHubFault = `Faults available in ChaosHubs.
Returns fault details including name, category, infrastructure type, permissions required, and platform support.
Also returns fault category counts for each infrastructure type.
Supports filtering by hub, infrastructure type, category, permissions, and search. Supports list only.
Used only for legacy infrastructure experiments. Deprecated — do not use for new features.`;

export const descChaosEnvironment = `Harness environment available for chaos experiments.
Returns identifier, name, type (Production/PreProduction), and timestamps.
Use the environment identifier with chaos_k8s_infrastructure list to find available infrastructure within that environment.
Supports search by name and sort by lastModifiedAt or name.`;

// ── Operation Descriptions ───────────────────────────────────────────

export const descListExperiments = `List chaos experiments`;
export const descGetExperiment = `Get chaos experiment details including revisions and recent run details`;

export const descGetExperimentRun = `Get chaos experiment run result with step-level details, resiliency score, and fault data`;

export const descListProbes = `List chaos probes`;
export const descGetProbe = `Get chaos probe details`;

export const descListExperimentTemplates = `List chaos experiment templates from chaos hubs.
Returns a paginated list of templates with identity, name, description, tags, revision, infraType, hub identity, and audit info.
Supports filtering by hub, infrastructure, tags, search, sort, and cross-scope inclusion.`;

export const descGetExperimentTemplate = `Get detailed info about a chaos experiment template by identity.
Returns full template including name, identity, description, tags, kind, apiVersion, revision, isDefault,
and spec (infraType, faults, probes, actions, vertices, cleanupPolicy).
Requires hub_identity (chaos hub that owns the template — use harness_list with resource_type=chaos_hub to find hub identities).
Optional: revision (specific template revision; omit for latest).`;

export const descDeleteExperimentTemplate = `Delete a chaos experiment template by identity.
Requires hub_identity to identify which chaos hub owns the template.
Returns a success confirmation on completion.`;

export const descListExperimentVariables = `List variables for a chaos experiment (experiment-level and task-level)`;

export const descListLinuxInfra = `List chaos Linux infrastructures (load runners)`;

export const descListLoadtests = `List load test instances`;
export const descGetLoadtest = `Get load test instance details`;
export const descCreateLoadtest = `Create a sample load test instance`;
export const descDeleteLoadtest = `Delete a load test instance`;

export const descListK8sInfra = `List Kubernetes chaos infrastructures available for running experiments.
Use chaos_environment list first to get an environmentId, then pass it here to filter infrastructures for that environment.
Returns infrastructure details including identity, infraID, name, environmentID, status, infraType, and infraScope.
Supports filtering by status (ACTIVE, INACTIVE, PENDING) and optional inclusion of legacy V1 infrastructures.`;
export const descGetK8sInfra = `Get Kubernetes chaos infrastructure details`;

export const descListHubs = `List ChaosHubs (Git-connected repositories containing fault, experiment, probe, and action templates).
Returns hub details including repository info, connector configuration, template counts, and sync status.
Supports search, pagination, and cross-scope inclusion.`;

export const descGetHub = `Get a ChaosHub by its identity.
Returns full hub details including repository URL, branch, connector info, template counts, sync status, and metadata.`;

export const descCreateHub = `Create a new ChaosHub in the given Harness scope (account, org, project).
The hub record stores a Git repo and connector reference that provides chaos fault, experiment, probe, and action templates.
connectorRef, repoName, and repoBranch are optional at creation but must be configured (via harness_update) before template operations can be performed on the hub.
The hub identity cannot be 'enterprise-chaoshub' as that is reserved for the default hub.
The target Git repository should contain experiments/ and faults/ directories for template storage.
Returns the created hub details including identity, name, repository info, connector configuration, and template counts.`;

export const descUpdateHub = `Update the editable fields of a ChaosHub (name, description, tags) by its identity.
IMPORTANT: The API uses a replace-all model — all fields are fully replaced, not merged.
Omitted or empty values will overwrite and clear existing data.
To preserve existing description or tags when changing only some fields, fetch the current hub via harness_get first and pass through the values you want to keep.
Returns the updated hub details including identity, name, repository info, and template counts.`;

export const descDeleteHub = `Delete a ChaosHub by its identity.
The hub must have no fault templates, action templates, or probe templates — remove them before deleting.
At least one hub must remain after deletion. The default Enterprise ChaosHub cannot be deleted.
Returns a success message on completion.`;

export const descListFaults = `List chaos faults`;
export const descGetFault = `Get chaos fault details`;

export const descListFaultTemplates = `List chaos fault templates from chaos hubs.
Returns a paginated list of fault templates with identity, name, description, tags, revision, type, infrastructure, hub identity, and audit info.
Supports filtering by hub, type, infrastructure, category, tags, search, sort, enterprise flag, and cross-scope inclusion.`;

export const descGetFaultTemplate = `Get detailed info about a chaos fault template by identity.
Returns full template including name, identity, description, tags, type, infrastructure, revision, spec, and variable definitions.
Requires hub_identity (chaos hub that owns the template). Optional: revision (specific version; omit for latest).`;

export const descDeleteFaultTemplate = `Delete a chaos fault template by identity.
Requires hub_identity to identify which chaos hub owns the template.
Returns a success confirmation on completion.`;

export const descListNetworkMaps = `List chaos network maps`;
export const descGetNetworkMap = `Get chaos network map details`;

export const descListGuardConditions = `List ChaosGuard conditions.
Conditions define the infrastructure, fault, and application constraints that ChaosGuard rules evaluate against chaos experiments.
Returns a paginated list of conditions with name, description, infraType, faultSpec, associated rules, tags, and audit info.
Supports filtering by infrastructure type, tags, search, sorting, and pagination.`;
export const descGetGuardCondition = `Get a ChaosGuard condition by its identifier.
Returns the full condition details including infrastructure type, fault specifications, K8s/machine specs, associated rules, and tags.`;
export const descDeleteGuardCondition = `Delete (soft-delete) a ChaosGuard condition by its identifier.
The condition is marked as removed and will no longer appear in listings or be evaluated by rules.
Returns a JSON object with success status and message.`;

export const descListGuardRules = `List ChaosGuard governance rules.
ChaosGuard rules define security policies that control when and how chaos experiments can run, including user group restrictions, time windows, and conditions.
Returns a paginated list of rules with name, description, conditions, time windows, userGroupIds, isEnabled, and audit info.
Supports filtering by infrastructure type, tags, search, sorting, and pagination.`;
export const descGetGuardRule = `Get a ChaosGuard rule by its identifier.
Returns the full rule details including name, description, conditions, time windows, user group restrictions, and enabled status.`;
export const descDeleteGuardRule = `Delete (soft-delete) a ChaosGuard rule by its identifier.
The rule is marked as removed and will no longer appear in listings or be enforced.
Returns a JSON object with success status and message.`;

export const descListProbeTemplates = `List chaos probe templates.
Returns a paginated list of templates with identity, name, type, infrastructureType, revision, probeProperties, runProperties, and audit info.
Supports filtering by hub, infrastructure type, probe entity type, search, and pagination.`;
export const descGetProbeTemplate = `Get detailed info about a chaos probe template by identity.
Returns the template data including type, probeProperties, runProperties, variables, revision, and audit info.`;
export const descDeleteProbeTemplate = `Delete a chaos probe template by its identity. Requires hub_identity.
When revision is 0 or not provided, all revisions are deleted.
Cannot delete from the Enterprise ChaosHub. The template must not be referenced by any experiment templates.
Returns {"deleted":true} or {"deleted":false} on success.`;

export const descListActionTemplates = `List chaos action templates.
Returns a paginated list of templates with identity, name, type, infrastructureType, revision, actionProperties, runProperties, and audit info.
Supports filtering by hub, infrastructure type, action entity type, search, and pagination.`;
export const descGetActionTemplate = `Get detailed info about a chaos action template by identity.
Returns the template data including type, actionProperties, runProperties, variables, revision, and audit info.`;
export const descDeleteActionTemplate = `Delete a chaos action template by its identity. Requires hub_identity.
When revision is 0 or not provided, all revisions are deleted.
The template must not be referenced by any experiment templates. Cannot delete the default revision when targeting a specific revision.
Returns {"deleted":true} or {"deleted":false} on success.`;

export const descListHubFaults = `List faults available in ChaosHubs.
Returns fault details including name, category, infrastructure type, permissions required, and platform support.
Also returns fault category counts for each infrastructure type.
Supports filtering by hub, infrastructure type, category, permissions, and search.`;

export const descListChaosEnvironments = `List Harness environments available for chaos experiments.
Returns a paginated list of environments with their identifier, name, type (Production/PreProduction), and timestamps.
Use the environment identifier with chaos_k8s_infrastructure list to find available infrastructure within that environment.
Supports search by name and sort by lastModifiedAt or name.`;

export const descListRecommendations = `List chaos recommendations`;
export const descGetRecommendation = `Get chaos recommendation details`;

export const descListRisks = `List chaos risks`;
export const descGetRisk = `Get chaos risk details`;

// ── Action Descriptions ──────────────────────────────────────────────

export const descRunExperiment = `Run a chaos experiment`;
export const descEnableProbe = `Enable a chaos probe`;
export const descVerifyProbe = `Verify a chaos probe configuration`;

export const descCreateFromTemplate = `Create a chaos experiment from an experiment template.
Workflow: 1) harness_list resource_type=chaos_experiment_template to find templates, 2) harness_execute action=get_variables to discover template inputs, 3) harness_execute action=create_from_template with experiment_name, infra_ref, hub_identity, and template_identity.
Optionally set import_type ('LOCAL' copies template, 'REFERENCE' keeps live link), description, and tags.`;

export const descListRevisions = `List revision history for a template.
Returns all revisions with their identifiers, timestamps, and change descriptions. Use to track template evolution or find a specific revision for comparison.`;

export const descGetVariables = `Get the input variables defined in a template.
Returns variable definitions including names, types, default values, and descriptions. Use before create_from_template to discover required inputs.
Optionally specify a revision to get variables from a specific version.`;

export const descGetYaml = `Get the full YAML representation of a template.
Returns the rendered YAML for inspection or export. Optionally specify a revision for a specific version.`;

export const descCompareRevisions = `Compare two revisions of a template.
Returns a diff showing what changed between revision1 and revision2. Both revision identifiers are required — use list_revisions to discover available revisions.`;

export const descRunLoadtest = `Run a load test instance`;
export const descStopLoadtest = `Stop a running load test`;
export const descCheckK8sHealth = `Check health of a Kubernetes chaos infrastructure`;

export const descEnableGuardRule = `Enable or disable a ChaosGuard rule.
When enabled, the rule actively enforces its governance conditions on chaos experiments.
When disabled, the rule is inactive and does not affect experiment execution.
Returns a success message on completion.`;

export const descGetProbeTemplateVariables = `Get the runtime input variables for a chaos probe template.
Returns variables grouped into: variables, probeProperties, and probeRunProperty.
Each variable includes name, value, path, category, type, description, required flag, and allowed values.`;

export const descListActionTemplateRevisions = `List all revisions of a chaos action template by its identity.
Returns a paginated list of revisions with identity, name, type, revision, isDefault, and audit info.
Supports pagination and search.`;

export const descGetActionTemplateVariables = `Get the runtime input variables for a chaos action template.
Returns variables grouped into: variables, actionProperties, and actionRunProperty.
Each variable includes name, value, path, category, type, description, required flag, and allowed values.`;

export const descCompareActionTemplateRevisions = `Compare two revisions of a chaos action template side by side.
Returns a paginated list containing the two requested revisions for diff comparison.
Requires the template identity, hub identity, and two revision numbers.`;

// ── Body Schema Descriptions ─────────────────────────────────────────

export const descBodyExperimentRun = `Optional runtime inputs for the chaos experiment. Use chaos_experiment_variable list to discover required variables first.`;
export const descBodyNoBody = `No body required. Resource identified by path parameter.`;
export const descBodyCreateFromTemplate = `Chaos experiment from template`;
export const descBodyLoadtestDefinition = `Load test instance definition`;

// ── Field Descriptions ───────────────────────────────────────────────

export const descInputsetIdentity = `Optional inputset identity to use for the experiment run`;
export const descRuntimeInputs = `Runtime input variables: { experiment: [{name, value}], tasks: { taskName: [{name, value}] } }`;
export const descInfraType = `Filter by infrastructure type (e.g. Kubernetes, KubernetesV2, Linux, Windows, CloudFoundry, Container)`;
export const descExperimentName = `Experiment name`;
export const descExperimentIdentity = `Experiment identity (auto-generated from name if omitted)`;
export const descInfraRef = `Infrastructure reference in format: environmentId/infraId. Use chaos_environment list to find environments, then chaos_k8s_infrastructure list to find infraIDs.`;
export const descExperimentId = `Chaos experiment ID to list variables for`;
export const descInfraStatus = `Filter by infra status: Active (default) or All`;
export const descLoadtestName = `Load test name`;
export const descLoadtestType = `Load test type`;

export const descHubIdentityExact = `The unique identity of the ChaosHub. Use harness_list with resource_type=chaos_hub to find hub identities.`;
export const descHubName = `Display name for the ChaosHub.`;
export const descHubNameUpdate = `Updated display name for the ChaosHub.`;
export const descHubDescription = `Description of the ChaosHub.`;
export const descHubDescriptionUpdate = `Updated description. If omitted/empty, existing description is cleared. Pass current value from harness_get to preserve.`;
export const descHubTags = `Comma-separated list of tags for the ChaosHub.`;
export const descHubTagsReplace = `Comma-separated list of tags. Replaces all existing tags; omit to remove all. Pass current values from harness_get to preserve.`;
export const descConnectorRef = `Harness Git connector reference for repository authentication (e.g. 'account.myGitHubConnector'). Supports GitHub, GitLab, and Bitbucket connectors. Optional at creation, required before template operations.`;
export const descRepoName = `Name of the Git repository. Optional at creation, required before template operations.`;
export const descRepoBranch = `Git branch for the ChaosHub. Optional at creation, required before template operations.`;
export const descHubSearch = `Search hubs by name (case-insensitive).`;

// Shared template fields

export const descHubIdentity = `Unique identifier for the chaos hub that owns the template. Use harness_list with resource_type=chaos_hub to find hub identities.`;
export const descTemplateSearch = `Search Templates by name or identity.`;
export const descTemplateIdentity = `Unique identifier for the template. Use harness_list to find template identities.`;
export const descRevision = `Specific revision of the template. If omitted, the latest revision is returned.`;
export const descRevision1 = `First revision identifier for comparison.`;
export const descRevision2 = `Second revision identifier for comparison.`;
export const descRevisionToCompare = `Second revision identifier for comparison (action templates use this param name).`;
export const descSortField = `Field to sort results by.`;
export const descSortAsc = `When true, sort in ascending order. Defaults to false (descending).`;
export const descTags = `Comma-separated list of tags to filter by. Must have ALL specified tags (AND filter).`;
export const descIncludeAllScope = `When true, returns resources from all scopes. Defaults to false.`;
export const descInfrastructure = `Infrastructure filter (e.g. KubernetesV2).`;

// Fault template specific fields

export const descFaultType = `Fault type filter.`;
export const descFaultCategory = `Comma-separated list of categories to filter by (e.g. Kubernetes,AWS,Linux).`;
export const descFaultPermissions = `Filter by permissions required field.`;
export const descFaultIsEnterprise = `When true, filter for enterprise faults only.`;

// Create-from-template fields

export const descImportType = `How to link the experiment to its template: 'LOCAL' copies into project (default), 'REFERENCE' keeps live reference to hub template.`;
export const descExperimentDescription = `Optional description for the experiment.`;
export const descExperimentTags = `Optional tags for the experiment as an array of strings.`;

// Probe/action template fields

export const descEntityTypeProbe = `Probe entity type filter (e.g. httpProbe, cmdProbe, promProbe, k8sProbe, sloProbe, datadogProbe, dynatraceProbe, containerProbe, apmProbe).`;
export const descEntityTypeAction = `Action entity type filter (e.g. delay, customScript, container).`;

// Hub faults fields

export const descEntityTypeFault = `Fault entity type filter.`;
export const descPermissionsRequiredEnum = `Filter by permissions required: 'Basic' or 'Advanced'.`;
export const descOnlyTemplatisedFaults = `When true, return only faults that have associated templates. Defaults to false.`;

// K8s infrastructure fields

export const descEnvironmentId = `Environment identifier. Use chaos_environment list to find available environment IDs.`;
export const descK8sInfraStatus = `Filter by infrastructure status. Use 'ACTIVE' (default), 'INACTIVE', 'PENDING', or 'All' for no filter.`;
export const descIncludeLegacyInfra = `When true, also includes V1 (legacy) Kubernetes infrastructures alongside V2 ones. Defaults to false.`;
export const descSearchK8sInfra = `Search infrastructures by name (case-insensitive).`;

// Chaos environment fields

export const descSearchTermEnv = `Search environments by name (case-insensitive).`;
export const descSortEnv = `Sort field and direction as a combined string (e.g. "lastModifiedAt,DESC" or "name,ASC"). Defaults to lastModifiedAt,DESC.`;
export const descEnvironmentType = `Filter environments by type: 'PreProduction' or 'Production'. Leave empty to return all types.`;

// ChaosGuard fields

export const descGuardSearch = `Search conditions/rules by name (case-insensitive).`;
export const descGuardInfraType = `Filter by infrastructure type (e.g. Kubernetes, KubernetesV2, Linux, Windows).`;
export const descGuardTags = `Comma-separated list of tags to filter conditions/rules by.`;
export const descGuardEnabled = `Set to true to enable the rule, false to disable it. Required.`;

// ── Chaos Action Resource ────────────────────────────────────────────

export const descChaosAction = `Chaos action — a reusable step (delay, custom script, container) that can be embedded in chaos experiment workflows.
Supports list, get, delete, and get_manifest execute action.
Returns identity, name, type, infrastructureType, actionProperties, variables, and audit info.`;

export const descChaosProbeInRun = `Probe execution details within one or more chaos experiment runs.
Returns probe status, mode, fault association, and configuration for each probe that participated in the specified runs.
Requires at least one of experiment_run_ids or notify_ids. Supports list (POST) only.`;

// ── New Operation Descriptions ───────────────────────────────────────

export const descStopExperiment = `Stop a chaos experiment run.
If notify_id is set, the run is found by notify_id and scope; otherwise by experiment_run_id and scope.
If both are omitted, all runs for the experiment with phase 'Running' are stopped.
Returns isStopped, experimentId, and experimentName.`;

export const descGetProbeManifest = `Get the YAML manifest for a chaos probe by its ID (compatible with chaos engine).
Returns a JSON object with a 'manifest' field containing the raw YAML string.
Use when you need the engine-compatible YAML definition; use get for structured JSON with parsed fields.`;

export const descDeleteProbe = `Delete a chaos probe by its ID.
The probe must be disabled first (use enable action) and must not be in use by any experiment. Default probes cannot be deleted.
Returns {"response": true} on success.`;

export const descListProbesInRun = `Get probe execution details for one or more experiment runs.
At least one of experiment_run_ids or notify_ids must be provided.
Returns probe status, mode, fault association, and configuration for each probe that participated in those runs.`;

export const descGetFaultVariables = `Get the list of inputs and variables for a chaos fault by its identity.
Returns four groups: variables, faultAuthentication, faultTargets, and faultTunable — each containing name, value, type, description, and whether it is required.`;

export const descGetFaultYaml = `Get the fault template YAML for a chaos fault by its identity.
Returns a JSON object with a 'template' field containing the raw YAML string.
Use when you need the raw YAML definition; use get for structured JSON with parsed fields.`;

export const descListFaultExperimentRuns = `List experiment runs that used a specific chaos fault.
Returns a paginated list of runs with experimentRunID, experimentID, experimentName, resiliencyScore, phase, faultIDs, runSequence, and timestamps.`;

export const descDeleteFault = `Delete a chaos fault by its identity (soft delete).
The fault must not be in use by any experiment, otherwise the delete will be rejected.
Returns an empty object on success.`;

export const descListActions = `List chaos actions with optional filtering by name, infrastructure type, and action type.
Actions are reusable steps (delay, custom script, container) that can be added to chaos experiments.
Returns a paginated list of actions with identity, name, type, infrastructureType, variables, actionReferenceCount, and timestamps.`;

export const descGetAction = `Get details of a chaos action by its identity.
Returns the action configuration including identity, name, type, infrastructureType, actionProperties, runProperties, variables, and recentExecutions.
Use when you need structured JSON fields; use get_manifest for the raw YAML manifest.`;

export const descGetActionManifest = `Get the YAML manifest for a chaos action by its identity.
Returns a JSON object with a 'manifest' field containing the raw YAML string.
Use when you need the raw YAML definition; use get for structured JSON with parsed fields.`;

export const descDeleteAction = `Delete a chaos action by its identity (soft delete).
The action must not be in use by any experiment, otherwise the delete will be rejected.
Returns {"deleted": true} on success.`;

// ── New Body Schema Descriptions ─────────────────────────────────────

export const descBodyProbeEnable = `Probe enable/disable request body.`;
export const descBodyProbeVerify = `Probe verify/unverify request body.`;
export const descBodyProbesInRun = `Probe details request body. At least one of experiment_run_ids or notify_ids must be provided.`;

// ── New Field Descriptions ───────────────────────────────────────────

export const descExperimentRunIdStop = `Unique identifier of the experiment run to stop. If omitted, the stop request may apply to the latest or all relevant runs depending on backend behavior.`;
export const descNotifyId = `Notification or callback identifier associated with the experiment run; used to correlate the stop request with the run.`;
export const descForce = `When true, immediately marks the run as Stopped in the database. When false (default), only requests stop on cluster/machine.`;
export const descIsEnabledFlag = `True to enable the probe, false to disable.`;
export const descIsBulkUpdate = `When true, enable/disable the probe across all experiments that use it. Defaults to false.`;
export const descVerifyFlag = `True to verify the probe, false to unverify. Default probes cannot be verified or unverified.`;
export const descExperimentRunIds = `List of experiment run IDs to fetch probe details for.`;
export const descNotifyIds = `List of notify IDs to fetch probe details for.`;
export const descFaultIdentityParam = `Unique identity of the fault. Use chaos_fault list to find fault identities.`;
export const descIsEnterpriseFilter = `When true, filter for enterprise faults only. Defaults to false.`;
export const descIsEnterpriseGet = `When true, get an enterprise fault. Defaults to false.`;
export const descIsEnterpriseYaml = `When true, get YAML for an enterprise fault. Defaults to false.`;
export const descIsEnterpriseVars = `When true, get variables for an enterprise fault. Defaults to false.`;
export const descIsEnterpriseRuns = `When true, list runs for an enterprise fault. Defaults to false.`;
export const descActionIdentityParam = `Unique identity of the action. Use chaos_action list to find action identities.`;
export const descSearchActionsParam = `Filter actions by name.`;
export const descHubIdentityActions = `Filter actions by chaos hub identity.`;
export const descExperimentVariablesParam = `Optional experiment variables as an array of objects where each object has a name and value.`;
export const descTasksParam = `Optional task-level variables as an object where each key is a task name and the value is an object with variable name-value pairs.`;
export const descEnvironmentIdCreate = `Unique identifier for an environment. Use chaos_environment list to find environment IDs.`;
export const descInfraIdCreate = `Unique identifier for an infrastructure. Use chaos_k8s_infrastructure or chaos_infrastructure list to find infra IDs.`;
