#!/usr/bin/env node

/**
 * Generate npm-shrinkwrap.json for npm consumers (harness-ai-agent global install).
 *
 * pnpm-lock.yaml remains the source of truth for repo development; this shrinkwrap
 * documents the npm production tree after the adm-zip postinstall policy is applied.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureSecureAdmZip } from "./adm-zip-security-lib.mjs";

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
const stagingRoot = join(repoRoot, ".npm-shrinkwrap-staging");

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(stagingRoot, { recursive: true });

const stagingManifest = {
  name: pkg.name,
  version: pkg.version,
  private: true,
  dependencies: pkg.dependencies,
  optionalDependencies: pkg.optionalDependencies,
};

writeFileSync(join(stagingRoot, "package.json"), `${JSON.stringify(stagingManifest, null, 2)}\n`);

run("npm", ["install", "--omit=dev"], stagingRoot);
ensureSecureAdmZip(stagingRoot);
run("npm", ["install", "--package-lock-only", "--omit=dev"], stagingRoot);
run("npm", ["shrinkwrap"], stagingRoot);

const generated = join(stagingRoot, "npm-shrinkwrap.json");
if (!existsSync(generated)) {
  console.error("npm-shrinkwrap.json was not generated");
  process.exit(1);
}

if (checkMode) {
  if (!existsSync(shrinkwrapPath)) {
    console.error("Missing committed npm-shrinkwrap.json — run: node scripts/generate-npm-shrinkwrap.mjs");
    process.exit(1);
  }
  const expected = readFileSync(shrinkwrapPath, "utf8");
  const actual = readFileSync(generated, "utf8");
  if (expected !== actual) {
    console.error("npm-shrinkwrap.json is out of date — run: node scripts/generate-npm-shrinkwrap.mjs");
    process.exit(1);
  }
  console.error("npm-shrinkwrap.json is up to date");
  process.exit(0);
}

copyFileSync(generated, shrinkwrapPath);
console.error(`Wrote ${shrinkwrapPath}`);
