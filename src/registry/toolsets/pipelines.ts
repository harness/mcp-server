import type { ToolsetDefinition, BodySchema, ParamsSchema, PreflightContext } from "../types.js";
import { ngExtract, pageExtract, passthrough, v1ListExtract, runtimeInputExtract, runtimeInputTemplatePreflight, pipelineResolvedYamlExtract, executionInputsExtract, dynamicExecutionExtract, triggerListExtract } from "../extractors.js";
import { asRecord } from "../../utils/type-guards.js";
import YAML from "yaml";

function coerceTriggerBodyRecord(body: unknown): Record<string, unknown> {
  if (body == null || body === "") {
    throw new Error("body must be a JSON object or YAML object for trigger.");
  }
  if (typeof body === "string") {
    let parsed: unknown;
    try {
      parsed = YAML.parse(body);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `body must be a JSON object or YAML object for trigger. Failed to parse YAML body: ${detail}`,
      );
    }
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("body must be a JSON object or YAML object for trigger.");
    }
    return parsed as Record<string, unknown>;
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  throw new Error("body must be a JSON object or YAML object for trigger.");
}

/**
 * Normalize a trigger body into the canonical `{ trigger: { ... } }` shape,
 * hoist `pipelineIdentifier` onto `input.pipeline_id` for the query param,
 * and ensure it ends up inside the trigger object for YAML serialization.
 *
 * Handles caller-provided shapes (JSON object or YAML string):
 *  1. Flat:    `{ name, identifier, pipelineIdentifier, ... }`
 *  2. Wrapped: `{ trigger: { ..., pipelineIdentifier } }`
 *  3. Sibling: `{ trigger: { ... }, pipelineIdentifier }`
 */
function normalizeTriggerBody(
  body: unknown,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const record = coerceTriggerBodyRecord(body);
  const hasWrapper = record.trigger && typeof record.trigger === "object";
  const inner = hasWrapper
    ? (record.trigger as Record<string, unknown>)
    : record;

  // Resolve pipelineIdentifier: prefer inner, fall back to root-level sibling
  const pipelineId = (inner.pipelineIdentifier ?? record.pipelineIdentifier) as string | undefined;
  if (pipelineId && !input.pipeline_id) {
    input.pipeline_id = pipelineId;
  }

  if (hasWrapper) {
    // Sibling shape: merge pipelineIdentifier into the trigger object and drop from root
    if (!inner.pipelineIdentifier && pipelineId) {
      inner.pipelineIdentifier = pipelineId;
    }
    delete record.pipelineIdentifier;
    return record;
  }
  // Flat shape: auto-wrap
  return { trigger: record };
}

// ---------------------------------------------------------------------------
// V1 Pipeline body schemas and helpers
// ---------------------------------------------------------------------------

const pipelineV1CreateSchema: BodySchema = {
  description: "V1 pipeline definition. Pass pipeline_yaml (YAML string of the v1 pipeline definition), identifier, and name. The version field defaults to '1'. Alternatively, pass a raw YAML string as body — identifier (from pipeline.identifier or v1 pipeline.id) and name will be extracted from the YAML. You can also pass {pipeline: {...}} as a JSON object which will be serialized to YAML automatically. For remote/Git-backed pipelines, pass Git Experience fields via params (store_type, repo_name, branch, file_path, connector_ref) or body.git_details — they are sent in the JSON body, not as query params.",
  fields: [
    { name: "pipeline_yaml", type: "string", required: true, description: "Pipeline YAML string (the v1 pipeline definition including 'pipeline:' root key)" },
    { name: "identifier", type: "string", required: true, description: "Unique pipeline identifier" },
    { name: "name", type: "string", required: true, description: "Pipeline display name" },
    { name: "version", type: "string", required: false, description: "Pipeline version. Defaults to '1' for v1 pipelines" },
    { name: "description", type: "string", required: false, description: "Pipeline description" },
    { name: "tags", type: "object", required: false, description: "Pipeline tags as key:value pairs" },
    { name: "git_details", type: "object", required: false, description: "Git Experience create fields (branch_name, file_path, repo_name, connector_ref, is_harness_code_repo, store_type, commit_message, base_branch). Prefer params: store_type, repo_name, branch, file_path, connector_ref, is_harness_code_repo, commit_msg." },
  ],
};

