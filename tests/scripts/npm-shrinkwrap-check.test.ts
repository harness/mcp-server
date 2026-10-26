import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(repoRoot, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when committed npm-shrinkwrap.json matches package.json and secure adm-zip pins", () => {
    const result = spawnSync(process.execPath, [scriptPath, "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
