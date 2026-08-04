import type { ToolsetDefinition } from "../types.js";

/**
 * AIT (AI Test Automation) toolset.
 * Base path: /ait/api/v1/...
 * Hosted on the Harness platform and authenticated via standard Harness PAT.
 *
 * Resources:
 *   ait_app              — list applications
 *   ait_test_environment — list test environments for an app
 *   ait_test             — list, create (AI), and execute (run) tests
 */

// ─── Response extractors ────────────────────────────────────────────────────

/** Extract applications list: normalize camelCase fields to snake_case */
const aitAppListExtract = (raw: unknown): unknown => {
  if (!Array.isArray(raw)) {
    throw new Error("ait_app: expected array response from API, got " + typeof raw);
  }
  const arr = raw as Array<{
    appId?: string;
    appName?: string;
    createdAt?: string;
    updatedAt?: string;
    version?: string;
    workspaceId?: number;
    isDeleted?: boolean;
    sandbox?: boolean;
    hasSessions?: boolean;
  }>;
  const items = arr
    .filter((app) => !app.isDeleted)
    .map((app) => ({
      app_id: app.appId,
      app_name: app.appName,
      created_at: app.createdAt,
      updated_at: app.updatedAt,
      workspace_id: app.workspaceId,
      sandbox: app.sandbox,
      has_sessions: app.hasSessions,
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
    appId?: string;
    envName?: string;
    test?: boolean;
    monitor?: boolean;
    preRelease?: boolean;
    baseUrl?: string | null;
  }>;
  const items = arr.map((env) => ({
    id: env.id,
    app_id: env.appId,
    env_name: env.envName,
    test: env.test,
    monitor: env.monitor,
    pre_release: env.preRelease,
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
      tags: t.tags,
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
    appId: string;
    testId: number;
    testVersionId: number;
    testEnvironmentId: string;
    status: string | null;
    testSessionId: string | null;
    startEpoch: number | null;
    error: string | null;
  };
  return {
    id: r.id,
    app_id: r.appId,
    test_id: r.testId,
    test_version_id: r.testVersionId,
    test_environment_id: r.testEnvironmentId,
    status: r.status,
    error: r.error,
  };
};

// ─── Toolset definition ─────────────────────────────────────────────────────

export const aitToolset: ToolsetDefinition = {
  name: "ait",
  displayName: "AI Test Automation (AIT)",
  description:
    "Harness AI Test Automation (AIT) — list and manage automated tests for applications. " +
    "TERMINOLOGY MAPPING (AIT ↔ Harness): AIT \"org\" = Harness \"account\"; AIT \"app\" = Harness \"project\".",
  optIn: true,
  resources: [
    // ── ait_app ─────────────────────────────────────────────────────────────
    {
      resourceType: "ait_app",
      displayName: "AIT Application",
      description:
        "An application (also called 'project' in Harness) in the AIT module. List applications to discover app_id values " +
        "needed for other AIT operations (tests, environments).",
      toolset: "ait",
      scope: "account",
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/ait/api/v1/application",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: aitAppListExtract,
          skipCompact: true,
          description:
            "List all apps for the organization. Returns app details including app_id, app_name, workspace_id, and created_at.",
        },
      },
    },
    // ── ait_test_environment ────────────────────────────────────────────────
    {
      resourceType: "ait_test_environment",
      displayName: "AIT Test Environment",
      description:
        "A test environment for an AIT application. List environments to discover " +
        "environment IDs needed for creating and running tests.",
      toolset: "ait",
      scope: "account",
      identifierFields: ["app_id"],
      listFilterFields: [
        {
          name: "app_id",
          description: "Application ID (required)",
          required: true,
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ait/api/v1/testEnvironments",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            app_id: "appId",
          },
          responseExtractor: aitTestEnvironmentListExtract,
          description:
            "List all test environments for an application. Requires app_id in filters. " +
            "Returns environment details including id, env_name, base_url, and type flags.",
        },
      },
    },
    // ── ait_test ────────────────────────────────────────────────────────────
    {
      resourceType: "ait_test",
      displayName: "AIT Test",
      description:
        "An automated test in the AIT module. Supports listing tests for an app, " +
        "creating a test using AI (copilot), and executing a test run.",
      toolset: "ait",
      scope: "account",
      identifierFields: ["test_id", "test_version_id"],
      executeHint:
        "After harness_execute(resource_type='ait_test', action='run', ...), share the test run overview URL with the user: " +
        "/ait/{app_id}/test/{test_id}/version/{test_version_id}/test-run/{id}?tab=overview " +
        "(substitute ids from the run response; prefix with the Harness base URL for the session).",
      listFilterFields: [
        {
          name: "app_id",
          description: "Application ID (required)",
          required: true,
        },
        {
          name: "activation_status",
          description: "Filter by activation status",
        },
        {
          name: "run_status",
          description: "Filter by test run status",
        },
        {
          name: "sort_by",
          description: "Field to sort by (e.g. createdAt)",
        },
        {
          name: "sort_order",
          description: "Sort order: ASC or DESC",
          enum: ["ASC", "DESC"],
        },
        {
          name: "filter",
          description: "Text filter for test name",
        },
        {
          name: "should_hide_disabled_flows",
          description: "Whether to hide disabled flows",
          type: "boolean",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/ait/api/v1/testNew",
          pageOneIndexed: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            app_id: "appId",
            activation_status: "activationStatus",
            run_status: "runStatus",
            sort_by: "sortBy",
            sort_order: "sortOrder",
            page: "page",
            size: "limit",
            filter: "filter",
            should_hide_disabled_flows: "shouldHideDisabledFlows",
            is_debug_mode: "isDebugMode",
            last_run_start_epoch_ms: "lastRunStartEpochMs",
            run_statuses_per_test: "runStatusesPerTest",
          },
          defaultQueryParams: {
            sortOrder: "DESC",
            page: "1",
            limit: "20",
            shouldHideDisabledFlows: "true",
            isDebugMode: "false",
            runStatusesPerTest: "5",
          },
          responseExtractor: aitTestListExtract,
          skipCompact: true,
          description:
            "List all tests for an application. Requires app_id in filters. " +
            "Returns paginated test entries with name, created_by, created_at, display_status, and tags.",
        },
        create: {
          method: "POST",
          path: "/ait/api/v1/testNew/copilotTest/import",
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
            description: "Create a test using AI (copilot)",
            fields: [
              { name: "appId", type: "string", required: true, description: "Application ID" },
              { name: "envId", type: "string", required: true, description: "Environment ID" },
              { name: "description", type: "string", required: true, description: "Copilot task description (also used as the test name)" },
              { name: "authType", type: "string", required: false, description: "Auth type: 'auth' (default) or 'no_auth'" },
              { name: "entryUrl", type: "string", required: false, description: "Optional entry URL for the test" },
            ],
          },
          responseExtractor: aitTestCreateExtract,
          description:
            "Create a test using AI. Provide app_id, env_id, and a description. Returns test_id and test_version_id.",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/ait/api/v1/testNew/{testId}/version/{testVersionId}/run",
          pathParams: { test_id: "testId", test_version_id: "testVersionId" },
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
            description: "Execute a test run",
            fields: [
              { name: "appId", type: "string", required: true, description: "Application UUID (e.g. ecaab215-65cd-45d6-8426-09ba1e04eabb). Look up via ait_app if only app name is known." },
              { name: "environmentId", type: "string", required: true, description: "Environment UUID (e.g. 1289b517-5f1b-4927-b30b-6f2e895dae8e). Look up via ait_test_environment if only env name is known." },
              { name: "params", type: "string", required: false, description: "Test params — JSON stringified Map<string, string>. Defaults to '{\"RUN_MODE\":\"no-mock\",\"TestExecutorNamespace.fastExecutorMode\":\"false\"}'" },
            ],
          },
          responseExtractor: aitTestRunExtract,
          actionDescription:
            "Execute a test run. Returns id, app_id, test_id, test_version_id, status, and error. " +
            "Share the test run overview URL with the user (see executeHint on this resource).",
        },
      },
    },
  ],
};
