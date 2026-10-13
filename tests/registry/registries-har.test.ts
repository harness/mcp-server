/**
 * HAR v1 list query-param and deep-link regressions (#1030).
 * Search filters must reach the API as `search_term`; artifact list deep links
 * must resolve `{artifactIdentifier}` from list items.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "PROD",
    HARNESS_PROJECT: "Harness_Commons",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "registries",
    ...overrides,
  };
}

function mockClient(response: unknown): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue(response),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("HAR v1 search_term query mapping", () => {
  const registry = new Registry(makeConfig());

  it("registry.list forwards search_term to the API (not a silent search key)", async () => {
    const client = mockClient({
      data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      status: "SUCCESS",
    });

    await registry.dispatch(client, "registry", "list", { search_term: "npm-cache" });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.params.search_term).toBe("npm-cache");
    expect(call.params.search).toBeUndefined();
  });

  it("artifact.list forwards search_term on the artifacts query string", async () => {
    const client = mockClient({
      data: { artifacts: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      status: "SUCCESS",
    });

    await registry.dispatch(client, "artifact", "list", {
      registry_id: "docker-hub",
      search_term: "nginx",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.path).toContain("/docker-hub/+/artifacts");
    expect(call.params.search_term).toBe("nginx");
    expect(call.params.search).toBeUndefined();
  });

  it("artifact_version.list forwards search_term", async () => {
    const client = mockClient({
      data: { artifactVersions: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      status: "SUCCESS",
    });

    await registry.dispatch(client, "artifact_version", "list", {
      registry_id: "docker-hub",
      artifact_id: "library/nginx",
      search_term: "1.25",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.params.search_term).toBe("1.25");
    expect(call.params.search).toBeUndefined();
  });
});

describe("HAR artifact list deep links", () => {
  it("resolves {artifactIdentifier} per list item instead of leaving a placeholder", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({
      data: {
        artifacts: [
          { identifier: "my-app", name: "my-app", registryIdentifier: "internal" },
          { identifier: "sidecar", name: "sidecar", registryIdentifier: "internal" },
        ],
        itemCount: 2,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
      status: "SUCCESS",
    });

    const result = (await registry.dispatch(client, "artifact", "list", {
      registry_id: "internal",
      org_id: "PROD",
      project_id: "Harness_Commons",
    })) as { items: Array<Record<string, unknown>> };

    const links = result.items.map((item) => String(item.openInHarness));
    expect(links[0]).toMatch(/\/registries\/internal\/artifacts\/my-app$/);
    expect(links[1]).toMatch(/\/registries\/internal\/artifacts\/sidecar$/);
    for (const link of links) {
      expect(link).not.toContain("{artifactIdentifier}");
      expect(link).not.toContain("{artifact_id}");
    }
  });
});
