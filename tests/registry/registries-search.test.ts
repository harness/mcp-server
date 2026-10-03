/**
 * HAR v1 list search must honor both input names.
 *
 * harness_describe advertises `search`. harness_list also sends a top-level
 * `search_term`. The HAR API query parameter is `search_term` either way.
 * Mapping only one input key makes the other call return an unfiltered page.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "avi",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "registries",
  } as Config;
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("HAR v1 list search query params", () => {
  const cases = [
    {
      resourceType: "registry",
      input: { org_id: "default", project_id: "avi" },
    },
    {
      resourceType: "artifact",
      input: { org_id: "default", project_id: "avi", registry_id: "docker" },
    },
    {
      resourceType: "artifact_version",
      input: { org_id: "default", project_id: "avi", registry_id: "docker", artifact_id: "nginx" },
    },
    {
      resourceType: "artifact_file",
      input: {
        org_id: "default",
        project_id: "avi",
        registry_id: "docker",
        artifact_id: "nginx",
        version: "1.0.0",
      },
    },
  ] as const;

  it.each(cases)(
    "$resourceType forwards filters.search as search_term",
    async ({ resourceType, input }) => {
      const registry = new Registry(makeConfig());
      const mockRequest = vi.fn().mockResolvedValue({ data: {} });
      await registry.dispatch(makeClient(mockRequest), resourceType, "list", {
        ...input,
        search: "nginx",
      });
      const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
      expect(call.params.search_term).toBe("nginx");
      expect(call.params).not.toHaveProperty("search");
    },
  );

  it.each(cases)(
    "$resourceType forwards the harness_list search_term argument",
    async ({ resourceType, input }) => {
      const registry = new Registry(makeConfig());
      const mockRequest = vi.fn().mockResolvedValue({ data: {} });
      await registry.dispatch(makeClient(mockRequest), resourceType, "list", {
        ...input,
        search_term: "nginx",
      });
      const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
      expect(call.params.search_term).toBe("nginx");
    },
  );

  it("prefers search_term when both names are set", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: {} });
    await registry.dispatch(makeClient(mockRequest), "registry", "list", {
      org_id: "default",
      project_id: "avi",
      search: "stale",
      search_term: "nginx",
    });
    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.search_term).toBe("nginx");
  });
});
