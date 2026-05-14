import type { EndpointHandlerContext, ToolsetDefinition, BodySchema } from "../types.js";
import { ngExtract, pageExtract, passthrough, v1ListExtract, runtimeInputExtract } from "../extractors.js";
import { HarnessApiError } from "../../utils/errors.js";
import YAML from "yaml";

type RetryQueryValue = string | number | boolean | string[] | undefined;

const FAILED_RETRY_STATUSES = new Set(["Failed", "Errored", "Aborted"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = getString(input, key);
  if (value) return value;
  throw new Error(`Missing required field "${key}" for pipeline retry_stages.`);
}

function normalizeRetryStages(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const stages: string[] = [];

  for (const item of values) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    stages.push(trimmed);
  }

  return stages;
}

function extractInputSetYaml(raw: unknown): string {
  const root = isRecord(raw) ? raw : {};
  const data = isRecord(root.data) ? root.data : root;
  const inputSetYaml = data.inputSetYaml;

  if (typeof inputSetYaml === "string" && inputSetYaml.length > 0) {
    return inputSetYaml.replace(/\\n/g, "\n");
  }

  throw new Error("Harness did not return inputSetYaml for the execution. Cannot retry stages without the original input YAML.");
}

function assertCanRetry(raw: unknown, executionId: string): void {
  if (raw === false) {
    throw new Error(`Execution "${executionId}" is not retryable according to Harness canRetry.`);
  }
  const root = isRecord(raw) ? raw : {};
  const data = root.data;

  if (data === false) {
    throw new Error(`Execution "${executionId}" is not retryable according to Harness canRetry.`);
  }
  if (isRecord(data) && data.canRetry === false) {
    throw new Error(`Execution "${executionId}" is not retryable according to Harness canRetry.`);
  }
}

function addStageId(stages: string[], seen: Set<string>, stageId: unknown): void {
  if (typeof stageId !== "string") return;
  const trimmed = stageId.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  stages.push(trimmed);
}

function extractStageIdFromFqn(baseFqn: unknown): string | undefined {
  if (typeof baseFqn !== "string") return undefined;
  return baseFqn.match(/\.stages\.([^.]+)(?:\.|$)/)?.[1];
}

function extractFailedStageIds(raw: unknown): string[] {
  const root = isRecord(raw) ? raw : {};
  const data = isRecord(root.data) ? root.data : root;
  const stages: string[] = [];
  const seen = new Set<string>();

  const executionGraph = isRecord(data.executionGraph) ? data.executionGraph : undefined;
  const nodeMap = isRecord(executionGraph?.nodeMap) ? executionGraph.nodeMap : undefined;
  if (nodeMap) {
    for (const node of Object.values(nodeMap)) {
      if (!isRecord(node) || !FAILED_RETRY_STATUSES.has(String(node.status))) continue;

      const stageId = extractStageIdFromFqn(node.baseFqn) ??
        getString(node, "stageIdentifier") ??
        getString(node, "stageId") ??
        (node.nodeGroup === "STAGE" ? getString(node, "identifier") : undefined);
      addStageId(stages, seen, stageId);
    }
  }

  const layoutNodeMap = isRecord(data.layoutNodeMap) ? data.layoutNodeMap : undefined;
  if (layoutNodeMap) {
    for (const node of Object.values(layoutNodeMap)) {
      if (!isRecord(node) || !FAILED_RETRY_STATUSES.has(String(node.status))) continue;
      if (node.nodeGroup !== "STAGE") continue;
      addStageId(stages, seen, getString(node, "nodeIdentifier") ?? getString(node, "identifier"));
    }
  }

  return stages;
}

function inferRetryStageParents(stages: string[]): string[] {
  const seen = new Set<string>();
  const parents: string[] = [];

  for (const stage of stages) {
    const candidate =
      (stage.includes("___name___") ? stage.split("___name___")[0] : undefined) ??
      (stage.split("_").length > 2 ? stage.split("_").slice(0, 2).join("_") : undefined) ??
      stage;

    if (seen.has(candidate)) continue;
    seen.add(candidate);
    parents.push(candidate);
  }

  return parents;
}

function shouldRetryWithParentStages(error: unknown): boolean {
  if (!(error instanceof HarnessApiError) || error.statusCode !== 400) return false;
  return /retryStagesIdentifier could not be found|Run only failed stages is applicable/i.test(error.message);
}

