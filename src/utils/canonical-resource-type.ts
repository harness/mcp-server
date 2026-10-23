import type { Registry } from "../registry/index.js";

/**
 * Rewrite near-miss resource types in tool args to the registry's canonical name, so handlers
 * (which compare against exact names such as "pipeline") never see an alias.
 */
export function canonicalizeResourceTypes<T>(registry: Registry, args: T): T {
  if (!args || typeof args !== "object") return args;
  const out = { ...(args as Record<string, unknown>) };
  if (typeof out.resource_type === "string") out.resource_type = registry.canonicalResourceType(out.resource_type);
  if (Array.isArray(out.resource_types)) {
    out.resource_types = out.resource_types.map((t) => (typeof t === "string" ? registry.canonicalResourceType(t) : t));
  }
  return out as T;
}
