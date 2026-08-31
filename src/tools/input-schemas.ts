import * as z from "zod/v4";

function hasConfiguredDefault(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Field copy for org_id. Mentions a default only when one is actually configured. */
export function orgIdDescription(defaultOrg?: string): string {
  if (hasConfiguredDefault(defaultOrg)) {
    return (
      `Organization identifier. Optional; overrides configured default '${defaultOrg.trim()}'. ` +
      "Pass explicitly when the user names a different org."
    );
  }
  return (
    "Organization identifier. Required for org- and project-scoped resources unless a Harness URL is passed. " +
    "This session has no configured default (common in hosted/multi-user HTTP) — pass the current org_id on the first call. Do not omit it."
  );
}

/** Field copy for project_id. Mentions a default only when one is actually configured. */
export function projectIdDescription(defaultProject?: string): string {
  if (hasConfiguredDefault(defaultProject)) {
    return (
      `Project identifier. Optional; overrides configured default '${defaultProject.trim()}'. ` +
      "Pass explicitly when the user names a different project."
    );
  }
  return (
    "Project identifier. Required for project-scoped resources unless a Harness URL is passed. " +
    "This session has no configured default (common in hosted/multi-user HTTP) — pass the current project_id on the first call. Do not omit it."
  );
}

export function orgIdField(defaultOrg?: string) {
  return z.string().optional().describe(orgIdDescription(defaultOrg));
}

export function projectIdField(defaultProject?: string) {
  return z.string().optional().describe(projectIdDescription(defaultProject));
}

/** Shared copy for resource_scope. Do not tell the model that `account` skips known org/project. */
export const RESOURCE_SCOPE_DESCRIPTION =
  "Scope for the operation. account: account-level resources only — do not use account to skip a known org/project. " +
  "org: org-level (org_id). project: org+project. Omit to use the resource's default scope. Auto-detected from url when present.";

/**
 * Shared scope selector for create/update/delete/list/get/search tools.
 */
export const resourceScopeSchema = z
  .enum(["account", "org", "project"])
  .optional()
  .describe(RESOURCE_SCOPE_DESCRIPTION);

/** harness_describe scopeHint for multi-scope resources. */
export function describeScopeHint(opts: {
  scopeOptional: boolean | undefined;
  hasOrgDefault: boolean;
  hasProjectDefault: boolean;
}): string {
  const base =
    "Set resource_scope='account' for account-level data, resource_scope='org' for org-level data, or resource_scope='project' for project-level data.";
  if (opts.scopeOptional) {
    return `${base} If resource_scope is omitted, org/project are only included when explicitly passed (no fallback to configured defaults).`;
  }
  if (opts.hasOrgDefault && opts.hasProjectDefault) {
    return `${base} If resource_scope is omitted, the resource uses its default scope and configured org/project defaults.`;
  }
  return (
    `${base} If resource_scope is omitted, the resource uses its default scope. ` +
    "Pass org_id and project_id explicitly — this session has no configured org/project default."
  );
}

export function resourceTypeSchema(resourceTypes: string[]) {
  if (resourceTypes.length === 0) {
    return z.string().refine(() => false, { error: "No enabled resource types support this operation" });
  }

  return z.enum(resourceTypes as [string, ...string[]]);
}
