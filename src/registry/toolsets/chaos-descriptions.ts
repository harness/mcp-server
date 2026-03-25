// ── Toolset ──────────────────────────────────────────────────────────

export const descToolsetChaos = `Harness Chaos Engineering — experiments, probes, hubs, faults, ChaosGuard rules/conditions, Kubernetes and Linux infrastructure, network maps, recommendations, risks, and load tests`;

// ── Resource Descriptions ────────────────────────────────────────────

export const descChaosExperiment = `Chaos experiment definition. Supports list, get, and run action. Use chaos_experiment_variable list to discover required runtime inputs before running.`;

export const descChaosExperimentRun = `Result of a chaos experiment run. Supports get.`;

export const descChaosProbe = `Chaos resilience probe. Supports list, get, enable, and verify actions.`;

export const descChaosExperimentTemplate = `Reusable, versioned chaos experiment template stored in a ChaosHub (Git-backed repository).
Templates are pre-configured experiment blueprints that standardize chaos practices across teams — they support version control, revision history, typed input variables, and rendered YAML.
Scopes: templates can be account-level (shared across all orgs/projects), org-level, or project-level.
Workflow: list templates → get_variables to discover required inputs → create_from_template to launch an experiment.
Supports list, get, delete, plus execute actions: list_revisions, get_variables, get_yaml, compare_revisions, and create_from_template.`;

export const descChaosExperimentVariable = `Variables for a chaos experiment. List variables to discover required runtime inputs before running an experiment.`;

export const descChaosInfrastructure = `Linux/machine infrastructure registered for chaos experiments and load testing. For Kubernetes infrastructure, use chaos_k8s_infrastructure. Supports list.`;

export const descChaosLoadtest = `Load test instance. Supports list, get, create, and delete. Run/stop via execute actions.`;

export const descChaosK8sInfrastructure = `Kubernetes infrastructure registered for chaos experiments. List uses POST with filter/sort body. Supports list, get, and check_health action.`;

export const descChaosHub = `ChaosHub — a Git-backed repository that provides version-controlled chaos fault, experiment, probe, and action templates.
Every project includes a default Enterprise ChaosHub with pre-built templates; custom hubs can be created to bring in organization-specific chaos artifacts.
Supports list, get, create, update, and delete.
Returns hub details including repository URL, branch, connector configuration, template counts, sync status, and metadata.`;

export const descChaosFault = `Chaos fault definition (e.g. pod-delete, network-loss, CPU stress). Supports list and get.`;

export const descChaosNetworkMap = `Network map (application map) for chaos blast radius visualization. Supports list and get.`;

export const descChaosGuardCondition = `ChaosGuard condition that defines criteria for experiment execution governance. Supports list and get.`;

export const descChaosGuardRule = `ChaosGuard rule that enforces governance policies on chaos experiment execution. Supports list and get.`;

export const descChaosRecommendation = `Chaos resilience recommendation based on experiment results. Supports list and get.`;

export const descChaosRisk = `Chaos risk assessment for services and infrastructure. Supports list and get.`;

export const descChaosFaultTemplate = `Versioned, structured chaos fault template stored in the database with full CRUD support.
Supports list, get, delete, plus revision history, variables, YAML retrieval, and revision comparison via execute actions.
Used for modern flows: experiment template builder, ChaosHub fault listing, and creating custom faults.`;

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

export const descListK8sInfra = `List Kubernetes chaos infrastructures`;
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

export const descListGuardConditions = `List ChaosGuard conditions`;
export const descGetGuardCondition = `Get ChaosGuard condition details`;

export const descListGuardRules = `List ChaosGuard rules`;
export const descGetGuardRule = `Get ChaosGuard rule details`;

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

// ── Body Schema Descriptions ─────────────────────────────────────────

export const descBodyExperimentRun = `Optional runtime inputs for the chaos experiment. Use chaos_experiment_variable list to discover required variables first.`;
export const descBodyNoBody = `No body required. Resource identified by path parameter.`;
export const descBodyCreateFromTemplate = `Chaos experiment from template`;
export const descBodyLoadtestDefinition = `Load test instance definition`;

// ── Field Descriptions ───────────────────────────────────────────────

export const descInputsetIdentity = `Optional inputset identity to use for the experiment run`;
export const descRuntimeInputs = `Runtime input variables: { experiment: [{name, value}], tasks: { taskName: [{name, value}] } }`;
export const descInfraType = `Filter by infrastructure type (e.g. Kubernetes, Linux)`;
export const descExperimentName = `Experiment name`;
export const descExperimentIdentity = `Experiment identity (auto-generated from name if omitted)`;
export const descInfraRef = `Infrastructure reference in format: environmentId/infraId`;
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

// Shared template + fault template fields

export const descHubIdentity = `Unique identifier for the chaos hub that owns the template. Use harness_list with resource_type=chaos_hub to find hub identities.`;
export const descTemplateSearch = `Search Templates by name or identity.`;
export const descTemplateIdentity = `Unique identifier for the template. Use harness_list to find template identities.`;
export const descRevision = `Specific revision of the template. If omitted, the latest revision is returned.`;
export const descRevision1 = `First revision identifier for comparison.`;
export const descRevision2 = `Second revision identifier for comparison.`;
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
