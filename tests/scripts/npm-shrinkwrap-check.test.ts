/**
 * Guards npm-shrinkwrap.json drift without running a full shrinkwrap regeneration.
 * Mirrors CI (`pnpm npm-shrinkwrap:check`) and prepublishOnly.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CHECK_SCRIPT = join(REPO_ROOT, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when shrinkwrap metadata and adm-zip pins match package.json", () => {
    const result = spawnSync(process.execPath, [CHECK_SCRIPT, "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const stderr = [result.stderr, result.stdout].filter(Boolean).join("\n");
    expect(result.status, stderr || "check script failed").toBe(0);
    expect(stderr).toMatch(/npm-shrinkwrap\.json metadata is up to date/);
  });
});
