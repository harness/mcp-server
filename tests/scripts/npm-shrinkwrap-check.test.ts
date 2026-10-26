import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm-shrinkwrap check script (global npm install guardrail)", () => {
  it("wires generate-npm-shrinkwrap.mjs --check in package scripts and prepublishOnly", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts["npm-shrinkwrap:generate"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
  });

  it("runs npm-shrinkwrap:check in CI before the full vitest suite", () => {
    const ciWorkflow = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
    const testIndex = ciWorkflow.indexOf("pnpm test");
    const shrinkwrapIndex = ciWorkflow.indexOf("pnpm npm-shrinkwrap:check");
    expect(shrinkwrapIndex, "CI must run pnpm npm-shrinkwrap:check").toBeGreaterThan(-1);
    expect(testIndex, "CI must run pnpm test").toBeGreaterThan(-1);
    expect(shrinkwrapIndex).toBeLessThan(testIndex);
  });

  it("passes --check against the committed npm-shrinkwrap.json", () => {
    const result = spawnSync("node", ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
