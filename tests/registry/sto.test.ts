import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { stoToolset } from "../../src/registry/toolsets/sto.js";

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

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("STO security exemption filtering", () => {
  it("maps generic search_term to the STO exemption search query param", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));
    const requestFn = vi.fn().mockResolvedValue({ items: [] });
    const client = makeClient(requestFn);

    await registry.dispatch(client, "security_exemption", "list", {
      status: "Pending",
      search_term: "Secret",
    });

    expect(requestFn).toHaveBeenCalledOnce();
    const call = requestFn.mock.calls[0][0] as { params?: Record<string, unknown> };
    expect(call.params).toMatchObject({
      status: "Pending",
      search: "Secret",
    });
  });

  it("offers an issue_type=SECRET filter for secret-related exemptions", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));
    const requestFn = vi.fn().mockResolvedValue({ items: [] });
    const client = makeClient(requestFn);

    await registry.dispatch(client, "security_exemption", "list", {
      status: "Pending",
      issue_type: "SECRET",
    });

    const call = requestFn.mock.calls[0][0] as { params?: Record<string, unknown> };
    expect(call.params).toMatchObject({
      status: "Pending",
      search: "Secret",
    });
  });

  it("documents secret-related exemption filters in local metadata", () => {
    const exemption = stoToolset.resources.find((r) => r.resourceType === "security_exemption");

    expect(exemption).toBeDefined();
    expect(exemption!.searchAliases).toContain("secret-related exemptions");
    const issueTypeFilter = exemption!.listFilterFields?.find((field) => field.name === "issue_type");
    expect(issueTypeFilter).toBeDefined();
    expect(issueTypeFilter!.description).toContain("secret-related exemptions");
    expect(issueTypeFilter!.enum).toContain("SECRET");
  });
});
