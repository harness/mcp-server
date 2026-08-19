import type { BodySchema, ToolsetDefinition } from "../types.js";
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
  // Java exposes the PK as `id` (column test_environment_id). Emit test_environment_id
  // so agents can pass the same field into kb_crawl / create / run without renaming.
  const items = arr.map((env) => ({
    test_environment_id: env.id,
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

const KB_CRAWL_PROGRESS_GUIDANCE =
  "While polling a running crawl, report pages_discovered and elapsed time since started_at. " +
  "When max_pages is known from the create/recrawl request and pages_discovered >= 5, estimate " +
  "remaining time as elapsed_ms * (max_pages - pages_discovered) / pages_discovered. " +
  "Label the ETA approximate: the crawl can finish before max_pages when its frontier empties.";

function kbIsoTimestamp(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

/** Crawl run or create-crawl response: camelCase wire → snake_case for agents. */
const kbCrawlRunExtract = (raw: unknown): Record<string, unknown> => {
  if (!isRecord(raw)) {
    throw new Error("kb_crawl: expected object response from API, got " + typeof raw);
  }
  const out: Record<string, unknown> = {};
  if (typeof raw.crawlRunId === "string") out.crawl_run_id = raw.crawlRunId;
  if (typeof raw.knowledgeSourceId === "string") out.knowledge_source_id = raw.knowledgeSourceId;
  if (typeof raw.testEnvironmentId === "string") out.test_environment_id = raw.testEnvironmentId;
  if (typeof raw.startUrl === "string") out.start_url = raw.startUrl;
  if (raw.trigger !== undefined) out.trigger = raw.trigger;
  if (raw.status !== undefined) out.status = raw.status;
  if (typeof raw.pagesDiscovered === "number") out.pages_discovered = raw.pagesDiscovered;
  if (typeof raw.total === "number") out.total = raw.total;
  if (typeof raw.error === "string") out.error = raw.error;
  if (typeof raw.temporalWorkflowId === "string") out.temporal_workflow_id = raw.temporalWorkflowId;
  const startedAt = kbIsoTimestamp(raw.startedAt);
  if (startedAt) out.started_at = startedAt;
  const finishedAt = kbIsoTimestamp(raw.finishedAt);
  if (finishedAt) out.finished_at = finishedAt;
  return out;
};

/** Page list item: project key crawl/page fields to snake_case. */
function projectPageSummary(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof item.pageId === "string") out.page_id = item.pageId;
  if (typeof item.crawlRunId === "string") out.crawl_run_id = item.crawlRunId;
  for (const key of ["url", "title", "summary"] as const) {
    if (typeof item[key] === "string") out[key] = item[key];
  }
  if (typeof item.depth === "number") out.depth = item.depth;
  const capturedAt = kbIsoTimestamp(item.capturedAt);
  if (capturedAt) out.captured_at = capturedAt;
  if (isRecord(item.artifacts)) out.artifacts = item.artifacts;
  return out;
}

const kbCrawlHistoryListExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return { items: [], total: 0 };
  const wireItems = Array.isArray(raw.items) ? raw.items : [];
  const items = wireItems.map((item) => kbCrawlRunExtract(item));
  return {
    items,
    total: items.length,
    ...(typeof raw.nextCursor === "string" ? { next_cursor: raw.nextCursor } : {}),
  };
};

const kbPageListExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return { items: [], total: 0 };
  const wireItems = Array.isArray(raw.items) ? raw.items : [];
  const items = wireItems.filter(isRecord).map((item) => projectPageSummary(item));
  return {
    items,
    total: items.length,
    ...(typeof raw.nextCursor === "string" ? { next_cursor: raw.nextCursor } : {}),
  };
};

const kbPageExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const out = projectPageSummary(raw);
  if (Array.isArray(raw.links)) out.links = raw.links;
  if (isRecord(raw.structure)) out.structure = raw.structure;
  if (Array.isArray(raw.testableFeatures)) out.testable_features = raw.testableFeatures;
  if (isRecord(raw.includedArtifacts)) {
    const included: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw.includedArtifacts)) {
      included[key] = kbArtifactExtract(value);
    }
    out.included_artifacts = included;
  }
  return out;
};

