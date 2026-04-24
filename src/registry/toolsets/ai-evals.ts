/**
 * AI Evals control plane — datasets, evals, runs, metrics, suites, targets, models, etc.
 * Base path: /ai-evals/api/v1/orgs/{org}/projects/{project}/...
 * Uses Harness-Account header; no accountIdentifier query param (headerBasedScoping).
 */
import type { BodySchema, PathBuilderConfig, ToolsetDefinition } from "../types.js";
import { aiEvalsArrayExtract, aiEvalsListExtract, passthrough } from "../extractors.js";

const AI = "/gateway/ai-evals/api/v1";

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
      description: "Inline dataset items (CreateDatasetItemRequest[])",
      itemType: "object",
    },
    { name: "metadata", type: "object", required: false, description: "Arbitrary metadata" },
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
      description: "Replace items (CreateDatasetItemRequest[])",
      itemType: "object",
    },
    { name: "metadata", type: "object", required: false, description: "Metadata" },
  ],
};

const createDatasetItemSchema: BodySchema = {
  description: "Create dataset item",
  fields: [
    { name: "id", type: "string", required: false, description: "Business id for the row" },
    { name: "input", type: "object", required: true, description: "Model input (JSON)" },
    { name: "expected_output", type: "object", required: false, description: "Expected output" },
    { name: "precomputed_output", type: "object", required: false, description: "Precomputed target output" },
    { name: "context", type: "array", required: false, description: "Context strings", itemType: "string" },
    { name: "expected_tools", type: "array", required: false, description: "Expected tool names", itemType: "string" },
    { name: "comments", type: "string", required: false, description: "Comments" },
    { name: "metadata", type: "object", required: false, description: "Extra metadata" },
    { name: "sort_order", type: "number", required: false, description: "Sort position" },
  ],
};

const updateDatasetItemSchema: BodySchema = {
  description: "Update dataset item",
  fields: [
    { name: "input", type: "object", required: false, description: "Input" },
    { name: "expected_output", type: "object", required: false, description: "Expected output" },
    { name: "precomputed_output", type: "object", required: false, description: "Precomputed target output" },
    { name: "context", type: "array", required: false, description: "Context", itemType: "string" },
    { name: "expected_tools", type: "array", required: false, description: "Expected tool names", itemType: "string" },
    { name: "comments", type: "string", required: false, description: "Comments" },
    { name: "metadata", type: "object", required: false, description: "Metadata" },
    { name: "sort_order", type: "number", required: false, description: "Sort position" },
  ],
};

const createEvalSchema: BodySchema = {
  description: "Create evaluation (draft until dataset, target, and metric_set are set)",
  fields: [
    { name: "name", type: "string", required: true, description: "Eval name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "dataset_id", type: "string", required: false, description: "Dataset UUID" },
    { name: "target_id", type: "string", required: false, description: "Target UUID" },
    { name: "metric_set_id", type: "string", required: false, description: "Metric set UUID" },
    { name: "sampling_strategy", type: "string", required: false, description: "all | random | first_n (default all)" },
    { name: "sample_size", type: "number", required: false, description: "Sample size" },
    { name: "concurrency", type: "number", required: false, description: "Parallelism (default 5, min 1)" },
    { name: "cost_limit_usd", type: "number", required: false, description: "Max cost in USD" },
    { name: "timeout_per_item_ms", type: "number", required: false, description: "Per-item timeout ms (default 30000, min 1000)" },
  ],
};

const updateEvalSchema: BodySchema = {
  description: "Update evaluation (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "status", type: "string", required: false, description: "draft | active | archived" },
    { name: "dataset_id", type: "string", required: false, description: "Dataset UUID" },
    { name: "target_id", type: "string", required: false, description: "Target UUID" },
    { name: "metric_set_id", type: "string", required: false, description: "Metric set UUID" },
    { name: "sampling_strategy", type: "string", required: false, description: "all | random | first_n" },
    { name: "sample_size", type: "number", required: false, description: "Sample size" },
    { name: "concurrency", type: "number", required: false, description: "Parallelism (min 1)" },
    { name: "cost_limit_usd", type: "number", required: false, description: "Max cost in USD" },
    { name: "timeout_per_item_ms", type: "number", required: false, description: "Per-item timeout ms (min 1000)" },
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
      description: "RunInputs overrides: { model_id?, target_id?, dataset_id?, metric_set_id?, variables? }",
    },
    { name: "input_set_id", type: "string", required: false, description: "Saved input set id" },
  ],
};

