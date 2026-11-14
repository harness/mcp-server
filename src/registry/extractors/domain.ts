import { aiEvalsListExtract, ngExtract, pageExtract } from "../extractors.js";
import { asRecord, isRecord } from "../../utils/type-guards.js";
import { stripInternalMeta } from "../../utils/strip-meta.js";
import { projectRelatedActivity } from "../toolsets/related-activities.js";

// ── Alerts & Deploys & Incidents ─────────────────────────────────────────────

const ALERT_LIST_DESCRIPTION_MAX = 400;
const INCIDENT_LIST_SUMMARY_MAX = 400;

function projectKeyEvent(e: unknown): unknown {
  if (!isRecord(e)) return e;
  const out: Record<string, unknown> = {};
  if (typeof e.timestamp === "number") out.timestamp = e.timestamp;
  if (typeof e.status === "string") out.status = e.status;
  if (typeof e.details === "string") out.details = e.details;
  return out;
}

export function projectAlert(raw: Record<string, unknown>, verbose: boolean): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  if (typeof raw.prettyId === "string") slim.prettyId = raw.prettyId;
  if (typeof raw.projectId === "string") slim.projectId = raw.projectId;
  if (typeof raw.title === "string") slim.title = raw.title;
  if (typeof raw.description === "string") {
    slim.description =
      verbose || raw.description.length <= ALERT_LIST_DESCRIPTION_MAX
        ? raw.description
        : `${raw.description.slice(0, ALERT_LIST_DESCRIPTION_MAX)}… [truncated — use harness_get for the full description]`;
  }
  if (typeof raw.status === "string") slim.status = raw.status;
  if (raw.priority !== undefined) slim.priority = raw.priority;
  if (Array.isArray(raw.impactedServices)) slim.impactedServices = raw.impactedServices;
  if (Array.isArray(raw.environments)) slim.environments = raw.environments;
  if (typeof raw.monitoringLink === "string") slim.monitoringLink = raw.monitoringLink;
  if (typeof raw.deduplicationId === "string") slim.deduplicationId = raw.deduplicationId;
  if (typeof raw.quietMode === "boolean") slim.quietMode = raw.quietMode;
  if (Array.isArray(raw.commsLinks)) slim.commsLinks = raw.commsLinks;
  for (const key of [
    "createdAtTimestamp",
    "startedAtTimestamp",
    "acknowledgedAtTimestamp",
    "resolvedAtTimestamp",
    "closedAtTimestamp",
  ]) {
    if (typeof raw[key] === "number") slim[key] = raw[key];
  }
  if (Array.isArray(raw.keyEvents)) {
    slim.keyEvents = verbose ? raw.keyEvents.map(projectKeyEvent) : raw.keyEvents.length;
  }
  if (Array.isArray(raw.relatedActivities) && raw.relatedActivities.length > 0) {
    slim.relatedActivities = raw.relatedActivities.map(projectRelatedActivity);
  }
  return slim;
}

export function alertGetExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return projectAlert(raw, true);
}

export function deployGetExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const slim: Record<string, unknown> = {};
  if (typeof raw.id === "string") slim.id = raw.id;
  if (typeof raw.projectId === "string") slim.projectId = raw.projectId;
  if (typeof raw.title === "string") slim.title = raw.title;
  if (typeof raw.summary === "string") slim.summary = raw.summary;
  if (raw.status !== undefined) slim.status = raw.status;
  if (Array.isArray(raw.environments)) slim.environments = raw.environments;
  if (Array.isArray(raw.buildVersions)) {
    slim.buildVersions = raw.buildVersions.map((bv) => {
      if (!isRecord(bv)) return bv;
      const b: Record<string, unknown> = {};
      if (typeof bv.service === "string") b.service = bv.service;
      if (typeof bv.version === "string") b.version = bv.version;
      if (typeof bv.commitSha === "string") b.commitSha = bv.commitSha;
      if (typeof bv.branch === "string") b.branch = bv.branch;
      if (typeof bv.repositoryName === "string") b.repositoryName = bv.repositoryName;
      if (typeof bv.repositoryUrl === "string") b.repositoryUrl = bv.repositoryUrl;
      return b;
    });
  }
  if (typeof raw.deployTimestamp === "number") slim.deployTimestamp = raw.deployTimestamp;
  if (typeof raw.webLink === "string") slim.webLink = raw.webLink;
  if (Array.isArray(raw.relatedActivities) && raw.relatedActivities.length > 0) {
    slim.relatedActivities = raw.relatedActivities.map(projectRelatedActivity);
  }
  return slim;
}

