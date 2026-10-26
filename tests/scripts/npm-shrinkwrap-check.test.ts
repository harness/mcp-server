import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap CI guard", () => {
  it("keeps prepublishOnly and GitHub Actions wired to npm-shrinkwrap:check", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { prepublishOnly?: string; "npm-shrinkwrap:check"?: string };
    };
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");

    const ciWorkflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ciWorkflow).toContain("pnpm npm-shrinkwrap:check");
  });

  it("passes when committed npm-shrinkwrap.json matches package.json and secure adm-zip pins", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, [result.stdout, result.stderr].filter(Boolean).join("\n")).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
