import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap check (CI parity)", () => {
  it("exposes the same entrypoint as pnpm npm-shrinkwrap:check", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
  });

  it("passes when committed shrinkwrap matches package.json and adm-zip floors", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status, output || "generate-npm-shrinkwrap --check failed").toBe(0);
    expect(output).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
