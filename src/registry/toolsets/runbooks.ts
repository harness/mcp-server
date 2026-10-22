import type { ToolsetDefinition, BodySchema, PreflightContext } from "../types.js";
import { MC_SCOPE } from "./scopes.js";
import {
  runbookListExtract,
  runbookGetExtract,
  runbookRunExtract,
  runbookExecutionListExtract,
  runbookExecutionGetExtract,
} from "../extractors.js";

const GRAPHQL_PATH = "/gateway/ir/tp/api/v1/mc/graphql/harness/query";

/** Largest page of runs scanned when looking up one run by id (newest first). */
const EXECUTION_LOOKUP_PAGE_SIZE = 50;

const LIST_RUNBOOKS_QUERY = `query ListRunbooks($activityTemplateGlobalId: String) {
  scriptedActions(activityTemplateGlobalId: $activityTemplateGlobalId) {
    actions { serviceId displayName description exposeToAi }
  }
}`;

const GET_RUNBOOK_QUERY = `query GetRunbook($serviceId: String!) {
  scriptedAction(serviceId: $serviceId) {
    action {
      serviceId displayName description exposeToAi
      inputs {
        name type required description
        default { __typename ... on TextParam { text } }
      }
      outputs { param { name type description } }
    }
  }
}`;

const ACTIVITY_LOOKUP_QUERY = `query ActivityLookup($publicId: String!) {
  activity(activityPublicId: $publicId) { id publicId templateGlobalId }
}`;

const EXECUTE_RUNBOOK_MUTATION = `mutation ExecuteRunbook(
  $serviceId: String!
  $parameters: [ExecuteScriptedActionParameterInput!]!
  $keys: [ConnectorDefaultKeyInput!]!
  $isTest: Boolean
  $activityGlobalId: String
) {
  executeScriptedAction(
    serviceId: $serviceId
    parameters: $parameters
    keys: $keys
    isTest: $isTest
    activityGlobalId: $activityGlobalId
  ) {
    scriptRunId success errors { message }
  }
}`;

const RUNBOOK_EXECUTIONS_QUERY = `query RunbookExecutions($scriptedActionId: String!, $pageSize: Int, $paginationToken: String) {
  runbookExecutions(scriptedActionId: $scriptedActionId, pageSize: $pageSize, paginationToken: $paginationToken) {
    executions { scriptRunId timestamp status incidentPublicId triggeredByName triggeredByAiAgent errorMessage outputsJson }
    paginationToken
    hasMore
  }
}`;

interface RunbookInput {
  name: string;
  type: string;
  required: boolean;
}

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

function scopeParams(input: Record<string, unknown>, ctx: PreflightContext): Record<string, string> {
  const params: Record<string, string> = {};
  const accountId = ctx.accountId ?? ctx.client.account;
  const orgId = input.org_id ?? ctx.registry.orgId;
  const projectId = input.project_id ?? ctx.registry.projectId;
  if (accountId) params.accountId = String(accountId);
  if (orgId) params.orgId = String(orgId);
  if (projectId) params.projectId = String(projectId);
  return params;
}

async function graphql<T>(
  ctx: PreflightContext,
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const raw = await ctx.client.request<GraphqlEnvelope<T>>({
    method: "POST",
    path: GRAPHQL_PATH,
    params: scopeParams(ctx.input, ctx),
    body: { operationName, query, variables },
    signal: ctx.signal,
  });
  if (raw.errors?.length) {
    throw new Error(raw.errors.map((e) => e.message ?? "unknown GraphQL error").join("; "));
  }
  if (!raw.data) {
    throw new Error(`${operationName} returned no data`);
  }
  return raw.data;
}

function requireString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value;
}

async function resolveActivity(
  ctx: PreflightContext,
  incidentId: string,
): Promise<{ id: string; templateGlobalId: string }> {
  try {
    const data = await graphql<{ activity: { id: string; templateGlobalId: string } }>(
      ctx,
      "ActivityLookup",
      ACTIVITY_LOOKUP_QUERY,
      { publicId: incidentId },
    );
    return data.activity;
  } catch (e) {
    throw new Error(`Could not resolve incident_id "${incidentId}": ${(e as Error).message}`);
  }
}

/** Narrows the runbook list to those valid for the incident's template, as the in-product AI does. */
async function listPreflight(ctx: PreflightContext): Promise<void> {
  const incidentId = ctx.input.incident_id;
  if (typeof incidentId === "string" && incidentId.trim() !== "") {
    ctx.input._templateGlobalId = (await resolveActivity(ctx, incidentId)).templateGlobalId;
  }
}

