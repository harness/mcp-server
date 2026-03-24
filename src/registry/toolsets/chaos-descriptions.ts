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

export const DESC_CHAOS_HUB = `Chaos hub for sharing experiment templates and faults. Supports list and get.`;

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

export const DESC_OP_LIST_HUBS = `List chaos hubs`;
export const DESC_OP_GET_HUB = `Get chaos hub details`;

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
