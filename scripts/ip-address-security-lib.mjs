#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Minimum ip-address release that closes the current classifier advisories:
 * NAT64 local-use (10.5.1), cross-family subnet checks, and unbounded
 * Address6 parse diagnostics (both 10.7.1).
 */
export const SECURE_IP_ADDRESS_VERSION = "10.7.1";

/**
 * Compare semver-like versions (major.minor.patch). Pre-release/build metadata is ignored.
 * @returns {boolean}
 */
export function isSecureIpAddressVersion(version, target = SECURE_IP_ADDRESS_VERSION) {
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

/** @returns {string | null} */
export function readIpAddressVersion(ipAddressDir) {
  const pkgPath = join(ipAddressDir, "package.json");
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
 * pnpm stores packages as node_modules/.pnpm/<name>@<version>/node_modules/<name>.
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
    const installDir = join(pnpmDir, entry.name, "node_modules", packageName);
    if (existsSync(join(installDir, "package.json"))) {
      found.push(installDir);
    }
  }

  return found;
}

/**
 * @param {string} packageRoot
 * @returns {string[]}
 */
export function findIpAddressInstallDirs(packageRoot) {
  const installs = [
    ...findPackageDirs(packageRoot, "ip-address"),
    ...findPnpmPackageDirs(packageRoot, "ip-address"),
  ];
  return [...new Set(installs)];
}

/**
 * @param {string} packageRoot
 * @returns {{ dir: string; version: string | null }[]}
 */
export function listInsecureIpAddressInstalls(packageRoot) {
  return findIpAddressInstallDirs(packageRoot)
    .map((dir) => ({ dir, version: readIpAddressVersion(dir) }))
    .filter(({ version }) => !isSecureIpAddressVersion(version));
}

/**
 * @param {string} lockfileText
 * @returns {string[]}
 */
export function parsePnpmLockIpAddressVersions(lockfileText) {
  const versions = new Set();
  for (const match of lockfileText.matchAll(/^\s+ip-address@([0-9]+\.[0-9]+\.[0-9]+):/gm)) {
    versions.add(match[1]);
  }
  return [...versions];
}

/**
 * @param {string} shrinkwrapText
 * @returns {string | null}
 */
export function parseNpmShrinkwrapIpAddressVersion(shrinkwrapText) {
  const shrinkwrap = JSON.parse(shrinkwrapText);
  const version = shrinkwrap?.packages?.["node_modules/ip-address"]?.version
    ?? shrinkwrap?.dependencies?.["ip-address"]?.version
    ?? shrinkwrap?.["node_modules/ip-address"]?.version;
  return typeof version === "string" ? version : null;
}
