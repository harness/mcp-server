/**
 * Regression tests for HAR registry + SCS MCP contract fixes (#1030).
 *
 * - HAR list ops must send the API `search_term` query key (not a bogus `search` key).
 * - Artifact list deep links must resolve `{artifactIdentifier}` via list pathParams.
 * - UPSTREAM registry create docs must mention required `config.authType`.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

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

function harResource(type: string): ResourceDefinition {
  const res = registriesToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`HAR resource "${type}" not found`);
  return res;
}

function harListSpec(type: string): EndpointSpec {
  const spec = harResource(type).operations.list;
  if (!spec) throw new Error(`HAR resource "${type}" has no list operation`);
  return spec;
}

describe("HAR registry MCP contract (#1030)", () => {
  describe("list queryParams map harness_list search_term to API search_term", () => {
    const cases: Array<{ resourceType: string; extraInput?: Record<string, unknown> }> = [
      { resourceType: "registry" },
      {
        resourceType: "artifact",
        extraInput: { registry_id: "docker-hub", artifact_id: "nginx" },
      },
      {
        resourceType: "artifact_version",
        extraInput: { registry_id: "docker-hub", artifact_id: "nginx", version: "1.0.0" },
      },
      {
        resourceType: "artifact_file",
        extraInput: { registry_id: "docker-hub", artifact_id: "nginx", version: "1.0.0" },
      },
    ];

    for (const { resourceType, extraInput } of cases) {
      it(`${resourceType} list spec uses search_term as the tool-input key`, () => {
        const queryParams = harListSpec(resourceType).queryParams ?? {};
        expect(queryParams.search_term).toBe("search_term");
        expect(queryParams).not.toHaveProperty("search");
      });

      it(`${resourceType} list dispatch forwards search_term to the Harness API`, async () => {
        const mockRequest = vi.fn().mockResolvedValue({
          status: "SUCCESS",
          data: { registries: [], artifacts: [], artifactVersions: [], files: [] },
        });
        const client = makeClient(mockRequest);
        const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));

        await registry.dispatch(client, resourceType, "list", {
          org_id: "my-org",
          project_id: "my-proj",
          search_term: "nginx",
          ...extraInput,
        });

        const call = mockRequest.mock.calls[0][0] as { params: Record<string, unknown> };
        expect(call.params.search_term).toBe("nginx");
        expect(call.params.search).toBeUndefined();
      });
    }
  });

  it("artifact list maps artifact_id to artifactIdentifier for deep links", () => {
    const spec = harListSpec("artifact");
    expect(spec.pathParams).toMatchObject({
      registry_id: "registryIdentifier",
      artifact_id: "artifactIdentifier",
    });
  });

  it("artifact list openInHarness resolves artifactIdentifier from request context", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        // Omit `name` so per-item deep link resolution does not override list context.
        artifacts: [{ version: "1.0.0" }],
      },
    });
    const client = makeClient(mockRequest);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "my-org",
      project_id: "my-proj",
      registry_id: "docker-hub",
      artifact_id: "nginx-image",
    })) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0].openInHarness);
    expect(link).toContain("/registries/docker-hub/artifacts/nginx-image");
    expect(link).not.toContain("{artifactIdentifier}");
  });

  it("registry create bodySchema documents UPSTREAM config.authType requirement", () => {
    const configField = harResource("registry").operations.create?.bodySchema?.fields.find(
      (f) => f.name === "config",
    );
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/UPSTREAM/i);
  });
});
