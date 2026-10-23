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

/** Execute arguments arrive under `body`; resource_id may also have filled service_id. */
async function runPreflight({ input }: PreflightContext): Promise<void> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  if ((input.service_id === undefined || input.service_id === "") && typeof body.service_id === "string") {
    input.service_id = body.service_id;
  }
}

/** Sends only what the REST endpoint accepts; the runbook id travels in the path, not the body. */
function runBodyBuilder(input: Record<string, unknown>): Record<string, unknown> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const incidentId = body.incidentId ?? body.incident_id;
  return {
    inputs: body.inputs ?? {},
    ...(typeof incidentId === "string" && incidentId.trim() !== "" ? { incidentId } : {}),
  };
}

const runBodySchema: BodySchema = {
  description: "Runbook execution request",
  fields: [
    {
      name: "service_id",
      type: "string",
      required: false,
      description: "Required unless passed as resource_id. Runbook serviceId from harness_list resource_type=runbook",
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
      name: "incidentId",
      type: "string",
      required: false,
      description: "Incident pretty id (e.g. IR3586-1) to link the run to. Omit for a standalone run.",
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
      identifierFields: ["service_id"],
      searchAliases: ["runbook", "runbooks", "scripted action", "playbook", "remediation"],
      diagnosticHint:
        "harness_list(resource_type='runbook', filters={incident_id:'INC-123'}) returns the runbooks valid for that "
        + "incident's template; omit incident_id for every AI-exposed runbook in the project. "
        + "Then harness_get(resource_type='runbook', resource_id=<serviceId>) for the inputs.",
      executeHint:
        "harness_execute(resource_type='runbook', action='run', body={service_id, inputs:{...}, incidentId?}) "
        + "returns a scriptRunId immediately. Poll harness_get(resource_type='runbook_execution', "
        + "resource_id=<scriptRunId>, params={service_id}) until status is SUCCESS or ERROR. "
        + "Do not run the same runbook twice for the same question.",
      relatedResources: [
        { resourceType: "runbook_execution", relationship: "child", description: "Runs of this runbook; poll one by script_run_id" },
        { resourceType: "incident", relationship: "parent", description: "Optional incident a run is linked to" },
      ],
      listFilterFields: [
        {
          name: "incident_id",
          description: "Incident pretty id; narrows the list to runbooks valid for that incident's template",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: RUNBOOKS_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: { incident_id: "incidentId", page: "page", size: "pageSize" },
          // Agents only discover runbooks the owner enabled Expose to AI on.
          defaultQueryParams: { exposedToAi: "true" },
          responseExtractor: runbookListExtract,
          description: "List AI-exposed runbooks, optionally narrowed to an incident (filters.incident_id)",
        },
        get: {
          method: "GET",
          path: RUNBOOK_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { service_id: "runbookId" },
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
          pathParams: { service_id: "runbookId" },
          preflight: runPreflight,
          bodyBuilder: runBodyBuilder,
          bodySchema: runBodySchema,
          responseExtractor: runbookRunExtract,
          actionDescription:
            "Start a runbook. Returns {scriptRunId} immediately; the run is asynchronous and may take minutes. "
            + "Poll with harness_get resource_type='runbook_execution'. Not safe to retry: a retry starts a second run.",
        },
      },
    },
    {
      resourceType: "runbook_execution",
      displayName: "Runbook Execution",
      description:
        "One run of a runbook, found by script_run_id (resource_id) + params.service_id. Includes standalone runs and runs linked to incidents. "
        + "Poll until status is SUCCESS or ERROR (PENDING and RUNNING are not final).",
      toolset: "runbooks",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["service_id", "script_run_id"],
      searchAliases: ["runbook run", "runbook status", "script run"],
      diagnosticHint:
        "harness_get(resource_type='runbook_execution', resource_id=<scriptRunId>, params={service_id}) polls one run. "
        + "harness_list with filters={service_id} lists recent runs of a runbook, newest first.",
      listFilterFields: [
        { name: "service_id", required: true, description: "Runbook serviceId" },
        { name: "cursor", description: "paginationToken from the previous page" },
      ],
      operations: {
        list: {
          method: "GET",
          path: EXECUTIONS_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { service_id: "runbookId" },
          queryParams: { cursor: "cursor", size: "pageSize" },
          responseExtractor: runbookExecutionListExtract,
          skipCompact: true,
          description: "List recent runs of a runbook, newest first (filters.service_id required)",
        },
        get: {
          method: "GET",
          path: `${EXECUTIONS_PATH}/{scriptRunId}`,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { service_id: "runbookId", script_run_id: "scriptRunId" },
          responseExtractor: runbookExecutionGetExtract,
          skipCompact: true,
          description: "Get one run's status, errorMessage and outputs by service_id + script_run_id",
        },
      },
    },
  ],
};
