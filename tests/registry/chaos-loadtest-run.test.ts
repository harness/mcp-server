/**
 * Verifies chaos_loadtest_run: list (scoped to one load test) / get, and the
 * ai_insights / generate_ai_insights actions -- request shape, response
 * extraction, and the compact projection that keeps aiInsights alive through
 * the generic compactItems() whitelist.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { compactItems } from "../../src/utils/compact.js";

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
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("chaos_loadtest_run list", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("GETs /v1/load-tests/{loadtestId}/runs and maps status/search/sort query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], pagination: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest_run", "list", {
      org_id: "o", project_id: "p",
      loadtest_id: "lt-1",
      status: "Finished",
      search: "nightly",
      sort_field: "createdAt",
      sort_ascending: true,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/loadTest/manager/api/v1/load-tests/lt-1/runs");
    expect(call.params.status).toBe("Finished");
    expect(call.params.search).toBe("nightly");
    expect(call.params.sortField).toBe("createdAt");
    expect(call.params.sortAscending).toBe(true);
  });

  it("rejects a missing loadtest_id -- there is no cross-load-test listing here", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_loadtest_run", "list", {
        org_id: "o", project_id: "p",
      }),
    ).rejects.toThrow(/loadtest_id/);
  });

  it("projects items via chaosLoadTestRunExtract, mirroring identity -> run_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [
        { identity: "run-1", name: "Nightly Run", status: "Finished", aiInsights: { status: "Ready", verdict: "healthy", headline: "Looks good" } },
      ],
      pagination: { totalItems: 1 },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_loadtest_run", "list", {
      org_id: "o", project_id: "p", loadtest_id: "lt-1",
    }) as { items: Array<Record<string, unknown>>; total: number };

    expect(result.total).toBe(1);
    expect(result.items[0].run_id).toBe("run-1");
    expect(result.items[0].identity).toBe("run-1");
    expect(result.items[0].aiInsights).toEqual({ status: "Ready", verdict: "healthy", headline: "Looks good" });
  });

  it("keeps aiInsights/toolType/targetUsers/workerCount through the compact projection", () => {
    const compactFn = registry.getResource("chaos_loadtest_run").compactItem;
    expect(compactFn).toBeDefined();

    const [slim] = compactItems(
      [
        {
          run_id: "run-1",
          identity: "run-1",
          name: "Nightly Run",
          loadTestIdentity: "lt-1",
          toolType: "K6",
          status: "Finished",
          thresholdVerdict: "pass",
          isAIUsed: true,
          targetUsers: 500,
          durationSeconds: 600,
          workerCount: 3,
          aiInsights: { status: "Ready", verdict: "healthy", headline: "Looks good" },
          // Fields the compact projection should drop:
          resolvedVariables: { SECRET: "value" },
          logStreamId: "some-internal-stream-id",
        },
      ],
      compactFn,
    );

    expect(slim.aiInsights).toEqual({ status: "Ready", verdict: "healthy", headline: "Looks good" });
    expect(slim.toolType).toBe("K6");
    expect(slim.targetUsers).toBe(500);
    expect(slim.workerCount).toBe(3);
    expect(slim.resolvedVariables).toBeUndefined();
    expect(slim.logStreamId).toBeUndefined();
  });
});

describe("chaos_loadtest_run get", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("GETs /v1/runs/{runId} and forwards load_test_identity as a query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "run-1", status: "Finished" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_loadtest_run", "get", {
      org_id: "o", project_id: "p",
      run_id: "run-1",
      load_test_identity: "lt-1",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/loadTest/manager/api/v1/runs/run-1");
    expect(call.params.loadTestIdentity).toBe("lt-1");
  });

  it("mirrors identity -> run_id on the response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      identity: "run-1",
      status: "Ready",
      aiInsights: { status: "Ready", findings: [{ severity: "warning", title: "p95 elevated", detail: "..." }] },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "chaos_loadtest_run", "get", {
      org_id: "o", project_id: "p", run_id: "run-1",
    }) as Record<string, unknown>;

    expect(result.run_id).toBe("run-1");
    expect((result.aiInsights as Record<string, unknown>).findings).toBeDefined();
  });

  it("masks resolvedVariables values on get and list", async () => {
    const run = {
      identity: "run-1",
      status: "Finished",
      resolvedVariables: { API_TOKEN: "s3cr3t", USERS: 50 },
    };
    const getRequest = vi.fn().mockResolvedValue(run);
    const got = await registry.dispatch(makeClient(getRequest), "chaos_loadtest_run", "get", {
      org_id: "o", project_id: "p", run_id: "run-1",
    }) as Record<string, unknown>;
    expect(got.resolvedVariables).toEqual({ API_TOKEN: "[REDACTED]", USERS: "[REDACTED]" });
    expect(JSON.stringify(got)).not.toContain("s3cr3t");

    const listRequest = vi.fn().mockResolvedValue({ items: [run], pagination: { totalItems: 1 } });
    const listed = await registry.dispatch(makeClient(listRequest), "chaos_loadtest_run", "list", {
      org_id: "o", project_id: "p", loadtest_id: "lt-1", compact: false,
    });
    expect(JSON.stringify(listed)).not.toContain("s3cr3t");
  });
});

describe("chaos_loadtest_run execute actions", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("ai_insights: GETs /v1/runs/{run_id}/ai-insights with no body and read/safe policy", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      runId: "run-1", runName: "Nightly Run", status: "Ready",
      aiInsights: { status: "Ready", verdict: "healthy", headline: "Looks good", summary: "...", findings: [], recommendations: [], caveats: [] },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "chaos_loadtest_run", "ai_insights", {
      org_id: "o", project_id: "p", run_id: "run-1",
    }) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/loadTest/manager/api/v1/runs/run-1/ai-insights");
    expect(call.body).toEqual({});
    // passthrough: bare object, no envelope, no compaction (this is not a list).
    expect(result.status).toBe("Ready");
    expect((result.aiInsights as Record<string, unknown>).findings).toEqual([]);

    const def = registry.getResource("chaos_loadtest_run");
    expect(def.executeActions?.ai_insights.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });

  it("ai_insights: forwards load_test_identity as a query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "NotGenerated" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_loadtest_run", "ai_insights", {
      org_id: "o", project_id: "p", run_id: "run-1", load_test_identity: "lt-1",
    });

    expect(mockRequest.mock.calls[0][0].params.loadTestIdentity).toBe("lt-1");
  });

  it("generate_ai_insights: POSTs /v1/runs/{run_id}/ai-insights with no body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ runId: "run-1", status: "Generating" });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "chaos_loadtest_run", "generate_ai_insights", {
      org_id: "o", project_id: "p", run_id: "run-1",
    }) as Record<string, unknown>;

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/loadTest/manager/api/v1/runs/run-1/ai-insights");
    expect(call.body).toEqual({});
    expect(result.status).toBe("Generating");
  });

  it("generate_ai_insights: is medium_write/do_not_retry, not run's high_write", () => {
    const def = registry.getResource("chaos_loadtest_run");
    expect(def.executeActions?.generate_ai_insights.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });

    const loadtestDef = registry.getResource("chaos_loadtest");
    expect(loadtestDef.executeActions?.run.operationPolicy.risk).toBe("high_write");
  });
});
