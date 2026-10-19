/**
 * Regression tests for HAR v1 registry list filters (#1030).
 * search_term must reach the HAR API query string; artifact list deep links must
 * resolve artifactIdentifier; UPSTREAM create schema must document authType.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";
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
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function harListEnvelope(key: string, items: unknown[]) {
  return {
    data: {
      [key]: items,
      itemCount: items.length,
      pageIndex: 0,
      pageSize: 20,
      pageCount: 1,
    },
  };
}

describe("HAR v1 list search_term forwarding (#1030)", () => {
  const cases: Array<{ resource: string; dataKey: string; extra?: Record<string, unknown> }> = [
    { resource: "registry", dataKey: "registries" },
    { resource: "artifact", dataKey: "artifacts", extra: { registry_id: "npm-registry" } },
    {
      resource: "artifact_version",
      dataKey: "artifactVersions",
      extra: { registry_id: "npm-registry", artifact_id: "harness-mcp" },
    },
    {
      resource: "artifact_file",
      dataKey: "files",
      extra: { registry_id: "npm-registry", artifact_id: "harness-mcp", version: "1.0.0" },
    },
  ];

  for (const { resource, dataKey, extra } of cases) {
    it(`${resource} list forwards search_term to the HAR query string`, async () => {
      const mockRequest = vi.fn().mockResolvedValue(harListEnvelope(dataKey, []));
      const registry = new Registry(makeConfig());
      const client = makeClient(mockRequest);

      await registry.dispatch(client, resource, "list", {
        org_id: "default",
        project_id: "test-project",
        search_term: "nginx",
        ...extra,
      });

      expect(mockRequest).toHaveBeenCalledOnce();
      const params = mockRequest.mock.calls[0][0].params as Record<string, unknown>;
      expect(params.search_term).toBe("nginx");
      expect(params).not.toHaveProperty("search");
    });
  }
});

describe("HAR artifact list deep links (#1030)", () => {
  it("resolves artifactIdentifier in openInHarness from each list item", async () => {
    const mockRequest = vi.fn().mockResolvedValue(
      harListEnvelope("artifacts", [{ identifier: "harness-mcp", name: "Harness MCP" }]),
    );
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "default",
      project_id: "test-project",
      registry_id: "npm-registry",
    })) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0]!.openInHarness);
    expect(link).toContain("/artifacts/harness-mcp");
    expect(link).not.toContain("{artifactIdentifier}");
    expect(link).not.toContain("{registryIdentifier}");
  });
});

describe("HAR registry create schema (#1030)", () => {
  it("documents UPSTREAM config.authType in the config field description", () => {
    const registryDef = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const configField = registryDef?.operations.create?.bodySchema?.fields.find((f) => f.name === "config");
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/Anonymous/);
  });
});
