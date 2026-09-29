/**
 * HAR v1 list search accepts both caller spellings and still sends the API
 * query name `search_term`. Artifact deep links use the artifact name.
 * Chain-of-custody item names must not replace the requested artifact id.
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

function makeClient(payload: unknown): { client: HarnessClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue(payload);
  return { client: { request, account: "test-account" } as unknown as HarnessClient, request };
}

const LIST_CASES = [
  {
    type: "registry",
    input: {},
    payload: { data: { registries: [], itemCount: 0 } },
  },
  {
    type: "artifact",
    input: { registry_id: "docker-reg" },
    payload: { data: { artifacts: [], itemCount: 0 } },
  },
  {
    type: "artifact_version",
    input: { registry_id: "docker-reg", artifact_id: "my-app" },
    payload: { data: { artifactVersions: [], itemCount: 0 } },
  },
  {
    type: "artifact_file",
    input: { registry_id: "docker-reg", artifact_id: "my-app", version: "1.0.0" },
    payload: { data: { files: [], itemCount: 0 } },
  },
] as const;

describe("HAR v1 list search query", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));

  for (const resource of LIST_CASES) {
    it(`${resource.type} sends filters.search as search_term`, async () => {
      const { client, request } = makeClient(resource.payload);
      await registry.dispatch(client, resource.type, "list", {
        ...resource.input,
        search: "docker",
      });
      const params = request.mock.calls[0][0].params as Record<string, unknown>;
      expect(params.search_term).toBe("docker");
      expect(params.search).toBeUndefined();
    });

    it(`${resource.type} sends the global search_term argument as search_term`, async () => {
      const { client, request } = makeClient(resource.payload);
      await registry.dispatch(client, resource.type, "list", {
        ...resource.input,
        search_term: "docker",
      });
      const params = request.mock.calls[0][0].params as Record<string, unknown>;
      expect(params.search_term).toBe("docker");
      expect(params.search).toBeUndefined();
    });
  }

  it("an explicit search filter wins over search_term", async () => {
    const { client, request } = makeClient({ data: { registries: [], itemCount: 0 } });
    await registry.dispatch(client, "registry", "list", {
      search_term: "from-global",
      search: "from-filter",
    });
    const params = request.mock.calls[0][0].params as Record<string, unknown>;
    expect(params.search_term).toBe("from-filter");
  });
});

describe("HAR artifact list deep link", () => {
  it("fills {artifactIdentifier} from the artifact name", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));
    const { client } = makeClient({
      data: {
        artifacts: [{
          name: "my-app",
          registryIdentifier: "docker-reg",
          uuid: "abc",
          packageType: "DOCKER",
          isPublic: false,
          latestVersion: "1.0.0",
        }],
        itemCount: 1,
      },
    });
    const result = await registry.dispatch(client, "artifact", "list", {
      registry_id: "docker-reg",
      org_id: "default",
      project_id: "test-project",
    }) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]?.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/all/orgs/default/projects/test-project/registries/docker-reg/artifacts/my-app",
    );
  });
});

describe("SCS chain of custody deep link", () => {
  it("keeps the requested artifact id when an event has its own name", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "scs" }));
    const { client } = makeClient([
      { orchestration: { id: "orch-1" }, type: "SBOM", name: "sbom-step" },
    ]);
    const result = await registry.dispatch(client, "scs_chain_of_custody", "get", {
      artifact_id: "art-123",
      org_id: "default",
      project_id: "test-project",
    }) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0]?.openInHarness);
    expect(link).toContain("/supply-chain/artifacts/art-123");
    expect(link).not.toContain("sbom-step");
    expect(link).not.toContain("{");
  });
});