function projectTheoryRelatedActivity(a: unknown): unknown {
  if (!isRecord(a)) return a;
  const out: Record<string, unknown> = {};
  if (typeof a.type === "string") out.type = a.type;
  if (typeof a.id === "string") out.id = a.id;
  if (typeof a.displayId === "string") out.displayId = a.displayId;
  if (typeof a.url === "string") out.url = a.url;
  return out;
}

function projectRelatedActivityIssue(i: unknown): unknown {
  if (!isRecord(i)) return i;
  const out: Record<string, unknown> = {};
  if (isRecord(i.reference)) {
    const ref: Record<string, unknown> = {};
    if (typeof i.reference.type === "string") ref.type = i.reference.type;
    if (typeof i.reference.id === "string") ref.id = i.reference.id;
    out.reference = ref;
  }
  if (typeof i.reason === "string") out.reason = i.reason;
  return out;
}

function projectRootCauseTheory(t: unknown): unknown {
  if (!isRecord(t)) return t;
  const out: Record<string, unknown> = {};
  if (typeof t.id === "string") out.id = t.id;
  if (typeof t.message === "string") out.message = t.message;
  if (typeof t.status === "string") out.status = t.status;
  if (typeof t.confidence === "number") out.confidence = t.confidence;
  if (typeof t.aiGenerated === "boolean") out.aiGenerated = t.aiGenerated;
  if (Array.isArray(t.relatedActivities) && t.relatedActivities.length > 0) {
    out.relatedActivities = t.relatedActivities.map(projectTheoryRelatedActivity);
  }
  return out;
}

export function projectIncident(raw: Record<string, unknown>, verbose: boolean): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  if (typeof raw.prettyId === "string") slim.prettyId = raw.prettyId;
  if (typeof raw.projectId === "string") slim.projectId = raw.projectId;
  if (typeof raw.title === "string") slim.title = raw.title;
  if (typeof raw.status === "string") slim.status = raw.status;
  if (raw.severity !== undefined) slim.severity = raw.severity;
  if (typeof raw.summary === "string") {
    slim.summary =
      verbose || raw.summary.length <= INCIDENT_LIST_SUMMARY_MAX
        ? raw.summary
        : `${raw.summary.slice(0, INCIDENT_LIST_SUMMARY_MAX)}… [truncated — use harness_get for the full summary]`;
  }
  if (Array.isArray(raw.impactedServices)) slim.impactedServices = raw.impactedServices;
  if (Array.isArray(raw.environments)) slim.environments = raw.environments;
  if (raw.reporter !== undefined) slim.reporter = raw.reporter;
  if (raw.commander !== undefined) slim.commander = raw.commander;
  if (typeof raw.videoConferenceLink === "string") slim.videoConferenceLink = raw.videoConferenceLink;
  if (Array.isArray(raw.commsLinks)) slim.commsLinks = raw.commsLinks;
  for (const key of [
    "reportedAtTimestamp",
    "startedAtTimestamp",
    "acknowledgedAtTimestamp",
    "mitigatedAtTimestamp",
    "resolvedAtTimestamp",
    "closedAtTimestamp",
    "responderAssignedAtTimestamp",
  ]) {
    if (typeof raw[key] === "number") slim[key] = raw[key];
  }
  if (Array.isArray(raw.keyEvents)) {
    slim.keyEvents = verbose ? raw.keyEvents.map(projectKeyEvent) : raw.keyEvents.length;
  }
  if (Array.isArray(raw.rootCauseTheories)) {
    slim.rootCauseTheories = verbose
      ? raw.rootCauseTheories.map(projectRootCauseTheory)
      : raw.rootCauseTheories.length;
  }
  if (verbose && typeof raw.rootCauseTheoriesSha === "string") {
    slim.rootCauseTheoriesSha = raw.rootCauseTheoriesSha;
  }
  if (Array.isArray(raw.relatedActivities) && raw.relatedActivities.length > 0) {
    slim.relatedActivities = raw.relatedActivities.map(projectRelatedActivity);
  }
  return slim;
}

