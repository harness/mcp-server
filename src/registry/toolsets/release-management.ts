/**
 * Release Management (RMG) — orchestration definitions and release execution monitoring.
 * Paths use the hosted `/gateway/rmg/api/...` prefix. mcpServerInternal rewrites
 * that prefix to the service-native `/api/...` path and injects service authentication.
 * Account via Harness-Account header (headerBasedScoping).
 */
import type { BodySchema, ParamsSchema, ToolsetDefinition } from "../types.js";
import {
  normalizeReleaseActivityExecutionInput,
  normalizeReleaseTaskLimit,
  releaseActivityExecutionListExtract,
  releaseActivityInputGetExtract,
  releaseActivityOutputGetExtract,
  releaseExecutionActivityOutputPath,
  releaseExecutionPhaseInputPath,
  releaseExecutionPhaseOutputPath,
  releaseFillScopeFromConfig,
  releaseGetExtract,
  releaseInputGetExtract,
  releaseListBody,
  releaseListExtract,
  releaseListPreflight,
  releasePhaseInputGetExtract,
  releasePhaseListExtract,
  releasePhaseOutputGetExtract,
  releaseTaskListExtract,
  rmgYamlEntityDeleteExtract,
  rmgYamlEntityExtract,
  RMG_DEFAULT_DAYS_BACK,
  RMG_DAYS_FORWARD,
  RMG_DEFAULT_TASK_LIMIT,
  RMG_MAX_DAYS_BACK,
  RMG_MAX_TASK_LIMIT,
  springPageExtract,
  yamlWriteBody,
} from "../extractors.js";

const RMG = "/gateway/rmg/api";

const RELEASE_STATUSES = ["Running", "Success", "Failed", "Scheduled", "Paused", "Aborted"] as const;

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "SUCCEEDED", "FAILED", "BLOCKED"] as const;

const ACTIVITY_EXECUTION_STATUSES = [
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "QUEUED",
  "SCHEDULED",
  "ON_HOLD",
  "OUTPUT_WAITING",
  "RETRIED",
  "IGNORED",
  "SKIPPED",
] as const;

const ACTIVITY_EXECUTION_TYPES = ["PIPELINE", "SUBPROCESS", "MANUAL"] as const;

const ACTIVITY_SORT_FIELDS = [
  "start_ts",
  "end_ts",
  "created_at",
  "last_updated_at",
  "name",
  "identifier",
  "status",
  "type",
] as const;

const releaseExecutionPhaseOutputParamsSchema: ParamsSchema = {
  fields: [
    {
      name: "phase_identifier",
      required: true,
      description:
        "Phase identifier from harness_list resource_type=release_execution_phase (each phase has an `identifier` field)",
    },
    {
      name: "phase_execution_id",
      required: false,
      description: "Optional phase execution UUID when multiple phase execution records exist",
    },
  ],
};

const releaseExecutionActivityOutputParamsSchema: ParamsSchema = {
  fields: [
    {
      name: "phase_identifier",
      required: true,
      description: "Phase identifier containing the activity",
    },
    {
      name: "activity_identifier",
      required: true,
      description:
        "Activity identifier from harness_list resource_type=release_execution_activity (each item has an `identifier` field)",
    },
    {
      name: "activity_execution_id",
      required: false,
      description: "Optional activity execution UUID to pin a specific runtime activity row",
    },
  ],
};

const yamlBodySchema: BodySchema = {
  description:
    "YAML definition for create/update. Pass body.yaml (required). Optional body.git_details for remote/git-backed entities. " +
    "Use harness_schema(resource_type='release_process'|'release_activity') for the full JSON Schema.",
  fields: [
    {
      name: "yaml",
      type: "yaml",
      required: true,
      description: "Full orchestration YAML string for the process or activity",
    },
    {
      name: "git_details",
      type: "object",
      required: false,
      description:
        "Git metadata when store is remote: store_type, repo, path, connector_ref, branch, commit_msg, is_new_branch, base_branch",
    },
  ],
};

