/**
 * artifact_scan affected_pipelines — pipeline executions that pulled
 * firewall-blocked dependencies (GET /har/api/v3/build-info/pipeline/details).
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { harV3PipelineBuildInfoExtract } from "../../src/registry/extractors.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "acct123",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "PROD",
    HARNESS_PROJECT: "Harness_Commons",
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
  } as Config;
}

function mockClient(response: unknown): HarnessClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as HarnessClient;
}

function firstCall(client: HarnessClient) {
  return (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

const ROW = {
  pipelineIdentifier: "build",
  pipelineExecutionIdentifier: "exec-1",
  stageIdentifier: "ci",
  stepIdentifier: "install",
  securityViolationCategories: ["Security"],
};

describe("artifact_scan affected_pipelines", () => {
  it("GETs build-info with filters and project scope, and projects pipelineData to items", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({
      pipelineData: [ROW],
      meta: { totalBlockedPipelines: 4, totalBlockedDependencies: 9 },
      page: 0,
      size: 20,
      hasMore: true,
    });

    const result = await registry.dispatchExecute(client, "artifact_scan", "affected_pipelines", {
      scan_id: "scan-1",
      package_name: "lodash",
      version: "4.17.20",
      categories: "Security",
      scope: "descendants",
      page: 0,
      size: 20,
    });

    const call = firstCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/har/api/v3/build-info/pipeline/details");
    expect(call.body).toBeUndefined();
    expect(call.params).toMatchObject({
      scan_id: "scan-1",
      package_name: "lodash",
      version: "4.17.20",
      categories: "Security",
      scope: "descendants",
      account_identifier: "acct123",
      org_identifier: "PROD",
      project_identifier: "Harness_Commons",
    });
    expect(result).toEqual({
      items: [ROW],
      page: 0,
      size: 20,
      hasMore: true,
      totalBlockedPipelines: 4,
      totalBlockedDependencies: 9,
    });
  });

  it("is read-risk, so it runs in read-only mode", async () => {
    const registry = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const spec = registry.getResource("artifact_scan").executeActions!.affected_pipelines!;
    expect(spec.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });

    const client = mockClient({ pipelineData: [], meta: {}, page: 0, size: 20, hasMore: false });
    await expect(registry.dispatchExecute(client, "artifact_scan", "affected_pipelines", {})).resolves.toBeDefined();
  });
});

describe("harV3PipelineBuildInfoExtract", () => {
  it("returns empty items and zero totals when nothing is blocked", () => {
    expect(harV3PipelineBuildInfoExtract({ pipelineData: [], meta: {}, page: 0, size: 20, hasMore: false })).toEqual({
      items: [],
      page: 0,
      size: 20,
      hasMore: false,
      totalBlockedPipelines: 0,
      totalBlockedDependencies: 0,
    });
  });

  it("tolerates a missing pipelineData and meta", () => {
    const out = harV3PipelineBuildInfoExtract({ page: 1, size: 5, hasMore: false }) as Record<string, unknown>;
    expect(out.items).toEqual([]);
    expect(out.totalBlockedPipelines).toBe(0);
  });

  it("passes non-object responses through", () => {
    expect(harV3PipelineBuildInfoExtract(null)).toBeNull();
  });
});
