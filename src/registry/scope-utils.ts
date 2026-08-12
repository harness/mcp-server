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

export type FmeDualModeResult =
  | { mode: "legacy"; workspaceId: string }
  | { mode: "harness_native"; orgId: string; projectId: string };

/**
 * Detects whether FME call uses deprecated `workspace_id` contract or
 * new Harness-native `org_id`+`project_id` contract. Shared by every
 * `fme_*` resource's `routeResolver` in `feature-flags.ts`.
 */
export function resolveFmeDualMode(input: Record<string, unknown>, resourceType: string): FmeDualModeResult {
  const workspaceId = input.workspace_id as string | undefined;
  const orgId = input.org_id as string | undefined;
  const projectId = input.project_id as string | undefined;

  // Check for mixing deprecated and new approaches
  if (workspaceId && (orgId || projectId)) {
    throw new Error(
      `${resourceType}: pass either workspace_id (deprecated) OR org_id+project_id, not both.`,
    );
  }

  // Handle legacy workspace_id mode
  if (workspaceId) {
    console.error(
      `[DEPRECATION] ${resourceType}: workspace_id-based FME calls are deprecated — pass org_id+project_id instead.`,
    );
    return { mode: "legacy", workspaceId };
  }

  // Handle Harness-native mode
  if (orgId && projectId) {
    return { mode: "harness_native", orgId, projectId };
  }

  // If neither mode is satisfied, throw
  throw new Error(
    `${resourceType}: org_id and project_id are required (account is taken from config), or pass the deprecated workspace_id instead.`,
  );
}

/**
 * Toolset files may not call `console.*` directly (see architecture.test.ts —
 * logging belongs in handlers/registry, not toolsets). Route deprecation
 * logging that doesn't go through `resolveFmeDualMode` (e.g. permissive
 * mode-selector resolvers) through here instead.
 */
export function logFmeDeprecation(message: string): void {
  console.error(message);
}
