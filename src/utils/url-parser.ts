/**
 * Parse Harness UI URLs to extract identifiers (org, project, resource type, resource ID, etc.).
 * Enables users to paste a Harness URL instead of manually specifying individual parameters.
 */

export interface ParsedHarnessUrl {
  account_id: string;
  org_id?: string;
  project_id?: string;
  module?: string;
  resource_type?: string;
  resource_id?: string;
  pipeline_id?: string;
  execution_id?: string;
  agent_id?: string;
  repo_id?: string;
  registry_id?: string;
  artifact_id?: string;
  environment_id?: string;
  /** Index signature allows dynamic contextField assignment from URL parsing. */
  [key: string]: string | undefined;
}

/** Known Harness module identifiers that appear in URL paths */
const MODULES = new Set(["cd", "ci", "cf", "ce", "cv", "sto", "chaos", "idp", "sei"]);

/**
 * Maps URL path segments (plural resource names) to registry resource types
 * and the field name used when the resource appears as parent context.
 */
const RESOURCE_SEGMENTS: Record<string, { type: string; contextField: string }> = {
  "pipelines":        { type: "pipeline",            contextField: "pipeline_id" },
  "executions":       { type: "execution",           contextField: "execution_id" },
  "deployments":      { type: "execution",           contextField: "execution_id" },
  "triggers":         { type: "trigger",             contextField: "resource_id" },
  "input-sets":       { type: "input_set",           contextField: "resource_id" },
  "services":         { type: "service",             contextField: "resource_id" },
  "environments":     { type: "environment",         contextField: "environment_id" },
  "connectors":       { type: "connector",           contextField: "resource_id" },
  "templates":        { type: "template",            contextField: "resource_id" },
  "secrets":          { type: "secret",              contextField: "resource_id" },
  "delegates":        { type: "delegate",            contextField: "resource_id" },
  "agents":           { type: "gitops_agent",        contextField: "agent_id" },
  "applications":     { type: "gitops_application",  contextField: "resource_id" },
  "clusters":         { type: "gitops_cluster",      contextField: "resource_id" },
  "feature-flags":    { type: "feature_flag",        contextField: "resource_id" },
  "experiments":      { type: "chaos_experiment",    contextField: "resource_id" },
  "registries":       { type: "registry",            contextField: "registry_id" },
  "artifacts":        { type: "artifact",            contextField: "artifact_id" },
  "repositories":     { type: "repository",          contextField: "repo_id" },
  "issues":           { type: "sto_issue",           contextField: "resource_id" },
  "exemptions":       { type: "sto_exemption",       contextField: "resource_id" },
  "scorecards":       { type: "idp_scorecard",       contextField: "resource_id" },
  "catalog":          { type: "idp_catalog_entity",  contextField: "resource_id" },
  "users":            { type: "user",                contextField: "resource_id" },
  "user-groups":      { type: "user_group",          contextField: "resource_id" },
  "service-accounts": { type: "service_account",     contextField: "resource_id" },
  "roles":            { type: "role",                contextField: "resource_id" },
  "resource-groups":  { type: "resource_group",      contextField: "resource_id" },
  "audit-trail":      { type: "audit_log",           contextField: "resource_id" },
  "dashboards":       { type: "dashboard",           contextField: "resource_id" },
  "pullrequests":     { type: "pull_request",        contextField: "resource_id" },
};

/** Structural segments that should never be treated as resource IDs */
const STRUCTURAL = new Set([
  "ng", "all", "account", "module", "orgs", "projects", "organizations",
]);

/**
 * Parse a Harness UI URL and extract identifiers.
 *
 * Handles patterns like:
 * - .../orgs/{org}/projects/{project}/pipelines/{id}/pipeline-studio
 * - .../orgs/{org}/projects/{project}/pipelines/{id}/executions/{execId}/pipeline
 * - .../module/ci/orgs/{org}/projects/{project}/...
 * - .../all/cd/orgs/{org}/projects/{project}/...
 * - .../all/settings/connectors/{id}
 * - Vanity domains (e.g. ancestry.harness.io)
 */
