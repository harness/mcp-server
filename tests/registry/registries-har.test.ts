/**
 * HAR v1 registries toolset — query-param and deep-link contract tests.
 * Guards against silent search filter drops (#1030) and unresolved artifact deep links.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "acct123",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "PROD",
    HARNESS_PROJECT: "Harness_Commons",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "acct123",
  } as unknown as HarnessClient;
}

describe("HAR v1 registries list search_term mapping", () => {
  const registry = new Registry(makeConfig());

  it.each([
    ["registry", {}],
    ["artifact", { registry_id: "docker-hub" }],
    ["artifact_version", { registry_id: "docker-hub", artifact_id: "nginx" }],
    ["artifact_file", { registry_id: "docker-hub", artifact_id: "nginx", version: "1.25" }],
  ])("%s list forwards search_term as the HAR search_term query param", async (resourceType, extra) => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { registries: [], artifacts: [], artifactVersions: [], files: [] },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, resourceType, "list", {
      org_id: "PROD",
      project_id: "Harness_Commons",
      search_term: "nginx",
      ...extra,
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.search_term).toBe("nginx");
    expect(call.params.search).toBeUndefined();
  });
});

describe("HAR v1 artifact deep links", () => {
  it("resolves {artifactIdentifier} from list pathParams instead of leaving a placeholder", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        artifacts: [{ artifactIdentifier: "library/nginx", name: "nginx" }],
        itemCount: 1,
      },
    });
    const registry = new Registry(makeConfig());
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "PROD",
      project_id: "Harness_Commons",
      registry_id: "docker-hub",
    })) as { items: Array<Record<string, unknown>> };

    const link = result.items[0]!.openInHarness as string;
    expect(link).toContain("/artifacts/library%2Fnginx");
    expect(link).not.toContain("{artifactIdentifier}");
  });

  it("documents that UPSTREAM registries require config.authType", () => {
    const registryResource = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const authTypeField = registryResource?.operations.create?.bodySchema?.fields.find(
      (field) => field.name === "config",
    );
    expect(authTypeField?.description).toContain("authType");
    expect(authTypeField?.description).toContain("required for UPSTREAM");
  });
});
