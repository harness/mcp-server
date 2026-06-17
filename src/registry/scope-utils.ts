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
