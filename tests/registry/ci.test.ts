import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { testCaseListExtract } from "../../src/registry/extractors.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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
    HARNESS_TOOLSETS: "ci",
    ...overrides,
  } as Config;
}

describe("testCaseListExtract", () => {
  it("shapes content/data into { items, total }", () => {
    expect(
      testCaseListExtract({ data: { totalItems: 42 }, content: [{ name: "a" }, { name: "b" }] }),
    ).toEqual({ items: [{ name: "a" }, { name: "b" }], total: 42 });
  });

  it("handles empty or null content", () => {
    expect(testCaseListExtract({ content: null })).toEqual({ items: [], total: 0 });
    expect(testCaseListExtract(undefined)).toEqual({ items: [], total: 0 });
  });
});

describe("ci toolset", () => {
  it("is opt-in and not loaded by default", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(() => registry.getResource("test_case")).toThrow();
  });

  it("is loaded with +ci", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+ci" }));
    expect(registry.getResource("test_case").toolset).toBe("ci");
  });

  it("maps list params to the public API's camelCase query params and scope", async () => {
    const registry = new Registry(makeConfig());
    const request = vi.fn().mockResolvedValue({ data: { totalItems: 1 }, content: [{ name: "t" }] });
    const client = { request, account: "test-account" } as unknown as HarnessClient;

    const result = await registry.dispatch(client, "test_case", "list", {
      pipeline_id: "p1",
      build_id: "12",
      page: 1,
      size: 500,
    });

    const call = request.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown> };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/ti-service/api/v1/test-cases");
    expect(call.params).toMatchObject({
      accountId: "test-account",
      orgId: "default",
      projectId: "test-project",
      pipelineId: "p1",
      buildId: "12",
      pageIndex: 1,
      pageSize: 500,
    });
    // Params the server ignores must never be sent.
    for (const k of ["status", "sort", "order", "report", "flaky", "suite_name", "testCaseSearchTerm"]) {
      expect(call.params).not.toHaveProperty(k);
    }
    expect(result).toMatchObject({ items: [{ name: "t" }], total: 1 });
  });

  it("does not expose the report param (server pins junit)", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("test_case");
    expect(def.operations.list?.queryParams).not.toHaveProperty("report");
    expect(def.listFilterFields?.map((f) => (typeof f === "string" ? f : f.name))).not.toContain("report");
  });

  it("documents the limits agents need in the description", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("test_case");
    expect(def.description.length).toBeLessThanOrEqual(500);
    const desc = def.operations.list!.description;
    expect(desc).toMatch(/1-1000/);
    expect(desc).toMatch(/Does NOT filter or sort server-side/);
    expect(desc).toMatch(/silently ignored/);
    expect(desc).toMatch(/204/);
    expect(desc).toMatch(/Does NOT return console logs/);
    // Descriptions must not steer the agent to other resources.
    expect(`${def.description} ${desc}`).not.toMatch(/resource_type=|\buse (execution|execution_log)\b/);
  });
});
