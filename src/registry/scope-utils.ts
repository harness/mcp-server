import type { PathBuilderConfig, ResourceScope } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("scope-utils");

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
    log.warn("FME workspace_id is deprecated — pass org_id+project_id instead", {
      resourceType,
    });
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
 * Mode selector for FME operations that have no Harness-native implementation yet
 * and therefore cannot use `resolveFmeDualMode`. Returns true when the caller
 * selected the Harness-native contract (org_id+project_id), false for the legacy
 * contract. A partial pair is rejected: half a scope would otherwise leak a stray
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
 * Guards Harness-native-only resources (e.g. fme_segment) that have no legacy
 * Split.io fallback. Unlike `resolveFmeDualMode`, missing org_id/project_id here
 * must throw rather than silently falling back to config.HARNESS_ORG/HARNESS_PROJECT —
 * a stray global default must never leak into an FME-adjacent call.
 */
export function requireHarnessNativeSegmentScope(input: Record<string, unknown>, resourceType: string): void {
  if (!input.org_id || !input.project_id) {
    throw new Error(`${resourceType}: org_id and project_id are required (account is taken from config).`);
  }
}

/**
 * Route deprecation logging that doesn't go through `resolveFmeDualMode`
 * (e.g. permissive mode-selector resolvers). Toolset files must not call
 * `console.*` or `createLogger` directly — use this helper instead.
 */
export function logFmeDeprecation(message: string, data?: Record<string, unknown>): void {
  log.warn(message, data);
}
