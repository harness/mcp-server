import { describe, expect, it, vi } from "vitest";
import { releaseManagementToolset } from "../../../src/registry/toolsets/release-management.js";
import { Registry } from "../../../src/registry/index.js";
import type { Config } from "../../../src/config.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { RequestOptions } from "../../../src/client/types.js";
import {
  releaseGetExtract,
  rmgYamlEntityExtract,
  rmgYamlEntityDeleteExtract,
  yamlWriteBody,
  releaseListBody,
  releaseListExtract,
  releaseExecutionPhaseOutputPath,
  releaseExecutionPhaseInputPath,
  releaseExecutionActivityOutputPath,
  normalizeReleaseActivityExecutionInput,
  normalizeReleaseTaskLimit,
  releaseActivityExecutionListExtract,
  RMG_MAX_TASK_LIMIT,
} from "../../../src/registry/extractors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_AUTO_APPROVE_RISK: "none",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (options: RequestOptions) => Promise<unknown>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function firstRequest(mockRequest: ReturnType<typeof vi.fn>): RequestOptions {
  return mockRequest.mock.calls[0][0] as RequestOptions;
}

function resource(type: string) {
  const r = releaseManagementToolset.resources.find((x) => x.resourceType === type);
  if (!r) throw new Error(`${type} missing from release-management toolset`);
  return r;
}

const releaseResource = resource("release");
const releaseProcessResource = resource("release_process");
const releaseDefinitionActivityResource = resource("release_activity");
const releasePhaseResource = resource("release_execution_phase");
const releaseTaskResource = resource("release_execution_task");
const releaseActivityResource = resource("release_execution_activity");
const phaseOutputResource = resource("release_execution_phase_output");
const phaseInputResource = resource("release_execution_phase_input");
const activityOutputResource = resource("release_execution_activity_output");
const releaseInputResource = resource("release_input");
const activityInputResource = resource("release_execution_activity_input");

const buildReleaseListBody = releaseResource.operations.list!.bodyBuilder!;
const releaseListPreflight = releaseResource.operations.list!.preflight!;
const fillScopeFromConfig = releaseProcessResource.operations.list!.preflight!;
const extractReleaseList = releaseResource.operations.list!.responseExtractor!;
const extractPhases = releasePhaseResource.operations.list!.responseExtractor!;
const extractTasks = releaseTaskResource.operations.list!.responseExtractor!;
const buildPhaseOutputPath = phaseOutputResource.operations.get!.pathBuilder!;
const buildPhaseInputPath = phaseInputResource.operations.get!.pathBuilder!;
const buildActivityOutputPath = activityOutputResource.operations.get!.pathBuilder!;
const extractPhaseOutput = phaseOutputResource.operations.get!.responseExtractor!;
const extractPhaseInput = phaseInputResource.operations.get!.responseExtractor!;
const extractActivityOutput = activityOutputResource.operations.get!.responseExtractor!;
const extractReleaseInput = releaseInputResource.operations.get!.responseExtractor!;
const extractActivityInput = activityInputResource.operations.get!.responseExtractor!;
const normalizeActivityPreflight = releaseActivityResource.operations.list!.preflight!;
const normalizeTaskPreflight = releaseTaskResource.operations.list!.preflight!;

describe("release-management toolset", () => {
  it("is loaded by default (not opt-in)", () => {
    expect(releaseManagementToolset.optIn).toBe(false);
  });

  it("is present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).toContain("release_process");
    expect(registry.getAllResourceTypes()).toContain("release");
  });
});

