/**
 * CI runs `pnpm npm-shrinkwrap:check` before the full vitest suite. Mirror that
 * gate in standards:check so local runs catch stale shrinkwrap before push.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CHECK_SCRIPT = join(REPO_ROOT, "scripts/generate-npm-shrinkwrap.mjs");

describe("Coding standards — npm-shrinkwrap CI gate", () => {
  it("keeps npm-shrinkwrap.json in sync with package.json and secure adm-zip pins", () => {
    const result = spawnSync(process.execPath, [CHECK_SCRIPT, "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: process.env,
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status, output || "npm-shrinkwrap --check failed").toBe(0);
  });
});