export function incidentGetExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  return projectIncident(raw, true);
}

export function addRootCauseTheoryExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = {};
  if (raw.theory !== undefined) out.theory = projectRootCauseTheory(raw.theory);
  if (typeof raw.created === "boolean") out.created = raw.created;
  for (const key of ["notLinked", "unverified", "notRemoved"] as const) {
    const issues = raw[key];
    if (Array.isArray(issues) && issues.length > 0) out[key] = issues.map(projectRelatedActivityIssue);
  }
  return out;
}

// ── Feature Flags, Infrastructure, IDP, STO, CCM, Autonomous Work ───────────

export const fmeActionExtract = (raw: unknown): unknown => {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) return raw;
  return { success: true, result: raw };
};

function aliasEnvironmentIdentifier(record: Record<string, unknown>): void {
  if (typeof record.environmentIdentifier === "string" && record.environmentIdentifier) return;
  const nested = isRecord(record.infrastructure) ? record.infrastructure : undefined;
  const ref = record.environmentRef ?? nested?.environmentRef;
  if (typeof ref === "string" && ref) {
    record.environmentIdentifier = ref;
  }
}

export const infrastructureExtract = (raw: unknown): unknown => {
  const data = ngExtract(raw);
  if (isRecord(data)) aliasEnvironmentIdentifier(data);
  return data;
};

export const infrastructurePageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const page = pageExtract(raw);
  for (const item of page.items) {
    if (isRecord(item)) aliasEnvironmentIdentifier(item);
  }
  return page;
};

export const scorecardStatsExtract = (raw: unknown): unknown => {
  const r = raw as { name?: string; stats?: unknown[]; timestamp?: number | null };
  return {
    name: r.name,
    stats: r.stats ?? [],
    time: r.timestamp != null ? new Date(r.timestamp).toISOString() : "",
  };
};

export const securityIssueListExtract = (raw: unknown): unknown => {
  const base = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...base,
    _action_hint:
      "If the user asked to APPROVE, REJECT, or PROMOTE an exemption — even by mentioning a CVE or package name — " +
      "STOP using this resource. " +
      "The correct workflow is: " +
      "(1) harness_list(resource_type='security_exemption', filters={status:'Pending', search:'<keyword from user prompt>'}). " +
      "(2) Get the exemption_id from _action_id_by_row. " +
      "(3) harness_execute(resource_type='security_exemption', action='approve', resource_id=<exemption_id>, body={scope:'CURRENT'|'ORG'|'ACCOUNT'|'PROJECT'}).",
  };
};

export function extractCostCategoryFilterPanel(raw: unknown): { values: string[] } {
  const envelope = raw as { data?: unknown; resource?: unknown } | undefined;
  const unwrapped = envelope?.data ?? envelope?.resource ?? raw;

  if (Array.isArray(unwrapped)) {
    const values = unwrapped
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as { name?: string; costCategory?: string; costBucket?: string };
          return obj.name ?? obj.costCategory ?? obj.costBucket;
        }
        return undefined;
      })
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    return { values };
  }

  if (unwrapped !== null && typeof unwrapped === "object") {
    const obj = unwrapped as Record<string, unknown>;
    if (Array.isArray(obj.costBuckets)) {
      return { values: obj.costBuckets.filter((v): v is string => typeof v === "string") };
    }
    if (Array.isArray(obj.costTargets)) {
      return {
        values: (obj.costTargets as Array<{ name?: string }>)
          .map((t) => t.name)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      };
    }
    if (Array.isArray(obj.businessMappings)) {
      return {
        values: (obj.businessMappings as Array<{ name?: string }>)
          .map((m) => m.name)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      };
    }
    if (Array.isArray(obj.costCategories)) {
      return { values: obj.costCategories.filter((v): v is string => typeof v === "string") };
    }
  }

  return { values: [] };
}

