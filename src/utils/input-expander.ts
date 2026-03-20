/**
 * Declarative input expansion: converts shorthand keys (e.g. {branch: "main"})
 * into full nested structures (e.g. {build: {type: "branch", spec: {branch: "main"}}})
 * using rules defined on EndpointSpec.inputExpansions.
 */
import type { InputExpansionRule } from "../registry/types.js";

/**
 * Deep-clone a template object and replace every exact "$value" string
 * with the provided value. Only exact matches are replaced — "$value"
 * embedded in a larger string (e.g. "prefix-$value") is left as-is.
 */
export function substituteValue(
  template: Record<string, unknown>,
  value: unknown,
): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;

  function walk(obj: unknown): unknown {
    if (typeof obj === "string" && obj === "$value") return value;
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj !== null && typeof obj === "object") {
      const record = obj as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        record[key] = walk(record[key]);
      }
    }
    return obj;
  }

  walk(cloned);
  return cloned;
}

/**
 * Apply declarative expansion rules to an input map.
 * For each rule whose triggerKey is present (and skipIfPresent guard is not),
 * merge the expanded structure into the result.
 *
 * Rules are applied in order. The original input is not mutated.
 */
export function applyInputExpansions(
  inputs: Record<string, unknown>,
  rules: InputExpansionRule[],
): Record<string, unknown> {
  let result = { ...inputs };
  for (const rule of rules) {
    const value = result[rule.triggerKey];
    if (value === undefined) continue;
    if (rule.skipIfPresent && result[rule.skipIfPresent] !== undefined) continue;
    const expanded = substituteValue(rule.expand, value);
    result = { ...result, ...expanded };
  }
  return result;
}