const createRunSchema: BodySchema = {
  description: "Create run. Provide eval_id XOR suite (not both).",
  fields: [
    { name: "eval_id", type: "string", required: false, description: "Eval UUID (mutually exclusive with suite)" },
    { name: "suite", type: "object", required: false, description: "Suite config (mutually exclusive with eval_id)" },
    { name: "name", type: "string", required: false, description: "Run name" },
    { name: "pass_threshold", type: "number", required: false, description: "Pass threshold" },
    { name: "dataset_id", type: "string", required: false, description: "Dataset UUID" },
    { name: "dataset_snapshot", type: "object", required: false, description: "Dataset snapshot" },
    { name: "variant_id", type: "string", required: false, description: "Variant identifier" },
    { name: "environment", type: "string", required: false, description: "Environment label" },
    { name: "metadata", type: "object", required: false, description: "Arbitrary metadata" },
    { name: "trigger_type", type: "string", required: false, description: "manual | scheduled | api | ci (default manual)" },
  ],
};

const updateRunSchema: BodySchema = {
  description: "Update run (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Run name" },
    { name: "pass_threshold", type: "number", required: false, description: "Pass threshold" },
    { name: "status", type: "string", required: false, description: "Status" },
    { name: "total_items", type: "number", required: false, description: "Total item count" },
    { name: "success_count", type: "number", required: false, description: "Successful items" },
    { name: "failed_count", type: "number", required: false, description: "Failed items" },
    { name: "summary_scores", type: "object", required: false, description: "Aggregated scores { metric_name: float }" },
  ],
};

const rescoreSchema: BodySchema = {
  description: "Rescore with a different metric set",
  fields: [{ name: "metric_set_id", type: "string", required: true, description: "Metric set UUID" }],
};

const postScoresSchema: BodySchema = {
  description: "Post scores (HarnessSink)",
  fields: [
    { name: "scores", type: "array", required: true, description: "HarnessScoreInput objects", itemType: "object" },
    { name: "dataset_item_id", type: "string", required: false, description: "Dataset item UUID" },
    { name: "eval_id", type: "string", required: false, description: "Eval UUID" },
  ],
};

const createMetricSchema: BodySchema = {
  description: "Create custom metric",
  fields: [
    { name: "name", type: "string", required: true, description: "Metric name" },
    { name: "type", type: "string", required: true, description: "Metric type (e.g. exact_match, ai_judge, json_diff)" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "kind", type: "string", required: false, description: "Kind slug (e.g. exact_match)" },
    { name: "config", type: "object", required: false, description: "Metric config JSON" },
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
  ],
};

const updateMetricSetSchema: BodySchema = {
  description: "Update metric set (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
  ],
};

const addMetricSetEntrySchema: BodySchema = {
  description: "Add metric to set",
  fields: [
    { name: "metric_id", type: "string", required: true, description: "Metric UUID" },
    { name: "threshold", type: "number", required: true, description: "Pass threshold 0-1" },
    { name: "weight", type: "number", required: false, description: "Weight" },
    { name: "position", type: "number", required: false, description: "Order" },
  ],
};