export function workArtifactListExtract(raw: unknown, input?: Record<string, unknown>): Record<string, unknown> {
  const r =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const items = Array.isArray(r.items) ? r.items : [];
  const total = typeof r.total === "number" ? r.total : items.length;
  const size = typeof input?.size === "number" && input.size > 0 ? input.size : 20;
  const page = typeof input?.page === "number" && input.page >= 0 ? input.page : 0;
  const filters: Record<string, unknown> = { type: input?.type, page: page + 1, size };
  if (input?.phase_id) filters.phase_id = input.phase_id;
  const hasMore = (page + 1) * size < total;
  return {
    ...r,
    items,
    total,
    _nextPageHint: hasMore
      ? `For the next page, call harness_list with resource_type='work_artifact', params={"work_item_id":${JSON.stringify(input?.work_item_id ?? "")}} and filters=${JSON.stringify(filters)}. Keep type and size identical — this list uses offset = page × size, unlike work_item list which maps page to offset directly.`
      : "No more pages — all matching artifacts have been returned.",
  };
}

export function observabilityEvalExtract(raw: unknown): unknown {
  const record = asRecord(raw);
  if (!record || typeof record.config_id !== "string") return raw;
  const { config_id: evalId, ...response } = record;
  return { ...response, eval_id: evalId };
}

export function observabilityEvalListExtract(raw: unknown): { items: unknown[]; total: number } {
  const { items, total } = aiEvalsListExtract(raw);
  return { items: items.map(observabilityEvalExtract), total };
}

// ── Knowledge Graph, Semantic Layer, Unified Search ─────────────────────────

const KG_MAX_DESC_LEN = 80;

export const queryableTypeSummaryExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { queryable_types?: Record<string, unknown>[] };
  const items: unknown[] = [];

  for (const qt of r.queryable_types ?? []) {
    const typeInfo = qt.type as Record<string, unknown> | undefined;
    const typeRef = qt.type_reference as Record<string, unknown> | undefined;
    const connectorMapping = qt.connector_mapping_config as Record<string, unknown> | undefined;

    const objectKind = (typeRef?.object_kind as string) ?? "";

    const connectorRef = connectorMapping?.connector_reference as Record<string, unknown> | undefined;
    const connectorId =
      (connectorRef?.connector_identifier as string) ??
      (connectorRef?.identifier as string) ??
      (connectorRef?.connector_name as string) ??
      "";

    const oneofKeys: Record<string, string> = {
      entity_type: "OBJECT_KIND_ENTITY",
      event_type: "OBJECT_KIND_EVENT",
      metric_type: "OBJECT_KIND_METRIC",
      relationship_type: "OBJECT_KIND_RELATIONSHIP",
      view_type: "OBJECT_KIND_VIEW",
    };

    let actualType: Record<string, unknown> | undefined;
    for (const [key] of Object.entries(oneofKeys)) {
      if (typeInfo?.[key]) {
        actualType = typeInfo[key] as Record<string, unknown>;
        break;
      }
    }
    if (!actualType) continue;

    const id = actualType.id as string | undefined;
    if (!id) continue;

    const annotations = actualType.annotations as Record<string, unknown>[] | undefined;
    const annotationKeys = (annotations ?? [])
      .map((a) => (a.key as string) ?? "")
      .filter(Boolean);

    const rawDesc = (actualType.description as string) ?? "";
    const desc =
      rawDesc.length > KG_MAX_DESC_LEN
        ? rawDesc.slice(0, KG_MAX_DESC_LEN) + "..."
        : rawDesc;

    const item: Record<string, unknown> = {
      identifier: id,
      name: actualType.name ?? "Unknown",
      kind: objectKind,
      connectorId,
    };
    if (desc) item.description = desc;
    if (annotationKeys.length > 0) item.tags = annotationKeys;

    items.push(item);
  }

  return { items, total: items.length };
};

