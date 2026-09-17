/**
 * AI Evals control plane — datasets, evals, runs, metrics, suites, targets, git registration, online eval.
 * Base path: /ai-evals/api/v1/orgs/{org}/projects/{project}/...
 * Uses Harness-Account header; no accountIdentifier query param (headerBasedScoping).
 */
import type { BodySchema, PathBuilderConfig, PreflightContext, ToolsetDefinition } from "../types.js";
import { aiEvalsArrayExtract, aiEvalsListExtract, passthrough } from "../extractors.js";

const AI = "/gateway/ai-evals/api/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LLM_CONNECTOR_TYPES = new Set(["OpenAi", "OpenAI", "Anthropic", "AzureOpenAI", "AzureOpenAi", "GoogleAI", "GoogleAi"]);
const JUDGE_BACKED_METRIC_TYPES = new Set(["llm", "ai_judge"]);
const TARGET_TYPES = new Set(["prompt", "agent", "precomputed"]);
const AGENT_METHODS = new Set(["GET", "POST", "PUT"]);

function scopeOrThrow(input: Record<string, unknown>, config: PathBuilderConfig): { org: string; project: string } {
  const org = (input.org_id as string) ?? config.HARNESS_ORG ?? "";
  const project = (input.project_id as string) ?? config.HARNESS_PROJECT ?? "";
  if (!org || !project) {
    throw new Error(
      "AI Evals requires org and project. Set HARNESS_ORG and HARNESS_PROJECT, or pass org_id and project_id on the tool call.",
    );
  }
  return { org, project };
}

function base(input: Record<string, unknown>, config: PathBuilderConfig): string {
  const { org, project } = scopeOrThrow(input, config);
  return `${AI}/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}`;
}

const listQ = { page: "page", size: "limit" };

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
    throw new Error(
      `${field} must be a UUID returned by the matching AI Evals list/create call; do not invent an identifier.`,
    );
  }
  return id;
}

function preflightScope({ input, registry }: PreflightContext): { org_id: string; project_id: string } {
  const org_id = nonEmptyString(input.org_id) ?? registry.orgId;
  const project_id = nonEmptyString(input.project_id) ?? registry.projectId;
  if (!org_id || !project_id) {
    throw new Error(
      "AI Evals requires org_id and project_id. Set HARNESS_ORG/HARNESS_PROJECT, or pass both values on the tool call.",
    );
  }
  return { org_id, project_id };
}

function unwrapRecord(value: unknown): JsonRecord {
  const record = asRecord(value);
  if (!record) throw new Error("The referenced AI Evals resource returned an invalid response.");
  return asRecord(record.data) ?? asRecord(record.content) ?? record;
}

function listItems(value: unknown): { items: JsonRecord[]; total: number } {
  const record = asRecord(value);
  const rawItems = asArray(record?.items ?? record?.data ?? asRecord(record?.data)?.content);
  const totalValue = record?.total ?? record?.total_elements ?? asRecord(record?.data)?.totalElements;
  return {
    items: rawItems.flatMap(item => {
      const recordItem = asRecord(item);
      return recordItem ? [recordItem] : [];
    }),
    total: typeof totalValue === "number" ? totalValue : rawItems.length,
  };
}

async function getScopedResource(
  ctx: PreflightContext,
  resourceType: string,
  idField: string,
  rawId: unknown,
): Promise<JsonRecord> {
  const id = requireUuid(rawId, idField);
  try {
    const result = await ctx.registry.dispatch(
      ctx.client,
      resourceType,
      "get",
      { ...preflightScope(ctx), [idField]: id },
      ctx.signal,
    );
    return unwrapRecord(result);
  } catch (error) {
    throw new Error(
      `${idField}=${id} is not a readable ${resourceType} in this org/project. ` +
      `List valid choices with harness_list(resource_type="${resourceType}"). ` +
      `Details: ${(error as Error).message}`,
    );
  }
}

export async function getConnector(ctx: PreflightContext, connectorRef: string): Promise<JsonRecord> {
  const scopePrefix = connectorRef.split(".", 1)[0];
  const scope = scopePrefix === "account" ? "account" : scopePrefix === "org" ? "org" : "project";
  const { org_id, project_id } = scope === "account" ? {} : preflightScope(ctx);
  const params = scope === "account"
    ? {}
    : scope === "org"
      ? { orgIdentifier: org_id }
      : { orgIdentifier: org_id, projectIdentifier: project_id };
  try {
    const result = await ctx.client.request<unknown>({
      method: "GET",
      path: `/ng/api/connectors/${encodeURIComponent(connectorRef)}`,
      params,
      retryPolicy: "safe",
      signal: ctx.signal,
    });
    const record = unwrapRecord(result);
    return asRecord(record.connector) ?? record;
  } catch (error) {
    throw new Error(
      `connector_ref=${connectorRef} is not a readable Harness connector in this eval scope. ` +
      "Ask the user to select an existing connector and provide its scoped identifier (for example, account.my-connector). " +
      `Details: ${(error as Error).message}`,
    );
  }
}

async function validateLlmConfig(ctx: PreflightContext, field: string, value: unknown): Promise<void> {
  const config = asRecord(value);
  if (!config) {
    throw new Error(`${field} must be { connector_ref: string, model?: string }; raw API keys are not accepted.`);
  }
  if (["api_key", "apiKey", "secret", "token"].some(key => key in config)) {
    throw new Error(`${field} must reference a Harness connector; do not provide raw credentials.`);
  }
  const connectorRef = nonEmptyString(config.connector_ref);
  if (!connectorRef) {
    throw new Error(`${field}.connector_ref is required. Ask the user for an existing Harness LLM connector identifier.`);
  }
  if (config.model !== undefined && !nonEmptyString(config.model)) {
    throw new Error(`${field}.model must be a non-empty provider model string when supplied.`);
  }
  const connector = await getConnector(ctx, connectorRef);
  const type = nonEmptyString(connector.type);
  if (!type || !LLM_CONNECTOR_TYPES.has(type)) {
    throw new Error(
      `${field}.connector_ref=${connectorRef} is type ${type ?? "unknown"}, not a supported AI Evals LLM connector. ` +
      "Select an OpenAI, Anthropic, AzureOpenAI, or GoogleAI connector.",
    );
  }
  if (connector.harnessManaged === true && !nonEmptyString(config.model)) {
    throw new Error(
      `${field}.model is required because ${connectorRef} is Harness-managed. Ask the user for a provider model name.`,
    );
  }
}

type MetricSetJudge =
  | { field: "judge_llm_config"; value: unknown }
  | { field: "judge_llm_connector_ref"; value: unknown }
  | { field: "judge_model_id"; value: unknown };

function selectMetricSetJudge(metricSet: JsonRecord): MetricSetJudge | undefined {
  if (metricSet.judge_llm_config !== undefined && metricSet.judge_llm_config !== null) {
    return { field: "judge_llm_config", value: metricSet.judge_llm_config };
  }
  if (metricSet.judge_llm_connector_ref !== undefined && metricSet.judge_llm_connector_ref !== null) {
    return { field: "judge_llm_connector_ref", value: metricSet.judge_llm_connector_ref };
  }
  if (metricSet.judge_model_id !== undefined && metricSet.judge_model_id !== null) {
    return { field: "judge_model_id", value: metricSet.judge_model_id };
  }
  return undefined;
}

async function validateMetricSetJudge(ctx: PreflightContext, judge: MetricSetJudge): Promise<void> {
  if (judge.field === "judge_model_id") {
    requireUuid(judge.value, judge.field);
    return;
  }
  if (judge.field === "judge_llm_connector_ref") {
    await validateLlmConfig(ctx, judge.field, { connector_ref: judge.value });
    return;
  }
  await validateLlmConfig(ctx, judge.field, judge.value);
}

async function validateHttpConnector(ctx: PreflightContext, connectorRef: string): Promise<void> {
  const connector = await getConnector(ctx, connectorRef);
  const spec = asRecord(connector.spec);
  const url = nonEmptyString(spec?.url);
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(
      `connector_ref=${connectorRef} is not HTTP-capable (its connector spec has no HTTP(S) url). ` +
      "Ask the user to select a connector that supplies the agent endpoint URL.",
    );
  }
}

function validateAgentConfig(config: JsonRecord): void {
  const endpoint = nonEmptyString(config.endpoint_url);
  if (!endpoint || !/^https?:\/\//i.test(endpoint)) {
    throw new Error("target.config.endpoint_url is required and must be an HTTP(S) URL.");
  }
  const method = nonEmptyString(config.method) ?? "POST";
  if (!AGENT_METHODS.has(method)) {
    throw new Error(`target.config.method must be one of ${[...AGENT_METHODS].join(", ")}.`);
  }
  if (!nonEmptyString(config.response_path)) {
    throw new Error("target.config.response_path is required (for example, choices.0.message.content).");
  }
  if (config.request_template !== undefined) {
    const requestTemplate = asRecord(config.request_template);
    if (!requestTemplate) {
      throw new Error("target.config.request_template must be a JSON object, such as { input: '{{input}}' }.");
    }
  }
}

async function validateTarget(ctx: PreflightContext, target: JsonRecord): Promise<void> {
  const type = nonEmptyString(target.type);
  const config = asRecord(target.config);
  if (!type || !TARGET_TYPES.has(type) || !config) {
    throw new Error("A managed target requires type ('prompt', 'agent', or 'precomputed') and a JSON config object.");
  }
  if (type === "prompt") {
    await validateLlmConfig(ctx, "target.config.llm_config", {
      connector_ref: config.llm_connector_ref,
      model: config.model,
    });
    if (config.prompt_source === "registry") {
      if (!nonEmptyString(config.prompt_id) || !nonEmptyString(config.prompt_version)) {
        throw new Error(
          "Registry prompt targets require target.config.prompt_id and target.config.prompt_version from the Prompt Registry.",
        );
      }
    } else if (!nonEmptyString(config.system_message) || !nonEmptyString(config.user_message_template)) {
      throw new Error("Inline prompt targets require non-empty system_message and user_message_template.");
    } else if (!String(config.user_message_template).includes("{{input}}")) {
      throw new Error("target.config.user_message_template must include the {{input}} placeholder.");
    }
    return;
  }
  if (type === "agent") {
    validateAgentConfig(config);
    const connectorRef = nonEmptyString(target.connector_ref);
    if (connectorRef) await validateHttpConnector(ctx, connectorRef);
    return;
  }
  const datasetId = config.dataset_id;
  if (datasetId !== undefined) await getScopedResource(ctx, "eval_dataset", "dataset_id", datasetId);
}