const pipelineV1UpdateSchema: BodySchema = {
  description: "V1 pipeline definition (full replacement). Same fields as create: pipeline_yaml, identifier, name, version. Pass a raw YAML string as body, or {pipeline_yaml, identifier, name} as JSON. Raw v1 YAML can provide the identifier as pipeline.id. For remote pipelines, include git_details (or params last_object_id/last_commit_id from GET git_details.object_id/commit_id) so Git conflict detection succeeds.",
  fields: [
    { name: "pipeline_yaml", type: "string", required: true, description: "Pipeline YAML string (full replacement)" },
    { name: "identifier", type: "string", required: true, description: "Pipeline identifier" },
    { name: "name", type: "string", required: true, description: "Pipeline display name" },
    { name: "version", type: "string", required: false, description: "Pipeline version. Defaults to '1'" },
    { name: "description", type: "string", required: false, description: "Pipeline description" },
    { name: "tags", type: "object", required: false, description: "Pipeline tags as key:value pairs" },
    { name: "git_details", type: "object", required: false, description: "Git Experience update fields. Include last_object_id and last_commit_id from GET git_details.object_id/commit_id (or pass last_object_id/last_commit_id via params)." },
  ],
};

const PIPELINE_V1_GET_PARAMS: ParamsSchema = {
  fields: [
    { name: "branch", required: false, description: "Git branch alias — maps to branch_name on the wire. Pass via params." },
    { name: "branch_name", required: false, description: "Git branch — sent as branch_name. Alias of branch. Pass via params." },
    { name: "repo_name", required: false, description: "Git repository name for Git Experience. Pass via params." },
    { name: "connector_ref", required: false, description: "Git connector for remote pipelines. Pass via params." },
    { name: "load_from_fallback_branch", required: false, description: "When true, load from the created non-default branch if the requested branch is empty. Pass via params." },
    { name: "template_applied", required: false, description: "When true, return YAML with templates applied. Pass via params." },
    { name: "validate_async", required: false, description: "When true, validate the pipeline asynchronously. Pass via params." },
  ],
};

const PIPELINE_V1_CREATE_PARAMS: ParamsSchema = {
  fields: [
    { name: "store_type", required: false, description: "INLINE (default) or REMOTE. Pass via params; mapped into body.git_details." },
    { name: "branch", required: false, description: "Git branch (body.git_details.branch_name). Pass via params." },
    { name: "repo_name", required: false, description: "Git repo name. Pass via params." },
    { name: "file_path", required: false, description: "Path of the pipeline YAML in the repo. Pass via params." },
    { name: "connector_ref", required: false, description: "Git connector ref for external Git. Pass via params." },
    { name: "is_harness_code_repo", required: false, description: "Set true for Harness Code repositories (body.git_details.is_harness_code_repo). Pass via params." },
    { name: "commit_msg", required: false, description: "Commit message (body.git_details.commit_message). Pass via params." },
    { name: "base_branch", required: false, description: "Base branch when creating a new branch. Pass via params." },
  ],
};

const PIPELINE_V1_UPDATE_PARAMS: ParamsSchema = {
  fields: [
    ...PIPELINE_V1_CREATE_PARAMS.fields,
    { name: "last_object_id", required: false, description: "Git blob/object id from GET git_details.object_id — required for remote updates. Pass via params." },
    { name: "last_commit_id", required: false, description: "Git commit id from GET git_details.commit_id — required for remote updates. Pass via params." },
  ],
};

const PIPELINE_V0_GET_PARAMS: ParamsSchema = {
  fields: [
    { name: "branch", required: false, description: "Git branch for a remote pipeline. Pass via params." },
    { name: "store_type", required: false, description: "INLINE or REMOTE. Pass via params." },
    { name: "connector_ref", required: false, description: "Git connector ref for external Git. Pass via params." },
    { name: "repo_name", required: false, description: "Git repository name. Pass via params." },
  ],
};

