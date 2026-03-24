// Toolset description

export const DESC_TOOLSET_CHAOS = `Harness Chaos Engineering — experiments, probes, hubs, faults, ChaosGuard rules/conditions, Kubernetes and Linux infrastructure, network maps, recommendations, risks, and load tests`;

// Resource descriptions

export const DESC_CHAOS_EXPERIMENT = `Chaos experiment definition. Supports list, get, and run action. Use chaos_experiment_variable list to discover required runtime inputs before running.`;

export const DESC_CHAOS_EXPERIMENT_RUN = `Result of a chaos experiment run. Supports get.`;

export const DESC_CHAOS_PROBE = `Chaos resilience probe. Supports list, get, enable, and verify actions.`;

export const DESC_CHAOS_EXPERIMENT_TEMPLATE = `Template for creating chaos experiments. Supports list and get. Use create_from_template execute action to launch an experiment from a template.`;

export const DESC_CHAOS_EXPERIMENT_VARIABLE = `Variables for a chaos experiment. List variables to discover required runtime inputs before running an experiment.`;

export const DESC_CHAOS_INFRASTRUCTURE = `Linux/machine infrastructure registered for chaos experiments and load testing. For Kubernetes infrastructure, use chaos_k8s_infrastructure. Supports list.`;

export const DESC_CHAOS_LOADTEST = `Load test instance. Supports list, get, create, and delete. Run/stop via execute actions.`;

export const DESC_CHAOS_K8S_INFRASTRUCTURE = `Kubernetes infrastructure registered for chaos experiments. List uses POST with filter/sort body. Supports list, get, and check_health action.`;

export const DESC_CHAOS_HUB = `ChaosHub — a Git-backed repository that provides version-controlled chaos fault, experiment, probe, and action templates.
Every project includes a default Enterprise ChaosHub with pre-built templates; custom hubs can be created to bring in organization-specific chaos artifacts.
Supports list, get, create, update, and delete.
Returns hub details including repository URL, branch, connector configuration, template counts, sync status, and metadata.`;

export const DESC_CHAOS_FAULT = `Chaos fault definition (e.g. pod-delete, network-loss, CPU stress). Supports list and get.`;

export const DESC_CHAOS_NETWORK_MAP = `Network map (application map) for chaos blast radius visualization. Supports list and get.`;

export const DESC_CHAOS_GUARD_CONDITION = `ChaosGuard condition that defines criteria for experiment execution governance. Supports list and get.`;

export const DESC_CHAOS_GUARD_RULE = `ChaosGuard rule that enforces governance policies on chaos experiment execution. Supports list and get.`;

export const DESC_CHAOS_RECOMMENDATION = `Chaos resilience recommendation based on experiment results. Supports list and get.`;

export const DESC_CHAOS_RISK = `Chaos risk assessment for services and infrastructure. Supports list and get.`;

// Operation descriptions

export const DESC_OP_LIST_EXPERIMENTS = `List chaos experiments`;
export const DESC_OP_GET_EXPERIMENT = `Get chaos experiment details including revisions and recent run details`;

export const DESC_OP_GET_EXPERIMENT_RUN = `Get chaos experiment run result with step-level details, resiliency score, and fault data`;

export const DESC_OP_LIST_PROBES = `List chaos probes`;
export const DESC_OP_GET_PROBE = `Get chaos probe details`;

export const DESC_OP_LIST_EXPERIMENT_TEMPLATES = `List chaos experiment templates`;
export const DESC_OP_GET_EXPERIMENT_TEMPLATE = `Get detailed info about a chaos experiment template by identity.
Returns full template including name, identity, description, tags, kind, apiVersion, revision, isDefault,
and spec (infraType, faults, probes, actions, vertices, cleanupPolicy).
Requires hub_identity (chaos hub that owns the template — use harness_list with resource_type=chaos_hub to find hub identities).
Optional: revision (specific template revision; omit for latest).`;

export const DESC_OP_LIST_EXPERIMENT_VARIABLES = `List variables for a chaos experiment (experiment-level and task-level)`;

