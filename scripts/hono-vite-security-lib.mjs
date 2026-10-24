#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimum Hono release addressing Dependabot alerts #98–#99 (path / middleware issues). */
export const SECURE_HONO_VERSION = "4.13.11";

/** Minimum Vite release addressing Dependabot alerts #100–#101 (dev-server issues). */
export const SECURE_VITE_VERSION = "7.3.7";

/**
 * Compare semver-like versions (major.minor.patch). Pre-release/build metadata is ignored.
 * @returns {boolean}
 */
export function isAtLeastSemverVersion(version, minimum) {
  if (!version) {
    return false;
  }

  const parse = (value) =>
    value
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10));

  const parts = parse(version);
  const minimumParts = parse(minimum);
  if (parts.some(Number.isNaN) || minimumParts.some(Number.isNaN)) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    const current = parts[index] ?? 0;
    const floor = minimumParts[index] ?? 0;
    if (current > floor) {
      return true;
    }
    if (current < floor) {
      return false;
    }
  }

  return true;
}

/** @returns {string | null} */
export function readPackageVersion(packageDir) {
  const pkgPath = join(packageDir, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }
  const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  return typeof version === "string" && version.length > 0 ? version : null;
}

/**
 * @param {string} packageRoot
 * @param {string} packageName
 * @returns {string[]}
 */
function findPackageDirs(packageRoot, packageName) {
  const nodeModules = join(packageRoot, "node_modules");
  if (!existsSync(nodeModules)) {
    return [];
  }

  /** @type {string[]} */
  const found = [];

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".bin") {
        continue;
      }
      const child = join(dir, entry.name);
      if (entry.name === packageName) {
        found.push(child);
        continue;
      }
      if (entry.name.startsWith("@") || entry.name === ".pnpm") {
        walk(child);
      }
    }
  }

  walk(nodeModules);
  return found;
}

/**
 * @param {string} lockfileText
 * @param {string} packageName
 * @returns {string[]}
 */
export function parsePnpmLockPackageVersions(lockfileText, packageName) {
  const pattern = new RegExp(`^\\s+${packageName.replace("/", "\\/")}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
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
  const version =
    shrinkwrap?.packages?.[key]?.version ??
    shrinkwrap?.dependencies?.[packageName]?.version ??
    shrinkwrap?.[key]?.version;
  return typeof version === "string" ? version : null;
}

/**
 * @param {string} packageRoot
 * @param {string} packageName
 * @param {string} minimumVersion
 * @returns {{ dir: string; version: string | null }[]}
 */
export function listSubMinimumPackageInstalls(packageRoot, packageName, minimumVersion) {
  return findPackageDirs(packageRoot, packageName)
    .map((dir) => ({ dir, version: readPackageVersion(dir) }))
    .filter(({ version }) => !isAtLeastSemverVersion(version, minimumVersion));
}
