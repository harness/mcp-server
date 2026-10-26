/**
 * Failure paths for generate-npm-shrinkwrap.mjs --check (CI + prepublishOnly gate).
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");
function runCheck(cwd: string): { status: number | null; output: string } {
  const generator = join(cwd, "scripts/generate-npm-shrinkwrap.mjs");
  const result = spawnSync(process.execPath, [generator, "--check"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const output = [result.stderr, result.stdout].filter(Boolean).join("\n");
  return { status: result.status, output };
}

function stageMinimalRepo(root: string): void {
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(join(REPO_ROOT, "package.json"), join(root, "package.json"));
  copyFileSync(join(REPO_ROOT, "npm-shrinkwrap.json"), join(root, "npm-shrinkwrap.json"));
  copyFileSync(
    join(REPO_ROOT, "scripts/generate-npm-shrinkwrap.mjs"),
    join(root, "scripts/generate-npm-shrinkwrap.mjs"),
  );
  copyFileSync(
    join(REPO_ROOT, "scripts/adm-zip-security-lib.mjs"),
    join(root, "scripts/adm-zip-security-lib.mjs"),
  );
}

describe("generate-npm-shrinkwrap.mjs --check failures", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when shrinkwrap root metadata drifts from package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "shrinkwrap-check-"));
    tempRoots.push(root);
    stageMinimalRepo(root);

    const shrinkwrapPath = join(root, "npm-shrinkwrap.json");
    const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    shrinkwrap.packages[""]!.version = "0.0.0-test-drift";
    writeFileSync(shrinkwrapPath, `${JSON.stringify(shrinkwrap, null, 2)}\n`);

    const { status, output } = runCheck(root);
    expect(status).toBe(1);
    expect(output).toMatch(/root metadata does not match/);
  });

  it("fails when adm-zip entries in shrinkwrap are below the secure floor", () => {
    const root = mkdtempSync(join(tmpdir(), "shrinkwrap-check-"));
    tempRoots.push(root);
    stageMinimalRepo(root);

    const shrinkwrapPath = join(root, "npm-shrinkwrap.json");
    const shrinkwrap = JSON.parse(readFileSync(shrinkwrapPath, "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    for (const [path, metadata] of Object.entries(shrinkwrap.packages)) {
      if (path.endsWith("node_modules/adm-zip")) {
        metadata.version = "0.5.18";
      }
    }
    writeFileSync(shrinkwrapPath, `${JSON.stringify(shrinkwrap, null, 2)}\n`);

    const { status, output } = runCheck(root);
    expect(status).toBe(1);
    expect(output).toMatch(/out of date/);
    expect(output).toMatch(/adm-zip/);
  });
});
