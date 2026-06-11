import type { Config } from "../config.js";

/**
 * Whether the config has the required org/project values for
 * resource discovery at the given scope level.
 * Returns false when a scope param is missing or whitespace-only,
 * preventing wasted API calls that would fail with "must not be null".
 */
export function hasRequiredDiscoveryScope(
  scope: "account" | "org" | "project",
  config: Config,
): boolean {
  if (scope === "account") return true;

  const orgId = config.HARNESS_ORG?.trim();
  if (!orgId) return false;

  if (scope === "org") return true;

  return Boolean(config.HARNESS_PROJECT?.trim());
}
