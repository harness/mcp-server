import { describe, expect, it, vi } from "vitest";

import type { HarnessClient } from "../../src/client/harness-client.js";
import type { Config } from "../../src/config.js";
import { Registry } from "../../src/registry/index.js";
import type { ResourceDefinition } from "../../src/registry/types.js";
import { observabilityEvaluationsToolset } from "../../src/registry/toolsets/observability-evaluations.js";

const CONFIG_ID = "11111111-1111-4111-8111-111111111111";
const METRIC_SET_ID = "22222222-2222-4222-8222-222222222222";
const METRIC_ID = "33333333-3333-4333-8333-333333333333";

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
    HARNESS_TOOLSETS: "+observability-evaluations",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
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

function makeClient(request = vi.fn().mockResolvedValue({})): HarnessClient {
  return { request, account: "test-account" } as unknown as HarnessClient;
}

function resource(): ResourceDefinition {
  const definition = observabilityEvaluationsToolset.resources.find(item => item.resourceType === "observability_evaluation_rule");
  if (!definition) throw new Error("observability_evaluation_rule must be registered");
  return definition;
}

function validBody() {
  return {
    name: "Production quality",
    scope: "trace",
    metric_set_id: METRIC_SET_ID,
    selector_filters: [{ field: "service_name", op: "eq", value: "support-agent" }],
    sampling_percentage: 25,
    enabled: true,
  };
}

function validPreflightResponses() {
  return [
    {
      entries: [{
        metric_id: METRIC_ID,
        config: { llm_config: { connector_ref: "account.openai", model: "gpt-4.1-mini" } },
      }],
    },
    { name: "Answer quality", type: "llm", kind: "geval", config: { criteria: "Helpful and correct" } },
    {
      data: {
        connector: {
          type: "OpenAI",
          harnessManaged: false,
          spec: { apiKeyRef: "account.openai-key", model: "gpt-4.1-mini" },
        },
      },
    },
  ];
}