export function parseHarnessUrl(urlStr: string): ParsedHarnessUrl {
  const url = new URL(urlStr);
  const segments = url.pathname.split("/").filter(Boolean);

  const result: ParsedHarnessUrl = { account_id: "" };

  // 1. Extract account_id
  const accountIdx = segments.indexOf("account");
  if (accountIdx >= 0 && accountIdx + 1 < segments.length) {
    result.account_id = segments[accountIdx + 1];
  }

  // 2. Extract module from /module/{name}/ pattern
  const moduleIdx = segments.indexOf("module");
  if (moduleIdx >= 0 && moduleIdx + 1 < segments.length) {
    result.module = segments[moduleIdx + 1];
  }

  // 3. Extract org and project
  const orgsIdx = segments.indexOf("orgs");
  if (orgsIdx >= 0 && orgsIdx + 1 < segments.length) {
    result.org_id = segments[orgsIdx + 1];
  }
  const projectsIdx = segments.indexOf("projects");
  if (projectsIdx >= 0 && projectsIdx + 1 < segments.length) {
    result.project_id = segments[projectsIdx + 1];
  }

  // 4. Check for module after /all/ (e.g. /all/cd/orgs/...)
  const allIdx = segments.indexOf("all");
  if (allIdx >= 0 && !result.module && allIdx + 1 < segments.length) {
    const afterAll = segments[allIdx + 1];
    if (MODULES.has(afterAll)) {
      result.module = afterAll;
    }
  }

  // 5. Walk segments to find resource types and IDs.
  //    Each match records the resource type and optional ID.
  //    The last (deepest) match becomes the primary resource.
  const matches: Array<{ type: string; contextField: string; id?: string }> = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const def = RESOURCE_SEGMENTS[seg];
    if (!def) continue;

    // Check if the next segment is a resource ID
    const next = segments[i + 1];
    let id: string | undefined;
    if (
      next &&
      !RESOURCE_SEGMENTS[next] &&
      !STRUCTURAL.has(next) &&
      !MODULES.has(next)
    ) {
      id = decodeURIComponent(next);
      i++; // skip past the ID segment
    }

    matches.push({ type: def.type, contextField: def.contextField, id });
  }

  // 6. Build result — set context fields from all matches, resource_id from the primary
  if (matches.length > 0) {
    const primary = matches[matches.length - 1];
    result.resource_type = primary.type;

    for (const match of matches) {
      if (match.id) {
        result[match.contextField] = match.id;
      }
    }

    if (primary.id) {
      result.resource_id = primary.id;
    }
  }

  return result;
}

/** Fields that applyUrlDefaults will merge */
const MERGEABLE_FIELDS: (keyof ParsedHarnessUrl)[] = [
  "org_id",
  "project_id",
  "module",
  "resource_type",
  "resource_id",
  "pipeline_id",
  "execution_id",
  "agent_id",
  "repo_id",
  "registry_id",
  "artifact_id",
  "environment_id",
];

/**
 * If `url` is provided, parse it and merge extracted values into args as defaults.
 * Explicit args always take precedence over URL-derived values.
 * Returns a new object (does not mutate the original).
 */
export function applyUrlDefaults(
  args: Record<string, unknown>,
  url?: unknown,
): Record<string, unknown> {
  if (!url || typeof url !== "string") return args;

  let parsed: ParsedHarnessUrl;
  try {
    parsed = parseHarnessUrl(url);
  } catch {
    // Invalid URL — return args unchanged
    return args;
  }

  const merged = { ...args };
  for (const field of MERGEABLE_FIELDS) {
    if ((merged[field] === undefined || merged[field] === "") && parsed[field] !== undefined) {
      merged[field] = parsed[field];
    }
  }

  return merged;
}
