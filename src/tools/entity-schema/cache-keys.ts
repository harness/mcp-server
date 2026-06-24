import type { HarnessYamlScope } from "./types.js";

export interface LiveSchemaCacheKeyScope {
  orgId?: string;
  projectId?: string;
}

export function buildLiveSchemaCacheKey(
  resourceType: string,
  accountId: string,
  scope: HarnessYamlScope,
  identifiers: LiveSchemaCacheKeyScope = {},
): string {
  const key = [resourceType, scope, accountId];
  if (scope === "org" || scope === "project") {
    key.push(identifiers.orgId ?? "");
  }
  if (scope === "project") {
    key.push(identifiers.projectId ?? "");
  }
  return JSON.stringify(key);
}

export function buildBundledSchemaKey(resourceType: string, scope: HarnessYamlScope): string {
  return `${resourceType}.${scope}`;
}
