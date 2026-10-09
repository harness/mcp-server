#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimum fast-uri release for GHSA advisories addressed in #1063. */
export const SECURE_FAST_URI_VERSION = "4.1.5";

/** Minimum source-map-js release for GHSA advisories addressed in #1063. */
export const SECURE_SOURCE_MAP_JS_VERSION = "1.2.2";

/** Minimum @huggingface/transformers release that drops vulnerable sprintf-js (via global-agent). */
export const SECURE_TRANSFORMERS_VERSION = "4.3.0";

/** Minimum proxy-addr release for CVE-2026-90711 (added in revert #1061). */
export const SECURE_PROXY_ADDR_VERSION = "2.0.8";

/**
 * Compare semver-like versions (major.minor.patch). Pre-release/build metadata is ignored.
 * @returns {boolean}
 */
export function isAtLeastSemver(version, target) {
  if (!version || !target) {
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
  const pattern = new RegExp(
    `^\\s+(?:['"])?${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)`,
    "gm",
  );
  const versions = new Set();
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

/**
 * @param {string} lockfileText
 * @param {string} packageName
 * @returns {boolean}
 */
export function pnpmLockContainsPackage(lockfileText, packageName) {
  const escaped = packageName.replace("/", "\\/");
  const pattern = new RegExp(`^\\s+(?:['"])?${escaped}@`, "m");
  return pattern.test(lockfileText);
}

/** @returns {string | null} */
function readPackageVersion(packageDir) {
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
      if (entry.name === packageName && existsSync(join(child, "package.json"))) {
        found.push(child);
        continue;
      }
      if (entry.name.startsWith("@") || !entry.name.startsWith(".")) {
        walk(child);
      }
    }
  }

  walk(nodeModules);
  return found;
}

/**
 * @param {string} packageRoot
 * @param {string} packageName
 * @returns {string[]}
 */
function findPnpmPackageDirs(packageRoot, packageName) {
  const pnpmDir = join(packageRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) {
    return [];
  }

  const prefix = `${packageName}@`;
  /** @type {string[]} */
  const found = [];

  let entries;
  try {
    entries = readdirSync(pnpmDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) {
      continue;
    }
    const installDir = join(pnpmDir, entry.name, "node_modules", ...packageName.split("/"));
    if (existsSync(join(installDir, "package.json"))) {
      found.push(installDir);
    }
  }

  return found;
}

/**
 * @param {string} packageRoot
 * @param {string} packageName
 * @returns {string[]}
 */
export function findInstalledPackageDirs(packageRoot, packageName) {
  const installs = [
    ...findPackageDirs(packageRoot, packageName),
    ...findPnpmPackageDirs(packageRoot, packageName),
  ];
  return [...new Set(installs)];
}

/**
 * @param {string} packageRoot
 * @param {string} packageName
 * @param {string} minimumVersion
 * @returns {{ dir: string; version: string | null }[]}
 */
export function listInstallsBelowVersion(packageRoot, packageName, minimumVersion) {
  return findInstalledPackageDirs(packageRoot, packageName)
    .map((dir) => ({ dir, version: readPackageVersion(dir) }))
    .filter(({ version }) => !isAtLeastSemver(version, minimumVersion));
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
