#!/usr/bin/env node

/**
 * Postinstall security patch for npm consumers.
 *
 * pnpm.overrides already pins adm-zip for pnpm installs, but `npm install -g`
 * ignores pnpm overrides and npm-shrinkwrap does not reliably override nested
 * optional adm-zip under onnxruntime-node. Upgrade in-place on install.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ensureSecureAdmZip, ADM_ZIP_CVE } from "./adm-zip-security-lib.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH === "1") {
  process.exit(0);
}

try {
  const { patched, skipped } = ensureSecureAdmZip(packageRoot);
  if (!skipped) {
    console.error(
      `[harness-mcp-v2] upgraded adm-zip to fix ${ADM_ZIP_CVE} (${patched.length} prefix(es))`,
    );
  }
} catch (error) {
  console.error(
    `[harness-mcp-v2] adm-zip security patch failed: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(1);
}
