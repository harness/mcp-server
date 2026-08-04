/**
 * Tests for the `attestation` resource type (evidence-vault toolset).
 *
 * Verifies harness_get maps resource_id → gitoid_sha256, enforces org/project
 * scope on get, and projects the details response through attestationDetailsExtract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_TOOLSETS: "evidence-vault",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: "accept" }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    async call(name: string, args: Record<string, unknown>, extra?: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const defaultExtra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, { ...defaultExtra, ...extra }) as Promise<ToolResult>;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  const item = result.content[0]!;
  if (item.type !== "text") throw new Error(`Expected text content, got "${item.type}"`);
  return JSON.parse(item.text);
}

describe("attestation — harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({
      type: "Build",
      source: "Harness",
      gitoid_sha256: "gid123",
      artifact_id: "art-1",
      payload_type: "application/vnd.in-toto+json",
      updated_at: 1700000001000,
      signature: "sig-bytes",
      subjects: [{ name: "registry/app:1.0", digest: { algorithm: "sha256", value: "deadbeef" } }],
      execution_context: {
        pipeline_id: "ci-build",
        pipeline_name: "CI Build",
        pipeline_execution_id: "exec-9",
      },
    });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("maps resource_id to gitoid_sha256 in the details path", async () => {
    const result = await server.call("harness_get", {
      resource_type: "attestation",
      resource_id: "gid123",
      org_id: "SSCA",
      project_id: "Sanity",
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown> };
    expect(callArgs.method).toBe("GET");
    expect(callArgs.path).toBe(
      "/ssca-manager/v2/orgs/SSCA/projects/Sanity/attestations/gid123/details",
    );
    expect(callArgs.params.identifier_type).toBe("gitoid_sha256");
  });

  it("requires org_id and project_id for get", async () => {
    const result = await server.call("harness_get", {
      resource_type: "attestation",
      resource_id: "gid123",
    });

    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toMatch(/org_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("projects response and drops internal API fields", async () => {
    const result = await server.call("harness_get", {
      resource_type: "attestation",
      resource_id: "gid123",
      org_id: "SSCA",
      project_id: "Sanity",
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.type).toBe("Build");
    expect(data.gitoid_sha256).toBe("gid123");
    expect(data.signature).toBe("sig-bytes");
    expect(data.pipeline_id).toBe("ci-build");
    expect(data.subjects).toEqual([
      { name: "registry/app:1.0", digest_algorithm: "sha256", digest_value: "deadbeef" },
    ]);
    expect(data).not.toHaveProperty("artifact_id");
    expect(data).not.toHaveProperty("payload_type");
    expect(data).not.toHaveProperty("updated_at");
    expect(data).not.toHaveProperty("execution_context");
  });
});
