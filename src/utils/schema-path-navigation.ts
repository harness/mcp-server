/**
 * Navigate Harness JSON Schema definition trees for harness_schema path lookups.
 */

function isSchemaDefinition(node: unknown): boolean {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  const obj = node as Record<string, unknown>;
  return (
    typeof obj.title === "string" ||
    typeof obj.type === "string" ||
    typeof obj.properties === "object" ||
    Array.isArray(obj.oneOf) ||
    Array.isArray(obj.anyOf) ||
    Array.isArray(obj.allOf) ||
    typeof obj.if === "object"
  );
}

/**
 * Depth-first search for a nested definition key under a resource's definitions tree.
 * Handles types like EnvironmentV1 that live under stages/unified/ rather than top-level.
 */
export function findNestedDefinition(
  node: unknown,
  key: string,
  visited = new Set<unknown>(),
): unknown {
  if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
  if (visited.has(node)) return undefined;
  visited.add(node);

  const obj = node as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    const candidate = obj[key];
    if (isSchemaDefinition(candidate)) return candidate;
  }

  for (const value of Object.values(obj)) {
    const found = findNestedDefinition(value, key, visited);
    if (found !== undefined) return found;
  }

  return undefined;
}

/**
 * Navigate into definitions by dot-separated path or nested type name.
 * E.g. "trigger_source" → definitions.trigger.trigger_source
 *       "EnvironmentV1" → definitions.pipeline_v1.stages.unified.EnvironmentV1
 */
export function navigateSchemaPath(
  schema: Record<string, unknown>,
  resourceType: string,
  path: string,
): unknown {
  const definitions = schema.definitions as Record<string, unknown> | undefined;
  if (!definitions) return undefined;

  const resourceDefs = definitions[resourceType] as Record<string, unknown> | undefined;
  if (!resourceDefs) return undefined;

  if (resourceDefs[path]) return resourceDefs[path];

  const parts = path.split(".");
  let current: unknown = resourceDefs;
  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }
  if (current !== undefined) return current;

  if (!path.includes(".")) {
    return findNestedDefinition(resourceDefs, path);
  }

  return undefined;
}