export const grammarExtract = (raw: unknown): unknown => {
  const r = raw as { grammar?: string };
  const grammar = r.grammar;
  return grammar !== undefined ? { grammar } : raw;
};

export const hqlRunExtract = (raw: unknown): unknown => {
  const top = (raw ?? {}) as Record<string, unknown>;
  const inner =
    (top.data as Record<string, unknown> | undefined) ??
    (top.result as Record<string, unknown> | undefined) ??
    top;

  const out: Record<string, unknown> = {
    columns: inner.columns ?? [],
    rows: inner.rows ?? [],
  };
  if (inner.stats != null) out.stats = inner.stats;
  if (inner.truncated != null) {
    out.truncated = inner.truncated;
    if (inner.truncated === true) {
      out.truncation_warning =
        "Row set truncated by the query engine — it is a prefix, not the full result. " +
        "Do NOT derive totals by counting rows (`rows.length`); re-query with `| select {count()}` " +
        "(or `group by {...} | select {..., count()}`) for exact counts.";
    }
  }
  return out;
};

export const schemaTypesExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as Record<string, unknown>;
  const items: unknown[] = [];
  const categoryMap: Record<string, string> = {
    entity_types: "entity",
    relationship_types: "relationship",
    event_types: "event",
    metric_types: "metric",
    view_types: "view",
    config_types: "config",
    data_model_types: "data_model",
  };

  const MAX_DESC = 120;

  for (const [key, category] of Object.entries(categoryMap)) {
    const arr = r[key];
    if (Array.isArray(arr)) {
      for (const type of arr) {
        const typeObj = type as Record<string, unknown>;
        const id = (typeObj.id ?? typeObj.identifier) as string | undefined;
        if (!id) continue;

        const rawDesc = (typeObj.description as string) ?? "";
        const description = rawDesc.length > MAX_DESC ? rawDesc.slice(0, MAX_DESC) + "..." : rawDesc;

        const item: Record<string, unknown> = {
          identifier: id,
          name: typeObj.name ?? id,
          category,
          kind: typeObj.kind,
        };
        if (description) item.description = description;

        items.push(item);
      }
    }
  }
  return { items, total: items.length };
};

export const schemaTypeExtract = (raw: unknown): unknown => {
  const r = raw as { type?: Record<string, unknown> };
  if (!r.type) return raw;
  const typeObj = r.type;
  const oneofKeys = [
    "entity_type",
    "relationship_type",
    "event_type",
    "metric_type",
    "config_type",
    "view_type",
    "data_model_type",
  ];
  for (const key of oneofKeys) {
    if (typeObj[key]) {
      const cleaned = stripInternalMeta(typeObj[key]) as Record<string, unknown>;

      if (key === "relationship_type") {
        const relObj = typeObj[key] as Record<string, unknown>;
        const annotations = relObj.annotations as Record<string, unknown>[] | undefined;
        const hasDcsEnrichment = (annotations ?? []).some(
          (a) => (a.key as string) === "dcs_enrichment",
        );
        if (hasDcsEnrichment) {
          cleaned.dcs_enrichment = true;
          cleaned.join_predicates = stripInternalMeta(relObj.join_predicates);
          cleaned.left_reference = stripInternalMeta(relObj.left_reference);
          cleaned.right_reference = stripInternalMeta(relObj.right_reference);
          if (relObj.fields) cleaned.enrichment_fields = stripInternalMeta(relObj.fields);
        }
      }

      return cleaned;
    }
  }
  return stripInternalMeta(typeObj);
};