async function retryPipelineStagesHandler({ client, input, config, signal }: EndpointHandlerContext): Promise<unknown> {
  const orgId = getString(input, "org_id") ?? config.HARNESS_ORG;
  const projectId = getString(input, "project_id") ?? config.HARNESS_PROJECT;
  const pipelineId = requiredString(input, "pipeline_id");
  const executionId = requiredString(input, "execution_id");

  if (!orgId) throw new Error("org_id is required for pipeline retry_stages because no HARNESS_ORG default is configured.");
  if (!projectId) throw new Error("project_id is required for pipeline retry_stages because no HARNESS_PROJECT default is configured.");

  const explicitStages = normalizeRetryStages(input.retry_stages);
  const retryFailedStages = getBoolean(input, "retry_failed_stages") ?? false;
  const requestedRunAllStages = getBoolean(input, "run_all_stages");

  if (explicitStages.length > 0 && retryFailedStages) {
    throw new Error("Provide either retry_stages or retry_failed_stages=true, not both.");
  }
  if (requestedRunAllStages === true && retryFailedStages) {
    throw new Error("run_all_stages=true cannot be combined with retry_failed_stages=true. Use retry_stages explicitly for selected stages.");
  }

  const runAllStages = requestedRunAllStages === true;
  if (!runAllStages && explicitStages.length === 0 && !retryFailedStages) {
    throw new Error("Provide retry_stages, retry_failed_stages=true, or run_all_stages=true for pipeline retry_stages.");
  }

  const scopeParams = {
    orgIdentifier: orgId,
    projectIdentifier: projectId,
  };

  const canRetryRaw = await client.request({
    method: "GET",
    path: `/pipeline/api/pipelines/execution/canRetry/${encodeURIComponent(executionId)}`,
    params: scopeParams,
    retryPolicy: "do_not_retry",
    signal,
  });
  assertCanRetry(canRetryRaw, executionId);

  const inputSetRaw = await client.request({
    method: "GET",
    path: `/pipeline/api/pipelines/execution/${encodeURIComponent(executionId)}/inputsetV2`,
    params: {
      ...scopeParams,
      resolveExpressions: false,
      resolveExpressionsType: "RESOLVE_ALL_EXPRESSIONS",
    },
    retryPolicy: "do_not_retry",
    signal,
  });
  const inputSetYaml = extractInputSetYaml(inputSetRaw);

  let retryStages = explicitStages;
  if (retryFailedStages) {
    const executionRaw = await client.request({
      method: "GET",
      path: `/pipeline/api/pipelines/execution/v2/${encodeURIComponent(executionId)}`,
      params: {
        ...scopeParams,
        renderFullBottomGraph: true,
      },
      retryPolicy: "do_not_retry",
      signal,
    });
    retryStages = extractFailedStageIds(executionRaw);
    if (retryStages.length === 0) {
      throw new Error(`No failed stages found for execution "${executionId}". Pass retry_stages explicitly if you know the stage identifiers.`);
    }
  }

  if (retryStages.length === 0 && !runAllStages) {
    throw new Error("retry_stages must resolve to at least one stage when run_all_stages is false.");
  }

  const params: Record<string, RetryQueryValue> = {
    ...scopeParams,
    planExecutionId: executionId,
    runAllStages,
    moduleType: getString(input, "module_type") ?? getString(input, "module") ?? "string",
    notesForPipelineExecution: getString(input, "notes") ?? "",
  };
  if (retryStages.length > 0) {
    params.retryStages = retryStages;
  }

  const retryPath = `/pipeline/api/pipeline/execute/retry/${encodeURIComponent(pipelineId)}`;
  const sendRetry = (retryParams: Record<string, RetryQueryValue>) => client.request({
    method: "POST",
    path: retryPath,
    params: retryParams,
    body: inputSetYaml,
    headers: { "Content-Type": "application/yaml" },
    retryPolicy: "do_not_retry",
    signal,
  });

  let result: unknown;
  let effectiveStages = retryStages;
  let effectiveRunAllStages = runAllStages;
  let fallbackApplied = false;
  try {
    result = await sendRetry(params);
  } catch (error) {
    const parentStages = inferRetryStageParents(retryStages);
    const canFallback = retryStages.length > 0 &&
      parentStages.length > 0 &&
      shouldRetryWithParentStages(error) &&
      (parentStages.join("\0") !== retryStages.join("\0") || !runAllStages);

    if (!canFallback) throw error;

    effectiveStages = parentStages;
    effectiveRunAllStages = true;
    fallbackApplied = true;
    result = await sendRetry({
      ...params,
      retryStages: parentStages,
      runAllStages: true,
    });
  }

  return {
    ...(isRecord(result) ? result : { result }),
    _retryStages: {
      mode: retryFailedStages ? "failed_stages" : effectiveStages.length > 0 ? "explicit_stages" : "all_stages",
      stages: effectiveStages,
      run_all_stages: effectiveRunAllStages,
      source_execution_id: executionId,
      fallback_applied: fallbackApplied,
    },
  };
}

/**
 * Normalize a trigger body into the canonical `{ trigger: { ... } }` shape,
 * hoist `pipelineIdentifier` onto `input.pipeline_id` for the query param,
 * and ensure it ends up inside the trigger object for YAML serialization.
 *
 * Handles three caller-provided shapes:
 *  1. Flat:    `{ name, identifier, pipelineIdentifier, ... }`
 *  2. Wrapped: `{ trigger: { ..., pipelineIdentifier } }`
 *  3. Sibling: `{ trigger: { ... }, pipelineIdentifier }`
 */
function normalizeTriggerBody(
  body: Record<string, unknown>,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const hasWrapper = body.trigger && typeof body.trigger === "object";
  const inner = hasWrapper
    ? (body.trigger as Record<string, unknown>)
    : body;

  // Resolve pipelineIdentifier: prefer inner, fall back to root-level sibling
  const pipelineId = (inner.pipelineIdentifier ?? body.pipelineIdentifier) as string | undefined;
  if (pipelineId && !input.pipeline_id) {
    input.pipeline_id = pipelineId;
  }

  if (hasWrapper) {
    // Sibling shape: merge pipelineIdentifier into the trigger object and drop from root
    if (!inner.pipelineIdentifier && pipelineId) {
      inner.pipelineIdentifier = pipelineId;
    }
    delete body.pipelineIdentifier;
    return body;
  }
  // Flat shape: auto-wrap
  return { trigger: body };
}

// ---------------------------------------------------------------------------
// V1 Pipeline body schemas and helpers
// ---------------------------------------------------------------------------

const pipelineV1CreateSchema: BodySchema = {
  description: "V1 pipeline definition. Pass pipeline_yaml (YAML string of the v1 pipeline definition), identifier, and name. The version field defaults to '1'. Alternatively, pass a raw YAML string as body — identifier and name will be extracted from the YAML. You can also pass {pipeline: {...}} as a JSON object which will be serialized to YAML automatically.",
  fields: [
    { name: "pipeline_yaml", type: "string", required: true, description: "Pipeline YAML string (the v1 pipeline definition including 'pipeline:' root key)" },
    { name: "identifier", type: "string", required: true, description: "Unique pipeline identifier" },
    { name: "name", type: "string", required: true, description: "Pipeline display name" },
    { name: "version", type: "string", required: false, description: "Pipeline version. Defaults to '1' for v1 pipelines" },
    { name: "description", type: "string", required: false, description: "Pipeline description" },
    { name: "tags", type: "object", required: false, description: "Pipeline tags as key:value pairs" },
  ],
};

