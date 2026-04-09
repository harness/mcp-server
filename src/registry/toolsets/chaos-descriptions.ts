// ── Toolset ──────────────────────────────────────────────────────────

export const descToolsetChaos = `Harness Chaos Engineering — run/stop/govern chaos experiments; manage probes, faults (Kubernetes, AWS, Azure, GCP, Linux), actions, hubs, and templates (experiment, fault, probe, action); inspect experiment runs and resiliency scores; configure Kubernetes and Linux infrastructure and environments; visualize blast radius via network maps; enforce governance via ChaosGuard rules/conditions; analyze recommendations and risks; run load tests; list disaster recovery (DR) tests`;

// ── Resource Descriptions ────────────────────────────────────────────

export const descChaosExperiment = `Chaos experiment definition. Supports list, get, delete, and execute actions: run, stop. Use chaos_experiment_variable list to discover required runtime inputs before running.`;

export const descChaosExperimentRun = `Experiment run timeline — full snapshot of an ongoing or completed chaos experiment run.
Returns the execution pipeline with individual nodes (faults, probes, actions), each with status, timing, and chaos data.
Also returns experiment metadata, infra details, calculated resiliency score, manifest version, and run sequence.
This is a read-only endpoint — it does NOT start a run. To trigger a run, use chaos_experiment execute action: run.
Pass experiment_id via resource_id. Pass run_id or notify_id via params to identify the specific run.
Supports get.`;

export const descChaosProbe = `Chaos resilience probe — declarative health checker that monitors application health before, during, and after a fault and determines the fault outcome.
Types: HTTP, CMD, Prometheus, K8s, SLO, Datadog, Dynatrace, Container, APM. Infra: Kubernetes, Linux, Windows.
Must be disabled before deleting; default (system) probes cannot be deleted or disabled.
Supports list, get, delete, and execute actions: enable, verify, get_manifest.`;

export const descChaosExperimentTemplate = `Reusable, versioned chaos experiment template stored in a ChaosHub (Git-backed repository).
Templates are pre-configured experiment blueprints that standardize chaos practices across teams — they support version control, revision history, typed input variables, and rendered YAML.
Scopes: templates can be account-level (shared across all orgs/projects), org-level, or project-level.
Use harness_list with resource_type=chaos_hub to discover available hubs and their identities before filtering templates by hub_identity.
Workflow: list templates → get_variables to discover required inputs → create_from_template to launch an experiment.
Supports list, get, delete, plus execute actions: list_revisions, get_variables, get_yaml, compare_revisions, and create_from_template.`;

export const descChaosExperimentVariable = `Variables for a chaos experiment. List variables to discover required runtime inputs before running an experiment.`;

export const descChaosInfrastructure = `Linux/machine infrastructure registered for chaos experiments and load testing. For Kubernetes infrastructure, use chaos_k8s_infrastructure. Supports list.`;

export const descChaosLoadtest = `Load test instance. Supports list, get, create, and delete. Run/stop via execute actions.`;

export const descChaosK8sInfrastructure = `Kubernetes chaos infrastructure available for running experiments.
Use chaos_environment list first to get an environmentId, then pass it here to filter infrastructures for that environment.
Returns infrastructure details including identity, infraID, name, environmentID, status, infraType, infraScope, and isChaosEnabled.
The infraID is used as the infra_ref parameter in create_from_template.
IMPORTANT: Only infrastructures with status=ACTIVE AND isChaosEnabled=true can be used to create chaos experiments. Always check both fields before selecting an infrastructure.
Supports filtering by status (ACTIVE, INACTIVE, PENDING), search, and optional inclusion of legacy V1 infrastructures.`;

