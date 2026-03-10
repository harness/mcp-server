import type { ToolsetDefinition, BodySchema } from "../types.js";
import { ngExtract, pageExtract, passthrough, v1ListExtract } from "../extractors.js";

const ngExtractWithInlineStore = (raw: unknown) => {
  const result = ngExtract(raw);
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (!r.storeType) r.storeType = "INLINE";
  }
  return result;
};

const pipelineCreateSchema: BodySchema = {
  description: "Pipeline definition. Prefer yamlPipeline (YAML string) to avoid serialization issues; pipeline (JSON object) is also supported.",
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
  description: "Pipeline YAML definition (full replacement). Pass either pipeline (JSON object) or yamlPipeline (YAML string).",
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
      executeHint: "Before executing, check required inputs: harness_get(resource_type='runtime_input_template', resource_id='PIPELINE_ID'). For simple variables, pass key-value pairs in inputs. For complex pipelines (CI codebase build, templates), use input_set_ids — list available sets with harness_list(resource_type='input_set', filters={pipeline_id: '...'}).",
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
          responseExtractor: ngExtract,
          description: "Get pipeline details including YAML definition",
        },
        create: {
          method: "POST",
          path: "/pipeline/api/pipelines/v2",
          headers: { "Content-Type": "application/yaml" },
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
          responseExtractor: ngExtractWithInlineStore,
          description: "Create a new pipeline from YAML",
          bodySchema: pipelineCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/pipeline/api/pipelines/v2/{pipelineIdentifier}",
          pathParams: { pipeline_id: "pipelineIdentifier" },
          headers: { "Content-Type": "application/yaml" },
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
          responseExtractor: ngExtractWithInlineStore,
          description: "Update an existing pipeline YAML. Response includes openInHarness link to the updated pipeline in Pipeline Studio.",
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
          queryParams: { module: "module", input_set_ids: "inputSetIdentifiers" },
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
          actionDescription: "Execute/run a pipeline. RECOMMENDED: first check harness_get(resource_type='runtime_input_template', resource_id='PIPELINE_ID') to see required inputs. For simple variable inputs: pass key-value pairs in inputs (e.g. {branch: 'main'}) — auto-resolved. For complex pipelines with structural inputs (CI codebase build, template inputs): use input_set_ids to reference a saved input set. List available sets with harness_list(resource_type='input_set', filters={pipeline_id: '...'}).",
          bodySchema: {
            description: "Runtime inputs for pipeline execution. Two strategies: (1) For simple variables — pass key-value pairs in inputs like {branch: 'main', env: 'prod'}, auto-resolved against the pipeline's runtime input template. (2) For complex pipelines with structural fields (CI codebase build config, template inputs) — use input_set_ids to reference saved input sets. You can combine both: input_set_ids for the base config + inputs for simple overrides. Check runtime_input_template first to see what the pipeline expects.",
            fields: [
              { name: "inputs", type: "yaml", required: false, description: "Simple key-value pairs (e.g. {branch: 'main', env: 'prod'}) — auto-resolved to full YAML. Works best for pipeline variables. For structural fields like CI codebase build, use input_set_ids instead." },
              { name: "input_set_ids", type: "array", required: false, description: "Input set identifiers to apply. Recommended for complex pipelines with structural inputs. List available: harness_list(resource_type='input_set', filters={pipeline_id: '...'})." },
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
        { name: "pipeline_id", description: "Pipeline identifier to filter executions" },
        { name: "status", description: "Execution status filter", enum: ["Success", "Failed", "Running", "Aborted", "Expired", "AbortedByFreeze", "NotStarted", "Paused", "Queued", "Waiting"] },
        { name: "module", description: "Harness module filter", enum: ["CD", "CI", "CV", "CF", "CE", "STO"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/pipelines/{pipelineIdentifier}/executions/{planExecutionId}/pipeline",
      operations: {
        list: {
          method: "POST",
          path: "/pipeline/api/pipelines/execution/summary",
          queryParams: {
            page: "page",
            size: "size",
            module: "module",
          },
          bodyBuilder: (input) => ({
            filterType: "PipelineExecution",
            pipelineIdentifier: input.pipeline_id,
            status: input.status ? [input.status] : undefined,
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
          responseExtractor: ngExtract,
          actionDescription: "Interrupt a running execution. Set interrupt_type to AbortAll, Pause, etc.",
          bodySchema: {
            description: "No request body required. The interrupt type is specified via the interrupt_type query parameter (e.g. AbortAll, Pause, Resume, StageRollback).",
            fields: [],
          },
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
        { name: "pipeline_id", description: "Pipeline identifier to filter triggers" },
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
            if (!body) return {};
            // Hoist pipelineIdentifier from body to input so queryParams maps it to targetIdentifier
            const inner = (body.trigger && typeof body.trigger === "object")
              ? body.trigger as Record<string, unknown>
              : body;
            if (inner.pipelineIdentifier && !input.pipeline_id) {
              input.pipeline_id = inner.pipelineIdentifier as string;
            }
            // If the body already has a "trigger" wrapper, pass it through
            if (body.trigger && typeof body.trigger === "object") {
              return body;
            }
            // Wrap in trigger envelope — the API expects { trigger: { ... } }
            return { trigger: body };
          },
          responseExtractor: ngExtract,
          description: "Create a new pipeline trigger. Requires pipeline_id to identify the target pipeline.",
          bodySchema: {
            description: "Trigger configuration. Pass the trigger fields directly in the body — they will be auto-wrapped in a { trigger: { ... } } envelope. The pipeline_id is auto-extracted from pipelineIdentifier in the body and sent as the targetIdentifier query parameter.",
            fields: [
              { name: "trigger", type: "object", required: false, description: "Wrapper key (optional — body is auto-wrapped if not present). Inner fields: name (required), identifier (required), enabled (bool), pipelineIdentifier (required — target pipeline), type (required — Webhook/Scheduled/Artifact/Manifest), source (required — e.g. { type: 'Scheduled', spec: { type: 'Cron', spec: { expression: '0 8 * * *' } } }), inputYaml (optional — runtime input YAML for triggered execution)" },
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
            if (!body) return {};
            const inner = (body.trigger && typeof body.trigger === "object")
              ? body.trigger as Record<string, unknown>
              : body;
            if (inner.pipelineIdentifier && !input.pipeline_id) {
              input.pipeline_id = inner.pipelineIdentifier as string;
            }
            if (body.trigger && typeof body.trigger === "object") {
              return body;
            }
            return { trigger: body };
          },
          responseExtractor: ngExtract,
          description: "Update a pipeline trigger",
          bodySchema: {
            description: "Full trigger configuration (replaces existing). Pass the trigger fields directly — they will be auto-wrapped in a { trigger: { ... } } envelope.",
            fields: [
              { name: "trigger", type: "object", required: false, description: "Wrapper key (optional — body is auto-wrapped if not present). Inner fields: name, identifier, enabled, pipelineIdentifier, type, source, inputYaml" },
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
          responseExtractor: (raw: unknown) => {
            const r = raw as { data?: { inputSetTemplateYaml?: string; hasInputSets?: boolean; modules?: string[] } };
            return {
              inputSetTemplateYaml: r.data?.inputSetTemplateYaml ?? null,
              hasInputSets: r.data?.hasInputSets ?? false,
              modules: r.data?.modules ?? [],
              _hint: r.data?.inputSetTemplateYaml
                ? "This YAML template shows all runtime inputs needed. Fields with '<+input>' are required. Pass matching key-value pairs to harness_execute(action='run', inputs={...})."
                : "This pipeline has no runtime inputs. You can execute it without providing any inputs.",
            };
          },
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
        { name: "approval_status", description: "Approval status filter", enum: ["WAITING", "APPROVED", "REJECTED", "FAILED", "ABORTED", "EXPIRED"] },
        { name: "approval_type", description: "Approval type filter", enum: ["HarnessApproval", "JiraApproval", "CustomApproval", "ServiceNowApproval"] },
        { name: "node_execution_id", description: "Node execution ID to filter by step" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/v1/orgs/{org}/projects/{project}/approvals/execution/{executionId}",
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
