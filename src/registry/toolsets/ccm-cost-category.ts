/**
 * Cost category (business mapping) write helpers: body-schema text and the
 * request-body normalizer used by cost_category create/update.
 */

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const COST_CATEGORY_RULES_NOTE =
  "Each ViewIdCondition: { type: 'VIEW_ID_CONDITION', viewField: { fieldId, fieldName, identifier, identifierName }, viewOperator: 'IN'|'NOT_IN'|'LIKE'|'NOT_NULL'|'NULL', values: string[] }. " +
  "When the user says a value equals something, use IN with those values: 'equals xyz' -> values ['xyz']; 'equals xyz or abc' -> values ['xyz', 'abc']. Never use EQUALS.";

export const COST_CATEGORY_RULES_ITEM_TYPE =
  "rules: [{ viewConditions: [{ type: 'VIEW_ID_CONDITION', viewField: { fieldId: string, fieldName: string, identifier: string, identifierName: string }, viewOperator: 'IN' | 'NOT_IN' | 'LIKE' | 'NOT_NULL' | 'NULL', values: string[] }] }]";

function normalizeCondition(condition: unknown): unknown {
  return isObject(condition) && condition.viewOperator === "EQUALS"
    ? { ...condition, viewOperator: "IN" }
    : condition;
}

function normalizeRule(rule: unknown): unknown {
  if (!isObject(rule) || !Array.isArray(rule.viewConditions)) return rule;
  return { ...rule, viewConditions: rule.viewConditions.map(normalizeCondition) };
}

function normalizeBuckets(buckets: unknown): unknown {
  if (!Array.isArray(buckets)) return buckets;
  return buckets.map((bucket) =>
    isObject(bucket) && Array.isArray(bucket.rules)
      ? { ...bucket, rules: bucket.rules.map(normalizeRule) }
      : bucket,
  );
}

/**
 * The CCM UI only offers IN / NOT_IN / LIKE / NULL / NOT_NULL, so send every EQUALS as IN,
 * single- or multi-value. Cost explorer already reads EQUALS as IN, but recommendations,
 * anomalies and column aggregates match only values[0], and with
 * CCM_COST_BUCKET_SHARED_COST_VALIDATION on, a multi-value EQUALS is rejected at save.
 *
 * Pure: returns a new body, never mutates the input; anything it does not recognise passes through.
 */
export function normalizeCostCategoryBody(body: unknown): unknown {
  if (!isObject(body)) return body;
  const result: JsonObject = { ...body };
  if ("costTargets" in result) result.costTargets = normalizeBuckets(result.costTargets);
  if ("sharedCosts" in result) result.sharedCosts = normalizeBuckets(result.sharedCosts);
  return result;
}