export const descChaosHub = `ChaosHub — a Git-backed repository that provides version-controlled chaos fault, experiment, probe, and action templates.
Every project includes a default Enterprise ChaosHub with pre-built templates; custom hubs can be created to bring in organization-specific chaos artifacts.
Supports list, get, create, update, and delete.
Returns hub details including repository URL, branch, connector configuration, template counts, sync status, and metadata.
Templates stored in a hub are accessible via four resource types — filter any of them by hub_identity (the identity field from this hub) to scope results to a specific hub:
- chaos_experiment_template: reusable, versioned experiment blueprints
- chaos_fault_template: versioned fault definitions (e.g. pod-delete, network-loss, CPU stress)
- chaos_probe_template: reusable resilience probe configurations (HTTP, CMD, Prometheus, K8s, SLO, etc.)
- chaos_action_template: reusable workflow action steps (delay, customScript, container)
Typical workflow: harness_list resource_type=chaos_hub → pick a hub → harness_list resource_type=<template_type> with hub_identity to browse its templates.`;

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
Use harness_list with resource_type=chaos_hub to discover available hubs and their identities before filtering templates by hub_identity.
Supports list, get, delete, plus revision history, variables, YAML retrieval, and revision comparison via execute actions.
Used for modern flows: experiment template builder, ChaosHub fault listing, and creating custom faults.`;

export const descChaosProbeTemplate = `Versioned chaos probe template stored in a ChaosHub.
Probe templates define reusable resilience probe configurations (HTTP, CMD, Prometheus, K8s, SLO, Datadog, Dynatrace, Container, APM).
Use harness_list with resource_type=chaos_hub to discover available hubs and their identities before filtering templates by hub_identity.
Supports list, get, delete, and get_variables actions.
Returns identity, name, type, infrastructureType, revision, probeProperties, runProperties, and audit info.`;

export const descChaosActionTemplate = `Versioned chaos action template stored in a ChaosHub.
Action templates define reusable actions (delay, customScript, container) that can be embedded in experiment workflows.
Use harness_list with resource_type=chaos_hub to discover available hubs and their identities before filtering templates by hub_identity.
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

export const descListExperiments = `List chaos experiments with optional filtering.
Supports filtering by experiment name, status, infrastructure (ID, name, active state), tags, environment, date range, and bulk experiment IDs.
Default page size is 15, max 50.`;
export const descGetExperiment = `Get chaos experiment details including revisions and recent run details`;

export const descGetExperimentRun = `Get the full timeline of a chaos experiment run. This is a read-only endpoint — it does NOT trigger a run.
Returns the execution pipeline: individual fault/probe/action nodes with status, timing, chaos data, and error details.
Also returns experiment name, infraID, resiliency score, run phase, manifest version, and template details.
Pass experiment_id via resource_id. Pass run_id or notify_id via params (not resource_id) to identify the specific run.
To start a new run, use chaos_experiment execute action: run instead.`;

export const descListProbes = `List chaos probes with optional filtering.
Supports filtering by name, tags, date range, probe IDs, infrastructure type, probe entity type, and sorting.
Default page size is 50, max 50.`;

export const descGetProbe = `Get chaos probe details by ID.
Returns probe type, infrastructure type, enabled/verified status, tags, run properties, probe properties, recent runs, and reference count.`;

export const descSearchProbes = `Search probes by name (case-insensitive).`;
export const descProbeIds = `Comma-separated probe IDs for bulk lookup (e.g. "id1,id2,id3").`;
export const descProbeSortField = `Field to sort probe results by. Values: NAME, TIME, ENABLED. Defaults to TIME.`;

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
Returns infrastructure details including identity, infraID, name, environmentID, status, infraType, infraScope, and isChaosEnabled.
IMPORTANT: Only infrastructures with status=ACTIVE AND isChaosEnabled=true can be used to create chaos experiments.
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
Returns the template data including type, probeProperties, runProperties, variables, revision, and audit info.
IMPORTANT: When fetching templates from the Enterprise ChaosHub (hub_identity = "enterprise-chaoshub"), you MUST omit the hub_identity parameter entirely (do not pass it, or pass it as empty string). The backend resolves Enterprise ChaosHub templates automatically when hub_identity is absent. Passing "enterprise-chaoshub" explicitly will return an error. This applies only to the Enterprise ChaosHub; for custom user-created hubs, hub_identity must be provided.
If a GET request for a template unexpectedly returns "no documents in result" and you provided hub_identity, retry the same request without hub_identity.`;

export const descDeleteProbeTemplate = `Delete a chaos probe template by its identity. Requires hub_identity.
When revision is 0 or not provided, all revisions are deleted.
Cannot delete from the Enterprise ChaosHub. The template must not be referenced by any experiment templates.
Returns {"deleted":true} or {"deleted":false} on success.`;

export const descListActionTemplates = `List chaos action templates.
Returns a paginated list of templates with identity, name, type, infrastructureType, revision, actionProperties, runProperties, and audit info.
Supports filtering by hub, infrastructure type, action entity type, search, and pagination.`;
export const descGetActionTemplate = `Get detailed info about a chaos action template by identity.
Returns the template data including type, actionProperties, runProperties, variables, revision, and audit info.
IMPORTANT: When fetching templates from the Enterprise ChaosHub (hub_identity = "enterprise-chaoshub"), you MUST omit the hub_identity parameter entirely (do not pass it, or pass it as empty string). The backend resolves Enterprise ChaosHub templates automatically when hub_identity is absent. Passing "enterprise-chaoshub" explicitly will return an error. This applies only to the Enterprise ChaosHub; for custom user-created hubs, hub_identity must be provided.
If a GET request for a template unexpectedly returns "no documents in result" and you provided hub_identity, retry the same request without hub_identity.`;
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

export const descRunExperiment = `Trigger a new chaos experiment run. This is an action — it starts execution.
Returns notifyId, experimentRunId, experimentId, and experimentName.

