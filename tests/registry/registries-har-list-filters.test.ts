/**
 * Regression tests for HAR v1 registry list filters and deep links (#1030).
 * search_term must reach the HAR API query string (not a silent no-op key),
 * and artifact list items must resolve {artifactIdentifier} in deep links.
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
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "error",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
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

describe("HAR v1 registries — search_term query mapping", () => {
  const registry = new Registry(makeConfig());

  it.each([
    [
      "registry",
      {},
      {
        status: "SUCCESS",
        data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      },
      (call: { path: string; params?: Record<string, unknown> }) => {
        expect(call.path).toContain("/registries");
        expect(call.params?.search_term).toBe("docker-hub");
        expect(call.params?.search).toBeUndefined();
      },
    ],
    [
      "artifact",
      { registry_id: "my-reg" },
      {
        status: "SUCCESS",
        data: { artifacts: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      },
      (call: { path: string; params?: Record<string, unknown> }) => {
        expect(call.path).toContain("/my-reg/+/artifacts");
        expect(call.params?.search_term).toBe("nginx");
        expect(call.params?.search).toBeUndefined();
      },
    ],
    [
      "artifact_version",
      { registry_id: "my-reg", artifact_id: "nginx" },
      {
        status: "SUCCESS",
        data: { artifactVersions: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      },
      (call: { path: string; params?: Record<string, unknown> }) => {
        expect(call.path).toContain("/artifact/nginx/+/versions");
        expect(call.params?.search_term).toBe("1.25");
        expect(call.params?.search).toBeUndefined();
      },
    ],
    [
      "artifact_file",
      { registry_id: "my-reg", artifact_id: "nginx", version: "1.25.0" },
      {
        status: "SUCCESS",
        data: { files: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      },
      (call: { path: string; params?: Record<string, unknown> }) => {
        expect(call.path).toContain("/version/1.25.0/files");
        expect(call.params?.search_term).toBe("layer");
        expect(call.params?.search).toBeUndefined();
      },
    ],
  ] as const)(
    "%s list forwards search_term to the HAR API",
    async (resourceType, extraInput, apiResponse, assertCall) => {
      const client = mockClient(apiResponse);
      await registry.dispatch(client, resourceType, "list", {
        search_term: resourceType === "registry" ? "docker-hub" : resourceType === "artifact_version" ? "1.25" : resourceType === "artifact_file" ? "layer" : "nginx",
        ...extraInput,
      });

      const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
        method: string;
        path: string;
        params?: Record<string, unknown>;
      };
      expect(call.method).toBe("GET");
      assertCall(call);
    },
  );
});

describe("HAR v1 registries — registry create schema", () => {
  it("documents that UPSTREAM registries require config.authType", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("registry");
    const configField = def.operations.create!.bodySchema!.fields.find((f) => f.name === "config");
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/UPSTREAM/i);
    expect(configField?.description).toMatch(/Anonymous/i);
  });
});

describe("HAR v1 registries — artifact list deep links", () => {
  it("resolves artifactIdentifier in openInHarness for each listed artifact", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({
      status: "SUCCESS",
      data: {
        artifacts: [{ artifactIdentifier: "nginx" }],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
    });

    const result = (await registry.dispatch(client, "artifact", "list", {
      registry_id: "har-docker",
      search_term: "ng",
    })) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0]!.openInHarness);
    expect(link).toContain("/registries/har-docker/");
    expect(link).toContain("/artifacts/nginx");
    expect(link).not.toContain("{artifactIdentifier}");
    expect(link).not.toContain("{registryIdentifier}");
  });
});
