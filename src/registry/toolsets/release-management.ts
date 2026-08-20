/**
 * Release Management (RMG) — orchestration definitions and release execution monitoring.
 * Paths are service-native `/api/...`. Base URL is `${HARNESS_BASE_URL}/gateway/rmg`.
 * Account via Harness-Account header (headerBasedScoping).
 */
import type { BodySchema, ParamsSchema, PreflightContext, ToolsetDefinition } from "../types.js";
import { passthrough, springPageExtract } from "../extractors.js";

const RMG = "/api";

const RELEASE_STATUSES = ["Running", "Success", "Failed", "Scheduled", "Paused", "Aborted"] as const;

const DEFAULT_DAYS_BACK = 30;
const MAX_DAYS_BACK = 365;
/** Days of look-ahead included in the window so scheduled releases stay visible. */
const DAYS_FORWARD = 7;
const DAY_MS = 86_400_000;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** First key holding an array — RMG list payloads vary by gateway version. */
function firstArrayAt(
  source: Record<string, unknown>,
  keys: readonly string[],
): Array<Record<string, unknown>> | undefined {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }
  return undefined;
}

/**
 * Copy HARNESS_ORG / HARNESS_PROJECT into input when scopeOptional resources
 * omit explicit org_id/project_id (same pattern as release list preflight).
 */
async function fillScopeFromConfig({ input, registry }: PreflightContext): Promise<void> {
  if (!input.org_id && registry.orgId) input.org_id = registry.orgId;
  if (!input.project_id && registry.projectId) input.project_id = registry.projectId;
}

/**
 * Resolve the effective scope and time window before the body/query are built.
 * The registry only merges HARNESS_ORG/HARNESS_PROJECT into `input` when the
 * caller passes `resource_scope`, but the body always needs them.
 */
async function releaseListPreflight(ctx: PreflightContext): Promise<void> {
  await fillScopeFromConfig(ctx);
  const { input } = ctx;
  const now = Date.now();
  const daysBack = clampInt(input.days_back, 1, MAX_DAYS_BACK, DEFAULT_DAYS_BACK);
  if (input.start_ts === undefined || input.start_ts === "") {
    input.start_ts = now - daysBack * DAY_MS;
  }
  if (input.end_ts === undefined || input.end_ts === "") {
    input.end_ts = now + DAYS_FORWARD * DAY_MS;
  }
}

/** POST /api/release/list — scope travels in the body as `scopes`, not as query params. */
function releaseListBody(input: Record<string, unknown>): Record<string, unknown> {
  const scope: Record<string, string> = {};
  if (typeof input.org_id === "string" && input.org_id) scope.orgIdentifier = input.org_id;
  if (typeof input.project_id === "string" && input.project_id) {
    scope.projectIdentifier = input.project_id;
  }
  return { scopes: Object.keys(scope).length > 0 ? [scope] : [] };
}

/**
 * Normalize the list payload and apply the optional status filter client-side
 * (the endpoint takes no status param). Status matching is case-insensitive
 * because RMG returns both `Running` and `RUNNING` depending on the field.
 */
function releaseListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const root = asRecord(raw);
  const payload = Array.isArray(raw)
    ? { content: raw }
    : firstArrayAt(root, ["content", "releases", "items"])
      ? root
      : asRecord(root.data);

  let items = firstArrayAt(payload, ["content", "releases", "items"]) ?? [];
  const pageItemCount = items.length;

  const requestedStatus = typeof input?.status === "string" ? input.status.trim() : "";
  if (requestedStatus) {
    const wanted = requestedStatus.toLowerCase();
    items = items.filter((rel) => {
      const status = rel.status ?? rel.releaseStatus;
      return typeof status === "string" && status.toLowerCase() === wanted;
    });
  }

  const total = ["totalElements", "totalItems", "totalCount", "total"]
    .map((key) => payload[key])
    .find((value): value is number => typeof value === "number");

  return {
    items,
    total: requestedStatus ? items.length : (total ?? items.length),
    ...(requestedStatus
      ? {
          status_filter: requestedStatus,
          _hint:
            "status is filtered client-side on this page only; total is the filtered count for this page, " +
            `not the account (${pageItemCount} unfiltered items on this page). ` +
            "Increment page (keep size and other filters) if matches may exist on later pages.",
        }
      : {}),
  };
}

/** Flatten GET /api/release/{id} → { release: releaseInfo, ... }. */
function releaseGetExtract(raw: unknown): unknown {
  const r = raw as { releaseInfo?: Record<string, unknown> };
  if (r.releaseInfo && typeof r.releaseInfo === "object") {
    return { release: r.releaseInfo };
  }
  return raw;
}

