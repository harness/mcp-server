/**
 * Unit tests for AI Evals toolset:
 * - Pagination mapping (size → limit)
 * - Resource presence and removed internal ops
 * - New online_eval resource
 * - Filter queryParams correctness
 * - diagnosticHint presence on key entities
 */
import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { aiEvalsToolset } from "../../src/registry/toolsets/ai-evals.js";
import { aiEvalsListExtract, aiEvalsArrayExtract } from "../../src/registry/extractors.js";
import type { ResourceDefinition } from "../../src/registry/types.js";

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
    HARNESS_TOOLSETS: "+ai-evals",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_MCP_TRUST_PROXY: 0,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = aiEvalsToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in aiEvalsToolset`);
  return res;
}

function fieldNames(fields: { name: string }[]): string[] {
  return fields.map((field) => field.name);
}

// ─── Pagination mapping ─────────────────────────────────────────────────────

describe("AI Evals pagination mapping", () => {
  it("dataset list sends size as limit query param", () => {
    const res = findResource("eval_dataset");
    const listOp = res.operations.list!;
    expect(listOp.queryParams).toHaveProperty("size", "limit");
    expect(listOp.queryParams).toHaveProperty("page", "page");
  });

  it("eval_run list sends size as limit query param", () => {
    const res = findResource("eval_run");
    const listOp = res.operations.list!;
    expect(listOp.queryParams).toHaveProperty("size", "limit");
  });
});

// ─── Path-scoped writes ─────────────────────────────────────────────────────

describe("AI Evals path-scoped write bodies", () => {
  it("uses resource-level header scoping instead of redundant endpoint-level body injection flags", () => {
    const redundant: string[] = [];

    for (const resource of aiEvalsToolset.resources) {
      expect(resource.headerBasedScoping).toBe(true);
      for (const [operation, spec] of Object.entries(resource.operations)) {
        if (spec?.skipScopeBodyInjection) {
          redundant.push(`${resource.resourceType}.${operation}`);
        }
      }
      for (const [action, spec] of Object.entries(resource.executeActions ?? {})) {
        if (spec.skipScopeBodyInjection) {
          redundant.push(`${resource.resourceType}.${action}`);
        }
      }
    }

    expect(redundant).toEqual([]);
  });

  it("dataset create does not inject NG scope fields into the API body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ id: "dataset-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "eval_dataset", "create", {
      org_id: "myorg",
      project_id: "myproj",
      body: {
        name: "Golden Dataset",
        identifier: "golden_dataset",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/ai-evals/api/v1/orgs/myorg/projects/myproj/dataset");
    expect(call.body).toEqual({
      name: "Golden Dataset",
      identifier: "golden_dataset",
    });
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });
});

// ─── Internal ops removed ───────────────────────────────────────────────────

describe("AI Evals internal ops removed", () => {
  it("eval_run has no create operation", () => {
    const res = findResource("eval_run");
    expect(res.operations.create).toBeUndefined();
  });

  it("eval_run has no update operation", () => {
    const res = findResource("eval_run");
    expect(res.operations.update).toBeUndefined();
  });

  it("eval_run has no post_scores execute action", () => {
    const res = findResource("eval_run");
    expect(res.executeActions?.post_scores).toBeUndefined();
  });

  it("eval_run_item has no append_items execute action", () => {
    const res = findResource("eval_run_item");
    expect(res.executeActions).toBeUndefined();
  });

  it("eval_run retains list, get, compare, rescore", () => {
    const res = findResource("eval_run");
    expect(res.operations.list).toBeDefined();
    expect(res.operations.get).toBeDefined();
    expect(res.executeActions?.compare).toBeDefined();
    expect(res.executeActions?.rescore).toBeDefined();
  });
});

// ─── online_eval resource ───────────────────────────────────────────────────

describe("AI Evals online_eval resource", () => {
  it("exists in the toolset", () => {
    expect(() => findResource("online_eval")).not.toThrow();
  });

  it("has evaluate execute action with POST method", () => {
    const res = findResource("online_eval");
    const action = res.executeActions?.evaluate;
    expect(action).toBeDefined();
    expect(action!.method).toBe("POST");
  });

  it("evaluate path includes trace_id", () => {
    const res = findResource("online_eval");
    const action = res.executeActions!.evaluate;
    const path = action.pathBuilder!(
      { trace_id: "abc123", org_id: "myorg", project_id: "myproj" },
      { HARNESS_ORG: "", HARNESS_PROJECT: "" },
    );
    expect(path).toContain("/traces/abc123/evaluate");
  });

  it("has diagnosticHint", () => {
    const res = findResource("online_eval");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint).toContain("trace");
  });

  it("evaluate schema uses metric_set_id and judge_llm_connector_ref, not deprecated metric_ids", () => {
    const res = findResource("online_eval");
    const action = res.executeActions!.evaluate;
    const fields = fieldNames(action.bodySchema!.fields);

    expect(fields).toContain("metric_set_id");
    expect(fields).toContain("judge_llm_connector_ref");
    expect(fields).not.toContain("metric_ids");
  });

  it("evaluate metadata no longer references metric_ids", () => {
    const res = findResource("online_eval");
    const action = res.executeActions!.evaluate;
    const metadataText = JSON.stringify({
      diagnosticHint: res.diagnosticHint,
      relatedResources: res.relatedResources,
      actionDescription: action.actionDescription,
      bodySchema: action.bodySchema,
    });

    expect(metadataText).toContain("metric_set_id");
    expect(metadataText).toContain("eval_metric_set");
    expect(metadataText).not.toContain("metric_ids");
  });

  it("evaluate dispatch sends metric_set_id and judge_llm_connector_ref in the API body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ id: "annotation-1" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "online_eval", "evaluate", {
      org_id: "myorg",
      project_id: "myproj",
      trace_id: "trace-123",
      body: {
        span_id: "span-456",
        metric_set_id: "metric-set-1",
        judge_llm_connector_ref: "account.openai",
        options: { include_trajectory: false },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/ai-evals/api/v1/orgs/myorg/projects/myproj/traces/trace-123/evaluate");
    expect(call.body).toEqual({
      span_id: "span-456",
      metric_set_id: "metric-set-1",
      judge_llm_connector_ref: "account.openai",
      options: { include_trajectory: false },
    });
    expect(call.body).not.toHaveProperty("metric_ids");
  });
});

// ─── Filter queryParams ─────────────────────────────────────────────────────

describe("AI Evals filter queryParams", () => {
  it("dataset list has target_id filter", () => {
    const res = findResource("eval_dataset");
    expect(res.operations.list!.queryParams).toHaveProperty("target_id", "target_id");
  });

  it("metric list has search and target_id filters", () => {
    const res = findResource("eval_metric");
    const qp = res.operations.list!.queryParams!;
    expect(qp).toHaveProperty("search", "search");
    expect(qp).toHaveProperty("target_id", "target_id");
  });

  it("metric set list has target_id filter", () => {
    const res = findResource("eval_metric_set");
    expect(res.operations.list!.queryParams).toHaveProperty("target_id", "target_id");
  });
});

// ─── diagnosticHint presence ────────────────────────────────────────────────

describe("AI Evals diagnosticHint on key entities", () => {
  const entitiesWithHints = [
    "eval_dataset",
    "evaluation",
    "eval_target",
    "eval_metric",
    "eval_metric_set",
    "eval_suite",
    "online_eval",
  ];

  for (const type of entitiesWithHints) {
    it(`${type} has a diagnosticHint`, () => {
      const res = findResource(type);
      expect(res.diagnosticHint).toBeDefined();
      expect(res.diagnosticHint!.length).toBeGreaterThan(20);
    });
  }
});

// ─── eval_model removed ────────────────────────────────────────────────────

describe("AI Evals eval_model removed", () => {
  it("eval_model resource does not exist in the toolset", () => {
    const res = aiEvalsToolset.resources.find((r) => r.resourceType === "eval_model");
    expect(res).toBeUndefined();
  });

  it("no resource references eval_model in relatedResources", () => {
    for (const resource of aiEvalsToolset.resources) {
      const related = resource.relatedResources ?? [];
      expect(related).not.toContain("eval_model");
    }
  });
});

// ─── eval_git_registration resource ────────────────────────────────────────

describe("AI Evals eval_git_registration resource", () => {
  it("exists in the toolset", () => {
    expect(() => findResource("eval_git_registration")).not.toThrow();
  });

  it("has register execute action with POST method", () => {
    const res = findResource("eval_git_registration");
    const action = res.executeActions?.register;
    expect(action).toBeDefined();
    expect(action!.method).toBe("POST");
  });

  it("register action has low_write risk policy", () => {
    const res = findResource("eval_git_registration");
    const action = res.executeActions!.register;
    expect(action.operationPolicy?.risk).toBe("low_write");
  });

  it("has diagnosticHint mentioning manifest", () => {
    const res = findResource("eval_git_registration");
    expect(res.diagnosticHint).toBeDefined();
    expect(res.diagnosticHint).toContain("manifest");
  });
});

// ─── eval_target test action risk level ────────────────────────────────────

describe("AI Evals eval_target test action", () => {
  it("test action has low_write risk (not read)", () => {
    const res = findResource("eval_target");
    const action = res.executeActions?.test;
    expect(action).toBeDefined();
    expect(action!.operationPolicy?.risk).toBe("low_write");
  });

  it("test action has do_not_retry policy", () => {
    const res = findResource("eval_target");
    const action = res.executeActions!.test;
    expect(action.operationPolicy?.retryPolicy).toBe("do_not_retry");
  });
});

// ─── LLM connector ref in body schemas ─────────────────────────────────────

describe("AI Evals LLM connector ref migration", () => {
  it("metric set create body schema uses judge_llm_connector_ref not judge_model_id", () => {
    const res = findResource("eval_metric_set");
    const createOp = res.operations.create!;
    const fields = createOp.bodySchema!.fields;
    const hasConnectorRef = fields.some((f) => f.name === "judge_llm_connector_ref");
    const hasModelId = fields.some((f) => f.name === "judge_model_id");
    expect(hasConnectorRef).toBe(true);
    expect(hasModelId).toBe(false);
  });

  it("dataset generate body schema uses llm_connector_ref not model_id", () => {
    const res = findResource("eval_dataset");
    const action = res.executeActions?.generate;
    expect(action).toBeDefined();
    const fields = action!.bodySchema!.fields;
    const hasConnectorRef = fields.some((f) => f.name === "llm_connector_ref");
    const hasModelId = fields.some((f) => f.name === "model_id");
    expect(hasConnectorRef).toBe(true);
    expect(hasModelId).toBe(false);
  });
});

// ─── Control-plane API drift ────────────────────────────────────────────────

describe("AI Evals control-plane API drift", () => {
  it("metric create body schema requires dimension", () => {
    const res = findResource("eval_metric");
    const createOp = res.operations.create!;
    const dimensionField = createOp.bodySchema!.fields.find((field) => field.name === "dimension");

    expect(dimensionField).toMatchObject({
      name: "dimension",
      type: "string",
      required: true,
    });
  });

  it("metric create dispatch preserves dimension in the API body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ id: "metric-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "eval_metric", "create", {
      org_id: "myorg",
      project_id: "myproj",
      body: {
        name: "Correctness Judge",
        type: "llm",
        dimension: "correctness",
        kind: "rubric_judge",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/ai-evals/api/v1/orgs/myorg/projects/myproj/metrics");
    expect(call.body).toEqual({
      name: "Correctness Judge",
      type: "llm",
      dimension: "correctness",
      kind: "rubric_judge",
    });
  });

  it("annotation create and update body schemas expose thumbs_up", () => {
    const res = findResource("eval_annotation");
    const createFields = fieldNames(res.operations.create!.bodySchema!.fields);
    const updateFields = fieldNames(res.operations.update!.bodySchema!.fields);

    expect(createFields).toContain("thumbs_up");
    expect(updateFields).toContain("thumbs_up");
  });

  it("annotation create dispatch preserves thumbs_up false in the API body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ id: "annotation-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "eval_annotation", "create", {
      org_id: "myorg",
      project_id: "myproj",
      body: {
        trace_id: "trace-123",
        label: "human-feedback",
        thumbs_up: false,
        comment: "Incorrect answer",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/ai-evals/api/v1/orgs/myorg/projects/myproj/observe/annotations");
    expect(call.body).toEqual({
      trace_id: "trace-123",
      label: "human-feedback",
      thumbs_up: false,
      comment: "Incorrect answer",
    });
  });

  it("annotation update dispatch preserves thumbs_up true in the API body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ id: "annotation-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "eval_annotation", "update", {
      org_id: "myorg",
      project_id: "myproj",
      annotation_id: "annotation-1",
      body: {
        thumbs_up: true,
        comment: "Resolved after review",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PATCH");
    expect(call.path).toBe("/gateway/ai-evals/api/v1/orgs/myorg/projects/myproj/observe/annotations/annotation-1");
    expect(call.body).toEqual({
      thumbs_up: true,
      comment: "Resolved after review",
    });
  });
});

// ─── dataset export removed ────────────────────────────────────────────────

describe("AI Evals dataset export removed", () => {
  it("eval_dataset has no export execute action (NDJSON incompatible)", () => {
    const res = findResource("eval_dataset");
    expect(res.executeActions?.export).toBeUndefined();
  });
});

// ─── Extractors ─────────────────────────────────────────────────────────────

describe("AI Evals extractors", () => {
  it("aiEvalsListExtract handles standard paginated response", () => {
    const result = aiEvalsListExtract({ data: [{ id: "1" }, { id: "2" }], total_elements: 5 });
    expect(result).toEqual({ items: [{ id: "1" }, { id: "2" }], total: 5 });
  });

  it("aiEvalsListExtract handles empty response", () => {
    const result = aiEvalsListExtract({});
    expect(result).toEqual({ items: [], total: 0 });
  });

  it("aiEvalsArrayExtract handles bare array", () => {
    const result = aiEvalsArrayExtract([{ id: "a" }, { id: "b" }]);
    expect(result).toEqual({ items: [{ id: "a" }, { id: "b" }], total: 2 });
  });

  it("aiEvalsArrayExtract handles non-array", () => {
    const result = aiEvalsArrayExtract("unexpected");
    expect(result).toEqual({ items: [], total: 0 });
  });
});
