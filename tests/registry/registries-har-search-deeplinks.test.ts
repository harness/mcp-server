/**
 * Regression coverage for HAR registry list query params and artifact deep links (#1030).
 *
 * - harness_list passes `search_term`; mapping it to a non-existent `search` query
 *   key silently dropped the filter on registry/artifact list ops.
 * - artifact list deep links left `{artifactIdentifier}` unresolved when list
 *   pathParams omitted the artifact_id → artifactIdentifier mapping.
 * - UPSTREAM registry create docs must mention required config.authType.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const SCOPE = { org_id: "my-org", project_id: "my-proj" };

describe("HAR registries — search_term query mapping (#1030)", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));
  });

  it.each([
    ["registry", "registries", { search_term: "docker-hub" }],
    [
      "artifact",
      "artifacts",
      { registry_id: "npm-reg", search_term: "lodash" },
    ],
    [
      "artifact_version",
      "artifactVersions",
      { registry_id: "npm-reg", artifact_id: "lodash-pkg", search_term: "4.18" },
    ],
    [
      "artifact_file",
      "files",
      {
        registry_id: "npm-reg",
        artifact_id: "lodash-pkg",
        version: "4.18.0",
        search_term: "package.json",
      },
    ],
  ] as const)(
    "%s list forwards search_term to the HAR API (not a bogus search key)",
    async (resourceType, arrayKey, dispatchInput) => {
      const mockRequest = vi.fn().mockResolvedValue({
        data: { [arrayKey]: [], itemCount: 0, pageIndex: 0, pageSize: 20, pageCount: 0 },
      });
      const client = makeClient(mockRequest);

      await registry.dispatch(client, resourceType, "list", {
        ...SCOPE,
        ...dispatchInput,
      });

      const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
      expect(call.params.search_term).toBe(dispatchInput.search_term);
      expect(call.params).not.toHaveProperty("search");
    },
  );
});

describe("HAR artifact list — openInHarness (#1030)", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));
  });

  it("resolves artifactIdentifier in per-item deep links", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        artifacts: [
          {
            artifactIdentifier: "my-artifact",
            registryIdentifier: "docker-reg",
            name: "my-artifact",
            orgIdentifier: "my-org",
            projectIdentifier: "my-proj",
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
      ...SCOPE,
      registry_id: "docker-reg",
      search_term: "my",
    })) as { items: Array<Record<string, unknown>> };

    const link = String(result.items[0]!.openInHarness);
    expect(link).toContain("/registries/docker-reg/artifacts/my-artifact");
    expect(link).not.toContain("{artifactIdentifier}");
    expect(link).not.toContain("%7BartifactIdentifier%7D");
  });
});

describe("HAR registry create schema — UPSTREAM authType (#1030)", () => {
  it("documents authType as required for UPSTREAM registries in config field description", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "registries" }));
    const configField = registry.getResource("registry").operations.create?.bodySchema?.fields.find(
      (f) => f.name === "config",
    );
    expect(configField?.description).toMatch(/authType/i);
    expect(configField?.description).toMatch(/UPSTREAM/i);
    expect(configField?.description).toMatch(/Anonymous/i);
  });
});
