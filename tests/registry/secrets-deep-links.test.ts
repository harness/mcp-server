/**
 * Secret openInHarness must use the current Settings UI, not the retired
 * /setup/resources/secrets path (same class of bug as templates).
 * Live UI: /settings/secrets/{id} (no /details suffix).
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(): Config {
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
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("secret openInHarness deep links", () => {
  it("get uses /settings/secrets/{id} (not /setup/resources/secrets)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: { identifier: "my_secret", name: "My Secret" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "secret", "get", {
      org_id: "PROD",
      project_id: "Traceable",
      secret_id: "my_secret",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/all/orgs/PROD/projects/Traceable/settings/secrets/my_secret",
    );
    expect(String(result.openInHarness)).not.toContain("setup/resources");
  });
});