const DEFAULT_TASK_LIMIT = 50;
const MAX_TASK_LIMIT = 100;

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

function splitCsvFilter(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/** Normalize sort/status/type filters before query param mapping (GET list). */
function normalizeReleaseActivityExecutionInput(input: Record<string, unknown>): void {
  const sortField =
    typeof input.sort_field === "string" && input.sort_field.length > 0
      ? input.sort_field
      : "start_ts";
  const sortDirection = input.sort_direction === "asc" ? "asc" : "desc";
  input.sort = [sortField, sortDirection];

  const statusParts = splitCsvFilter(input.status);
  if (statusParts) input.status = statusParts;

  const typeParts = splitCsvFilter(input.activity_type);
  if (typeParts) input.activity_type = typeParts;
}

function normalizeReleaseTaskLimit(input: Record<string, unknown>): void {
  if (input.limit === undefined && input.size !== undefined) {
    input.limit = input.size;
  }
  input.limit = clampInt(input.limit, 1, MAX_TASK_LIMIT, DEFAULT_TASK_LIMIT);
}

/** GET /api/release/{id}/tasks → standard list envelope with cursor pagination. */
function releaseTaskListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const r = raw as {
    tasks?: unknown[];
    nextRequest?: { cursor?: string };
    last?: boolean;
  };
  const items = Array.isArray(r.tasks) ? r.tasks : [];
  const limit = clampInt(input?.limit ?? input?.size, 1, MAX_TASK_LIMIT, DEFAULT_TASK_LIMIT);
  return {
    items,
    total: items.length,
    limit_applied: limit,
    status_filter: typeof input?.status === "string" && input.status ? input.status : "all",
    pagination: {
      cursor: typeof input?.cursor === "string" ? input.cursor : undefined,
      next_cursor: r.nextRequest?.cursor,
      last: r.last,
    },
  };
}

/** GET /api/release/{id}/execution/activities — Spring page at root. */
function releaseActivityExecutionListExtract(raw: unknown): unknown {
  const r = raw as {
    content?: unknown[];
    totalElements?: number;
    totalPages?: number;
    size?: number;
    number?: number;
    numberOfElements?: number;
    first?: boolean;
    last?: boolean;
  };
  const items = Array.isArray(r.content) ? r.content : [];
  return {
    items,
    total: typeof r.totalElements === "number" ? r.totalElements : items.length,
    pagination: {
      page: r.number,
      size: r.size,
      total_pages: r.totalPages,
      total_elements: r.totalElements,
      number_of_elements: r.numberOfElements,
      first: r.first,
      last: r.last,
    },
  };
}

function requireReleaseAndPhase(input: Record<string, unknown>): { releaseId: string; phaseId: string } {
  const releaseId = input.release_id;
  const phaseId = input.phase_identifier;
  if (typeof releaseId !== "string" || !releaseId) {
    throw new Error("release_id is required");
  }
  if (typeof phaseId !== "string" || !phaseId) {
    throw new Error(
      "phase_identifier is required — pass via params on harness_get (from harness_list release_execution_phase)",
    );
  }
  return { releaseId, phaseId };
}

function releaseExecutionPhaseOutputPath(input: Record<string, unknown>): string {
  const { releaseId, phaseId } = requireReleaseAndPhase(input);
  const enc = encodeURIComponent;
  return `${RMG}/orchestration/execution/release/${enc(releaseId)}/phase/${enc(phaseId)}/output`;
}

function releaseExecutionPhaseInputPath(input: Record<string, unknown>): string {
  const { releaseId, phaseId } = requireReleaseAndPhase(input);
  const enc = encodeURIComponent;
  return `${RMG}/orchestration/execution/release/${enc(releaseId)}/phase/${enc(phaseId)}/input`;
}

function releaseExecutionActivityOutputPath(input: Record<string, unknown>): string {
  const { releaseId, phaseId } = requireReleaseAndPhase(input);
  const activityId = input.activity_identifier;
  if (typeof activityId !== "string" || !activityId) {
    throw new Error(
      "activity_identifier is required — pass via params on harness_get (from harness_list release_execution_activity)",
    );
  }
  const enc = encodeURIComponent;
  return `${RMG}/orchestration/execution/release/${enc(releaseId)}/phase/${enc(phaseId)}/activity/${enc(activityId)}/output`;
}

