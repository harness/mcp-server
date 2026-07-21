#!/usr/bin/env node

/**
 * Postinstall security patch for npm consumers.
 *
 * pnpm.overrides already pins adm-zip for pnpm installs, but `npm install -g`
 * ignores pnpm overrides and npm-shrinkwrap does not reliably override nested
 * optional adm-zip under onnxruntime-node. Upgrade in-place on install.
 *
 * Requires install scripts to run — `npm install --ignore-scripts` skips this
 * patch and leaves nested adm-zip vulnerable to CVE-2026-39244.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ensureSecureAdmZip, ADM_ZIP_CVE } from "./adm-zip-security-lib.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH === "1") {
  process.exit(0);
}

const { patched, skipped, warnings } = ensureSecureAdmZip(packageRoot);

if (!skipped && patched.length > 0) {
  console.error(
    `[harness-mcp-v2] upgraded adm-zip to fix ${ADM_ZIP_CVE} (${patched.length} prefix(es))`,
  );
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.error(`[harness-mcp-v2] adm-zip patch warning: ${warning}`);
  }
  console.error(
    "[harness-mcp-v2] install completed but adm-zip may remain vulnerable — " +
      "ensure npm is available, retry without --ignore-scripts, or set " +
      "HARNESS_MCP_SKIP_ADM_ZIP_PATCH=1 to silence",
  );
}