IMPORTANT: You MUST follow this workflow before triggering a run. Do NOT skip steps or auto-fill values.

Step 1 — Discover runtime variables:
  Call harness_list resource_type=chaos_experiment_variable with resource_id=<experiment_id> to list the experiment's runtime inputs.
  If no variables are returned, the experiment needs no overrides — skip to Step 4.
  If variables exist, show them to the user (name, type, default value) and proceed to Step 2.

Step 2 — Check for saved input sets:
  Call harness_list resource_type=chaos_input_set with experiment_id=<experiment_id>.
  If input sets exist, present them to the user as reusable presets (show identity, name, description).
  If none exist, skip to Step 3.

Step 3 — User chooses how to provide runtime values (one of four paths):

  (a) Use a saved input set as-is:
      User selects an input set from Step 2.
      Pass inputset_identity=<selected identity> in the request body. Do NOT pass runtime_inputs.
      The backend fetches the stored values and applies them.

  (b) Use a saved input set as a starting point, then modify some values:
      Fetch the selected input set via harness_get resource_type=chaos_input_set (with experiment_id and inputset_id).
      Parse its spec field — format: { experiment: [{name, value}], tasks: { taskName: [{name, value}] } }.
      Show the values to the user and let them change the ones they want to override.
      Send the MERGED result as experiment_variables/tasks (or runtime_inputs) in the request body.
      Do NOT pass inputset_identity — the backend ignores it when runtime_inputs is present.

  (c) Provide all values manually:
      User supplies values for each variable from Step 1.
      Pass them via experiment_variables and/or tasks (or runtime_inputs). Do NOT pass inputset_identity.

  (d) No overrides needed:
      User confirms they want to run with defaults. Send an empty body {}.

PRIORITY RULE: runtime_inputs (or experiment_variables/tasks) and inputset_identity are MUTUALLY EXCLUSIVE.
If runtime_inputs is present in the body, inputset_identity is silently ignored by the backend — there is no merge.
Never pass both. If the user wants to start from an input set but change some values, use path (b) above.

Step 4 — Trigger the run:
  Call harness_execute resource_type=chaos_experiment action=run with the experiment_id and chosen body.

Step 5 — Poll for results:
  Use chaos_experiment_run get with the returned experimentRunId to check status and resiliency score.
  Poll periodically until phase is Completed, Completed_With_Error, Stopped, or Error.`;
export const descEnableProbe = `Enable or disable a chaos probe. Pass is_enabled=true to enable, false to disable.
Use is_bulk_update=true to enable/disable across all experiments that reference this probe.
Default (system) probes cannot be enabled or disabled.`;
export const descVerifyProbe = `Mark a chaos probe as verified or unverified. Verified probes are trusted and validated for use in experiments.
Pass verify=true to verify, false to unverify. Default (system) probes cannot be verified or unverified.`;

export const descCreateFromTemplate = `Creates and launches a new chaos experiment from an existing experiment template.

IMPORTANT: You MUST NOT auto-select, assume, or pre-fill any value on behalf of the user.
At every step below, you MUST display the available options and wait for explicit user confirmation before proceeding.

Required workflow — follow in order, pausing for user input after each step:

Step 1 — Select a hub:
  If the user has already specified a hub_identity, confirm before proceeding.
  Otherwise call harness_list resource_type=chaos_hub, show the list, and wait for them to pick one.

