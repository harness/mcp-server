#!/usr/bin/env node

/**
 * Shared helpers for npm-shrinkwrap generation.
 * pnpm.overrides is the source of truth for security pins; npm ignores it, so
 * mirror transitive-only entries into npm's native `overrides` field.
 */

/**
 * @param {{ dependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; pnpm?: { overrides?: Record<string, string> } }} pkg
 * @returns {Record<string, string>}
 */
export function computeTransitiveOverrides(pkg) {
  const directDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);

  return Object.fromEntries(
    Object.entries(pkg.pnpm?.overrides ?? {}).filter(([name]) => !directDeps.has(name)),
  );
}

/**
 * Parse a minimum version from pnpm override ranges like ">=0.35.0" or "^7.3.5".
 * @param {string} range
 * @returns {string | null}
 */
export function parseMinimumOverrideVersion(range) {
  const match = range.match(/(\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}

/**
 * @param {string} version
 * @param {string} minimum
 * @returns {boolean}
 */
export function isAtLeastVersion(version, minimum) {
  const parse = (value) =>
    value
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10));

  const parts = parse(version);
  const minParts = parse(minimum);
  if (parts.some(Number.isNaN) || minParts.some(Number.isNaN)) {
    return false;
  }

  for (let i = 0; i < 3; i++) {
    if (parts[i] > minParts[i]) return true;
    if (parts[i] < minParts[i]) return false;
  }
  return true;
}