const gitBranchGetParams: ParamsSchema = {
  fields: [
    {
      name: "git_branch",
      required: false,
      description:
        "Optional git branch for remote/git-backed YAML. Pass via params on harness_get.",
    },
  ],
};

export const releaseManagementToolset: ToolsetDefinition = {
  name: "release-management",
  displayName: "Release Management",
  description:
    "Harness Release Management (RMG) — orchestration definitions (process/activity YAML) and release execution " +
    "monitoring (search releases, get release details, list phases/tasks/activity executions, get outputs). " +
    "Definitions: list/get/create/update/delete. " +
    "Execution: harness_list resource_type=release (org/project scoped), harness_get release by id/slug, " +
    "harness_list release_execution_phase/release_execution_task/release_execution_activity (release_id required), " +
    "harness_get release_input|release_execution_phase_input|release_execution_phase_output|release_execution_activity_output|release_execution_activity_input. " +
    "YAML JSON Schema: harness_schema(resource_type='release_process'|'release_activity') or GET {rmgBase}/api/yamlSchema?entityType=PROCESS|ACTIVITY.",
  optIn: false,
  resources: [
    {
      resourceType: "release_process",
      displayName: "Release Process",
      description:
        "Orchestration process definition (RMG). A process is a multi-phase release plan composed of activities. " +
        "Use harness_list to discover processes, harness_get for YAML, harness_create/update with body.yaml. " +
        "Search aliases: orchestration process, RMG process, release plan.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["process_id"],
      searchAliases: ["orchestration process", "rmg process", "release plan", "process yaml"],
      listFilterFields: [
        { name: "search_term", description: "Filter processes by name or identifier substring" },
        { name: "sort", description: "Sort expression (API sort query param)" },
      ],
      relatedResources: [
        {
          resourceType: "release_activity",
          relationship: "composed_of",
          description: "Processes reference activities as phase steps",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${RMG}/orchestration/process/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: releaseFillScopeFromConfig,
          queryParams: {
            search_term: "searchTerm",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: springPageExtract,
          description: "List orchestration processes (paginated summary metadata)",
        },
        get: {
          method: "GET",
          path: `${RMG}/orchestration/process/{identifier}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: releaseFillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          queryParams: { git_branch: "git_branch" },
          paramsSchema: gitBranchGetParams,
          responseExtractor: rmgYamlEntityExtract,
          description: "Get orchestration process YAML and identifier by process_id",
        },
        create: {
          method: "POST",
          path: `${RMG}/orchestration/process`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: releaseFillScopeFromConfig,
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: rmgYamlEntityExtract,
          description: "Create an orchestration process from YAML",
        },
        update: {
          method: "PUT",
          path: `${RMG}/orchestration/process/{identifier}`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: releaseFillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: rmgYamlEntityExtract,
          description: "Update an orchestration process YAML (full replacement)",
        },
        delete: {
          method: "DELETE",
          path: `${RMG}/orchestration/process/{identifier}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: releaseFillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          responseExtractor: rmgYamlEntityDeleteExtract,
          description: "Delete an orchestration process by process_id",
        },
      },
    },
    {
      resourceType: "release_activity",
      displayName: "Release Activity",
      description:
        "Orchestration activity definition (RMG) — a reusable step (pipeline, subprocess, or manual) " +
        "referenced by release processes. Use harness_list/get/create/update/delete with body.yaml. " +
        "Use harness_schema(resource_type='release_activity') for the full JSON Schema. " +
        "Search aliases: orchestration activity, RMG activity, release step.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["activity_id"],
      searchAliases: ["orchestration activity", "rmg activity", "release step", "activity yaml"],
      listFilterFields: [
        { name: "search_term", description: "Filter activities by name or identifier substring" },
        { name: "sort", description: "Sort expression (API sort query param)" },
      ],
      relatedResources: [
        {
          resourceType: "release_process",
          relationship: "used_by",
          description: "Activities are composed into release processes",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${RMG}/orchestration/activity/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: releaseFillScopeFromConfig,
          queryParams: {
            search_term: "searchTerm",
            sort: "sort",
            page: "page",
            size: "size",
          },
          responseExtractor: springPageExtract,
          description: "List orchestration activities (paginated summary metadata)",
        },
        get: {
          method: "GET",
          path: `${RMG}/orchestration/activity/{identifier}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: releaseFillScopeFromConfig,
          pathParams: { activity_id: "identifier" },
          queryParams: { git_branch: "git_branch" },
          paramsSchema: gitBranchGetParams,
          responseExtractor: rmgYamlEntityExtract,
          description: "Get orchestration activity YAML and identifier by activity_id",
        },
        create: {
          method: "POST",
          path: `${RMG}/orchestration/activity`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: releaseFillScopeFromConfig,
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: rmgYamlEntityExtract,
          description: "Create an orchestration activity from YAML",
        },
        update: {
          method: "PUT",
          path: `${RMG}/orchestration/activity/{identifier}`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: releaseFillScopeFromConfig,
          pathParams: { activity_id: "identifier" },
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: rmgYamlEntityExtract,
          description: "Update an orchestration activity YAML (full replacement)",
        },
        delete: {
          method: "DELETE",
          path: `${RMG}/orchestration/activity/{identifier}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: releaseFillScopeFromConfig,
          pathParams: { activity_id: "identifier" },
          responseExtractor: rmgYamlEntityDeleteExtract,
          description: "Delete an orchestration activity by activity_id",
        },
      },
    },
    {
      resourceType: "release",
      displayName: "Release Execution",
      description:
        "A running or completed release instance (orchestration execution). harness_list returns releases in the " +
        `current org/project whose expected start falls in the last ${RMG_DEFAULT_DAYS_BACK} days (override with days_back, ` +
        "or start_ts/end_ts); narrow further with search_term and status. " +
        "The list item `id` field or UI URL slug (e.g. identifier-1.0.0-abc) can be used as release_id. " +
        "Search aliases: active release, release execution, RMG release.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["active release", "release execution", "rmg release", "running release"],
      listFilterFields: [
        {
          name: "search_term",
          description: "Search by release name or identifier (substring match)",
        },
        {
          name: "status",
          description:
            "Filter by release status (applied client-side on the current page only; the endpoint has no status param). " +
            "Empty results can still exist on other pages — keep paging with the same size.",
          enum: [...RELEASE_STATUSES],
        },
        {
          name: "days_back",
          type: "number",
          description: `Days of history to search (default ${RMG_DEFAULT_DAYS_BACK}, max ${RMG_MAX_DAYS_BACK}; includes ${RMG_DAYS_FORWARD} days forward). Ignored when start_ts/end_ts are set.`,
        },
        {
          name: "start_ts",
          type: "number",
          description: "Window start as expected start timestamp (epoch ms) — overrides days_back",
        },
        {
          name: "end_ts",
          type: "number",
          description: "Window end as expected start timestamp (epoch ms) — overrides days_back",
        },
      ],
      relatedResources: [
        {
          resourceType: "release_execution_phase",
          relationship: "has_phases",
          description:
            "List execution phases via harness_list(resource_type=release_execution_phase, filters={ release_id })",
        },
        {
          resourceType: "release_execution_task",
          relationship: "has_tasks",
          description: "List manual execution tasks via harness_list(resource_type=release_execution_task, filters={ release_id })",
        },
        {
          resourceType: "release_execution_activity",
          relationship: "has_activity_executions",
          description:
            "List activity executions via harness_list(resource_type=release_execution_activity, filters={ release_id })",
        },
        {
          resourceType: "release_execution_phase_input",
          relationship: "has_phase_inputs",
          description: "Get phase inputs via harness_get resource_type=release_execution_phase_input",
        },
        {
          resourceType: "release_execution_phase_output",
          relationship: "has_phase_outputs",
          description: "Get phase outputs via harness_get resource_type=release_execution_phase_output",
        },
        {
          resourceType: "release_execution_activity_output",
          relationship: "has_activity_outputs",
          description: "Get activity outputs via harness_get resource_type=release_execution_activity_output",
        },
        {
          resourceType: "release_input",
          relationship: "has_release_input",
          description: "Get release input YAML via harness_get resource_type=release_input",
        },
        {
          resourceType: "release_process",
          relationship: "defined_by",
          description: "Release processes define the orchestration plan executed as releases",
        },
      ],
      operations: {
        list: {
          method: "POST",
          path: `${RMG}/release/list`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            size: "size",
            search_term: "searchTerm",
            start_ts: "expectedStartTs",
            end_ts: "expectedEndTs",
          },
          staticQueryParams: { type: "Orchestration" },
          skipScopeBodyInjection: true,
          preflight: releaseListPreflight,
          bodyBuilder: releaseListBody,
          responseExtractor: releaseListExtract,
          description:
            "List releases for the current scope within an expected-start time window, " +
            "optionally filtered by search_term and status. Status matching is client-side on the current page; " +
            "when status is set the response includes _hint and a page-local total.",
        },
        get: {
          method: "GET",
          path: `${RMG}/release/{releaseId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { release_id: "releaseId" },
          responseExtractor: releaseGetExtract,
          description:
            "Get release details by release_id (UUID from harness_list, or UI URL slug like identifier-1.0.0-abc)",
        },
      },
    },
    {
      resourceType: "release_execution_phase",
      displayName: "Release Execution Phase",
      description:
        "An execution phase within a release (status, activity progress, timestamps). Requires release_id " +
        "(from harness_list release `id`, UI URL slug, or filters.release_id). Paste an RMG phases URL to auto-fill.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: [],
      searchAliases: ["release phase", "execution phase", "rmg phase"],
      listFilterFields: [
        {
          name: "release_id",
          required: true,
          description: "Release id or UI slug (from harness_list `id` or RMG URL path segment)",
        },
        {
          name: "status",
          description: "Optional filter by phase status",
        },
      ],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
        {
          resourceType: "release_execution_phase_input",
          relationship: "consumes_inputs",
          description: "Get phase inputs via harness_get resource_type=release_execution_phase_input",
        },
        {
          resourceType: "release_execution_phase_output",
          relationship: "produces_outputs",
          description: "Get phase outputs via harness_get resource_type=release_execution_phase_output",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${RMG}/orchestration/execution/{releaseId}/phases`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { release_id: "releaseId" },
          queryParams: { status: "status" },
          responseExtractor: releasePhaseListExtract,
          description: "List execution phases for a release (requires release_id)",
        },
      },
    },
    {
      resourceType: "release_execution_task",
      displayName: "Release Execution Task",
      description:
        "Manual execution tasks for a release (TODO, IN_PROGRESS, SUCCEEDED, FAILED, BLOCKED). Requires release_id " +
        "(UUID from harness_list release). Use harness_list with filters.release_id; optional status and limit filters.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["release task", "manual task", "execution task"],
      listFilterFields: [
        {
          name: "release_id",
          required: true,
          description: "Release id or UI slug (from harness_list `id` or RMG URL path segment)",
        },
        {
          name: "status",
          description: "Filter tasks by status",
          enum: [...TASK_STATUSES],
        },
        {
          name: "limit",
          type: "number",
          description: `Max tasks to return (default ${RMG_DEFAULT_TASK_LIMIT}, max ${RMG_MAX_TASK_LIMIT}; harness_list size also accepted)`,
        },
        {
          name: "cursor",
          description: "Cursor for the next page (from previous response pagination.next_cursor)",
        },
      ],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${RMG}/release/{releaseId}/tasks`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { release_id: "releaseId" },
          queryParams: {
            limit: "limit",
            status: "status",
            cursor: "cursor",
          },
          preflight: async ({ input }) => {
            normalizeReleaseTaskLimit(input);
          },
          responseExtractor: releaseTaskListExtract,
          description: "List manual tasks for a release (requires release_id)",
        },
      },
    },
    {
      resourceType: "release_execution_activity",
      displayName: "Release Activity Execution",
      description:
        "Runtime activity executions within a release (pipeline, subprocess, or manual steps). Requires release_id. " +
        "Supports pagination and filters: status (comma-separated OR), activity_type, phase_identifier, time range. " +
        "Default sort: start_ts desc. Search aliases: release activity run, execution activity.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["release activity execution", "execution activity", "activity run"],
      listFilterFields: [
        {
          name: "release_id",
          required: true,
          description: "Release id or UI slug (from harness_list `id` or RMG URL path segment)",
        },
        {
          name: "status",
          description: "Comma-separated statuses (OR logic)",
          enum: [...ACTIVITY_EXECUTION_STATUSES],
        },
        {
          name: "activity_type",
          description: "Comma-separated activity types",
          enum: [...ACTIVITY_EXECUTION_TYPES],
        },
        {
          name: "phase_identifier",
          description: "Filter to activities in a specific phase",
        },
        {
          name: "sort_field",
          description: "Sort field",
          enum: [...ACTIVITY_SORT_FIELDS],
        },
        {
          name: "sort_direction",
          description: "Sort direction",
          enum: ["asc", "desc"],
        },
        {
          name: "start_ts",
          type: "number",
          description: "Include activities with start_ts >= this value (epoch ms)",
        },
        {
          name: "end_ts",
          type: "number",
          description: "Include activities with start_ts <= this value (epoch ms)",
        },
      ],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
        {
          resourceType: "release_execution_phase",
          relationship: "in_phase",
          description: "Filter by phase_identifier from release_execution_phase list",
        },
        {
          resourceType: "release_execution_activity_output",
          relationship: "produces_outputs",
          description: "Get activity outputs via harness_get resource_type=release_execution_activity_output",
        },
        {
          resourceType: "release_execution_activity_input",
          relationship: "consumes_inputs",
          description:
            "Get activity inputs via harness_get resource_type=release_execution_activity_input " +
            "(requires activityExecutionId from list item, not YAML activity identifier)",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: `${RMG}/release/{releaseId}/execution/activities`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { release_id: "releaseId" },
          queryParams: {
            page: "page",
            size: "size",
            sort: "sort",
            status: "status",
            activity_type: "type",
            phase_identifier: "phaseIdentifier",
            start_ts: "startTs",
            end_ts: "endTs",
          },
          preflight: async ({ input }) => {
            normalizeReleaseActivityExecutionInput(input);
          },
          responseExtractor: releaseActivityExecutionListExtract,
          description:
            "List paginated activity executions for a release. Default page=0, size=20, sort=start_ts desc.",
        },
      },
    },
    {
      resourceType: "release_execution_phase_output",
      displayName: "Release Execution Phase Output",
      description:
        "Execution outputs (variables, artifacts, runtime data) for a release phase. " +
        "Use harness_get with resource_id=release id/slug and params.phase_identifier.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["release phase output", "phase output", "execution variable"],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
        {
          resourceType: "release_execution_phase",
          relationship: "from_phase",
          description: "phase_identifier comes from release_execution_phase list",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${RMG}/orchestration/execution/release/{releaseId}/phase/{phaseIdentifier}/output`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input) => releaseExecutionPhaseOutputPath(input),
          queryParams: { phase_execution_id: "phaseExecutionId" },
          paramsSchema: releaseExecutionPhaseOutputParamsSchema,
          responseExtractor: releasePhaseOutputGetExtract,
          description:
            "Get execution outputs for a phase. resource_id=release id/slug; params.phase_identifier required. " +
            "Optional params.phase_execution_id disambiguates multiple phase execution records.",
        },
      },
    },
    {
      resourceType: "release_execution_phase_input",
      displayName: "Release Execution Phase Input",
      description:
        "Runtime input values for a release phase execution. Use harness_get with resource_id=release id/slug " +
        "and params.phase_identifier (YAML identifier from harness_list release_execution_phase). " +
        "Optional params.phase_execution_id pins a specific phase execution row.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["release phase input", "phase input", "execution input"],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
        {
          resourceType: "release_execution_phase",
          relationship: "from_phase",
          description: "phase_identifier comes from release_execution_phase list",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${RMG}/orchestration/execution/release/{releaseId}/phase/{phaseIdentifier}/input`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input) => releaseExecutionPhaseInputPath(input),
          queryParams: { phase_execution_id: "phaseExecutionId" },
          paramsSchema: releaseExecutionPhaseOutputParamsSchema,
          responseExtractor: releasePhaseInputGetExtract,
          description:
            "Get execution inputs for a phase. resource_id=release id/slug; params.phase_identifier required. " +
            "Optional params.phase_execution_id disambiguates multiple phase execution records.",
        },
      },
    },
    {
      resourceType: "release_execution_activity_output",
      displayName: "Release Execution Activity Output",
      description:
        "Execution outputs for a specific activity within a release phase. " +
        "Use harness_get with resource_id=release id/slug, params.phase_identifier, and params.activity_identifier " +
        "(YAML identifiers from release_execution_activity list).",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["release activity output", "activity output", "execution variable"],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
        {
          resourceType: "release_execution_activity",
          relationship: "from_activity",
          description: "activity_identifier comes from release_execution_activity list",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${RMG}/orchestration/execution/release/{releaseId}/phase/{phaseIdentifier}/activity/{activityIdentifier}/output`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input) => releaseExecutionActivityOutputPath(input),
          queryParams: { activity_execution_id: "activityExecutionId" },
          paramsSchema: releaseExecutionActivityOutputParamsSchema,
          responseExtractor: releaseActivityOutputGetExtract,
          description:
            "Get execution outputs for an activity. resource_id=release id/slug; " +
            "params.phase_identifier and params.activity_identifier required. " +
            "Optional params.activity_execution_id pins a specific runtime activity row.",
        },
      },
    },
    {
      resourceType: "release_input",
      displayName: "Release Execution Input",
      description:
        "Latest release input YAML for a release (global inputs). For per-phase runtime inputs use " +
        "harness_get resource_type=release_execution_phase_input with release id/slug and params.phase_identifier.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["release_id"],
      searchAliases: ["release input", "release input yaml", "execution input"],
      relatedResources: [
        {
          resourceType: "release",
          relationship: "belongs_to",
          description: "Parent release instance",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${RMG}/orchestration/execution/releaseInput/{releaseId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { release_id: "releaseId" },
          responseExtractor: releaseInputGetExtract,
          description:
            "Get latest release input YAML. resource_id=release id/slug. Returns release_id, process_execution_id, yaml.",
        },
      },
    },
    {
      resourceType: "release_execution_activity_input",
      displayName: "Release Execution Activity Input",
      description:
        "Runtime input values for an activity execution. Requires activityExecutionId (UUID) from " +
        "harness_list release_execution_activity — not the YAML activity identifier.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["activity_execution_id"],
      searchAliases: ["release activity input", "activity input", "execution input"],
      relatedResources: [
        {
          resourceType: "release_execution_activity",
          relationship: "from_activity",
          description: "activityExecutionId comes from release_execution_activity list item",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: `${RMG}/orchestration/execution/activity/{activityExecutionId}/input`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { activity_execution_id: "activityExecutionId" },
          responseExtractor: releaseActivityInputGetExtract,
          description:
            "Get activity execution inputs. resource_id=activityExecutionId from list item field activityExecutionId.",
        },
      },
    },
  ],
};
