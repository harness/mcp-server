/**
 * Regression guard: CI and prepublishOnly run `pnpm npm-shrinkwrap:check`.
 * Vitest invokes the same entrypoint so drift fails in `pnpm test` / standards runs.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("accepts the committed shrinkwrap (metadata, deps, secure adm-zip)", () => {
    const result = spawnSync("node", ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/npm-shrinkwrap\.json metadata is up to date/);
  });
});
