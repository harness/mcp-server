/**
 * AIT (AI Test) knowledge-base toolset — crawl an application environment and read
 * the crawled pages back as grounding for test authoring.
 *
 * Served by the AIT API behind the Harness gateway at {HARNESS_BASE_URL}/ait/api/v1/kb/…
 * AIT resolves the owning organization from the PAT itself (Harness account →
 * AIT org), so these resources scope through the Harness-Account header only:
 * headerBasedScoping keeps accountIdentifier out of the query string and keeps
 * org/project out of write bodies, which the AIT routes reject as unknown fields.
 *
 * Pagination is cursor-based, not page-based: pass `size` for the page size and
 * the `cursor` filter (from a previous response's `nextCursor`) to continue.
 */
import type { BodySchema, ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";
import { isRecord } from "../../utils/type-guards.js";

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

export const aitToolset: ToolsetDefinition = {
  name: "ait",
  displayName: "AIT Knowledge Base",
  description: "AIT knowledge base — define crawls of an application environment and read the crawled pages and artifacts",
  optIn: true,
  resources: [
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
