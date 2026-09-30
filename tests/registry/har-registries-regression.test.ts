/**
 * Regression tests for HAR registries toolset query-param and deep-link fixes (#1030).
 * search_term must reach the HAR API as `search_term`, not a mismatched `search` key.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "acct-1",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "myorg",
    HARNESS_PROJECT: "myproj",
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
    request: requestFn ?? vi.fn().mockResolvedValue({ data: {} }),
    account: "acct-1",
  } as unknown as HarnessClient;
}

function findHarListOp(resourceType: string, operation: "list" = "list") {
  const res = registriesToolset.resources.find((r) => r.resourceType === resourceType);
  if (!res) throw new Error(`missing resource ${resourceType}`);
  const spec = res.operations[operation];
  if (!spec) throw new Error(`missing op ${operation} on ${resourceType}`);
  return spec;
}

describe("HAR registries — search_term query param (#1030)", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));

  const cases: Array<{
    resourceType: string;
    input: Record<string, unknown>;
    mockData: Record<string, unknown>;
  }> = [
    {
      resourceType: "registry",
      input: { org_id: "myorg", project_id: "myproj", search_term: "npm-mirror" },
      mockData: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    },
    {
      resourceType: "artifact",
      input: {
        org_id: "myorg",
        project_id: "myproj",
        registry_id: "docker-upstream",
        search_term: "harness-ai",
      },
      mockData: { artifacts: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    },
    {
      resourceType: "artifact_version",
      input: {
        org_id: "myorg",
        project_id: "myproj",
        registry_id: "docker-upstream",
        artifact_id: "harness-ai",
        search_term: "1.2",
      },
      mockData: { artifactVersions: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    },
    {
      resourceType: "artifact_file",
      input: {
        org_id: "myorg",
        project_id: "myproj",
        registry_id: "docker-upstream",
        artifact_id: "harness-ai",
        version: "1.0.0",
        search_term: "layer",
      },
      mockData: { files: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    },
  ];

  for (const { resourceType, input, mockData } of cases) {
    it(`${resourceType} list forwards search_term as the HAR API query key`, async () => {
      const mockRequest = vi.fn().mockResolvedValue({ data: mockData });
      const client = makeClient(mockRequest);

      await registry.dispatch(client, resourceType, "list", input);

      const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, string> };
      expect(call.params?.search_term).toBe(input.search_term);
      expect(call.params).not.toHaveProperty("search");
    });
  }

  it("registry list queryParams map input search_term to wire key search_term (not search)", () => {
    const spec = findHarListOp("registry");
    expect(spec.queryParams?.search_term).toBe("search_term");
    expect(spec.queryParams?.search).toBeUndefined();
  });
});

describe("HAR artifact list — deep link artifactIdentifier (#1030)", () => {
  it("resolves {artifactIdentifier} in openInHarness from list items", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        artifacts: [
          {
            registryIdentifier: "docker-upstream",
            artifactIdentifier: "my-image",
            name: "my-image",
          },
        ],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "myorg",
      project_id: "myproj",
      registry_id: "docker-upstream",
    })) as { items: Array<Record<string, unknown>> };

    const link = result.items[0]!.openInHarness as string;
    expect(link).toContain("/registries/docker-upstream/artifacts/my-image");
    expect(link).not.toContain("{artifactIdentifier}");
    expect(link).not.toContain("{registryIdentifier}");
  });

  it("artifact list pathParams include artifact_id → artifactIdentifier for deep links", () => {
    const spec = findHarListOp("artifact");
    expect(spec.pathParams?.artifact_id).toBe("artifactIdentifier");
  });
});

describe("HAR registry create schema — UPSTREAM authType (#1030)", () => {
  it("documents authType as required for UPSTREAM registries in config field description", () => {
    const registryRes = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const createSchema = registryRes?.operations.create?.bodySchema;
    const configField = createSchema?.fields?.find((f) => f.name === "config");
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/UPSTREAM/i);
    expect(configField?.description).toMatch(/Anonymous/i);
  });
});
