import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shrinkwrapCheckScript = join(process.cwd(), "scripts/generate-npm-shrinkwrap.mjs");

describe("npm-shrinkwrap CI gate (--check)", () => {
  it("accepts the committed shrinkwrap metadata and adm-zip pins", () => {
    const result = spawnSync(process.execPath, [shrinkwrapCheckScript, "--check"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });
});
