import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { executionInputsExtract } from "../../src/registry/extractors.js";

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

describe("executionInputsExtract — response shape", () => {
  it("projects the NG envelope to the documented public shape", () => {
    const raw = {
      status: "SUCCESS",
      correlationId: "cid-1",
      data: {
        inputSetYaml: "pipeline:\n  identifier: p1\n",
        inputSetTemplateYaml: "pipeline:\n  identifier: p1\n  variables: <+input>\n",
        resolvedYaml: null,
        inputSetDetails: [
          { identifier: "is1", name: "Input Set One" },
          { identifier: "is2", name: "Input Set Two" },
        ],
        inputSetBranchName: "main",
      },
    };
    expect(executionInputsExtract(raw, { execution_id: "exec-42" })).toEqual({
      executionId: "exec-42",
      inputSetYaml: "pipeline:\n  identifier: p1\n",
      inputSetTemplateYaml: "pipeline:\n  identifier: p1\n  variables: <+input>\n",
      resolvedYaml: null,
      inputSetDetails: [
        { identifier: "is1", name: "Input Set One" },
        { identifier: "is2", name: "Input Set Two" },
      ],
      inputSetBranchName: "main",
    });
  });

  it("drops backend envelope/debug fields (no raw passthrough)", () => {
    const raw = {
      status: "SUCCESS",
      metaData: { internal: "should-be-stripped" },
      correlationId: "cid-2",
      data: {
        inputSetYaml: "yaml",
        // Extra unknown key the API might add — must NOT leak through.
        debugInfo: { trace: "x" },
      },
    };
    const result = executionInputsExtract(raw, { execution_id: "e1" }) as Record<string, unknown>;
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("metaData");
    expect(result).not.toHaveProperty("correlationId");
    expect(result).not.toHaveProperty("debugInfo");
    expect(Object.keys(result).sort()).toEqual([
      "executionId",
      "inputSetBranchName",
      "inputSetDetails",
      "inputSetTemplateYaml",
      "inputSetYaml",
      "resolvedYaml",
    ]);
  });

  it("returns nulls and empty inputSetDetails when fields are missing", () => {
    expect(executionInputsExtract({ status: "SUCCESS", data: {} }, { execution_id: "e1" })).toEqual({
      executionId: "e1",
      inputSetYaml: null,
      inputSetTemplateYaml: null,
      resolvedYaml: null,
      inputSetDetails: [],
      inputSetBranchName: null,
    });
  });

  it("normalizes inputSetDetails — only identifier/name survive", () => {
    const raw = {
      data: {
        inputSetDetails: [
          { identifier: "is1", name: "A", extra: "leak", internalRef: { x: 1 } },
          { identifier: "is2" }, // missing name
          { name: "C-no-id" },   // missing identifier
        ],
      },
    };
    const result = executionInputsExtract(raw, {}) as { inputSetDetails: unknown[] };
    expect(result.inputSetDetails).toEqual([
      { identifier: "is1", name: "A" },
      { identifier: "is2", name: null },
      { identifier: null, name: "C-no-id" },
    ]);
  });

  it("falls back to null executionId when input is missing", () => {
    const result = executionInputsExtract({ data: {} }, undefined) as { executionId: unknown };
    expect(result.executionId).toBeNull();
  });

  it("handles a non-array inputSetDetails value defensively", () => {
    const raw = { data: { inputSetDetails: "oops-not-an-array" } };
    const result = executionInputsExtract(raw, {}) as { inputSetDetails: unknown[] };
    expect(result.inputSetDetails).toEqual([]);
  });
});

describe("execution_inputs resource — request shape", () => {
  it("dispatches GET to /inputsetV2 with planExecutionId path param", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: { inputSetYaml: "" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "execution_inputs", "get", {
      execution_id: "exec-abc",
      org_id: "myorg",
      project_id: "myproj",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/pipelines/execution/exec-abc/inputsetV2",
        params: expect.objectContaining({
          orgIdentifier: "myorg",
          projectIdentifier: "myproj",
        }),
      }),
    );
  });

  it("maps resolve_expressions and resolve_expressions_type to the API query params", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: { resolvedYaml: "ok" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "execution_inputs", "get", {
      execution_id: "exec-1",
      resolve_expressions: true,
      resolve_expressions_type: "RESOLVE_ALL_EXPRESSIONS",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/pipelines/execution/exec-1/inputsetV2",
        params: expect.objectContaining({
          resolveExpressions: true,
          resolveExpressionsType: "RESOLVE_ALL_EXPRESSIONS",
        }),
      }),
    );
  });

  it("omits resolveExpressions params when not provided (defaults to upstream UNKNOWN)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ data: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "execution_inputs", "get", {
      execution_id: "exec-1",
    });

    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params).not.toHaveProperty("resolveExpressions");
    expect(call.params).not.toHaveProperty("resolveExpressionsType");
  });

  it("returns the projected response shape after dispatch (extractor wired up)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        inputSetYaml: "yaml-1",
        inputSetTemplateYaml: "yaml-2",
        resolvedYaml: "yaml-3",
        inputSetDetails: [{ identifier: "is1", name: "One" }],
        inputSetBranchName: "feature/x",
      },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "execution_inputs", "get", {
      execution_id: "exec-9",
    });

    expect(result).toEqual({
      executionId: "exec-9",
      inputSetYaml: "yaml-1",
      inputSetTemplateYaml: "yaml-2",
      resolvedYaml: "yaml-3",
      inputSetDetails: [{ identifier: "is1", name: "One" }],
      inputSetBranchName: "feature/x",
    });
  });
});
