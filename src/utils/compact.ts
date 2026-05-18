/**
 * Compact item utility — strips verbose metadata from list results,
 * keeping only fields that are actionable for an LLM.
 */

/** Timestamp-like key pattern: createdAt, lastModifiedTs, startTime, updatedDate, etc. */
const TIMESTAMP_PATTERN = /(?:At|Ts|Time|Date)$/;

/** Fields to always keep when compacting list items. */
const IDENTITY_FIELDS = new Set([
  "identifier", "identity", "name", "displayName", "description", "slug",
  "versionLabel", "sha", "title", "message",
]);

const STATUS_FIELDS = new Set([
  "status", "state", "enabled", "health",
  "stableTemplate", "isChaosEnabled",
]);

const TYPE_FIELDS = new Set([
  "type", "kind", "category", "module",
  "templateEntityType", "childType",
]);

const OWNERSHIP_FIELDS = new Set([
  "tags", "labels", "owner", "author", "committer",
]);

const COST_FIELDS = new Set([
  // Core cost fields
  "cost", "costTrend",
  // Summary fields (from cost_summary)
  "idleCost", "unallocatedCost", "utilizedCost", "forecastCost",
  // Budget fields (from budget queries)
  "actualCost", "budgetAmount",
  // Recommendation fields
  "totalMonthlyCost", "totalMonthlySaving",
]);

const ALWAYS_KEEP = new Set(["openInHarness"]);

/** Identifier-like key pattern: pipelineIdentifier, projectId, env_id, etc. */
const IDENTIFIER_PATTERN = /(?:Identifier|Id|_id)$/;

function isWhitelistedKey(key: string): boolean {
  return (
      IDENTITY_FIELDS.has(key) ||
      STATUS_FIELDS.has(key) ||
      TYPE_FIELDS.has(key) ||
      OWNERSHIP_FIELDS.has(key) ||
      COST_FIELDS.has(key) ||
      ALWAYS_KEEP.has(key) ||
      TIMESTAMP_PATTERN.test(key) ||
      IDENTIFIER_PATTERN.test(key)
  );
}

/**
 * Strip verbose fields from an array of list items.
 * Keeps identity, status, type, ownership, timestamp, and deep link fields.
 * Merges openInHarness into name as a markdown hyperlink.
 */
export function compactItems(items: unknown[]): unknown[] {
  return items.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const full = item as Record<string, unknown>;
    const slim: Record<string, unknown> = {};
    for (const key of Object.keys(full)) {
      if (isWhitelistedKey(key)) {
        slim[key] = full[key];
      }
    }

    // Merge deep link into name as markdown hyperlink, then drop the separate field
    if (typeof slim.openInHarness === "string" && typeof slim.name === "string") {
      slim.name = `[${slim.name}](${slim.openInHarness})`;
      delete slim.openInHarness;
    }

    return slim;
  });
}