describe("Observability Evaluations toolset", () => {
  it("is separate from the offline AI Evals toolset", () => {
    expect(observabilityEvaluationsToolset.name).toBe("observability-evaluations");
    expect(resource().toolset).toBe("observability-evaluations");
    expect(observabilityEvaluationsToolset.optIn).toBe(true);
  });

  it("exposes only configuration CRUD", () => {
    expect(Object.keys(resource().operations)).toEqual(["list", "get", "create", "update", "delete"]);
    expect(resource().executeActions).toBeUndefined();
  });

  it("routes list and get to scheduled config endpoints", () => {
    const definition = resource();
    expect(definition.operations.list!.pathBuilder!({}, { HARNESS_ORG: "org", HARNESS_PROJECT: "project" }))
      .toBe("/gateway/ai-evals/api/v1/orgs/org/projects/project/online-eval-configs");
    expect(definition.operations.get!.pathBuilder!(
      { config_id: CONFIG_ID },
      { HARNESS_ORG: "org", HARNESS_PROJECT: "project" },
    )).toBe(`/gateway/ai-evals/api/v1/orgs/org/projects/project/online-eval-configs/${CONFIG_ID}`);
  });

  it("marks disable as an update and deletion as destructive", () => {
    expect(resource().operations.update!.operationPolicy).toMatchObject({ risk: "low_write", retryPolicy: "do_not_retry" });
    expect(resource().operations.delete!.operationPolicy).toMatchObject({ risk: "destructive", retryPolicy: "do_not_retry" });
    expect(resource().operations.update!.bodySchema!.fields.find(field => field.name === "enabled")?.description)
      .toContain("Set false to disable");
  });

  it("validates a direct LLM judge before creating a config", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(validPreflightResponses()[0])
      .mockResolvedValueOnce(validPreflightResponses()[1])
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID });
    const registry = new Registry(makeConfig());

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", { body: validBody() });

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: "GET",
      path: `/gateway/ai-evals/api/v1/orgs/default/projects/test-project/metric-sets/${METRIC_SET_ID}`,
      headerBasedScoping: true,
    }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "GET",
      path: `/gateway/ai-evals/api/v1/orgs/default/projects/test-project/metrics/${METRIC_ID}`,
      headerBasedScoping: true,
    }));
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: "GET",
      path: "/ng/api/connectors/account.openai",
      params: {},
    }));
    expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({
      method: "POST",
      path: "/gateway/ai-evals/api/v1/orgs/default/projects/test-project/online-eval-configs",
      body: validBody(),
    }));
  });

  it("validates direct judges with an explicit observability-only allowlist", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(validPreflightResponses()[0])
      .mockResolvedValueOnce(validPreflightResponses()[1])
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "observability-evaluations" }));

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", { body: validBody() });

    expect(request).toHaveBeenCalledTimes(4);
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      path: "/ng/api/connectors/account.openai",
      params: {},
    }));
  });

  it("accepts a metric-set judge_llm_connector_ref", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        judge_llm_connector_ref: "account.openai",
        entries: [{ metric_id: METRIC_ID }],
      })
      .mockResolvedValueOnce({ name: "Answer quality", type: "llm", kind: "geval", config: { criteria: "Helpful and correct" } })
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID });
    const registry = new Registry(makeConfig());

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", { body: validBody() });

    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: "GET",
      path: "/ng/api/connectors/account.openai",
      params: {},
    }));
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "POST" }));
  });

  it("rejects an incomplete entry judge instead of falling back to the metric-set connector", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        judge_llm_connector_ref: "account.openai",
        entries: [{ metric_id: METRIC_ID, config: { llm_config: { model: "gpt-4.1-mini" } } }],
      })
      .mockResolvedValueOnce({ name: "Answer quality", type: "llm", kind: "geval", config: { criteria: "Helpful and correct" } });
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: validBody(),
    })).rejects.toThrow(/requires judge_llm_config.connector_ref/);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("preserves an org-scoped judge connector reference", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        judge_llm_connector_ref: "org.openai",
        entries: [{ metric_id: METRIC_ID }],
      })
      .mockResolvedValueOnce({ name: "Answer quality", type: "llm", kind: "geval", config: { criteria: "Helpful and correct" } })
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID });
    const registry = new Registry(makeConfig());

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", { body: validBody() });

    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: "GET",
      path: "/ng/api/connectors/org.openai",
      params: { orgIdentifier: "default" },
    }));
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "POST" }));
  });

  it("preserves a project-scoped judge connector reference", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        judge_llm_connector_ref: "project.openai",
        entries: [{ metric_id: METRIC_ID }],
      })
      .mockResolvedValueOnce({ name: "Answer quality", type: "llm", kind: "geval", config: { criteria: "Helpful and correct" } })
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID });
    const registry = new Registry(makeConfig());

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", { body: validBody() });

    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: "GET",
      path: "/ng/api/connectors/project.openai",
      params: { orgIdentifier: "default", projectIdentifier: "test-project" },
    }));
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "POST" }));
  });

  it("allows omitted selector and sampling fields to use their documented defaults", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(validPreflightResponses()[0])
      .mockResolvedValueOnce(validPreflightResponses()[1])
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID });
    const registry = new Registry(makeConfig());
    const { selector_filters: _selectors, sampling_percentage: _sampling, ...body } = validBody();

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", { body });

    expect(request).toHaveBeenCalledTimes(4);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "POST",
      body,
    }));
  });

  it("allows a config to be disabled even if it was created before strict validation", async () => {
    const request = vi.fn().mockResolvedValue({ message: "disabled" });
    const registry = new Registry(makeConfig());

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "update", {
      config_id: CONFIG_ID,
      body: { enabled: false },
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: `/gateway/ai-evals/api/v1/orgs/default/projects/test-project/online-eval-configs/${CONFIG_ID}`,
      body: { enabled: false },
    }));
  });

  it("validates the merged rule before a material update", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({
        ...validBody(),
        config_id: CONFIG_ID,
        active_version: 1,
      })
      .mockResolvedValueOnce(validPreflightResponses()[0])
      .mockResolvedValueOnce(validPreflightResponses()[1])
      .mockResolvedValueOnce(validPreflightResponses()[2])
      .mockResolvedValueOnce({ config_id: CONFIG_ID, active_version: 2 });
    const registry = new Registry(makeConfig());

    await registry.dispatch(makeClient(request), "observability_evaluation_rule", "update", {
      config_id: CONFIG_ID,
      body: { sampling_percentage: 50 },
    });

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: "GET",
      path: `/gateway/ai-evals/api/v1/orgs/default/projects/test-project/online-eval-configs/${CONFIG_ID}`,
    }));
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "PATCH",
      path: `/gateway/ai-evals/api/v1/orgs/default/projects/test-project/online-eval-configs/${CONFIG_ID}`,
      body: { sampling_percentage: 50 },
      retryPolicy: "do_not_retry",
    }));
  });

  it("rejects sampling percentage zero before a create request", async () => {
    const request = vi.fn();
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: { ...validBody(), sampling_percentage: 0 },
    })).rejects.toThrow(/must be a finite percentage in \(0, 100\]/);
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects span scope before a create request", async () => {
    const request = vi.fn();
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: { ...validBody(), scope: "span" },
    })).rejects.toThrow(/scope='trace' only/);
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an unsupported metric type before writing the config", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ entries: [{ metric_id: METRIC_ID }] })
      .mockResolvedValueOnce({ name: "Embedding similarity", type: "embedding", kind: "embedding_similarity" });
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: validBody(),
    })).rejects.toThrow(/cannot be positively validated/);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("rejects a Harness-managed LLM judge that the scheduled snapshot omits", async () => {
    const responses = validPreflightResponses();
    const request = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce({ data: { connector: { type: "OpenAI", harnessManaged: true } } });
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: validBody(),
    })).rejects.toThrow(/scheduled scorer does not resolve/);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("rejects a direct LLM judge without a secret reference", async () => {
    const responses = validPreflightResponses();
    const request = vi.fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce({ data: { connector: { type: "OpenAI", harnessManaged: false, spec: { model: "gpt-4.1-mini" } } } });
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: validBody(),
    })).rejects.toThrow(/no supported API-key secret reference/);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("rejects a direct LLM judge without an effective model", async () => {
    const responses = validPreflightResponses();
    const request = vi.fn()
      .mockResolvedValueOnce({
        entries: [{ metric_id: METRIC_ID, config: { llm_config: { connector_ref: "account.openai" } } }],
      })
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce({ data: { connector: { type: "OpenAI", harnessManaged: false, spec: { apiKeyRef: "account.openai-key" } } } });
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "create", {
      body: validBody(),
    })).rejects.toThrow(/requires a non-empty model/);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("rejects non-UUID config IDs before building read or delete paths", async () => {
    const request = vi.fn();
    const registry = new Registry(makeConfig());

    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "get", {
      config_id: "../metric-sets",
    })).rejects.toThrow(/config_id must be a UUID/);
    await expect(registry.dispatch(makeClient(request), "observability_evaluation_rule", "delete", {
      config_id: "../metric-sets",
    })).rejects.toThrow(/config_id must be a UUID/);

    expect(request).not.toHaveBeenCalled();
  });
});
