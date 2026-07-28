import type { HarnessYamlScope } from "./types.js";

export interface LiveSchemaCacheKeyScope {
  orgId?: string;
  projectId?: string;
  /** Explicit entity identifier — omitted when using the internal placeholder only. */
  identifier?: string;
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
  if (identifiers.identifier) {
    key.push(identifiers.identifier);
  }
  return JSON.stringify(key);
}

export function buildBundledSchemaKey(resourceType: string, scope: HarnessYamlScope): string {
  return `${resourceType}.${scope}`;
}
