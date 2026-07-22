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
import {
  ensureSecureAdmZip,
  validateNpmShrinkwrapMetadata,
} from "./adm-zip-security-lib.mjs";

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

function failCheck(message) {
  console.error(`npm-shrinkwrap.json is out of date: ${message}`);
  process.exit(1);
}

if (checkMode) {
  if (!existsSync(shrinkwrapPath)) {
    failCheck("file is missing — run: node scripts/generate-npm-shrinkwrap.mjs");
  }

  const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8"));
  const validationError = validateNpmShrinkwrapMetadata(shrinkwrap, pkg);
  if (validationError) {
    failCheck(validationError);
  }

  console.error("npm-shrinkwrap.json metadata is up to date");
  process.exit(0);
}

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
