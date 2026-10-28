#!/usr/bin/env node

/** Minimum Hono release addressing recent HTTP stack advisories (GHSA family). */
export const SECURE_HONO_VERSION = "4.13.11";

/** Minimum Vite release for the patched 7.3.x line used by Vitest. */
export const SECURE_VITE_VERSION = "7.3.7";

/** Minimum @hono/node-server release paired with secure Hono. */
export const SECURE_HONO_NODE_SERVER_VERSION = "2.0.10";

/**
 * Compare semver-like versions (major.minor.patch). Pre-release/build metadata is ignored.
 * @returns {boolean}
 */
export function isAtLeastSemverVersion(version, target) {
  if (!version) {
    return false;
  }

  const parse = (value) =>
    value
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10));

  const parts = parse(version);
  const targetParts = parse(target);
  if (parts.some(Number.isNaN) || targetParts.some(Number.isNaN)) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    const current = parts[index] ?? 0;
    const minimum = targetParts[index] ?? 0;
    if (current > minimum) {
      return true;
    }
    if (current < minimum) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string} lockfileText
 * @param {string} packageName
 * @returns {string[]}
 */
export function parsePnpmLockPackageVersions(lockfileText, packageName) {
  const escaped = packageName.replace("/", "\\/");
  const pattern = new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  const versions = new Set();
  for (const match of lockfileText.matchAll(pattern)) {
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
  const key = `node_modules/${packageName}`;
  const version = shrinkwrap?.packages?.[key]?.version;
  return typeof version === "string" ? version : null;
}

/**
 * @param {Record<string, unknown>} packageJson
 * @returns {{ honoOverride: string; viteOverride: string; honoNodeServerOverride: string }}
 */
export function readPnpmOverrideFloors(packageJson) {
  const overrides = packageJson?.pnpm?.overrides ?? {};
  return {
    honoOverride: typeof overrides.hono === "string" ? overrides.hono : "",
    viteOverride: typeof overrides.vite === "string" ? overrides.vite : "",
    honoNodeServerOverride:
      typeof overrides["@hono/node-server"] === "string" ? overrides["@hono/node-server"] : "",
  };
}
