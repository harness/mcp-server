import type { BodySchema, ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";
import { isRecord } from "../../utils/type-guards.js";


/**
 * AIT (AI Test Automation) toolset.
 * Base path: /ait/api/v1/...
 * Hosted on the Harness platform and authenticated via standard Harness PAT.
 *
 * Resources:
 *   ait_app, ait_test_environment, ait_test — apps, environments, tests (list/create/run)
 *   kb_crawl, kb_crawl_page, kb_page_artifact — knowledge-base crawls and grounding artifacts
 *
 * KB routes resolve org from the PAT (Harness account → AIT org). Use headerBasedScoping on KB
 * resources so account/org/project are not injected into query or write bodies.
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

// ─── Knowledge base (KB) helpers ───────────────────────────────────────────

const KB = "/ait/api/v1/kb";

/** Fields of a crawl page that are useful without fetching artifacts. */
function projectPageSummary(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["pageId", "crawlRunId", "url", "title", "summary", "capturedAt"]) {
    if (typeof item[key] === "string") out[key] = item[key];
  }
  if (typeof item.depth === "number") out.depth = item.depth;
  if (isRecord(item.artifacts)) out.artifacts = item.artifacts;
  return out;
}

/**
 * Cursor-paginated AIT list: `{ items, nextCursor }`. `total` is set from the
 * page length because the API deliberately does not count the full history.
 */
const kbCursorListExtract = (raw: unknown): { items: unknown[]; total: number; nextCursor?: string } => {
  if (!isRecord(raw)) return { items: [], total: 0 };
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    items,
    total: items.length,
    ...(typeof raw.nextCursor === "string" ? { nextCursor: raw.nextCursor } : {}),
  };
};

/**
 * Page detail. `structure`, `links`, and `testableFeatures` are the grounding
 * surface, so they are kept whole; `includedArtifacts` is only present when the
 * caller asked for it via the `include` param.
 */
const kbPageExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const out = projectPageSummary(raw);
  if (Array.isArray(raw.links)) out.links = raw.links;
  if (isRecord(raw.structure)) out.structure = raw.structure;
  if (Array.isArray(raw.testableFeatures)) out.testableFeatures = raw.testableFeatures;
  if (isRecord(raw.includedArtifacts)) out.includedArtifacts = raw.includedArtifacts;
  return out;
};

/**
 * Artifact payload. Text artifacts can carry up to 128 KiB, so nothing beyond
 * the content and its provenance is worth spending context on — the digest and
 * any backend envelope fields are dropped.
 */
const kbArtifactExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = {};
  for (const key of ["pageId", "crawlRunId", "kind", "contentType", "text", "signedUrl", "expiresAt"]) {
    if (typeof raw[key] === "string") out[key] = raw[key];
  }
  if (typeof raw.truncated === "boolean") out.truncated = raw.truncated;
  return out;
};

/**
 * AIT bodies are validated against explicit tsoa interfaces that reject unknown
 * fields, so both builders below map a fixed field list instead of forwarding
 * whatever the agent supplied.
 */
function buildCreateCrawlBody(input: Record<string, unknown>): unknown {
  const body = isRecord(input.body) ? input.body : {};
  const appId = body.appId ?? input.app_id;
  if (typeof appId !== "string" || !appId) {
    throw new Error("body.appId is required — the AIT application the knowledge base belongs to.");
  }
  const testEnvironmentId = body.testEnvironmentId ?? input.test_environment_id;
  const startUrl = body.startUrl;
  if (!testEnvironmentId && !startUrl) {
    throw new Error(
      "Provide body.testEnvironmentId to crawl an existing environment, or body.startUrl to create an ad-hoc one.",
    );
  }
  const out: Record<string, unknown> = { appId };
  if (typeof testEnvironmentId === "string") out.testEnvironmentId = testEnvironmentId;
  if (typeof startUrl === "string") out.startUrl = startUrl;

  if (isRecord(body.config)) {
    const config: Record<string, unknown> = {};
    for (const key of ["maxDepth", "maxPages"]) {
      if (typeof body.config[key] === "number") config[key] = body.config[key];
    }
    if (typeof body.config.autoLogin === "boolean") config.autoLogin = body.config.autoLogin;
    for (const key of ["tunnelName", "crawlInstructionsAddendum"]) {
      if (typeof body.config[key] === "string") config[key] = body.config[key];
    }
    if (isRecord(body.config.recurring)) {
      const { startDate, repeat } = body.config.recurring;
      if (typeof startDate === "string" && typeof repeat === "string") {
        config.recurring = { startDate, repeat };
      }
    }
    if (Object.keys(config).length > 0) out.config = config;
  }
  return out;
}

