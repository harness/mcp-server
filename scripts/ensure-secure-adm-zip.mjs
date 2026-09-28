#!/usr/bin/env node

/**
 * Postinstall security patch for npm consumers.
 *
 * pnpm.overrides pins adm-zip for pnpm installs, while the npm-native parent
 * override and shrinkwrap pin the optional onnxruntime-node copy. Verify and
 * repair any insecure copy left by an installer that discards that metadata.
 *
 * `npm install --ignore-scripts` skips this fallback, so the packaged overrides
 * and shrinkwrap must remain independently secure.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ensureSecureAdmZip, ADM_ZIP_ADVISORIES } from "./adm-zip-security-lib.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.HARNESS_MCP_SKIP_ADM_ZIP_PATCH === "1") {
  process.exit(0);
}

const { patched, skipped, warnings } = ensureSecureAdmZip(packageRoot);

if (!skipped && patched.length > 0) {
  console.error(
    `[harness-mcp-v2] upgraded adm-zip to fix ${ADM_ZIP_ADVISORIES} (${patched.length} prefix(es))`,
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
