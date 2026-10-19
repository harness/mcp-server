import { asRecord, asString, coerceRecord } from "./type-guards.js";

const MAX_PREVIEW_CHARS = 3_500;
const MAX_VALUES = 8;
const MAX_DETAIL_ITEMS = 8;
const MAX_RULES = 3;
const MAX_CONDITIONS = 4;
const MAX_FIXED_SPLITS = 20;

export interface PerspectivePreviewOptions {
  /** Create publishes an omitted viewState as COMPLETED and merges account cost-basis defaults. */
  publishDefaults: boolean;
}

function clip(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function formatList(values: unknown[]): string {
  const shown = values.slice(0, MAX_VALUES).map((value) => {
    if (typeof value === "string") return clip(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return clip(JSON.stringify(value) ?? String(value));
    } catch {
      return "[unserializable]";
    }
  });
  const extra = values.length > MAX_VALUES ? ` +${values.length - MAX_VALUES} more` : "";
  return `${shown.join(", ")}${extra}`;
}

function truncatePreview(text: string): string {
  if (text.length <= MAX_PREVIEW_CHARS) return text;
  return `${text.slice(0, MAX_PREVIEW_CHARS)}\n...(sensitive-field preview truncated; review the body before confirming)`;
}

function conditionsOf(rule: unknown): unknown[] {
  const record = asRecord(rule);
  if (!record) return [];
  if (Array.isArray(record.viewConditions)) return record.viewConditions;
  if (record.viewOperator !== undefined || record.viewField !== undefined) return [record];
  return [];
}

function summarizeCondition(condition: unknown): string {
  const record = asRecord(condition);
  if (!record) return "unrecognized condition";
  const field = asRecord(record.viewField);
  const fieldName = field
    ? (asString(field.fieldName) ?? asString(field.fieldId) ?? asString(field.identifier) ?? "field")
    : "field";
  const operator = asString(record.viewOperator) ?? "UNKNOWN_OPERATOR";
  const values = Array.isArray(record.values) ? record.values : [];
  if (values.length === 0) return `${fieldName} ${operator}`;
  return `${fieldName} ${operator} [${formatList(values)}]`;
}

function summarizeRules(rules: unknown): string {
  if (rules === undefined) return "rules omitted";
  if (!Array.isArray(rules)) return "rules unrecognized";
  if (rules.length === 0) return "no rules";
  const shown = rules.slice(0, MAX_RULES).map((rule, index) => {
    const conditions = conditionsOf(rule);
    if (conditions.length === 0) return `rule ${index + 1} has no conditions`;
    const text = conditions.slice(0, MAX_CONDITIONS).map(summarizeCondition).join(" AND ");
    const extra = conditions.length > MAX_CONDITIONS ? ` +${conditions.length - MAX_CONDITIONS} conditions` : "";
    return `rule ${index + 1}: ${text}${extra}`;
  });
  const extraRules = rules.length > MAX_RULES ? `; +${rules.length - MAX_RULES} more rules` : "";
  return `${shown.join("; ")}${extraRules}`;
}

function summarizeSplits(splits: unknown): string {
  if (!Array.isArray(splits) || splits.length === 0) return "no splits";
  const shown = splits.slice(0, MAX_VALUES).map((split) => {
    const record = asRecord(split);
    if (!record) return "unrecognized split";
    const name = clip(asString(record.costTargetName) ?? "(unnamed bucket)");
    const contribution = record.percentageContribution;
    const percentage = typeof contribution === "number" || typeof contribution === "string"
      ? String(contribution)
      : "?";
    return `${name} ${percentage}%`;
  });
  const extra = splits.length > MAX_VALUES ? ` +${splits.length - MAX_VALUES} more` : "";
  return `${shown.join(", ")}${extra}`;
}

function summarizeUnallocated(value: unknown): string {
  if (value === undefined) return "Unallocated cost: omitted";
  const record = asRecord(value);
  if (!record) return "Unallocated cost: unrecognized";
  const strategy = asString(record.strategy) ?? "(strategy missing)";
  const label = asString(record.label);
  const labelText = label ? ` label "${clip(label)}"` : "";
  if (strategy === "HIDE") {
    return `Unallocated cost: strategy HIDE (costs matching no bucket are hidden)${labelText}`;
  }
  if (strategy === "SHARE") {
    return `Unallocated cost: strategy SHARE (distributed across buckets)${labelText}`;
  }
  if (strategy === "DISPLAY_NAME") {
    return `Unallocated cost: strategy DISPLAY_NAME${labelText || " (no label)"}`;
  }
  return `Unallocated cost: strategy ${strategy}${labelText}`;
}

function strategyRollup(items: unknown[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const record = asRecord(item);
    const strategy = record ? (asString(record.strategy) ?? "(missing)") : "(unrecognized)";
    counts.set(strategy, (counts.get(strategy) ?? 0) + 1);
  }
  return [...counts.entries()].map(([strategy, count]) => `${strategy}=${count}`).join(", ");
}

function bucketName(record: Record<string, unknown> | undefined, index: number): string {
  return clip(record ? (asString(record.name) ?? `(unnamed ${index + 1})`) : `(unrecognized ${index + 1})`);
}

function summarizeCostCategory(body: Record<string, unknown>): string {
  const lines = [
    "Chargeback preview:",
    summarizeUnallocated(body.unallocatedCost),
  ];

  const shared = body.sharedCosts;
  if (shared === undefined) {
    lines.push("Shared costs: omitted");
  } else if (!Array.isArray(shared)) {
    lines.push("Shared costs: unrecognized");
  } else if (shared.length === 0) {
    lines.push("Shared costs: none");
  } else {
    lines.push(`Shared-cost strategies: ${strategyRollup(shared)}`);
    const fixed = shared.filter((item) => asString(asRecord(item)?.strategy) === "FIXED");
    if (fixed.length === 0) {
      lines.push("FIXED splits: none");
    } else {
      lines.push("FIXED splits:");
      for (const [index, item] of fixed.slice(0, MAX_FIXED_SPLITS).entries()) {
        const record = asRecord(item);
        lines.push(`- ${bucketName(record, index)}: ${summarizeSplits(record?.splits)}`);
      }
      if (fixed.length > MAX_FIXED_SPLITS) {
        lines.push(`- +${fixed.length - MAX_FIXED_SPLITS} more FIXED shared costs`);
      }
    }
    lines.push("Shared-cost rules:");
    for (const [index, item] of shared.slice(0, MAX_DETAIL_ITEMS).entries()) {
      const record = asRecord(item);
      const strategy = record ? (asString(record.strategy) ?? "(strategy missing)") : "(unrecognized)";
      lines.push(`- ${bucketName(record, index)}: strategy ${strategy}; ${summarizeRules(record?.rules)}`);
    }
    if (shared.length > MAX_DETAIL_ITEMS) {
      lines.push(`- +${shared.length - MAX_DETAIL_ITEMS} more shared costs`);
    }
  }

  const targets = body.costTargets;
  if (targets === undefined) {
    lines.push("Bucket rules: omitted");
  } else if (!Array.isArray(targets)) {
    lines.push("Bucket rules: unrecognized");
  } else if (targets.length === 0) {
    lines.push("Bucket rules: none");
  } else {
    lines.push(`Bucket rules (${targets.length}):`);
    for (const [index, item] of targets.slice(0, MAX_DETAIL_ITEMS).entries()) {
      const record = asRecord(item);
      lines.push(`- ${bucketName(record, index)}: ${summarizeRules(record?.rules)}`);
    }
    if (targets.length > MAX_DETAIL_ITEMS) {
      lines.push(`- +${targets.length - MAX_DETAIL_ITEMS} more buckets`);
    }
  }

  return truncatePreview(lines.join("\n"));
}

function preferenceFlag(record: Record<string, unknown>, key: string): string | undefined {
  if (!(key in record)) return undefined;
  return `${key}=${String(record[key])}`;
}

function summarizeAws(aws: Record<string, unknown>): string {
  const basis = asString(aws.awsCost) ?? "(awsCost omitted)";
  const flags = ["includeDiscounts", "includeCredits", "includeRefunds", "includeTaxes"]
    .map((key) => preferenceFlag(aws, key))
    .filter((flag): flag is string => flag !== undefined);
  return flags.length > 0 ? `AWS ${basis} (${flags.join(", ")})` : `AWS ${basis}`;
}

function summarizeGcp(gcp: Record<string, unknown>): string {
  const flags = Object.keys(gcp).map((key) => `${key}=${String(gcp[key])}`);
  return flags.length > 0 ? `GCP ${flags.join(", ")}` : "GCP (empty)";
}

function summarizeAzure(azure: Record<string, unknown>): string {
  const basis = asString(azure.costType) ?? "(costType omitted)";
  return `Azure ${basis}`;
}

function summarizeCostBasis(value: unknown, publishDefaults: boolean): string[] {
  if (value === undefined) {
    return [publishDefaults
      ? "Cost basis: omitted (account defaults are merged at dispatch)"
      : "Cost basis: omitted from replacement body"];
  }
  const prefs = asRecord(value);
  if (!prefs) return ["Cost basis: unrecognized"];
  const lines = ["Cost basis:"];
  for (const key of ["showAnomalies", "includeOthers", "includeUnallocatedCost"] as const) {
    const flag = preferenceFlag(prefs, key);
    if (flag) lines.push(`- ${flag}`);
  }
  const aws = asRecord(prefs.awsPreferences);
  if (aws) lines.push(`- ${summarizeAws(aws)}`);
  const gcp = asRecord(prefs.gcpPreferences);
  if (gcp) lines.push(`- ${summarizeGcp(gcp)}`);
  const azure = asRecord(prefs.azureViewPreferences);
  if (azure) lines.push(`- ${summarizeAzure(azure)}`);
  const known = new Set([
    "showAnomalies",
    "includeOthers",
    "includeUnallocatedCost",
    "awsPreferences",
    "gcpPreferences",
    "azureViewPreferences",
  ]);
  const extra = Object.keys(prefs).filter((key) => !known.has(key));
  if (extra.length > 0) lines.push(`- additional preference fields: ${extra.join(", ")}`);
  if (lines.length === 1) lines.push("- (empty)");
  return lines;
}

function summarizeDataSources(value: unknown): string {
  if (value === undefined) return "Data sources: omitted";
  if (typeof value === "string") return `Data sources: ${clip(value)}`;
  if (!Array.isArray(value)) return "Data sources: unrecognized";
  if (value.length === 0) return "Data sources: none";
  return `Data sources: ${formatList(value)}`;
}

function summarizeViewState(body: Record<string, unknown>, publishDefaults: boolean): string {
  const state = asString(body.viewState);
  if (state) return `View state: ${state}`;
  if (publishDefaults) {
    return "View state: COMPLETED (applied when omitted; the perspective is published immediately)";
  }
  return "View state: omitted from replacement body";
}

function summarizePerspective(body: Record<string, unknown>, options: PerspectivePreviewOptions): string {
  const name = asString(body.name);
  const lines = [
    "Perspective preview:",
    `Name: ${name ? clip(name) : "omitted"}`,
    summarizeDataSources(body.dataSources),
    summarizeViewState(body, options.publishDefaults),
    `Filter rules: ${summarizeRules(body.viewRules)}`,
    ...summarizeCostBasis(body.viewPreferences, options.publishDefaults),
  ];
  if (options.publishDefaults) {
    lines.push("Account cost-basis defaults are merged at dispatch; preferences listed here override them.");
  }
  return truncatePreview(lines.join("\n"));
}

function previewRecord(body: unknown, fallback: string): Record<string, unknown> | string {
  const record = coerceRecord(body);
  if (!record) return fallback;
  return record;
}

/** Confirmation summary for cost_category create/update. Keeps chargeback fields ahead of truncation. */
export function previewCostCategoryWrite(body: unknown): string {
  const record = previewRecord(
    body,
    "Chargeback preview unavailable: body is not a JSON object.",
  );
  if (typeof record === "string") return record;
  return summarizeCostCategory(record);
}

/** Confirmation summary for cost_perspective create/update. */
export function previewCostPerspectiveWrite(body: unknown, options: PerspectivePreviewOptions): string {
  const record = previewRecord(
    body,
    "Perspective preview unavailable: body is not a JSON object.",
  );
  if (typeof record === "string") return record;
  return summarizePerspective(record, options);
}