function releasePhaseIoGetExtract(
  raw: unknown,
  input: Record<string, unknown> | undefined,
  field: "inputs" | "outputs",
): unknown {
  const r = raw as { inputs?: unknown[]; outputs?: unknown[] };
  const items = Array.isArray(r[field]) ? r[field] : [];
  return {
    [field]: items,
    phase_identifier: input?.phase_identifier,
    [`total_${field}`]: items.length,
  };
}

function releasePhaseOutputGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  return releasePhaseIoGetExtract(raw, input, "outputs");
}

function releasePhaseInputGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  return releasePhaseIoGetExtract(raw, input, "inputs");
}

function releaseActivityOutputGetExtract(
  raw: unknown,
  input: Record<string, unknown> | undefined,
): unknown {
  const r = raw as { outputs?: unknown[] };
  const items = Array.isArray(r.outputs) ? r.outputs : [];
  return {
    outputs: items,
    phase_identifier: input?.phase_identifier,
    activity_identifier: input?.activity_identifier,
    total_outputs: items.length,
  };
}
function releaseActivityInputGetExtract(raw: unknown): unknown {
  const r = raw as { inputs?: unknown[] };
  const items = Array.isArray(r.inputs) ? r.inputs : [];
  return {
    inputs: items,
    total_inputs: items.length,
  };
}

function releaseInputGetExtract(raw: unknown): unknown {
  const r = raw as { release_id?: string; process_execution_id?: string; yaml?: string };
  return {
    release_id: r.release_id,
    process_execution_id: r.process_execution_id,
    yaml: r.yaml,
  };
}

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

/** GET /api/orchestration/execution/{id}/phases → standard list envelope. */
function releasePhaseListExtract(raw: unknown): {
  items: unknown[];
  total: number;
  release_id?: string;
  total_running_phases?: number;
} {
  const r = raw as {
    phases?: unknown[];
    release_id?: string;
    total_running_phases?: number;
  };
  const items = Array.isArray(r.phases) ? r.phases : [];
  return {
    items,
    total: items.length,
    ...(r.release_id ? { release_id: r.release_id } : {}),
    ...(typeof r.total_running_phases === "number" ? { total_running_phases: r.total_running_phases } : {}),
  };
}

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

