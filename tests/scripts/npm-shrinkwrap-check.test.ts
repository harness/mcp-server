/**
 * CI runs `pnpm npm-shrinkwrap:check` before publish; this keeps the guard in the
 * vitest suite so shrinkwrap drift fails `pnpm test` locally as well.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const checkScript = join(repoRoot, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when npm-shrinkwrap.json metadata and adm-zip pins match package.json", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const output = [result.stderr, result.stdout].filter(Boolean).join("\n");
    expect(result.status, output || "check script failed with no output").toBe(0);
  });
});
