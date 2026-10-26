#!/usr/bin/env node

/**
 * Shared pnpm-lock.yaml / npm-shrinkwrap.json version extraction for security pin tests
 * and ip-address lockfile guards.
 */

/** @param {string} text */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collect semver versions from pnpm lock package keys (supports peer suffixes and quoted scoped names).
 * @param {string} lockfileText
 * @param {string} packageName
 * @returns {string[]}
 */
export function parsePnpmLockPackageVersions(lockfileText, packageName) {
  const versions = new Set();

  const unquoted = new RegExp(
    `^\\s+${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(unquoted)) {
    versions.add(match[1]);
  }

  const quotedScoped = new RegExp(
    `^\\s+'${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?'?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(quotedScoped)) {
    versions.add(match[1]);
  }

  return [...versions];
}

/**
 * @param {string} shrinkwrapText
 * @param {string} packageName
 * @returns {string | null}
 */
export function parseNpmShrinkwrapPackageVersion(shrinkwrapText, packageName) {
  const shrinkwrap = JSON.parse(shrinkwrapText);
  const version = shrinkwrap?.packages?.[`node_modules/${packageName}`]?.version
    ?? shrinkwrap?.dependencies?.[packageName]?.version
    ?? shrinkwrap?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}