const executeProcessSchema: BodySchema = {
  description:
    "On-the-go process execution (does not create a release). Requires inputIdentifier and inputYaml.",
  fields: [
    {
      name: "inputIdentifier",
      type: "string",
      required: true,
      description: "Process input identifier to use for this execution",
    },
    {
      name: "inputYaml",
      type: "yaml",
      required: true,
      description: "Input YAML configuring global and phase inputs for this execution",
    },
    {
      name: "gitBranch",
      type: "string",
      required: false,
      description: "Optional branch for remote process/activity YAMLs (default branch if omitted)",
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

function yamlWriteBody(input: Record<string, unknown>): Record<string, unknown> {
  const b = input.body as Record<string, unknown> | undefined;
  if (!b || typeof b !== "object") {
    throw new Error("body is required and must be an object with yaml (and optional git_details)");
  }
  if (typeof b.yaml !== "string" || b.yaml.length === 0) {
    throw new Error("body.yaml is required (non-empty YAML string)");
  }
  const out: Record<string, unknown> = { yaml: b.yaml };
  if (b.git_details !== undefined) out.git_details = b.git_details;
  return out;
}

function executeProcessBody(input: Record<string, unknown>): Record<string, unknown> {
  const b = (input.body as Record<string, unknown> | undefined) ?? input;
  const inputIdentifier = b.inputIdentifier ?? b.input_identifier;
  const inputYaml = b.inputYaml ?? b.input_yaml;
  if (typeof inputIdentifier !== "string" || !inputIdentifier) {
    throw new Error("body.inputIdentifier is required");
  }
  if (typeof inputYaml !== "string" || !inputYaml) {
    throw new Error("body.inputYaml is required (YAML string)");
  }
  const out: Record<string, unknown> = { inputIdentifier, inputYaml };
  const gitBranch = b.gitBranch ?? b.git_branch;
  if (typeof gitBranch === "string" && gitBranch) out.gitBranch = gitBranch;
  return out;
}

export const releaseManagementToolset: ToolsetDefinition = {
  name: "release-management",
  displayName: "Release Management",
  description:
    "Harness Release Management (RMG) — orchestration definitions (process/activity YAML) and release execution " +
    "monitoring (search releases, get release details, list phases/tasks/activity executions, get outputs). " +
    "Definitions: list/get/create/update/delete; execute a process on-the-go via harness_execute action run. " +
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
        "Use harness_list to discover processes, harness_get for YAML, harness_create/update with body.yaml, " +
        "and harness_execute action=run to start an on-the-go execution (inputIdentifier + inputYaml). " +
        "Search aliases: orchestration process, RMG process, release plan.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      baseUrlOverride: "rmg",
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
      executeHint:
        "To run a process without creating a release: harness_execute resource_type=release_process action=run " +
        "process_id=<identifier> body={ inputIdentifier, inputYaml, gitBranch? }. " +
        "Fetch YAML schema via harness_schema(resource_type='release_process') or GET {rmgBase}/api/yamlSchema?entityType=PROCESS.",
      operations: {
        list: {
          method: "GET",
          path: `${RMG}/orchestration/process/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: fillScopeFromConfig,
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
          preflight: fillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          queryParams: { git_branch: "git_branch" },
          paramsSchema: gitBranchGetParams,
          responseExtractor: passthrough,
          description: "Get orchestration process YAML and identifier by process_id",
        },
        create: {
          method: "POST",
          path: `${RMG}/orchestration/process`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: passthrough,
          description: "Create an orchestration process from YAML",
        },
        update: {
          method: "PUT",
          path: `${RMG}/orchestration/process/{identifier}`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: passthrough,
          description: "Update an orchestration process YAML (full replacement)",
        },
        delete: {
          method: "DELETE",
          path: `${RMG}/orchestration/process/{identifier}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          responseExtractor: passthrough,
          description: "Delete an orchestration process by process_id",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: `${RMG}/orchestration/process/{identifier}/execute`,
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          pathParams: { process_id: "identifier" },
          bodyBuilder: executeProcessBody,
          bodySchema: executeProcessSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Execute an orchestration process on-the-go (no release created). " +
            "Pass process_id and body with inputIdentifier + inputYaml (optional gitBranch).",
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
      baseUrlOverride: "rmg",
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
          preflight: fillScopeFromConfig,
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
          preflight: fillScopeFromConfig,
          pathParams: { activity_id: "identifier" },
          queryParams: { git_branch: "git_branch" },
          paramsSchema: gitBranchGetParams,
          responseExtractor: passthrough,
          description: "Get orchestration activity YAML and identifier by activity_id",
        },
        create: {
          method: "POST",
          path: `${RMG}/orchestration/activity`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: passthrough,
          description: "Create an orchestration activity from YAML",
        },
        update: {
          method: "PUT",
          path: `${RMG}/orchestration/activity/{identifier}`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          pathParams: { activity_id: "identifier" },
          bodyBuilder: yamlWriteBody,
          bodySchema: yamlBodySchema,
          responseExtractor: passthrough,
          description: "Update an orchestration activity YAML (full replacement)",
        },
        delete: {
          method: "DELETE",
          path: `${RMG}/orchestration/activity/{identifier}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: fillScopeFromConfig,
          pathParams: { activity_id: "identifier" },
          responseExtractor: passthrough,
          description: "Delete an orchestration activity by activity_id",
        },
      },
    },
    {
      resourceType: "release",
      displayName: "Release Execution",
      description:
        "A running or completed release instance (orchestration execution). harness_list returns releases in the " +
        `current org/project whose expected start falls in the last ${DEFAULT_DAYS_BACK} days (override with days_back, ` +
        "or start_ts/end_ts); narrow further with search_term and status. " +
        "The list item `id` field or UI URL slug (e.g. identifier-1.0.0-abc) can be used as release_id. " +
        "Search aliases: active release, release execution, RMG release.",
      toolset: "release-management",
      scope: "project",
      supportedScopes: ["account", "org", "project"],
      scopeOptional: true,
      headerBasedScoping: true,
      baseUrlOverride: "rmg",
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
          description: `Days of history to search (default ${DEFAULT_DAYS_BACK}, max ${MAX_DAYS_BACK}; includes ${DAYS_FORWARD} days forward). Ignored when start_ts/end_ts are set.`,
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
      baseUrlOverride: "rmg",
      identifierFields: ["release_id", "phase_identifier"],
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
      baseUrlOverride: "rmg",
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
          description: `Max tasks to return (default ${DEFAULT_TASK_LIMIT}, max ${MAX_TASK_LIMIT}; harness_list size also accepted)`,
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
      baseUrlOverride: "rmg",
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
      baseUrlOverride: "rmg",
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
      baseUrlOverride: "rmg",
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
      baseUrlOverride: "rmg",
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
      baseUrlOverride: "rmg",
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
      baseUrlOverride: "rmg",
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
