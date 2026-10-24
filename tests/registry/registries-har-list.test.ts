/**
 * Regression coverage for HAR registry list query params and artifact deep links (#1030).
 * The HAR API expects `search_term` as the query key; mapping input `search` silently dropped filters.
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
    HARNESS_ORG: "PROD",
    HARNESS_PROJECT: "Harness",
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
  return {
    request: vi.fn().mockResolvedValue(response),
  } as unknown as HarnessClient;
}

const emptyHarListEnvelope = {
  data: { itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
};

describe("HAR registries list query params (#1030)", () => {
  const registry = new Registry(makeConfig());

  it("registry.list forwards search_term to the HAR search_term query param (not search)", async () => {
    const client = mockClient({
      data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
    });

    await registry.dispatch(client, "registry", "list", {
      org_id: "PROD",
      project_id: "Harness",
      search_term: "npm-mirror",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.params.search_term).toBe("npm-mirror");
    expect(call.params.search).toBeUndefined();
  });

  it("artifact.list forwards search_term and maps artifactIdentifier in deep links", async () => {
    const client = mockClient({
      data: {
        artifacts: [{ artifactIdentifier: "harness-ai-agent", name: "Harness AI Agent" }],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
    });

    const result = (await registry.dispatch(client, "artifact", "list", {
      org_id: "PROD",
      project_id: "Harness",
      registry_id: "ai-platform",
      search_term: "agent",
    })) as { items: Array<Record<string, unknown>> };

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.params.search_term).toBe("agent");
    expect(call.params.search).toBeUndefined();

    const link = String(result.items[0]?.openInHarness ?? "");
    expect(link).toContain("/artifacts/harness-ai-agent");
    expect(link).not.toContain("{artifactIdentifier}");
    expect(link).not.toMatch(/\{artifact/i);
  });

  it("artifact_version.list forwards search_term query param", async () => {
    const client = mockClient({
      ...emptyHarListEnvelope,
      data: { ...emptyHarListEnvelope.data, artifactVersions: [] },
    });

    await registry.dispatch(client, "artifact_version", "list", {
      org_id: "PROD",
      project_id: "Harness",
      registry_id: "ai-platform",
      artifact_id: "harness-ai-agent",
      search_term: "1.0",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.params.search_term).toBe("1.0");
    expect(call.params.search).toBeUndefined();
  });

  it("artifact_file.list forwards search_term query param", async () => {
    const client = mockClient({
      ...emptyHarListEnvelope,
      data: { ...emptyHarListEnvelope.data, files: [] },
    });

    await registry.dispatch(client, "artifact_file", "list", {
      org_id: "PROD",
      project_id: "Harness",
      registry_id: "ai-platform",
      artifact_id: "harness-ai-agent",
      version: "1.2.3",
      search_term: "package.json",
    });

    const call = (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.params.search_term).toBe("package.json");
    expect(call.params.search).toBeUndefined();
  });

  it("registry create bodySchema documents UPSTREAM authType requirement", () => {
    const def = registriesToolset.resources.find((r) => r.resourceType === "registry");
    const configField = def?.operations.create?.bodySchema?.fields.find((f) => f.name === "config");
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/UPSTREAM/i);
  });
});
