import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { autonomousWorkToolset } from "../../src/registry/toolsets/autonomous_work.js";
import { compactItems } from "../../src/utils/compact.js";
import { normalizeHarnessListPayload } from "../../src/utils/response-formatter.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "adlc-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "autonomous_work",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const workArtifact = autonomousWorkToolset.resources.find((r) => r.resourceType === "work_artifact");
const workPhaseArtifact = autonomousWorkToolset.resources.find((r) => r.resourceType === "work_phase_artifact");
const workItem = autonomousWorkToolset.resources.find((r) => r.resourceType === "work_item");

describe("work_artifact resource shape", () => {
  it("is project-scoped with catalog identifiers (no phase_id)", () => {
    expect(workArtifact).toBeDefined();
    expect(workArtifact!.toolset).toBe("autonomous_work");
    expect(workArtifact!.scope).toBe("project");
    expect(workArtifact!.identifierFields).toEqual(["work_item_id", "artifact_id"]);
  });

  it("lists via POST catalog path and gets via catalog UUID path", () => {
    expect(Object.keys(workArtifact!.operations).sort()).toEqual(["get", "list"]);
    expect(workArtifact!.operations.list).toMatchObject({
      method: "POST",
      path: "/adlc/api/workitems/{workItemId}/artifacts",
      skipScopeBodyInjection: true,
      skipCompact: true,
    });
    expect(workArtifact!.operations.list!.queryParams).toEqual({
      offset: "offset",
      size: "limit",
      phase_id: "phaseId",
    });
    expect(workArtifact!.operations.list!.pathParams).toEqual({ work_item_id: "workItemId" });
    expect(workArtifact!.operations.list!.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
    expect(workArtifact!.operations.get).toMatchObject({
      method: "GET",
      path: "/adlc/api/workitems/{workItemId}/artifacts/{artifactId}",
    });
    expect(workArtifact!.operations.get!.pathParams).toEqual({
      work_item_id: "workItemId",
      artifact_id: "artifactId",
    });
    expect(workArtifact!.operations.get!.path).not.toContain("phases");
    expect(workArtifact!.operations.get!.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });

  it("requires type filter with ArtifactType enum and optional phase_id", () => {
    const typeField = workArtifact!.listFilterFields?.find((f) => f.name === "type");
    const phaseField = workArtifact!.listFilterFields?.find((f) => f.name === "phase_id");
    expect(typeField).toMatchObject({ required: true });
    expect(typeField!.enum).toEqual(["TICKET", "DESIGN", "PULL_REQUEST", "PLAN", "OTHER"]);
    expect(phaseField).toBeDefined();
    expect(phaseField!.required).toBeFalsy();
  });

  it("still exposes phase collection list on work_phase_artifact", () => {
    expect(workPhaseArtifact!.operations.list).toMatchObject({
      method: "GET",
      path: "/adlc/api/workitems/{workItemId}/phases/{phaseId}/artifacts",
    });
  });

  it("links work_artifact from work_phase_artifact relatedResources", () => {
    expect(workPhaseArtifact!.relatedResources?.some((r) => r.resourceType === "work_artifact")).toBe(true);
  });

  it("links work_artifact from work_item relatedResources", () => {
    expect(workItem!.relatedResources?.some((r) => r.resourceType === "work_artifact")).toBe(true);
  });
});

describe("work_artifact dispatch", () => {
  it("POSTs list with type body, offset/limit query, and no org/project in body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [{ id: "art-1", type: "DESIGN", title: "Design" }],
      total: 1,
      limit: 20,
      offset: 0,
      exceptions: [],
    });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "DESIGN",
      page: 0,
      size: 20,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/workitems/WI-1/artifacts");
    expect(call.body).toEqual({ type: "DESIGN" });
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
    expect(call.params.offset).toBe(0);
    expect(call.params.limit).toBe(20);
    expect(call.params.orgIdentifier).toBe("default");
    expect(call.params.projectIdentifier).toBe("adlc-project");
  });

  it("emits _nextPageHint with page × size contract and active filters", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [{ id: "art-1" }],
      total: 40,
      limit: 20,
      offset: 0,
      exceptions: [],
    });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "DESIGN",
      phase_id: "implement",
      page: 0,
      size: 20,
    }) as { _nextPageHint: string };

    expect(result._nextPageHint).toContain("resource_type='work_artifact'");
    expect(result._nextPageHint).toContain('"work_item_id":"WI-1"');
    expect(result._nextPageHint).toContain('"type":"DESIGN"');
    expect(result._nextPageHint).toContain('"phase_id":"implement"');
    expect(result._nextPageHint).toContain('"page":1');
    expect(result._nextPageHint).toContain('"size":20');
    expect(result._nextPageHint).toContain("offset = page × size");
    expect(result._nextPageHint).toContain("work_item list");
  });

  it("says no more pages when the catalog total fits on this page", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [{ id: "art-1" }], total: 1, exceptions: [] });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "DESIGN",
    }) as { _nextPageHint: string };

    expect(result._nextPageHint).toMatch(/No more pages/i);
  });

  it("maps harness_list page to ADLC offset as page × size", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], total: 40, limit: 20, offset: 20, exceptions: [] });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "DESIGN",
      page: 1,
      size: 20,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.offset).toBe(20);
    expect(call.params.limit).toBe(20);
  });

  it("forwards type into the POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0, exceptions: [] });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "DESIGN",
    });

    expect(mockRequest.mock.calls[0][0].body).toEqual({ type: "DESIGN" });
  });

  it("keeps skipCompact when the API omits total so source_url survives list compact", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [{
        id: "art-1",
        type: "DESIGN",
        title: "Design",
        source_url: "https://example.invalid/design",
        version: 2,
        path: "design.md",
      }],
      exceptions: [],
    });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "DESIGN",
    }) as Record<string, unknown> & { items: Array<Record<string, unknown>>; __skipCompact?: boolean };

    expect(result.__skipCompact).toBe(true);
    expect(result.total).toBe(1);

    const normalized = normalizeHarnessListPayload(result, { page: 0 }) as typeof result;
    expect(normalized.__skipCompact).toBe(true);
    expect(normalized.items[0]?.source_url).toBe("https://example.invalid/design");
    expect(normalized.items[0]?.version).toBe(2);
    expect(normalized.items[0]?.path).toBe("design.md");

    const compacted = compactItems(normalized.items);
    expect((compacted[0] as Record<string, unknown>).source_url).toBeUndefined();
  });

  it("forwards optional phase_id as phaseId query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0, exceptions: [] });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_artifact", "list", {
      work_item_id: "WI-1",
      type: "PULL_REQUEST",
      phase_id: "implement",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.phaseId).toBe("implement");
    expect(call.body).toEqual({ type: "PULL_REQUEST" });
  });

  it("rejects list without type", async () => {
    const registry = new Registry(makeConfig());
    const client = makeClient();
    await expect(
      registry.dispatch(client, "work_artifact", "list", { work_item_id: "WI-1" }),
    ).rejects.toThrow(/Missing required filter.*type/);
  });

  it("GETs content by catalog id without phaseId in the path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      id: "art-1",
      type: "DESIGN",
      title: "Design",
      mime_type: "text/markdown",
      encoding: "plain",
      content: "# hello",
      fetched_at: 1,
    });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_artifact", "get", {
      work_item_id: "WI-1",
      artifact_id: "art-1",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/adlc/api/workitems/WI-1/artifacts/art-1");
    expect(call.path).not.toContain("phases");
  });
});
