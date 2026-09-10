import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import YAML from "yaml";
import type { Config } from "../../src/config.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { vibeToolset } from "../../src/registry/toolsets/vibe.js";
import {
  vibeProjectExtract,
  vibeExecutionExtract,
  vibeLifecycleExtract,
  vibeLifecycleEventsExtract,
  vibePrepareExtract,
} from "../../src/registry/extractors.js";

const appId = "08aff27b-6108-4589-bc39-eb32f94c8d5e";
const imported = { id: appId, name: "demo", source_type: "github", source_path: "repo", latest_execution_id: null, created_at: "2026-09-09T00:00:00Z" };
const upload = {
  projectId: appId,
  sourceId: "source-1",
  upload: { uploadId: "upload-1", expiresAt: "2026-09-09T01:00:00Z", files: [
    { path: "app.zip", objectPath: "sources/a.zip", uploadUrl: "https://storage.example/a.zip?sig=a%2Bb&expires=123", method: "PUT", headers: { "Content-Type": "application/zip", "x-custom": "signed-value" }, expiresAt: "2026-09-09T01:00:00Z" },
  ] },
};
const execution = { id: "exec-1", project_id: appId, status: "pending", error_message: null, created_at: "2026-09-09T00:00:00Z" };
const progress = {
  app: { id: appId, name: "demo", status: "building", approvalStatus: "pending", previewUrl: null, productionUrl: null, isOnboarded: false },
  execution: { id: "exec-1", appId, type: "import_and_preview", status: "running", startedAt: "2026-09-09T00:00:00Z", triggeredBy: "user", stages: [] },
  currentStageKey: null, overallPercent: 0, elapsedSeconds: 0, phase: "setting_up",
};
const event = { type: "heartbeat", payload: { percent: 0 }, at: "2026-09-09T00:00:00Z" };

function config(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user", HARNESS_API_KEY: "pat.account.id.secret", HARNESS_ACCOUNT_ID: "account",
    HARNESS_BASE_URL: "https://app.harness.io", HARNESS_ORG: "ambient-org", HARNESS_PROJECT: "ambient-project",
    HARNESS_API_TIMEOUT_MS: 5000, HARNESS_MAX_RETRIES: 2, HARNESS_RATE_LIMIT_RPS: 1000,
    HARNESS_TOOLSETS: "vibe", HARNESS_READ_ONLY: false, HARNESS_AUTO_APPROVE_RISK: "all", LOG_LEVEL: "error",
    ...overrides,
  } as Config;
}

function response(value: unknown): Response { return new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } }); }

describe("Vibe OpenAPI coverage", () => {
  it("maps every operation from the supplied contract exactly once", () => {
    const api = YAML.parse(readFileSync(new URL("../fixtures/vibe-bff-openapi.yaml", import.meta.url), "utf8"));
    const expected = Object.entries(api.paths).flatMap(([path, methods]) => Object.keys(methods as object).map(method => `${method.toUpperCase()} ${api.servers[0].url}${path}`));
    const specs = vibeToolset.resources.flatMap(r => [...Object.values(r.operations), ...Object.values(r.executeActions ?? {})]);
    expect(specs.map(s => `${s.method} ${s.path}`).sort()).toEqual(expected.sort());
    expect(specs).toHaveLength(5);
    expect(new Registry(config()).getAllResourceTypes()).toEqual(["vibe_app_lifecycle", "vibe_project"]);
  });

  it("supports discovery and filtering without inventing additional CRUD endpoints", () => {
    expect(new Registry(config({ HARNESS_TOOLSETS: undefined })).getAllResourceTypes()).toContain("vibe_project");
    expect(new Registry(config({ HARNESS_TOOLSETS: "-vibe" })).getAllResourceTypes()).not.toContain("vibe_project");
    const registry = new Registry(config());
    expect(Object.keys(registry.getResource("vibe_project").operations)).toEqual(["create"]);
    expect(Object.keys(registry.getResource("vibe_app_lifecycle").operations)).toEqual(["get"]);
    expect(registry.searchResources("vibe").map(r => r.type)).toEqual(expect.arrayContaining(["vibe_project", "vibe_app_lifecycle"]));
  });
});

