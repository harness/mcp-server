/**
 * Agent toolset — uid generation, create body validation, and dispatch paths.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { agentsToolset } from "../../src/registry/toolsets/agents.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

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
    HARNESS_TOOLSETS: "agents",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = agentsToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found`);
  return res;
}

function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op as keyof typeof res.operations];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

describe("agent create bodyBuilder", () => {
  const createOp = getOp("agent", "create");
  const bodyBuilder = createOp.bodyBuilder!;

  it("generates uid from name when uid is omitted", () => {
    const body = bodyBuilder({
      body: { name: "DevOps Assistant!", spec: "agent:\n  task: review" },
    }) as Record<string, unknown>;

    expect(body.uid).toBe("devops_assistant");
    expect(body.name).toBe("DevOps Assistant!");
  });

  it("trims leading and trailing underscores from generated uid", () => {
    const body = bodyBuilder({
      body: { name: "  PR Reviewer  ", spec: "agent:\n  task: review" },
    }) as Record<string, unknown>;

    expect(body.uid).toBe("pr_reviewer");
  });

  it("preserves an explicit uid and does not overwrite it", () => {
    const body = bodyBuilder({
      body: { uid: "custom_uid", name: "Display Name", spec: "agent:\n  task: review" },
    }) as Record<string, unknown>;

    expect(body.uid).toBe("custom_uid");
  });

  it("throws when body is missing", () => {
    expect(() => bodyBuilder({})).toThrow(/body is required/);
  });

  it("throws when neither uid nor name is provided", () => {
    expect(() =>
      bodyBuilder({ body: { spec: "agent:\n  task: review" } }),
    ).toThrow(/uid is required/);
  });
});

describe("agent registry dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: GET /gateway/agents/api/v1/agents with project scope", async () => {
    const mockRequest = vi.fn().mockResolvedValue([{ uid: "ca_reviewer", name: "Reviewer" }]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "list", {
      org_id: "default",
      project_id: "test-project",
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/agents/api/v1/agents");
  });

  it("get: maps agent_id to path param agentIdentifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ uid: "ca_reviewer", spec: "agent:" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "get", {
      agent_id: "ca_reviewer",
      org_id: "default",
      project_id: "test-project",
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/agents/api/v1/agents/ca_reviewer");
  });

  it("create: POST body includes auto-generated uid from name", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ uid: "code_reviewer" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "create", {
      org_id: "default",
      project_id: "test-project",
      body: {
        name: "Code Reviewer",
        spec: "agent:\n  task: review pull requests",
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/agents/api/v1/agents");
    expect(call.body.uid).toBe("code_reviewer");
    expect(call.body.name).toBe("Code Reviewer");
  });

  it("update: PUT with agent_id path param and passes body through", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ uid: "ca_reviewer" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "update", {
      agent_id: "ca_reviewer",
      org_id: "default",
      project_id: "test-project",
      body: { description: "Updated description" },
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/gateway/agents/api/v1/agents/ca_reviewer");
    expect(call.body.description).toBe("Updated description");
  });

  it("delete: DELETE with agent_id path param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "delete", {
      agent_id: "ca_reviewer",
      org_id: "default",
      project_id: "test-project",
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gateway/agents/api/v1/agents/ca_reviewer");
  });
});
