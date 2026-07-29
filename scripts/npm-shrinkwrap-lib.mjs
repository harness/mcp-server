/**
 * Shared helpers for npm-shrinkwrap generation.
 * pnpm.overrides is the source of truth for security pins; npm ignores it.
 */

/**
 * Mirror pnpm.overrides into npm's native `overrides` field for shrinkwrap staging.
 * Direct deps are already pinned in dependencies/optionalDependencies; npm rejects
 * (EOVERRIDE) an override that conflicts with a direct dep, so drop those keys.
 *
 * @param {Record<string, string>} pnpmOverrides
 * @param {Record<string, string>} [dependencies]
 * @param {Record<string, string>} [optionalDependencies]
 * @returns {Record<string, string>}
 */
export function computeTransitiveOverrides(
  pnpmOverrides = {},
  dependencies = {},
  optionalDependencies = {},
) {
  const directDeps = new Set([
    ...Object.keys(dependencies),
    ...Object.keys(optionalDependencies),
  ]);

  return Object.fromEntries(
    Object.entries(pnpmOverrides).filter(([name]) => !directDeps.has(name)),
  );
}
