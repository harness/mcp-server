import type { HarnessYamlScope } from "./types.js";

export function buildLiveSchemaCacheKey(
  resourceType: string,
  accountId: string,
  scope: HarnessYamlScope,
): string {
  return `${resourceType}:${scope}:${accountId}`;
}

export function buildBundledSchemaKey(resourceType: string, scope: HarnessYamlScope): string {
  return `${resourceType}.${scope}`;
}
