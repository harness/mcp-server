/**
 * Regression test: HAR pathBuilder must use the per-request resolved account ID,
 * not the static config placeholder.
 *
 * In internal HTTP mode (multi-tenant), config.HARNESS_ACCOUNT_ID is a dummy
 * value ("internal") because the real account ID comes per-request from the
 * auth middleware. The service routing proxy patches accountIdentifier in query
 * params, but HAR APIs embed the account ID in the URL path via pathBuilder.
 * Before the fix, pathBuilder received the static config → wrong path → 404.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.internal.internal.dummy",
    HARNESS_ACCOUNT_ID: "internal",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: undefined as unknown as string,
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

describe("HAR pathBuilder account ID resolution", () => {
  const REAL_ACCOUNT_ID = "l7B_kbSEQD2wjrM7PShm5w";

  it("registry list path uses resolved account ID, not static config", async () => {
    const config = makeConfig({ HARNESS_ACCOUNT_ID: "internal" });

    const registry = new Registry(config, {
      accountIdResolver: () => REAL_ACCOUNT_ID,
    });

    const mockClient = {
      request: vi.fn().mockResolvedValue({
        data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
        status: "SUCCESS",
      }),
    } as unknown as HarnessClient;

    await registry.dispatch(mockClient, "registry", "list", {
      org_id: "PROD",
      project_id: "Harness",
    });

    expect(mockClient.request).toHaveBeenCalledOnce();
    const callArgs = (mockClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0];

    // The path must contain the REAL account ID, not "internal"
    expect(callArgs.path).toContain(REAL_ACCOUNT_ID);
    expect(callArgs.path).not.toContain("/internal/");
    expect(callArgs.path).toBe(
      `/har/api/v1/spaces/${REAL_ACCOUNT_ID}/PROD/Harness/+/registries`,
    );
  });

  it("artifact_version list path uses resolved account ID", async () => {
    const config = makeConfig({ HARNESS_ACCOUNT_ID: "internal" });

    const registry = new Registry(config, {
      accountIdResolver: () => REAL_ACCOUNT_ID,
    });

    const mockClient = {
      request: vi.fn().mockResolvedValue({
        data: { artifactVersions: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
        status: "SUCCESS",
      }),
    } as unknown as HarnessClient;

    await registry.dispatch(mockClient, "artifact_version", "list", {
      org_id: "PROD",
      project_id: "Harness",
      registry_id: "ai-platform",
      artifact_id: "harness-ai-agent",
    });

    expect(mockClient.request).toHaveBeenCalledOnce();
    const callArgs = (mockClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0];

    expect(callArgs.path).toContain(REAL_ACCOUNT_ID);
    expect(callArgs.path).not.toContain("/internal/");
    expect(callArgs.path).toBe(
      `/har/api/v1/registry/${REAL_ACCOUNT_ID}/PROD/Harness/ai-platform/+/artifact/harness-ai-agent/+/versions`,
    );
  });

  it("falls back to config account ID when no resolver is set", async () => {
    const config = makeConfig({ HARNESS_ACCOUNT_ID: "static-account" });

    const registry = new Registry(config);

    const mockClient = {
      request: vi.fn().mockResolvedValue({
        data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
        status: "SUCCESS",
      }),
    } as unknown as HarnessClient;

    await registry.dispatch(mockClient, "registry", "list", {
      org_id: "myorg",
      project_id: "myproject",
    });

    const callArgs = (mockClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.path).toBe(
      `/har/api/v1/spaces/static-account/myorg/myproject/+/registries`,
    );
  });
});
