/**
 * Parse Harness UI URLs to extract identifiers (org, project, resource type, resource ID, etc.).
 * Enables users to paste a Harness URL instead of manually specifying individual parameters.
 */

export interface ParsedHarnessUrl {
  account_id: string;
  resource_scope?: "account" | "org" | "project";
  org_id?: string;
  project_id?: string;
  module?: string;
  resource_type?: string;
  resource_id?: string;
  pipeline_id?: string;
  execution_id?: string;
  agent_id?: string;
  repo_id?: string;
  pr_number?: string;
  comment_id?: string;
  registry_id?: string;
  artifact_id?: string;
  environment_id?: string;
  step_id?: string;
  stage_id?: string;
  stage_execution_id?: string;
  branch?: string;
  store_type?: string;
  connector_ref?: string;
  repo_name?: string;
  /** RMG release id — UUID from search or UI URL slug (identifier-version hash). */
  release_id?: string;
}

/** Union of ParsedHarnessUrl fields that RESOURCE_SEGMENTS can write to. */
type ContextField =
  | "pipeline_id"
  | "execution_id"
  | "resource_id"
  | "agent_id"
  | "repo_id"
  | "pr_number"
  | "comment_id"
  | "registry_id"
  | "artifact_id"
  | "environment_id";

/** Known Harness module identifiers that appear in URL paths */
const MODULES = new Set(["cd", "ci", "ce", "cv", "sto", "chaos", "idp", "sei", "fme", "ir"]);

/**
 * Maps URL path segments (plural resource names) to registry resource types
 * and the field name used when the resource appears as parent context.
 */
const RESOURCE_SEGMENTS: Record<string, { type: string; contextField: ContextField }> = {
  "pipelines":        { type: "pipeline",            contextField: "pipeline_id" },
  "executions":       { type: "execution",           contextField: "execution_id" },
  "deployments":      { type: "execution",           contextField: "execution_id" },
  "triggers":         { type: "trigger",             contextField: "resource_id" },
  "input-sets":       { type: "input_set",           contextField: "resource_id" },
  "services":         { type: "service",             contextField: "resource_id" },
  "environments":     { type: "environment",         contextField: "environment_id" },
  "infrastructures":  { type: "infrastructure",      contextField: "resource_id" },
  "infrastructure-definitions": { type: "infrastructure", contextField: "resource_id" },
  "connectors":       { type: "connector",           contextField: "resource_id" },
  "templates":        { type: "template",            contextField: "resource_id" },
  "secrets":          { type: "secret",              contextField: "resource_id" },
  "delegates":        { type: "delegate",            contextField: "resource_id" },
  "agents":           { type: "gitops_agent",        contextField: "agent_id" },
  "applications":     { type: "gitops_application",  contextField: "resource_id" },
  "clusters":         { type: "gitops_cluster",      contextField: "resource_id" },
  "feature-flags":    { type: "fme_feature_flag",     contextField: "resource_id" },
  "splits":           { type: "fme_feature_flag",     contextField: "resource_id" },
  "experiments":      { type: "chaos_experiment",    contextField: "resource_id" },
  "load-tests":       { type: "chaos_loadtest",       contextField: "resource_id" },
  "registries":       { type: "registry",            contextField: "registry_id" },
  "artifacts":        { type: "artifact",            contextField: "artifact_id" },
  "repositories":     { type: "repository",          contextField: "repo_id" },
  "repos":            { type: "repository",          contextField: "repo_id" },
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
  "file-store":       { type: "file_store",          contextField: "resource_id" },
  "pullrequests":     { type: "pull_request",        contextField: "pr_number" },
  "pulls":            { type: "pull_request",        contextField: "pr_number" },
  "pull-requests":    { type: "pull_request",        contextField: "pr_number" },
  "conversation":     { type: "pr_activity",          contextField: "comment_id" },
  "alerts":           { type: "alert",                contextField: "resource_id" },
  "incidents":        { type: "incident",             contextField: "resource_id" },
};

const URL_RESOURCE_SCOPE_TYPES = new Set([
  "connector",
  "service",
  "environment",
  "infrastructure",
  "secret",
  "template",
  "file_store",
]);

