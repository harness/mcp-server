import type { ResourceDefinition } from "./types.js";

/**
 * Map common agent mistakes (e.g. security_issue field names on security_exemption)
 * to the canonical list-filter keys declared on the resource.
 */
export function applyListFilterAliases(
  input: Record<string, unknown>,
  aliases: Record<string, string> | undefined,
): void {
  if (!aliases) return;

  for (const [alias, target] of Object.entries(aliases)) {
    if (input[target] !== undefined || input[alias] === undefined) continue;

    const raw = input[alias];
    if (Array.isArray(raw)) {
      const first = raw.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      if (first !== undefined) input[target] = typeof first === "string" ? first.trim() : first;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      input[target] = trimmed.includes(",") ? trimmed.split(",")[0]!.trim() : trimmed;
    } else {
      input[target] = raw;
    }
    delete input[alias];
  }
}

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

  const scopeKeywords = new Set(["org", "account", "project", "organization"]);
  const rawOrg = input.org_id;
  const orgFromInput =
    typeof rawOrg === "string" && rawOrg.trim() !== "" && !scopeKeywords.has(rawOrg.toLowerCase())
      ? rawOrg.trim()
      : undefined;
  const rawProject = input.project_id;
  const projectFromInput =
    typeof rawProject === "string" &&
    rawProject.trim() !== "" &&
    !scopeKeywords.has(rawProject.toLowerCase())
      ? rawProject.trim()
      : undefined;

  if (def.scope === "project") {
    const orgId = orgFromInput ?? resolveScopeId(undefined, configOrg);
    const projectId = projectFromInput ?? resolveScopeId(undefined, configProject);
    if (!orgId || !projectId) {
      throw new Error(
        `${resourceType}: listing requires project scope (org_id + project_id). ` +
          `Pass both on the harness_list call, set HARNESS_ORG and HARNESS_PROJECT, or use a Harness project URL. ` +
          `Do not pass resource_scope='account' or 'org' on list — those refer to approval scope on harness_execute.`,
      );
    }
    return;
  }

  if (def.scope === "org") {
    const orgId = orgFromInput ?? resolveScopeId(undefined, configOrg);
    if (!orgId) {
      throw new Error(
        `${resourceType}: listing requires org scope (org_id). ` +
          `Pass org_id explicitly, set HARNESS_ORG, or use a Harness URL.`,
      );
    }
  }
}
