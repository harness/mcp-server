import { gqlExtract, v1ListExtract } from "../extractors.js";

/**
 * Normalizes REST cost_category responses into the same {values} shape
 * that perspectiveFilters returns, so callers get a uniform interface.
 */
function extractBusinessMappingValues(raw: unknown, valueSubType?: string): unknown {
  const envelope = raw as { data?: unknown; resource?: unknown } | undefined;
  const unwrapped = envelope?.data ?? envelope?.resource ?? raw;

  if (valueSubType) {
    const entity = unwrapped as Record<string, unknown>;
    const targets = entity.costTargets as Array<{ name?: string }> | undefined;
    if (!Array.isArray(targets)) {
      return { values: [], _error: "No costTargets found in response" };
    }
    return {
      values: targets.map((t) => t.name).filter(Boolean),
    };
  }
  const data = unwrapped as Record<string, unknown>;
  const mappings = data.businessMappings as Array<{ uuid?: string; name?: string }> | undefined;
  if (Array.isArray(mappings)) {
    return {
      values: mappings.map((m) => m.name).filter(Boolean),
    };
  }
  if (Array.isArray(unwrapped)) {
    return {
      values: (unwrapped as Array<{ name?: string }>).map((m) => m.name).filter(Boolean),
    };
  }
  return { values: [], _error: "Unexpected response shape — no businessMappings or array found" };
}

export const ccmPerspectiveFilterValuesExtract = (
  raw: unknown,
  input?: Record<string, unknown>,
): unknown => {
  const valueType = input?.value_type as string | undefined;
  if (valueType === "business_mapping") {
    return extractBusinessMappingValues(raw, input?.value_sub_type as string | undefined);
  }
  return gqlExtract("perspectiveFilters")(raw);
};

export const hqlValidateExtract = (raw: unknown): unknown => {
  const r = raw as { is_valid?: boolean; errors?: unknown[] };
  return { is_valid: r.is_valid, errors: r.errors ?? [] };
};

export const chaosProbesInRunExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[] };
  return {
    items: r.data ?? (Array.isArray(raw) ? raw : []),
    total: Array.isArray(r.data) ? r.data.length : Array.isArray(raw) ? (raw as unknown[]).length : 0,
  };
};

export const chaosEnvironmentsListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { content?: unknown[]; totalItems?: number } };
  return {
    items: r.data?.content ?? [],
    total: r.data?.totalItems ?? 0,
  };
};

export const chaosComponentVarExtract = (raw: unknown): unknown => {
  const r = raw as { items?: Array<{ name: string; variables: unknown[] }> };
  return r.items?.[0] ?? raw;
};

export const idpScoresListExtract = (raw: unknown): unknown => {
  const r = raw as { overall_score?: number; scorecard_scores?: unknown[] };
  const items = r.scorecard_scores ?? [];
  return { overall_score: r.overall_score, items, total: items.length };
};

export const governanceEvaluationListExtract = (raw: unknown): unknown => {
  const result = v1ListExtract()(raw);
  result.items = result.items.map((item) => {
    if (typeof item !== "object" || item === null || !("id" in item)) return item;
    const r = item as Record<string, unknown>;
    return { ...r, evaluation_id: r.id };
  });
  return result;
};

export const stoPipelineSecurityIssuesExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined || typeof raw !== "object") return raw;
  type Partition = {
    issues?: unknown[];
    items?: unknown[];
    pagination?: { totalItems?: number };
    totalItems?: number;
  };
  const r = raw as {
    existing?: Partition;
    new?: Partition;
    counts?: unknown;
    matchingSteps?: unknown;
  };
  const partitionItems = (p: Partition | undefined): unknown[] => {
    if (!p) return [];
    if (Array.isArray(p.issues)) return p.issues;
    if (Array.isArray(p.items)) return p.items;
    return [];
  };
  const partitionTotal = (p: Partition | undefined, fallback: number): number => {
    if (!p) return fallback;
    if (typeof p.pagination?.totalItems === "number") return p.pagination.totalItems;
    if (typeof p.totalItems === "number") return p.totalItems;
    return fallback;
  };
  const existingItems = partitionItems(r.existing);
  const newItems = partitionItems(r.new);
  const tagged = [
    ...existingItems.map((it) => (typeof it === "object" && it !== null ? { ...it, _partition: "existing" } : it)),
    ...newItems.map((it) => (typeof it === "object" && it !== null ? { ...it, _partition: "new" } : it)),
  ];
  const existingTotal = partitionTotal(r.existing, existingItems.length);
  const newTotal = partitionTotal(r.new, newItems.length);
  const targetIdHint =
    "Each row carries `targetVariantName` (display string like 'repo:branch') but NOT a raw `target_id`. " +
    "For target-scoped exemptions, also call harness_list(resource_type='pipeline_security_step', " +
    "filters={execution_id:<same id>}) and join on `targetName:targetVariant === issue.targetVariantName` " +
    "to resolve the `target_id` you pass to harness_create body.target_id.";
  const pipelineIdHint =
    "Issue rows do NOT carry `pipeline_id` either. For pipeline-scoped exemptions: " +
    "(1) if a Harness pipeline execution URL was pasted, `pipeline_id` is already auto-extracted from the URL path; " +
    "(2) otherwise call harness_get(resource_type='execution', resource_id=<execution_id>) once and read `pipelineIdentifier`. " +
    "Do NOT iterate through harness_list(resource_type='pipeline') — the execution-to-pipeline link is 1:1.";
  return {
    items: tagged,
    total: existingTotal + newTotal,
    existing_total: existingTotal,
    new_total: newTotal,
    counts: r.counts,
    matching_steps: r.matchingSteps,
    _target_id_lookup_hint: targetIdHint,
    _pipeline_id_lookup_hint: pipelineIdHint,
  };
};

export const stoPipelineSecurityStepsExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined || typeof raw !== "object") return raw;
  const r = raw as { steps?: unknown[]; reachabilityFlag?: boolean; exploitabilityFlag?: boolean };
  const steps = Array.isArray(r.steps) ? r.steps : [];
  return {
    items: steps,
    total: steps.length,
    reachability_flag: r.reachabilityFlag ?? false,
    exploitability_flag: r.exploitabilityFlag ?? false,
  };
};

export const stoBulkExemptionExtract = (raw: unknown): unknown => {
  if (raw === null || typeof raw !== "object") return raw;
  const r = raw as { results?: unknown[]; succeeded?: number; failed?: number };
  const succeeded = typeof r.succeeded === "number" ? r.succeeded : 0;
  const failed = typeof r.failed === "number" ? r.failed : 0;
  const total = succeeded + failed;
  const allOrNone =
    total === 0
      ? "EMPTY"
      : failed === 0
        ? "ALL_SUCCEEDED"
        : succeeded === 0
          ? "ALL_FAILED"
          : "MIXED_UNEXPECTED";
  return {
    status: allOrNone,
    succeeded,
    failed,
    total,
    results: r.results ?? [],
    ...(allOrNone === "ALL_FAILED"
      ? {
          _action_hint:
            "The entire bulk request was rolled back. Inspect results[0].error for the cause, " +
            "fix the offending item(s), and re-send the FULL corrected list — never retry only the failed items.",
        }
      : {}),
    ...(allOrNone === "MIXED_UNEXPECTED"
      ? {
          _action_hint:
            "Bulk endpoint returned a mixed succeeded/failed result, which violates the all-or-none contract. " +
            "Treat this as a server-side bug and surface the raw results[] to the user.",
        }
      : {}),
  };
};