Step 2 — Select an experiment template:
  If the user has already specified a template_id, confirm before proceeding.
  Otherwise call harness_list resource_type=chaos_experiment_template filtered by hub_identity from Step 1,
  show the list, and wait for them to pick one. Note the template's infraType.

Step 2.5 — Discover template inputs (optional but recommended):
  Call harness_execute resource_type=chaos_experiment_template action=get_variables to surface required runtime inputs.

Step 3 — Select an environment:
  Call harness_list resource_type=chaos_environment. Show the full list and wait for the user to pick one.
  Do NOT choose an environment yourself even if only one exists.

Step 4 — Select an infrastructure:
  Call harness_list resource_type=chaos_k8s_infrastructure filtered by the environmentId from Step 3
  (optionally filter by infraType from Step 2). Show the list and wait for the user to pick one.
  Only infrastructures where status=ACTIVE AND isChaosEnabled=true are valid.
  If the user picks one that is inactive or has isChaosEnabled=false, tell them it cannot be used and ask them to choose again.
  Do NOT choose an infrastructure yourself.

Step 5 — Collect experiment details:
  Ask the user for a name and identity for the new experiment.
  Do NOT generate or assume a name without asking.
  Both must match ^[a-z][a-z0-9-]*[a-z0-9]$.

Only after all five steps are confirmed by the user should you call harness_execute action=create_from_template.
The infraId is automatically prefixed with environmentId if needed (pass infra_id + environment_id separately).
Use import_type to control linking: 'LOCAL' (copy into project, default) or 'REFERENCE' (keep live link to hub).
Returns the created experiment details including id, identity, name, infraType, infraId, and manifest.

INPUT FIELDS (pass via body or top-level params):
  template_id (string, required): Template identity to launch from (path param).
  hub_identity (string, required): ChaosHub identity containing the template (query param). Omitting returns 400.
  revision (string): Template revision (e.g. "v1"). Omit for default revision.
  account_id (string, required): Harness account identifier. Required in body — must match account scope.
  org_id (string): Organization identifier. If provided, must match query param scope.
  project_id (string): Project identifier. If provided, must match query param scope.
  name (string, required): Display name for the new experiment.
  identity (string, required): Unique identity for the new experiment (not the template).
  infra_ref (string, required): Infrastructure ref as "environmentId/infraId". Or pass infra_id + environment_id separately.
  infra_id (string): Infrastructure ID — auto-prefixed with environment_id if needed.
  environment_id (string): Environment ID — used to construct infra_ref when infra_id is provided.
  import_type (string, required): "LOCAL" (copy, default) or "REFERENCE" (linked to hub template).
  description (string): Experiment description.
  tags (string[]): Experiment tags.

ERRORS:
  400: Missing required fields (account_id, identity, infra_ref, import_type) or scope identifier mismatch between query params and body.
  401: Unauthorized — invalid user or insufficient permissions.
  500: Internal server error.

NOTES:
  - The "identity" field is for the NEW experiment being created, not the template (template is identified by template_id).
  - Scope query params (accountIdentifier, organizationIdentifier, projectIdentifier) are auto-injected — only the body scope fields (account_id, org_id, project_id) need to be passed explicitly.`;

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
Each variable includes name, value, path, category, type, description, required flag, and allowed values.
IMPORTANT: When fetching templates from the Enterprise ChaosHub (hub_identity = "enterprise-chaoshub"), you MUST omit the hub_identity parameter entirely (do not pass it, or pass it as empty string). The backend resolves Enterprise ChaosHub templates automatically when hub_identity is absent. Passing "enterprise-chaoshub" explicitly will return an error. This applies only to the Enterprise ChaosHub; for custom user-created hubs, hub_identity must be provided.
If a GET request for a template unexpectedly returns "no documents in result" and you provided hub_identity, retry the same request without hub_identity.`;

export const descListActionTemplateRevisions = `List all revisions of a chaos action template by its identity.
Returns a paginated list of revisions with identity, name, type, revision, isDefault, and audit info.
Supports pagination and search.`;