function buildRecrawlBody(input: Record<string, unknown>): unknown {
  const body = isRecord(input.body) ? input.body : {};
  const out: Record<string, unknown> = {};
  for (const key of ["maxDepth", "maxPages"]) {
    if (typeof body[key] === "number") out[key] = body[key];
  }
  return out;
}

const createCrawlSchema: BodySchema = {
  description: "Crawl to define (CreateCrawlBody). Give either testEnvironmentId or startUrl.",
  fields: [
    { name: "appId", type: "string", required: true, description: "AIT application the knowledge base belongs to" },
    { name: "testEnvironmentId", type: "string", required: false, description: "Existing test environment to crawl; its BASE_URL variable becomes the start URL" },
    { name: "startUrl", type: "string", required: false, description: "Ad-hoc URL to crawl; creates a test environment with this BASE_URL" },
    {
      name: "config",
      type: "object",
      required: false,
      description: "Crawl limits, auth, steering, and schedule",
      fields: [
        { name: "maxDepth", type: "number", required: false, description: "Maximum link depth from the start URL" },
        { name: "maxPages", type: "number", required: false, description: "Maximum number of pages to capture" },
        { name: "autoLogin", type: "boolean", required: false, description: "Log in using the environment's AUTO_LOGIN_* variables before crawling" },
        { name: "tunnelName", type: "string", required: false, description: "Named AIT tunnel to route the crawl through, for apps that are not publicly reachable" },
        { name: "crawlInstructionsAddendum", type: "string", required: false, description: "Natural-language steering appended to the knowledge base's shared crawl instructions (e.g. 'only crawl under /docs')" },
        {
          name: "recurring",
          type: "object",
          required: false,
          description: "Schedule for repeat crawls",
          fields: [
            { name: "startDate", type: "string", required: true, description: "ISO-8601 date the schedule starts" },
            { name: "repeat", type: "string", required: true, description: "Repeat interval (e.g. daily, weekly)" },
          ],
        },
      ],
    },
  ],
};

