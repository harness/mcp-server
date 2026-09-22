/**
 * Production coverage for GitOps auto-create Phase B wait:
 * - sumAutoCreateCounts / pollAutoCreateLogs helpers
 * - EndpointSpec.execute hook via dispatchExecute(action='wait')
 * - Validation, skip, complete, timeout, abort, transient errors, read-only
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RegistryDispatchInterface, HarnessClientInterface } from "../../src/registry/types.js";
import {
  sumAutoCreateCounts,
  pollAutoCreateLogs,
} from "../../src/registry/toolsets/gitops.js";
import { AbortError } from "../../src/utils/poll-execution.js";

const PAGE_SIZE = 100;

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "gitops",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function logPage(total: number, extras: Record<string, unknown> = {}): Record<string, unknown> {
  const logs = Array.from({ length: Math.min(total, 2) }, (_, i) => ({
    resourceType: "service",
    status: "SUCCESS",
    name: `svc-${i}`,
  }));
  return {
    logs,
    total,
    successServices: extras.successServices ?? 0,
    failedServices: extras.failedServices ?? 0,
    successEnvironments: extras.successEnvironments ?? 0,
    failedEnvironments: extras.failedEnvironments ?? 0,
    successClusterLinks: extras.successClusterLinks ?? 0,
    failedClusterLinks: extras.failedClusterLinks ?? 0,
    ...extras,
  };
}

/** Fake registry.dispatch that walks a queued list of pages / errors. */
function makePollRegistry(pages: Array<unknown | Error>): {
  registry: RegistryDispatchInterface;
  dispatch: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const dispatch = vi.fn(async (_client, resourceType, operation, input) => {
    expect(resourceType).toBe("gitops_autocreate_log");
    expect(operation).toBe("list");
    expect(input.agent_id).toBeDefined();
    expect(input.import_request_id).toBeDefined();
    expect(input.size).toBe(PAGE_SIZE);

    const next = pages[Math.min(i, pages.length - 1)];
    i++;
    if (next instanceof Error) throw next;

    // Mimic autoCreateLogExtract so poll sees the same shape as production list.
    const raw = next as Record<string, unknown>;
    const logs = Array.isArray(raw.logs) ? raw.logs : [];
    return {
      items: logs,
      total: typeof raw.total === "number" ? raw.total : logs.length,
      successServices: raw.successServices ?? 0,
      failedServices: raw.failedServices ?? 0,
      successEnvironments: raw.successEnvironments ?? 0,
      failedEnvironments: raw.failedEnvironments ?? 0,
      successClusterLinks: raw.successClusterLinks ?? 0,
      failedClusterLinks: raw.failedClusterLinks ?? 0,
    };
  });

  return {
    registry: { dispatch, orgId: undefined, projectId: undefined } as unknown as RegistryDispatchInterface,
    dispatch,
  };
}

const fakeClient = {} as unknown as HarnessClientInterface;

/** Drain fake timers + microtasks until the poll promise settles. */
async function flushPoll(maxIterations = 400): Promise<void> {
  for (let i = 0; i < maxIterations; i++) {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);
  }
}

// ---------------------------------------------------------------------------
// sumAutoCreateCounts
// ---------------------------------------------------------------------------

