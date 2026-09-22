import type { PathBuilderConfig, ResourceScope } from "./types.js";

/** Standard scope guidance (matches gitops, connectors, services toolsets). */
export const SCOPE_BEHAVIOR_DOC =
  "SCOPE BEHAVIOR (account ID is always from config):\n" +
  "- Account-level: Do NOT pass org_id or project_id\n" +
  "- Org-level: Pass org_id only (no project_id)\n" +
  "- Project-level: Pass both org_id AND project_id";

/**
 * Build v1 template-service base path from explicit resource_scope, or from
 * org_id/project_id presence when callers rely on legacy inferred scoping.
 */
export function templateV1BasePathFromScope(
  input: Record<string, unknown>,
  config: PathBuilderConfig,
): string {
  const requestedScope = input.resource_scope as ResourceScope | undefined;
  const org = (input.org_id as string | undefined) ?? config.HARNESS_ORG;
  const project = (input.project_id as string | undefined) ?? config.HARNESS_PROJECT;

  if (requestedScope === "account") {
    return "/v1/templates";
  }
  if (requestedScope === "org") {
    if (!org) throw new Error("resource_scope \"org\" requires org_id or HARNESS_ORG.");
    return `/v1/orgs/${encodeURIComponent(org)}/templates`;
  }
  if (requestedScope === "project") {
    if (!org) throw new Error("resource_scope \"project\" requires org_id or HARNESS_ORG.");
    if (!project) throw new Error("resource_scope \"project\" requires project_id or HARNESS_PROJECT.");
    return `/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/templates`;
  }

  const inputOrg = input.org_id as string | undefined;
  const inputProject = input.project_id as string | undefined;
  if (inputOrg && inputProject) {
    return `/v1/orgs/${encodeURIComponent(inputOrg)}/projects/${encodeURIComponent(inputProject)}/templates`;
  }
  if (inputOrg) {
    return `/v1/orgs/${encodeURIComponent(inputOrg)}/templates`;
  }
  return "/v1/templates";
}

/**
 * Validates that an FME identifier the caller must supply is actually present.
 *
 * FME `routeResolver`s build their own paths, which bypasses the registry's
 * `pathParams` presence check — without this guard a missing identifier would
 * silently produce a malformed URL (e.g. a trailing-slash DELETE) instead of a
 * clear error. Returns the raw value; callers still encode it.
 */
export function requireFmeIdentifier(input: Record<string, unknown>, field: string, resourceType: string): string {
  const value = input[field];
  if (value === undefined || value === null || value === "") {
    throw new Error(`${resourceType}: "${field}" is required.`);
  }
  return String(value);
}

/**
 * Mode selector for the remaining dual-mode FME operations (`fme_workspace`,
 * `fme_identity`, `fme_segment_keys`) that have no Harness-native implementation
 * for some or all of their ops. Returns true when the caller selected the
 * Harness-native contract (org_id+project_id), false for the legacy contract.
 * A partial pair is rejected: half a scope would otherwise leak a stray
 * orgIdentifier/projectIdentifier query param onto a legacy Split.io API call.
 */
export function isFmeHarnessNativeSelected(input: Record<string, unknown>, resourceType: string): boolean {
  const orgId = input.org_id;
  const projectId = input.project_id;
  if (orgId && !projectId) {
    throw new Error(`${resourceType}: project_id is required when org_id is provided.`);
  }
  if (projectId && !orgId) {
    throw new Error(`${resourceType}: org_id is required when project_id is provided.`);
  }
  return Boolean(orgId && projectId);
}

/**
 * Guards Harness-native-only operations that have no legacy Split.io fallback.
 * Rejects workspace_id (including mixed with org/project) so new ops cannot
 * dual-route. Missing org_id/project_id must throw rather than falling back to
 * config.HARNESS_ORG/HARNESS_PROJECT, and the error must not offer workspace_id
 * as an alternative.
 */
export function requireHarnessNativeSegmentScope(input: Record<string, unknown>, resourceType: string): void {
  if (input.workspace_id) {
    throw new Error(
      `${resourceType}: Harness-native (org_id/project_id) only — pass org_id+project_id instead of workspace_id.`,
    );
  }
  if (!input.org_id || !input.project_id) {
    throw new Error(`${resourceType}: org_id and project_id are required (account is taken from config).`);
  }
}

/**
 * Guards Harness-native-only FME operations that used to be dual-mode. Unlike
 * `requireHarnessNativeSegmentScope`, a stray `workspace_id` is silently ignored
 * rather than rejected — callers migrating off the legacy contract shouldn't hit
 * a hard error just for leaving the old field in place. Missing org_id/project_id
 * still throws rather than falling back to config.HARNESS_ORG/HARNESS_PROJECT.
 * Used by `fme_feature_flag`, `fme_feature_flag_definition`, `fme_environment`,
 * `fme_rollout_status`, and `fme_traffic_type`.
 */
export function requireFmeHarnessNativeScope(input: Record<string, unknown>, resourceType: string): void {
  if (!input.org_id || !input.project_id) {
    throw new Error(`${resourceType}: org_id and project_id are required (account is taken from config).`);
  }
}

/**
 * Toolset files may not call `console.*` directly (see architecture.test.ts —
 * logging belongs in handlers/registry, not toolsets). Route deprecation
 * logging for the remaining dual-mode FME resources through here instead.
 */
export function logFmeDeprecation(message: string): void {
  console.error(message);
}
