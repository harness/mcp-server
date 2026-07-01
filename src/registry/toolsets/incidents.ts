import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { offsetListExtract } from "../extractors.js";
import { MC_SCOPE } from "./scopes.js";
import { isRecord } from "../../utils/type-guards.js";

/**
 * Project a single root-cause theory to its stable, agent-relevant fields,
 * dropping any backend-internal keys the API may add.
 */
function projectRootCauseTheory(t: unknown): unknown {
  if (!isRecord(t)) return t;
  const out: Record<string, unknown> = {};
  if (typeof t.message === "string") out.message = t.message;
  if (typeof t.status === "string") out.status = t.status;
  if (typeof t.confidence === "number") out.confidence = t.confidence;
  if (typeof t.aiGenerated === "boolean") out.aiGenerated = t.aiGenerated;
  return out;
}

/**
 * Project a single key-event entry to its stable fields.
 */
function projectKeyEvent(e: unknown): unknown {
  if (!isRecord(e)) return e;
  const out: Record<string, unknown> = {};
  if (typeof e.timestamp === "number") out.timestamp = e.timestamp;
  if (typeof e.status === "string") out.status = e.status;
  if (typeof e.details === "string") out.details = e.details;
  return out;
}

/**
 * Project the common incident fields shared by the detail view and the list
 * compactor. Emits a stable, documented shape and drops backend
 * envelope/debug/meta. `verbose` controls whether the heavy event/theory
 * arrays are projected in full (detail view) or replaced with counts (list).
 */
function projectIncident(raw: Record<string, unknown>, verbose: boolean): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  // Identity + core status
  if (typeof raw.prettyId === "string") slim.prettyId = raw.prettyId;
  if (typeof raw.projectId === "string") slim.projectId = raw.projectId;
  if (typeof raw.title === "string") slim.title = raw.title;
  if (typeof raw.status === "string") slim.status = raw.status;
  // severity is an object { id, label } in the response (not a bare string)
  if (raw.severity !== undefined) slim.severity = raw.severity;
  if (typeof raw.summary === "string") slim.summary = raw.summary;
  if (Array.isArray(raw.impactedServices)) slim.impactedServices = raw.impactedServices;
  if (Array.isArray(raw.environments)) slim.environments = raw.environments;
  // reporter/commander are user objects (or null)
  if (raw.reporter !== undefined) slim.reporter = raw.reporter;
  if (raw.commander !== undefined) slim.commander = raw.commander;
  if (typeof raw.videoConferenceLink === "string") slim.videoConferenceLink = raw.videoConferenceLink;
  if (Array.isArray(raw.commsLinks)) slim.commsLinks = raw.commsLinks;
  // Lifecycle timestamps (epoch-millis). Keep all that are present and non-null.
  for (const key of [
    "reportedAtTimestamp", "startedAtTimestamp", "acknowledgedAtTimestamp",
    "mitigatedAtTimestamp", "resolvedAtTimestamp", "closedAtTimestamp",
    "responderAssignedAtTimestamp",
  ]) {
    if (typeof raw[key] === "number") slim[key] = raw[key];
  }
  // Heavy arrays: full projection in the detail view, counts only in lists.
  if (Array.isArray(raw.keyEvents)) {
    slim.keyEvents = verbose ? raw.keyEvents.map(projectKeyEvent) : raw.keyEvents.length;
  }
  if (Array.isArray(raw.rootCauseTheories)) {
    slim.rootCauseTheories = verbose
      ? raw.rootCauseTheories.map(projectRootCauseTheory)
      : raw.rootCauseTheories.length;
  }
  if (Array.isArray(raw.relatedActivities) && raw.relatedActivities.length > 0) {
    slim.relatedActivities = raw.relatedActivities;
  }
  return slim;
}

/**
 * Extract an incident detail response (get/create/update/close all return the
 * same incident DTO). Projects a stable shape and strips backend
 * envelope/debug/meta fields. Keeps the full keyEvents/rootCauseTheories
 * timeline since this is the detail view.
 */
function incidentGetExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return projectIncident(raw, true);
}

/**
 * Compact an incident list item. The list response carries the same multi-KB
 * keyEvents / rootCauseTheories arrays as the detail view; the generic key
 * whitelist would also drop the identifying `prettyId` (not an *Id/Identifier
 * suffix) and the `severity`/`impactedServices` fields an agent needs. This
 * keeps the identity and replaces the heavy timelines with counts. Full
 * timelines remain available via harness_get.
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
    { name: "severity", type: "string", required: false, description: "Severity identifier" },
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
    { name: "severity", type: "string", required: false, description: "Severity identifier" },
    { name: "status", type: "string", required: false, description: "Incident status (new, investigating, fixing, monitoring, closed)" },
    { name: "impactedServices", type: "array", required: false, description: "Identifiers of impacted services", itemType: "string" },
    { name: "environments", type: "array", required: false, description: "Affected environments", itemType: "string" },
    { name: "commanderHarnessUserId", type: "string", required: false, description: "Harness user ID of the incident commander" },
    { name: "videoConferenceLink", type: "string", required: false, description: "URL to the incident video conference" },
    { name: "customFields", type: "object", required: false, description: "Custom field key-value map" },
  ],
};

export const incidentsToolset: ToolsetDefinition = {
  name: "incidents",
  displayName: "Incidents",
  description: "Harness incident-management — list, inspect, create, update, and close incidents",
  resources: [
    {
      resourceType: "incident",
      displayName: "Incident",
      description: "Incident-management entity. Supports list/get/create/update plus a close action.",
      toolset: "incidents",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["incident_id"],
      compactItem: compactIncident,
      listFilterFields: [
        { name: "status", description: "Filter by incident status (multi-value)", enum: ["new", "investigating", "fixing", "monitoring", "closed"] },
        { name: "severity", description: "Filter by severity (multi-value)" },
        { name: "impacted_service", description: "Filter by impacted service (multi-value)" },
        { name: "environment", description: "Filter by environment (multi-value)" },
        { name: "commander", description: "Filter by incident commander (multi-value)" },
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
      },
    },
  ],
};