const pipelineV1UpdateSchema: BodySchema = {
  description: "V1 pipeline definition (full replacement). Same fields as create: pipeline_yaml, identifier, name, version. Pass a raw YAML string as body, or {pipeline_yaml, identifier, name} as JSON.",
  fields: [
    { name: "pipeline_yaml", type: "string", required: true, description: "Pipeline YAML string (full replacement)" },
    { name: "identifier", type: "string", required: true, description: "Pipeline identifier" },
    { name: "name", type: "string", required: true, description: "Pipeline display name" },
    { name: "version", type: "string", required: false, description: "Pipeline version. Defaults to '1'" },
    { name: "description", type: "string", required: false, description: "Pipeline description" },
    { name: "tags", type: "object", required: false, description: "Pipeline tags as key:value pairs" },
  ],
};

/**
 * Build the v1 JSON body for pipeline create/update.
 * Accepts flexible input:
 *   - Raw YAML string → pipeline_yaml, extracts identifier/name from YAML
 *   - Object with pipeline_yaml → use directly
 *   - Object with yamlPipeline → map to pipeline_yaml (backwards compat)
 *   - Object with pipeline (JSON) → YAML.stringify into pipeline_yaml
 */
function buildV1PipelineBody(input: Record<string, unknown>): Record<string, unknown> {
  const b = input.body as Record<string, unknown> | string | undefined;
  if (!b) throw new Error("body is required for v1 pipeline create/update");

  let pipelineYaml: string;
  let identifier: string | undefined;
  let name: string | undefined;
  let description: string | undefined;
  let tags: unknown | undefined;
  let version = "1";

  if (typeof b === "string") {
    pipelineYaml = b;
  } else {
    const obj = b;
    if (typeof obj.pipeline_yaml === "string") {
      pipelineYaml = obj.pipeline_yaml;
    } else if (typeof obj.yamlPipeline === "string") {
      pipelineYaml = obj.yamlPipeline;
    } else if (obj.pipeline !== undefined && typeof obj.pipeline === "object") {
      pipelineYaml = YAML.stringify({ pipeline: obj.pipeline });
    } else {
      // Assume the object itself describes the pipeline content
      pipelineYaml = YAML.stringify({ pipeline: b });
    }
    identifier = obj.identifier as string | undefined;
    name = obj.name as string | undefined;
    description = obj.description as string | undefined;
    tags = obj.tags;
    if (typeof obj.version === "string") version = obj.version;
  }

  // Extract identifier/name from YAML when not provided at top level
  if (!identifier || !name) {
    try {
      const parsed = YAML.parse(pipelineYaml);
      const p = parsed?.pipeline ?? parsed;
      if (!identifier && p?.identifier) identifier = p.identifier;
      if (!name && p?.name) name = p.name;
    } catch { /* non-critical — caller can provide identifier/name explicitly */ }
  }

  const result: Record<string, unknown> = {
    pipeline_yaml: pipelineYaml,
    identifier,
    name,
    version,
  };
  if (description) result.description = description;
  if (tags) result.tags = tags;
  return result;
}

// ---------------------------------------------------------------------------
// V0 Pipeline body schemas
// ---------------------------------------------------------------------------

const pipelineCreateSchema: BodySchema = {
  description: "Pipeline definition. Three options: (1) Pass body as a raw YAML string directly (simplest for complex pipelines with shell scripts, JEXL, special chars). (2) Pass {yamlPipeline: '<yaml string>'} for YAML inside an object. (3) Pass {pipeline: {...}} as JSON object. Storage options via params: Inline (default), External Git (store_type='REMOTE', connector_ref, repo_name, branch, file_path), Harness Code (store_type='REMOTE', is_harness_code_repo=true, repo_name, branch, file_path).",
  fields: [
    { name: "yamlPipeline", type: "string", required: false, description: "Full pipeline YAML string including the 'pipeline:' root. Alternative: pass the YAML string directly as body (not wrapped in an object)." },
    { name: "pipeline", type: "object", required: false, description: "Pipeline as JSON object (name, identifier, stages, etc.). Use YAML string instead for complex pipelines to avoid serialization issues.", fields: [
      { name: "name", type: "string", required: true, description: "Pipeline display name" },
      { name: "identifier", type: "string", required: true, description: "Unique pipeline identifier" },
      { name: "stages", type: "array", required: false, description: "Pipeline stages", itemType: "stage object" },
    ]},
  ],
};

const pipelineUpdateSchema: BodySchema = {
  description: "Pipeline YAML definition (full replacement). Three options: (1) Pass body as a raw YAML string directly (recommended for complex pipelines). (2) Pass {yamlPipeline: '<yaml>'} for YAML inside an object. (3) Pass {pipeline: {...}} as JSON. For remote pipelines, pass store_type='REMOTE' with git details via params. Include last_object_id and last_commit_id from the GET response for conflict detection.",
  fields: [
    { name: "pipeline", type: "object", required: false, description: "Complete pipeline as JSON object (replaces existing)" },
    { name: "yamlPipeline", type: "string", required: false, description: "Complete pipeline as YAML string (replaces existing). Alternative: pass the YAML string directly as body (not wrapped in an object)." },
  ],
};