const PIPELINE_V0_UPDATE_PARAMS: ParamsSchema = {
  fields: [
    { name: "store_type", required: false, description: "INLINE or REMOTE. Pass via params." },
    { name: "branch", required: false, description: "Git branch for a remote pipeline. Pass via params." },
    { name: "repo_name", required: false, description: "Git repository name. Pass via params." },
    { name: "file_path", required: false, description: "Path of the pipeline YAML in the repository. Pass via params." },
    { name: "connector_ref", required: false, description: "Git connector ref for external Git. Pass via params." },
    { name: "is_harness_code_repo", required: false, description: "Set true for Harness Code repositories. Pass via params." },
    { name: "commit_msg", required: false, description: "Git commit message. Pass via params." },
    { name: "last_object_id", required: false, description: "Git blob/object id from GET gitDetails.objectId. Pass via params." },
    { name: "last_commit_id", required: false, description: "Git commit id from GET gitDetails.commitId. Pass via params." },
  ],
};

function firstGitString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

function firstGitBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    // `params` values are untyped JSON and agents routinely quote booleans.
    // v0 forwards the string as a query param; v1 must not drop it.
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return undefined;
}

function inputGitDetails(input: Record<string, unknown>): Record<string, unknown> {
  return asRecord(asRecord(input.body)?.git_details) ?? {};
}

/**
 * V1 create/update send Git Experience fields in JSON `git_details`, not query params.
 * Accept params used by v0 agents (branch, commit_msg, last_object_id) and GET response
 * names (object_id, commit_id) so agents can copy git_details forward.
 */
function collectV1GitDetails(input: Record<string, unknown>): Record<string, string | boolean> | undefined {
  const git = inputGitDetails(input);
  const details: Record<string, string | boolean> = {};
  const assign = (key: string, value: string | undefined) => {
    if (value) details[key] = value;
  };

  assign("branch_name", firstGitString(input.branch_name, input.branch, git.branch_name));
  assign("file_path", firstGitString(input.file_path, git.file_path));
  assign("commit_message", firstGitString(input.commit_message, input.commit_msg, git.commit_message));
  assign("base_branch", firstGitString(input.base_branch, git.base_branch));
  assign("connector_ref", firstGitString(input.connector_ref, git.connector_ref));
  assign("store_type", firstGitString(input.store_type, git.store_type));
  assign("repo_name", firstGitString(input.repo_name, git.repo_name));
  const isHarnessCodeRepo = firstGitBoolean(input.is_harness_code_repo, git.is_harness_code_repo);
  if (isHarnessCodeRepo !== undefined) details.is_harness_code_repo = isHarnessCodeRepo;
  assign("last_object_id", firstGitString(input.last_object_id, git.last_object_id, git.object_id));
  assign("last_commit_id", firstGitString(input.last_commit_id, git.last_commit_id, git.commit_id));

  return Object.keys(details).length > 0 ? details : undefined;
}

function hasRemoteUpdateLockContext(input: Record<string, unknown>): boolean {
  const git = inputGitDetails(input);
  return !!firstGitString(input.branch_name, input.branch, git.branch_name)
    && !!firstGitString(input.repo_name, git.repo_name)
    && !!firstGitString(input.file_path, git.file_path)
    && !!firstGitString(input.last_object_id, git.last_object_id, git.object_id)
    && !!firstGitString(input.last_commit_id, git.last_commit_id, git.commit_id);
}

function isExplicitlyInline(input: Record<string, unknown>): boolean {
  const storeType = firstGitString(input.store_type, inputGitDetails(input).store_type);
  return storeType?.toUpperCase() === "INLINE";
}

function setIfMissing(input: Record<string, unknown>, key: string, value: unknown): void {
  if ((input[key] === undefined || input[key] === "") && value !== undefined && value !== "") {
    input[key] = value;
  }
}

/**
 * Remote updates require Git location plus optimistic-lock SHAs. Agents commonly
 * send only the updated YAML, so hydrate missing Git context from the current
 * pipeline before the body/query builders run.
 */
