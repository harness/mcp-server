import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import { registerExecutionSummaryResource } from "../../src/resources/execution-summary.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.account.token.secret",
    HARNESS_ACCOUNT_ID: "account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: undefined,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: "0",
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function setupResource(configOverrides: Partial<Config> = {}) {
  const server = {
    registerResource: vi.fn(),
  };
  const registry = {
    getResource: vi.fn(() => ({ scope: "project", scopeOptional: false })),
    dispatch: vi.fn(),
  };
  const client = {};

  registerExecutionSummaryResource(
    server as never,
    registry as never,
    client as never,
    makeConfig(configOverrides),
  );

  expect(server.registerResource).toHaveBeenCalledOnce();

  const readHandler = server.registerResource.mock.calls[0][3] as (uri: URL) => Promise<{
    contents: Array<{ uri: string; mimeType: string; text: string }>;
  }>;

  return { client, registry, server, readHandler };
}

const fakeUri = new URL("executions:///recent");

describe("execution-summary resource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips fetch when default project is missing", async () => {
    const { registry, readHandler } = setupResource({ HARNESS_PROJECT: undefined });

    const result = await readHandler(fakeUri);
    const body = JSON.parse(result.contents[0].text);

    expect(body).toEqual({ items: [], total: 0, skipped: "missing org/project scope" });
    expect(registry.getResource).toHaveBeenCalledWith("execution");
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("skips fetch when default org is whitespace", async () => {
    const { registry, readHandler } = setupResource({ HARNESS_ORG: "   " });

    const result = await readHandler(fakeUri);
    const body = JSON.parse(result.contents[0].text);

    expect(body).toEqual({ items: [], total: 0, skipped: "missing org/project scope" });
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("skips fetch when the execution toolset is disabled", async () => {
    const { registry, readHandler } = setupResource();
    registry.getResource.mockImplementation(() => {
      throw new Error("Unknown resource_type: execution");
    });

    const result = await readHandler(fakeUri);
    const body = JSON.parse(result.contents[0].text);

    expect(body).toEqual({ items: [], total: 0, skipped: "resource unavailable" });
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("fetches executions when org and project are available", async () => {
    const { client, registry, readHandler } = setupResource({
      HARNESS_ORG: "org",
      HARNESS_PROJECT: "project",
    });
    const mockResult = {
      items: [{ executionId: "exec1", status: "Success" }],
      total: 1,
    };
    registry.dispatch.mockResolvedValue(mockResult);

    const result = await readHandler(fakeUri);
    const body = JSON.parse(result.contents[0].text);

    expect(registry.dispatch).toHaveBeenCalledWith(
      client,
      "execution",
      "list",
      {
        org_id: "org",
        project_id: "project",
        size: 10,
        page: 0,
      },
      { tool: "execution_summary_resource" },
    );
    expect(body).toEqual(mockResult);
  });

  it("returns error JSON when dispatch throws", async () => {
    const { registry, readHandler } = setupResource({
      HARNESS_ORG: "org",
      HARNESS_PROJECT: "project",
    });
    registry.dispatch.mockRejectedValue(new Error("HarnessApiError: 500 Internal Server Error"));

    const result = await readHandler(fakeUri);
    const body = JSON.parse(result.contents[0].text);

    expect(body.error).toContain("HarnessApiError");
    expect(body.items).toEqual([]);
  });

  it("skips fetch for scopeOptional=false even with empty-string project", async () => {
    const { registry, readHandler } = setupResource({ HARNESS_PROJECT: "" });

    const result = await readHandler(fakeUri);
    const body = JSON.parse(result.contents[0].text);

    expect(body.skipped).toBe("missing org/project scope");
    expect(registry.dispatch).not.toHaveBeenCalled();
  });

  it("proceeds when resource is scopeOptional", async () => {
    const { registry, readHandler } = setupResource({ HARNESS_PROJECT: undefined });
    registry.getResource.mockReturnValue({ scope: "project", scopeOptional: true });
    registry.dispatch.mockResolvedValue({ items: [], total: 0 });

    await readHandler(fakeUri);

    expect(registry.dispatch).toHaveBeenCalled();
  });
});
