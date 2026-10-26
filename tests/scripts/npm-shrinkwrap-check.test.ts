import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const checkScript = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check", () => {
  it("passes when npm-shrinkwrap.json matches package.json and documents secure adm-zip", () => {
    const result = spawnSync(process.execPath, [checkScript, "--check"], {
      cwd: root,
      encoding: "utf8",
    });

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(result.status, output).toBe(0);
    expect(output).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
