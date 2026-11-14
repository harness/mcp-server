import type { ToolsetDefinition, BodySchema, EndpointSpec, ParamsSchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { addRootCauseTheoryExtract, incidentGetExtract, offsetListExtract, projectIncident } from "../extractors.js";
import { MC_SCOPE } from "./scopes.js";
import { isRecord } from "../../utils/type-guards.js";

/**
 * Compact an incident list item. The list response carries the same multi-KB
 * keyEvents / rootCauseTheories arrays and narrative summary as the detail view;
 * the generic key whitelist would also drop the identifying `prettyId` (not an
 * *Id/Identifier suffix) and the `severity`/`impactedServices` fields an agent
 * needs. This keeps the identity and replaces the heavy timelines with counts.
 * Full timelines and summaries remain available via harness_get.
 */
function compactIncident(item: Record<string, unknown>): Record<string, unknown> {
  return projectIncident(item, false);
}

/**
 * Body field names are camelCase to match the Jackson-mapped Java DTOs
 * (CreateIncidentRequest / UpdateIncidentRequest) — no @JsonProperty overrides,
 * so the wire format is the field name verbatim.
 */
const incidentCreateSchema: BodySchema = {
  description: "New incident details (CreateIncidentRequest)",
  fields: [
    { name: "templateShortId", type: "string", required: true, description: "Short ID of the incident template to instantiate from" },
    { name: "title", type: "string", required: true, description: "Incident title" },
    { name: "summary", type: "string", required: false, description: "Free-text summary of the incident" },
    {
      name: "severity",
      type: "string",
      required: false,
      description: "Severity option id: 0 (SEV0: Critical), 1 (SEV1: Major), 2 (SEV2: Moderate), 3 (SEV3: Minor), 4 (SEV4: Cosmetic)",
    },
    { name: "impactedServices", type: "array", required: false, description: "Identifiers of impacted services", itemType: "string" },
    { name: "environments", type: "array", required: false, description: "Affected environments", itemType: "string" },
    { name: "commanderHarnessUserId", type: "string", required: false, description: "Harness user ID of the incident commander" },
    { name: "videoConferenceLink", type: "string", required: false, description: "URL to the incident video conference" },
    { name: "slackChannelUrl", type: "string", required: false, description: "URL to the incident Slack channel" },
    { name: "reportedAtTimestamp", type: "number", required: false, description: "Epoch-millis time the incident was reported" },
    { name: "customFields", type: "object", required: false, description: "Custom field key-value map" },
  ],
};

const incidentUpdateSchema: BodySchema = {
  description: "Incident fields to update (UpdateIncidentRequest — merge-patch, all optional)",
  fields: [
    { name: "title", type: "string", required: false, description: "Incident title" },
    { name: "summary", type: "string", required: false, description: "Free-text summary of the incident" },
    {
      name: "severity",
      type: "string",
      required: false,
      description: "Severity option id: 0 (SEV0: Critical), 1 (SEV1: Major), 2 (SEV2: Moderate), 3 (SEV3: Minor), 4 (SEV4: Cosmetic)",
    },
    { name: "status", type: "string", required: false, description: "Incident status (new, investigating, fixing, monitoring, closed)" },
    { name: "impactedServices", type: "array", required: false, description: "Identifiers of impacted services", itemType: "string" },
    { name: "environments", type: "array", required: false, description: "Affected environments", itemType: "string" },
    { name: "commanderHarnessUserId", type: "string", required: false, description: "Harness user ID of the incident commander" },
    { name: "videoConferenceLink", type: "string", required: false, description: "URL to the incident video conference" },
    { name: "customFields", type: "object", required: false, description: "Custom field key-value map" },
  ],
};

const theoryCitationFields: BodySchema["fields"] = [
  {
    name: "type",
    type: "string",
    required: true,
    description: "DEPLOY, PR, INCIDENT, ALERT, CHANGE, BUILD, FF, FLAG_CHANGE, TICKET or LINK. For an item "
      + "cited by web URL the type is a hint: the URL decides how it's stored",
  },
  {
    name: "id",
    type: "string",
    required: true,
    description: "The item's public ID (e.g. DEPL-12). For a PR, its web URL or "
      + "<repository identifier>#<PR number> for a repository in the incident's project's Harness Code "
      + "(e.g. checkout-service#42). Anything else, such as a pipeline execution, build, feature flag, "
      + "ticket or status page, by its web URL",
  },
];

const addRootCauseTheorySchema: BodySchema = {
  description: "Root-cause theory to add (AddRootCauseTheoryRequest)",
  fields: [
    { name: "message", type: "string", required: true, description: "The root-cause theory text" },
    {
      name: "status",
      type: "string",
      required: false,
      description: "Initial theory status: INVESTIGATING (default), CONFIRMED, or RULED_OUT",
    },
    {
      name: "confidence",
      type: "number",
      required: false,
      description:
        "Integer from 0 to 100. When omitted, CONFIRMED defaults to 95; INVESTIGATING and RULED_OUT default to 80",
    },
    {
      name: "relatedActivities",
      type: "array",
      required: false,
      description:
        "Items the theory cites, shown as links under it. Each is checked against the incident's project; "
        + "any that can't be found are returned in notLinked and the theory is still added. The items on a "
        + "CONFIRMED theory are recorded as the incident's cause.",
      itemType: "object",
      fields: theoryCitationFields,
    },
  ],
};

const updateRootCauseTheorySchema: BodySchema = {
  description:
    "Parts of the theory to change (UpdateRootCauseTheoryRequest). Omitted fields are unchanged; give at least "
    + "one of message, confidence, addRelatedActivities, removeRelatedActivities or clearRelatedActivities",
  fields: [
    { name: "message", type: "string", required: false, description: "The new theory text" },
    { name: "confidence", type: "number", required: false, description: "Integer from 0 to 100" },
    {
      name: "addRelatedActivities",
      type: "array",
      required: false,
      description:
        "Items to cite in addition to the current ones. Items that can't be found are returned in notLinked",
      itemType: "object",
      fields: theoryCitationFields,
    },
    {
      name: "removeRelatedActivities",
      type: "array",
      required: false,
      description:
        "Current citations to drop, each as the type and id of the theory's relatedActivities entry. Any the "
        + "theory doesn't cite are returned in notRemoved. An item can't be both added and removed",
      itemType: "object",
      fields: theoryCitationFields,
    },
    {
      name: "clearRelatedActivities",
      type: "boolean",
      required: false,
      description:
        "true to drop every current citation; with addRelatedActivities, replaces them. Can't be combined with "
        + "removeRelatedActivities",
    },
    { name: "reason", type: "string", required: false, description: "Why the theory is being changed" },
  ],
};

const removeRootCauseTheorySchema: BodySchema = {
  description: "Why the theory is being removed (RemoveRootCauseTheoryRequest)",
  fields: [
    { name: "reason", type: "string", required: true, description: "Why the theory no longer holds" },
  ],
};

const rootCauseTheoryParamsSchema: ParamsSchema = {
  fields: [
    { name: "theory_id", required: true, description: "Root-cause theory id (rootCauseTheories[].id from harness_get on the incident)" },
  ],
};

const THEORY_EDIT_RULES =
  "Only an INVESTIGATING theory can be changed; CONFIRMED and RULED_OUT theories can't. When the caller's "
  + "credential is the project's bound Agent Account, only AI-generated theories can be changed. Theories "
  + "not named are left as they are.";

const rootCauseTheoryStatusSchema: BodySchema = {
  description: "Concurrency check for a root-cause theory status change (RootCauseTheoryStatusRequest)",
  fields: [
    {
      name: "expectedOldRcaSha",
      type: "string",
      required: true,
      description: "rootCauseTheoriesSha from the most recent harness_get on the incident",
    },
  ],
};

function rootCauseTheoryStatusAction(
  pathSuffix: "confirm" | "rule-out" | "undo",
  effect: string,
): EndpointSpec & { actionDescription: string } {
  return {
    method: "POST",
    path: `/gateway/ir/tp/api/v1/mc/incidents/{incidentId}/root-cause-theories/{theoryId}/${pathSuffix}`,
    operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
    pathParams: { incident_id: "incidentId", theory_id: "theoryId" },
    paramsSchema: rootCauseTheoryParamsSchema,
    bodyBuilder: buildBodyNormalized(),
    bodySchema: rootCauseTheoryStatusSchema,
    responseExtractor: incidentGetExtract,
    actionDescription:
      `${effect} Pass theory_id via params and body.expectedOldRcaSha from the latest harness_get. `
      + "Fails if the incident's root-cause theories changed since that read: call harness_get again and retry "
      + "with the new rootCauseTheoriesSha. Returns the updated incident, including the new rootCauseTheoriesSha.",
  };
}

export const incidentsToolset: ToolsetDefinition = {
  name: "incidents",
  displayName: "AI-SRE Incidents",
  description: "Harness AI-SRE incident-management — list, inspect, create, update, and close incidents, and add, confirm, rule out, or undo their root-cause theories",
  resources: [
    {
      resourceType: "incident",
      displayName: "Incident",
      description: "AI-SRE incident-management entity. Supports list/get/create/update plus close and "
        + "root-cause theory actions (add, confirm, rule out, undo). "
        + "This entity carries current state only — the incident's history (runbook runs, pages, notes, status "
        + "changes) is a separate resource: harness_list(resource_type='activity_timeline', "
        + "filters={activity_id: <prettyId>}). An empty keyEvents here does not mean nothing happened.",
      toolset: "incidents",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["incident_id"],
      compactItem: compactIncident,
      relatedResources: [
        {
          resourceType: "activity_timeline",
          relationship: "child",
          description: "Chronological event stream for this incident; list it with filters.activity_id = the incident prettyId",
        },
      ],
      listFilterFields: [
        { name: "status", description: "Filter by incident status (multi-value). Matching is case-insensitive, but responses return status uppercase (e.g. CLOSED) — compare case-insensitively when post-filtering results", enum: ["new", "investigating", "fixing", "monitoring", "closed"] },
        { name: "severity", description: "Filter by severity option id (multi-value). 0 is the most severe (SEV0: Critical) through 4 (SEV4: Cosmetic)", enum: ["0", "1", "2", "3", "4"] },
        { name: "impacted_service", description: "Filter by impacted service (multi-value). Validated against the project's registered services — an unrecognized value returns an error, not an empty list" },
        { name: "environment", description: "Filter by environment (multi-value). Validated against the project's registered environments, so it is not free text — an unrecognized value returns an error, not an empty list" },
        { name: "commander", description: "Filter by incident commander (multi-value). Validated against the project's users — an unrecognized value returns an error, not an empty list" },
        { name: "text", description: "Free-text search across incident fields" },
        { name: "reported_after", description: "Only incidents reported after this time (ISO-8601)" },
        { name: "reported_before", description: "Only incidents reported before this time (ISO-8601)" },
        { name: "sort_field", description: "Field to sort by", enum: ["REPORTED_AT", "SEVERITY", "STATUS"] },
        { name: "sort_direction", description: "Sort direction", enum: ["ASC", "DESC"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/gateway/ir/tp/api/v1/mc/incidents",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            status: "status",
            severity: "severity",
            impacted_service: "impactedService",
            environment: "environment",
            commander: "commander",
            // harness_search and harness_list's top-level search_term both arrive as
            // `search_term`; without this mapping they were silently dropped and the
            // backend returned an unfiltered page that the caller read as matches.
            // Listed before `text` so an explicit text filter wins if both are set.
            search_term: "text",
            text: "text",
            reported_after: "reportedAfter",
            reported_before: "reportedBefore",
            sort_field: "sortField",
            sort_direction: "sortDirection",
            page: "page",
            size: "pageSize",
          },
          responseExtractor: offsetListExtract,
          description: "List incidents with filtering by status, severity, service, environment, commander, and text",
        },
        get: {
          method: "GET",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { incident_id: "incidentId" },
          responseExtractor: incidentGetExtract,
          description: "Get incident details by ID",
        },
        create: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/incidents",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildBodyNormalized(),
          responseExtractor: incidentGetExtract,
          description: "Create a new incident from a template",
          bodySchema: incidentCreateSchema,
        },
        update: {
          method: "PATCH",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { incident_id: "incidentId" },
          bodyBuilder: buildBodyNormalized(),
          responseExtractor: incidentGetExtract,
          description: "Update an incident (merge-patch; only provided fields change)",
          bodySchema: incidentUpdateSchema,
        },
      },
      executeActions: {
        close: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}/close",
          // low_write: bodyless, reversible state transition (status can be moved
          // back via update). Keeps it out of the "risky action requires bodySchema"
          // contract, which a no-body action cannot satisfy.
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { incident_id: "incidentId" },
          // No bodyBuilder — this is a bodyless POST. The dispatcher omits the
          // body entirely when bodyBuilder is absent.
          responseExtractor: incidentGetExtract,
          actionDescription: "Close an incident (transitions status to closed).",
        },
        add_root_cause_theory: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}/root-cause-theories",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { incident_id: "incidentId" },
          bodyBuilder: buildBodyNormalized(),
          bodySchema: addRootCauseTheorySchema,
          responseExtractor: addRootCauseTheoryExtract,
          actionDescription:
            "Add a root-cause theory to an incident. Authorship is decided from the caller's Harness credential, "
            + "not a body field: the theory is AI-generated only when that credential is the project's bound "
            + "Agent Account service account. Every other caller, including another agent, is recorded as "
            + "human-authored. status applies to a theory being created. Sending RULED_OUT here does not rule "
            + "out a theory that already exists; use rule_out_root_cause_theory for that. If a theory with the "
            + "same message already exists, no duplicate is created: the cited items are added to the existing "
            + "theory, which is returned with created=false and its status and confidence left unchanged. Adding "
            + "items to that theory follows the same rules as update_root_cause_theory: it must be INVESTIGATING "
            + "and, for an Agent Account caller, AI-generated; re-sending items it already cites succeeds. Cited "
            + "items that weren't found are returned in notLinked and aren't linked; those that couldn't be "
            + "checked, have no activity in the incident's project, or whose URL isn't the cited type are "
            + "returned in unverified and are linked as cited. The response's theory.id identifies the theory "
            + "for later status changes. The response does not include rootCauseTheoriesSha, and an add that "
            + "changes the theories (a new theory, or new citations on an existing one) changes it, so call "
            + "harness_get before confirming, ruling out, or undoing a theory.",
        },
        update_root_cause_theory: {
          method: "PATCH",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}/root-cause-theories/{theoryId}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { incident_id: "incidentId", theory_id: "theoryId" },
          paramsSchema: rootCauseTheoryParamsSchema,
          bodyBuilder: buildBodyNormalized(),
          bodySchema: updateRootCauseTheorySchema,
          responseExtractor: addRootCauseTheoryExtract,
          actionDescription:
            "Change a root-cause theory's message, confidence or cited items. Pass theory_id via params and only "
            + "the parts that change in the body. Citations not named in removeRelatedActivities are kept; name "
            + "one to remove by the type and id of its relatedActivities entry from harness_get. To confirm a "
            + "theory, use confirm_root_cause_theory. "
            + THEORY_EDIT_RULES
            + " Returns the theory as changed, with notLinked and unverified as for add_root_cause_theory, and "
            + "notRemoved for removeRelatedActivities items the theory doesn't cite.",
        },
        remove_root_cause_theory: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}/root-cause-theories/{theoryId}/remove",
          // Deletes the theory with no undo, so it prompts (or needs confirm: true) like any delete.
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: { incident_id: "incidentId", theory_id: "theoryId" },
          paramsSchema: rootCauseTheoryParamsSchema,
          bodyBuilder: buildBodyNormalized(),
          bodySchema: removeRootCauseTheorySchema,
          responseExtractor: incidentGetExtract,
          actionDescription:
            "Delete a root-cause theory that is wrong or superseded. Pass theory_id via params and body.reason. "
            + "To keep a theory on record as excluded, use rule_out_root_cause_theory instead. "
            + THEORY_EDIT_RULES
            + " Returns the updated incident.",
        },
        confirm_root_cause_theory: rootCauseTheoryStatusAction(
          "confirm",
          "Mark a root-cause theory as the confirmed root cause.",
        ),
        rule_out_root_cause_theory: rootCauseTheoryStatusAction(
          "rule-out",
          "Mark a root-cause theory as ruled out.",
        ),
        undo_root_cause_theory_status: rootCauseTheoryStatusAction(
          "undo",
          "Return a confirmed or ruled-out root-cause theory to INVESTIGATING.",
        ),
      },
    },
  ],
};
