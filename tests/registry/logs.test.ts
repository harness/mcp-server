import { describe, expect, it } from "vitest";
import type { Config } from "../../src/config.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

describe("execution_log registry contract", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "logs" }));
  const def = registry.getResource("execution_log");
  const getSpec = def.operations.get!;

  it("keeps POST /gateway/log-service/blob/download with prefix query", () => {
    expect(getSpec.method).toBe("POST");
    expect(getSpec.path).toBe("/gateway/log-service/blob/download");
    expect(getSpec.queryParams).toEqual({ prefix: "prefix" });
  });

  it("documents log identifiers on get paramsSchema", () => {
    const names = getSpec.paramsSchema!.fields.map((f) => f.name);
    expect(names).toEqual([
      "prefix",
      "execution_id",
      "step_id",
      "stage_id",
      "stage_execution_id",
      "return_download_url",
    ]);
    expect(getSpec.paramsSchema!.fields.find((f) => f.name === "step_id")!.description).toMatch(/step/i);
  });

  it("describe copy tells agents logs are prepared asynchronously and to use step_id or diagnose", () => {
    expect(def.description).toMatch(/asynchronously/i);
    expect(def.description).toMatch(/step_id/);
    expect(def.description).toMatch(/harness_diagnose/);
    expect(def.description).toMatch(/return_download_url/);
    expect(def.diagnosticHint).toMatch(/step_id/);
    expect(def.diagnosticHint).toMatch(/harness_diagnose/);
  });
});
