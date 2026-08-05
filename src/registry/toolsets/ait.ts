import type { ToolsetDefinition, PreflightContext } from "../types.js";

/**
 * AIT (AI Test Automation) toolset.
 * Base path: /ait/api/v1/...
 * Hosted on the Harness platform and authenticated via standard Harness PAT.
 *
 * Resources:
 *   ait_project          — list projects with AIT enabled
 *   ait_test_environment — list AIT test environments for a project
 *   ait_test             — list, create (AI), and execute (run) AIT tests
 */

// ─── Preflight guards ───────────────────────────────────────────────────────

/**
 * Throws a clear error when the caller passes org_id or project_id to an AIT resource.
 * AIT APIs use app_id for scoping — org_id and project_id are silently ignored by the API,
 * leading to incorrect results.
 */
const rejectProjectScope = async (ctx: PreflightContext): Promise<void> => {
  const passed: string[] = [];
  if (ctx.input["org_id"]) passed.push("org_id");
  if (ctx.input["project_id"]) passed.push("project_id");
  if (ctx.input["account_id"]) passed.push("account_id");
  if (passed.length > 0) {
    throw new Error(
      `Invalid parameter(s) for AIT: ${passed.join(", ")}. ` +
        "AIT uses app_id as its project scope (1:1 mapping with Harness project_id but different values — cannot substitute one for the other). " +
        "WORKFLOW: First call harness_list(resource_type='ait_project') with no scope params, match app_name to the Harness project name, then use that app_id.",
    );
  }
};

// ─── Response extractors ────────────────────────────────────────────────────

/** Extract applications list: normalize camelCase fields to snake_case */
const aitAppListExtract = (raw: unknown): unknown => {
  if (!Array.isArray(raw)) {
    throw new Error("ait_project: expected array response from API, got " + typeof raw);
  }
  const arr = raw as Array<{
    appId?: string;
    appName?: string;
    createdAt?: string;
    isDeleted?: boolean;
  }>;
  const items = arr
    .filter((app) => !app.isDeleted)
    .map((app) => ({
      app_id: app.appId,
      app_name: app.appName,
      created_at: app.createdAt,
    }));
  return { items, total: items.length };
};

/** Extract test environments list: normalize camelCase fields to snake_case */
const aitTestEnvironmentListExtract = (raw: unknown): unknown => {
  if (!Array.isArray(raw)) {
    throw new Error("ait_test_environment: expected array response from API, got " + typeof raw);
  }
  const arr = raw as Array<{
    id?: string;
    envName?: string;
    baseUrl?: string | null;
  }>;
  const items = arr.map((env) => ({
    id: env.id,
    env_name: env.envName,
    base_url: env.baseUrl ?? null,
  }));
  return { items, total: items.length };
};

/** Extract paginated TableResponse for test list */
const aitTestListExtract = (raw: unknown): unknown => {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("ait_test: expected paginated object response from API, got " + (Array.isArray(raw) ? "array" : typeof raw));
  }
  const r = raw as {
    data?: Array<Record<string, unknown>>;
    totalPages?: number;
    totalItems?: number;
    itemsPerPage?: number;
    currentPage?: number;
  };
  if (r.data !== undefined && !Array.isArray(r.data)) {
    throw new Error("ait_test: expected data field to be an array, got " + typeof r.data);
  }
  const items = (r.data ?? []).map((t) => {
    const runDetailsList = t.lastKRunDetailsList as Array<Record<string, unknown>> | null | undefined;
    const latestRun = runDetailsList?.[0];
    return {
      test_id: t.testId,
      name: t.testName,
      created_by: t.createdByNickname ?? t.createdBy,
      created_at: t.createdAt,
      display_status: latestRun?.displayStatus ?? null,
      last_run_id: t.lastRunId,
      test_version_id: t.testVersionId,
    };
  });
  return {
    items,
    total: r.totalItems ?? items.length,
    totalPages: r.totalPages ?? 0,
    currentPage: r.currentPage ?? 1,
    itemsPerPage: r.itemsPerPage ?? 20,
  };
};

/** Extract create-test-using-AI response */
const aitTestCreateExtract = (raw: unknown): unknown => {
  const r = raw as {
    testId: number;
    testVersionId: number;
  };
  return {
    test_id: r.testId,
    test_version_id: r.testVersionId,
  };
};

/** Extract run-test response */
const aitTestRunExtract = (raw: unknown): unknown => {
  const r = raw as {
    id: number;
    app_id: string;
    test_id: number;
    test_version_id: number;
    test_environment_id: string;
    status: string | null;
    test_session_id: string | null;
    start_epoch: number | null;
    error: string | null;
  };
  return {
    id: r.id,
    app_id: r.app_id,
    test_id: r.test_id,
    test_version_id: r.test_version_id,
    test_environment_id: r.test_environment_id,
    status: r.status,
    error: r.error,
  };
};

// ─── Toolset definition ─────────────────────────────────────────────────────

