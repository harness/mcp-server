import type { ToolsetDefinition, BodySchema } from "../types.js";
import { ngExtract, pageExtract, passthrough, v1ListExtract, runtimeInputExtract } from "../extractors.js";
import YAML from "yaml";

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

const pipelineCreateSchema: BodySchema = {
  description: "Pipeline definition. Prefer yamlPipeline (YAML string) to avoid serialization issues; pipeline (JSON object) is also supported. Storage options via params: (1) Inline (default): no extra params needed. (2) External Git: store_type='REMOTE', connector_ref (Git connector ID), repo_name, branch, file_path. (3) Harness Code: store_type='REMOTE', is_harness_code_repo=true, repo_name, branch, file_path (no connector_ref needed).",
  fields: [
    { name: "yamlPipeline", type: "string", required: false, description: "Full pipeline YAML string including the 'pipeline:' root. Recommended when creating from generated or edited YAML." },
    { name: "pipeline", type: "object", required: false, description: "Pipeline as JSON object (name, identifier, stages, etc.). Use yamlPipeline instead when passing YAML to avoid large nested JSON.", fields: [
      { name: "name", type: "string", required: true, description: "Pipeline display name" },
      { name: "identifier", type: "string", required: true, description: "Unique pipeline identifier" },
      { name: "stages", type: "array", required: false, description: "Pipeline stages", itemType: "stage object" },
    ]},
  ],
};

const pipelineUpdateSchema: BodySchema = {
  description: "Pipeline YAML definition (full replacement). Pass either pipeline (JSON object) or yamlPipeline (YAML string). For remote pipelines, pass store_type='REMOTE' with git details via params. External Git: connector_ref, repo_name, branch, file_path, commit_msg. Harness Code: is_harness_code_repo=true, repo_name, branch, file_path, commit_msg (no connector_ref). Include last_object_id and last_commit_id from the GET response for conflict detection.",
  fields: [
    { name: "pipeline", type: "object", required: false, description: "Complete pipeline as JSON object (replaces existing)" },
    { name: "yamlPipeline", type: "string", required: false, description: "Complete pipeline as YAML string (replaces existing). Use this when updating from get pipeline response or editing YAML." },
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
            const b = input.body as Record<string, unknown> | undefined;
            if (b && typeof b === "object" && typeof b.yamlPipeline === "string") {
              return b.yamlPipeline;
            }
            if (b && typeof b === "object" && b.pipeline !== undefined) {
              return input.body;
            }
            throw new Error("body must include either yamlPipeline (YAML string) or pipeline (JSON object)");
          },
          responseExtractor: ngExtract,
          description: "Create a new pipeline from YAML. For external Git: store_type='REMOTE' + connector_ref, repo_name, branch, file_path. For Harness Code: store_type='REMOTE' + is_harness_code_repo=true, repo_name, branch, file_path.",
          bodySchema: pipelineCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/pipeline/api/pipelines/v2/{pipelineIdentifier}",
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
            const b = input.body as Record<string, unknown> | undefined;
            if (b && typeof b === "object" && typeof b.yamlPipeline === "string") {
              return b.yamlPipeline;
            }
            if (b && typeof b === "object" && b.pipeline !== undefined) {
              return b;
            }
            throw new Error("body must include either pipeline (JSON object) or yamlPipeline (YAML string)");
          },
          responseExtractor: ngExtract,
          description: "Update an existing pipeline YAML. For remote pipelines, pass store_type='REMOTE' with git details and last_object_id/last_commit_id from the GET response. For Harness Code: add is_harness_code_repo=true (no connector_ref needed).",
          bodySchema: pipelineUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/pipeline/api/pipelines/{pipelineIdentifier}",
          pathParams: { pipeline_id: "pipelineIdentifier" },
          responseExtractor: ngExtract,
          description: "Delete a pipeline",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: "/pipeline/api/pipeline/execute/{pipelineIdentifier}",
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
            // No runtime inputs — send empty YAML
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
          pathParams: { trigger_id: "triggerIdentifier" },
          queryParams: { pipeline_id: "targetIdentifier" },
          responseExtractor: ngExtract,
          description: "Get trigger details",
        },
        create: {
          method: "POST",
          path: "/pipeline/api/triggers",
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
          pathParams: { pipeline_id: "pipelineIdentifier" },
          responseExtractor: ngExtract,
          description: "Get a lightweight pipeline summary (without full YAML)",
        },
      },
    },
    {
      resourceType: "input_set",
      displayName: "Input Set",
      description: "Reusable runtime input sets for pipelines",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["pipeline_id", "input_set_id"],
      listFilterFields: [
        { name: "pipeline_id", description: "Pipeline identifier to filter input sets" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipeline_id}/input-sets",
      operations: {
        list: {
          method: "GET",
          path: "/pipeline/api/inputSets",
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
          pathParams: { input_set_id: "inputSetIdentifier" },
          queryParams: { pipeline_id: "pipelineIdentifier" },
          responseExtractor: ngExtract,
          description: "Get input set details",
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
