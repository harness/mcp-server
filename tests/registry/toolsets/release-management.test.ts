import { describe, expect, it } from "vitest";
import { releaseManagementToolset } from "../../../src/registry/toolsets/release-management.js";
import { Registry } from "../../../src/registry/index.js";
import type { Config } from "../../../src/config.js";

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
    ...overrides,
  };
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
      { content: [{ id: "r1", status: "RUNNING" }, { id: "r2", status: "Failed" }] },
      { status: "Running" },
    ) as { items: Array<{ id: string }>; status_filter: string };
    expect(out.items.map((r) => r.id)).toEqual(["r1"]);
    expect(out.status_filter).toBe("Running");
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

  it("phase input pathBuilder hits /input endpoint", () => {
    const path = buildPhaseInputPath({
      release_id: "rel-slug",
      phase_identifier: "deploy",
    });
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
    const path = buildPhaseOutputPath({
      release_id: "rel-slug",
      phase_identifier: "deploy",
    });
    expect(path).toBe("/api/orchestration/execution/release/rel-slug/phase/deploy/output");
  });

  it("activity output pathBuilder hits activity /output endpoint", () => {
    const path = buildActivityOutputPath({
      release_id: "rel-slug",
      phase_identifier: "deploy",
      activity_identifier: "run-pipeline",
    });
    expect(path).toBe(
      "/api/orchestration/execution/release/rel-slug/phase/deploy/activity/run-pipeline/output",
    );
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
