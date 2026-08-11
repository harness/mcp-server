import type { ResourceDefinition, ResourceScope } from "./types.js";

function resolveScopeId(
  inputValue: unknown,
  configDefault: string | undefined,
): string | undefined {
  if (typeof inputValue === "string" && inputValue.trim() !== "") {
    return inputValue.trim();
  }
  if (configDefault && configDefault.trim() !== "") {
    return configDefault.trim();
  }
  return undefined;
}

function getSupportedScopes(def: ResourceDefinition): readonly ResourceScope[] {
  return def.supportedScopes?.length ? def.supportedScopes : [def.scope];
}

function scopeResolutionHint(def: ResourceDefinition): string {
  const supported = getSupportedScopes(def);
  if (supported.length > 1) {
    return ` Supported scopes: ${supported.join(", ")} — pass resource_scope for account- or org-level lists.`;
  }
  return "";
}

/**
 * Fail loud before hitting APIs that 500 when org/project query params are omitted.
 * Matches explicit `resource_scope` validation — implicit config fallback must
 * actually resolve, not silently become `undefined` in the query string.
 */
export function assertListScopeResolved(
  resourceType: string,
  def: ResourceDefinition,
  input: Record<string, unknown>,
  configOrg: string | undefined,
  configProject: string | undefined,
): void {
  if (def.scopeOptional) return;

  // Explicit resource_scope is validated in executeSpec via getExplicitScopeValues,
  // which supports account/org/project narrowing on multi-scope resources (e.g. connector).
  const rawScope = input.resource_scope;
  if (rawScope !== undefined && rawScope !== "") return;

  const orgId = resolveScopeId(input.org_id, configOrg);
  const projectId = resolveScopeId(input.project_id, configProject);
  const hint = scopeResolutionHint(def);

  if (def.scope === "project") {
    if (!orgId || !projectId) {
      throw new Error(
        `${resourceType}: listing requires project scope (org_id + project_id). ` +
          `Pass both on the harness_list call, set HARNESS_ORG and HARNESS_PROJECT, or use a Harness project URL.${hint}`,
      );
    }
    return;
  }

  if (def.scope === "org") {
    if (!orgId) {
      throw new Error(
        `${resourceType}: listing requires org scope (org_id). ` +
          `Pass org_id explicitly, set HARNESS_ORG, or use a Harness URL.${hint}`,
      );
    }
  }
}
