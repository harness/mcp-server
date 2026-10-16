/**
 * Regression tests for HAR registry list search and artifact deep links (#1030).
 *
 * QA found search_term was mapped to a non-existent "search" query key (filter had
 * no effect) and artifact list deep links left {artifactIdentifier} unresolved
 * because list.pathParams omitted artifact_id → artifactIdentifier.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "registries",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn?: ReturnType<typeof vi.fn>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const SCOPE = { org_id: "myorg", project_id: "myproj" };

describe("HAR registries — search_term query mapping (#1030)", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  const listResources = [
    "registry",
    "artifact",
    "artifact_version",
    "artifact_file",
  ] as const;

  it.each(listResources)("maps harness_list search_term to the HAR search_term query key on %s list", (resourceType) => {
    const spec = registry.getResource(resourceType).operations.list;
    expect(spec?.queryParams?.search_term).toBe("search_term");
    expect(spec?.queryParams?.search).toBeUndefined();
  });

  it("registry list forwards search_term on the outgoing request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { registries: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      status: "SUCCESS",
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "registry", "list", {
      ...SCOPE,
      search_term: "npm mirror",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params).toMatchObject({ search_term: "npm mirror" });
    expect(call.params).not.toHaveProperty("search");
  });

  it("artifact list forwards search_term on the outgoing request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { artifacts: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      status: "SUCCESS",
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "artifact", "list", {
      ...SCOPE,
      registry_id: "docker-reg",
      search_term: "nginx",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params).toMatchObject({ search_term: "nginx" });
    expect(call.params).not.toHaveProperty("search");
  });
});

describe("HAR artifact list — deep link placeholder resolution (#1030)", () => {
  it("resolves {artifactIdentifier} in per-item openInHarness links", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        artifacts: [{
          registryIdentifier: "ai-platform",
          name: "harness-ai-agent",
          artifactIdentifier: "harness-ai-agent",
        }],
        itemCount: 1,
        pageIndex: 0,
        pageSize: 20,
        pageCount: 1,
      },
      status: "SUCCESS",
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "artifact", "list", {
      ...SCOPE,
      registry_id: "ai-platform",
    })) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0].openInHarness);
    expect(link).toContain("/registries/ai-platform/artifacts/harness-ai-agent");
    expect(link).not.toContain("{artifactIdentifier}");
  });
});

describe("HAR registry create schema — UPSTREAM authType (#1030)", () => {
  it("documents authType as required for UPSTREAM registries in config", () => {
    const registry = new Registry(makeConfig());
    const configField = registry.getResource("registry").operations.create?.bodySchema?.fields.find(
      (field) => field.name === "config",
    );
    expect(configField?.description).toContain("authType");
    expect(configField?.description).toMatch(/required for UPSTREAM/i);
  });
});
