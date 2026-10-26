/**
 * Guards prepublishOnly / npm-shrinkwrap:check — stale shrinkwrap breaks global npm installs.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../..");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when npm-shrinkwrap.json matches package.json and secure adm-zip pins", () => {
    const result = spawnSync("node", ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status, output || "npm-shrinkwrap --check failed with no output").toBe(0);
    expect(output).toMatch(/up to date/i);
  });
});