describe("sumAutoCreateCounts", () => {
  it("sums the three planned fields", () => {
    expect(sumAutoCreateCounts({
      serviceCount: 2,
      environmentCount: 1,
      clusterLinkCount: 3,
    })).toBe(6);
  });

  it("treats missing / non-finite fields as 0", () => {
    expect(sumAutoCreateCounts(undefined)).toBe(0);
    expect(sumAutoCreateCounts({})).toBe(0);
    expect(sumAutoCreateCounts({ serviceCount: 2 })).toBe(2);
    expect(sumAutoCreateCounts({
      serviceCount: Number.NaN,
      environmentCount: "1" as unknown as number,
      clusterLinkCount: Infinity,
    })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pollAutoCreateLogs (helper)
// ---------------------------------------------------------------------------

describe("pollAutoCreateLogs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fast = { timeoutMs: 500, intervalMs: 100 };

  it("skips the API when planned <= 0", async () => {
    const { registry, dispatch } = makePollRegistry([logPage(99)]);

    const result = await pollAutoCreateLogs(registry, fakeClient, {
      agentId: "account.myagent",
      importRequestId: "imp-1",
      planned: 0,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      import_request_id: "imp-1",
      planned: 0,
      total: 0,
      complete: true,
      timed_out: false,
      skipped: true,
      poll_count: 0,
    });
  });

  it("completes on the first poll when total already covers planned", async () => {
    const { registry, dispatch } = makePollRegistry([
      logPage(3, { successServices: 2, successEnvironments: 1 }),
    ]);

    const promise = pollAutoCreateLogs(registry, fakeClient, {
      agentId: "account.myagent",
      importRequestId: "imp-2",
      planned: 3,
      resourceScope: "account",
      ...fast,
    });

    await flushPoll();
    const result = await promise;

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![3]).toMatchObject({
      agent_id: "account.myagent",
      import_request_id: "imp-2",
      resource_scope: "account",
      size: PAGE_SIZE,
    });
    expect(result).toMatchObject({
      complete: true,
      timed_out: false,
      skipped: false,
      planned: 3,
      total: 3,
      poll_count: 1,
      successServices: 2,
      successEnvironments: 1,
    });
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("polls until total >= planned across intervals", async () => {
    const { registry, dispatch } = makePollRegistry([
      logPage(0),
      logPage(1),
      logPage(4),
    ]);

    const promise = pollAutoCreateLogs(registry, fakeClient, {
      agentId: "org.myagent",
      importRequestId: "imp-3",
      planned: 4,
      resourceScope: "org",
      orgId: "default",
      timeoutMs: 5_000,
      intervalMs: 100,
    });

    await flushPoll();
    const result = await promise;

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch.mock.calls[2]![3]).toMatchObject({
      agent_id: "org.myagent",
      org_id: "default",
      resource_scope: "org",
    });
    expect(result.complete).toBe(true);
    expect(result.total).toBe(4);
    expect(result.poll_count).toBe(3);
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(200);
  });

  it("returns timed_out with last page when planned never arrives", async () => {
    const { registry, dispatch } = makePollRegistry([logPage(1)]);

    const promise = pollAutoCreateLogs(registry, fakeClient, {
      agentId: "myagent",
      importRequestId: "imp-4",
      planned: 10,
      resourceScope: "project",
      orgId: "default",
      projectId: "proj",
      timeoutMs: 500,
      intervalMs: 100,
    });

    await flushPoll();
    const result = await promise;

    expect(result.timed_out).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.total).toBe(1);
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(500);
    expect(dispatch.mock.calls.length).toBeGreaterThan(1);
    expect(dispatch.mock.calls[0]![3]).toMatchObject({
      project_id: "proj",
      org_id: "default",
    });
  });

  it("throws AbortError when the signal aborts during sleep", async () => {
    const { registry } = makePollRegistry([logPage(0)]);
    const controller = new AbortController();

    const promise = pollAutoCreateLogs(registry, fakeClient, {
      agentId: "account.myagent",
      importRequestId: "imp-5",
      planned: 5,
      signal: controller.signal,
      timeoutMs: 60_000,
      intervalMs: 1_000,
    });

    await vi.advanceTimersByTimeAsync(10);
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const { registry, dispatch } = makePollRegistry([logPage(5)]);
    const controller = new AbortController();
    controller.abort();

    await expect(
      pollAutoCreateLogs(registry, fakeClient, {
        agentId: "account.myagent",
        importRequestId: "imp-6",
        planned: 5,
        signal: controller.signal,
        ...fast,
      }),
    ).rejects.toBeInstanceOf(AbortError);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("tolerates transient list errors then completes", async () => {
    const { registry } = makePollRegistry([
      new Error("502 Bad Gateway"),
      logPage(0),
      logPage(2),
    ]);

    const promise = pollAutoCreateLogs(registry, fakeClient, {
      agentId: "account.myagent",
      importRequestId: "imp-7",
      planned: 2,
      timeoutMs: 5_000,
      intervalMs: 100,
    });

    await flushPoll();
    const result = await promise;

    expect(result.complete).toBe(true);
    expect(result.total).toBe(2);
    expect(result.poll_count).toBe(3);
  });

  it("throws after consecutive persistent list failures", async () => {
    const errors = Array.from({ length: 8 }, () => new Error("503 Service Unavailable"));
    const { registry } = makePollRegistry(errors);

    const promise = pollAutoCreateLogs(registry, fakeClient, {
      agentId: "account.myagent",
      importRequestId: "imp-8",
      planned: 2,
      timeoutMs: 60_000,
      intervalMs: 100,
    });
    const rejection = expect(promise).rejects.toThrow(
      /Polling auto-create logs for imp-8 failed after 5 consecutive attempts/,
    );

    await flushPoll();
    await rejection;
  });
});

// ---------------------------------------------------------------------------
// dispatchExecute action='wait' (registry + execute hook)
// ---------------------------------------------------------------------------

describe("gitops_autocreate_log execute action=wait", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers wait as a read execute action with execute hook", () => {
    const def = registry.getResource("gitops_autocreate_log");
    const wait = def.executeActions?.wait;
    expect(wait).toBeDefined();
    expect(wait?.operationPolicy.risk).toBe("read");
    expect(typeof wait?.execute).toBe("function");
    expect(wait?.paramsSchema?.fields.some((f) => f.name === "import_request_id" && f.required)).toBe(true);
    expect(wait?.bodySchema?.fields.some((f) => f.name === "autoCreateCounts" && f.required)).toBe(true);
    expect(def.executeHint).toMatch(/action='wait'/);
  });

  it("skips HTTP when planned counts sum to 0", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "gitops_autocreate_log", "wait", {
      agent_id: "account.myagent",
      resource_scope: "account",
      import_request_id: "507f1f77bcf86cd799439011",
      body: {
        autoCreateCounts: { serviceCount: 0, environmentCount: 0, clusterLinkCount: 0 },
      },
    }) as Record<string, unknown>;

    expect(mockRequest).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      skipped: true,
      complete: true,
      planned: 0,
      import_request_id: "507f1f77bcf86cd799439011",
    });
  });

  it("polls list via the execute hook until complete", async () => {
    const mockRequest = vi.fn()
      .mockResolvedValueOnce(logPage(0))
      .mockResolvedValueOnce(logPage(3, { successServices: 2, successEnvironments: 1 }));
    const client = makeClient(mockRequest);

    const promise = registry.dispatchExecute(client, "gitops_autocreate_log", "wait", {
      agent_id: "account.myagent",
      resource_scope: "account",
      import_request_id: "imp-live",
      body: {
        autoCreateCounts: { serviceCount: 2, environmentCount: 1, clusterLinkCount: 0 },
      },
    });

    await flushPoll();
    const result = await promise as Record<string, unknown>;

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const first = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(first.method).toBe("GET");
    expect(first.path).toBe("/gitops/api/v1/agents/account.myagent/autocreate-logs");
    expect(first.params.importRequestId).toBe("imp-live");
    expect(first.params.limit).toBe(PAGE_SIZE);

    expect(result).toMatchObject({
      complete: true,
      timed_out: false,
      skipped: false,
      planned: 3,
      total: 3,
      poll_count: 2,
      successServices: 2,
      successEnvironments: 1,
    });
  });

  it("requires import_request_id", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_autocreate_log", "wait", {
        agent_id: "account.myagent",
        resource_scope: "account",
        body: { autoCreateCounts: { serviceCount: 1, environmentCount: 0, clusterLinkCount: 0 } },
      }),
    ).rejects.toThrow(/import_request_id/);
  });

  it("requires body.autoCreateCounts (does not silently skip)", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "gitops_autocreate_log", "wait", {
        agent_id: "account.myagent",
        resource_scope: "account",
        import_request_id: "imp-x",
        body: {},
      }),
    ).rejects.toThrow(/body\.autoCreateCounts is required/);

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("requires agent_id / resource_id", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_autocreate_log", "wait", {
        resource_scope: "account",
        import_request_id: "imp-x",
        body: { autoCreateCounts: { serviceCount: 1, environmentCount: 0, clusterLinkCount: 0 } },
      }),
    ).rejects.toThrow(/agent_id/);
  });

  it("is allowed under HARNESS_READ_ONLY (risk=read)", async () => {
    const readOnly = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    const result = await readOnly.dispatchExecute(client, "gitops_autocreate_log", "wait", {
      agent_id: "account.myagent",
      resource_scope: "account",
      import_request_id: "imp-ro",
      body: {
        autoCreateCounts: { serviceCount: 0, environmentCount: 0, clusterLinkCount: 0 },
      },
    }) as Record<string, unknown>;

    expect(result.skipped).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("import executeHint points agents at wait, not manual list polling", () => {
    const mapping = registry.getResource("gitops_app_project_mapping");
    expect(mapping.executeHint).toMatch(/action='wait'/);
    expect(mapping.executeHint).not.toMatch(/harness_list\(resource_type='gitops_autocreate_log'/);
    expect(mapping.executeActions?.import?.description).toMatch(/action='wait'/);
    expect(mapping.relatedResources?.some(
      (r) => r.resourceType === "gitops_autocreate_log" && /action='wait'/.test(r.description),
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EndpointSpec.execute plumbing (generic registry behavior)
// ---------------------------------------------------------------------------

describe("EndpointSpec.execute registry hook", () => {
  it("runs execute after preflight and skips HTTP", async () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("gitops_autocreate_log");
    const wait = def.executeActions!.wait!;
    const preflight = vi.fn(async () => {});
    const execute = vi.fn(async () => ({ ok: true, via: "execute" }));

    // Temporarily swap hooks on the live spec (same object the registry holds).
    const prevPreflight = wait.preflight;
    const prevExecute = wait.execute;
    wait.preflight = preflight;
    wait.execute = execute;

    try {
      const mockRequest = vi.fn();
      const client = makeClient(mockRequest);

      const result = await registry.dispatchExecute(client, "gitops_autocreate_log", "wait", {
        agent_id: "account.myagent",
        resource_scope: "account",
        import_request_id: "imp-hook",
        body: { autoCreateCounts: { serviceCount: 0, environmentCount: 0, clusterLinkCount: 0 } },
      });

      expect(preflight).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledOnce();
      expect(result).toEqual({ ok: true, via: "execute" });
      expect(mockRequest).not.toHaveBeenCalled();
    } finally {
      wait.preflight = prevPreflight;
      wait.execute = prevExecute;
    }
  });
});