/** Structural segments that should never be treated as resource IDs */
const STRUCTURAL = new Set([
  "ng", "all", "account", "module", "orgs", "projects", "organizations",
]);

/**
 * Placeholder base used only to satisfy `new URL()` when the input is a path-only
 * string like `/ng/account/<id>/...`. parseHarnessUrl never reads `url.host` /
 * `url.origin` / `url.protocol`; it walks `url.pathname` and `url.searchParams`
 * only. Using an explicitly fake host makes it clear in code review that the
 * host is not consulted and the parser is cluster-agnostic (prod0 / eu1 /
 * harness0 / self-managed / vanity hosts all parse identically).
 */
const PLACEHOLDER_BASE = "https://harness.invalid";

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
 * - Path-only URLs (e.g. `/ng/account/<id>/...`) — the Harness UI's copy-link
 *   actions sometimes produce these.
 */
export function parseHarnessUrl(urlStr: string): ParsedHarnessUrl {
  const url = new URL(urlStr, PLACEHOLDER_BASE);
  const segments = url.pathname.split("/").filter(Boolean);

  const result: ParsedHarnessUrl = { account_id: "" };

  // 1. Extract account_id
  const accountIdx = segments.indexOf("account");
  if (accountIdx >= 0 && accountIdx + 1 < segments.length) {
    result.account_id = segments[accountIdx + 1]!;
  }

  // 2. Extract module from /module/{name}/ pattern
  const moduleIdx = segments.indexOf("module");
  if (moduleIdx >= 0 && moduleIdx + 1 < segments.length) {
    result.module = segments[moduleIdx + 1]!;
  }

  // 3. Extract org and project
  const orgsIdx = segments.indexOf("orgs");
  if (orgsIdx >= 0 && orgsIdx + 1 < segments.length) {
    result.org_id = segments[orgsIdx + 1]!;
  }
  const projectsIdx = segments.indexOf("projects");
  if (projectsIdx >= 0 && projectsIdx + 1 < segments.length) {
    result.project_id = segments[projectsIdx + 1]!;
  }

  // 4. Check for module after /all/ (e.g. /all/cd/orgs/...)
  const allIdx = segments.indexOf("all");
  if (allIdx >= 0 && !result.module && allIdx + 1 < segments.length) {
    const afterAll = segments[allIdx + 1]!;
    if (MODULES.has(afterAll)) {
      result.module = afterAll;
    }
  }

  // 5. Walk segments to find resource types and IDs.
  //    Each match records the resource type and optional ID.
  //    The last (deepest) match becomes the primary resource.
  const matches: Array<{ type: string; contextField: ContextField; id?: string }> = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const def = RESOURCE_SEGMENTS[seg];
    if (!def) continue;

    // Check if the next segment is a resource ID
    const next = segments[i + 1];
    let id: string | undefined;
    if (
      next &&
      !RESOURCE_SEGMENTS[next] &&
      !STRUCTURAL.has(next)
    ) {
      id = decodeURIComponent(next);
      i++; // skip past the ID segment
    }

    matches.push({ type: def.type, contextField: def.contextField, id });
  }

  // 6. Build result — set context fields from all matches, resource_id from the primary
  if (matches.length > 0) {
    const primary = matches[matches.length - 1]!;
    result.resource_type = primary.type;

    for (const match of matches) {
      if (match.id) {
        result[match.contextField] = match.id;
      }
    }

    if (primary.id) {
      result.resource_id = primary.id;
    }

    if (URL_RESOURCE_SCOPE_TYPES.has(primary.type)) {
      if (result.project_id) {
        result.resource_scope = "project";
      } else if (result.org_id) {
        result.resource_scope = "org";
      } else {
        result.resource_scope = "account";
      }
    }
  }

  // 7. RMG release-management URLs:
  // .../release-management/releases/{slug}/execution/phases|tasks|activities
  const rmgRootIdx = segments.indexOf("release-management");
  if (rmgRootIdx >= 0) {
    const releasesIdx = segments.indexOf("releases", rmgRootIdx);
    if (releasesIdx >= 0 && releasesIdx + 1 < segments.length) {
      const releaseSlug = decodeURIComponent(segments[releasesIdx + 1]!);
      if (releaseSlug && !STRUCTURAL.has(releaseSlug) && releaseSlug !== "execution") {
        result.release_id = releaseSlug;
        result.resource_id = releaseSlug;

        const suffix = segments.slice(releasesIdx + 2);
        if (suffix.includes("phases")) {
          result.resource_type = "release_execution_phase";
        } else if (suffix.includes("tasks")) {
          result.resource_type = "release_execution_task";
        } else if (suffix.includes("activities")) {
          result.resource_type = "release_execution_activity";
        } else {
          result.resource_type = "release";
        }

        if (result.project_id) {
          result.resource_scope = "project";
        } else if (result.org_id) {
          result.resource_scope = "org";
        }
      }
    }
  }

  const stepId = url.searchParams.get("step") ?? url.searchParams.get("stepId");
  if (stepId) result.step_id = stepId;

  const stageId = url.searchParams.get("stage") ?? url.searchParams.get("stageId");
  if (stageId) result.stage_id = stageId;

  const stageExecId = url.searchParams.get("stageExecId");
  if (stageExecId) result.stage_execution_id = stageExecId;

  const commentId = url.searchParams.get("commentId");
  if (commentId) result.comment_id = commentId;

  const branch = url.searchParams.get("branch");
  if (branch) result.branch = branch;

  const storeType = url.searchParams.get("storeType");
  if (storeType) result.store_type = storeType;

  const connectorRef = url.searchParams.get("connectorRef");
  if (connectorRef) result.connector_ref = connectorRef;

  const repoName = url.searchParams.get("repoName");
  if (repoName) result.repo_name = repoName;

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
  "pr_number",
  "comment_id",
  "registry_id",
  "artifact_id",
  "environment_id",
  "step_id",
  "stage_id",
  "stage_execution_id",
  "branch",
  "store_type",
  "connector_ref",
  "repo_name",
  "release_id",
];

