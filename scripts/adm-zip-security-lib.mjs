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
  return JSON.parse(readFileSync(pkgPath, "utf8")).version;
}

/** @returns {boolean} */
export function isSecureAdmZipVersion(version, target = SECURE_ADM_ZIP_VERSION) {
  if (!version) {
    return true;
  }
  const [major, minor] = version.split(".").map(Number);
  const [targetMajor, targetMinor] = target.split(".").map(Number);
  return major > targetMajor || (major === targetMajor && minor >= targetMinor);
}

/**
 * Find every adm-zip install directory under node_modules.
 * @param {string} packageRoot
 * @returns {string[]}
 */
export function findAdmZipInstallDirs(packageRoot) {
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
      if (entry.name === "adm-zip" && existsSync(join(child, "package.json"))) {
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
 * Find onnxruntime-node package dirs (nested adm-zip lives here for npm installs).
 * @param {string} packageRoot
 * @returns {string[]}
 */
export function findOnnxRuntimeNodeDirs(packageRoot) {
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
      if (entry.name === "onnxruntime-node" && existsSync(join(child, "package.json"))) {
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
 * @param {string} packageRoot
 * @param {{ npmCommand?: string, target?: string, dryRun?: boolean }} [options]
 * @returns {{ patched: string[], skipped: boolean }}
 */
export function ensureSecureAdmZip(
  packageRoot,
  { npmCommand = "npm", target = SECURE_ADM_ZIP_VERSION, dryRun = false } = {},
) {
  const insecure = listInsecureAdmZipInstalls(packageRoot, target);
  if (insecure.length === 0) {
    return { patched: [], skipped: true };
  }

  /** @type {string[]} */
  const patched = [];

  const runNpmInstall = (prefix) => {
    if (dryRun) {
      patched.push(prefix);
      return;
    }
    const result = spawnSync(
      npmCommand,
      [
        "install",
        "--prefix",
        prefix,
        "--omit=dev",
        "--package-lock=false",
        `adm-zip@${target}`,
      ],
      { stdio: "ignore", env: process.env },
    );
    if (result.status !== 0) {
      throw new Error(`failed to upgrade adm-zip under ${prefix}`);
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
  if (remaining.length > 0) {
    const details = remaining
      .map(({ dir, version }) => `${dir}@${version ?? "missing"}`)
      .join(", ");
    throw new Error(`insecure adm-zip remains after patch (${ADM_ZIP_CVE}): ${details}`);
  }

  return { patched, skipped: false };
}
