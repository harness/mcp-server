import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shrinkwrapScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap check (global npm install tree)", () => {
  it("wires generate/check scripts, ships shrinkwrap, and runs check before publish", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      files: string[];
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["npm-shrinkwrap:generate"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs",
    );
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
    expect(packageJson.files).toEqual(expect.arrayContaining(["npm-shrinkwrap.json"]));
  });

  it("runs in CI before the vitest suite", () => {
    const ciWorkflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    expect(ciWorkflow).toMatch(/pnpm npm-shrinkwrap:check/);
  });

  it("passes --check when shrinkwrap metadata matches package.json and adm-zip is patched", () => {
    const { status, stderr } = spawnSync(process.execPath, [shrinkwrapScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(status).toBe(0);
    expect(stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