describe("release-management execution resources", () => {
  it("registers definition and execution resource types", () => {
    expect(releaseManagementToolset.resources.map((r) => r.resourceType)).toEqual(
      expect.arrayContaining([
        "release_process",
        "release_activity",
        "release_execution_phase",
        "release_execution_task",
        "release_execution_activity",
        "release_execution_phase_output",
        "release_execution_phase_input",
        "release_execution_activity_output",
        "release_input",
        "release_execution_activity_input",
      ]),
    );
  });

  it("definition resources preflight fills org/project from registry defaults", async () => {
    const input: Record<string, unknown> = {};
    await fillScopeFromConfig({
      client: {} as never,
      input,
      registry: { orgId: "cfgOrg", projectId: "cfgProject" } as never,
    });
    expect(input.org_id).toBe("cfgOrg");
    expect(input.project_id).toBe("cfgProject");
  });

  it("release_process and release_activity use RMG base override and header scoping", () => {
    expect(releaseProcessResource.baseUrlOverride).toBe("rmg");
    expect(releaseProcessResource.headerBasedScoping).toBe(true);
    expect(releaseDefinitionActivityResource.baseUrlOverride).toBe("rmg");
    expect(releaseDefinitionActivityResource.headerBasedScoping).toBe(true);
  });

  it("release_process has no execute action", () => {
    expect(releaseProcessResource.executeActions).toBeUndefined();
    expect(releaseProcessResource.executeHint).toBeUndefined();
  });

  it("definition resources use rmgYamlEntityExtract instead of passthrough", () => {
    for (const op of ["get", "create", "update"] as const) {
      expect(releaseProcessResource.operations[op]?.responseExtractor).toBe(rmgYamlEntityExtract);
      expect(releaseDefinitionActivityResource.operations[op]?.responseExtractor).toBe(rmgYamlEntityExtract);
    }
    expect(releaseProcessResource.operations.delete?.responseExtractor).toBe(rmgYamlEntityDeleteExtract);
    expect(releaseDefinitionActivityResource.operations.delete?.responseExtractor).toBe(rmgYamlEntityDeleteExtract);
  });

  it("release_execution_phase is list-only with empty identifierFields", () => {
    expect(releasePhaseResource.operations.get).toBeUndefined();
    expect(releasePhaseResource.identifierFields).toEqual([]);
    expect(releasePhaseResource.listFilterFields).toContainEqual(
      expect.objectContaining({ name: "release_id", required: true }),
    );
  });

  it("release_execution_phase list hits GET /api/orchestration/execution/{releaseId}/phases", () => {
    expect(releasePhaseResource.operations.list?.method).toBe("GET");
    expect(releasePhaseResource.operations.list?.path).toBe(
      "/api/orchestration/execution/{releaseId}/phases",
    );
  });

  it("release_execution_activity list hits paginated activities path", () => {
    expect(releaseActivityResource.operations.list?.method).toBe("GET");
    expect(releaseActivityResource.operations.list?.path).toBe(
      "/api/release/{releaseId}/execution/activities",
    );
  });

  it("release list hits POST /api/release/list with the Orchestration type param", () => {
    expect(releaseResource.operations.list?.method).toBe("POST");
    expect(releaseResource.operations.list?.path).toBe("/api/release/list");
    expect(releaseResource.operations.list?.staticQueryParams).toEqual({ type: "Orchestration" });
    expect(releaseResource.operations.list?.queryParams).toMatchObject({
      search_term: "searchTerm",
      start_ts: "expectedStartTs",
      end_ts: "expectedEndTs",
    });
  });

  it("release list body carries scope in scopes, not query params", () => {
    expect(
      buildReleaseListBody({ org_id: "org1", project_id: "proj1" }),
    ).toEqual({ scopes: [{ orgIdentifier: "org1", projectIdentifier: "proj1" }] });
  });

  it("release list preflight fills scope from config defaults and builds the time window", async () => {
    const input: Record<string, unknown> = { days_back: 90 };
    await releaseListPreflight({
      client: {} as never,
      input,
      registry: { orgId: "cfgOrg", projectId: "cfgProject" } as never,
    });
    expect(input.org_id).toBe("cfgOrg");
    expect(input.project_id).toBe("cfgProject");
    expect(Number(input.end_ts) - Number(input.start_ts)).toBe(97 * 86_400_000);
  });

  it("release list preflight keeps explicit start_ts/end_ts", async () => {
    const input: Record<string, unknown> = { start_ts: 1, end_ts: 2, days_back: 90 };
    await releaseListPreflight({ client: {} as never, input, registry: {} as never });
    expect(input.start_ts).toBe(1);
    expect(input.end_ts).toBe(2);
  });

  it("release list extractor reads Spring page and legacy releases payloads", () => {
    expect(
      (extractReleaseList({ content: [{ id: "r1" }], totalElements: 7 }) as { items: unknown[]; total: number }),
    ).toEqual({ items: [{ id: "r1" }], total: 7 });
    expect(
      (extractReleaseList({ data: { releases: [{ id: "r2" }] } }) as { items: unknown[] }).items,
    ).toEqual([{ id: "r2" }]);
  });

  it("release list extractor returns everything when no status filter is passed", () => {
    const out = extractReleaseList(
      { content: [{ id: "r1", status: "FAILED" }, { id: "r2", status: "Running" }] },
      {},
    ) as { items: unknown[] };
    expect(out.items).toHaveLength(2);
  });

  it("release list extractor matches an explicit status case-insensitively", () => {
    const out = extractReleaseList(
      { content: [{ id: "r1", status: "RUNNING" }, { id: "r2", status: "Failed" }], totalElements: 40 },
      { status: "Running" },
    ) as { items: Array<{ id: string }>; status_filter: string; total: number; _hint: string };
    expect(out.items.map((r) => r.id)).toEqual(["r1"]);
    expect(out.status_filter).toBe("Running");
    expect(out.total).toBe(1);
    expect(out._hint).toContain("client-side on this page only");
    expect(out._hint).toContain("2 unfiltered items");
  });

  it("release list extractor matches releaseStatus field alias", () => {
    const out = releaseListExtract(
      { content: [{ id: "r1", releaseStatus: "Running" }, { id: "r2", releaseStatus: "Failed" }] },
      { status: "running" },
    ) as { items: Array<{ id: string }> };
    expect(out.items.map((r) => r.id)).toEqual(["r1"]);
  });

  it("release list extractor handles raw array payloads", () => {
    const out = releaseListExtract([{ id: "r1" }, { id: "r2" }]) as { items: unknown[] };
    expect(out.items).toHaveLength(2);
  });

  it("release list body returns empty scopes when org/project absent", () => {
    expect(releaseListBody({})).toEqual({ scopes: [] });
  });

  it("release_execution_phase list extractor maps phases to items", () => {
    const out = extractPhases({
      release_id: "slug-1",
      phases: [{ identifier: "deploy", status: "Running" }],
    }) as { items: unknown[] };
    expect(out.items).toHaveLength(1);
  });

  it("release_execution_task preflight maps size to limit", async () => {
    const input: Record<string, unknown> = { release_id: "gfgfgffg-1.0.0-27d6a", size: 25 };
    await normalizeTaskPreflight({ client: {} as never, input, registry: {} as never });
    expect(input.limit).toBe(25);
  });

  it("release_execution_task list forwards cursor pagination metadata", () => {
    const out = extractTasks(
      { tasks: [{ identifier: "task-1" }], nextRequest: { cursor: "abc" }, last: false },
      { limit: 50 },
    ) as { pagination: { next_cursor?: string; last?: boolean } };
    expect(out.pagination.next_cursor).toBe("abc");
    expect(out.pagination.last).toBe(false);
  });

  it("release_execution_activity preflight builds sort array", async () => {
    const input: Record<string, unknown> = {
      release_id: "gfgfgffg-1.0.0-27d6a",
      status: "RUNNING, FAILED",
      sort_field: "name",
      sort_direction: "asc",
    };
    await normalizeActivityPreflight({ client: {} as never, input, registry: {} as never });
    expect(input.sort).toEqual(["name", "asc"]);
    expect(input.status).toEqual(["RUNNING", "FAILED"]);
  });

  it("release_execution_activity preflight defaults sort to start_ts desc", () => {
    const input: Record<string, unknown> = { release_id: "rel-1" };
    normalizeReleaseActivityExecutionInput(input);
    expect(input.sort).toEqual(["start_ts", "desc"]);
  });

  it("release_execution_activity preflight splits activity_type CSV", () => {
    const input: Record<string, unknown> = {
      release_id: "rel-1",
      activity_type: "Pipeline, Manual",
    };
    normalizeReleaseActivityExecutionInput(input);
    expect(input.activity_type).toEqual(["Pipeline", "Manual"]);
  });

  it("release_execution_task preflight clamps limit to RMG_MAX_TASK_LIMIT", () => {
    const input: Record<string, unknown> = { release_id: "rel-1", limit: 9999 };
    normalizeReleaseTaskLimit(input);
    expect(input.limit).toBe(RMG_MAX_TASK_LIMIT);
  });

  it("release_execution_activity list extractor forwards Spring pagination metadata", () => {
    const out = releaseActivityExecutionListExtract({
      content: [{ identifier: "act-1" }],
      totalElements: 42,
      totalPages: 5,
      size: 10,
      number: 2,
      numberOfElements: 1,
      first: false,
      last: true,
    }) as {
      items: unknown[];
      pagination: { total_elements?: number; last?: boolean };
    };
    expect(out.items).toHaveLength(1);
    expect(out.pagination.total_elements).toBe(42);
    expect(out.pagination.last).toBe(true);
  });

  it("phase input pathBuilder hits /input endpoint", () => {
    const path = buildPhaseInputPath(
      {
        release_id: "rel-slug",
        phase_identifier: "deploy",
      },
      {},
    );
    expect(path).toBe("/api/orchestration/execution/release/rel-slug/phase/deploy/input");
  });

  it("release_execution_phase_input get hits phase execution input endpoint", () => {
    expect(phaseInputResource.operations.get?.path).toBe(
      "/api/orchestration/execution/release/{releaseId}/phase/{phaseIdentifier}/input",
    );
    expect(phaseInputResource.operations.get?.queryParams).toEqual({ phase_execution_id: "phaseExecutionId" });
    expect(phaseInputResource.identifierFields).toEqual(["release_id"]);
  });

  it("phase input extractor returns inputs array", () => {
    const out = extractPhaseInput(
      { inputs: [{ name: "env", value: "qa", type: "string" }] },
      { phase_identifier: "deploy" },
    ) as { inputs: unknown[]; total_inputs: number; phase_identifier: string };
    expect(out.inputs).toHaveLength(1);
    expect(out.total_inputs).toBe(1);
    expect(out.phase_identifier).toBe("deploy");
  });

  it("phase output pathBuilder hits /output endpoint", () => {
    const path = buildPhaseOutputPath(
      {
        release_id: "rel-slug",
        phase_identifier: "deploy",
      },
      {},
    );
    expect(path).toBe("/api/orchestration/execution/release/rel-slug/phase/deploy/output");
  });

  it("activity output pathBuilder hits activity /output endpoint", () => {
    const path = buildActivityOutputPath(
      {
        release_id: "rel-slug",
        phase_identifier: "deploy",
        activity_identifier: "run-pipeline",
      },
      {},
    );
    expect(path).toBe(
      "/api/orchestration/execution/release/rel-slug/phase/deploy/activity/run-pipeline/output",
    );
  });

  it("phase output pathBuilder rejects missing release_id", () => {
    expect(() => releaseExecutionPhaseOutputPath({ phase_identifier: "deploy" }))
      .toThrow("release_id is required");
  });

  it("phase input pathBuilder rejects missing phase_identifier", () => {
    expect(() => releaseExecutionPhaseInputPath({ release_id: "rel-1" }))
      .toThrow("phase_identifier is required");
  });

  it("activity output pathBuilder rejects missing activity_identifier", () => {
    expect(() =>
      releaseExecutionActivityOutputPath({ release_id: "rel-1", phase_identifier: "deploy" }),
    ).toThrow("activity_identifier is required");
  });

  it("release_input get hits releaseInput endpoint", () => {
    expect(releaseInputResource.operations.get?.path).toBe(
      "/api/orchestration/execution/releaseInput/{releaseId}",
    );
  });

  it("release_execution_activity_input get hits activity execution input endpoint", () => {
    expect(activityInputResource.operations.get?.path).toBe(
      "/api/orchestration/execution/activity/{activityExecutionId}/input",
    );
    expect(activityInputResource.identifierFields).toEqual(["activity_execution_id"]);
  });

  it("phase output extractor returns outputs array", () => {
    const out = extractPhaseOutput(
      { outputs: [{ name: "version", value: "1.0" }] },
      { phase_identifier: "deploy" },
    ) as { outputs: unknown[]; total_outputs: number };
    expect(out.outputs).toHaveLength(1);
    expect(out.total_outputs).toBe(1);
  });

  it("release_input extractor returns yaml payload", () => {
    const out = extractReleaseInput({
      release_id: "rel-1",
      process_execution_id: "proc-1",
      yaml: "inputs:\n  env: qa",
    }) as { yaml?: string };
    expect(out.yaml).toContain("env: qa");
  });

  it("activity input extractor returns inputs array", () => {
    const out = extractActivityInput({ inputs: [{ name: "env", value: "qa", type: "string" }] }) as {
      inputs: unknown[];
      total_inputs: number;
    };
    expect(out.inputs).toHaveLength(1);
    expect(out.total_inputs).toBe(1);
  });

  it("activity output extractor includes activity_identifier", () => {
    const out = extractActivityOutput(
      { outputs: [] },
      { phase_identifier: "deploy", activity_identifier: "run-pipeline" },
    ) as { activity_identifier: string };
    expect(out.activity_identifier).toBe("run-pipeline");
  });
});