export const DESC_OP_LIST_LINUX_INFRA = `List chaos Linux infrastructures (load runners)`;

export const DESC_OP_LIST_LOADTESTS = `List load test instances`;
export const DESC_OP_GET_LOADTEST = `Get load test instance details`;
export const DESC_OP_CREATE_LOADTEST = `Create a sample load test instance`;
export const DESC_OP_DELETE_LOADTEST = `Delete a load test instance`;

export const DESC_OP_LIST_K8S_INFRA = `List Kubernetes chaos infrastructures`;
export const DESC_OP_GET_K8S_INFRA = `Get Kubernetes chaos infrastructure details`;

export const DESC_OP_LIST_HUBS = `List ChaosHubs (Git-connected repositories containing fault, experiment, probe, and action templates).
Returns hub details including repository info, connector configuration, template counts, and sync status.
Supports search, pagination, and cross-scope inclusion.`;
export const DESC_OP_GET_HUB = `Get a ChaosHub by its identity.
Returns full hub details including repository URL, branch, connector info, template counts, sync status, and metadata.`;

export const DESC_OP_CREATE_HUB = `Create a new ChaosHub in the given Harness scope (account, org, project).
The hub record stores a Git repo and connector reference that provides chaos fault, experiment, probe, and action templates.
connectorRef, repoName, and repoBranch are optional at creation but must be configured (via harness_update) before template operations can be performed on the hub.
The hub identity cannot be 'enterprise-chaoshub' as that is reserved for the default hub.
The target Git repository should contain experiments/ and faults/ directories for template storage.
Returns the created hub details including identity, name, repository info, connector configuration, and template counts.`;

export const DESC_OP_UPDATE_HUB = `Update the editable fields of a ChaosHub (name, description, tags) by its identity.
IMPORTANT: The API uses a replace-all model — all fields are fully replaced, not merged.
Omitted or empty values will overwrite and clear existing data.
To preserve existing description or tags when changing only some fields, fetch the current hub via harness_get first and pass through the values you want to keep.
Returns the updated hub details including identity, name, repository info, and template counts.`;

export const DESC_OP_DELETE_HUB = `Delete a ChaosHub by its identity.
The hub must have no fault templates, action templates, or probe templates — remove them before deleting.
At least one hub must remain after deletion. The default Enterprise ChaosHub cannot be deleted.
Returns a success message on completion.`;

export const DESC_OP_LIST_FAULTS = `List chaos faults`;
export const DESC_OP_GET_FAULT = `Get chaos fault details`;

export const DESC_OP_LIST_NETWORK_MAPS = `List chaos network maps`;
export const DESC_OP_GET_NETWORK_MAP = `Get chaos network map details`;

export const DESC_OP_LIST_GUARD_CONDITIONS = `List ChaosGuard conditions`;
export const DESC_OP_GET_GUARD_CONDITION = `Get ChaosGuard condition details`;

export const DESC_OP_LIST_GUARD_RULES = `List ChaosGuard rules`;
export const DESC_OP_GET_GUARD_RULE = `Get ChaosGuard rule details`;

export const DESC_OP_LIST_RECOMMENDATIONS = `List chaos recommendations`;
export const DESC_OP_GET_RECOMMENDATION = `Get chaos recommendation details`;

export const DESC_OP_LIST_RISKS = `List chaos risks`;
export const DESC_OP_GET_RISK = `Get chaos risk details`;

// Action descriptions

export const DESC_ACTION_RUN_EXPERIMENT = `Run a chaos experiment`;
export const DESC_ACTION_ENABLE_PROBE = `Enable a chaos probe`;
export const DESC_ACTION_VERIFY_PROBE = `Verify a chaos probe configuration`;
export const DESC_ACTION_CREATE_FROM_TEMPLATE = `Create a chaos experiment from a template`;
export const DESC_ACTION_RUN_LOADTEST = `Run a load test instance`;
export const DESC_ACTION_STOP_LOADTEST = `Stop a running load test`;
export const DESC_ACTION_CHECK_K8S_HEALTH = `Check health of a Kubernetes chaos infrastructure`;

