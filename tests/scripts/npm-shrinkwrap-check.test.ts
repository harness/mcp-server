import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("is wired from package.json scripts for CI and prepublish", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["npm-shrinkwrap:generate"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs",
    );
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("npm-shrinkwrap:check");
  });

  it("passes when committed npm-shrinkwrap.json matches package.json and adm-zip pins", () => {
    const result = spawnSync("pnpm", ["npm-shrinkwrap:check"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
