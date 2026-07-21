#!/usr/bin/env node

/**
 * CI helper: simulate an npm consumer install and assert adm-zip is secure.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  ADM_ZIP_CVE,
  listInsecureAdmZipInstalls,
  SECURE_ADM_ZIP_VERSION,
} from "./adm-zip-security-lib.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} cmd @param {string[]} args @param {string} [cwd] */
function run(cmd, args, cwd = repoRoot) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

run("pnpm", ["build"]);

const packResult = spawnSync("npm", ["pack", "--silent"], {
  cwd: repoRoot,
  encoding: "utf8",
  env: process.env,
});
if (packResult.status !== 0) {
  process.exit(packResult.status ?? 1);
}

const tgz = packResult.stdout.trim().split("\n").at(-1)?.trim();
if (!tgz) {
  console.error("npm pack did not produce a tarball name");
  process.exit(1);
}

const consumerRoot = mkdtempSync(join(tmpdir(), "harness-mcp-npm-consumer-"));
try {
  run("npm", ["init", "-y"], consumerRoot);
  run("npm", ["install", "--omit=dev", join(repoRoot, tgz)], consumerRoot);

  const packageRoot = join(consumerRoot, "node_modules", "harness-mcp-v2");
  const insecure = listInsecureAdmZipInstalls(packageRoot);
  if (insecure.length > 0) {
    console.error(
      `insecure adm-zip after npm install (${ADM_ZIP_CVE}, expected >= ${SECURE_ADM_ZIP_VERSION}):`,
    );
    for (const { dir, version } of insecure) {
      console.error(`  ${dir} @ ${version ?? "missing"}`);
    }
    process.exit(1);
  }

  console.error("npm consumer install: all adm-zip copies are secure");
} finally {
  rmSync(consumerRoot, { recursive: true, force: true });
  rmSync(join(repoRoot, tgz), { force: true });
}