/** Artifact payload: snake_case for agents; digest and other backend fields dropped. */
const kbArtifactExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = {};
  if (typeof raw.pageId === "string") out.page_id = raw.pageId;
  if (typeof raw.crawlRunId === "string") out.crawl_run_id = raw.crawlRunId;
  if (typeof raw.kind === "string") out.kind = raw.kind;
  if (typeof raw.contentType === "string") out.content_type = raw.contentType;
  if (typeof raw.text === "string") out.text = raw.text;
  if (typeof raw.signedUrl === "string") out.signed_url = raw.signedUrl;
  const expiresAt = kbIsoTimestamp(raw.expiresAt);
  if (expiresAt) out.expires_at = expiresAt;
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
  const appId = (body.app_id ?? body.appId ?? input.app_id) as string | undefined;
  if (typeof appId !== "string" || !appId) {
    throw new Error("body.app_id is required — the AIT application the knowledge base belongs to.");
  }
  const testEnvironmentId = (body.test_environment_id ?? body.testEnvironmentId ?? input.test_environment_id) as
    | string
    | undefined;
  const startUrl = (body.start_url ?? body.startUrl) as string | undefined;
  if (!testEnvironmentId && !startUrl) {
    throw new Error(
      "Provide body.test_environment_id to crawl an existing environment, or body.start_url to create an ad-hoc one.",
    );
  }
  const out: Record<string, unknown> = { appId };
  if (typeof testEnvironmentId === "string") out.testEnvironmentId = testEnvironmentId;
  if (typeof startUrl === "string") out.startUrl = startUrl;

  if (isRecord(body.config)) {
    const config: Record<string, unknown> = {};
    const maxDepth = body.config.max_depth ?? body.config.maxDepth;
    const maxPages = body.config.max_pages ?? body.config.maxPages;
    if (typeof maxDepth === "number") config.maxDepth = maxDepth;
    if (typeof maxPages === "number") config.maxPages = maxPages;
    const autoLogin = body.config.auto_login ?? body.config.autoLogin;
    if (typeof autoLogin === "boolean") config.autoLogin = autoLogin;
    const tunnelName = body.config.tunnel_name ?? body.config.tunnelName;
    if (typeof tunnelName === "string") config.tunnelName = tunnelName;
    const addendum = body.config.crawl_instructions_addendum ?? body.config.crawlInstructionsAddendum;
    if (typeof addendum === "string") config.crawlInstructionsAddendum = addendum;
    if (isRecord(body.config.recurring)) {
      const startDate = body.config.recurring.start_date ?? body.config.recurring.startDate;
      const repeat = body.config.recurring.repeat;
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
  const maxDepth = body.max_depth ?? body.maxDepth;
  const maxPages = body.max_pages ?? body.maxPages;
  if (typeof maxDepth === "number") out.maxDepth = maxDepth;
  if (typeof maxPages === "number") out.maxPages = maxPages;
  return out;
}

const createCrawlSchema: BodySchema = {
  description: "Crawl to define. Give either test_environment_id or start_url.",
  fields: [
    { name: "app_id", type: "string", required: true, description: "AIT application the knowledge base belongs to" },
    {
      name: "test_environment_id",
      type: "string",
      required: false,
      description: "Existing test environment to crawl; its BASE_URL variable becomes the start URL",
    },
    {
      name: "start_url",
      type: "string",
      required: false,
      description: "Ad-hoc URL to crawl; creates a test environment with this BASE_URL",
    },
    {
      name: "config",
      type: "object",
      required: false,
      description: "Crawl limits, auth, steering, and schedule",
      fields: [
        { name: "max_depth", type: "number", required: false, description: "Maximum link depth from the start URL" },
        { name: "max_pages", type: "number", required: false, description: "Maximum number of pages to capture" },
        {
          name: "auto_login",
          type: "boolean",
          required: false,
          description: "Log in using the environment's AUTO_LOGIN_* variables before crawling",
        },
        {
          name: "tunnel_name",
          type: "string",
          required: false,
          description: "Named AIT tunnel to route the crawl through, for apps that are not publicly reachable",
        },
        {
          name: "crawl_instructions_addendum",
          type: "string",
          required: false,
          description:
            "Natural-language steering appended to the knowledge base's shared crawl instructions (e.g. 'only crawl under /docs')",
        },
        {
          name: "recurring",
          type: "object",
          required: false,
          description: "Schedule for repeat crawls",
          fields: [
            { name: "start_date", type: "string", required: true, description: "ISO-8601 date the schedule starts" },
            { name: "repeat", type: "string", required: true, description: "Repeat interval (e.g. daily, weekly)" },
          ],
        },
      ],
    },
  ],
};

const recrawlSchema: BodySchema = {
  description: "Optional overrides for the new crawl run. Send an empty object to reuse the stored config.",
  fields: [
    { name: "max_depth", type: "number", required: false, description: "Maximum link depth from the start URL" },
    { name: "max_pages", type: "number", required: false, description: "Maximum number of pages to capture" },
  ],
};


// ─── Toolset definition ─────────────────────────────────────────────────────

export const aitToolset: ToolsetDefinition = {
  name: "ait",
  displayName: "AI Test Automation (AIT)",
  description:
    "Harness AI Test Automation (AIT) — apps, environments, tests, and Knowledge Base crawls. " +
    "TERMINOLOGY: AIT \"org\" = Harness \"account\"; AIT \"app\" = Harness \"project\". " +
    "KNOWLEDGE BASE (kb_crawl, kb_crawl_page, kb_page_artifact): for any crawl/page/screenshot/artifact question, " +
    "use harness_list/harness_get/harness_create/harness_execute only. " +
    "Do NOT curl the AIT API, query Postgres, use kubectl, or fetch GCS/S3. " +
    "Do NOT call /ait/api/apps or other unmatched paths — those proxy to ait-java-api-service (legacy Java), which is unrelated to KB. " +
    "Do NOT use ait_test_environment to discover IDs for KB on node-api-only stacks (that list is Java-backed and will 500 locally). Ask for test_environment_id, then call kb_crawl. " +
    "Prefer the explore-knowledge-base MCP prompt for crawl/page Q&A workflows.",
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
        "test_environment_id values (same UUID as KB crawls use). " +
        "WARNING: GET /ait/api/v1/testEnvironments is still served by the legacy Java API (ait-java-api-service). " +
        "On laptop Helm stacks that only run node-api, this list returns ENOTFOUND/500 — that does NOT mean KB is down. " +
        "For Knowledge Base crawls when this list fails, ask the user for test_environment_id and call kb_crawl directly.",
      toolset: "ait",
      scope: "account",
      identifierFields: ["test_environment_id"],
      diagnosticHint:
        "testEnvironments is a Java catch-all route. ENOTFOUND ait-java-api-service means Java is not deployed locally, " +
        "not that node-api/KB is unavailable. For kb_crawl, obtain test_environment_id from the user and call " +
        "harness_list(resource_type='kb_crawl', params={test_environment_id}) — never fall back to curl/psql.",
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
            "List test environments for an application. Requires app_id in filters. " +
            "Each item includes test_environment_id (use this same field for kb_crawl), env_name, and base_url. " +
            "Requires Java AIT API; skip this for local KB-only stacks.",
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
            const envId = (b.test_environment_id ?? b.testEnvironmentId ?? b.env_id ?? b.envId) as string;
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
              { name: "app_id", type: "string", required: true, description: "Application ID" },
              {
                name: "test_environment_id",
                type: "string",
                required: true,
                description: "Test environment UUID (same field as kb_crawl / ait_test_environment list)",
              },
              { name: "description", type: "string", required: true, description: "Copilot task description (also used as the test name)" },
              { name: "auth_type", type: "string", required: false, description: "Auth type: 'auth' (default) or 'no_auth'" },
              { name: "entry_url", type: "string", required: false, description: "Optional entry URL for the test" },
            ],
          },
          responseExtractor: aitTestCreateExtract,
          description:
            "Create a test using AI. Provide app_id, test_environment_id, and a description. Returns test_id and test_version_id.",
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
            const environmentId = (
              b.test_environment_id ??
              b.testEnvironmentId ??
              b.environment_id ??
              b.environmentId
            ) as string;
            return {
              appId,
              environmentId,
              params: b.params ?? '{"RUN_MODE":"no-mock","TestExecutorNamespace.fastExecutorMode":"false"}',
            };
          },
          bodySchema: {
            description: "Execute a test run",
            fields: [
              {
                name: "app_id",
                type: "string",
                required: true,
                description: "Application UUID. Look up via ait_app if only app name is known.",
              },
              {
                name: "test_environment_id",
                type: "string",
                required: true,
                description:
                  "Test environment UUID (same as ait_test_environment.test_environment_id and kb_crawl params).",
              },
              {
                name: "params",
                type: "string",
                required: false,
                description:
                  "Test params — JSON stringified Map<string, string>. Defaults to '{\"RUN_MODE\":\"no-mock\",\"TestExecutorNamespace.fastExecutorMode\":\"false\"}'",
              },
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
            "One crawl of a test environment. Create a crawl to populate the knowledge base, then poll the run until status is completed or failed. " +
            "ALWAYS use harness_list/get/create for crawls — never curl, psql, or kubectl. " +
            "List requires params.test_environment_id. Newest runs first.",
          toolset: "ait",
          scope: "account",
          headerBasedScoping: true,
          identifierFields: ["crawl_run_id"],
          searchAliases: ["knowledge base crawl", "kb crawl", "crawl run", "crawl history", "recrawl"],
          diagnosticHint:
            "KB crawls are served by node-api at /ait/api/v1/kb/... via MCP. " +
            "If you see ENOTFOUND ait-java-api-service, you hit an unmatched route that proxies to legacy Java — stop curling and use harness_list(resource_type='kb_crawl', params={test_environment_id}). " +
            "Ensure HARNESS_TOOLSETS includes +ait and HARNESS_BASE_URL points at the AIT ingress (local: http://localhost:30082).",
          listFilterFields: [
            { name: "cursor", description: "Continue a previous page of history — pass next_cursor from the last response" },
          ],
          relatedResources: [
            {
              resourceType: "kb_crawl_page",
              relationship: "children",
              description: "Pages captured by a completed crawl run",
            },
          ],
          executeHint:
            "Poll a run with harness_get(resource_type='kb_crawl', resource_id=<crawl_run_id>) until status is completed or failed. " +
            KB_CRAWL_PROGRESS_GUIDANCE +
            " Use the recrawl action to refresh an environment; it cancels any crawl still running for that environment first.",
          operations: {
            list: {
              method: "GET",
              path: `${KB}/{testEnvironmentId}/crawls`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { test_environment_id: "testEnvironmentId" },
              queryParams: { size: "limit", cursor: "cursor" },
              responseExtractor: kbCrawlHistoryListExtract,
              skipCompact: true,
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
              responseExtractor: kbCrawlRunExtract,
              description:
                "Get a crawl run's status, page count, and error message. " +
                KB_CRAWL_PROGRESS_GUIDANCE,
            },
            create: {
              method: "POST",
              path: `${KB}/crawls`,
              operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
              bodyBuilder: buildCreateCrawlBody,
              bodySchema: createCrawlSchema,
              skipScopeBodyInjection: true,
              responseExtractor: kbCrawlRunExtract,
              description: "Define a crawl and queue it — returns crawl_run_id to poll",
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
              responseExtractor: kbCrawlRunExtract,
              actionDescription:
                "Recrawl a test environment with its stored crawl source. Cancels the crawl workflow still running for that environment, if any, and replaces its pages with the new run's.",
            },
            latest_status: {
              method: "GET",
              path: `${KB}/{testEnvironmentId}/crawl/status`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { test_environment_id: "testEnvironmentId" },
              responseExtractor: kbCrawlRunExtract,
              actionDescription:
                "Get the most recent crawl run for a test environment without knowing its crawlRunId. " +
                KB_CRAWL_PROGRESS_GUIDANCE,
            },
          },
        },
        {
          resourceType: "kb_crawl_page",
          displayName: "AIT Crawl Page",
          description:
            "A page captured by a crawl run, with its structure, links, and testable features. Use this to ground test authoring in what the application actually renders. " +
            "ALWAYS use harness_list/get — never curl or open storage. " +
            "List needs params.crawl_run_id; get needs resource_id=page_id plus params.crawl_run_id. " +
            "For screenshots prefer include=screenshot on get (returns signed_url + MCP image block).",
          toolset: "ait",
          scope: "account",
          headerBasedScoping: true,
          // Parent-first, resource last: harness_get maps resource_id to the final
          // field, so resource_id is the page and crawl_run_id comes from params.
          identifierFields: ["crawl_run_id", "page_id"],
          searchAliases: ["crawl page", "kb page", "page screenshot", "crawled url"],
          diagnosticHint:
            "Use harness_list(resource_type='kb_crawl_page', params={crawl_run_id, query?}). " +
            "Do not curl localhost or proxy paths that resolve ait-java-api-service.",
          listFilterFields: [
            { name: "query", description: "Match against page title, URL, and summary" },
            { name: "cursor", description: "Continue a previous page of results — pass next_cursor from the last response" },
          ],
          relatedResources: [
            {
              resourceType: "kb_page_artifact",
              relationship: "children",
              description:
                "Single artifact get. Prefer include=screenshot on kb_crawl_page when you only need to show a screenshot; use kb_page_artifact when you need one kind by itself.",
            },
          ],
          operations: {
            list: {
              method: "GET",
              path: `${KB}/crawls/{crawlRunId}/pages`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { crawl_run_id: "crawlRunId" },
              queryParams: { query: "query", size: "limit", cursor: "cursor" },
              responseExtractor: kbPageListExtract,
              skipCompact: true,
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
                "Get one page. Pass include as a comma-separated list of accessibility, markdown, metadata, or screenshot. " +
                "For 'show/share the screenshot', prefer include=screenshot — harness_get returns JSON plus an MCP image content block when the signed URL is fetchable. " +
                "Do not curl the relicx API or open GCS/S3 directly.",
              paramsSchema: {
                fields: [
                  { name: "crawl_run_id", required: true, description: "Crawl run the page belongs to (params.crawl_run_id)" },
                  { name: "page_id", required: true, description: "Page to fetch — also harness_get resource_id" },
                  {
                    name: "include",
                    required: false,
                    description: "Comma-separated artifacts to inline: accessibility, markdown, metadata, screenshot",
                  },
                ],
              },
            },
          },
        },
        {
          resourceType: "kb_page_artifact",
          displayName: "AIT Page Artifact",
          description:
            "One captured artifact for a crawl page. Text kinds (accessibility, markdown, metadata) return inline content capped at 128 KiB. " +
            "kind=screenshot returns signed_url (+ expires_at) and harness_get also attaches an MCP image content block when the URL is fetchable. " +
            "Raw HTML is never exposed. Do not curl the relicx API or fetch storage buckets yourself. " +
            "harness_get example: resource_type=kb_page_artifact, resource_id=screenshot (kind — last identifier field), " +
            "params={ crawl_run_id: \"<uuid>\", page_id: \"<uuid>\" }. All three of crawl_run_id, page_id, and kind are required.",
          toolset: "ait",
          scope: "account",
          headerBasedScoping: true,
          // An artifact is identified within its page by kind, so that is the last
          // field and therefore what resource_id means for this type.
          identifierFields: ["crawl_run_id", "page_id", "kind"],
          searchAliases: ["page artifact", "accessibility tree", "screenshot signed url", "page markdown"],
          diagnosticHint:
            "resource_id must be the artifact kind (screenshot|accessibility|markdown|metadata); pass crawl_run_id and page_id in params. " +
            "Prefer kb_crawl_page get with include=screenshot for sharing images. Never curl or use S3/GCS CLIs.",
          operations: {
            get: {
              method: "GET",
              path: `${KB}/crawls/{crawlRunId}/pages/{pageId}/artifacts/{kind}`,
              operationPolicy: { risk: "read", retryPolicy: "safe" },
              pathParams: { crawl_run_id: "crawlRunId", page_id: "pageId", kind: "kind" },
              responseExtractor: kbArtifactExtract,
              description:
                "Fetch one artifact. resource_id must be the kind (accessibility | markdown | metadata | screenshot). " +
                "Always pass crawl_run_id and page_id in params. Example: resource_id=screenshot, params={ crawl_run_id, page_id }.",
              paramsSchema: {
                fields: [
                  {
                    name: "crawl_run_id",
                    required: true,
                    description: "Crawl run UUID — required in params (not resource_id)",
                  },
                  {
                    name: "page_id",
                    required: true,
                    description: "Page UUID — required in params (not resource_id)",
                  },
                  {
                    name: "kind",
                    required: true,
                    description:
                      "accessibility | markdown | metadata | screenshot — usually passed as harness_get resource_id",
                  },
                ],
              },
            },
          },
        },
  ],
};
