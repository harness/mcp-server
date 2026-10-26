/**
 * Regression guard: CI runs `pnpm npm-shrinkwrap:check` before publish/MCPB builds.
 * Exercising the same entrypoint in Vitest keeps shrinkwrap drift visible in the main suite.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CHECK_SCRIPT = join(REPO_ROOT, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when npm-shrinkwrap.json matches package.json and adm-zip floors", () => {
    const result = spawnSync(process.execPath, [CHECK_SCRIPT, "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    expect(result.status, [result.stderr, result.stdout].filter(Boolean).join("\n")).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