const inputSetCreateSchema: BodySchema = {
  description: "Input set definition. Three options: (1) Pass body as a raw YAML string directly (recommended). (2) Pass {yamlInputSet: '<yaml string>'} for YAML inside an object. (3) Pass {inputSet: {...}} as JSON object. Requires pipeline_id in params or filters.",
  fields: [
    { name: "yamlInputSet", type: "string", required: false, description: "Full input set YAML string including the 'inputSet:' root. Alternative: pass the YAML string directly as body." },
    { name: "inputSet", type: "object", required: false, description: "Input set as JSON object.", fields: [
      { name: "name", type: "string", required: true, description: "Input set display name" },
      { name: "identifier", type: "string", required: true, description: "Unique input set identifier" },
      { name: "pipeline", type: "object", required: true, description: "Pipeline runtime input values" },
    ]},
  ],
};

const inputSetUpdateSchema: BodySchema = {
  description: "Input set definition (full replacement). Three options: (1) Pass body as a raw YAML string directly (recommended). (2) Pass {yamlInputSet: '<yaml>'} for YAML inside an object. (3) Pass {inputSet: {...}} as JSON. For remote input sets, pass store_type='REMOTE' with git details via params. Include last_object_id and last_commit_id from the GET response for conflict detection.",
  fields: [
    { name: "yamlInputSet", type: "string", required: false, description: "Full input set YAML string (replaces existing). Alternative: pass the YAML string directly as body." },
    { name: "inputSet", type: "object", required: false, description: "Complete input set as JSON object (replaces existing)" },
  ],
};

