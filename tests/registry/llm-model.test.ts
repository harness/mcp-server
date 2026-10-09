import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "stephenAnsible",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  } as Config;
}

describe("llm_model", () => {
  it("POSTs discovery body to llm-connector/models at account scope and returns options", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors", HARNESS_ORG: "o", HARNESS_PROJECT: "p" }));
    const request = vi.fn().mockResolvedValue({ status: "SUCCESS", data: [{ value: "claude", displayName: "Claude" }] });
    const client = { request, account: "acc" } as never;
    const res = await registry.dispatch(client, "llm_model", "list", {
      provider: "ANTHROPIC",
      authentication: { type: "Token", spec: { tokenRef: "account.s" } },
    });
    const call = request.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/llm-connector/models");
    expect(call.body).toMatchObject({ provider: "ANTHROPIC", authentication: { type: "Token" } });
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
    expect(JSON.stringify(res)).toContain("displayName");
  });
});