export const descGetActionTemplateVariables = `Get the runtime input variables for a chaos action template.
Returns variables grouped into: variables, actionProperties, and actionRunProperty.
Each variable includes name, value, path, category, type, description, required flag, and allowed values.
IMPORTANT: When fetching templates from the Enterprise ChaosHub (hub_identity = "enterprise-chaoshub"), you MUST omit the hub_identity parameter entirely (do not pass it, or pass it as empty string). The backend resolves Enterprise ChaosHub templates automatically when hub_identity is absent. Passing "enterprise-chaoshub" explicitly will return an error. This applies only to the Enterprise ChaosHub; for custom user-created hubs, hub_identity must be provided.
If a GET request for a template unexpectedly returns "no documents in result" and you provided hub_identity, retry the same request without hub_identity.`;

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
export const descExperimentId = `Chaos experiment identifier. Accepts either the internal UUID (default, with is_identity=false) or the human-readable identity slug (set is_identity=true). Use harness_list with resource_type=chaos_experiment to find experiment IDs.`;
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
export const descIncludeAllScope = `Controls scope filtering for list queries. false (default): Returns only templates matching the exact organizationIdentifier and projectIdentifier provided. If both are empty, returns only account-level and Enterprise ChaosHub (global) templates. true: Returns templates across all organizations and projects in the account, plus Enterprise ChaosHub (global) templates. Use this when you need a combined view of built-in enterprise templates and custom templates across scopes, or when the user's org/project context is unknown.`;
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

// Experiment list filter fields

export const descSearchExperiments = `Search experiments by name (case-insensitive).`;
// export const descExperimentStatus = `Filter by last run status. Values: Running, Completed, Completed_With_Error, Completed_With_Probe_Failure, Stopped, Skipped, Error, Timeout, NA, Queued, Blocked.`;
export const descExperimentInfraId = `Filter experiments by infrastructure ID. IMPORTANT: Must be used together with environment_id — the backend requires both to filter. Using infra_id alone has no effect.`;
// export const descExperimentInfraActive = `Filter by infrastructure active state: true = active infra only, false = inactive only.`;
export const descExperimentIds = `Comma-separated experiment IDs for bulk lookup (e.g. "id1,id2,id3").`;
export const descExperimentStartDate = `Filter by start date (Unix milliseconds, e.g. "1711324800000"). Must be used together with end_date.`;
export const descExperimentEndDate = `Filter by end date (Unix milliseconds, e.g. "1711324800000"). Must be used together with start_date.`;

// K8s infrastructure fields

export const descEnvironmentId = `Environment identifier. Use chaos_environment list to find available environment IDs.`;
export const descExperimentEnvironmentId = `Environment identifier for filtering experiments. IMPORTANT: Must be used together with infra_id — the backend requires both to filter. Using environment_id alone has no effect. Use chaos_environment list to find available environment IDs.`;
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

export const descChaosProbeInRun = `Probe execution results within one or more chaos experiment runs — the primary way to check which probes ran and whether they passed or failed.
Returns per-probe: probeId, name, type, mode, status (verdict), experimentId, experimentRunId, notifyId, experimentName, faultName, nodeName, isExperimentLevelProbe, probeDetails, and probeYaml.
Provide experiment_run_ids OR notify_ids (or both). If both are provided, results are the AND intersection — only runs matching both.
Supports list (POST) only.`;

// ── New Operation Descriptions ───────────────────────────────────────

export const descDeleteExperiment = `Permanently delete a chaos experiment and all its associated data.

IRREVERSIBLE: deletes run history, resiliency scores, probes, schedules, and input sets. Cannot be undone.

REQUIRED pre-call workflow:
1. Fetch the experiment via harness_get and display: name, identity, total runs, last run status, and last run date.
2. Ask the user: "Are you sure you want to permanently delete experiment '[name]'? This cannot be undone."
3. Do NOT proceed unless the user explicitly confirms using the experiment name (not just "yes").
4. If the user seems unsure, suggest archiving or disabling instead of deleting.

Returns experimentId, experimentName, isDeleted.`;

export const descStopExperiment = `Stop a chaos experiment run.
Pass experiment_id via resource_id. Pass experiment_run_id, notify_id, force via params (not inputs).
If notify_id is set, the run is found by notify_id and scope; otherwise by experiment_run_id and scope.
If both are omitted, all runs for the experiment with phase 'Running' are stopped.
force=true immediately marks the run as Stopped in the database; false (default) requests stop on cluster/machine.
Returns isStopped, experimentId, and experimentName.`;

