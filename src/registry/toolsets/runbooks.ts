import type { ToolsetDefinition, BodySchema, PreflightContext } from "../types.js";
import { MC_SCOPE } from "./scopes.js";
import {
  runbookListExtract,
  runbookGetExtract,
  runbookRunExtract,
  runbookExecutionListExtract,
  runbookExecutionGetExtract,
} from "../extractors.js";

const RUNBOOKS_PATH = "/gateway/ir/tp/api/v1/mc/runbooks";
/** The runbook id contains `::` and `/`; the registry percent-encodes it into this one segment. */
const RUNBOOK_PATH = `${RUNBOOKS_PATH}/{runbookId}`;
const EXECUTIONS_PATH = `${RUNBOOK_PATH}/executions`;

/** Execute arguments arrive under `body`; resource_id may also have filled runbook_id. */
async function runPreflight({ input }: PreflightContext): Promise<void> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  if ((input.runbook_id === undefined || input.runbook_id === "") && typeof body.runbook_id === "string") {
    input.runbook_id = body.runbook_id;
  }
}

/** Sends only what the REST endpoint accepts; the runbook id travels in the path, not the body. */
function runBodyBuilder(input: Record<string, unknown>): Record<string, unknown> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const activityId = body.activityId ?? body.activity_id ?? body.incidentId ?? body.incident_id;
  return {
    inputs: body.inputs ?? {},
    ...(typeof activityId === "string" && activityId.trim() !== "" ? { activityId } : {}),
  };
}

const runBodySchema: BodySchema = {
  description: "Runbook execution request",
  fields: [
    {
      name: "runbook_id",
      type: "string",
      required: false,
      description: "Required unless passed as resource_id. Runbook runbookId from harness_list resource_type=runbook",
    },
    {
      name: "inputs",
      type: "object",
      required: false,
      description:
        "Runbook inputs as {name: value}. Names and required inputs come from harness_get resource_type=runbook. "
        + "Objects and arrays are JSON-encoded by the server. Unknown or missing required inputs are rejected with a 400.",
    },
    {
      name: "activityId",
      type: "string",
      required: false,
      description: "Incident or alert public id (e.g. INC-123) to link the run to. Omit for a standalone run.",
    },
  ],
};

export const runbooksToolset: ToolsetDefinition = {
  name: "runbooks",
  displayName: "AI-SRE Runbooks",
  description: "Harness AI-SRE runbooks — discover runbooks exposed to AI, inspect their inputs, run them, and poll run status",
  resources: [
    {
      resourceType: "runbook",
      displayName: "Runbook",
      description:
        "An AI-SRE runbook (scripted action). Only runbooks whose owner enabled Expose to AI are returned. "
        + "List with harness_list, read inputs with harness_get, run with harness_execute action='run'. "
        + "A run is asynchronous: poll it with resource_type='runbook_execution'.",
      toolset: "runbooks",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["runbook_id"],
      searchAliases: ["runbook", "runbooks", "scripted action", "playbook", "remediation"],
      diagnosticHint:
        "harness_list(resource_type='runbook', filters={activity_id:'INC-123'}) returns the runbooks valid for that "
        + "activity's template; omit activity_id for every AI-exposed runbook in the project. "
        + "Then harness_get(resource_type='runbook', resource_id=<runbookId>) for the inputs.",
      executeHint:
        "harness_execute(resource_type='runbook', action='run', body={runbook_id, inputs:{...}, activityId?}) "
        + "returns a runbookExecutionId immediately. Poll harness_get(resource_type='runbook_execution', "
        + "resource_id=<runbookExecutionId>, params={runbook_id}) until status is SUCCESS or ERROR. "
        + "Do not run the same runbook twice for the same question.",
      relatedResources: [
        { resourceType: "runbook_execution", relationship: "child", description: "Runs of this runbook; poll one by runbook_execution_id" },
        { resourceType: "incident", relationship: "parent", description: "Optional incident a run is linked to" },
      ],
      listFilterFields: [
        {
          name: "activity_id",
          description: "Incident or alert public id; narrows the list to runbooks valid for that activity's template",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: RUNBOOKS_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { activity_id: "activityId", page: "page", size: "pageSize" },
          // Agents only discover runbooks the owner enabled Expose to AI on.
          defaultQueryParams: { exposedToAi: "true" },
          responseExtractor: runbookListExtract,
          description: "List AI-exposed runbooks, optionally narrowed to an incident or alert (filters.activity_id)",
        },
        get: {
          method: "GET",
          path: RUNBOOK_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { runbook_id: "runbookId" },
          responseExtractor: runbookGetExtract,
          description: "Get a runbook's description, inputs (name, type, required, default) and outputs",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: EXECUTIONS_PATH,
          // low_write: autonomous agents cannot answer an elicitation, and the runbook owner's
          // Expose to AI toggle is the opt-in; the in-product investigator runs runbooks unprompted.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { runbook_id: "runbookId" },
          preflight: runPreflight,
          bodyBuilder: runBodyBuilder,
          bodySchema: runBodySchema,
          responseExtractor: runbookRunExtract,
          actionDescription:
            "Start a runbook. Returns {runbookExecutionId} immediately; the run is asynchronous and may take minutes. "
            + "Poll with harness_get resource_type='runbook_execution'. Not safe to retry: a retry starts a second run.",
        },
      },
    },
    {
      resourceType: "runbook_execution",
      displayName: "Runbook Execution",
      description:
        "One run of a runbook, found by runbook_execution_id (resource_id) + params.runbook_id. Includes standalone runs and runs linked to incidents. "
        + "Poll until status is SUCCESS or ERROR (PENDING and RUNNING are not final).",
      toolset: "runbooks",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["runbook_id", "runbook_execution_id"],
      searchAliases: ["runbook run", "runbook status", "runbook execution"],
      diagnosticHint:
        "harness_get(resource_type='runbook_execution', resource_id=<runbookExecutionId>, params={runbook_id}) polls one run. "
        + "harness_list with filters={runbook_id} lists recent runs of a runbook, newest first.",
      listFilterFields: [
        { name: "runbook_id", required: true, description: "Runbook runbookId" },
        { name: "cursor", description: "paginationToken from the previous page" },
      ],
      operations: {
        list: {
          method: "GET",
          path: EXECUTIONS_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { runbook_id: "runbookId" },
          queryParams: { cursor: "cursor", size: "pageSize" },
          responseExtractor: runbookExecutionListExtract,
          skipCompact: true,
          description: "List recent runs of a runbook, newest first (filters.runbook_id required)",
        },
        get: {
          method: "GET",
          path: `${EXECUTIONS_PATH}/{runbookExecutionId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { runbook_id: "runbookId", runbook_execution_id: "runbookExecutionId" },
          responseExtractor: runbookExecutionGetExtract,
          skipCompact: true,
          description: "Get one run's status, errorMessage and outputs by runbook_id + runbook_execution_id",
        },
      },
    },
  ],
};