/**
 * Builds the typed parameter list the execute mutation needs from the runbook's declared
 * inputs, so an agent only supplies `{name: value}` and cannot send an undeclared input.
 */
async function runPreflight(ctx: PreflightContext): Promise<void> {
  const { input } = ctx;
  // Execute arguments arrive under `body`; resource_id may also have filled service_id.
  const body = (input.body ?? {}) as Record<string, unknown>;
  const serviceId = requireString({ service_id: input.service_id ?? body.service_id }, "service_id");
  const supplied = (body.inputs ?? {}) as Record<string, unknown>;
  const incidentId = body.incident_id;

  const data = await graphql<{
    scriptedAction: { action: { inputs: RunbookInput[] } | null };
  }>(ctx, "GetRunbook", GET_RUNBOOK_QUERY, { serviceId });
  const action = data.scriptedAction.action;
  if (!action) {
    throw new Error(`Runbook "${serviceId}" not found`);
  }

  const declared = new Map(action.inputs.map((i) => [i.name, i]));
  const unknown = Object.keys(supplied).filter((name) => !declared.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown input(s) for runbook "${serviceId}": ${unknown.join(", ")}. `
        + `Declared inputs: ${[...declared.keys()].join(", ") || "(none)"}.`,
    );
  }
  const missing = action.inputs.filter((i) => i.required && supplied[i.name] === undefined);
  if (missing.length > 0) {
    throw new Error(`Missing required input(s) for runbook "${serviceId}": ${missing.map((i) => i.name).join(", ")}.`);
  }

  input._serviceId = serviceId;
  input._parameters = Object.entries(supplied).map(([name, value]) => ({
    name,
    type: declared.get(name)!.type,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));

  if (typeof incidentId === "string" && incidentId.trim() !== "") {
    input._activityGlobalId = (await resolveActivity(ctx, incidentId)).id;
  }
}

// Fields are marked optional because the registry validates required fields against the built
// GraphQL envelope, not the caller's body; runPreflight enforces service_id and the runbook's inputs.
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
        + "Non-string values are JSON-encoded.",
    },
    {
      name: "incident_id",
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
        "harness_execute(resource_type='runbook', action='run', body={service_id, inputs:{...}, incident_id?}) "
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
          method: "POST",
          path: GRAPHQL_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          preflight: listPreflight,
          bodyBuilder: (input) => ({
            operationName: "ListRunbooks",
            query: LIST_RUNBOOKS_QUERY,
            variables: { activityTemplateGlobalId: input._templateGlobalId ?? null },
          }),
          responseExtractor: runbookListExtract,
          description: "List AI-exposed runbooks, optionally narrowed to an incident (filters.incident_id)",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            operationName: "GetRunbook",
            query: GET_RUNBOOK_QUERY,
            variables: { serviceId: requireString(input, "service_id") },
          }),
          responseExtractor: runbookGetExtract,
          description: "Get a runbook's description, inputs (name, type, required, default) and outputs",
        },
      },
      executeActions: {
        run: {
          method: "POST",
          path: GRAPHQL_PATH,
          // low_write: autonomous agents cannot answer an elicitation, and the runbook owner's
          // Expose to AI toggle is the opt-in; the in-product investigator runs runbooks unprompted.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          preflight: runPreflight,
          bodyBuilder: (input) => ({
            operationName: "ExecuteRunbook",
            query: EXECUTE_RUNBOOK_MUTATION,
            variables: {
              serviceId: input._serviceId,
              parameters: input._parameters,
              keys: [],
              // Always sent: a null isTest fails server-side.
              isTest: false,
              activityGlobalId: input._activityGlobalId ?? null,
            },
          }),
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
          method: "POST",
          path: GRAPHQL_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            operationName: "RunbookExecutions",
            query: RUNBOOK_EXECUTIONS_QUERY,
            variables: {
              scriptedActionId: requireString(input, "service_id"),
              pageSize: typeof input.size === "number" ? input.size : EXECUTION_LOOKUP_PAGE_SIZE,
              paginationToken: input.cursor ?? null,
            },
          }),
          responseExtractor: runbookExecutionListExtract,
          description: "List recent runs of a runbook, newest first (filters.service_id required)",
        },
        get: {
          method: "POST",
          path: GRAPHQL_PATH,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({
            operationName: "RunbookExecutions",
            query: RUNBOOK_EXECUTIONS_QUERY,
            variables: {
              scriptedActionId: requireString(input, "service_id"),
              pageSize: EXECUTION_LOOKUP_PAGE_SIZE,
              paginationToken: null,
            },
          }),
          responseExtractor: runbookExecutionGetExtract,
          description: "Get one run's status by service_id + script_run_id",
        },
      },
    },
  ],
};
