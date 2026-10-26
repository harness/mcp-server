import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when shrinkwrap metadata and adm-zip pins match package.json", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, [result.stdout, result.stderr].filter(Boolean).join("\n")).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
