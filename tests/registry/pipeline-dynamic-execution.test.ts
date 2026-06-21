import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { dynamicExecutionExtract } from "../../src/registry/extractors.js";

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

describe("dynamicExecutionExtract — response shape", () => {
  it("flattens execution_details into { execution_id, status }", () => {
    const raw = {
      execution_details: {
        execution_id: "xD908VCSQVaP3Zo14tEI8g",
        status: "RUNNING",
      },
    };
    expect(dynamicExecutionExtract(raw)).toEqual({
      execution_id: "xD908VCSQVaP3Zo14tEI8g",
      status: "RUNNING",
    });
  });

  it("does NOT leak the original execution_details envelope", () => {
    const raw = {
      execution_details: {
        execution_id: "exec-1",
        status: "RUNNING",
        // Extra debug field the API might add — must not pass through.
        debugInfo: "internal",
      },
      // Top-level metaData/correlationId — must not pass through.
      correlationId: "cid-x",
    };
    const result = dynamicExecutionExtract(raw) as Record<string, unknown>;
    expect(result).not.toHaveProperty("execution_details");
    expect(result).not.toHaveProperty("debugInfo");
    expect(result).not.toHaveProperty("correlationId");
    expect(Object.keys(result).sort()).toEqual(["execution_id", "status"]);
  });

  it("returns nulls when execution_details is missing or partial", () => {
    expect(dynamicExecutionExtract({})).toEqual({ execution_id: null, status: null });
    expect(dynamicExecutionExtract({ execution_details: {} })).toEqual({ execution_id: null, status: null });
    expect(dynamicExecutionExtract({ execution_details: { status: "QUEUED" } })).toEqual({
      execution_id: null,
      status: "QUEUED",
    });
  });

  it("passes null/undefined through defensively", () => {
    expect(dynamicExecutionExtract(null)).toBeNull();
    expect(dynamicExecutionExtract(undefined)).toBeUndefined();
  });
});

describe("pipeline_dynamic_execution.run — request shape", () => {
  it("dispatches POST to /v1/.../execute/dynamic with the resolved path", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      execution_details: { execution_id: "exec-1", status: "RUNNING" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
      pipeline_id: "Deploy_Web_Application",
      org_id: "myorg",
      project_id: "myproj",
      body: { yaml: "pipeline:\n  identifier: dynamic\n" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/orgs/myorg/projects/myproj/pipelines/Deploy_Web_Application/execute/dynamic",
        body: { yaml: "pipeline:\n  identifier: dynamic\n" },
      }),
    );
  });

  it("serializes a JSON pipeline object inside body.yaml to a YAML string", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      execution_details: { execution_id: "exec-3", status: "RUNNING" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
      pipeline_id: "p1",
      body: {
        yaml: {
          pipeline: { identifier: "from-object", name: "From Object" },
        },
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { yaml: string } };
    expect(typeof call.body.yaml).toBe("string");
    expect(call.body.yaml).toContain("identifier: from-object");
    expect(call.body.yaml).toContain("name: From Object");
  });

  it("maps optional query params (module_type, notes, notify_only_user)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      execution_details: { execution_id: "exec-4", status: "RUNNING" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
      pipeline_id: "p1",
      module_type: "CI",
      notes: "agent-generated run",
      notify_only_user: true,
      body: { yaml: "pipeline: {}\n" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        params: expect.objectContaining({
          moduleType: "CI",
          notes: "agent-generated run",
          notify_only_user: true,
        }),
      }),
    );
  });

  it("uses header-based scoping — no accountIdentifier query param", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      execution_details: { execution_id: "exec-5", status: "RUNNING" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
      pipeline_id: "p1",
      body: { yaml: "pipeline: {}\n" },
    });

    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown>; headerBasedScoping?: boolean };
    expect(call.params).not.toHaveProperty("accountIdentifier");
    expect(call.headerBasedScoping).toBe(true);
  });

  it("throws a clear error when body is missing or has no yaml field", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
        pipeline_id: "p1",
      }),
    ).rejects.toThrow(/yaml/i);

    await expect(
      registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
        pipeline_id: "p1",
        body: { somethingElse: "wrong" },
      }),
    ).rejects.toThrow(/yaml/i);

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("returns the projected response shape with an openInHarness deep link", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      execution_details: { execution_id: "exec-9", status: "RUNNING" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
      pipeline_id: "Deploy_Web_Application",
      org_id: "myorg",
      project_id: "myproj",
      body: { yaml: "pipeline: {}\n" },
    })) as { execution_id: string; status: string; openInHarness?: string };

    expect(result.execution_id).toBe("exec-9");
    expect(result.status).toBe("RUNNING");
    expect(result.openInHarness).toContain("/account/test-account/");
    expect(result.openInHarness).toContain("/orgs/myorg/projects/myproj/pipelines/Deploy_Web_Application/");
    expect(result.openInHarness).toContain("/deployments/exec-9/pipeline");
  });

  it("throws before HTTP when org_id and project_id are missing and config defaults are unset", async () => {
    const registry = new Registry(makeConfig({ HARNESS_ORG: undefined, HARNESS_PROJECT: undefined }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pipeline_dynamic_execution", "run", {
        pipeline_id: "p1",
        body: { yaml: "pipeline: {}\n" },
      }),
    ).rejects.toThrow(/Missing required field "org_id"/);

    expect(mockRequest).not.toHaveBeenCalled();
  });
});