export interface ApplyUrlDefaultsOptions {
  includeResourceScope?: boolean;
}

/**
 * FME resources that are Harness-native only (no legacy workspace_id contract at all —
 * see requireHarnessNativeSegmentScope). A stray workspace_id on these calls must not
 * suppress org_id/project_id derived from a pasted Harness URL, since workspace_id isn't
 * a real scoping mode for them.
 */
const FME_HARNESS_NATIVE_ONLY_RESOURCE_TYPES = new Set(["fme_segment", "fme_segment_definition", "fme_metric"]);

/**
 * If `url` is provided, parse it and merge extracted values into args as defaults.
 * Explicit args always take precedence over URL-derived values.
 * Returns a new object (does not mutate the original).
 */
export function applyUrlDefaults(
  args: Record<string, unknown>,
  url?: unknown,
  options: ApplyUrlDefaultsOptions = {},
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
  if (
    options.includeResourceScope &&
    (merged.resource_scope === undefined || merged.resource_scope === "") &&
    parsed.resource_scope !== undefined
  ) {
    merged.resource_scope = parsed.resource_scope;
  }
  // A legacy workspace_id (FME's Split.io identifier) takes precedence over
  // org/project incidentally present in a UI URL — the two are mutually
  // exclusive scoping modes for FME resources (see resolveFmeDualMode).
  // Use the caller's declared resource_type when present — the URL's own parsed
  // type may be absent or non-FME even when the call itself targets an FME resource.
  // Harness-native-only resources (fme_segment/fme_segment_definition) are excluded:
  // they have no workspace_id contract, so a stray value must not suppress org/project.
  const declaredResourceType = (args.resource_type as string | undefined) ?? parsed.resource_type;
  const hasWorkspaceId = typeof args.workspace_id === "string" && args.workspace_id !== "";
  const skipOrgProjectFromUrl =
    hasWorkspaceId &&
    declaredResourceType?.startsWith("fme_") === true &&
    !FME_HARNESS_NATIVE_ONLY_RESOURCE_TYPES.has(declaredResourceType);
  for (const field of MERGEABLE_FIELDS) {
    if (skipOrgProjectFromUrl && (field === "org_id" || field === "project_id")) continue;
    if ((merged[field] === undefined || merged[field] === "") && parsed[field] !== undefined) {
      merged[field] = parsed[field];
    }
  }

  return merged;
}
