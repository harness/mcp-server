import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { offsetListExtract, passthrough } from "../extractors.js";

/**
 * Incident-management scope override — the incidents API uses
 * accountId / orgId / projectId instead of the standard NG
 * accountIdentifier / orgIdentifier / projectIdentifier.
 *
 * The client still appends its default `accountIdentifier` query param; the
 * Java side ignores unknown params (same pattern STO relies on).
 */
const INCIDENT_SCOPE = { account: "accountId", org: "orgId", project: "projectId" } as const;

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
      scopeParams: INCIDENT_SCOPE,
      identifierFields: ["incident_id"],
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
          responseExtractor: passthrough,
          description: "Get incident details by ID",
        },
        create: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/incidents",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildBodyNormalized(),
          responseExtractor: passthrough,
          description: "Create a new incident from a template",
          bodySchema: incidentCreateSchema,
        },
        update: {
          method: "PATCH",
          path: "/gateway/ir/tp/api/v1/mc/incidents/{incidentId}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { incident_id: "incidentId" },
          bodyBuilder: buildBodyNormalized(),
          responseExtractor: passthrough,
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
          responseExtractor: passthrough,
          actionDescription: "Close an incident (transitions status to closed).",
        },
      },
    },
  ],
};
