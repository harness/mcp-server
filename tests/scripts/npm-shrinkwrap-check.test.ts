import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../..");
const checkScript = join(repoRoot, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap --check", () => {
  it("passes when shrinkwrap metadata matches package.json and adm-zip pins", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