export const aitToolset: ToolsetDefinition = {
  name: "ait",
  displayName: "AI Test Automation (AIT)",
  description:
    "Harness AI Test Automation (AIT) — list and manage AIT tests for projects. " +
    "SCOPING: AIT APIs do NOT accept org_id, project_id, or account_id. Instead, AIT uses app_id as its project scope. " + 
    "app_id is AIT's equivalent of a Harness project ID (they have a 1:1 mapping but their values are different — you cannot use project_id in place of app_id). " +
    "All AIT API calls use app_id, not project_id. Do NOT pass org_id or project_id to any AIT resource. " +
    "WORKFLOW: To interact with AIT resources for a Harness project, first list ait_project, match app_name to the project name, then use that app_id for subsequent AIT operations.",
  optIn: true,
  resources: [
    // ── ait_project ─────────────────────────────────────────────────────────────
    {
      resourceType: "ait_project",
      displayName: "AIT Project",
      description:
        "A Harness project onboarded to AIT. Created when a user sets up their first AIT environment for that project — not all Harness projects appear here. " +
        "The app_name field IS the Harness project name. Match app_name to find the app_id needed for all other AIT operations.",
      toolset: "ait",
      scope: "account",
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/ait/api/v1/application",
          preflight: rejectProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: aitAppListExtract,
          description:
            "List all Harness projects onboarded to AIT. " +
            "Returns app_id (needed for all other AIT operations), app_name (= Harness project name), workspace_id, and created_at.",
        },
      },
    },
    // ── ait_test_environment ────────────────────────────────────────────────
    {
      resourceType: "ait_test_environment",
      displayName: "AIT Test Environment",
      description:
        "An AIT test environment for a project. Requires app_id filter. " +
        "List environments to discover environment IDs needed for creating and running tests.",
      toolset: "ait",
      scope: "account",
      identifierFields: ["app_id"],
      listFilterFields: [
        {
          name: "app_id",
          description: "app_id (required, from ait_project list)",
          required: true,
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ait/api/v1/testEnvironments",
          preflight: rejectProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            app_id: "appId",
          },
          responseExtractor: aitTestEnvironmentListExtract,
          description:
            "List all AIT test environments for a project. Requires app_id in filters. " +
            "Returns id, env_name, base_url, and type flags.",
        },
      },
    },
    // ── ait_test ────────────────────────────────────────────────────────────
    {
      resourceType: "ait_test",
      displayName: "AIT Test",
      description:
        "A test in the AIT module. Requires app_id filter. " +
        "Supports listing tests, creating a test using AI (copilot), and executing a test run.",
      toolset: "ait",
      scope: "account",
      identifierFields: ["test_id", "test_version_id"],
      listFilterFields: [
        {
          name: "app_id",
          description: "app_id (required, from ait_project list)",
          required: true,
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ait/api/v1/testNew",
          pageOneIndexed: true,
          preflight: rejectProjectScope,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            app_id: "appId",
          },
          responseExtractor: aitTestListExtract,
          description:
            "List all AIT tests for a project. Requires app_id in filters. " +
            "Returns paginated test entries with name, created_by, created_at, display_status, and tags.",
        },
        create: {
          method: "POST",
          path: "/ait/api/v1/testNew/copilotTest/import",
          preflight: rejectProjectScope,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            const appId = (b.app_id ?? b.appId) as string;
            const envId = (b.env_id ?? b.envId) as string;
            const authType = b.auth_type ?? b.authType;
            const entryUrl = b.entry_url ?? b.entryUrl;
            return {
              appId,
              envId,
              description: b.description,
              ...(authType !== undefined ? { authType: authType as string } : {}),
              ...(entryUrl !== undefined ? { entryUrl: entryUrl as string } : {}),
            };
          },
          bodySchema: {
            description: "Create an AIT test using AI (copilot)",
            fields: [
              { name: "appId", type: "string", required: true, description: "app_id (from ait_project list)" },
              { name: "envId", type: "string", required: true, description: "Environment ID" },
              { name: "description", type: "string", required: true, description: "Copilot task description (also used as the test name)" },
              { name: "authType", type: "string", required: false, description: "Auth type: 'auth' (default) or 'no_auth'" },
              { name: "entryUrl", type: "string", required: false, description: "Optional entry URL for the test" },
            ],
          },
          responseExtractor: aitTestCreateExtract,
          description:
            "Create an AIT test using AI. Provide app_id, env_id, and a description. Returns test_id and test_version_id.",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/ait/api/v1/testNew/{test_id}/version/{test_version_id}/run",
          pathParams: { test_id: "test_id", test_version_id: "test_version_id" },
          preflight: rejectProjectScope,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input: Record<string, unknown>) => {
            const b = (input.body ?? input) as Record<string, unknown>;
            const appId = (b.app_id ?? b.appId) as string;
            const environmentId = (b.environment_id ?? b.environmentId) as string;
            return {
              appId,
              environmentId,
              params: b.params ?? '{"RUN_MODE":"no-mock","TestExecutorNamespace.fastExecutorMode":"false"}',
            };
          },
          bodySchema: {
            description: "Execute an AIT test run",
            fields: [
              { name: "appId", type: "string", required: true, description: "app_id (from ait_project list)" },
              { name: "environmentId", type: "string", required: true, description: "Environment UUID (e.g. 1289b517-5f1b-4927-b30b-6f2e895dae8e). Look up via ait_test_environment if only env name is known." },
              { name: "params", type: "string", required: false, description: "Test params — JSON stringified Map<string, string>. Defaults to '{\"RUN_MODE\":\"no-mock\",\"TestExecutorNamespace.fastExecutorMode\":\"false\"}'" },
            ],
          },
          responseExtractor: aitTestRunExtract,
          actionDescription:
            "Execute an AIT test. Returns TestRun details including id, status, and error.",
        },
      },
    },
  ],
};
