import type { PathBuilderConfig } from "./types.js";

/** Standard scope guidance (matches gitops, connectors, services toolsets). */
export const SCOPE_BEHAVIOR_DOC =
  "SCOPE BEHAVIOR (account ID is always from config):\n" +
  "- Account-level: Do NOT pass org_id or project_id\n" +
  "- Org-level: Pass org_id only (no project_id)\n" +
  "- Project-level: Pass both org_id AND project_id";

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function requireScopeValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required for template_v1 ${name === "org_id" ? "org" : "project"} scope`);
  }
  return value;
}

/**
 * Build v1 template-service base path. Explicit resource_scope wins over
 * incidental org/project IDs that may have been parsed from a pasted URL.
 */
export function templateV1BasePathFromScope(
  input: Record<string, unknown>,
  config: PathBuilderConfig,
): string {
  const requestedScope = optionalString(input.resource_scope);
  const org = optionalString(input.org_id);
  const project = optionalString(input.project_id);

  if (requestedScope === "account") {
    return "/v1/templates";
  }
  if (requestedScope === "org") {
    const scopedOrg = requireScopeValue("org_id", org ?? config.HARNESS_ORG);
    return `/v1/orgs/${encodeURIComponent(scopedOrg)}/templates`;
  }
  if (requestedScope === "project") {
    const scopedOrg = requireScopeValue("org_id", org ?? config.HARNESS_ORG);
    const scopedProject = requireScopeValue("project_id", project ?? config.HARNESS_PROJECT);
    return `/v1/orgs/${encodeURIComponent(scopedOrg)}/projects/${encodeURIComponent(scopedProject)}/templates`;
  }

  if (org && project) {
    return `/v1/orgs/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/templates`;
  }
  if (org) {
    return `/v1/orgs/${encodeURIComponent(org)}/templates`;
  }
  return "/v1/templates";
}
