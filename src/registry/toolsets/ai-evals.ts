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
    { name: "expected_output", type: "object", required: false, description: "Expected output" },
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
    { name: "expected_output", type: "object", required: false, description: "Expected output" },
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
  description: "Create evaluation (draft until dataset, target, and metric_set are set)",
  fields: [
    { name: "name", type: "string", required: true, description: "Eval name" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "tags", type: "array", required: false, description: "Tags", itemType: "string" },
    { name: "dataset_id", type: "string", required: false, description: "Dataset UUID (list with harness_list resource_type=eval_dataset)" },
    { name: "target_id", type: "string", required: false, description: "Target UUID (list with harness_list resource_type=eval_target)" },
    { name: "metric_set_id", type: "string", required: false, description: "Metric set UUID (list with harness_list resource_type=eval_metric_set)" },
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
      description: "RunInputs overrides: { model_id?, target_id?, dataset_id?, metric_set_id?, variables? }",
    },
    { name: "input_set_id", type: "string", required: false, description: "Saved input set id" },
    { name: "branch", type: "string", required: false, description: "Override git branch (e.g. run against a PR branch)" },
  ],
};


const rescoreSchema: BodySchema = {
  description: "Rescore with a different metric set",
  fields: [{ name: "metric_set_id", type: "string", required: true, description: "Metric set UUID" }],
};


