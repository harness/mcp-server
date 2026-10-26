import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("npm-shrinkwrap.json CI check", () => {
  it("passes generate-npm-shrinkwrap.mjs --check (metadata + secure adm-zip pins)", () => {
    const result = spawnSync("node", ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });

    expect(
      result.status,
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    ).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