describe("Vibe wire contracts through the registry and HTTP client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { fetchSpy = vi.spyOn(globalThis, "fetch"); });
  afterEach(() => { vi.restoreAllMocks(); });

  const cases = [
    { resource: "vibe_project", operation: "create", path: "/projects/import", method: "POST", body: { mode: "github_connector", connector_ref: "org.github", repository: "demo", options: { branch: "main", enabled: false } }, out: imported },
    { resource: "vibe_project", operation: "prepare", path: "/projects/prepare", method: "POST", body: { name: "demo", file: { path: "app.zip", size_bytes: 0, content_type: null, md5: null } }, out: upload },
    { resource: "vibe_project", operation: "deploy", path: "/projects/deploy", method: "POST", body: { project_id: appId }, out: execution },
    { resource: "vibe_app_lifecycle", operation: "get", path: `/apps/${appId}/lifecycle`, method: "GET", body: undefined, out: progress },
    { resource: "vibe_app_lifecycle", operation: "events", path: `/apps/${appId}/lifecycle/events`, method: "GET", body: undefined, out: event },
  ];
  it.each(cases)("$operation sends the exact path/body with no ambient scope leakage", async ({ resource, operation, path, method, body, out }) => {
    fetchSpy.mockResolvedValue(operation === "events" ? new Response(`data: ${JSON.stringify(out)}\n\n`, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } }) : response(out));
    const cfg = config();
    const registry = new Registry(cfg);
    const client = new HarnessClient(cfg);
    const input = { app_id: appId, body, org_id: "explicit-org", project_id: "harness-project" };
    const result = operation === "get" || operation === "create"
      ? await registry.dispatch(client, resource, operation, input)
      : await registry.dispatchExecute(client, resource, operation, input);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe(`https://app.harness.io/vibe/v1${path}`);
    expect(init?.method).toBe(method);
    expect(init?.body).toBe(body === undefined ? undefined : JSON.stringify(body));
    expect(init?.headers).toMatchObject({ "Harness-Account": "account", "x-api-key": cfg.HARNESS_API_KEY });
    if (operation === "events") {
      expect(init?.headers).toMatchObject({ Accept: "text/event-stream" });
      expect(result).toEqual({ events: [event], stop_reason: "end" });
    } else expect(result).toEqual(out);
  });

  it("forwards per-session OAuth bearer auth on the same Harness connection", async () => {
    fetchSpy.mockResolvedValue(response(progress));
    const cfg = config({ HARNESS_MCP_MODE: "oauth", HARNESS_API_KEY: "" });
    const client = new HarnessClient(cfg);
    client.setBearerTokenResolver(() => "session-token");
    await new Registry(cfg).dispatch(client, "vibe_app_lifecycle", "get", { app_id: appId });
    const headers = fetchSpy.mock.calls[0]![1]?.headers;
    expect(headers).toMatchObject({ Authorization: "Bearer session-token" });
    expect(headers).not.toHaveProperty("x-api-key");
  });

  it("does not reconnect after a stream abort, even when HTTP retries are enabled", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new DOMException("Connection lost", "AbortError")); } });
    fetchSpy.mockResolvedValue(new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
    const cfg = config();
    await expect(new Registry(cfg).dispatchExecute(new HarnessClient(cfg), "vibe_app_lifecycle", "events", { app_id: appId }))
      .rejects.toMatchObject({ statusCode: 502, message: "Event stream read failed" });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it.each(["create", "prepare", "deploy"])("does not retry %s on a server error", async operation => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: { code: "VIBE_FAILED", message: "Vibe rejected this operation" } }), { status: 503 }));
    const cfg = config();
    const registry = new Registry(cfg);
    const client = new HarnessClient(cfg);
    const body = operation === "create" ? { mode: "github_link" } : operation === "prepare" ? { name: "demo", file: { path: "a.zip" } } : { project_id: appId };
    const call = operation === "create" ? registry.dispatch(client, "vibe_project", "create", { body }) : registry.dispatchExecute(client, "vibe_project", operation, { body });
    await expect(call).rejects.toMatchObject({ message: "Vibe rejected this operation", harnessCode: "VIBE_FAILED", statusCode: 503 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("preserves nested BFF errors from the event endpoint", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: { code: "APP_NOT_FOUND", message: "App was not found" } }), { status: 404 }));
    const cfg = config();
    await expect(new Registry(cfg).dispatchExecute(new HarnessClient(cfg), "vibe_app_lifecycle", "events", { app_id: appId })).rejects.toMatchObject({ harnessCode: "APP_NOT_FOUND", statusCode: 404, message: "App was not found" });
  });

  it("encodes app path identifiers and rejects unsupported resource scopes", async () => {
    fetchSpy.mockResolvedValue(response(progress));
    const cfg = config();
    const registry = new Registry(cfg);
    const client = new HarnessClient(cfg);
    await registry.dispatch(client, "vibe_app_lifecycle", "get", { app_id: "app /?#" });
    expect(String(fetchSpy.mock.calls[0]![0])).toContain("/apps/app%20%2F%3F%23/lifecycle");
    await expect(registry.dispatch(client, "vibe_app_lifecycle", "get", { app_id: appId, resource_scope: "project" })).rejects.toThrow("does not support project scope");
  });
});