export const descGetProbeManifest = `Get the YAML manifest for a chaos probe by its ID (compatible with chaos engine).
Returns a JSON object with a 'manifest' field containing the raw YAML string.
Use when you need the engine-compatible YAML definition; use get for structured JSON with parsed fields.`;

export const descDeleteProbe = `Permanently delete a chaos probe by its ID.

IRREVERSIBLE: deletes the probe definition, all execution history, and reference data. Cannot be undone.

PREREQUISITES:
- The probe must be disabled first — use chaos_probe execute action: enable with is_enabled=false and is_bulk_update=true to also remove it from all experiment manifests.
- The probe must not be referenced by any experiment. Default (system) probes cannot be deleted.
- The delete call itself takes no extra parameters beyond probe_id.

REQUIRED pre-call workflow:
1. Fetch the probe via harness_get and display: name, ID, type, infrastructure type, enabled status, verified status, and reference count.
2. If the probe is still enabled, disable it first (chaos_probe execute action: enable with is_enabled=false, is_bulk_update=true).
3. Ask the user: "Are you sure you want to permanently delete probe '[name]'? This cannot be undone."
4. Do NOT proceed unless the user explicitly confirms using the probe name (not just "yes").
5. If the user seems unsure, suggest disabling instead of deleting.

Returns {"response": true} on success.`;

export const descListProbesInRun = `Get probe execution results for one or more experiment runs.
Provide experiment_run_ids OR notify_ids. If only one field is given, matches any ID in that list (OR within).
If both fields are given, results are the AND intersection — only runs matching both a notify ID and a run ID.
Neither provided returns 400 Bad Request.
Returns per-probe: probeId, name, type, mode, status, faultName, experimentName, probeDetails, and probeYaml.`;

export const descGetFaultVariables = `Get the list of inputs and variables for a chaos fault by its identity.
Returns four groups: variables, faultAuthentication, faultTargets, and faultTunable — each containing name, value, type, description, and whether it is required.`;

export const descGetFaultYaml = `Get the fault template YAML for a chaos fault by its identity.
Returns a JSON object with a 'template' field containing the raw YAML string.
Use when you need the raw YAML definition; use get for structured JSON with parsed fields.`;

export const descListFaultExperimentRuns = `List experiment runs that used a specific chaos fault.
Returns a paginated list of runs with experimentRunID, experimentID, experimentName, resiliencyScore, phase, faultIDs, runSequence, and timestamps.`;

export const descChaosFaultExperimentRun = `Experiment runs associated with a specific chaos fault.
Requires fault_id (the fault identity). Returns paginated runs with experimentRunID, experimentID, experimentName, resiliencyScore, phase, faultIDs, runSequence, and timestamps.`;

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
export const descBodyProbesInRun = `Probe execution results request body. Provide experiment_run_ids OR notify_ids (or both).
If both are provided, only runs matching both conditions are returned (AND intersection).`;

// ── New Field Descriptions ───────────────────────────────────────────

export const descExperimentRunIdStop = `Unique identifier of the experiment run to stop. If omitted, the stop request may apply to the latest or all relevant runs depending on backend behavior.`;
export const descNotifyId = `Notification or callback identifier associated with the experiment run; used to correlate the stop request with the run.`;
export const descForce = `When true, immediately marks the run as Stopped in the database. When false (default), only requests stop on cluster/machine.`;
export const descIsEnabledFlag = `True to enable the probe, false to disable.`;
export const descIsBulkUpdate = `When true, enable/disable the probe across all experiments that use it. Defaults to false.`;
export const descVerifyFlag = `True to verify the probe, false to unverify. Default probes cannot be verified or unverified.`;
export const descExperimentRunIds = `List of experiment run IDs to fetch probe details for. Matches any run ID in the list (OR within).`;
export const descNotifyIds = `List of notify IDs (pipeline-triggered run identifiers) to fetch probe details for. Matches any notify ID in the list (OR within).`;
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

export const descAccountIdBody = `Harness account identifier. Required in body — must match the account scope.`;
export const descOrgIdBody = `Organization identifier for the new experiment. If provided, must match the query param scope.`;
export const descProjectIdBody = `Project identifier for the new experiment. If provided, must match the query param scope.`;

