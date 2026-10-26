/**
 * Regression guard for npm-shrinkwrap.json — npm consumers rely on this tree and
 * its mirrored pnpm security overrides. The October 2026 dependency bump refreshed
 * the shrinkwrap; this test runs the same --check mode as prepublishOnly/CI.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap check mode", () => {
  it("passes when committed shrinkwrap matches package.json and adm-zip floors", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status, output || "generate-npm-shrinkwrap --check failed").toBe(0);
    expect(output).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
