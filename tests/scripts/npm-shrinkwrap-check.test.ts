import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const scriptPath = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when npm-shrinkwrap.json matches package.json and pins secure adm-zip", () => {
    const result = spawnSync(process.execPath, [scriptPath, "--check"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