// ── DR Test Descriptions ─────────────────────────────────────────────

export const descChaosDRTest = `Chaos DR Test (Disaster Recovery Test) — a DRTest-type stage inside a Harness pipeline used to validate disaster recovery readiness through chaos fault injection. Supports list and create.

Key concepts:
- A DR Test is NOT a standalone entity — it is a stage (type: DRTest) inside a Harness Pipeline tagged module=drtest. The pipeline is a transparent container; API consumers only see the stage.
- Creating a DR Test creates a pipeline skeleton with one empty DRTest stage (steps: []). Chaos steps are added later via the Pipeline Service.
- The identifier you pass becomes the stageIdentifier. The pipeline gets identifier + "_pipeline" as its pipelineIdentifier.
- The API automatically sets both discovery markers — you never pass them in the request: pipeline-level tag module=drtest (used by LIST to filter pipelines) and stage-level type=DRTest (used to extract stages).
- All three scope params are required: accountIdentifier, organizationIdentifier, projectIdentifier. The API is strictly project-scoped.

List response fields: name, identity (stage ID), description, tags (key-value map), objective (DR goal statement), and spec.pipeline containing the parent pipeline name, identity, recentRuns (executionId, status, startTs, endTs, executorInfo), and lastModified timestamp.

Pipeline access: Each DR Test is backed by a Harness pipeline (pipelineIdentifier = dr_test_id + "_pipeline", also available as spec.pipeline.identity in the DR test response). Use pipeline_id=spec.pipeline.identity as the identifier for both endpoints below.
- resource_type=pipeline_summary (harness_get): Returns lightweight pipeline metadata — name, status, tags, store type, last modified. Call this to quickly check whether the backing pipeline exists, is enabled, or has the expected module=drtest tag. Does not include the pipeline YAML.
- resource_type=pipeline (harness_get): Returns the full pipeline YAML definition. Call this when you need to inspect or reason about the pipeline's stages, steps, fault injections, or full configuration — for example to see what chaos faults are configured inside the DRTest stage.
- resource_type=pipeline (harness_execute, action=update): Replaces the full pipeline YAML. ALWAYS fetch the current YAML first (harness_get resource_type=pipeline), apply only the user-requested edits, and send back the complete YAML — omitting any field will erase it since this is a full-replace PUT.
- resource_type=pipeline (harness_execute, action=run): Triggers a pipeline execution. Check required inputs first with harness_get resource_type=runtime_input_template, resource_id=spec.pipeline.identity. Pass runtime inputs as key-value pairs (e.g. {branch: 'main'}) or use input_set_ids to reference saved input sets.
- resource_type=execution (harness_execute, action=interrupt): Interrupts a running DR test execution. Use execution_id from spec.pipeline.recentRuns (in the DR test response). Set interrupt_type to AbortAll, Pause, Resume, StageRollback, Abort, ExpireAll, or Retry.
- resource_type=pipeline (harness_execute, action=delete): Permanently deletes the pipeline backing the DR test, which also removes the DR test itself. Use pipeline_id=spec.pipeline.identity. This is irreversible — always confirm with the user before proceeding.`;

export const descListDRTests = `List all DR Tests (disaster recovery test stages) from pipelines tagged with module=drtest.
Returns each DR Test's identity, name, description, objective, tags, and parent pipeline info with recent run statuses.
Supports pagination (page, limit) and sorting (sort).

Constraints:
- Pagination and sort apply to the underlying pipeline list, not individual DR Test stages — a page of N pipelines may yield more or fewer DR Tests since one pipeline can contain multiple DRTest stages.
- The response has no server-side pagination metadata; total count is derived from the returned array length.
- recentRuns are at the pipeline level — all DRTest stages from the same pipeline share the same recent execution history.
- Only pipelines tagged module=drtest are returned; this filter is hardcoded and not user-configurable.
- The search parameter is accepted without error but has no effect — it is inherited from a shared query type but not wired in the backend.`;

export const descDRTestSort = `Sort field and direction for the underlying pipeline list. Format: {field},{DIRECTION}.
Valid sort fields: name (pipeline name, alphabetical), lastModified (pipeline last modification timestamp), lastExecution (pipeline most recent execution timestamp).
Valid directions: ASC, DESC.
Valid combinations: name,ASC | name,DESC | lastModified,ASC | lastModified,DESC | lastExecution,ASC | lastExecution,DESC.
Default (when omitted): lastModified,DESC.`;