function remotePipelineUpdatePreflight(resourceType: "pipeline" | "pipeline_v1") {
  return async ({ client, input, registry, signal }: PreflightContext): Promise<void> => {
    if (isExplicitlyInline(input) || hasRemoteUpdateLockContext(input)) return;

    const currentGit = inputGitDetails(input);
    const getInput: Record<string, unknown> = {
      pipeline_id: input.pipeline_id,
    };
    // store_type is deliberately not forwarded: the v0 GET echoes it back onto
    // the response when the API omits one, which would let the caller's own
    // assertion masquerade as the stored store type we read below.
    for (const key of ["org_id", "project_id", "branch", "branch_name", "repo_name", "connector_ref"]) {
      if (input[key] !== undefined) getInput[key] = input[key];
    }
    setIfMissing(getInput, "branch", firstGitString(currentGit.branch_name));
    setIfMissing(getInput, "repo_name", firstGitString(currentGit.repo_name));
    setIfMissing(getInput, "connector_ref", firstGitString(currentGit.connector_ref));
    if (resourceType === "pipeline_v1") getInput.load_from_fallback_branch = true;

    // Hydration is best-effort. Aborting on a failed lookup would break inline
    // updates, which need no Git context at all and previously never read the
    // pipeline first. A genuinely remote pipeline still fails loudly on the PUT
    // with the GitX branch/SHA error. Toolsets may not log (pure data), so the
    // swallow is silent by design.
    let current: Record<string, unknown> | undefined;
    try {
      current = asRecord(await registry.dispatch(client, resourceType, "get", getInput, signal));
    } catch {
      return;
    }
    const git = asRecord(current?.git_details ?? current?.gitDetails);
    const currentStoreType = firstGitString(
      current?.store_type,
      current?.storeType,
      git?.store_type,
      git?.storeType,
    );
    const hasRemoteMetadata = !!git && Object.keys(git).length > 0;
    if (currentStoreType?.toUpperCase() === "INLINE") return;
    if (currentStoreType?.toUpperCase() !== "REMOTE" && !hasRemoteMetadata) return;

    setIfMissing(input, "store_type", currentStoreType ?? "REMOTE");
    setIfMissing(input, "branch", firstGitString(git?.branch_name, git?.branchName, git?.branch));
    setIfMissing(input, "repo_name", firstGitString(git?.repo_name, git?.repoName));
    setIfMissing(input, "file_path", firstGitString(git?.file_path, git?.filePath));
    setIfMissing(input, "connector_ref", firstGitString(git?.connector_ref, git?.connectorRef));
    setIfMissing(input, "last_object_id", firstGitString(
      git?.last_object_id,
      git?.object_id,
      git?.lastObjectId,
      git?.objectId,
    ));
    setIfMissing(input, "last_commit_id", firstGitString(
      git?.last_commit_id,
      git?.commit_id,
      git?.lastCommitId,
      git?.commitId,
    ));
    setIfMissing(input, "is_harness_code_repo", firstGitBoolean(
      git?.is_harness_code_repo,
      git?.isHarnessCodeRepo,
    ));
    // v1 requires `name` in the body; YAML-only updates often omit it.
    setIfMissing(input, "pipeline_name", firstGitString(current?.name));

    if (!hasRemoteUpdateLockContext(input)) {
      throw new Error(
        `Unable to resolve Git branch and current object/commit IDs for remote ${resourceType} update. `
        + "Call harness_get with the repository/branch context and pass branch, last_object_id, and last_commit_id via params.",
      );
    }
  };
}

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
      if (!identifier && typeof p?.identifier === "string") identifier = p.identifier;
      if (!identifier && typeof p?.id === "string") identifier = p.id;
      if (!name && p?.name) name = p.name;
    } catch { /* non-critical — caller can provide identifier/name explicitly */ }
  }

  // Fall back to the identifiers the caller addressed the pipeline with, and to
  // the name hydrated by the remote update preflight.
  identifier = identifier ?? firstGitString(input.pipeline_id);
  name = name ?? firstGitString(input.pipeline_name);

  const result: Record<string, unknown> = {
    pipeline_yaml: pipelineYaml,
    identifier,
    name,
    version,
  };
  if (description) result.description = description;
  if (tags) result.tags = tags;
  const gitDetails = collectV1GitDetails(input);
  if (gitDetails) result.git_details = gitDetails;
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
      description: "CI/CD pipeline definition. Supports list, get, create, update, delete, and execute (run).",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id"],
      diagnosticHint: "Use harness_diagnose with pipeline_id or execution_id to analyze failures — includes step-level error details, log snippets, delegate info, and chained pipeline traversal.",
      executeHint: "Before executing, check required inputs: harness_get(resource_type='runtime_input_template', resource_id='PIPELINE_ID'). For simple variables, pass key-value pairs in inputs. For CI pipelines with codebase: pass {branch: 'main'}, {tag: 'v1.0'}, {pr_number: '42'}, or {commit_sha: 'abc123'} — auto-expanded to the full build structure. For complex template inputs, use input_set_ids — list available sets with harness_list(resource_type='input_set', filters={pipeline_id: '...'}).",
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
          paramsSchema: PIPELINE_V0_GET_PARAMS,
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
          preflight: remotePipelineUpdatePreflight("pipeline"),
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
          paramsSchema: PIPELINE_V0_UPDATE_PARAMS,
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
            pipeline_branch: "pipelineBranchName",
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
          actionDescription: "Execute/run a pipeline. RECOMMENDED: first check harness_get(resource_type='runtime_input_template', resource_id='PIPELINE_ID') to see required inputs. For simple variable inputs: pass key-value pairs in inputs (e.g. {branch: 'main'}) — auto-resolved. For CI pipelines with codebase: pass {branch: 'main'}, {tag: 'v1.0'}, {pr_number: '42'}, or {commit_sha: 'abc123'} — auto-expanded to the full build structure. For complex pipelines with template inputs: use input_set_ids to reference a saved input set. List available sets with harness_list(resource_type='input_set', filters={pipeline_id: '...'}). To load the pipeline YAML from a specific git branch (e.g. a feature branch): pass params={pipeline_branch: 'feature/my-fix'} — sent as ?pipelineBranchName= on the API call.",
          bodySchema: {
            description: "Runtime inputs for pipeline execution. For simple variables: pass key-value pairs in inputs like {branch: 'main', env: 'prod'}, auto-resolved against the pipeline's runtime input template. CI codebase shorthands (branch, tag, pr_number, commit_sha) are auto-expanded to full build structures. For complex pipelines with template inputs, use input_set_ids to reference saved input sets. You can combine both: input_set_ids for the base config + inputs for simple overrides. Check runtime_input_template first to see what the pipeline expects.",
            fields: [
              { name: "inputs", type: "yaml", required: false, description: "Key-value pairs (e.g. {branch: 'main', env: 'prod'}) — auto-resolved to full YAML. CI codebase shorthands (branch, tag, pr_number, commit_sha) are auto-expanded. For template inputs, use input_set_ids instead." },
              { name: "input_set_ids", type: "array", required: false, description: "Input set identifiers to apply. Recommended for complex pipelines with template inputs. List available: harness_list(resource_type='input_set', filters={pipeline_id: '...'})." },
              { name: "pipeline_branch", type: "string", required: false, description: "Git branch to load the pipeline YAML from (sent as ?pipelineBranchName= on the API). Use when the pipeline definition lives on a feature branch rather than the default branch." },
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
      description: "V1 pipeline definition using simplified YAML format. Use ONLY when user explicitly requests v1, says 'agent pipeline', or provides YAML with v1 indicators: kebab-case keys (allow-stage-executions, fixed-inputs-on-rerun), top-level step keys (run, action, template, approval) without nested stage/step wrappers. Supports list, get, create, update, delete, and execute (run).",
      toolset: "pipelines",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: ["pipeline_id"],
      searchAliases: ["v1 pipeline", "agent pipeline", "v1"],
      diagnosticHint: "Use harness_diagnose with pipeline_id or execution_id to analyze failures. V1 pipelines use the same execution engine as v0.",
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipeline}/pipeline-studio",
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
            branch_name: "branch_name",
            connector_ref: "connector_ref",
            repo_name: "repo_name",
            load_from_fallback_branch: "load_from_fallback_branch",
            template_applied: "template_applied",
            validate_async: "validate_async",
          },
          responseExtractor: passthrough,
          paramsSchema: PIPELINE_V1_GET_PARAMS,
          description: "Get v1 pipeline details including YAML. For Git-backed pipelines, pass branch (or branch_name), repo_name, and optionally load_from_fallback_branch. The response git_details.object_id and git_details.commit_id are needed as last_object_id/last_commit_id when updating a remote v1 pipeline.",
        },
        create: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/pipelines",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { org_id: "org", project_id: "project" },
          bodyBuilder: buildV1PipelineBody,
          responseExtractor: passthrough,
          paramsSchema: PIPELINE_V1_CREATE_PARAMS,
          description: "Create a new v1 pipeline. Pass pipeline_yaml (YAML string), identifier, name. Version defaults to '1'. Alternatively pass a raw YAML string as body; identifier is extracted from pipeline.identifier or v1 pipeline.id. For remote/Git-backed pipelines, pass store_type='REMOTE' with repo_name, branch, file_path (and connector_ref for external Git) via params — they become body.git_details.",
          bodySchema: pipelineV1CreateSchema,
        },
        update: {
          method: "PUT",
          path: "/v1/orgs/{org}/projects/{project}/pipelines/{pipeline}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { org_id: "org", project_id: "project", pipeline_id: "pipeline" },
          preflight: remotePipelineUpdatePreflight("pipeline_v1"),
          bodyBuilder: buildV1PipelineBody,
          responseExtractor: passthrough,
          paramsSchema: PIPELINE_V1_UPDATE_PARAMS,
          description: "Update a v1 pipeline (full replacement). Same body format as create. For remote pipelines, pass store_type='REMOTE' with git location fields and last_object_id/last_commit_id from GET git_details.object_id/commit_id — v1 sends these in body.git_details, not as query params.",
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
      resourceType: "pipeline_dynamic_execution",
      displayName: "Pipeline Dynamic Execution",
      description:
        "Execute a v0 Harness pipeline with a dynamically-provided pipeline YAML — wraps POST /v1/orgs/{org}/projects/{project}/pipelines/{pipeline}/execute/dynamic (the URL uses Harness's /v1/... control-plane path; the target is a v0 pipeline). The v0 pipeline shell must already exist in Harness with 'Allow Dynamic Execution' enabled at both the account and pipeline level (gated by the PIPE_DYNAMIC_PIPELINES_EXECUTION feature flag). Use when an agent or external system generates the full v0 pipeline YAML at runtime instead of running a saved configuration. Supports the run execute action only.",
      toolset: "pipelines",
      scope: "project",
      headerBasedScoping: true,
      identifierFields: ["pipeline_id"],
      executeHint:
        "Targets v0 pipelines (resource_type='pipeline'). Pre-conditions: (1) account-level Allow Dynamic Execution setting on; (2) pipeline-level Allow Dynamic Execution toggle on; (3) caller has Edit + Execute on the pipeline. Runtime `<+input>` placeholders are NOT resolved at execution time — the agent must fully resolve all values in the YAML before submitting. Input sets, selective stage execution, retry, and triggers are not supported by this API. Call as harness_execute(resource_type='pipeline_dynamic_execution', action='run', resource_id='<pipeline_id>', body={yaml: '<full v0 pipeline yaml string>'}). The body argument must be an object — pass the YAML inside `body.yaml`, not as a top-level string.",
      diagnosticHint:
        "If the run is rejected with a 'dynamic execution not enabled' error, verify the account-level Allow Dynamic Execution setting and the pipeline-level toggle (Pipeline → Advanced Options → Dynamic Execution Settings). Invalid YAML errors include a parse location — re-generate the YAML and resubmit.",
      relatedResources: [
        {
          resourceType: "execution",
          relationship: "produces",
          description: "The plan execution started by this run. After a successful response, use harness_get(resource_type='execution', resource_id=<execution_id>) to monitor stage/step status.",
        },
        {
          resourceType: "pipeline",
          relationship: "executes",
          description: "The v0 pipeline shell that hosts the dynamic execution. Use harness_get(resource_type='pipeline', resource_id=<pipeline_id>) for the saved shell definition. Use harness_get(resource_type='runtime_input_template', resource_id=<pipeline_id>) to confirm the shell expects no unresolved `<+input>` placeholders before submitting YAML.",
        },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/all/orgs/{org}/projects/{project}/pipelines/{pipeline}/deployments/{execution_id}/pipeline",
      operations: {},
      executeActions: {
        run: {
          method: "POST",
          path: "/v1/orgs/{org}/projects/{project}/pipelines/{pipeline}/execute/dynamic",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { org_id: "org", project_id: "project", pipeline_id: "pipeline" },
          queryParams: {
            module_type: "moduleType",
            notes: "notes",
            notify_only_user: "notify_only_user",
          },
          bodyBuilder: (input) => {
            // Public contract: body must be an object with a `yaml` field
            // (string or JSON pipeline object). harness_execute.body is
            // typed as z.record(...) and rejects raw string bodies before
            // the registry sees them, so we mirror that shape here.
            const body = input.body as Record<string, unknown> | undefined;
            const yamlField = body?.yaml;
            let yaml: string | undefined;
            if (typeof yamlField === "string") {
              yaml = yamlField;
            } else if (yamlField && typeof yamlField === "object") {
              yaml = YAML.stringify(yamlField);
            }
            if (!yaml) {
              throw new Error("body.yaml is required and must be a YAML string or a JSON pipeline object (auto-serialized to YAML). Pass the full v0 pipeline YAML inside body.yaml — raw string bodies are not supported by harness_execute.");
            }
            return { yaml };
          },
          responseExtractor: dynamicExecutionExtract,
          actionDescription:
            "Execute a v0 Harness pipeline using YAML provided at runtime. Targets the v0 pipeline shell identified by resource_id. Pass body as an object with a `yaml` field — either body={yaml: '<yaml string>'} or body={yaml: <JSON pipeline object>} (auto-serialized to YAML). Raw string bodies are not accepted. Optional params: module_type (e.g. CI, CD), notes (free-form notes attached to the run), notify_only_user (boolean). Returns { execution_id, status } and an openInHarness deep link to the execution. Pre-conditions: account- and pipeline-level Allow Dynamic Execution must be enabled and the caller must have Edit + Execute on the pipeline.",
          bodySchema: {
            description: "Full v0 pipeline YAML to execute. Two options: (1) body={yaml: '<yaml string>'} — pass the YAML as a string under the `yaml` key. (2) body={yaml: {<JSON pipeline>}} — pass the pipeline as a JSON object, auto-serialized to YAML. The body itself must be an object (harness_execute does not accept raw string bodies). Must conform to the v0 Harness pipeline YAML schema (the same schema accepted by harness_create with resource_type='pipeline'). All `<+input>` placeholders must be fully resolved before submission — runtime input prompts are not supported by the dynamic execution API.",
            fields: [
              { name: "yaml", type: "yaml", required: true, description: "Full v0 pipeline YAML string (or JSON object that will be serialized to YAML). Must conform to the v0 Harness pipeline YAML schema." },
            ],
          },
          paramsSchema: {
            fields: [
              { name: "module_type", required: false, description: "Harness module the execution is associated with (e.g. CI, CD)." },
              { name: "notes", required: false, description: "Free-form notes attached to the pipeline execution run." },
              { name: "notify_only_user", required: false, description: "When true, execution notifications are sent only to the triggering user." },
            ],
          } satisfies ParamsSchema,
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
      relatedResources: [
        {
          resourceType: "execution_inputs",
          relationship: "produced-from",
          description: "The merged input set YAML that produced this execution. Use harness_get(resource_type='execution_inputs', resource_id=<planExecutionId>) to see what runtime inputs the run actually used (post-run forensics).",
        },
      ],
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
      resourceType: "execution_inputs",
      displayName: "Pipeline Execution Inputs",
      description:
        "Merged input set YAML for a pipeline execution — the inputs that produced a given run. Supports get only. Use to answer 'what inputs triggered this execution?' without leaving the MCP tool chain.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["execution_id"],
      relatedResources: [
        {
          resourceType: "execution",
          relationship: "produced-by",
          description: "The pipeline execution this input set was used for. Use harness_get(resource_type='execution', resource_id=<planExecutionId>) for status/stage details.",
        },
        {
          resourceType: "input_set",
          relationship: "merged-from",
          description: "Saved input sets that contributed to this execution's merged YAML. inputSetDetails lists their identifiers/names.",
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: "/pipeline/api/pipelines/execution/{planExecutionId}/inputsetV2",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { execution_id: "planExecutionId" },
          queryParams: {
            resolve_expressions: "resolveExpressions",
            resolve_expressions_type: "resolveExpressionsType",
          },
          responseExtractor: executionInputsExtract,
          description:
            "Get the merged input set YAML for a pipeline execution. Returns inputSetYaml (merged inputs used at runtime), inputSetTemplateYaml (template at execution time), resolvedYaml (only when resolve_expressions=true), inputSetDetails (saved input sets that contributed), and inputSetBranchName (source branch for git-backed input sets). Call as harness_get(resource_type='execution_inputs', resource_id=<planExecutionId>) — resource_id is mapped to the execution_id path identifier. Optional params (pass via the params argument): resolve_expressions (bool), resolve_expressions_type (enum: RESOLVE_ALL_EXPRESSIONS | RESOLVE_TRIGGER_EXPRESSIONS | UNKNOWN — default UNKNOWN means no resolution).",
          paramsSchema: {
            fields: [
              {
                name: "resolve_expressions",
                required: false,
                description: "When true, resolve `<+...>` expressions in the YAML. The resolved output is returned in the resolvedYaml field. Defaults to false.",
              },
              {
                name: "resolve_expressions_type",
                required: false,
                description: "Which expressions to resolve. One of: RESOLVE_ALL_EXPRESSIONS, RESOLVE_TRIGGER_EXPRESSIONS, UNKNOWN. Defaults to UNKNOWN (no resolution), matching the upstream API default.",
              },
            ],
          } satisfies ParamsSchema,
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
          responseExtractor: triggerListExtract,
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
            const body = input.body;
            if (body == null || body === "") return "";
            const triggerObj = normalizeTriggerBody(body, input);
            return YAML.stringify(triggerObj);
          },
          responseExtractor: ngExtract,
          description: "Create a new pipeline trigger. Requires pipeline_id to identify the target pipeline. Use harness_schema(resource_type='trigger') to discover the body structure.",
          bodySchema: {
            description: "Trigger configuration — auto-converted to YAML for the API. Pass a raw YAML string (including trigger: root), a JSON object with trigger fields (auto-wrapped in trigger envelope), or { trigger: { ... } }. Use harness_schema(resource_type='trigger') for the full schema. The pipeline_id query param is auto-extracted from pipelineIdentifier in the body when omitted.",
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
            const body = input.body;
            if (body == null || body === "") return "";
            const triggerObj = normalizeTriggerBody(body, input);
            return YAML.stringify(triggerObj);
          },
          responseExtractor: ngExtract,
          description: "Update a pipeline trigger. Use harness_schema(resource_type='trigger') to discover the body structure.",
          bodySchema: {
            description: "Full trigger configuration (replaces existing). Pass a raw YAML string, JSON trigger fields (auto-wrapped), or { trigger: { ... } } — converted to YAML for the API. Use harness_schema(resource_type='trigger') for the full schema.",
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
          queryParams: { pipeline_id: "targetIdentifier" },
          paramsSchema: {
            fields: [
              { name: "pipeline_id", required: true, description: "Target pipeline identifier" },
            ],
          } satisfies ParamsSchema,
          responseExtractor: ngExtract,
          description: "Delete a pipeline trigger. Requires pipeline_id (target pipeline) and trigger_id.",
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
          queryParams: {
            pipeline_id: "pipelineIdentifier",
            // Git context for remote/Git-stored input sets — without a branch
            // the API silently resolves from the repo's default branch.
            branch: "branch",
            repo_name: "repoName",
            connector_ref: "connectorRef",
            store_type: "storeType",
          },
          responseExtractor: ngExtract,
          description: "Get input set details. For remote/git-backed input sets, pass branch (and repo_name for multi-repo) to read from a specific branch; otherwise the default branch is used.",
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
      description: "Fetch the runtime input template for a pipeline — shows all `<+input>` placeholders that need values. Use this to discover what runtime inputs a pipeline requires before executing it. variableInputMetadata (when present) covers pipeline-level variables only, not stage/service/env inputs.",
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
            store_type: "storeType",
            connector_ref: "connectorRef",
            repo_name: "repoName",
          },
          bodyBuilder: () => ({}),
          preflight: runtimeInputTemplatePreflight,
          responseExtractor: runtimeInputExtract,
          description:
            "Fetch the runtime input template for a pipeline. Merges pipeline-definition variable metadata (default, allowedValues) when present. variableInputMetadata covers pipeline.variables only — not stage/service/env inputs.",
        },
      },
    },
    {
      resourceType: "pipeline_resolved_yaml",
      displayName: "Pipeline Resolved YAML",
      description:
        "Fetch a pipeline with all template refs resolved — returns resolvedTemplatesPipelineYaml and per-stage deployment metadata (deploymentType, environmentRef). Use with runtime_input_template when authoring release activities that map pipeline runtime inputs. stageMetadataMap includes deployment stages inside parallel blocks and stage groups.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id"],
      operations: {
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
          staticQueryParams: {
            getTemplatesResolvedPipeline: "true",
          },
          responseExtractor: pipelineResolvedYamlExtract,
          description:
            "Fetch resolved pipeline YAML with templates expanded. Returns stageMetadataMap for patching entity-type activity inputs (deploymentType, environmentRef).",
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