export const relatedTypesExtract = (raw: unknown): unknown => {
  const r = raw as Record<string, unknown>;
  const cleaned = stripInternalMeta(r) as Record<string, unknown>;

  const relationships = r.relationship_types ?? r.relationships;
  if (Array.isArray(relationships)) {
    const enrichments: unknown[] = [];
    for (const rel of relationships) {
      const relObj = rel as Record<string, unknown>;
      const annotations = relObj.annotations as Record<string, unknown>[] | undefined;
      const hasDcsEnrichment = (annotations ?? []).some(
        (a) => (a.key as string) === "dcs_enrichment",
      );
      if (hasDcsEnrichment) {
        enrichments.push({
          id: relObj.id,
          description: relObj.description,
          annotations: annotations?.map((a) => a.key),
          left_reference: stripInternalMeta(relObj.left_reference),
          right_reference: stripInternalMeta(relObj.right_reference),
          join_predicates: stripInternalMeta(relObj.join_predicates),
          fields: stripInternalMeta(relObj.fields),
        });
      }
    }
    if (enrichments.length > 0) {
      cleaned.dcs_enrichments = enrichments;
    }
  }

  return cleaned;
};

interface UnifiedRawResult {
  id?: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

interface UnifiedRawResponse {
  query?: string;
  sources?: Array<{ source?: string; results?: UnifiedRawResult[] }>;
}

const UNIFIED_EMPTY_NOTE =
  "No matches for this query. Auth and feature-flag failures return errors, so this is not one of them.";
const UNIFIED_FILTERED_EMPTY_NOTE =
  "No matches with these filters. This does not mean nothing matching exists: a filter on a field the " +
  "source does not index, or with a value type other than the one hit metadata shows (e.g. int_value " +
  "on a field stored as a string), matches nothing instead of erroring. Re-run without the filter and " +
  "check the field names and value types in the hits' metadata.";
const UNIFIED_MULTI_SOURCE_NOTE = "Scores are per source and not comparable across sources.";
const UNIFIED_ACCOUNT_WIDE_NOTE =
  "org_id/project_id do not narrow unified search: results are account-wide. To scope them, filter on " +
  "the metadata keys that carry org or project in the hits.";

function unifiedNoteFor(input: Record<string, unknown> | undefined, total: number, groups: number): Record<string, string> {
  const filters = ((input?.body ?? {}) as Record<string, unknown>).source_filters;
  const hasFilters = filters !== null && typeof filters === "object" && !Array.isArray(filters) && Object.keys(filters).length > 0;
  const notes: string[] = [];
  if (total === 0) notes.push(hasFilters ? UNIFIED_FILTERED_EMPTY_NOTE : UNIFIED_EMPTY_NOTE);
  if (groups > 1 && total > 0) notes.push(UNIFIED_MULTI_SOURCE_NOTE);
  if (input?.org_id || input?.project_id) notes.push(UNIFIED_ACCOUNT_WIDE_NOTE);
  return notes.length > 0 ? { note: notes.join(" ") } : {};
}

export function unifiedSearchListExtract(raw: unknown, input?: Record<string, unknown>): Record<string, unknown> {
  const r = (raw ?? {}) as UnifiedRawResponse;
  const groups = r.sources ?? [];
  const items = groups.flatMap((g) =>
    (g.results ?? []).map((res) => ({
      source: g.source ?? "unknown",
      id: res.id ?? "",
      score: res.score ?? 0,
      metadata: res.metadata ?? {},
    })),
  );
  return {
    items,
    total: items.length,
    ...unifiedNoteFor(input, items.length, groups.length),
  };
}

export function unifiedSearchExecuteExtract(raw: unknown, input?: Record<string, unknown>): Record<string, unknown> {
  const r = (raw ?? {}) as UnifiedRawResponse;
  const sources = (r.sources ?? []).map((g) => {
    const results = (g.results ?? []).map((res) => ({
      id: res.id ?? "",
      score: res.score ?? 0,
      metadata: res.metadata ?? {},
    }));
    return { source: g.source ?? "unknown", count: results.length, results };
  });
  const total = sources.reduce((n, g) => n + g.count, 0);
  return {
    query: r.query ?? "",
    total,
    sources,
    ...unifiedNoteFor(input, total, sources.length),
  };
}

export function unifiedSearchSourcesExtract(raw: unknown): Record<string, unknown> {
  return { sources: ((raw ?? {}) as { sources?: unknown[] }).sources ?? [] };
}
