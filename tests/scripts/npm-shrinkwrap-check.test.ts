import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../..");
const checkScript = join(repoRoot, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap.json — generate script check mode", () => {
  it("passes when shrinkwrap root metadata and adm-zip floors match package.json", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    });

    expect(
      result.status,
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    ).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
