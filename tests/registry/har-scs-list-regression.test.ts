/**
 * Regression coverage for HAR list query-param mapping, artifact deep links,
 * SCS artifact deep-link placeholders, and compact marker fields (#1030).
 */
import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registriesToolset } from "../../src/registry/toolsets/registries.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
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

describe("HAR list search_term query mapping (#1030)", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));

  it.each([
    ["registry", { data: { registries: [] } }, {}],
    [
      "artifact",
      { data: { artifacts: [{ artifactIdentifier: "nginx", name: "nginx" }] } },
      { registry_id: "docker-reg" },
    ],
    [
      "artifact_version",
      { data: { artifactVersions: [] } },
      { registry_id: "docker-reg", artifact_id: "nginx" },
    ],
    [
      "artifact_file",
      { data: { files: [] } },
      { registry_id: "docker-reg", artifact_id: "nginx", version: "1.0.0" },
    ],
  ] as const)(
    "%s list sends harness search_term as API search_term (not search)",
    async (resourceType, apiResponse, extraInput) => {
      const mockRequest = vi.fn().mockResolvedValue(apiResponse);
      const client = makeClient(mockRequest);

      await registry.dispatch(client, resourceType, "list", {
        org_id: "myorg",
        project_id: "myproj",
        search_term: "nginx",
        ...extraInput,
      });

      const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
      expect(call.params?.search_term).toBe("nginx");
      expect(call.params).not.toHaveProperty("search");
    },
  );
});

describe("HAR artifact list deep links (#1030)", () => {
  it("resolves {artifactIdentifier} using pathParams mapping on list items", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        artifacts: [
          { artifactIdentifier: "my-app", name: "my-app", registryIdentifier: "npm-reg" },
        ],
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "myorg",
      project_id: "myproj",
      registry_id: "npm-reg",
    })) as { items: Array<Record<string, unknown>> };

    const link = result.items[0]!.openInHarness as string;
    expect(link).toContain("/artifacts/my-app");
    expect(link).not.toMatch(/\{artifactIdentifier\}/);
    expect(link).not.toMatch(/\{artifact_id\}/);
  });
});

describe("registry create schema documents UPSTREAM authType (#1030)", () => {
  it("config field description mentions required authType for UPSTREAM registries", () => {
    const registryDef = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const configField = registryDef?.operations.create?.bodySchema?.fields?.find(
      (f) => f.name === "config",
    );
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/UPSTREAM/i);
    expect(configField?.description).toMatch(/Anonymous/i);
  });
});

describe("SCS artifact deep-link placeholders (#1030)", () => {
  const scsResources = [
    "artifact_security",
    "scs_artifact_remediation",
    "scs_chain_of_custody",
  ] as const;

  it.each(scsResources)(
    "%s get openInHarness substitutes {artifact} from artifact_id",
    async (resourceType) => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "scs" }));
      const mockRequest = vi.fn().mockResolvedValue({ id: "payload" });
      const client = makeClient(mockRequest);

      const result = (await registry.dispatch(client, resourceType, "get", {
        org_id: "myorg",
        project_id: "myproj",
        artifact_id: "art-uuid-42",
        ...(resourceType === "artifact_security" ? { source_id: "src-1" } : {}),
        ...(resourceType === "scs_artifact_remediation" ? { purl: "pkg:npm/lodash@4.0.0" } : {}),
      })) as Record<string, unknown>;

      const link = result.openInHarness as string;
      expect(link).toContain("/supply-chain/artifacts/art-uuid-42");
      expect(link).not.toMatch(/\{artifact\}/);
      expect(link).not.toMatch(/\{artifactId\}/);
    },
  );
});