const createMetricSchema: BodySchema = {
  description: "Create custom metric",
  fields: [
    { name: "name", type: "string", required: true, description: "Metric name" },
    { name: "type", type: "string", required: true, description: "heuristic | llm | embedding | code | composite" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "kind", type: "string", required: false, description: "harness-evals metric kind identifier (e.g. exact_match, contains, levenshtein, json_diff, latency, rubric_judge, geval)" },
    {
      name: "config",
      type: "object",
      required: false,
      description:
        "Metric config — structure depends on type/kind. " +
        "Heuristic: { kind, threshold?, case_sensitive?, ... }. " +
        "LLM: { rubric?, criteria?, judge_model_id? (eval_model UUID) }. " +
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
    { name: "judge_model_id", type: "string", required: false, description: "Default judge model UUID for LLM metrics (list with harness_list resource_type=eval_model)" },
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
    { name: "judge_model_id", type: "string", required: false, description: "Default judge model UUID for LLM metrics (list with harness_list resource_type=eval_model)" },
  ],
};

const addMetricSetEntrySchema: BodySchema = {
  description: "Add metric to set",
  fields: [
    { name: "metric_id", type: "string", required: true, description: "Metric UUID (list with harness_list resource_type=eval_metric)" },
    { name: "threshold", type: "number", required: true, description: "Pass threshold 0-1" },
    { name: "weight", type: "number", required: false, description: "Weight" },
    { name: "position", type: "number", required: false, description: "Order" },
    { name: "config", type: "object", required: false, description: "Per-use-site config override (merged over metric's base config at eval time)" },
  ],
};

const updateMetricSetEntrySchema: BodySchema = {
  description: "Update metric set entry (PATCH)",
  fields: [
    { name: "threshold", type: "number", required: false, description: "Threshold" },
    { name: "weight", type: "number", required: false, description: "Weight" },
    { name: "position", type: "number", required: false, description: "Position" },
    { name: "config", type: "object", required: false, description: "Per-use-site config override (merged over metric's base config at eval time)" },
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
        "For type='prompt': { model_id: '<eval_model UUID — list with harness_list resource_type=eval_model>', " +
        "system_message?: string, temperature?: 0-2, max_tokens?: int, top_p?: 0-1, " +
        "frequency_penalty?: -2 to 2, presence_penalty?: -2 to 2 }. " +
        "For type='agent': { endpoint: '<agent HTTP URL>' }. " +
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
        "Target config. For type='prompt': { model_id, system_message?, temperature?, max_tokens?, top_p?, frequency_penalty?, presence_penalty? }. " +
        "For type='agent': { endpoint }. For type='precomputed': { dataset_id?, model_name?, model_version? }.",
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
    { name: "input", type: "string", required: true, description: "Sample input string" },
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

const createModelSchema: BodySchema = {
  description: "Register AI model",
  fields: [
    { name: "name", type: "string", required: true, description: "Display name" },
    { name: "provider", type: "string", required: true, description: "openai | anthropic | google | azure | custom" },
    { name: "model_id", type: "string", required: true, description: "Provider model id" },
    { name: "description", type: "string", required: false, description: "Description" },
    { name: "api_key_secret_ref", type: "string", required: false, description: "Harness secret ref for API key" },
    { name: "connector_ref", type: "string", required: false, description: "Harness connector identifier for LLM credentials" },
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
    { name: "connector_ref", type: "string", required: false, description: "Harness connector identifier for LLM credentials" },
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
    {
      name: "metric_ids",
      type: "array",
      required: false,
      description: "UUIDs of existing metrics to evaluate against (list with harness_list resource_type=eval_metric)",
      itemType: "string",
    },
    {
      name: "metrics",
      type: "array",
      required: false,
      description:
        "Inline metric definitions for ad-hoc evaluation: [{ type: 'heuristic'|'llm', kind?: string, score_name: string, config?: object, threshold?: 0-1 }]. " +
        "At least one of metric_ids or metrics is required.",
      itemType: "object",
    },
    {
      name: "options",
      type: "object",
      required: false,
      description: "Evaluation options: { include_trajectory?: boolean (default false) }",
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
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
        export: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) =>
            `${base(input, config)}/dataset/${input.dataset_id as string}/export`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
        "Create any missing components first. The eval stays in 'draft' status until all three are set, then auto-activates. " +
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
          skipScopeBodyInjection: true,
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: bodyFromInput,
          bodySchema: triggerEvalRunSchema,
          responseExtractor: passthrough,
          actionDescription: "Trigger an eval run (pipeline or CLI). Pass optional overrides in body.",
        },
        import_yaml: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/evals/import-yaml`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
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
        },
        rescore: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/runs/${input.run_id as string}/rescore`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: bodyFromInput,
          bodySchema: rescoreSchema,
          responseExtractor: passthrough,
          actionDescription: "Create a new run rescored with a different metric set",
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
        "Metrics are added to metric sets (eval_metric_set) via eval_metric_set_entry, then referenced by evaluations.",
      relatedResources: [
        { resourceType: "eval_metric_set_entry", relationship: "used_by", description: "Metrics are added to metric sets via entries" },
        { resourceType: "eval_model", relationship: "uses", description: "LLM metrics can reference a judge model via config.judge_model_id" },
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
          skipScopeBodyInjection: true,
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
        "If using LLM metrics (llm-as-judge), set judge_model_id to an eval_model UUID.",
      relatedResources: [
        { resourceType: "eval_metric_set_entry", relationship: "contains", description: "Metric membership entries with thresholds" },
        { resourceType: "eval_metric", relationship: "uses", description: "Entries reference metrics by metric_id" },
        { resourceType: "eval_model", relationship: "uses", description: "Optional judge model for LLM metrics via judge_model_id" },
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
          skipScopeBodyInjection: true,
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: replaceSuiteEntriesSchema,
          responseExtractor: aiEvalsArrayExtract,
          actionDescription: "Replace ordered suite members (body.entries)",
        },
        import_yaml: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/suites/import-yaml`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
      description: "Invocation target (prompt, agent, or precomputed). Prompt targets reference a registered eval_model via config.model_id.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["target_id"],
      diagnosticHint:
        "When creating a prompt target, first list available models with harness_list(resource_type='eval_model') " +
        "so you can reference the correct model_id in config. The config.model_id must be a UUID from an existing eval_model.",
      relatedResources: [
        { resourceType: "eval_model", relationship: "uses", description: "Prompt targets reference a model via config.model_id" },
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
          skipScopeBodyInjection: true,
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
    {
      resourceType: "eval_model",
      displayName: "AI Evals Model",
      description: "Registered LLM model (provider + model_id + credentials) for eval runs. Prompt targets reference models via config.model_id.",
      toolset: "ai-evals",
      scope: "project",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["model_id"],
      relatedResources: [
        { resourceType: "eval_target", relationship: "used_by", description: "Prompt targets reference models via config.model_id" },
      ],
      listFilterFields: [
        { name: "active_only", description: "Only active models", type: "boolean" },
        { name: "search", description: "Search by name, provider, or model ID" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { ...listQ, active_only: "active_only", search: "search" },
          responseExtractor: aiEvalsListExtract,
          description: "List models",
        },
        get: {
          method: "GET",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models/${input.model_id as string}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get model",
        },
        create: {
          method: "POST",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models`,
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: createModelSchema,
          responseExtractor: passthrough,
          description: "Register model",
        },
        update: {
          method: "PATCH",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models/${input.model_id as string}`,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          bodyBuilder: (input) => input.body ?? {},
          bodySchema: updateModelSchema,
          responseExtractor: passthrough,
          description: "Update model",
        },
        delete: {
          method: "DELETE",
          path: "",
          pathBuilder: (input, config) => `${base(input, config)}/models/${input.model_id as string}`,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
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
          skipScopeBodyInjection: true,
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
        "Evaluate a trace from production observability data. Pass metric_ids (existing metric UUIDs) " +
        "or inline metric definitions via 'metrics'. Results are persisted as annotations (eval_annotation). " +
        "Get trace_id from your observability/tracing system.",
      relatedResources: [
        { resourceType: "eval_metric", relationship: "uses", description: "References metrics by metric_ids" },
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
          skipScopeBodyInjection: true,
          bodyBuilder: bodyFromInput,
          bodySchema: evaluateTraceSchema,
          responseExtractor: passthrough,
          actionDescription:
            "Evaluate a production trace with metrics. Returns scores, summary (pass_rate), and trace metadata. " +
            "Provide at least one of metric_ids or inline metrics.",
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
          skipScopeBodyInjection: true,
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
          skipScopeBodyInjection: true,
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
