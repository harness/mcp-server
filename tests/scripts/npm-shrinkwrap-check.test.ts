import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap check mode — global npm install guardrail", () => {
  it("wires shrinkwrap validation into prepublishOnly before publish", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.scripts?.["npm-shrinkwrap:check"]).toBe(
      "node scripts/generate-npm-shrinkwrap.mjs --check",
    );
    expect(packageJson.scripts?.prepublishOnly).toContain("npm-shrinkwrap:check");
    expect(packageJson.files).toEqual(expect.arrayContaining(["npm-shrinkwrap.json"]));
  });

  it("passes --check against the committed npm-shrinkwrap.json", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stderr ?? "").toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
