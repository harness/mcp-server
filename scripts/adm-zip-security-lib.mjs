#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const SECURE_ADM_ZIP_VERSION = "0.6.0";
export const ADM_ZIP_CVE = "CVE-2026-39244";

/** @returns {string | null} */
export function readAdmZipVersion(admZipDir) {
  const pkgPath = join(admZipDir, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }
  const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  return typeof version === "string" && version.length > 0 ? version : null;
}

/**
 * Compare semver-like versions (major.minor.patch). Pre-release/build metadata is ignored.
 * @returns {boolean}
 */
export function isSecureAdmZipVersion(version, target = SECURE_ADM_ZIP_VERSION) {
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
 * Find every adm-zip install directory under node_modules.
 * @param {string} packageRoot
 * @returns {string[]}
 */
export function findAdmZipInstallDirs(packageRoot) {
  return findPackageDirs(packageRoot, "adm-zip");
}

/**
 * Find onnxruntime-node package dirs (nested adm-zip lives here for npm installs).
 * @param {string} packageRoot
 * @returns {string[]}
 */
export function findOnnxRuntimeNodeDirs(packageRoot) {
  return findPackageDirs(packageRoot, "onnxruntime-node");
}

/**
 * @param {string} packageRoot
 * @returns {{ dir: string, version: string | null }[]}
 */
export function listInsecureAdmZipInstalls(
  packageRoot,
  target = SECURE_ADM_ZIP_VERSION,
) {
  return findAdmZipInstallDirs(packageRoot)
    .map((dir) => ({ dir, version: readAdmZipVersion(dir) }))
    .filter(({ version }) => !isSecureAdmZipVersion(version, target));
}

/**
 * Upgrade adm-zip under packageRoot for npm consumers.
 * pnpm installs with pnpm.overrides should no-op when already secure.
 *
 * Nested adm-zip under onnxruntime-node is only upgraded when this runs (postinstall).
 * Consumers using `npm install --ignore-scripts` skip postinstall and remain exposed.
 *
 * @param {string} packageRoot
 * @param {{ npmCommand?: string, target?: string, dryRun?: boolean, strict?: boolean }} [options]
 * @returns {{ patched: string[], skipped: boolean, warnings: string[] }}
 */
export function ensureSecureAdmZip(
  packageRoot,
  {
    npmCommand = "npm",
    target = SECURE_ADM_ZIP_VERSION,
    dryRun = false,
    strict = false,
  } = {},
) {
  const insecure = listInsecureAdmZipInstalls(packageRoot, target);
  if (insecure.length === 0) {
    return { patched: [], skipped: true, warnings: [] };
  }

  /** @type {string[]} */
  const patched = [];
  /** @type {string[]} */
  const warnings = [];

  const warnOrThrow = (message) => {
    if (strict) {
      throw new Error(message);
    }
    warnings.push(message);
  };

  const runNpmInstall = (prefix) => {
    if (dryRun) {
      patched.push(prefix);
      return;
    }
    const result = spawnSync(
      npmCommand,
      [
        "install",
        "--global=false",
        "--prefix",
        prefix,
        "--omit=dev",
        "--package-lock=false",
        `adm-zip@${target}`,
      ],
      { stdio: "ignore", env: process.env },
    );
    if (result.error) {
      warnOrThrow(
        `failed to upgrade adm-zip under ${prefix}: ${result.error.message}`,
      );
      return;
    }
    if (result.status !== 0) {
      warnOrThrow(`failed to upgrade adm-zip under ${prefix}: npm exited ${result.status}`);
      return;
    }
    patched.push(prefix);
  };

  const hoisted = join(packageRoot, "node_modules", "adm-zip");
  if (!isSecureAdmZipVersion(readAdmZipVersion(hoisted), target)) {
    runNpmInstall(packageRoot);
  }

  for (const ortDir of findOnnxRuntimeNodeDirs(packageRoot)) {
    const nested = join(ortDir, "node_modules", "adm-zip");
    if (!isSecureAdmZipVersion(readAdmZipVersion(nested), target)) {
      runNpmInstall(ortDir);
    }
  }

  const remaining = listInsecureAdmZipInstalls(packageRoot, target);
  if (!dryRun && remaining.length > 0) {
    const details = remaining
      .map(({ dir, version }) => `${dir}@${version ?? "missing"}`)
      .join(", ");
    warnOrThrow(`insecure adm-zip remains after patch (${ADM_ZIP_CVE}): ${details}`);
  }

  return { patched, skipped: false, warnings };
}
