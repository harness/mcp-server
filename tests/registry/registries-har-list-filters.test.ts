/**
 * HAR v1 registries toolset: list filter forwarding (search_term) and deep links.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "acct1",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "myOrg",
    HARNESS_PROJECT: "myProj",
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

function mockClient(response: unknown): HarnessClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as HarnessClient;
}

describe("HAR v1 list search_term forwarding", () => {
  const registry = new Registry(makeConfig());

  const cases: Array<{ resourceType: string; extra?: Record<string, unknown>; arrayKey: string }> = [
    { resourceType: "registry", arrayKey: "registries" },
    { resourceType: "artifact", arrayKey: "artifacts", extra: { registry_id: "docker-reg" } },
    { resourceType: "artifact_version", arrayKey: "artifactVersions", extra: { registry_id: "docker-reg", artifact_id: "nginx" } },
    { resourceType: "artifact_file", arrayKey: "files", extra: { registry_id: "docker-reg", artifact_id: "nginx", version: "1.0.0" } },
  ];

  for (const { resourceType, extra, arrayKey } of cases) {
    it(`${resourceType}.list forwards search_term to the HAR API`, async () => {
      const client = mockClient({
        data: { [arrayKey]: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
        status: "SUCCESS",
      });

      await registry.dispatch(client, resourceType, "list", {
        org_id: "myOrg",
        project_id: "myProj",
        search_term: "lodash",
        ...extra,
      });

      const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.params.search_term).toBe("lodash");
    });
  }
});

describe("HAR v1 registry create schema", () => {
  it("documents UPSTREAM config.authType as required in the body schema", () => {
    const registryResource = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const configField = registryResource?.operations.create?.bodySchema?.fields?.find((f) => f.name === "config");
    expect(configField?.description).toMatch(/authType/);
    expect(configField?.description).toMatch(/UPSTREAM/);
    expect(configField?.description).toMatch(/Anonymous/);
  });
});

describe("HAR v1 artifact list deep links", () => {
  it("resolves registryIdentifier and artifactIdentifier placeholders from request scope and item fields", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({
      data: {
        artifacts: [{ name: "payments-api", version: "3.1.0" }],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
      status: "SUCCESS",
    });

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "myOrg",
      project_id: "myProj",
      registry_id: "har-docker",
    })) as { items: Array<Record<string, unknown>> };

    const link = result.items[0]?.openInHarness as string;
    expect(link).toContain("/orgs/myOrg/projects/myProj/registries/har-docker/artifacts/payments-api");
    expect(link).not.toContain("{registryIdentifier}");
    expect(link).not.toContain("{artifactIdentifier}");
  });
});
