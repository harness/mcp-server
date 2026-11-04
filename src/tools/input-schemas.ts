import * as z from "zod/v4";

function hasConfiguredDefault(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/** Field copy for org_id. Mentions a default only when one is actually configured. */
export function orgIdDescription(defaultOrg?: string, compact = false): string {
  if (compact) {
    return hasConfiguredDefault(defaultOrg)
      ? `Org identifier. Optional; overrides configured default '${defaultOrg.trim()}'.`
      : "Org identifier. Required unless a Harness URL is passed (no configured default).";
  }
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
export function projectIdDescription(defaultProject?: string, compact = false): string {
  if (compact) {
    return hasConfiguredDefault(defaultProject)
      ? `Project identifier. Optional; overrides configured default '${defaultProject.trim()}'.`
      : "Project identifier. Required for project-scoped resources unless a Harness URL is passed (no configured default).";
  }
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

export function orgIdField(defaultOrg?: string, compact = false) {
  return z.string().optional().describe(orgIdDescription(defaultOrg, compact));
}

export function projectIdField(defaultProject?: string, compact = false) {
  return z.string().optional().describe(projectIdDescription(defaultProject, compact));
}

/** Shared copy for resource_scope. Do not tell the model that `account` skips known org/project. */
export const RESOURCE_SCOPE_DESCRIPTION =
  "Scope for the operation. account: account-level resources only — do not use account to skip a known org/project. " +
  "org: org-level (org_id). project: org+project. Omit to use the resource's default scope. Auto-detected from url when present.";

/** Compact resource_scope copy; the full scope rules live in the server instructions. */
export const RESOURCE_SCOPE_DESCRIPTION_COMPACT =
  "account|org|project. Omit for the resource's default scope. Never use account to skip a known org/project. Auto-detected from url.";

/**
 * Shared scope selector for create/update/delete/list/get/search tools.
 */
export function resourceScopeField(compact = false) {
  return z
    .enum(["account", "org", "project"])
    .optional()
    .describe(compact ? RESOURCE_SCOPE_DESCRIPTION_COMPACT : RESOURCE_SCOPE_DESCRIPTION);
}

export const resourceScopeSchema = resourceScopeField();

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

/**
 * resource_type input. `full` inlines every supported type as an enum; `compact` emits a plain string
 * (validated at dispatch) so the type catalog is not repeated across every tool schema.
 */
export function resourceTypeSchema(resourceTypes: string[], compact = false) {
  if (resourceTypes.length === 0) {
    return z.string().refine(() => false, { error: "No enabled resource types support this operation" });
  }

  if (compact) return z.string().min(1);
  return z.enum(resourceTypes as [string, ...string[]]);
}