// Body schema descriptions

export const DESC_BODY_EXPERIMENT_RUN = `Optional runtime inputs for the chaos experiment. Use chaos_experiment_variable list to discover required variables first.`;
export const DESC_BODY_NO_BODY_PROBE = `No body required. Probe is identified by path parameter.`;
export const DESC_BODY_CREATE_FROM_TEMPLATE = `Chaos experiment from template`;
export const DESC_BODY_LOADTEST_DEFINITION = `Load test instance definition`;
export const DESC_BODY_NO_BODY_LOADTEST = `No body required. Load test is identified by path parameter.`;
export const DESC_BODY_NO_BODY_RUN = `No body required. Run is identified by path parameter.`;
export const DESC_BODY_NO_BODY_INFRA = `No body required. Infrastructure is identified by path parameter.`;

// Field descriptions

export const DESC_FIELD_INPUTSET_IDENTITY = `Optional inputset identity to use for the experiment run`;
export const DESC_FIELD_RUNTIME_INPUTS = `Runtime input variables: { experiment: [{name, value}], tasks: { taskName: [{name, value}] } }`;
export const DESC_FIELD_HUB_IDENTITY_LIST = `Chaos hub identity (required for listing templates)`;
export const DESC_FIELD_HUB_IDENTITY = `Chaos hub identity`;
export const DESC_FIELD_INFRASTRUCTURE_TYPE = `Filter by infrastructure type (e.g. Kubernetes, Linux)`;
export const DESC_FIELD_EXPERIMENT_NAME = `Experiment name`;
export const DESC_FIELD_EXPERIMENT_IDENTITY = `Experiment identity (auto-generated from name if omitted)`;
export const DESC_FIELD_INFRA_REF = `Infrastructure reference in format: environmentId/infraId`;
export const DESC_FIELD_EXPERIMENT_ID = `Chaos experiment ID to list variables for`;
export const DESC_FIELD_INFRA_STATUS = `Filter by infra status: Active (default) or All`;
export const DESC_FIELD_LOADTEST_NAME = `Load test name`;
export const DESC_FIELD_LOADTEST_TYPE = `Load test type`;

export const DESC_FIELD_HUB_IDENTITY_EXACT = `The unique identity of the ChaosHub. Use harness_list with resource_type=chaos_hub to find hub identities.`;
export const DESC_FIELD_HUB_NAME = `Display name for the ChaosHub.`;
export const DESC_FIELD_HUB_NAME_UPDATE = `Updated display name for the ChaosHub.`;
export const DESC_FIELD_HUB_DESCRIPTION = `Description of the ChaosHub.`;
export const DESC_FIELD_HUB_DESCRIPTION_UPDATE = `Updated description. If omitted/empty, existing description is cleared. Pass current value from harness_get to preserve.`;
export const DESC_FIELD_HUB_TAGS = `Comma-separated list of tags for the ChaosHub.`;
export const DESC_FIELD_HUB_TAGS_REPLACE = `Comma-separated list of tags. Replaces all existing tags; omit to remove all. Pass current values from harness_get to preserve.`;
export const DESC_FIELD_CONNECTOR_REF = `Harness Git connector reference for repository authentication (e.g. 'account.myGitHubConnector'). Supports GitHub, GitLab, and Bitbucket connectors. Optional at creation, required before template operations.`;
export const DESC_FIELD_REPO_NAME = `Name of the Git repository. Optional at creation, required before template operations.`;
export const DESC_FIELD_REPO_BRANCH = `Git branch for the ChaosHub. Optional at creation, required before template operations.`;
export const DESC_FIELD_SEARCH_HUBS = `Search hubs by name (case-insensitive).`;
export const DESC_FIELD_INCLUDE_ALL_SCOPE_HUBS = `When true, returns hubs from all scopes (account, org, project). Defaults to false (project scope only).`;