export const pipelinesToolset: ToolsetDefinition = {
  name: "pipelines",
  displayName: "Pipelines",
  description: "CI/CD pipelines, executions, triggers, input sets, and approvals",
  resources: [
    {
      resourceType: "pipeline",
      displayName: "Pipeline",
      description: "CI/CD pipeline definition. Supports list, get, create, update, delete, execute (run), legacy retry, and selective stage retry.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id"],
      diagnosticHint: "Use harness_diagnose with pipeline_id or execution_id to analyze failures — includes step-level error details, log snippets, delegate info, and chained pipeline traversal.",
      executeHint: "Before executing, check required inputs: harness_get(resource_type='runtime_input_template', resource_id='PIPELINE_ID'). For simple variables, pass key-value pairs in inputs. For CI pipelines with codebase: pass {branch: 'main'}, {tag: 'v1.0'}, {pr_number: '42'}, or {commit_sha: 'abc123'} — auto-expanded to the full build structure. For complex template inputs, use input_set_ids — list available sets with harness_list(resource_type='input_set', filters={pipeline_id: '...'}). To retry only failed/specific stages, use action='retry_stages' with params.execution_id and params.retry_stages or params.retry_failed_stages=true; action='retry' is the legacy whole-execution retry.",
      listFilterFields: [
        { name: "search_term", description: "Filter pipelines by name or keyword" },
        { name: "module", description: "Harness module filter", enum: ["CD", "CI", "CV", "CF", "CE", "STO"] },
        { name: "filter_type", description: "Filter type qualifier" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/pipeline-studio",
      operations: {
        list: {
          method: "POST",
          path: "/pipeline/api/pipelines/list",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            module: "module",
            page: "page",
            size: "size",
          },
          bodyBuilder: (input) => ({
            filterType: input.filter_type ?? "PipelineSetup",
          }),
          responseExtractor: pageExtract,
          description: "List all pipelines in a project",
        },
        get: {
          method: "GET",
          path: "/pipeline/api/pipelines/{pipelineIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { pipeline_id: "pipelineIdentifier" },
          queryParams: {
            branch: "branch",
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
          },
          responseExtractor: ngExtract,
          description: "Get pipeline details including YAML definition. For remote/git-backed pipelines, pass branch to specify which branch to read from.",
        },
        create: {
          method: "POST",
          path: "/pipeline/api/pipelines/v2",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          headers: { "Content-Type": "application/yaml" },
          queryParams: {
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            base_branch: "baseBranch",
            commit_msg: "commitMsg",
            is_new_branch: "isNewBranch",
            is_harness_code_repo: "isHarnessCodeRepo",
          },
          bodyBuilder: (input) => {
            const b = input.body;
            if (typeof b === "string") {
              return b;
            }
            if (b && typeof b === "object") {
              const obj = b as Record<string, unknown>;
              if (typeof obj.yamlPipeline === "string") return obj.yamlPipeline;
              if (obj.pipeline !== undefined) return b;
            }
            throw new Error("body must be a YAML string, or an object with yamlPipeline (YAML string) or pipeline (JSON object)");
          },
          responseExtractor: ngExtract,
          description: "Create a new pipeline from YAML. For external Git: store_type='REMOTE' + connector_ref, repo_name, branch, file_path. For Harness Code: store_type='REMOTE' + is_harness_code_repo=true, repo_name, branch, file_path.",
          bodySchema: pipelineCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/pipeline/api/pipelines/v2/{pipelineIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { pipeline_id: "pipelineIdentifier" },
          headers: { "Content-Type": "application/yaml" },
          queryParams: {
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            base_branch: "baseBranch",
            commit_msg: "commitMsg",
            is_new_branch: "isNewBranch",
            is_harness_code_repo: "isHarnessCodeRepo",
            last_object_id: "lastObjectId",
            last_commit_id: "lastCommitId",
          },
          bodyBuilder: (input) => {
            const b = input.body;
            if (typeof b === "string") {
              return b;
            }
            if (b && typeof b === "object") {
              const obj = b as Record<string, unknown>;
              if (typeof obj.yamlPipeline === "string") return obj.yamlPipeline;
              if (obj.pipeline !== undefined) return b;
            }
            throw new Error("body must be a YAML string, or an object with yamlPipeline (YAML string) or pipeline (JSON object)");
          },
          responseExtractor: ngExtract,
          description: "Update an existing pipeline YAML. For remote pipelines, pass store_type='REMOTE' with git details and last_object_id/last_commit_id from the GET response. For Harness Code: add is_harness_code_repo=true (no connector_ref needed).",
          bodySchema: pipelineUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/pipeline/api/pipelines/{pipelineIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { pipeline_id: "pipelineIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a pipeline",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/pipeline/api/pipeline/execute/{pipelineIdentifier}",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { pipeline_id: "pipelineIdentifier" },
          queryParams: {
            module: "module",
            input_set_ids: "inputSetIdentifiers",
            branch: "branch",
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
          },
          headers: { "Content-Type": "application/yaml" },
          bodyBuilder: (input) => {
            const inputs = input.inputs;
            // No inline runtime inputs: send empty YAML so Harness applies
            // `inputSetIdentifiers` from the query string. HarnessClient must pass `""`
            // as the fetch body (not omit it) — see serializeRequestBody / hasExplicitBody.
            if (!inputs) return "";
            // Already a YAML string (pre-resolved by execute tool handler or passed directly)
            if (typeof inputs === "string") return inputs;
            // Object — serialize as JSON for the API (full pipeline YAML structure)
            return JSON.stringify(inputs);
          },
          responseExtractor: ngExtract,
          inputExpansions: [
            {
              triggerKey: "branch",
              expand: { build: { type: "branch", spec: { branch: "$value" } } },
              skipIfPresent: "build",
            },
            {
              triggerKey: "tag",
              expand: { build: { type: "tag", spec: { tag: "$value" } } },
              skipIfPresent: "build",
            },
            {
              triggerKey: "pr_number",
              expand: { build: { type: "PR", spec: { number: "$value" } } },
              skipIfPresent: "build",
            },
            {
              triggerKey: "commit_sha",
              expand: { build: { type: "commitSha", spec: { commitSha: "$value" } } },
              skipIfPresent: "build",
            },
          ],
          actionDescription: "Execute/run a pipeline. RECOMMENDED: first check harness_get(resource_type='runtime_input_template', resource_id='PIPELINE_ID') to see required inputs. For simple variable inputs: pass key-value pairs in inputs (e.g. {branch: 'main'}) — auto-resolved. For CI pipelines with codebase: pass {branch: 'main'}, {tag: 'v1.0'}, {pr_number: '42'}, or {commit_sha: 'abc123'} — auto-expanded to the full build structure. For complex pipelines with template inputs: use input_set_ids to reference a saved input set. List available sets with harness_list(resource_type='input_set', filters={pipeline_id: '...'}).",
          bodySchema: {
            description: "Runtime inputs for pipeline execution. For simple variables: pass key-value pairs in inputs like {branch: 'main', env: 'prod'}, auto-resolved against the pipeline's runtime input template. CI codebase shorthands (branch, tag, pr_number, commit_sha) are auto-expanded to full build structures. For complex pipelines with template inputs, use input_set_ids to reference saved input sets. You can combine both: input_set_ids for the base config + inputs for simple overrides. Check runtime_input_template first to see what the pipeline expects.",
            fields: [
              { name: "inputs", type: "yaml", required: false, description: "Key-value pairs (e.g. {branch: 'main', env: 'prod'}) — auto-resolved to full YAML. CI codebase shorthands (branch, tag, pr_number, commit_sha) are auto-expanded. For template inputs, use input_set_ids instead." },
              { name: "input_set_ids", type: "array", required: false, description: "Input set identifiers to apply. Recommended for complex pipelines with template inputs. List available: harness_list(resource_type='input_set', filters={pipeline_id: '...'})." },
            ],
          },
        },
        retry: {
          method: "PUT",
          path: "/pipeline/api/pipeline/execute/retry/{planExecutionId}",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { execution_id: "planExecutionId" },
          queryParams: { module: "module" },
          bodyBuilder: () => ({}),
          responseExtractor: ngExtract,
          actionDescription: "Retry a failed pipeline execution.",
          bodySchema: {
            description: "No request body required. The retry re-executes the failed pipeline execution identified by execution_id.",
            fields: [],
          },
        },
        retry_stages: {
          method: "POST",
          path: "/pipeline/api/pipeline/execute/retry/{pipelineIdentifier}",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { pipeline_id: "pipelineIdentifier" },
          headers: { "Content-Type": "application/yaml" },
          handler: retryPipelineStagesHandler,
          responseExtractor: ngExtract,
          actionDescription: "Retry a previous pipeline execution using the original input set YAML, targeting only specific stages or automatically detected failed stages. Existing action='retry' remains the legacy whole-execution retry. For selective retry, pass params.execution_id plus either params.retry_stages=['stageId'] or params.retry_failed_stages=true. The action calls canRetry, fetches inputsetV2, then POSTs to the Harness retry API with retryStages and runAllStages=false.",
          bodySchema: {
            description: "Selective stage retry parameters. Pass through params, not body: execution_id is the failed plan execution ID; retry_stages is a string or array of stage identifiers; retry_failed_stages=true derives failed stage IDs from execution details; run_all_stages=true intentionally retries all stages with the docs-backed input YAML flow.",
            fields: [
              { name: "execution_id", type: "string", required: true, description: "Failed plan execution ID to retry" },
              { name: "retry_stages", type: "array", required: false, description: "Stage identifier(s) to retry. Use when you know the specific failed/specific stages." },
              { name: "retry_failed_stages", type: "boolean", required: false, description: "Derive failed stages from execution details and retry only those stages." },
              { name: "run_all_stages", type: "boolean", required: false, description: "With retry_stages, retry all stages under the selected retry target instead of only failed stages. Without retry_stages, retry all stages using the original execution input YAML." },
              { name: "notes", type: "string", required: false, description: "Optional note for the retried pipeline execution" },
            ],
          },
        },
        import: {
          method: "POST",
          path: "/pipeline/api/pipelines/import",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: {
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            is_force_import: "isForceImport",
            is_harness_code_repo: "isHarnessCodeRepo",
          },
          bodyBuilder: (input) => {
            const b = input.body as Record<string, unknown> | undefined;
            return {
              pipelineName: b?.pipeline_name ?? b?.pipelineName ?? "",
              pipelineDescription: b?.pipeline_description ?? b?.pipelineDescription ?? "",
            };
          },
          responseExtractor: ngExtract,
          actionDescription: "Import a pipeline from a Git repository into Harness. Fetches the pipeline YAML from the specified repo/branch/path and creates a Harness pipeline record for it. For external Git: provide connector_ref, repo_name, branch, file_path. For Harness Code repos: provide is_harness_code_repo=true, repo_name, branch, file_path (no connector_ref needed). Use is_force_import=true to overwrite if the pipeline already exists.",
          bodySchema: {
            description: "Pipeline import details. Provide the pipeline name and description for the imported pipeline. Git details (connector_ref, repo_name, branch, file_path) go in params.",
            fields: [
              { name: "pipelineName", type: "string", required: true, description: "Display name for the imported pipeline" },
              { name: "pipelineDescription", type: "string", required: false, description: "Description for the imported pipeline" },
            ],
          },
        },
      },
    },
    // ----- V1 Pipeline Resource -----
    {
      resourceType: "pipeline_v1",
      displayName: "Pipeline (V1)",
      description: "V1 pipeline definition using simplified YAML format. Use for agent pipelines and v1 YAML schema. Supports list, get, create, update, delete, and execute (run). V1 pipelines use a flatter YAML structure with direct step types (run, agent, action, approval) instead of v0's nested stage/step wrappers.",
      toolset: "pipelines",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: ["pipeline_id"],
      searchAliases: ["v1 pipeline", "agent pipeline", "v1"],
      diagnosticHint: "Use harness_diagnose with pipeline_id or execution_id to analyze failures. V1 pipelines use the same execution engine as v0.",
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/pipeline-studio",
      operations: {
        list: {
          method: "GET",
          path: "/v1/orgs/{org}/projects/{project}/pipelines",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            search_term: "search_term",
            module: "module",
            page: "page",
            size: "limit",
          },
          responseExtractor: v1ListExtract(),
          description: "List all v1 pipelines in a project",
        },
        get: {
          method: "GET",
          path: "/v1/orgs/{org}/projects/{project}/pipelines/{pipeline}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", pipeline_id: "pipeline" },
          queryParams: {
            branch: "branch_name",
          },
          responseExtractor: passthrough,
          description: "Get v1 pipeline details including YAML definition",
        },
        create: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/pipelines",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { org_id: "org", project_id: "project" },
          bodyBuilder: buildV1PipelineBody,
          responseExtractor: passthrough,
          description: "Create a new v1 pipeline. Pass pipeline_yaml (YAML string), identifier, name. Version defaults to '1'. Alternatively pass a raw YAML string as body.",
          bodySchema: pipelineV1CreateSchema,
        },
        update: {
          method: "PUT",
          path: "/v1/orgs/{org}/projects/{project}/pipelines/{pipeline}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", pipeline_id: "pipeline" },
          bodyBuilder: buildV1PipelineBody,
          responseExtractor: passthrough,
          description: "Update a v1 pipeline (full replacement). Same body format as create.",
          bodySchema: pipelineV1UpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/v1/orgs/{org}/projects/{project}/pipelines/{pipeline}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { org_id: "org", project_id: "project", pipeline_id: "pipeline" },
          responseExtractor: passthrough,
          description: "Delete a v1 pipeline",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/pipelines/{pipeline}/execute",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { org_id: "org", project_id: "project", pipeline_id: "pipeline" },
          queryParams: {
            module: "module",
          },
          bodyBuilder: (input) => {
            const inputs = input.inputs;
            if (!inputs) return {};
            if (typeof inputs === "string") return { inputs_yaml: inputs };
            // Object inputs — serialize to YAML
            return { inputs_yaml: YAML.stringify(inputs) };
          },
          responseExtractor: passthrough,
          actionDescription: "Execute a v1 pipeline. Optionally pass runtime inputs as inputs_yaml (YAML string) or as a key-value object (auto-serialized to YAML).",
          bodySchema: {
            description: "Runtime inputs for v1 pipeline execution. Pass inputs as a YAML string or key-value object.",
            fields: [
              { name: "inputs_yaml", type: "string", required: false, description: "YAML-formatted runtime inputs for the pipeline" },
            ],
          },
        },
      },
    },
    {
      resourceType: "execution",
      displayName: "Pipeline Execution",
      description: "Pipeline execution history and details. Supports list and get.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["execution_id"],
      diagnosticHint: "Use harness_diagnose with execution_id to analyze a failed execution — includes step-level error details, log snippets, delegate info, and chained pipeline traversal.",
      listFilterFields: [
        { name: "search_term", description: "Filter executions by name or keyword" },
        { name: "pipeline_id", description: "Pipeline identifier to filter executions" },
        { name: "status", description: "Execution status filter", enum: ["Success", "Failed", "Running", "Aborted", "Expired", "AbortedByFreeze", "NotStarted", "Paused", "Queued", "Waiting"] },
        { name: "branch", description: "Branch to filter executions" },
        { name: "my_deployments", description: "Show only my deployments", type: "boolean" },
        { name: "module", description: "Harness module filter", enum: ["CD", "CI", "CV", "CF", "CE", "STO"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/deployments/{planExecutionId}/pipeline",
      operations: {
        list: {
          method: "POST",
          path: "/pipeline/api/pipelines/execution/summary",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "searchTerm",
            pipeline_id: "pipelineIdentifier",
            status: "status",
            branch: "branch",
            my_deployments: "myDeployments",
            module: "module",
            page: "page",
            size: "size",
          },
          bodyBuilder: () => ({
            filterType: "PipelineExecution",
          }),
          responseExtractor: pageExtract,
          description: "List pipeline execution history",
        },
        get: {
          method: "GET",
          path: "/pipeline/api/pipelines/execution/v2/{planExecutionId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { execution_id: "planExecutionId" },
          queryParams: { render_full_graph: "renderFullBottomGraph" },
          responseExtractor: ngExtract,
          description: "Get execution details including stage/step status",
        },
      },
      executeActions: {
        interrupt: {
          method: "PUT",
          path: "/pipeline/api/pipeline/execute/interrupt/{planExecutionId}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { execution_id: "planExecutionId" },
          queryParams: { interrupt_type: "interruptType" },
          bodyBuilder: () => ({}),
          bodySchema: { description: "No body required. Interrupt type is specified via the interrupt_type query parameter (IMPORTANT: do not pass this as a body parameter, otherwise the request will fail)", fields: [] },
          responseExtractor: ngExtract,
          actionDescription: "Interrupt a running execution. Pass interrupt_type as a param: AbortAll (abort all stages), Pause, Resume, StageRollback, Abort (abort current retry), ExpireAll, or Retry.",
        },
      },
    },
    {
      resourceType: "trigger",
      displayName: "Pipeline Trigger",
      description: "Automated pipeline triggers (webhook, cron, etc.)",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id", "trigger_id"],
      listFilterFields: [
        { name: "pipeline_id", description: "Pipeline identifier to filter triggers", required: true },
        { name: "search_term", description: "Filter triggers by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipeline_id}/triggers",
      operations: {
        list: {
          method: "GET",
          path: "/pipeline/api/triggers",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            pipeline_id: "targetIdentifier",
            search_term: "searchTerm",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List triggers for a pipeline",
        },
        get: {
          method: "GET",
          path: "/pipeline/api/triggers/{triggerIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { trigger_id: "triggerIdentifier" },
          queryParams: { pipeline_id: "targetIdentifier" },
          responseExtractor: ngExtract,
          description: "Get trigger details",
        },
        create: {
          method: "POST",
          path: "/pipeline/api/triggers",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          queryParams: { pipeline_id: "targetIdentifier" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body) return "";
            const triggerObj = normalizeTriggerBody(body, input);
            return YAML.stringify(triggerObj);
          },
          responseExtractor: ngExtract,
          description: "Create a new pipeline trigger. Requires pipeline_id to identify the target pipeline. Use harness_schema(resource_type='trigger') to discover the body structure.",
          bodySchema: {
            description: "Trigger configuration as JSON — auto-converted to YAML for the API. Pass trigger fields directly (auto-wrapped in trigger envelope). Use harness_schema(resource_type='trigger') for the full schema. The pipeline_id is auto-extracted from pipelineIdentifier in the body.",
            fields: [
              { name: "trigger", type: "object", required: false, description: "Wrapper key (optional — body is auto-wrapped if not present). Inner fields: name (required), identifier (required), enabled (bool), pipelineIdentifier (required — target pipeline), source (required — e.g. { type: 'Scheduled', spec: { type: 'Cron', spec: { expression: '0 8 * * *' } } }), inputYaml (optional — runtime input YAML for triggered execution). Use harness_schema(resource_type='trigger', path='trigger_source') for source structure." },
            ],
          },
        },
        update: {
          method: "PUT",
          path: "/pipeline/api/triggers/{triggerIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { trigger_id: "triggerIdentifier" },
          queryParams: { pipeline_id: "targetIdentifier" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            if (!body) return "";
            const triggerObj = normalizeTriggerBody(body, input);
            return YAML.stringify(triggerObj);
          },
          responseExtractor: ngExtract,
          description: "Update a pipeline trigger. Use harness_schema(resource_type='trigger') to discover the body structure.",
          bodySchema: {
            description: "Full trigger configuration (replaces existing). Pass trigger fields directly — auto-wrapped and converted to YAML. Use harness_schema(resource_type='trigger') for the full schema.",
            fields: [
              { name: "trigger", type: "object", required: false, description: "Wrapper key (optional — body is auto-wrapped if not present). Inner fields: name, identifier, enabled, pipelineIdentifier, source, inputYaml. Use harness_schema for full structure." },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/pipeline/api/triggers/{triggerIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { trigger_id: "triggerIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a pipeline trigger",
        },
      },
    },
    {
      resourceType: "pipeline_summary",
      displayName: "Pipeline Summary",
      description: "Lightweight pipeline summary — less data than full get_pipeline. Supports get only.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/pipeline-studio",
      operations: {
        get: {
          method: "GET",
          path: "/pipeline/api/pipelines/summary/{pipelineIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { pipeline_id: "pipelineIdentifier" },
          responseExtractor: ngExtract,
          description: "Get a lightweight pipeline summary (without full YAML)",
        },
      },
    },
    {
      resourceType: "input_set",
      displayName: "Input Set",
      description: "Reusable runtime input sets for pipelines. Supports list, get, create, update, and delete.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id", "input_set_id"],
      listFilterFields: [
        { name: "pipeline_id", description: "Pipeline identifier to filter input sets", required: true },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipeline_id}/input-sets",
      operations: {
        list: {
          method: "GET",
          path: "/pipeline/api/inputSets",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            pipeline_id: "pipelineIdentifier",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List input sets for a pipeline",
        },
        get: {
          method: "GET",
          path: "/pipeline/api/inputSets/{inputSetIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { input_set_id: "inputSetIdentifier" },
          queryParams: { pipeline_id: "pipelineIdentifier" },
          responseExtractor: ngExtract,
          description: "Get input set details",
        },
        create: {
          method: "POST",
          path: "/pipeline/api/inputSets",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          headers: { "Content-Type": "application/yaml" },
          queryParams: {
            pipeline_id: "pipelineIdentifier",
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            base_branch: "baseBranch",
            file_path: "filePath",
            commit_msg: "commitMsg",
            is_harness_code_repo: "isHarnessCodeRepo",
          },
          bodyBuilder: (input) => {
            const b = input.body;
            if (typeof b === "string") return b;
            if (b && typeof b === "object") {
              const obj = b as Record<string, unknown>;
              if (typeof obj.yamlInputSet === "string") return obj.yamlInputSet;
              if (obj.inputSet !== undefined) return b;
            }
            throw new Error("body must be a YAML string, or an object with yamlInputSet (YAML string) or inputSet (JSON object)");
          },
          responseExtractor: ngExtract,
          description: "Create a new input set for a pipeline. Requires pipeline_id. Pass the input set definition as YAML string (recommended) or as an object with yamlInputSet/inputSet.",
          bodySchema: inputSetCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/pipeline/api/inputSets/{inputSetIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { input_set_id: "inputSetIdentifier" },
          headers: { "Content-Type": "application/yaml" },
          queryParams: {
            pipeline_id: "pipelineIdentifier",
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
            branch: "branch",
            file_path: "filePath",
            base_branch: "baseBranch",
            commit_msg: "commitMsg",
            is_harness_code_repo: "isHarnessCodeRepo",
            last_object_id: "lastObjectId",
            last_commit_id: "lastCommitId",
          },
          bodyBuilder: (input) => {
            const b = input.body;
            if (typeof b === "string") return b;
            if (b && typeof b === "object") {
              const obj = b as Record<string, unknown>;
              if (typeof obj.yamlInputSet === "string") return obj.yamlInputSet;
              if (obj.inputSet !== undefined) return b;
            }
            throw new Error("body must be a YAML string, or an object with yamlInputSet (YAML string) or inputSet (JSON object)");
          },
          responseExtractor: ngExtract,
          description: "Update an existing input set. Requires pipeline_id and input_set_id. For remote input sets, pass store_type='REMOTE' with git details and last_object_id/last_commit_id from the GET response.",
          bodySchema: inputSetUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/pipeline/api/inputSets/{inputSetIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { input_set_id: "inputSetIdentifier" },
          queryParams: {
            pipeline_id: "pipelineIdentifier",
            branch: "branch",
            file_path: "filePath",
            commit_msg: "commitMsg",
            last_object_id: "lastObjectId",
          },
          responseExtractor: ngExtract,
          description: "Delete an input set. Requires pipeline_id and input_set_id. For remote input sets, pass branch and file_path.",
        },
      },
    },
    {
      resourceType: "runtime_input_template",
      displayName: "Runtime Input Template",
      description: "Fetch the runtime input template for a pipeline — shows all `<+input>` placeholders that need values. Use this to discover what runtime inputs a pipeline requires before executing it.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id"],
      operations: {
        get: {
          method: "POST",
          path: "/pipeline/api/inputSets/template",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            pipeline_id: "pipelineIdentifier",
            branch: "branch",
          },
          bodyBuilder: () => ({}),
          responseExtractor: runtimeInputExtract,
          description: "Fetch the runtime input template for a pipeline. Shows all fields that require values at execution time.",
        },
      },
    },
    {
      resourceType: "approval_instance",
      displayName: "Approval Instance",
      description:
        "Pipeline approval instances. List approvals for an execution (filter by status/type), or approve/reject a waiting approval. Use with harness_list to find pending approvals, then harness_execute to approve or reject.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["execution_id"],
      listFilterFields: [
        { name: "execution_id", description: "Pipeline execution ID (required — approvals are scoped to an execution)", required: true },
        { name: "approval_status", description: "Approval status filter", enum: ["WAITING", "APPROVED", "REJECTED", "FAILED", "ABORTED", "EXPIRED"] },
        { name: "approval_type", description: "Approval type filter", enum: ["HarnessApproval", "JiraApproval", "CustomApproval", "ServiceNowApproval"] },
        { name: "node_execution_id", description: "Node execution ID to filter by step" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/pipeline/api/v1/orgs/{org}/projects/{project}/approvals/execution/{executionId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", execution_id: "executionId" },
          queryParams: {
            approval_status: "approval_status",
            approval_type: "approval_type",
            node_execution_id: "node_execution_id",
          },
          responseExtractor: v1ListExtract(),
          description: "List approval instances for a pipeline execution. Filter by approval_status (WAITING, APPROVED, REJECTED, FAILED, ABORTED, EXPIRED) and approval_type (HarnessApproval, JiraApproval, CustomApproval, ServiceNowApproval).",
        },
      },
      executeActions: {
        approve: {
          method: "POST",
          path: "/pipeline/api/approvals/{approvalInstanceId}/harness/activity",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { approval_id: "approvalInstanceId" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            const comments = input.comments ?? body?.comments ?? "";
            const approverInputs = input.approver_inputs ?? body?.approver_inputs;
            return {
              action: "APPROVE",
              comments,
              ...(approverInputs ? { approverInputs } : {}),
            };
          },
          responseExtractor: ngExtract,
          actionDescription: "Approve a Harness approval instance. Requires approval_id. Optional: comments, approver_inputs (array of {name, value}).",
          bodySchema: {
            description: "Approval activity",
            fields: [
              { name: "comments", type: "string", required: false, description: "Approval comment" },
              { name: "approver_inputs", type: "array", required: false, description: "Approver inputs as [{name, value}]" },
            ],
          },
        },
        reject: {
          method: "POST",
          path: "/pipeline/api/approvals/{approvalInstanceId}/harness/activity",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { approval_id: "approvalInstanceId" },
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown> | undefined;
            return {
              action: "REJECT",
              comments: input.comments ?? body?.comments ?? "",
            };
          },
          responseExtractor: ngExtract,
          actionDescription: "Reject a Harness approval instance. Requires approval_id. Optional: comments.",
          bodySchema: {
            description: "Rejection activity",
            fields: [
              { name: "comments", type: "string", required: false, description: "Rejection reason" },
            ],
          },
        },
      },
    },
  ],
};