async function validateTargetWrite(ctx: PreflightContext, isUpdate: boolean): Promise<void> {
  const body = requireBody(ctx.input, "Target write");
  if (body.storage_type === "git") return;
  const existing = isUpdate
    ? await getScopedResource(ctx, "eval_target", "target_id", ctx.input.target_id)
    : undefined;
  await validateTarget(ctx, {
    ...existing,
    ...body,
    type: existing?.type ?? body.type,
    config: body.config ?? existing?.config,
    connector_ref: body.connector_ref ?? existing?.connector_ref,
  });
}

async function validateOutputUpload(ctx: PreflightContext): Promise<void> {
  const target = await getScopedResource(ctx, "eval_target", "target_id", ctx.input.target_id);
  if (target.type !== "precomputed") {
    throw new Error("Static outputs can only be uploaded to a precomputed target.");
  }
  const body = requireBody(ctx.input, "Output upload");
  const outputs = asArray(body.items).flatMap(item => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
  if (outputs.length === 0) throw new Error("Output upload requires a non-empty items array.");
  const datasetId = requireUuid(asRecord(target.config)?.dataset_id, "target.config.dataset_id");
  await getScopedResource(ctx, "eval_dataset", "dataset_id", datasetId);
  const datasetItems = await listDatasetItems(ctx, datasetId);
  const datasetItemIds = new Set(datasetItems.items.map(item => nonEmptyString(item.item_identifier)).filter(Boolean));
  const seen = new Set<string>();
  for (const output of outputs) {
    const itemIdentifier = nonEmptyString(output.item_identifier);
    if (!itemIdentifier || !asRecord(output.output)) {
      throw new Error("Each output must be { item_identifier: '<dataset item id>', output: { ... } }.");
    }
    if (seen.has(itemIdentifier)) throw new Error(`Output upload contains duplicate item_identifier=${itemIdentifier}.`);
    seen.add(itemIdentifier);
    if (!datasetItemIds.has(itemIdentifier)) {
      throw new Error(
        `item_identifier=${itemIdentifier} is not in the target's configured dataset. ` +
        "Use a dataset item business ID returned by harness_list(resource_type='eval_dataset_item').",
      );
    }
  }
}

async function listDatasetItems(ctx: PreflightContext, datasetId: string): Promise<{ items: JsonRecord[]; total: number }> {
  const result = await ctx.registry.dispatch(
    ctx.client,
    "eval_dataset_item",
    "list",
    { ...preflightScope(ctx), dataset_id: datasetId, size: 1000 },
    ctx.signal,
  );
  const list = listItems(result);
  if (list.total > list.items.length) {
    throw new Error(
      `Dataset ${datasetId} has ${list.total} items, more than the MCP safety-check limit of ${list.items.length}. ` +
      "Split the dataset or use the UI/API after reviewing its precomputed-output coverage.",
    );
  }
  return list;
}

async function validatePrecomputedData(
  ctx: PreflightContext,
  datasetId: string,
  target: JsonRecord | undefined,
): Promise<void> {
  const datasetItems = await listDatasetItems(ctx, datasetId);
  if (datasetItems.total === 0) {
    throw new Error(`Dataset ${datasetId} has no items. Add items with stable business id and input before running a precomputed eval.`);
  }

  const targetConfig = asRecord(target?.config);
  const configuredDatasetId = targetConfig?.dataset_id;
  if (configuredDatasetId !== undefined && configuredDatasetId !== datasetId) {
    throw new Error(
      `Precomputed target is configured for dataset_id=${String(configuredDatasetId)}, not eval dataset_id=${datasetId}. ` +
      "Use outputs for the same dataset or update the target deliberately.",
    );
  }

  const outputIds = new Set<string>();
  for (const item of datasetItems.items) {
    if (asRecord(item.precomputed_output)) {
      const id = nonEmptyString(item.item_identifier);
      if (id) outputIds.add(id);
    }
  }

  if (target) {
    const targetId = requireUuid(target.uuid ?? target.id, "target_id");
    const { org_id, project_id } = preflightScope(ctx);
    const outputResponse = await ctx.client.request<unknown>({
      method: "GET",
      path: `${AI}/orgs/${encodeURIComponent(org_id)}/projects/${encodeURIComponent(project_id)}/targets/${targetId}/outputs`,
      params: { page: 0, limit: 1000 },
      headerBasedScoping: true,
      signal: ctx.signal,
    });
    const targetOutputs = listItems(outputResponse);
    if (targetOutputs.total > targetOutputs.items.length) {
      throw new Error(
        `Precomputed target ${targetId} has ${targetOutputs.total} outputs, more than the MCP safety-check limit of ${targetOutputs.items.length}. ` +
        "Use a smaller dataset or review the mapping in the UI before running.",
      );
    }
    for (const output of targetOutputs.items) {
      const id = nonEmptyString(output.item_identifier);
      if (id && asRecord(output.output)) outputIds.add(id);
    }
  }

  const missing = datasetItems.items
    .map(item => nonEmptyString(item.item_identifier))
    .filter((id): id is string => id !== undefined && !outputIds.has(id));
  if (missing.length) {
    throw new Error(
      `Precomputed evaluation is missing outputs for dataset item IDs: ${missing.join(", ")}. ` +
      "Provide outputs as { items: [{ item_identifier: '<dataset item id>', output: { ... } }] } before attaching or running.",
    );
  }
}

async function validateMetricSet(ctx: PreflightContext, metricSet: JsonRecord, requireEntries: boolean): Promise<void> {
  const entries = asArray(metricSet.entries).flatMap(entry => {
    const record = asRecord(entry);
    return record ? [record] : [];
  });
  if (requireEntries && entries.length === 0) {
    throw new Error("Metric set has no entries. Add at least one metric before attaching it to an evaluation.");
  }

  const metricSetJudge = selectMetricSetJudge(metricSet);
  if (metricSetJudge) {
    await validateMetricSetJudge(ctx, metricSetJudge);
  }

  for (const entry of entries) {
    const metric = await getScopedResource(ctx, "eval_metric", "metric_id", entry.metric_id);
    if (!JUDGE_BACKED_METRIC_TYPES.has(metric.type as string)) continue;
    const entryConfig = asRecord(entry.config);
    const metricConfig = asRecord(metric.config);
    const judge = entryConfig?.llm_config ?? metricConfig?.llm_config;
    if (judge !== undefined && judge !== null) {
      await validateLlmConfig(ctx, `metric entry ${String(entry.metric_id)} judge config`, judge);
    } else if (metricSetJudge) {
      await validateMetricSetJudge(ctx, metricSetJudge);
    } else {
      throw new Error(
        `LLM metric ${String(metric.name ?? entry.metric_id)} has no judge configuration. ` +
        "Provide metric-set judge_llm_config as { connector_ref, model? }, or an entry config.llm_config.",
      );
    }
  }
}

async function validateMetricSetWrite(ctx: PreflightContext, input: JsonRecord, requireExistingEntries: boolean): Promise<void> {
  const body = requireBody(input, "Metric set write");
  const metricSetJudge = selectMetricSetJudge(body);
  if (metricSetJudge) {
    await validateMetricSetJudge(ctx, metricSetJudge);
  }
  if (body.entries !== undefined) {
    await validateMetricSet(ctx, body, false);
  }
  if (requireExistingEntries) {
    const set = await getScopedResource(ctx, "eval_metric_set", "set_id", input.set_id);
    await validateMetricSet(ctx, { ...set, ...body, entries: set.entries }, false);
  }
}

async function validateMetricSetEntryWrite(ctx: PreflightContext, isUpdate: boolean): Promise<void> {
  const body = requireBody(ctx.input, "Metric set entry write");
  const set = await getScopedResource(ctx, "eval_metric_set", "set_id", ctx.input.set_id);
  const metricId = body.metric_id ?? (isUpdate ? ctx.input.metric_id : undefined);
  const metric = await getScopedResource(ctx, "eval_metric", "metric_id", metricId);
  if (!JUDGE_BACKED_METRIC_TYPES.has(metric.type as string)) return;
  const judge = asRecord(body.config)?.llm_config;
  const metricSetJudge = selectMetricSetJudge(set);
  if (judge !== undefined && judge !== null) {
    await validateLlmConfig(ctx, "metric entry judge config", judge);
  } else if (metricSetJudge) {
    await validateMetricSetJudge(ctx, metricSetJudge);
  } else {
    throw new Error(
      "Adding an LLM metric requires a metric-set judge_llm_config or entry config.llm_config with { connector_ref, model? }.",
    );
  }
}

async function validateMetricSetReplacement(ctx: PreflightContext): Promise<void> {
  if (!Array.isArray(ctx.input.body)) {
    throw new Error("replace_metrics requires body to be a JSON array of { metric_id, threshold, weight?, position? }.");
  }
  const set = await getScopedResource(ctx, "eval_metric_set", "set_id", ctx.input.set_id);
  await validateMetricSet(ctx, { ...set, entries: ctx.input.body }, false);
}

async function validateManagedEvalComposition(ctx: PreflightContext, input: JsonRecord, requireAll: boolean): Promise<void> {
  const body = requireBody(input, "Evaluation write");
  const fields = ["dataset_id", "target_id", "metric_set_id"] as const;
  const changesComposition = fields.some(field => field in body);
  const existing = !requireAll && changesComposition
    ? await getScopedResource(ctx, "evaluation", "eval_id", input.eval_id)
    : undefined;
  const composition = { ...existing, ...body };
  if (composition.storage_type === "git") return;
  if (requireAll) {
    const missing = fields.filter(field => !nonEmptyString(composition[field]));
    if (missing.length) {
      throw new Error(
        `Managed evaluation requires ${missing.join(", ")}. Ask the user to choose existing resources; do not create a partial evaluation.`,
      );
    }
  }

  const datasetId = nonEmptyString(composition.dataset_id);
  const targetId = nonEmptyString(composition.target_id);
  const metricSetId = nonEmptyString(composition.metric_set_id);
  const dataset = datasetId ? await getScopedResource(ctx, "eval_dataset", "dataset_id", datasetId) : undefined;
  const target = targetId ? await getScopedResource(ctx, "eval_target", "target_id", targetId) : undefined;
  const metricSet = metricSetId ? await getScopedResource(ctx, "eval_metric_set", "set_id", metricSetId) : undefined;

  if (target) await validateTarget(ctx, target);
  if (metricSet) await validateMetricSet(ctx, metricSet, requireAll);
  if (dataset && target?.type === "precomputed") await validatePrecomputedData(ctx, datasetId!, target);
}

async function validateEvalRun(ctx: PreflightContext): Promise<void> {
  const evalId = requireUuid(ctx.input.eval_id, "eval_id");
  const evalRecord = await getScopedResource(ctx, "evaluation", "eval_id", evalId);
  if (evalRecord.storage_type === "git") return;
  const body = asRecord(ctx.input.body) ?? {};
  const runInputs = asRecord(body.run_inputs) ?? {};
  const datasetId = runInputs.dataset_id === null ? undefined : nonEmptyString(runInputs.dataset_id) ?? nonEmptyString(evalRecord.dataset_id);
  const targetId = runInputs.target_id === null ? undefined : nonEmptyString(runInputs.target_id) ?? nonEmptyString(evalRecord.target_id);
  const metricSetId = runInputs.metric_set_id === null ? undefined : nonEmptyString(runInputs.metric_set_id) ?? nonEmptyString(evalRecord.metric_set_id);

  if (!datasetId || !metricSetId) {
    throw new Error("A managed evaluation run requires dataset_id and metric_set_id, configured on the evaluation or supplied in run_inputs.");
  }
  const dataset = await getScopedResource(ctx, "eval_dataset", "dataset_id", datasetId);
  const metricSet = await getScopedResource(ctx, "eval_metric_set", "set_id", metricSetId);
  const target = targetId ? await getScopedResource(ctx, "eval_target", "target_id", targetId) : undefined;
  if (target) await validateTarget(ctx, target);
  await validateMetricSet(ctx, metricSet, true);
  if (target?.type === "precomputed" || !target) await validatePrecomputedData(ctx, datasetId, target);
  if (runInputs.llm_config !== undefined) await validateLlmConfig(ctx, "run_inputs.llm_config", runInputs.llm_config);
}

async function validateTargetTest(ctx: PreflightContext): Promise<void> {
  const target = await getScopedResource(ctx, "eval_target", "target_id", ctx.input.target_id);
  await validateTarget(ctx, target);
}

async function validateRunReference(ctx: PreflightContext): Promise<void> {
  await getScopedResource(ctx, "eval_run", "run_id", ctx.input.run_id);
}

async function validateSuiteReference(ctx: PreflightContext): Promise<void> {
  await getScopedResource(ctx, "eval_suite", "suite_id", ctx.input.suite_id);
}

async function validateDatasetGeneration(ctx: PreflightContext): Promise<void> {
  const body = requireBody(ctx.input, "Dataset generation");
  const strategy = nonEmptyString(body.strategy);
  if (!strategy || !["use_case", "rephrase", "adversarial", "complexity_ladder"].includes(strategy)) {
    throw new Error("strategy must be one of use_case, rephrase, adversarial, complexity_ladder.");
  }
  if (!Number.isInteger(body.count) || (body.count as number) < 1 || (body.count as number) > 200) {
    throw new Error("count must be an integer from 1 to 200.");
  }
  if (strategy === "rephrase") {
    if (!Array.isArray(body.seed_inputs) || body.seed_inputs.length === 0 || body.seed_inputs.some(value => !nonEmptyString(value))) {
      throw new Error("rephrase generation requires seed_inputs as a non-empty array of non-empty input strings.");
    }
  } else if (!nonEmptyString(body.description)) {
    throw new Error(`${strategy} generation requires a non-empty description explaining the use case and desired test data.`);
  }
  await validateLlmConfig(ctx, "llm_config", body.llm_config);
}

// --- Body schemas (concise; full shapes in OpenAPI / harness_describe) ---

const createDatasetSchema: BodySchema = {
  description: "Create dataset",
  fields: [
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "identifier", type: "string", required: true, description: "Unique slug per scope" },
    { name: "description", type: "string", required: false, description: "Description" },
    {
      name: "items",
      type: "array",
      required: false,
      description: "Inline dataset items (CreateDatasetItemRequest[]); must be empty when storage_type='git'",
      itemType: "object",
    },
    { name: "metadata", type: "object", required: false, description: "Arbitrary metadata" },
    { name: "storage_type", type: "string", required: false, description: "managed (default) | git" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const updateDatasetSchema: BodySchema = {
  description: "Update dataset",
  fields: [
    { name: "name", type: "string", required: false, description: "Display name" },
    { name: "identifier", type: "string", required: false, description: "Update identifier slug" },
    { name: "description", type: "string", required: false, description: "Description" },
    {
      name: "items",
      type: "array",
      required: false,
      description: "Replace items (CreateDatasetItemRequest[]); must be empty when storage_type='git'",
      itemType: "object",
    },
    { name: "metadata", type: "object", required: false, description: "Metadata" },
    { name: "storage_type", type: "string", required: false, description: "managed | git (switches storage mode)" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when switching to storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const createDatasetItemSchema: BodySchema = {
  description: "Create dataset item",
  fields: [
    { name: "id", type: "string", required: false, description: "Business id for the row (required for CLI/backend run correlation)" },
    { name: "input", type: "object", required: true, description: "Model input (JSON)" },
    { name: "expected_output", type: "object", required: false, description: "Expected output (string, object, or array)" },
    { name: "precomputed_output", type: "object", required: false, description: "Precomputed target output for offline/metrics-only scoring" },
    { name: "context", type: "array", required: false, description: "Retrieved chunks for RAG evaluation", itemType: "string" },
    { name: "expected_tools", type: "array", required: false, description: "Expected tool names for agent evaluation", itemType: "string" },
    { name: "expected_tool_calls", type: "array", required: false, description: "Structured tool call expectations (name + arguments) for ToolArgumentMatchMetric", itemType: "object" },
    { name: "comments", type: "string", required: false, description: "Internal notes, not used in evaluation" },
    { name: "metadata", type: "object", required: false, description: "Extra metadata" },
    { name: "sort_order", type: "number", required: false, description: "Sort position" },
  ],
};

const updateDatasetItemSchema: BodySchema = {
  description: "Update dataset item",
  fields: [
    { name: "input", type: "object", required: false, description: "Input" },
    { name: "expected_output", type: "object", required: false, description: "Expected output (string, object, or array)" },
    { name: "precomputed_output", type: "object", required: false, description: "Precomputed target output for offline/metrics-only scoring" },
    { name: "context", type: "array", required: false, description: "Retrieved chunks for RAG evaluation", itemType: "string" },
    { name: "expected_tools", type: "array", required: false, description: "Expected tool names for agent evaluation", itemType: "string" },
    { name: "expected_tool_calls", type: "array", required: false, description: "Structured tool call expectations (name + arguments) for ToolArgumentMatchMetric", itemType: "object" },
    { name: "comments", type: "string", required: false, description: "Internal notes, not used in evaluation" },
    { name: "metadata", type: "object", required: false, description: "Metadata" },
    { name: "sort_order", type: "number", required: false, description: "Sort position" },
  ],
};

const createEvalSchema: BodySchema = {
  description:
    "Create evaluation. Managed evaluations (the default) require dataset_id, target_id, and metric_set_id; git-backed evaluations require storage_type='git' and git_source instead.",
  fields: [
    { name: "name", type: "string", required: true, description: "Eval name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "dataset_id", type: "string", required: false, description: "Required for managed storage (default): dataset UUID (list with harness_list resource_type=eval_dataset)" },
    { name: "target_id", type: "string", required: false, description: "Required for managed storage (default): target UUID (list with harness_list resource_type=eval_target)" },
    { name: "metric_set_id", type: "string", required: false, description: "Required for managed storage (default): metric set UUID (list with harness_list resource_type=eval_metric_set)" },
    { name: "sampling_strategy", type: "string", required: false, description: "all | random | first_n (default all)" },
    { name: "sample_size", type: "number", required: false, description: "Sample size" },
    { name: "concurrency", type: "number", required: false, description: "Parallelism (default 5, min 1)" },
    { name: "cost_limit_usd", type: "number", required: false, description: "Max cost in USD" },
    { name: "timeout_per_item_ms", type: "number", required: false, description: "Per-item timeout ms (default 30000, min 1000)" },
    { name: "storage_type", type: "string", required: false, description: "managed (default) | git" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const updateEvalSchema: BodySchema = {
  description: "Update evaluation (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "status", type: "string", required: false, description: "active | archived" },
    { name: "dataset_id", type: "string", required: false, description: "Dataset UUID (list with harness_list resource_type=eval_dataset)" },
    { name: "target_id", type: "string", required: false, description: "Target UUID (list with harness_list resource_type=eval_target)" },
    { name: "metric_set_id", type: "string", required: false, description: "Metric set UUID (list with harness_list resource_type=eval_metric_set)" },
    { name: "sampling_strategy", type: "string", required: false, description: "all | random | first_n" },
    { name: "sample_size", type: "number", required: false, description: "Sample size" },
    { name: "concurrency", type: "number", required: false, description: "Parallelism (min 1)" },
    { name: "cost_limit_usd", type: "number", required: false, description: "Max cost in USD" },
    { name: "timeout_per_item_ms", type: "number", required: false, description: "Per-item timeout ms (min 1000)" },
    { name: "storage_type", type: "string", required: false, description: "managed | git (switches storage mode)" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when switching to storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const triggerEvalRunSchema: BodySchema = {
  description: "Trigger eval run (optional overrides)",
  fields: [
    { name: "sampling_strategy", type: "string", required: false, description: "Sampling strategy" },
    { name: "sample_size", type: "number", required: false, description: "Sample size" },
    { name: "triggered_by", type: "string", required: false, description: "Who triggered the run" },
    { name: "trigger_type", type: "string", required: false, description: "manual | scheduled | api | ci (default manual)" },
    {
      name: "run_inputs",
      type: "object",
      required: false,
      description:
        "RunInputs overrides: { llm_config? (preferred structured provider config), target_id?, dataset_id?, metric_set_id?, variables? }. " +
        "llm_connector_ref, model_id, and model remain accepted but are DEPRECATED; use llm_config instead.",
    },
    { name: "input_set_id", type: "string", required: false, description: "Saved input set id" },
    { name: "branch", type: "string", required: false, description: "Override git branch (e.g. run against a PR branch)" },
  ],
};

const cloneEvalSchema: BodySchema = {
  description: "Clone a managed evaluation. The clone shares the source evaluation's dataset, target, and metric set.",
  fields: [
    { name: "name", type: "string", required: false, description: "Name for the clone (default: Copy of the source name)" },
    { name: "description", type: "string", required: false, description: "Description for the clone (default: source description)" },
  ],
};

const datasetItemHistorySchema: BodySchema = {
  description: "Fetch per-item score history from recent completed runs",
  fields: [
    {
      name: "item_identifiers",
      type: "array",
      required: true,
      description: "1–100 unique dataset business IDs (item_identifier values), not internal item UUIDs",
      itemType: "string",
    },
    { name: "limit", type: "number", required: false, description: "Completed runs per item (1–20; default 5)" },
  ],
};


const rescoreSchema: BodySchema = {
  description: "Rescore with a different metric set",
  fields: [{ name: "metric_set_id", type: "string", required: true, description: "Metric set UUID" }],
};

const recommendationsSchema: BodySchema = {
  description: "Generate or refresh LLM-powered recommendations for failing items",
  fields: [
    { name: "force_refresh", type: "boolean", required: false, description: "Regenerate recommendations instead of using the cached analysis" },
  ],
};


const createMetricSchema: BodySchema = {
  description: "Create custom metric",
  fields: [
    { name: "name", type: "string", required: true, description: "Metric name" },
    { name: "type", type: "string", required: true, description: "heuristic | llm | embedding | code | composite" },
    { name: "dimension", type: "string", required: true, description: "Evaluation dimension: correctness | groundedness | safety | trajectory | performance" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "kind", type: "string", required: false, description: "harness-evals metric kind identifier (e.g. exact_match, contains, levenshtein, json_diff, latency, rubric_judge, geval)" },
    {
      name: "config",
      type: "object",
      required: false,
      description:
        "Metric config — structure depends on type/kind. " +
        "Heuristic: { kind, threshold?, case_sensitive?, ... }. " +
        "LLM: { rubric?, criteria?, judge_llm_config? (preferred structured provider config), judge_llm_connector_ref? (DEPRECATED) }. " +
        "Composite: { metrics: [{ metric_id, weight }], aggregation: 'average'|'weighted_average'|'min'|'max'|'all_pass' }. " +
        "Use harness_execute(resource_type='eval_metric', action='suggestions') to discover appropriate metrics for a target type.",
    },
    { name: "default_threshold", type: "number", required: false, description: "Default threshold 0-1 (default 0.8)" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "is_active", type: "boolean", required: false, description: "Active (default true)" },
  ],
};

const updateMetricSchema: BodySchema = {
  description: "Update metric (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "dimension", type: "string", required: false, description: "Evaluation dimension: correctness | groundedness | safety | trajectory | performance" },
    { name: "config", type: "object", required: false, description: "Config" },
    { name: "default_threshold", type: "number", required: false, description: "Threshold 0-1" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "is_active", type: "boolean", required: false, description: "Active" },
  ],
};

const createMetricSetSchema: BodySchema = {
  description: "Create metric set",
  fields: [
    { name: "name", type: "string", required: true, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    {
      name: "judge_llm_config",
      type: "object",
      required: false,
      description: "Preferred structured LLM provider configuration for the judge model",
    },
    {
      name: "judge_model_id",
      type: "string",
      required: false,
      description: "DEPRECATED — use judge_llm_config. UUID of the registered judge model",
    },
    {
      name: "judge_llm_connector_ref",
      type: "string",
      required: false,
      description: "DEPRECATED — use judge_llm_config. Harness LLM connector identifier for judge model",
    },
    {
      name: "entries",
      type: "array",
      required: false,
      description:
        "Initial metric entries. Each: { metric_id: '<eval_metric UUID>', threshold: 0-1, weight?: number, position?: number, config?: object }. " +
        "List metrics with harness_list(resource_type=eval_metric).",
      itemType: "object",
    },
  ],
};

const updateMetricSetSchema: BodySchema = {
  description: "Update metric set (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    {
      name: "judge_llm_config",
      type: "object",
      required: false,
      description: "Preferred structured LLM provider configuration for the judge model",
    },
    {
      name: "judge_model_id",
      type: "string",
      required: false,
      description: "DEPRECATED — use judge_llm_config. UUID of the registered judge model",
    },
    {
      name: "judge_llm_connector_ref",
      type: "string",
      required: false,
      description: "DEPRECATED — use judge_llm_config. Harness LLM connector identifier for judge model",
    },
  ],
};

const addMetricSetEntrySchema: BodySchema = {
  description: "Add metric to set",
  fields: [
    { name: "metric_id", type: "string", required: true, description: "Metric UUID (list with harness_list resource_type=eval_metric)" },
    { name: "threshold", type: "number", required: true, description: "Pass threshold 0-1" },
    { name: "weight", type: "number", required: false, description: "Weight" },
    { name: "position", type: "number", required: false, description: "Order" },
    { name: "config", type: "object", required: false, description: "Per-use-site config override (merged over metric's base config at eval time). Get valid fields from the metric's config_schema via harness_get(resource_type='eval_metric')" },
  ],
};

const updateMetricSetEntrySchema: BodySchema = {
  description: "Update metric set entry (PATCH)",
  fields: [
    { name: "threshold", type: "number", required: false, description: "Threshold" },
    { name: "weight", type: "number", required: false, description: "Weight" },
    { name: "position", type: "number", required: false, description: "Position" },
    { name: "config", type: "object", required: false, description: "Per-use-site config override (merged over metric's base config at eval time). Get valid fields from the metric's config_schema via harness_get(resource_type='eval_metric')" },
  ],
};

const calibrateSchema: BodySchema = {
  description: "Calibrate thresholds from a baseline run",
  fields: [
    { name: "run_id", type: "string", required: true, description: "Baseline run UUID" },
    { name: "factor", type: "number", required: false, description: "Multiplier (default 0.9)" },
  ],
};

const createSuiteSchema: BodySchema = {
  description: "Create eval suite",
  fields: [
    { name: "name", type: "string", required: true, description: "Suite name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "purpose", type: "string", required: false, description: "pr_gate | cd_gate | release_gate | custom (default custom)" },
    { name: "pass_strategy", type: "string", required: false, description: "all_must_pass | weighted_threshold (default all_must_pass)" },
    { name: "pass_threshold", type: "number", required: false, description: "0-1, used when strategy is weighted_threshold" },
    { name: "is_blocking", type: "boolean", required: false, description: "Blocking suite (default true)" },
    { name: "triggered_by", type: "string", required: false, description: "Who created the suite" },
    { name: "schedule", type: "object", required: false, description: "Cron schedule: { cron: string, timezone?: string (default UTC), enabled?: boolean (default true) }" },
    { name: "storage_type", type: "string", required: false, description: "managed (default) | git" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const updateSuiteSchema: BodySchema = {
  description: "Update suite (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "purpose", type: "string", required: false, description: "pr_gate | cd_gate | release_gate | custom" },
    { name: "pass_strategy", type: "string", required: false, description: "all_must_pass | weighted_threshold" },
    { name: "pass_threshold", type: "number", required: false, description: "Pass threshold 0-1" },
    { name: "is_blocking", type: "boolean", required: false, description: "Blocking suite" },
    { name: "schedule", type: "object", required: false, description: "Cron schedule: { cron, timezone?, enabled? } — set null to remove" },
    { name: "storage_type", type: "string", required: false, description: "managed | git (switches storage mode)" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when switching to storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const addSuiteEntrySchema: BodySchema = {
  description: "Add evaluation to suite",
  fields: [
    { name: "evaluation_id", type: "string", required: true, description: "Eval UUID (list with harness_list resource_type=evaluation)" },
    { name: "is_required", type: "boolean", required: false, description: "Counts toward pass" },
    { name: "position", type: "number", required: false, description: "Order" },
  ],
};

const replaceSuiteEntriesSchema: BodySchema = {
  description: "Replace all suite members",
  fields: [
    {
      name: "entries",
      type: "array",
      required: true,
      description: "Ordered list of { evaluation_id, is_required?, position? }",
      itemType: "object",
    },
  ],
};

const triggerSuiteRunSchema: BodySchema = {
  description: "Trigger suite run",
  fields: [
    { name: "triggered_by", type: "string", required: false, description: "Who triggered the run" },
    { name: "trigger_type", type: "string", required: false, description: "manual | api | ci | scheduled (default manual)" },
    { name: "suite_path", type: "string", required: false, description: "Suite YAML path (git-backed, overrides suite.source_path)" },
    { name: "branch", type: "string", required: false, description: "Override git branch (e.g. run against a PR branch)" },
    {
      name: "run_inputs",
      type: "object",
      required: false,
      description:
        "RunInputs overrides: { llm_config? (preferred structured provider config), target_id?, dataset_id?, metric_set_id?, variables? }. " +
        "llm_connector_ref, model_id, and model remain accepted but are DEPRECATED; use llm_config instead.",
    },
    { name: "input_set_id", type: "string", required: false, description: "Saved input set id" },
    {
      name: "per_eval_overrides",
      type: "object",
      required: false,
      description: "Per-eval RunInputs overrides keyed by eval_id: { eval_id: RunInputs }",
    },
  ],
};

const createTargetSchema: BodySchema = {
  description: "Create target. For managed: type + config are required. For git-backed: omit type/config and provide storage_type='git' + git_source.",
  fields: [
    { name: "name", type: "string", required: true, description: "Name" },
    { name: "type", type: "string", required: false, description: "prompt | agent | precomputed (required when storage_type='managed', omit for git)" },
    {
      name: "config",
      type: "object",
      required: false,
      description:
        "Target config (required when storage_type='managed', omit for git). " +
        "For type='prompt': { llm_connector_ref: '<existing Harness LLM connector identifier>', " +
        "model?: string, prompt_source?: 'inline'|'registry', prompt_id?: string, prompt_version?: string, " +
        "system_message?: string, user_message_template?: '...{{input}}...', temperature?: 0-2, max_tokens?: int, top_p?: 0-1, " +
        "frequency_penalty?: -2 to 2, presence_penalty?: -2 to 2 }. " +
        "For type='agent': { endpoint_url: '<agent HTTP URL>', method: 'GET'|'POST'|'PUT', response_path: '<response JSON path>', request_template?: object }. " +
        "For type='precomputed': { dataset_id?: string, model_name?: string, model_version?: string }.",
    },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "is_active", type: "boolean", required: false, description: "Active (default true)" },
    { name: "env_secrets", type: "object", required: false, description: "Env var to Harness secret ref mapping" },
    { name: "connector_ref", type: "string", required: false, description: "Harness HTTP connector for endpoint configuration" },
    { name: "storage_type", type: "string", required: false, description: "managed (default) | git" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const updateTargetSchema: BodySchema = {
  description: "Update target (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "type", type: "string", required: false, description: "prompt | agent | precomputed" },
    {
      name: "config",
      type: "object",
      required: false,
      description:
        "Target config. For type='prompt': { llm_connector_ref, prompt_source?, prompt_id?, prompt_version?, system_message?, user_message_template?, model? }. " +
        "For type='agent': { endpoint_url, method, response_path, request_template? }. For type='precomputed': { dataset_id?, model_name?, model_version? }.",
    },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "is_active", type: "boolean", required: false, description: "Active" },
    { name: "env_secrets", type: "object", required: false, description: "Env var to Harness secret ref mapping" },
    { name: "connector_ref", type: "string", required: false, description: "Harness HTTP connector for endpoint configuration" },
    { name: "storage_type", type: "string", required: false, description: "managed | git (switches storage mode)" },
    { name: "git_source", type: "object", required: false, description: "Git location (required when switching to storage_type='git'): { connector_ref?, repo?, branch?, file_path (required) }" },
  ],
};

const testTargetSchema: BodySchema = {
  description: "Test target invocation",
  fields: [
    { name: "input", type: "object", required: true, description: "Sample input: string or JSON object matching a dataset item input" },
    { name: "item_identifier", type: "string", required: false, description: "Dataset item identifier (used by precomputed targets to look up output)" },
  ],
};

const uploadOutputsSchema: BodySchema = {
  description: "Upload static target outputs",
  fields: [
    {
      name: "items",
      type: "array",
      required: true,
      description: "List of { item_identifier: string, output: object, metadata?: object }",
      itemType: "object",
    },
  ],
};

const bulkDeleteDatasetItemsSchema: BodySchema = {
  description: "Bulk-delete dataset items by internal UUID or stable business item ID",
  fields: [
    {
      name: "item_ids",
      type: "array",
      required: true,
      description: "One or more internal item UUIDs or item_identifier values. Unknown IDs are returned as not_found.",
      itemType: "string",
    },
  ],
};


const createAnnotationSchema: BodySchema = {
  description: "Create annotation",
  fields: [
    { name: "trace_id", type: "string", required: true, description: "Trace id" },
    { name: "span_id", type: "string", required: false, description: "Span id" },
    { name: "label", type: "string", required: false, description: "Label" },
    { name: "score", type: "number", required: false, description: "Score 0-1" },
    { name: "thumbs_up", type: "boolean", required: false, description: "Thumbs up/down feedback: true=up, false=down, null=unset" },
    { name: "comment", type: "string", required: false, description: "Comment" },
    { name: "metadata", type: "object", required: false, description: "Metadata" },
    { name: "annotator_type", type: "string", required: false, description: "human | automated (default human)" },
  ],
};

const updateAnnotationSchema: BodySchema = {
  description: "Update annotation (PATCH)",
  fields: [
    { name: "label", type: "string", required: false, description: "Label" },
    { name: "score", type: "number", required: false, description: "Score 0-1" },
    { name: "thumbs_up", type: "boolean", required: false, description: "Thumbs up/down feedback: true=up, false=down, null=unset" },
    { name: "comment", type: "string", required: false, description: "Comment" },
    { name: "metadata", type: "object", required: false, description: "Metadata" },
  ],
};

const upsertGitSettingsSchema: BodySchema = {
  description: "Git sync settings (if enabled, harness_code_repo or connector_ref required)",
  fields: [
    { name: "enabled", type: "boolean", required: false, description: "Enable sync (default false)" },
    { name: "harness_code_repo", type: "string", required: false, description: "Harness Code repo ref (e.g. org/project/repo)" },
    { name: "connector_ref", type: "string", required: false, description: "Harness connector ref (alternative to harness_code_repo)" },
    { name: "connector_repo_url", type: "string", required: false, description: "External Git repo URL (with connector_ref)" },
    { name: "default_branch", type: "string", required: false, description: "Branch (default main)" },
    { name: "base_path", type: "string", required: false, description: "Base path (default .harness/evals)" },
    { name: "webhook_secret", type: "string", required: false, description: "HMAC-SHA256 webhook secret" },
    { name: "pipeline_id", type: "string", required: false, description: "Pipeline to trigger on suite runs" },
  ],
};

const createRegistryItemSchema: BodySchema = {
  description: "Create registry item",
  fields: [
    { name: "name", type: "string", required: true, description: "Name" },
    { name: "identifier", type: "string", required: true, description: "Unique id" },
    { name: "type", type: "string", required: true, description: "prompt | agent | mcp_tool | skill" },
    { name: "config", type: "object", required: true, description: "Item config payload" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "labels", type: "object", required: false, description: "Key-value labels" },
  ],
};

const updateRegistryItemSchema: BodySchema = {
  description: "Update registry item",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "config", type: "object", required: false, description: "Item config payload" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "labels", type: "object", required: false, description: "Key-value labels" },
    { name: "enabled", type: "boolean", required: false, description: "Enabled" },
  ],
};


const generateDatasetItemsSchema: BodySchema = {
  description: "Generate synthetic dataset items using an LLM (synchronous)",
  fields: [
    {
      name: "strategy",
      type: "string",
      required: true,
      description: "Generation strategy: use_case | rephrase | adversarial | complexity_ladder",
    },
    { name: "count", type: "number", required: true, description: "Number of items to generate (1-200)" },
    {
      name: "llm_config",
      type: "object",
      required: false,
      description: "Preferred structured LLM provider configuration for dataset generation",
    },
    {
      name: "model_id",
      type: "string",
      required: false,
      description: "DEPRECATED — use llm_config. UUID of the registered AI model",
    },
    {
      name: "llm_connector_ref",
      type: "string",
      required: false,
      description: "DEPRECATED — use llm_config. Harness LLM connector identifier for the generation model",
    },
    {
      name: "description",
      type: "string",
      required: false,
      description: "Use case description (required for use_case, adversarial, complexity_ladder strategies)",
    },
    {
      name: "seed_inputs",
      type: "array",
      required: false,
      description: "Existing inputs to rephrase (required for rephrase strategy)",
      itemType: "string",
    },
    {
      name: "strategy_options",
      type: "object",
      required: false,
      description: "Strategy-specific options, e.g. { levels: ['simple', 'complex'] }",
    },
  ],
};

const importEvalYamlSchema: BodySchema = {
  description: "Import eval from YAML (creates target, dataset, metric set, and eval in one call)",
  fields: [
    { name: "yaml_content", type: "string", required: true, description: "Full YAML content defining target, dataset, metrics, and eval settings" },
    { name: "auto_run", type: "boolean", required: false, description: "If true, trigger an eval run immediately after creation (default false)" },
    { name: "dry_run", type: "boolean", required: false, description: "If true, validate the YAML without creating any entities (default false)" },
  ],
};

const importSuiteYamlSchema: BodySchema = {
  description: "Import suite from YAML (creates suite with member evaluations)",
  fields: [
    { name: "yaml_content", type: "string", required: true, description: "Full YAML content defining a suite with evaluations" },
    { name: "dry_run", type: "boolean", required: false, description: "If true, validate the YAML without creating any entities (default false)" },
  ],
};

const bulkUpsertDatasetItemsSchema: BodySchema = {
  description: "Bulk upsert dataset items (insert or update by business ID)",
  fields: [
    { name: "items", type: "array", required: true, description: "Dataset items to upsert (CreateDatasetItemRequest[])", itemType: "object" },
  ],
};

const evaluateTraceSchema: BodySchema = {
  description: "Evaluate a production trace with selected metrics",
  fields: [
    { name: "span_id", type: "string", required: false, description: "Specific span to evaluate (defaults to root span)" },
    { name: "metric_set_id", type: "string", required: false, description: "UUID of a MetricSet (includes metrics + judge model). List with harness_list resource_type=eval_metric_set" },
    {
      name: "metrics",
      type: "array",
      required: false,
      description:
        "Inline metric definitions for ad-hoc evaluation: [{ type: 'heuristic'|'llm', kind?: string, score_name: string, config?: object, threshold?: 0-1 }]. " +
        "At least one of metric_set_id or metrics is required.",
      itemType: "object",
    },
    {
      name: "judge_llm_config",
      type: "object",
      required: false,
      description: "Preferred structured LLM provider configuration for the judge model",
    },
    {
      name: "judge_model_id",
      type: "string",
      required: false,
      description: "DEPRECATED — use judge_llm_config. UUID of the registered judge model",
    },
    {
      name: "judge_llm_connector_ref",
      type: "string",
      required: false,
      description: "DEPRECATED — use judge_llm_config. Harness LLM connector identifier for judge model",
    },
    {
      name: "options",
      type: "object",
      required: false,
      description: "Evaluation options: { include_trajectory?: boolean (default false) }",
    },
  ],
};

const gitRegisterSchema: BodySchema = {
  description: "Register entities from git (eval, suite, or manifest)",
  fields: [
    { name: "type", type: "string", required: true, description: "eval | suite | manifest — determines what to register from file_path" },
    {
      name: "git_source",
      type: "object",
      required: true,
      description:
        "Git coordinate: { connector_ref: string (Harness connector), repo: string, branch?: string (default repo default), " +
        "file_path: string (path to root entity YAML), base_path?: string (prepended to relative paths) }",
    },
  ],
};

/** Merge harness_execute `body` into JSON POST body */
function bodyFromInput(input: Record<string, unknown>): unknown {
  const b = input.body;
  if (b !== undefined && b !== null && typeof b === "object" && !Array.isArray(b)) {
    return b;
  }
  if (Array.isArray(b)) {
    return b;
  }
  return {};
}

export const aiEvalsToolset: ToolsetDefinition = {
  name: "ai-evals",
  displayName: "AI Evals",
  description:
    "Harness AI Evals control plane: datasets, evaluations, runs, metrics, metric sets, suites, targets, models, annotations, analytics, registry, git settings.",
  optIn: false,
  resources: [
    // --- Datasets ---
    {
      resourceType: "eval_dataset",
      displayName: "AI Evals Dataset",
      description: "Evaluation dataset (managed JSONL rows or git-backed). CRUD + items sub-resource via eval_dataset_item.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["dataset_id"],
      diagnosticHint:
        "Dataset items require 'input' as a JSON object (e.g. { messages: [{role:'user', content:'...'}] } or { prompt: '...' }). " +
        "Optional fields depend on metric type: 'expected_output' for correctness metrics, 'context' (string array) for RAG/groundedness metrics, " +
        "'expected_tools' for agent tool-use metrics. Items can be added inline on create or managed separately via eval_dataset_item.",
      listFilterFields: [
        { name: "search", description: "Search by name, identifier, or description" },
        { name: "target_id", description: "Filter datasets used by evals referencing this target UUID" },
      ],
      relatedResources: [
        { resourceType: "eval_dataset_item", relationship: "contains", description: "Dataset rows (add/list/update individually)" },
        { resourceType: "evaluation", relationship: "used_by", description: "Evals reference datasets via dataset_id" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, search: "search", target_id: "target_id" },
          responseExtractor: aiEvalsListExtract,
          description: "List datasets",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset/${input.dataset_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get dataset by UUID",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createDatasetSchema,
          responseExtractor: passthrough,
          description: "Create dataset",
        },
        update: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset/${input.dataset_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateDatasetSchema,
          responseExtractor: passthrough,
          description: "Update dataset",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset/${input.dataset_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete dataset",
        },
      },
      executeActions: {
        get_by_identifier: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/by-identifier/${encodeURIComponent(input.identifier as string)}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          actionDescription:
            "Get dataset by its unique identifier slug (not UUID). Pass identifier via params.identifier.",
          bodySchema: { description: "No body", fields: [] },
        },
        generate: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/generate`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: validateDatasetGeneration,
          bodyBuilder: bodyFromInput,
          bodySchema: generateDatasetItemsSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Generate synthetic dataset items using an LLM (synchronous). " +
            "Strategies: use_case (from description), rephrase (from seed_inputs), adversarial, complexity_ladder. " +
            "Returns generated_count and items directly.",
        },
      },
    },
    {
      resourceType: "eval_dataset_item",
      displayName: "AI Evals Dataset Item",
      description: "Single row in a dataset. Pass dataset_id via params when using harness_get/harness_list.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["dataset_id", "item_id"],
      listFilterFields: [{ name: "dataset_id", description: "Parent dataset UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List items (filters.dataset_id required)",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items/${input.item_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get item by UUID",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createDatasetItemSchema,
          responseExtractor: passthrough,
          description: "Create item",
        },
        update: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items/${input.item_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateDatasetItemSchema,
          responseExtractor: passthrough,
          description: "Update item",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items/${input.item_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete item",
        },
      },
      executeActions: {
        bulk_upsert: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items/bulk`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: bodyFromInput,
          bodySchema: bulkUpsertDatasetItemsSchema,
          responseExtractor: aiEvalsArrayExtract,
          actionDescription: "Bulk upsert dataset items by business ID. Body: { items: CreateDatasetItemRequest[] }",
        },
        bulk_delete: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items/bulk-delete`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => {
            await getScopedResource(ctx, "eval_dataset", "dataset_id", ctx.input.dataset_id);
            const ids = asArray(requireBody(ctx.input, "Dataset-item bulk delete").item_ids);
            if (ids.length === 0 || ids.some(id => !nonEmptyString(id))) {
              throw new Error("item_ids must be a non-empty array of dataset item UUIDs or stable item identifiers.");
            }
          },
          bodyBuilder: bodyFromInput,
          bodySchema: bulkDeleteDatasetItemsSchema,
          responseExtractor: passthrough,
          actionDescription: "Bulk-delete dataset items by internal UUID or stable business item ID.",
        },
      },
    },
    // --- Evaluations ---
    {
      resourceType: "evaluation",
      displayName: "AI Evals Evaluation",
      description: "An eval wiring dataset + target + metric set. Trigger runs via execute action run.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["eval_id"],
      diagnosticHint:
        "An eval requires three components: dataset_id, target_id, and metric_set_id. " +
        "Before creating an eval, list existing resources with harness_list for eval_dataset, eval_target, and eval_metric_set. " +
        "Create any missing components first. Managed evaluations cannot be created until all three are set. " +
        "When storage_type='git', omit dataset_id/target_id/metric_set_id (they live in the YAML at git_source.file_path).",
      relatedResources: [
        { resourceType: "eval_dataset", relationship: "uses", description: "Eval references a dataset via dataset_id" },
        { resourceType: "eval_target", relationship: "uses", description: "Eval references a target via target_id" },
        { resourceType: "eval_metric_set", relationship: "uses", description: "Eval references a metric set via metric_set_id" },
        { resourceType: "eval_run", relationship: "produces", description: "Eval runs are listed via eval_run_by_eval" },
      ],
      listFilterFields: [
        {
          name: "status",
          description: "Filter by status",
          enum: ["active", "draft", "archived"],
        },
        { name: "target_id", description: "Filter by target UUID(s)" },
        { name: "metric_set_id", description: "Filter by metric set UUID" },
        { name: "search", description: "Search by name or description" },
      ],
      executeHint: "Run an eval with harness_execute(resource_type='evaluation', action='run', resource_id=EVAL_ID, body={...}).",
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, status: "status", target_id: "target_id", metric_set_id: "metric_set_id", search: "search" },
          responseExtractor: aiEvalsListExtract,
          description: "List evals",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/${input.eval_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get eval",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => validateManagedEvalComposition(ctx, ctx.input, true),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createEvalSchema,
          responseExtractor: passthrough,
          description: "Create eval",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/${input.eval_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          preflight: async (ctx) => validateManagedEvalComposition(ctx, ctx.input, false),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateEvalSchema,
          responseExtractor: passthrough,
          description: "Update eval",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/${input.eval_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Hard-delete eval and its runs (409 if referenced by a suite)",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/evals/${input.eval_id as string}/run`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: validateEvalRun,
          bodyBuilder: bodyFromInput,
          bodySchema: triggerEvalRunSchema,
          responseExtractor: passthrough,
          actionDescription: "Trigger an eval run (pipeline or CLI). Pass optional overrides in body.",
        },
        clone: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/evals/${input.eval_id as string}/clone`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => {
            const evaluation = await getScopedResource(ctx, "evaluation", "eval_id", ctx.input.eval_id);
            if (evaluation.storage_type === "git") {
              throw new Error("Git-backed evaluations cannot be cloned. Create their YAML definition in source control instead.");
            }
          },
          bodyBuilder: bodyFromInput,
          bodySchema: cloneEvalSchema,
          responseExtractor: passthrough,
          actionDescription: "Clone a managed evaluation. Git-backed evaluations must be exported and managed in Git instead.",
        },
        item_history: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/evals/${input.eval_id as string}/items/history`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: async (ctx) => {
            await getScopedResource(ctx, "evaluation", "eval_id", ctx.input.eval_id);
            const body = requireBody(ctx.input, "Dataset-item history");
            const identifiers = asArray(body.item_identifiers);
            if (identifiers.length === 0 || identifiers.length > 100 || identifiers.some(value => !nonEmptyString(value))) {
              throw new Error("item_identifiers must contain 1–100 non-empty dataset business IDs.");
            }
          },
          bodyBuilder: bodyFromInput,
          bodySchema: datasetItemHistorySchema,
          responseExtractor: passthrough,
          actionDescription: "Get score history for one or more stable dataset item identifiers.",
        },
        import_yaml: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/import-yaml`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: bodyFromInput,
          bodySchema: importEvalYamlSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Import a YAML document to create target, dataset, metric set, and eval in one call. Set dry_run=true to validate without creating. Set auto_run=true to trigger a run immediately.",
        },
        export_yaml: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/evals/${input.eval_id as string}/export-yaml`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          actionDescription: "Export an eval and all referenced entities as a denormalized YAML document.",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    // --- Runs ---
    {
      resourceType: "eval_run",
      displayName: "AI Evals Run",
      description: "A single evaluation run. Compare runs or rescore via execute actions. To filter by eval_id, use the eval_run_by_eval resource instead.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["run_id"],
      listFilterFields: [
        { name: "target_id", description: "Filter runs by target UUID" },
      ],
      relatedResources: [
        { resourceType: "eval_run_item", relationship: "contains", description: "Per-item results" },
        { resourceType: "evaluation", relationship: "belongs_to", description: "Run belongs to an evaluation" },
        { resourceType: "eval_suite_run", relationship: "belongs_to", description: "Run may be a child of a suite run via suite_run_id" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, target_id: "target_id" },
          responseExtractor: aiEvalsListExtract,
          description: "List runs in project. Use eval_run_by_eval resource to filter by eval_id.",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get run",
        },
      },
      executeActions: {
        compare: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/compare`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { run_ids: "run_ids" },
          responseExtractor: passthrough,
          actionDescription:
            "Compare 2–10 runs. Pass run_ids as comma-separated UUIDs (params.run_ids or input.run_ids). No request body.",
          bodySchema: { description: "No body", fields: [] },
        },
        rescore: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}/rescore`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => {
            await validateRunReference(ctx);
            const body = requireBody(ctx.input, "Rescore");
            const metricSet = await getScopedResource(ctx, "eval_metric_set", "set_id", body.metric_set_id);
            await validateMetricSet(ctx, metricSet, true);
          },
          bodyBuilder: bodyFromInput,
          bodySchema: rescoreSchema,
          responseExtractor: passthrough,
          actionDescription: "Create a new run rescored with a different metric set",
        },
        recommendations: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/runs/${input.run_id as string}/recommendations`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: validateRunReference,
          bodyBuilder: bodyFromInput,
          bodySchema: recommendationsSchema,
          responseExtractor: passthrough,
          actionDescription: "Generate LLM-powered recommendations for a completed run's failing items.",
        },
      },
    },
    {
      resourceType: "eval_run_item",
      displayName: "AI Evals Run Item",
      description: "Per-dataset-item results for a run. List requires run_id in filters.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["run_id"],
      listFilterFields: [{ name: "run_id", description: "Parent run UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/runs/${input.run_id as string}/items`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List run items",
        },
      },
    },
    {
      resourceType: "eval_run_by_eval",
      displayName: "AI Evals Runs for Eval",
      description: "List runs for a specific evaluation (shortcut). Use list with filters.eval_id.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["eval_id"],
      listFilterFields: [{ name: "eval_id", description: "Evaluation UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/evals/${input.eval_id as string}/runs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List runs for an eval",
        },
      },
    },
    // --- Metrics ---
    {
      resourceType: "eval_metric",
      displayName: "AI Evals Metric",
      description: "Custom or builtin metric definitions. Types: heuristic (deterministic), llm (LLM-as-judge), code (custom Python), composite (aggregation).",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["metric_id"],
      diagnosticHint:
        "Use the 'suggestions' execute action to discover appropriate metrics for a given target type and dataset shape. " +
        "Metrics are added to metric sets (eval_metric_set) via eval_metric_set_entry, then referenced by evaluations. " +
        "Each metric response includes a 'config_schema' field (JSON Schema) describing available config options for that metric kind — " +
        "use harness_get to inspect a metric's config_schema before setting config on a metric set entry.",
      relatedResources: [
        { resourceType: "eval_metric_set_entry", relationship: "used_by", description: "Metrics are added to metric sets via entries" },
      ],
      listFilterFields: [
        { name: "type", description: "Filter by metric type (e.g. heuristic, llm)" },
        { name: "search", description: "Search by metric name or description" },
        { name: "target_id", description: "Filter metrics used by evals referencing this target UUID" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, type: "type", search: "search", target_id: "target_id" },
          responseExtractor: aiEvalsListExtract,
          description: "List metrics",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/${input.metric_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get metric",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createMetricSchema,
          responseExtractor: passthrough,
          description: "Create custom metric",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/${input.metric_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateMetricSchema,
          responseExtractor: passthrough,
          description: "Update metric",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/${input.metric_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete metric",
        },
      },
      executeActions: {
        suggestions: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/suggestions`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            target_type: "target_type",
            dataset_fields: "dataset_fields",
            category: "category",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get metric suggestions based on target type, dataset fields, and category. " +
            "Params: target_type (prompt|agent|precomputed), dataset_fields (comma-separated: context,expected_output,expected_tools), " +
            "category (correctness|groundedness|safety|trajectory|performance). All optional.",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    {
      resourceType: "eval_metric_set",
      displayName: "AI Evals Metric Set",
      description: "Grouped metrics with thresholds and optional judge model. Manage entries via eval_metric_set_entry.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["set_id"],
      diagnosticHint:
        "Before creating a metric set, list available metrics with harness_list(resource_type='eval_metric'). " +
        "Use harness_execute(resource_type='eval_metric', action='suggestions') to discover metrics appropriate for a target type. " +
        "If using LLM metrics (llm-as-judge), set judge_llm_config to a structured provider configuration. " +
        "judge_llm_connector_ref remains accepted but is DEPRECATED.",
      relatedResources: [
        { resourceType: "eval_metric_set_entry", relationship: "contains", description: "Metric membership entries with thresholds" },
        { resourceType: "eval_metric", relationship: "uses", description: "Entries reference metrics by metric_id" },
        { resourceType: "evaluation", relationship: "used_by", description: "Evals reference metric sets via metric_set_id" },
      ],
      listFilterFields: [
        { name: "search", description: "Search by name or description" },
        { name: "target_id", description: "Filter metric sets used by evals referencing this target UUID" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, search: "search", target_id: "target_id" },
          responseExtractor: aiEvalsListExtract,
          description: "List metric sets",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets/${input.set_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get metric set",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => validateMetricSetWrite(ctx, ctx.input, false),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createMetricSetSchema,
          responseExtractor: passthrough,
          description: "Create metric set",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets/${input.set_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          preflight: async (ctx) => validateMetricSetWrite(ctx, ctx.input, true),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateMetricSetSchema,
          responseExtractor: passthrough,
          description: "Update metric set",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets/${input.set_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete metric set",
        },
      },
      executeActions: {
        calibrate: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/calibrate`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: bodyFromInput,
          bodySchema: calibrateSchema,
          responseExtractor: passthrough,
          actionDescription: "Calibrate entry thresholds from a baseline run",
        },
        replace_metrics: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          preflight: validateMetricSetReplacement,
          bodyBuilder: (input) => {
            const b = input.body;
            if (Array.isArray(b)) return b;
            throw new Error(
              "replace_metrics requires body to be a JSON array of { metric_id, threshold, weight?, position? }",
            );
          },
          bodySchema: {
            description:
              "Request body must be a JSON array of metric-set entries (AddMetricSetEntryRequest). Pass via harness_execute body as a raw array.",
            fields: [],
          },
          responseExtractor: aiEvalsArrayExtract,
          actionDescription:
            "PUT replace entire metric list. Pass body as a JSON array of AddMetricSetEntryRequest objects (use harness_execute body).",
        },
      },
    },
    {
      resourceType: "eval_metric_set_entry",
      displayName: "AI Evals Metric Set Entry",
      description: "One metric membership in a metric set. Pass set_id via params for list/create.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["set_id", "metric_id"],
      relatedResources: [
        { resourceType: "eval_metric_set", relationship: "belongs_to", description: "Entry belongs to a metric set" },
        { resourceType: "eval_metric", relationship: "references", description: "Entry references a metric by metric_id" },
      ],
      listFilterFields: [{ name: "set_id", description: "Metric set UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: aiEvalsArrayExtract,
          description: "List entries in a metric set",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => validateMetricSetEntryWrite(ctx, false),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: addMetricSetEntrySchema,
          responseExtractor: passthrough,
          description: "Add a metric to the set (set_id in params)",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics/${input.metric_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          preflight: async (ctx) => validateMetricSetEntryWrite(ctx, true),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateMetricSetEntrySchema,
          responseExtractor: passthrough,
          description: "Update threshold/weight on an entry",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics/${input.metric_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Remove metric from set",
        },
      },
    },
    // --- Suites ---
    {
      resourceType: "eval_suite",
      displayName: "AI Evals Suite",
      description: "Multi-eval suite with pass strategy and optional cron schedule. Members: eval_suite_evaluation.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["suite_id"],
      diagnosticHint:
        "A suite groups evaluations together. First create evaluations (each with dataset + target + metric set), " +
        "then create the suite and add evaluations via eval_suite_evaluation or the replace_evaluations execute action. " +
        "List existing evaluations with harness_list(resource_type='evaluation').",
      relatedResources: [
        { resourceType: "eval_suite_evaluation", relationship: "contains", description: "Suite membership entries" },
        { resourceType: "evaluation", relationship: "uses", description: "Suite entries reference evaluations by evaluation_id" },
        { resourceType: "eval_suite_run", relationship: "produces", description: "Suite runs" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List suites",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/${input.suite_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get suite",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createSuiteSchema,
          responseExtractor: passthrough,
          description: "Create suite",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/${input.suite_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateSuiteSchema,
          responseExtractor: passthrough,
          description: "Update suite",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/${input.suite_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete suite",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/run`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: validateSuiteReference,
          bodyBuilder: bodyFromInput,
          bodySchema: triggerSuiteRunSchema,
          responseExtractor: passthrough,
          actionDescription: "Trigger a suite run",
        },
        replace_evaluations: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/evaluations`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: replaceSuiteEntriesSchema,
          responseExtractor: aiEvalsArrayExtract,
          actionDescription: "Replace ordered suite members (body.entries)",
        },
        import_yaml: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/import-yaml`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: bodyFromInput,
          bodySchema: importSuiteYamlSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Import a YAML document to create a suite with member evaluations. Set dry_run=true to validate without creating.",
        },
        export_yaml: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/export-yaml`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          actionDescription: "Export a suite and its member evaluations as a denormalized YAML document.",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    {
      resourceType: "eval_suite_evaluation",
      displayName: "AI Evals Suite Member",
      description: "One evaluation membership in a suite. List requires suite_id.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["suite_id", "evaluation_id"],
      relatedResources: [
        { resourceType: "eval_suite", relationship: "belongs_to", description: "Entry belongs to a suite" },
        { resourceType: "evaluation", relationship: "references", description: "Entry references an evaluation by evaluation_id" },
      ],
      listFilterFields: [{ name: "suite_id", description: "Suite UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/evaluations`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: aiEvalsArrayExtract,
          description: "List suite members",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/evaluations`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: addSuiteEntrySchema,
          responseExtractor: passthrough,
          description: "Add evaluation to suite",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/evaluations/${input.evaluation_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Remove evaluation from suite",
        },
      },
    },
    {
      resourceType: "eval_suite_run",
      displayName: "AI Evals Suite Run",
      description: "Suite execution (status: queued | running | passed | failed | stopped). List by suite; get by suite_run_id.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["suite_run_id"],
      relatedResources: [
        { resourceType: "eval_suite", relationship: "belongs_to", description: "Suite run belongs to a suite" },
        { resourceType: "eval_run", relationship: "contains", description: "Suite run spawns child eval runs (filter via suite_run_id on eval_run)" },
      ],
      listFilterFields: [{ name: "suite_id", description: "Suite UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/runs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List suite runs for a suite",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suite-runs/${input.suite_run_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get suite run status",
        },
      },
    },
    // --- Targets & models ---
    {
      resourceType: "eval_target",
      displayName: "AI Evals Target",
      description: "Invocation target (prompt, agent, or precomputed). Prompt targets use an LLM connector via config.llm_connector_ref.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["target_id"],
      diagnosticHint:
        "When creating a prompt target, use an LLM connector reference (config.llm_connector_ref) " +
        "to specify the model credentials. List connectors via harness_list(resource_type='connector', filters={type:'OpenAI'}) (also type:'Anthropic').",
      relatedResources: [
        { resourceType: "evaluation", relationship: "used_by", description: "Evals reference targets via target_id" },
      ],
      listFilterFields: [
        { name: "type", description: "prompt | agent | precomputed" },
        { name: "search", description: "Search by name or description" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, type: "type", search: "search" },
          responseExtractor: aiEvalsListExtract,
          description: "List targets",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets/${input.target_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get target",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: async (ctx) => validateTargetWrite(ctx, false),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createTargetSchema,
          responseExtractor: passthrough,
          description: "Create target",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets/${input.target_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          preflight: async (ctx) => validateTargetWrite(ctx, true),
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateTargetSchema,
          responseExtractor: passthrough,
          description: "Update target",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets/${input.target_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete target",
        },
      },
      executeActions: {
        test: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/targets/${input.target_id as string}/test`,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          preflight: validateTargetTest,
          bodyBuilder: bodyFromInput,
          bodySchema: testTargetSchema,
          responseExtractor: passthrough,
          actionDescription: "Send a test input to the target",
        },
        upload_outputs: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/targets/${input.target_id as string}/outputs`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: validateOutputUpload,
          bodyBuilder: bodyFromInput,
          bodySchema: uploadOutputsSchema,
          responseExtractor: passthrough,
          actionDescription: "Upload static target outputs (JSON body)",
        },
        list_outputs: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/targets/${input.target_id as string}/outputs`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          actionDescription: "List uploaded static target outputs (paginated).",
          bodySchema: { description: "No body", fields: [] },
        },
        export_yaml: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/targets/${input.target_id as string}/export-yaml`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          actionDescription: "Export target config as a standalone YAML document.",
          bodySchema: { description: "No body", fields: [] },
        },
        overview: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/targets/${input.target_id as string}/overview`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          actionDescription: "Summary metrics and per-eval health trend (total_evals, total_runs, last_run_at, overall_pass_rate, per-eval pass rates).",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    // --- Observe / analytics / registry / git ---
    {
      resourceType: "eval_annotation",
      displayName: "AI Evals Annotation",
      description: "Observe annotations for traces.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["annotation_id"],
      listFilterFields: [
        { name: "trace_id", description: "Filter by trace id" },
        { name: "label", description: "Filter by label" },
        { name: "annotator_type", description: "human | automated" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/observe/annotations`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            ...listQ,
            trace_id: "trace_id",
            label: "label",
            annotator_type: "annotator_type",
          },
          responseExtractor: aiEvalsListExtract,
          description: "List annotations",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/observe/annotations/${input.annotation_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get annotation",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/observe/annotations`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createAnnotationSchema,
          responseExtractor: passthrough,
          description: "Create annotation",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/observe/annotations/${input.annotation_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateAnnotationSchema,
          responseExtractor: passthrough,
          description: "Update annotation",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/observe/annotations/${input.annotation_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description: "Delete annotation",
        },
      },
      executeActions: {
        histogram: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/observe/annotations/histogram`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            start: "start",
            end: "end",
            granularity: "granularity",
          },
          responseExtractor: passthrough,
          actionDescription: "Annotation counts over time (optional start/end ISO, granularity auto|hour|day)",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    {
      resourceType: "online_eval",
      displayName: "AI Evals Online Evaluation",
      description: "Evaluate production traces with metrics. Scores a trace's input/output against selected metrics and creates annotations.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["trace_id"],
      diagnosticHint:
        "Evaluate a trace from production observability data. Pass metric_set_id (an existing MetricSet UUID) " +
        "or inline metric definitions via 'metrics' — at least one is required. Results are persisted as annotations (eval_annotation). " +
        "Get trace_id from your observability/tracing system.",
      relatedResources: [
        { resourceType: "eval_metric_set", relationship: "uses", description: "References a metric set by metric_set_id" },
        { resourceType: "eval_annotation", relationship: "produces", description: "Creates annotations with scores" },
      ],
      operations: {},
      executeActions: {
        evaluate: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/traces/${input.trace_id as string}/evaluate`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: bodyFromInput,
          bodySchema: evaluateTraceSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Evaluate a production trace with metrics. Returns scores, summary (pass_rate), and trace metadata. " +
            "Provide at least one of metric_set_id or inline metrics.",
        },
      },
    },
    {
      resourceType: "eval_analytics",
      displayName: "AI Evals Analytics",
      description: "Postgres-backed analytics summary for the project. Singleton — no resource_id needed for get.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/analytics/summary`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { days: "days" },
          defaultQueryParams: { days: "30" },
          responseExtractor: passthrough,
          description: "Summary stats (pass days 1-90)",
        },
      },
    },
    {
      resourceType: "eval_git_settings",
      displayName: "AI Evals Git Settings",
      description: "Git sync settings for the project (singleton). No resource_id needed — one per project.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: [],
      operations: {
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/settings/git`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get git sync settings (resource_id ignored)",
        },
        update: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/settings/git`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: upsertGitSettingsSchema,
          responseExtractor: passthrough,
          description: "Upsert git settings",
        },
      },
    },
    {
      resourceType: "eval_git_registration",
      displayName: "AI Evals Git Registration",
      description:
        "Register evals, suites, or manifests from a git repo. Creates the full sub-entity tree (target, dataset, metric_set, eval) with deduplication.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: [],
      diagnosticHint:
        "Use this to onboard git-backed evaluations. Provide a connector_ref for the git repo, the repo name, " +
        "and the file_path to the root YAML. Type 'eval' registers one eval + sub-entities, 'suite' registers a suite + all evals, " +
        "'manifest' registers everything listed in a manifest file. Deduplicates by (scope, repo, file_path).\n\n" +
        "Manifest YAML format: { evals: ['evals/qa.yaml'], suites: ['suites/pr-gate.yaml'] } — lists of relative paths.\n\n" +
        "Eval YAML format: { identifier, name, description?, target: 'targets/foo.yaml', dataset: 'datasets/bar.jsonl', " +
        "metric_set: 'metric-sets/baz.yaml', timeout_per_item_ms?, concurrency?, sampling_strategy?, sample_size? }.\n\n" +
        "Suite YAML format: { identifier, name, description?, pass_strategy: 'all_must_pass'|'threshold', pass_threshold?, " +
        "is_blocking?, evaluations: [{ eval: 'evals/foo.yaml', required: true }] }.\n\n" +
        "Target YAML format: { identifier, name, type: 'prompt'|'agent'|'precomputed', description?, config: {...}, env_secrets?: {...} }.\n\n" +
        "Metric set YAML format: { identifier, name, description?, entries: [{ metric: { name, kind, type, dimension? }, threshold, weight? }] }.\n\n" +
        "All file path references (target, dataset, metric_set, eval) are relative to base_path in git_source.",
      relatedResources: [
        { resourceType: "evaluation", relationship: "produces", description: "Registers evaluations with storage_type=git" },
        { resourceType: "eval_suite", relationship: "produces", description: "Registers suites with storage_type=git" },
      ],
      operations: {},
      executeActions: {
        register: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/git/register`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: bodyFromInput,
          bodySchema: gitRegisterSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Register entities from a git coordinate. Returns the registered entity tree with IDs, " +
            "dedup status (created vs reused), and any warnings. " +
            "Body: { type: 'eval'|'suite'|'manifest', git_source: { connector_ref, repo, branch?, file_path, base_path? } }. " +
            "For type='manifest', file_path points to a YAML with keys: evals (list of eval YAML paths) and/or suites (list of suite YAML paths). " +
            "All paths are relative to base_path.",
        },
      },
    },
    {
      resourceType: "eval_registry_item",
      displayName: "AI Evals Registry Item",
      description: "GenAI registry proxy (prompts, agents, tools). Pass type as query param for get/delete when needed.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["item_id"],
      listFilterFields: [{ name: "type", description: "prompt | agent | mcp_tool | skill" }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/registry`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, type: "type" },
          responseExtractor: aiEvalsListExtract,
          description: "List registry items",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/registry/${input.item_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { type: "type" },
          responseExtractor: passthrough,
          description: "Get registry item (optional type query)",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/registry`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createRegistryItemSchema,
          responseExtractor: passthrough,
          description: "Create registry item",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/registry/${input.item_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateRegistryItemSchema,
          responseExtractor: passthrough,
          description: "Update registry item",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/registry/${input.item_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          queryParams: { type: "type" },
          responseExtractor: passthrough,
          description: "Delete registry item",
        },
      },
    },
  ],
};
