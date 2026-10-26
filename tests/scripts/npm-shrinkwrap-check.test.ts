/**
 * CI guard for npm-shrinkwrap.json metadata and adm-zip resolution (--check mode).
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shrinkwrapScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap --check", () => {
  it("passes when shrinkwrap metadata and adm-zip pins match package.json", () => {
    const result = spawnSync(process.execPath, [shrinkwrapScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/npm-shrinkwrap\.json metadata is up to date/);
  });
});