describe("release-management extractors", () => {
  it("releaseGetExtract flattens releaseInfo envelope", () => {
    expect(releaseGetExtract({ releaseInfo: { id: "rel-1", status: "Running" } })).toEqual({
      release: { id: "rel-1", status: "Running" },
    });
    expect(releaseGetExtract({ id: "rel-2", status: "Failed" })).toEqual({
      id: "rel-2",
      status: "Failed",
    });
  });

  it("rmgYamlEntityExtract projects stable YAML entity fields", () => {
    expect(
      rmgYamlEntityExtract({
        identifier: "deploy-proc",
        name: "Deploy",
        yaml: "process:\n  identifier: deploy-proc",
        orgIdentifier: "org1",
        projectIdentifier: "proj1",
        gitDetails: { branch: "main" },
        extraInternalField: "ignored",
      }),
    ).toEqual({
      identifier: "deploy-proc",
      name: "Deploy",
      yaml: "process:\n  identifier: deploy-proc",
      orgIdentifier: "org1",
      projectIdentifier: "proj1",
      git_details: { branch: "main" },
    });
  });

  it("yamlWriteBody validates required body and yaml", () => {
    expect(yamlWriteBody({ body: { yaml: "process:\n  identifier: p1" } })).toEqual({
      yaml: "process:\n  identifier: p1",
    });
    expect(
      yamlWriteBody({
        body: { yaml: "activity:\n  identifier: a1", git_details: { branch: "main" } },
      }),
    ).toEqual({
      yaml: "activity:\n  identifier: a1",
      git_details: { branch: "main" },
    });
    expect(() => yamlWriteBody({})).toThrow("body is required");
    expect(() => yamlWriteBody({ body: { yaml: "" } })).toThrow("body.yaml is required");
    expect(() => yamlWriteBody({ body: { yaml: 0 } })).toThrow("body.yaml is required");
    expect(() => yamlWriteBody({ body: null })).toThrow("body is required");
  });
});

