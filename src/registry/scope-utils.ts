import type { PathBuilderConfig } from "./types.js";

/** Standard scope guidance (matches gitops, connectors, services toolsets). */
export const SCOPE_BEHAVIOR_DOC =
  "SCOPE BEHAVIOR (account ID is always from config):\n" +
  "- Account-level: Do NOT pass org_id or project_id\n" +
  "- Org-level: Pass org_id only (no project_id)\n" +
  "- Project-level: Pass both org_id AND project_id";

/**
 * Build v1 template-service base path from org_id/project_id presence.
 * Registry injects org_id/project_id from config when resource_scope is set before pathBuilder runs.
 */
export function templateV1BasePathFromScope(
  input: Record<string, unknown>,
  _config: PathBuilderConfig,
): string {
  const org = input.org_id as string | undefined;
  const project = input.project_id as string | undefined;

  if (org && project) {
    return `/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/templates`;
  }
  if (org) {
    return `/v1/orgs/${encodeURIComponent(org)}/templates`;
  }
  return "/v1/templates";
}
