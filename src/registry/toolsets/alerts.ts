import type { ToolsetDefinition, BodySchema } from "../types.js";
import { buildBodyNormalized } from "../../utils/body-normalizer.js";
import { offsetListExtract } from "../extractors.js";
import { MC_SCOPE } from "./scopes.js";
import { isRecord } from "../../utils/type-guards.js";

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
 * Max description length kept in list view. Ingested alerts (PagerDuty webhooks
 * and similar) carry ~1-2KB of boilerplate here, which dominates a list payload
 * once multiplied by the page size. The full text stays available via harness_get.
 */
const LIST_DESCRIPTION_MAX = 400;

/**
 * Project the common alert fields shared by the detail view and the list
 * compactor. Emits a stable, documented shape and drops backend
 * envelope/debug/meta. `verbose` controls whether the heavy keyEvents array
 * is projected in full (detail view) or replaced with a count (list), and
 * whether description is kept in full or truncated.
 */
function projectAlert(raw: Record<string, unknown>, verbose: boolean): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  if (typeof raw.prettyId === "string") slim.prettyId = raw.prettyId;
  if (typeof raw.projectId === "string") slim.projectId = raw.projectId;
  if (typeof raw.title === "string") slim.title = raw.title;
  if (typeof raw.description === "string") {
    slim.description = verbose || raw.description.length <= LIST_DESCRIPTION_MAX
      ? raw.description
      : `${raw.description.slice(0, LIST_DESCRIPTION_MAX)}… [truncated — use harness_get for the full description]`;
  }
  if (typeof raw.status === "string") slim.status = raw.status;
  // priority is an object { id, label } in the response (not a bare string)
  if (raw.priority !== undefined) slim.priority = raw.priority;
  if (Array.isArray(raw.impactedServices)) slim.impactedServices = raw.impactedServices;
  if (Array.isArray(raw.environments)) slim.environments = raw.environments;
  if (typeof raw.monitoringLink === "string") slim.monitoringLink = raw.monitoringLink;
  if (typeof raw.deduplicationId === "string") slim.deduplicationId = raw.deduplicationId;
  if (typeof raw.quietMode === "boolean") slim.quietMode = raw.quietMode;
  if (Array.isArray(raw.commsLinks)) slim.commsLinks = raw.commsLinks;
  for (const key of [
    "createdAtTimestamp", "startedAtTimestamp", "acknowledgedAtTimestamp",
    "resolvedAtTimestamp", "closedAtTimestamp",
  ]) {
    if (typeof raw[key] === "number") slim[key] = raw[key];
  }
  if (Array.isArray(raw.keyEvents)) {
    slim.keyEvents = verbose ? raw.keyEvents.map(projectKeyEvent) : raw.keyEvents.length;
  }
  return slim;
}

/**
 * Extract an alert detail response (get/update/lifecycle actions all return the
 * same alert DTO). Projects a stable shape and strips backend envelope/debug/meta
 * fields. Keeps the full keyEvents timeline since this is the detail view.
 */
function alertGetExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return projectAlert(raw, true);
}

/**
 * Compact an alert list item. The list response carries the same multi-KB
 * keyEvents array and description as the detail view; the generic key whitelist
 * would also drop the identifying `prettyId` (not an *Id/Identifier suffix) and
 * the `priority`/`impactedServices` fields an agent needs. Full timelines and
 * descriptions remain available via harness_get.
 */
function compactAlert(item: Record<string, unknown>): Record<string, unknown> {
  return projectAlert(item, false);
}

/**
 * Body field names are camelCase to match the Jackson-mapped Java DTO
 * (UpdateAlertRequest) — no @JsonProperty overrides, so the wire format is the
 * field name verbatim.
 */
const alertUpdateSchema: BodySchema = {
  description:
    "Alert fields to update (UpdateAlertRequest — merge-patch, all optional). "
    + "To acknowledge, resolve, or dismiss, use harness_execute actions instead. "
    + "PATCH status is for reopening to triggered.",
  fields: [
    { name: "title", type: "string", required: false, description: "Alert title" },
    { name: "description", type: "string", required: false, description: "Alert description" },
    {
      name: "priority",
      type: "string",
      required: false,
      description: "Priority option id (p1_critical, p2_error, p3_warning, p4_info)",
    },
    {
      name: "status",
      type: "string",
      required: false,
      description: "Alert status. Use harness_execute acknowledge/resolve/dismiss for lifecycle transitions; PATCH status is for reopening to triggered",
    },
    { name: "impactedServices", type: "array", required: false, description: "Harness service identifiers of impacted services (replaces the full list)", itemType: "string" },
    { name: "environments", type: "array", required: false, description: "Environment labels (replaces the full list)", itemType: "string" },
    { name: "monitoringLink", type: "string", required: false, description: "Monitoring link for the alert" },
    { name: "quietMode", type: "boolean", required: false, description: "When true, suppresses user notifications and on-call pages" },
  ],
};