describe("release-management registry dispatch", () => {
  it("release list uses RMG gateway, header scoping, and scopes in POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "release", "list", {
      org_id: "org1",
      project_id: "proj1",
      start_ts: 1000,
      end_ts: 2000,
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/api/release/list");
    expect(request.baseUrl).toBe("https://app.harness.io/gateway/rmg");
    expect(request.headerBasedScoping).toBe(true);
    expect(request.params?.accountIdentifier).toBeUndefined();
    expect(request.body).toEqual({
      scopes: [{ orgIdentifier: "org1", projectIdentifier: "proj1" }],
    });
    expect(request.params).toMatchObject({
      type: "Orchestration",
      expectedStartTs: 1000,
      expectedEndTs: 2000,
    });
  });

  it("release_process create does not inject orgIdentifier into YAML body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "proc-1" });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "release_process", "create", {
      org_id: "org1",
      project_id: "proj1",
      body: { yaml: "process:\n  identifier: proc-1" },
    });

    const request = firstRequest(mockRequest);
    expect(request.baseUrl).toBe("https://app.harness.io/gateway/rmg");
    expect(request.headerBasedScoping).toBe(true);
    expect(request.body).toEqual({ yaml: "process:\n  identifier: proc-1" });
    expect(request.body).not.toHaveProperty("orgIdentifier");
  });

  it("release_execution_phase list uses header scoping without accountIdentifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ phases: [] });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "release_execution_phase", "list", {
      release_id: "rel-slug-1.0.0-abc",
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("GET");
    expect(request.baseUrl).toBe("https://app.harness.io/gateway/rmg");
    expect(request.headerBasedScoping).toBe(true);
    expect(request.params?.accountIdentifier).toBeUndefined();
    expect(request.path).toContain("rel-slug-1.0.0-abc");
  });
});