const recrawlSchema: BodySchema = {
  description: "Optional overrides for the new crawl run (RecrawlBody). Send an empty object to reuse the stored config.",
  fields: [
    { name: "maxDepth", type: "number", required: false, description: "Maximum link depth from the start URL" },
    { name: "maxPages", type: "number", required: false, description: "Maximum number of pages to capture" },
  ],
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
          path: "/ait/api/v1/testNew/{test_id}/version/{test_version_id}/run",
          pathParams: { test_id: "test_id", test_version_id: "test_version_id" },
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
            "Execute a test. Returns TestRun details including id, status, and error.",
        },
      },
    },
    // ── Knowledge base ──────────────────────────────────────────────────────
    {
          resourceType: "kb_crawl",
          displayName: "AIT Crawl Run",
          description:
            "One crawl of a test environment. Create a crawl to populate the knowledge base, then poll the run until status is completed or failed.",
          toolset: "ait",
          scope: "account",
          headerBasedScoping: true,
          identifierFields: ["crawl_run_id"],
          listFilterFields: [
            { name: "cursor", description: "Continue a previous page of history — pass the nextCursor from the last response" },
          ],
          relatedResources: [
            {
              resourceType: "kb_crawl_page",
              relationship: "children",
              description: "Pages captured by a completed crawl run",
            },
          ],
          executeHint:
            "Poll a run with harness_get(resource_type='kb_crawl', resource_id=<crawl_run_id>) until status is completed or failed. Use the recrawl action to refresh an environment; it cancels any crawl still running for that environment first.",
          operations: {
            list: {
              method: "GET",
              path: `${KB}/{testEnvironmentId}/crawls`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { test_environment_id: "testEnvironmentId" },
              queryParams: { size: "limit", cursor: "cursor" },
              responseExtractor: kbCursorListExtract,
              description: "List crawl history for a test environment, newest first",
              paramsSchema: {
                fields: [
                  { name: "test_environment_id", required: true, description: "Test environment whose crawl history to list" },
                ],
              },
            },
            get: {
              method: "GET",
              path: `${KB}/crawls/{crawlRunId}`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { crawl_run_id: "crawlRunId" },
              // The crawl-run DTO is hand-written and already agent-facing: no
              // envelope, no backend-internal keys.
              responseExtractor: passthrough,
              description: "Get a crawl run's status, page count, and error message",
            },
            create: {
              method: "POST",
              path: `${KB}/crawls`,
              operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
              bodyBuilder: buildCreateCrawlBody,
              bodySchema: createCrawlSchema,
              skipScopeBodyInjection: true,
              responseExtractor: passthrough,
              description: "Define a crawl and queue it — returns the crawlRunId to poll",
            },
          },
          executeActions: {
            recrawl: {
              method: "POST",
              path: `${KB}/{testEnvironmentId}/recrawl`,
              operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
              pathParams: { test_environment_id: "testEnvironmentId" },
              bodyBuilder: buildRecrawlBody,
              bodySchema: recrawlSchema,
              skipScopeBodyInjection: true,
              responseExtractor: passthrough,
              actionDescription:
                "Recrawl a test environment with its stored crawl source. Cancels the crawl workflow still running for that environment, if any, and replaces its pages with the new run's.",
            },
            latest_status: {
              method: "GET",
              path: `${KB}/{testEnvironmentId}/crawl/status`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { test_environment_id: "testEnvironmentId" },
              responseExtractor: passthrough,
              actionDescription: "Get the most recent crawl run for a test environment without knowing its crawlRunId.",
            },
          },
        },
        {
          resourceType: "kb_crawl_page",
          displayName: "AIT Crawl Page",
          description:
            "A page captured by a crawl run, with its structure, links, and testable features. Use this to ground test authoring in what the application actually renders.",
          toolset: "ait",
          scope: "account",
          headerBasedScoping: true,
          // Parent-first, resource last: harness_get maps resource_id to the final
          // field, so resource_id is the page and crawl_run_id comes from params.
          identifierFields: ["crawl_run_id", "page_id"],
          compactItem: projectPageSummary,
          listFilterFields: [
            { name: "query", description: "Match against page title, URL, and summary" },
            { name: "cursor", description: "Continue a previous page of results — pass the nextCursor from the last response" },
          ],
          relatedResources: [
            {
              resourceType: "kb_page_artifact",
              relationship: "children",
              description: "Accessibility tree, markdown, metadata, or screenshot for a page",
            },
          ],
          operations: {
            list: {
              method: "GET",
              path: `${KB}/crawls/{crawlRunId}/pages`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { crawl_run_id: "crawlRunId" },
              queryParams: { query: "query", size: "limit", cursor: "cursor" },
              responseExtractor: kbCursorListExtract,
              description: "List the pages a crawl run captured, optionally filtered by a text query",
              paramsSchema: {
                fields: [{ name: "crawl_run_id", required: true, description: "Crawl run whose pages to list" }],
              },
            },
            get: {
              method: "GET",
              path: `${KB}/crawls/{crawlRunId}/pages/{pageId}`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { crawl_run_id: "crawlRunId", page_id: "pageId" },
              queryParams: { include: "include" },
              responseExtractor: kbPageExtract,
              description:
                "Get one page. Pass include as a comma-separated list of accessibility, markdown, metadata, or screenshot to inline those artifacts.",
              paramsSchema: {
                fields: [
                  { name: "crawl_run_id", required: true, description: "Crawl run the page belongs to" },
                  { name: "page_id", required: true, description: "Page to fetch" },
                  { name: "include", required: false, description: "Artifacts to inline: accessibility, markdown, metadata, screenshot" },
                ],
              },
            },
          },
        },
        {
          resourceType: "kb_page_artifact",
          displayName: "AIT Page Artifact",
          description:
            "One captured artifact for a page. Text kinds return inline content capped at 128 KiB; screenshot returns a short-lived signed URL. Raw HTML is not exposed.",
          toolset: "ait",
          scope: "account",
          headerBasedScoping: true,
          // An artifact is identified within its page by kind, so that is the last
          // field and therefore what resource_id means for this type.
          identifierFields: ["crawl_run_id", "page_id", "kind"],
          operations: {
            get: {
              method: "GET",
              path: `${KB}/crawls/{crawlRunId}/pages/{pageId}/artifacts/{kind}`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { crawl_run_id: "crawlRunId", page_id: "pageId", kind: "kind" },
              responseExtractor: kbArtifactExtract,
              description: "Fetch one artifact for a page: accessibility, markdown, metadata, or screenshot",
              paramsSchema: {
                fields: [
                  { name: "crawl_run_id", required: true, description: "Crawl run the page belongs to" },
                  { name: "page_id", required: true, description: "Page whose artifact to fetch" },
                  { name: "kind", required: true, description: "accessibility, markdown, metadata, or screenshot" },
                ],
              },
            },
          },
        },
  ],
};
