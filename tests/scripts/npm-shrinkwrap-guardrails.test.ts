import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateNpmShrinkwrapCheck } from "../../scripts/npm-shrinkwrap-check-lib.mjs";

const root = process.cwd();
const script = join(root, "scripts/generate-npm-shrinkwrap.mjs");

describe("generate-npm-shrinkwrap.mjs --check guardrails", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits 0 when committed shrinkwrap matches package.json and adm-zip floor", () => {
    const result = spawnSync(process.execPath, [script, "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stderr).toContain("npm-shrinkwrap.json metadata is up to date");
  });

  it("validateNpmShrinkwrapCheck fails when shrinkwrap is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "shrinkwrap-missing-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "fixture", version: "0.0.0", dependencies: {} }),
    );

    const failure = validateNpmShrinkwrapCheck(dir);
    expect(failure.ok).toBe(false);
    expect(failure.message).toContain("file is missing");
  });

  it("validateNpmShrinkwrapCheck fails when root metadata drifts from package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "shrinkwrap-drift-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "fixture", version: "1.0.0", dependencies: {} }),
    );
    writeFileSync(
      join(dir, "npm-shrinkwrap.json"),
      JSON.stringify({
        name: "fixture",
        lockfileVersion: 3,
        packages: {
          "": { name: "fixture", version: "0.9.0", dependencies: {} },
          "node_modules/adm-zip": { version: "0.6.1" },
        },
      }),
    );

    const failure = validateNpmShrinkwrapCheck(dir);
    expect(failure.ok).toBe(false);
    expect(failure.message).toContain("root metadata does not match");
  });

  it("validateNpmShrinkwrapCheck fails when adm-zip is below the patched floor", () => {
    const dir = mkdtempSync(join(tmpdir(), "shrinkwrap-adm-zip-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "fixture", version: "1.0.0", dependencies: {} }),
    );
    writeFileSync(
      join(dir, "npm-shrinkwrap.json"),
      JSON.stringify({
        name: "fixture",
        lockfileVersion: 3,
        packages: {
          "": { name: "fixture", version: "1.0.0", dependencies: {} },
          "node_modules/adm-zip": { version: "0.5.18" },
        },
      }),
    );

    const failure = validateNpmShrinkwrapCheck(dir);
    expect(failure.ok).toBe(false);
    expect(failure.message).toContain("node_modules/adm-zip@0.5.18");
  });
});
