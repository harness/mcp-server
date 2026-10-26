#!/usr/bin/env node

/**
 * Generate npm-shrinkwrap.json for npm consumers (harness-ai-agent global install).
 *
 * pnpm-lock.yaml remains the source of truth for repo development; this shrinkwrap
 * documents an npm production tree whose overrides resolve every adm-zip copy
 * to the secure release before postinstall fallback logic is needed.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureSecureAdmZip } from "./adm-zip-security-lib.mjs";
import { validateNpmShrinkwrapCheck } from "./npm-shrinkwrap-check-lib.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const shrinkwrapPath = join(repoRoot, "npm-shrinkwrap.json");
const checkMode = process.argv.includes("--check");

/** @param {string} cmd @param {string[]} args @param {string} cwd */
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

if (checkMode) {
  const result = validateNpmShrinkwrapCheck(repoRoot);
  if (!result.ok) {
    console.error(`npm-shrinkwrap.json is out of date: ${result.message}`);
    process.exit(1);
  }

  console.error("npm-shrinkwrap.json metadata is up to date");
  process.exit(0);
}

const stagingRoot = join(repoRoot, ".npm-shrinkwrap-staging");

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });

// pnpm.overrides is the source of truth for security pins. npm ignores it, so
// mirror it into the npm-native `overrides` field (flat "pkg": "range" entries
// are format-compatible) — otherwise transitive pins like sharp (capped by
// @huggingface/transformers) leak vulnerable versions into the shipped tree.
// Direct deps are already pinned in dependencies/optionalDependencies; npm
// rejects (EOVERRIDE) an override that conflicts with a direct dep, so drop
// those keys and keep only the transitive pins.
const directDeps = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);
const transitiveOverrides = Object.fromEntries(
  Object.entries(pkg.pnpm?.overrides ?? {}).filter(([name]) => !directDeps.has(name)),
);

const stagingManifest = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  dependencies: pkg.dependencies,
  optionalDependencies: pkg.optionalDependencies,
  overrides: { ...transitiveOverrides, ...(pkg.overrides ?? {}) },
};

writeFileSync(join(stagingRoot, "package.json"), `${JSON.stringify(stagingManifest, null, 2)}\n`);

run("npm", ["install", "--omit=dev"], stagingRoot);
ensureSecureAdmZip(stagingRoot, { strict: true });
run("npm", ["install", "--package-lock-only", "--omit=dev"], stagingRoot);
run("npm", ["shrinkwrap"], stagingRoot);

const generated = join(stagingRoot, "npm-shrinkwrap.json");
if (!existsSync(generated)) {
  console.error("npm-shrinkwrap.json was not generated");
  process.exit(1);
}

copyFileSync(generated, shrinkwrapPath);
console.error(`Wrote ${shrinkwrapPath}`);
