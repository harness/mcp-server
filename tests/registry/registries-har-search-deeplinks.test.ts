/**
 * Regression coverage for HAR registries toolset fixes (#1030):
 * - list ops must send `search_term` query param (not the non-existent `search` key)
 * - artifact list deep links must resolve {artifactIdentifier} from list pathParams
 * - UPSTREAM registry create docs must mention required config.authType
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
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
    HARNESS_TOOLSETS: "registries",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

function listQueryParams(resourceType: string): Record<string, string> {
  const def = registriesToolset.resources.find((r) => r.resourceType === resourceType);
  if (!def?.operations.list?.queryParams) {
    throw new Error(`No list queryParams for ${resourceType}`);
  }
  return def.operations.list.queryParams;
}

describe("HAR registries list search_term query mapping (#1030)", () => {
  it.each([
    ["registry"],
    ["artifact"],
    ["artifact_version"],
    ["artifact_file"],
  ] as const)("maps search_term input to search_term query key for %s.list", (resourceType) => {
    const qp = listQueryParams(resourceType);
    expect(qp.search_term).toBe("search_term");
    expect(qp).not.toHaveProperty("search");
  });

  it("forwards search_term on registry.list requests", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "registry", "list", {
      org_id: "myOrg",
      project_id: "myProj",
      search_term: "docker-hub",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.search_term).toBe("docker-hub");
    expect(call.params.search).toBeUndefined();
  });

  it("forwards search_term on artifact.list requests", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: { artifacts: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "artifact", "list", {
      org_id: "myOrg",
      project_id: "myProj",
      registry_id: "my-reg",
      search_term: "nginx",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.search_term).toBe("nginx");
    expect(call.params.search).toBeUndefined();
  });
});

describe("HAR artifact list deep links (#1030)", () => {
  it("resolves artifactIdentifier in openInHarness when listing under a registry", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        artifacts: [{ artifactIdentifier: "nginx", name: "nginx" }],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "myOrg",
      project_id: "myProj",
      registry_id: "har-reg",
    })) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0]!.openInHarness);
    expect(link).toContain("/artifacts/nginx");
    expect(link).not.toContain("{artifactIdentifier}");
    expect(link).not.toContain("{registryIdentifier}");
  });
});

describe("HAR registry create schema docs (#1030)", () => {
  it("documents config.authType as required for UPSTREAM registries", () => {
    const def = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const configField = def?.operations.create?.bodySchema?.fields.find((f) => f.name === "config");
    expect(configField?.description).toContain("authType");
    expect(configField?.description).toMatch(/required for UPSTREAM/i);
    expect(configField?.description).toContain("Anonymous");
  });
});