export const alertsToolset: ToolsetDefinition = {
  name: "alerts",
  displayName: "Alerts",
  description: "Harness alert management — list, inspect, update, and lifecycle actions for alerts",
  resources: [
    {
      resourceType: "alert",
      displayName: "Alert",
      description: "Mission Control alert entity. Supports list/get/update plus acknowledge, resolve, and dismiss actions. Creation is via webhooks and other external writers.",
      toolset: "alerts",
      scope: "project",
      scopeParams: MC_SCOPE,
      identifierFields: ["alert_id"],
      compactItem: compactAlert,
      deepLinkTemplate:
        "/ng/account/{accountId}/module/ir/orgs/{orgId}/projects/{projectId}/alerts/{prettyId}",
      diagnosticHint:
        "Alerts are created by external writers such as webhooks, not harness_create. "
        + "Use harness_list(resource_type='alert', filters={status:['triggered']}) to triage, "
        + "then harness_execute acknowledge/resolve/dismiss for lifecycle transitions rather than PATCH status. "
        + "Impacted service, environment, and template filters are validated against the project registry; "
        + "unrecognized values return an error rather than an empty list.",
      executeHint:
        "Use harness_execute(resource_type='alert', action='acknowledge'|'resolve'|'dismiss', resource_id='ALERT-123') "
        + "for lifecycle transitions. Do not PATCH status for acknowledge/resolve/dismiss.",
      listFilterFields: [
        { name: "status", description: "Filter by alert status (multi-value, OR-combined). Matching is case-insensitive, but responses return status uppercase (e.g. TRIGGERED) — compare case-insensitively when post-filtering results", enum: ["triggered", "acknowledged", "resolved", "dismissed"] },
        { name: "priority", description: "Filter by priority option id (multi-value, OR-combined)", enum: ["p1_critical", "p2_error", "p3_warning", "p4_info"] },
        { name: "impacted_service", description: "Filter by impacted Harness service identifier (multi-value, OR-combined). Validated against the project's registered services — an unrecognized value returns an error, not an empty list" },
        { name: "environment", description: "Filter by environment (multi-value, OR-combined). Validated against the project's registered environments, so it is not free text — an unrecognized value returns an error, not an empty list" },
        { name: "template_short_id", description: "Filter by alert template short id (multi-value, OR-combined). Template ids are per-project — an unrecognized value returns an error, not an empty list" },
        { name: "text", description: "Free-text search across title and description" },
        { name: "created_after", description: "Only alerts created at or after this time (ISO-8601, e.g. 2026-05-01T00:00:00Z)" },
        { name: "created_before", description: "Only alerts created at or before this time (ISO-8601)" },
        { name: "sort_field", description: "Field to sort by", enum: ["CREATED_AT", "PRIORITY", "STATUS"] },
        { name: "sort_direction", description: "Sort direction. Alerts with no priority sort ahead of the priority values in ASC, so filter priority to the four option ids to keep them off the first page", enum: ["ASC", "DESC"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/gateway/ir/tp/api/v1/mc/alerts",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            status: "status",
            priority: "priority",
            impacted_service: "impactedService",
            environment: "environment",
            template_short_id: "templateShortId",
            // harness_search and harness_list's top-level search_term both arrive as
            // `search_term`; without this mapping they were silently dropped and the
            // backend returned an unfiltered page that the caller read as matches.
            // Listed before `text` so an explicit text filter wins if both are set.
            search_term: "text",
            text: "text",
            created_after: "createdAfter",
            created_before: "createdBefore",
            sort_field: "sortField",
            sort_direction: "sortDirection",
            page: "page",
            size: "pageSize",
          },
          responseExtractor: offsetListExtract,
          description: "List alerts with filtering by status, priority, service, environment, template, and text",
        },
        get: {
          method: "GET",
          path: "/gateway/ir/tp/api/v1/mc/alerts/{alertId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { alert_id: "alertId" },
          responseExtractor: alertGetExtract,
          description: "Get alert details by ID (e.g. ALERT-123)",
        },
        update: {
          method: "PATCH",
          path: "/gateway/ir/tp/api/v1/mc/alerts/{alertId}",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { alert_id: "alertId" },
          bodyBuilder: buildBodyNormalized(),
          responseExtractor: alertGetExtract,
          description: "Update an alert (merge-patch; only provided fields change)",
          bodySchema: alertUpdateSchema,
        },
      },
      executeActions: {
        acknowledge: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/alerts/{alertId}/acknowledge",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { alert_id: "alertId" },
          responseExtractor: alertGetExtract,
          actionDescription: "Acknowledge an alert (transitions status to acknowledged).",
        },
        resolve: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/alerts/{alertId}/resolve",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { alert_id: "alertId" },
          responseExtractor: alertGetExtract,
          actionDescription: "Resolve an alert (transitions status to resolved).",
        },
        dismiss: {
          method: "POST",
          path: "/gateway/ir/tp/api/v1/mc/alerts/{alertId}/dismiss",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { alert_id: "alertId" },
          responseExtractor: alertGetExtract,
          actionDescription: "Dismiss an alert (transitions status to dismissed).",
        },
      },
    },
  ],
};
