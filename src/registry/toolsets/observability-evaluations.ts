/**
 * Scheduled observability-evaluation control plane.
 *
 * This is intentionally separate from the offline `ai-evals` toolset. The
 * existing `online_eval` resource there evaluates one trace immediately;
 * this toolset owns the persisted rules consumed by the Spark scorer.
 */
import type { BodySchema, PathBuilderConfig, PreflightContext, ToolsetDefinition } from "../types.js";
import { aiEvalsListExtract, passthrough } from "../extractors.js";
import { getConnector } from "./ai-evals.js";

const AI = "/gateway/ai-evals/api/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACE_SELECTOR_FIELDS = new Set([
  "service_name",
  "name",
  "status_code",
  "span_type",
  "agent_name",
  "model",
  "tool_name",
]);
const DIRECT_LLM_CONNECTOR_TYPES = new Set(["OpenAi", "OpenAI", "Anthropic", "AzureOpenAI", "AzureOpenAi", "GoogleAI", "GoogleAi"]);
const EMBEDDING_DEPENDENT_KINDS = new Set(["answer_correctness", "answer_similarity", "embedding_similarity"]);
const UNSUPPORTED_METRIC_TYPES = new Set(["code", "embedding", "composite"]);
const UNSAFE_SELECTOR_VALUE = /['"\\]/;
const ATTRIBUTE_KEY = /^[A-Za-z0-9_.:-]+$/;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireBody(input: JsonRecord, operation: string): JsonRecord {
  const body = asRecord(input.body);
  if (!body) throw new Error(`${operation} requires body to be a JSON object.`);
  return body;
}

function requireUuid(value: unknown, field: string): string {
  const id = nonEmptyString(value);
  if (!id || !UUID_PATTERN.test(id)) {
    throw new Error(`${field} must be a UUID returned by an AI Evals read operation; do not invent an identifier.`);
  }
  return id;
}

function scopeOrThrow(input: JsonRecord, config: PathBuilderConfig): { org: string; project: string } {
  const org = nonEmptyString(input.org_id) ?? config.HARNESS_ORG ?? "";
  const project = nonEmptyString(input.project_id) ?? config.HARNESS_PROJECT ?? "";
  if (!org || !project) {
    throw new Error(
      "Observability Evaluation Rules require org_id and project_id. Set HARNESS_ORG/HARNESS_PROJECT or pass both values.",
    );
  }
  return { org, project };
}

function base(input: JsonRecord, config: PathBuilderConfig): string {
  const { org, project } = scopeOrThrow(input, config);
  return `${AI}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}`;
}

function configPath(input: JsonRecord, config: PathBuilderConfig): string {
  const configId = requireUuid(input.config_id, "config_id");
  return `${base(input, config)}/online-eval-configs/${configId}`;
}

function unwrapRecord(value: unknown, description: string): JsonRecord {
  const record = asRecord(value);
  const unwrapped = asRecord(record?.data) ?? asRecord(record?.content) ?? record;
  if (!unwrapped) throw new Error(`${description} returned an invalid response.`);
  return unwrapped;
}

async function getAiEvalsResource(
  ctx: PreflightContext,
  input: JsonRecord,
  path: string,
  description: string,
): Promise<JsonRecord> {
  scopeOrThrow(input, { HARNESS_ORG: ctx.registry.orgId, HARNESS_PROJECT: ctx.registry.projectId });
  try {
    const result = await ctx.client.request<unknown>({
      method: "GET",
      path,
      headerBasedScoping: true,
      retryPolicy: "safe",
      signal: ctx.signal,
    });
    return unwrapRecord(result, description);
  } catch (error) {
    throw new Error(`${description} is not readable in this org/project. Details: ${(error as Error).message}`);
  }
}

function validateSelectors(value: unknown): void {
  if (!Array.isArray(value)) throw new Error("selector_filters must be an array.");
  for (const [index, selector] of value.entries()) {
    const record = asRecord(selector);
    const field = nonEmptyString(record?.field);
    const op = nonEmptyString(record?.op);
    const selectorValue = nonEmptyString(record?.value);
    if (!field || !["eq", "ne"].includes(op ?? "") || !selectorValue) {
      throw new Error(`selector_filters[${index}] must contain non-empty field, value, and op ('eq' or 'ne').`);
    }
    if (field.startsWith("attributes.")) {
      const key = field.slice("attributes.".length);
      if (!ATTRIBUTE_KEY.test(key)) {
        throw new Error(`selector_filters[${index}].field has an unsupported attribute key.`);
      }
    } else if (!TRACE_SELECTOR_FIELDS.has(field)) {
      throw new Error(
        `selector_filters[${index}].field must be one of ${[...TRACE_SELECTOR_FIELDS].join(", ")} or attributes.<key>.`,
      );
    }
    if (UNSAFE_SELECTOR_VALUE.test(selectorValue) || [...selectorValue].some(char => /\p{Cc}/u.test(char))) {
      throw new Error(`selector_filters[${index}].value cannot contain quotes, backslashes, or control characters.`);
    }
  }
}

function effectiveMetricConfig(metric: JsonRecord, entry: JsonRecord): JsonRecord {
  return {
    ...(asRecord(metric.config) ?? {}),
    ...(asRecord(entry.config) ?? {}),
  };
}

function selectJudge(metricSet: JsonRecord, metricConfig: JsonRecord): JsonRecord | undefined {
  const inlineJudge = asRecord(metricConfig.llm_config);
  const inlineConnectorRef = nonEmptyString(metricConfig.llm_connector_ref);
  if (inlineJudge || inlineConnectorRef) {
    return {
      ...inlineJudge,
      connector_ref: inlineJudge?.connector_ref ?? inlineConnectorRef,
      model: inlineJudge?.model ?? metricConfig.model,
    };
  }
  const setJudge = asRecord(metricSet.judge_llm_config);
  const setConnectorRef = nonEmptyString(metricSet.judge_llm_connector_ref);
  if (setJudge || setConnectorRef) {
    return {
      ...setJudge,
      connector_ref: setJudge?.connector_ref ?? setConnectorRef,
      model: setJudge?.model ?? metricConfig.model,
    };
  }
  return undefined;
}

function hasSecretReference(value: unknown): boolean {
  if (nonEmptyString(value)) return true;
  const record = asRecord(value);
  return Boolean(record && (
    nonEmptyString(record.identifier)
    || nonEmptyString(record.secretRef)
    || nonEmptyString(record.value)
  ));
}

function hasConnectorApiKeyReference(connector: JsonRecord): boolean {
  const spec = asRecord(connector.spec);
  if (!spec) return false;
  if (["apiKeyRef", "secretKeyRef", "apiKey"].some(key => hasSecretReference(spec[key]))) return true;
  const authentication = asRecord(spec.authentication);
  const authSpec = asRecord(authentication?.spec);
  return Boolean(authSpec && ["tokenRef", "apiKeyRef", "secretKeyRef"].some(key => hasSecretReference(authSpec[key])));
}

async function validateDirectJudge(
  ctx: PreflightContext,
  input: JsonRecord,
  metricName: string,
  metricSet: JsonRecord,
  metricConfig: JsonRecord,
): Promise<void> {
  if (metricConfig.embedding_connector_ref !== undefined || metricConfig.embedding_api_key !== undefined) {
    throw new Error(
      `Metric ${metricName} uses an embedding connector or key, which the scheduled active-config snapshot does not resolve.`,
    );
  }
  const judge = selectJudge(metricSet, metricConfig);
  if (!judge) {
    throw new Error(
      `LLM metric ${metricName} has no direct judge_llm_config. ` +
      "Set it on the metric entry or metric set as { connector_ref, model? }.",
    );
  }
  if (["api_key", "apiKey", "secret", "token"].some(key => key in judge)) {
    throw new Error(`LLM metric ${metricName} must reference a Harness connector; raw judge credentials are not accepted.`);
  }
  const connectorRef = nonEmptyString(judge.connector_ref);
  if (!connectorRef) throw new Error(`LLM metric ${metricName} requires judge_llm_config.connector_ref.`);
  const connector = await getConnector(ctx, connectorRef);
  const connectorType = nonEmptyString(connector.type);
  if (!connectorType || !DIRECT_LLM_CONNECTOR_TYPES.has(connectorType)) {
    throw new Error(
      `LLM metric ${metricName} uses ${connectorRef}, which is not a supported direct AI connector. ` +
      "Use OpenAI, Anthropic, AzureOpenAI, or GoogleAI.",
    );
  }
  if (connector.harnessManaged === true) {
    throw new Error(
      `LLM metric ${metricName} uses Harness-managed connector ${connectorRef}, which the scheduled scorer does not resolve.`,
    );
  }
  if (!hasConnectorApiKeyReference(connector)) {
    throw new Error(
      `LLM metric ${metricName} uses ${connectorRef}, which has no supported API-key secret reference. ` +
      "Configure apiKeyRef, secretKeyRef, apiKey, or authentication.spec.tokenRef on the direct connector.",
    );
  }
  if (!nonEmptyString(judge.model) && !nonEmptyString(asRecord(connector.spec)?.model)) {
    throw new Error(
      `LLM metric ${metricName} requires a non-empty model on judge_llm_config or connector spec.model.`,
    );
  }
}

async function validateMetricSet(ctx: PreflightContext, input: JsonRecord, metricSetId: string): Promise<void> {
  const metricSet = await getAiEvalsResource(
    ctx,
    input,
    `${base(input, { HARNESS_ORG: ctx.registry.orgId, HARNESS_PROJECT: ctx.registry.projectId })}/metric-sets/${metricSetId}`,
    `metric_set_id=${metricSetId}`,
  );
  const entries = asArray(metricSet.entries).flatMap(entry => {
    const record = asRecord(entry);
    return record ? [record] : [];
  });
  if (entries.length === 0) throw new Error(`metric_set_id=${metricSetId} has no entries.`);

  for (const entry of entries) {
    const metricId = requireUuid(entry.metric_id, "metric_set entry.metric_id");
    const metric = await getAiEvalsResource(
      ctx,
      input,
      `${base(input, { HARNESS_ORG: ctx.registry.orgId, HARNESS_PROJECT: ctx.registry.projectId })}/metrics/${metricId}`,
      `metric_id=${metricId}`,
    );
    const type = nonEmptyString(metric.type);
    const metricName = nonEmptyString(metric.name) ?? metricId;
    const config = effectiveMetricConfig(metric, entry);
    const kind = nonEmptyString(metric.kind) ?? nonEmptyString(config.kind);
    if (!type || UNSUPPORTED_METRIC_TYPES.has(type)) {
      throw new Error(
        `Metric ${metricName} has type ${type ?? "unknown"}, which cannot be positively validated for observability evaluation.`,
      );
    }
    if (kind === "spec_grounding") {
      throw new Error(`Metric ${metricName} is spec_grounding, but the scheduled scorer does not consume spec bindings.`);
    }
    if (kind && EMBEDDING_DEPENDENT_KINDS.has(kind)) {
      throw new Error(`Metric ${metricName} requires embeddings, which the scheduled active-config snapshot does not resolve.`);
    }
    if (type === "llm" || type === "ai_judge") {
      await validateDirectJudge(ctx, input, metricName, metricSet, config);
      if ((!kind || kind === "geval") && !nonEmptyString(config.criteria) && !nonEmptyString(config.rubric)) {
        throw new Error(`LLM metric ${metricName} requires config.criteria or config.rubric for scheduled scoring.`);
      }
      continue;
    }
    if (type !== "heuristic") {
      throw new Error(
        `Metric ${metricName} has type ${type}, which the scheduled scorer does not have a validated configuration path for.`,
      );
    }
  }
}

async function validateOnlineConfigWrite(ctx: PreflightContext, isUpdate: boolean): Promise<void> {
  const input = ctx.input;
  const body = requireBody(input, isUpdate ? "Observability evaluation rule update" : "Observability evaluation rule create");
  if (isUpdate && body.enabled === false && Object.keys(body).every(key => key === "enabled")) {
    requireUuid(input.config_id, "config_id");
    return;
  }
  const configId = isUpdate ? requireUuid(input.config_id, "config_id") : undefined;
  const existing = isUpdate
    ? await getAiEvalsResource(
      ctx,
      input,
      `${base(input, { HARNESS_ORG: ctx.registry.orgId, HARNESS_PROJECT: ctx.registry.projectId })}/online-eval-configs/${configId}`,
      `config_id=${configId}`,
    )
    : undefined;
  const effective = { ...existing, ...body };

  if (body.name !== undefined && !nonEmptyString(body.name)) throw new Error("name must be a non-empty string.");
  if (effective.scope !== "trace") {
    throw new Error(
      "Observability evaluation currently supports scope='trace' only. The scoring job emits trace-scoped score rows.",
    );
  }
  const sampling = effective.sampling_percentage ?? 100;
  if (typeof sampling !== "number" || !Number.isFinite(sampling) || sampling <= 0 || sampling > 100) {
    throw new Error("sampling_percentage must be a finite percentage in (0, 100]; 0 is rejected by the scheduled scorer.");
  }
  validateSelectors(effective.selector_filters ?? []);
  if (effective.spec_bindings !== undefined && asArray(effective.spec_bindings).length > 0) {
    throw new Error("spec_bindings are not supported by the scheduled scorer.");
  }

  const targetId = effective.target_id;
  if (targetId !== undefined && targetId !== null) {
    const id = requireUuid(targetId, "target_id");
    await getAiEvalsResource(
      ctx,
      input,
      `${base(input, { HARNESS_ORG: ctx.registry.orgId, HARNESS_PROJECT: ctx.registry.projectId })}/targets/${id}`,
      `target_id=${id}`,
    );
  }
  const metricSetId = requireUuid(effective.metric_set_id, "metric_set_id");
  await validateMetricSet(ctx, input, metricSetId);
}

const createOnlineEvalConfigSchema: BodySchema = {
  description:
    "Create a scheduled production-trace evaluation. The MCP validates the selected metric set and direct judge connectors before saving; scope must be trace and sampling must be greater than 0.",
  fields: [
    { name: "name", type: "string", required: true, description: "Unique configuration name in this project" },
    { name: "scope", type: "string", required: true, description: "Must be 'trace'; span scope is not supported by the scheduled scorer" },
    { name: "metric_set_id", type: "string", required: true, description: "Existing MetricSet UUID; every member must be compatible with scheduled scoring" },
    { name: "target_id", type: "string", required: false, description: "Optional associated target UUID; metadata only, does not provide scorer credentials" },
    { name: "selector_filters", type: "array", required: false, description: "AND predicates: { field, op: 'eq'|'ne', value }; field is an allowed trace column or attributes.<key>", itemType: "object" },
    { name: "sampling_percentage", type: "number", required: false, description: "Percentage of matching traces to score, greater than 0 and at most 100 (default 100)" },
    { name: "enabled", type: "boolean", required: false, description: "Whether the scheduled scorer may consume this config (default true)" },
  ],
};

const updateOnlineEvalConfigSchema: BodySchema = {
  description:
    "Patch an observability evaluation rule. name, enabled, and target_id are header edits; changing scope, metric_set_id, selector_filters, or sampling_percentage creates a new immutable config version. Set enabled=false to disable.",
  fields: [
    { name: "name", type: "string", required: false, description: "New name" },
    { name: "enabled", type: "boolean", required: false, description: "Set false to disable; set true only after strict runtime validation" },
    { name: "target_id", type: "string", required: false, description: "Associated target UUID; null clears the association" },
    { name: "scope", type: "string", required: false, description: "Must be 'trace'; material edit that creates a config version" },
    { name: "metric_set_id", type: "string", required: false, description: "Existing compatible MetricSet UUID; material edit that creates a config version" },
    { name: "selector_filters", type: "array", required: false, description: "Replacement AND predicates; material edit that creates a config version", itemType: "object" },
    { name: "sampling_percentage", type: "number", required: false, description: "Replacement percentage in (0, 100]; material edit that creates a config version" },
  ],
};

export const observabilityEvaluationsToolset: ToolsetDefinition = {
  name: "observability-evaluations",
  displayName: "Observability Evaluations",
  description: "Rules that apply evaluation metrics to sampled production telemetry.",
  optIn: true,
  resources: [
    {
      resourceType: "observability_evaluation_rule",
      displayName: "Observability Evaluation Rule",
      description:
        "Persistent rule for evaluating sampled production telemetry. Material edits create immutable versions; disabling stops future scoring without deleting prior scores.",
      toolset: "observability-evaluations",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["config_id"],
      diagnosticHint:
        "Use an existing MetricSet UUID. The configuration is consumed by a scheduled Spark scorer, not the ad-hoc trace evaluator. " +
        "Only trace scope, sampling_percentage in (0,100], non-code/non-embedding metrics, and direct LLM judge connectors are accepted.",
      relatedResources: [
        { resourceType: "eval_metric_set", relationship: "uses", description: "Selected metric set, validated before every configuration write" },
        { resourceType: "eval_target", relationship: "references", description: "Optional target association" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/online-eval-configs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { page: "page", size: "limit" },
          responseExtractor: aiEvalsListExtract,
          description: "List observability evaluation rules",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: configPath,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get an observability evaluation rule",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/online-eval-configs`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async ctx => validateOnlineConfigWrite(ctx, false),
          bodyBuilder: input => input.body ?? {},
          bodySchema: createOnlineEvalConfigSchema,
          responseExtractor: passthrough,
          description: "Create a validated observability evaluation rule",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: configPath,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async ctx => validateOnlineConfigWrite(ctx, true),
          bodyBuilder: input => input.body ?? {},
          bodySchema: updateOnlineEvalConfigSchema,
          responseExtractor: passthrough,
          description: "Update a rule; use enabled=false to disable",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: configPath,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Permanently delete an observability evaluation rule",
        },
      },
    },
  ],
};
