import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("exposes npm-shrinkwrap:check wired to the generator script", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts["npm-shrinkwrap:generate"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs",
    );
  });

  it("passes when committed npm-shrinkwrap.json matches package.json and adm-zip floors", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