export const descCreateDRTest = `Create a new DR Test by scaffolding a Harness Pipeline with a single DRTest-typed stage (steps: []).

What gets created:
- A Harness Pipeline named "<name> Pipeline" with identifier "<identifier>_pipeline". The API automatically sets the pipeline tag module=drtest and the stage type=DRTest — you never pass these in the request body.
- A single DRTest stage inside it with identifier = <identifier>, description, objective, and tags as provided.
- The pipeline starts empty (steps: []). Add chaos steps later via the Pipeline Service.

Identifier convention:
- stageIdentifier = identifier (what you pass)
- pipelineIdentifier = identifier + "_pipeline"

All three scope params are required: accountIdentifier, organizationIdentifier, projectIdentifier.`;

export const descDRTestName = `Display name for the DR Test. Becomes the stage name and '<name> Pipeline' as the pipeline name.`;

export const descDRTestIdentifier = `Unique slug within the project. Becomes stageIdentifier; pipelineIdentifier is set to identifier + '_pipeline'.
Must match Harness identifier rules: starts with a letter or underscore, followed by letters, digits, underscores, or $. Max 128 characters. No spaces, hyphens, or dots.
Pattern: ^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$
Valid: payment_db_failover, MyDRTest, _dr_test_1. Invalid: my-dr-test, 1_dr_test, dr test.`;

export const descDRTestDescription = `Optional human-readable description of the DR Test scenario.`;

export const descDRTestObjective = `DR goal statement, e.g. 'Validate failover to secondary region within 30s'.`;

export const descDRTestTags = `Key-value metadata map applied to the DRTest stage, e.g. { team: 'infra', env: 'prod' }.`;

export const descBodyDRTestCreate = `Request body for creating a DR Test pipeline scaffold. name and identifier are required; all others are optional.

Example:
{
  "name": "Payment DB Failover",
  "identifier": "payment_db_failover",
  "description": "Tests if payment service survives primary DB failure",
  "objective": "Validate that payment service fails over to replica DB within 30 seconds",
  "tags": {
    "team": "platform",
    "env": "production",
    "owner": "john"
  }
}`;

// ── Chaos Input Sets ───────────────────────────────────────────────

export const descChaosInputSet = `Chaos experiment input set — a saved collection of runtime variable overrides for a chaos experiment. Supports list, get, create, update, delete. Each input set belongs to a specific experiment (identified by experiment_id). By default experiment_id is the internal UUID; pass is_identity=true to use the human-readable identity slug instead. Use chaos_experiment_variable list to discover available variables, then create an input set to save reusable configurations. Pass the input set identity to the experiment run action via inputset_identity.`;

export const descListInputSets = `List input sets for a chaos experiment. Requires experiment_id (internal UUID by default; pass is_identity=true to use identity slug instead). Returns paginated results. Use page/limit for pagination (default limit 15, max 100).`;

export const descGetInputSet = `Get a single input set by experiment_id and inputset_id. Returns the full input set including spec (JSON string of variable overrides).`;

export const descCreateInputSet = `Create a new input set for a chaos experiment. Requires experiment_id (path), identity (unique slug), and spec (JSON string of ChaosExperimentInputset shape). Name and description are optional.`;

export const descUpdateInputSet = `Update an existing input set. Requires experiment_id and inputset_id. Spec is required; name and description are optional.`;

export const descDeleteInputSet = `Delete an input set by experiment_id and inputset_id. This is irreversible.`;

export const descInputSetIdentityField = `Unique human-readable identifier (slug) for the input set. Required on create; must be unique within the experiment.`;

export const descInputSetName = `Display name for the input set. Optional.`;

export const descInputSetDescription = `Description of the input set. Optional.`;

export const descInputSetSpec = `JSON string containing the input set variable overrides (ChaosExperimentInputset shape). Required for create and update. Use chaos_experiment_variable list to discover available variables and their expected format.`;

export const descInputSetId = `Input set ID. Use harness_list with resource_type=chaos_input_set to find input set IDs.`;

export const descIsIdentity = `Controls how experiment_id is interpreted. false (default): experiment_id is an internal UUID. true: experiment_id is a human-readable identity slug.`;
