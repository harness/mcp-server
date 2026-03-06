import type { ToolsetDefinition, BodySchema } from "../types.js";
import { ngExtract, pageExtract, passthrough } from "../extractors.js";

const ngExtractWithInlineStore = (raw: unknown) => {
  const result = ngExtract(raw);
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (!r.storeType) r.storeType = "INLINE";
  }
  return result;
};

const pipelineCreateSchema: BodySchema = {
  description: "Pipeline YAML definition",
  fields: [
    { name: "pipeline", type: "object", required: true, description: "Pipeline object with name, identifier, and stages", fields: [
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
      listFilterFields: ["search_term", "module", "filter_type"],
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
            return input.body;
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
          queryParams: { module: "module" },
          bodyBuilder: (input) => input.inputs ?? {},
          responseExtractor: ngExtract,
          actionDescription: "Execute/run a pipeline. Pass runtime inputs via 'inputs' field.",
        },
        retry: {
          method: "PUT",
          path: "/pipeline/api/pipeline/execute/retry/{planExecutionId}",
          pathParams: { execution_id: "planExecutionId" },
          queryParams: { module: "module" },
          bodyBuilder: () => ({}),
          responseExtractor: ngExtract,
          actionDescription: "Retry a failed pipeline execution.",
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
      listFilterFields: ["pipeline_id", "status", "module"],
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
      listFilterFields: ["pipeline_id", "search_term"],
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
          bodyBuilder: (input) => input.body,
          responseExtractor: ngExtract,
          description: "Create a new pipeline trigger",
        },
        update: {
          method: "PUT",
          path: "/pipeline/api/triggers/{triggerIdentifier}",
          pathParams: { trigger_id: "triggerIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: ngExtract,
          description: "Update a pipeline trigger",
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
      listFilterFields: ["pipeline_id"],
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
      resourceType: "approval_instance",
      displayName: "Approval Instance",
      description:
        "Pipeline approval instances. List approvals for an execution (filter by status/type), or approve/reject a waiting approval. Use with harness_list to find pending approvals, then harness_execute to approve or reject.",
      toolset: "pipelines",
      scope: "project",
      identifierFields: ["execution_id"],
      listFilterFields: ["approval_status", "approval_type", "node_execution_id"],
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
          responseExtractor: (raw: unknown): { items: unknown[]; total: number } => {
            const arr = Array.isArray(raw) ? raw : [];
            return { items: arr, total: arr.length };
          },
          description: "List approval instances for a pipeline execution. Filter by approval_status (WAITING, APPROVED, REJECTED, FAILED, ABORTED, EXPIRED) and approval_type (HarnessApproval, JiraApproval, CustomApproval, ServiceNowApproval).",
        },
      },
      executeActions: {
        approve: {
          method: "POST",
          path: "/pipeline/api/approvals/{approvalInstanceId}/harness/activity",
          pathParams: { approval_id: "approvalInstanceId" },
          bodyBuilder: (input) => ({
            action: "APPROVE",
            comments: input.comments ?? "",
            ...(input.approver_inputs ? { approverInputs: input.approver_inputs } : {}),
          }),
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
          bodyBuilder: (input) => ({
            action: "REJECT",
            comments: input.comments ?? "",
          }),
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