describe("Vibe validation and projection", () => {
  const invalid = [
    { action: "create", input: {}, error: "body must" },
    { action: "create", input: { body: { mode: " " } }, error: "body.mode" },
    { action: "create", input: { body: { mode: 1 } }, error: "body.mode" },
    { action: "prepare", input: { body: { name: "demo" } }, error: "body.file" },
    { action: "prepare", input: { body: { name: "demo", file: [] } }, error: "body.file" },
    { action: "prepare", input: { body: { name: "demo", file: { path: "" } } }, error: "body.file.path" },
    ...[-1, 1.5, "100", false].map(size => ({ action: "prepare", input: { body: { name: "demo", file: { path: "a.zip", size_bytes: size } } }, error: "size_bytes" })),
    { action: "prepare", input: { body: { name: "demo", file: { path: "a.zip", content_type: 1 } } }, error: "content_type" },
    { action: "prepare", input: { body: { name: "demo", file: { path: "a.zip", md5: false } } }, error: "md5" },
    { action: "deploy", input: { project_id: "ambient-project" }, error: "Vibe app id" },
    { action: "deploy", input: { body: { projectId: appId } }, error: "body.project_id" },
    { action: "deploy", input: { app_id: "a", body: { project_id: "b" } }, error: "conflicts" },
    { action: "deploy", input: { body: { project_id: null } }, error: "body.project_id" },
    { action: "deploy", input: { body: "not-an-object" }, error: "body must" },
  ];
  it.each(invalid)("rejects invalid $action input before HTTP", async ({ action, input, error }) => {
    const request = vi.fn();
    const client = { request } as unknown as HarnessClient;
    const registry = new Registry(config());
    const call = action === "create" ? registry.dispatch(client, "vibe_project", "create", input) : registry.dispatchExecute(client, "vibe_project", action, input);
    await expect(call).rejects.toThrow(error);
    expect(request).not.toHaveBeenCalled();
  });

  it("passes import mode-specific fields through to the request body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(imported));
    const cfg = config();
    const registry = new Registry(cfg);
    const client = new HarnessClient(cfg);
    const body = { mode: "github_connector", connector_ref: "org.github", repository: "demo", options: { branch: "main" } };
    await registry.dispatch(client, "vibe_project", "create", { body });
    expect(JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string)).toEqual(body);
    vi.restoreAllMocks();
  });

  it("accepts null size_bytes on prepare and deploys with app_id only", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(upload))
      .mockResolvedValueOnce(response(execution));
    const cfg = config();
    const registry = new Registry(cfg);
    const client = new HarnessClient(cfg);
    const prepareBody = { name: "demo", file: { path: "app.zip", size_bytes: null, content_type: null, md5: null } };
    await registry.dispatchExecute(client, "vibe_project", "prepare", { body: prepareBody });
    expect(JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string)).toEqual(prepareBody);
    await registry.dispatchExecute(client, "vibe_project", "deploy", { app_id: appId });
    expect(JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string)).toEqual({ project_id: appId });
    vi.restoreAllMocks();
  });

  it("keeps signed upload URLs and headers byte-for-byte while removing internal fields", () => {
    const raw = structuredClone(upload);
    Object.assign(raw, { internal: "remove" });
    Object.assign(raw.upload, { debug: true });
    Object.assign(raw.upload.files[0]!, { secretInternal: "remove" });
    expect(vibePrepareExtract(raw)).toEqual(upload);
    expect(raw).toHaveProperty("internal");
  });

  it("preserves detailed lifecycle failures, empty arrays, zero values and nulls", () => {
    const failure = { stageKey: "build", summary: "failed", exitCode: 0, logLines: [], attempt: 0, aiReason: { rootCause: "dependency", primaryError: { ref: "line:1", message: "compile" }, suggestedFix: null, fixPrompt: "Fix the compile error", generatedInMs: 0 } };
    const stage = { id: "stage-1", executionId: "exec-1", appId, stageKey: "build", order: 0, status: "failed", endUserMessage: "failed", adminMessage: "compile", failure, subSteps: [{ key: "compile", label: "Compile", state: "failed", detail: null }], logs: [], artifactRefs: [] };
    const expected = { ...progress, execution: { ...progress.execution, stages: [stage] }, failure };
    const raw = structuredClone(expected);
    Object.assign(raw, { debug: true });
    Object.assign(raw.app, { internal: true });
    Object.assign(raw.execution.stages[0]!, { internal: true });
    Object.assign(raw.failure.aiReason.primaryError, { internal: true });
    expect(vibeLifecycleExtract(raw)).toEqual(expected);
    expect(vibeLifecycleEventsExtract({ events: [{ ...event, payload: { arbitrary: { values: [] } }, debug: true }], stop_reason: "duration_limit", internal: true })).toEqual({ events: [{ ...event, payload: { arbitrary: { values: [] } } }], stop_reason: "duration_limit" });
  });

  it("strips internal metadata from project and execution responses", () => {
    const projectRaw = { ...imported, internal: true, debug: { nested: true } };
    expect(vibeProjectExtract(projectRaw)).toEqual(imported);
    const executionRaw = { ...execution, traceId: "remove", internal: true };
    expect(vibeExecutionExtract(executionRaw)).toEqual(execution);
  });

  it.each([
    {
      label: "prepare upload files",
      call: () => vibePrepareExtract({ projectId: appId, sourceId: "s", upload: { uploadId: "u", files: "bad", expiresAt: "t" } }),
      error: "files must be an array",
    },
    {
      label: "lifecycle event batch",
      call: () => vibeLifecycleEventsExtract({ events: "bad", stop_reason: "end" }),
      error: "events must be an array",
    },
  ])("rejects malformed $label responses", ({ call, error }) => {
    expect(call).toThrow(error);
  });
});