const updateMetricSetEntrySchema: BodySchema = {
  description: "Update metric set entry (PATCH)",
  fields: [
    { name: "threshold", type: "number", required: false, description: "Threshold" },
    { name: "weight", type: "number", required: false, description: "Weight" },
    { name: "position", type: "number", required: false, description: "Position" },
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
    { name: "purpose", type: "string", required: false, description: "Purpose (default custom)" },
    { name: "pass_strategy", type: "string", required: false, description: "all_must_pass | weighted_threshold (default all_must_pass)" },
    { name: "pass_threshold", type: "number", required: false, description: "0-1, used when strategy is weighted_threshold" },
    { name: "is_blocking", type: "boolean", required: false, description: "Blocking suite (default true)" },
    { name: "triggered_by", type: "string", required: false, description: "Who created the suite" },
  ],
};

const updateSuiteSchema: BodySchema = {
  description: "Update suite (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "purpose", type: "string", required: false, description: "Purpose" },
    { name: "pass_strategy", type: "string", required: false, description: "all_must_pass | weighted_threshold" },
    { name: "pass_threshold", type: "number", required: false, description: "Pass threshold 0-1" },
    { name: "is_blocking", type: "boolean", required: false, description: "Blocking suite" },
  ],
};

const addSuiteEntrySchema: BodySchema = {
  description: "Add evaluation to suite",
  fields: [
    { name: "evaluation_id", type: "string", required: true, description: "Eval UUID" },
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
    { name: "trigger_type", type: "string", required: false, description: "manual | ci | ... (default manual)" },
    { name: "suite_path", type: "string", required: false, description: "Suite YAML path (git-backed)" },
    {
      name: "run_inputs",
      type: "object",
      required: false,
      description: "RunInputs: { model_id?, target_id?, dataset_id?, metric_set_id?, variables? }",
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
  description: "Create target",
  fields: [
    { name: "name", type: "string", required: true, description: "Name" },
    { name: "type", type: "string", required: true, description: "prompt | app | static" },
    { name: "config", type: "object", required: true, description: "Target config (PromptTargetConfig | AppTargetConfig | StaticTargetConfig)" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "is_active", type: "boolean", required: false, description: "Active (default true)" },
    { name: "env_secrets", type: "object", required: false, description: "Env var to Harness secret ref mapping" },
  ],
};

const updateTargetSchema: BodySchema = {
  description: "Update target (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "config", type: "object", required: false, description: "Config" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "is_active", type: "boolean", required: false, description: "Active" },
    { name: "env_secrets", type: "object", required: false, description: "Env var to Harness secret ref mapping" },
  ],
};

const testTargetSchema: BodySchema = {
  description: "Test target invocation",
  fields: [{ name: "input", type: "string", required: true, description: "Sample input string" }],
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

const createModelSchema: BodySchema = {
  description: "Register AI model",
  fields: [
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "provider", type: "string", required: true, description: "openai | anthropic | ..." },
    { name: "model_id", type: "string", required: true, description: "Provider model id" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "api_key_secret_ref", type: "string", required: false, description: "Harness secret ref for API key" },
    { name: "default_temperature", type: "number", required: false, description: "Default temperature 0-2" },
    { name: "default_max_tokens", type: "number", required: false, description: "Default max tokens (min 1)" },
    { name: "default_top_p", type: "number", required: false, description: "Default top_p 0-1" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "provider_config", type: "object", required: false, description: "Provider-specific config" },
    { name: "is_active", type: "boolean", required: false, description: "Active (default true)" },
  ],
};

const updateModelSchema: BodySchema = {
  description: "Update model (PATCH)",
  fields: [
    { name: "name", type: "string", required: false, description: "Name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "default_temperature", type: "number", required: false, description: "Temperature 0-2" },
    { name: "default_max_tokens", type: "number", required: false, description: "Max tokens (min 1)" },
    { name: "default_top_p", type: "number", required: false, description: "Top_p 0-1" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "provider_config", type: "object", required: false, description: "Provider-specific config" },
    { name: "is_active", type: "boolean", required: false, description: "Active" },
  ],
};

const createAnnotationSchema: BodySchema = {
  description: "Create annotation",
  fields: [
    { name: "trace_id", type: "string", required: true, description: "Trace id" },
    { name: "span_id", type: "string", required: false, description: "Span id" },
    { name: "label", type: "string", required: false, description: "Label" },
    { name: "score", type: "number", required: false, description: "Score 0-1" },
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

const createRunItemsSchema: BodySchema = {
  description: "Append run items",
  fields: [{ name: "items", type: "array", required: true, description: "Run item payloads", itemType: "object" }],
};

const generateDatasetItemsSchema: BodySchema = {
  description: "Generate synthetic dataset items using an LLM (async via pipeline)",
  fields: [
    {
      name: "strategy",
      type: "string",
      required: true,
      description: "Generation strategy: use_case | rephrase | adversarial | complexity_ladder",
    },
    { name: "count", type: "number", required: true, description: "Number of items to generate (1-200)" },
    { name: "model_id", type: "string", required: true, description: "UUID of registered AI model" },
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
  optIn: true,
  resources: [
    // --- Datasets ---
    {
      resourceType: "eval_dataset",
      displayName: "AI Evals Dataset",
      description: "Evaluation dataset (JSONL-backed rows). CRUD + items sub-resource via eval_dataset_item.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["dataset_id"],
      listFilterFields: [],
      relatedResources: [
        { resourceType: "eval_dataset_item", relationship: "contains", description: "Dataset rows" },
        { resourceType: "evaluation", relationship: "uses", description: "Evals reference datasets" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset`,
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List datasets",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset/${input.dataset_id as string}`,
          responseExtractor: passthrough,
          description: "Get dataset by UUID",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createDatasetSchema,
          responseExtractor: passthrough,
          description: "Create dataset",
        },
        update: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset/${input.dataset_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateDatasetSchema,
          responseExtractor: passthrough,
          description: "Update dataset",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/dataset/${input.dataset_id as string}`,
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
          responseExtractor: passthrough,
          actionDescription:
            "Get dataset by its unique identifier slug (not UUID). Pass identifier via params.identifier.",
          bodySchema: { description: "No body", fields: [] },
        },
        export: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/export`,
          queryParams: { format: "format" },
          defaultQueryParams: { format: "jsonl" },
          responseExtractor: passthrough,
          actionDescription:
            "Export dataset as JSONL (harness-evals Golden format). Returns newline-delimited JSON.",
          bodySchema: { description: "No body", fields: [] },
        },
        generate: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/generate`,
          bodyBuilder: bodyFromInput,
          bodySchema: generateDatasetItemsSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Generate synthetic dataset items using an LLM (async). " +
            "Strategies: use_case (from description), rephrase (from seed_inputs), adversarial, complexity_ladder. " +
            "Returns job_id — poll with poll_generate action.",
        },
        poll_generate: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/generate/${input.job_id as string}`,
          responseExtractor: passthrough,
          actionDescription:
            "Poll generation job status. Pass dataset_id and job_id (from generate action response).",
          bodySchema: { description: "No body", fields: [] },
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
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List items (filters.dataset_id required)",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items/${input.item_id as string}`,
          responseExtractor: passthrough,
          description: "Get item by UUID",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/items`,
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
          responseExtractor: passthrough,
          description: "Delete item",
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
      listFilterFields: [
        {
          name: "status",
          description: "Filter by status",
          enum: ["active", "draft", "archived"],
        },
      ],
      executeHint: "Run an eval with harness_execute(resource_type='evaluation', action='run', resource_id=EVAL_ID, body={...}).",
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals`,
          queryParams: { ...listQ, status: "status" },
          responseExtractor: aiEvalsListExtract,
          description: "List evals",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/${input.eval_id as string}`,
          responseExtractor: passthrough,
          description: "Get eval",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createEvalSchema,
          responseExtractor: passthrough,
          description: "Create eval",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/${input.eval_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateEvalSchema,
          responseExtractor: passthrough,
          description: "Update eval",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/${input.eval_id as string}`,
          responseExtractor: passthrough,
          description: "Soft-delete (archive) eval",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/evals/${input.eval_id as string}/run`,
          bodyBuilder: bodyFromInput,
          bodySchema: triggerEvalRunSchema,
          responseExtractor: passthrough,
          actionDescription: "Trigger an eval run (pipeline or CLI). Pass optional overrides in body.",
        },
        import_yaml: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/import-yaml`,
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
      description: "A single evaluation run. Compare runs or rescore via execute actions.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["run_id"],
      listFilterFields: [
        { name: "eval_id", description: "Filter runs by evaluation UUID" },
        { name: "status", description: "Filter by run status" },
      ],
      relatedResources: [
        { resourceType: "eval_run_item", relationship: "contains", description: "Per-item results" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs`,
          queryParams: { ...listQ, eval_id: "eval_id", status: "status" },
          responseExtractor: aiEvalsListExtract,
          description: "List runs in project (filterable by eval_id, status)",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}`,
          responseExtractor: passthrough,
          description: "Get run",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createRunSchema,
          responseExtractor: passthrough,
          description: "Create run record",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateRunSchema,
          responseExtractor: passthrough,
          description: "Update run",
        },
      },
      executeActions: {
        compare: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/compare`,
          queryParams: { run_ids: "run_ids" },
          responseExtractor: passthrough,
          actionDescription:
            "Compare 2–10 runs. Pass run_ids as comma-separated UUIDs (params.run_ids or input.run_ids). No request body.",
        },
        rescore: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}/rescore`,
          bodyBuilder: bodyFromInput,
          bodySchema: rescoreSchema,
          responseExtractor: passthrough,
          actionDescription: "Create a new run rescored with a different metric set",
        },
        post_scores: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}/scores`,
          bodyBuilder: bodyFromInput,
          bodySchema: postScoresSchema,
          responseExtractor: passthrough,
          actionDescription: "Ingest scores from harness-evals HarnessSink",
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
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List run items",
        },
      },
      executeActions: {
        append_items: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/runs/${input.run_id as string}/items`,
          bodyBuilder: bodyFromInput,
          bodySchema: createRunItemsSchema,
          responseExtractor: passthrough,
          actionDescription: "Append run item results (HarnessSink / batch)",
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
      description: "Custom or builtin metric definitions.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["metric_id"],
      listFilterFields: [{ name: "type", description: "Filter by metric type (e.g. heuristic, llm)" }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics`,
          queryParams: { ...listQ, type: "type" },
          responseExtractor: aiEvalsListExtract,
          description: "List metrics",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/${input.metric_id as string}`,
          responseExtractor: passthrough,
          description: "Get metric",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createMetricSchema,
          responseExtractor: passthrough,
          description: "Create custom metric",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/${input.metric_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateMetricSchema,
          responseExtractor: passthrough,
          description: "Update metric",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/${input.metric_id as string}`,
          responseExtractor: passthrough,
          description: "Delete metric",
        },
      },
      executeActions: {
        suggestions: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metrics/suggestions`,
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
      description: "Grouped metrics with thresholds. Manage entries via eval_metric_set_entry.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["set_id"],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets`,
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List metric sets",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets/${input.set_id as string}`,
          responseExtractor: passthrough,
          description: "Get metric set",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createMetricSetSchema,
          responseExtractor: passthrough,
          description: "Create metric set",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets/${input.set_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateMetricSetSchema,
          responseExtractor: passthrough,
          description: "Update metric set",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/metric-sets/${input.set_id as string}`,
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
      listFilterFields: [{ name: "set_id", description: "Metric set UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics`,
          responseExtractor: aiEvalsArrayExtract,
          description: "List entries in a metric set",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/metric-sets/${input.set_id as string}/metrics`,
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
          responseExtractor: passthrough,
          description: "Remove metric from set",
        },
      },
    },
    // --- Suites ---
    {
      resourceType: "eval_suite",
      displayName: "AI Evals Suite",
      description: "Multi-eval suite with pass strategy. Members: eval_suite_evaluation.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["suite_id"],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites`,
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List suites",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/${input.suite_id as string}`,
          responseExtractor: passthrough,
          description: "Get suite",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createSuiteSchema,
          responseExtractor: passthrough,
          description: "Create suite",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/${input.suite_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateSuiteSchema,
          responseExtractor: passthrough,
          description: "Update suite",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/${input.suite_id as string}`,
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
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: replaceSuiteEntriesSchema,
          responseExtractor: aiEvalsArrayExtract,
          actionDescription: "Replace ordered suite members (body.entries)",
        },
        import_yaml: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/import-yaml`,
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
      listFilterFields: [{ name: "suite_id", description: "Suite UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/evaluations`,
          responseExtractor: aiEvalsArrayExtract,
          description: "List suite members",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/evaluations`,
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
          responseExtractor: passthrough,
          description: "Remove evaluation from suite",
        },
      },
    },
    {
      resourceType: "eval_suite_run",
      displayName: "AI Evals Suite Run",
      description: "Suite execution. List by suite; get by suite_run_id.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["suite_run_id"],
      listFilterFields: [{ name: "suite_id", description: "Suite UUID", required: true }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suites/${input.suite_id as string}/runs`,
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          description: "List suite runs for a suite",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/suite-runs/${input.suite_run_id as string}`,
          responseExtractor: passthrough,
          description: "Get suite run status",
        },
      },
    },
    // --- Targets & models ---
    {
      resourceType: "eval_target",
      displayName: "AI Evals Target",
      description: "Invocation target (prompt, app, or static).",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["target_id"],
      listFilterFields: [{ name: "type", description: "prompt | app | static" }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets`,
          queryParams: { ...listQ, type: "type" },
          responseExtractor: aiEvalsListExtract,
          description: "List targets",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets/${input.target_id as string}`,
          responseExtractor: passthrough,
          description: "Get target",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createTargetSchema,
          responseExtractor: passthrough,
          description: "Create target",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets/${input.target_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateTargetSchema,
          responseExtractor: passthrough,
          description: "Update target",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/targets/${input.target_id as string}`,
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
          queryParams: listQ,
          responseExtractor: aiEvalsListExtract,
          actionDescription: "List uploaded static target outputs (paginated).",
          bodySchema: { description: "No body", fields: [] },
        },
      },
    },
    {
      resourceType: "eval_model",
      displayName: "AI Evals Model",
      description: "Registered LLM model for eval runs.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["model_id"],
      listFilterFields: [{ name: "active_only", description: "Only active models", type: "boolean" }],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models`,
          queryParams: { ...listQ, active_only: "active_only" },
          responseExtractor: aiEvalsListExtract,
          description: "List models",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models/${input.model_id as string}`,
          responseExtractor: passthrough,
          description: "Get model",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createModelSchema,
          responseExtractor: passthrough,
          description: "Register model",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models/${input.model_id as string}`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateModelSchema,
          responseExtractor: passthrough,
          description: "Update model",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models/${input.model_id as string}`,
          responseExtractor: passthrough,
          description: "Delete model",
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
          responseExtractor: passthrough,
          description: "Get annotation",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/observe/annotations`,
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
          responseExtractor: passthrough,
          description: "Delete annotation",
        },
      },
      executeActions: {
        histogram: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/observe/annotations/histogram`,
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
          responseExtractor: passthrough,
          description: "Get git sync settings (resource_id ignored)",
        },
        update: {
          method: "PUT",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/settings/git`,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: upsertGitSettingsSchema,
          responseExtractor: passthrough,
          description: "Upsert git settings",
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
          queryParams: { ...listQ, type: "type" },
          responseExtractor: aiEvalsListExtract,
          description: "List registry items",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/registry/${input.item_id as string}`,
          queryParams: { type: "type" },
          responseExtractor: passthrough,
          description: "Get registry item (optional type query)",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/registry`,
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
          queryParams: { type: "type" },
          responseExtractor: passthrough,
          description: "Delete registry item",
        },
      },
    },
  ],
};
