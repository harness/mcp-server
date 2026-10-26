import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const shrinkwrapCheckScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when checked-in shrinkwrap matches package.json and adm-zip pins", () => {
    const { status, stderr } = spawnSync(process.execPath, [shrinkwrapCheckScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(status).toBe(0);
    expect(stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });

  it("is wired into prepublishOnly so npm publishes cannot ship stale metadata", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { prepublishOnly?: string; "npm-shrinkwrap:check"?: string };
    };
    expect(packageJson.scripts["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts.prepublishOnly).toContain("pnpm npm-shrinkwrap:check");
  });
});
