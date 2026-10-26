import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();

function listNpmShrinkwrapAdmZipInstalls(shrinkwrapText: string): Array<{ path: string; version: string }> {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const installs: Array<{ path: string; version: string }> = [];
  for (const [path, metadata] of Object.entries(shrinkwrap.packages ?? {})) {
    if (!path.endsWith("node_modules/adm-zip")) continue;
    const version = metadata?.version;
    if (typeof version !== "string") continue;
    installs.push({ path, version });
  }
  return installs.sort((left, right) => left.path.localeCompare(right.path));
}

describe("npm-shrinkwrap security (global npm consumer tree)", () => {
  const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

  it("documents at least one secure adm-zip install for npm consumers", () => {
    const installs = listNpmShrinkwrapAdmZipInstalls(shrinkwrapText);
    expect(installs.length, "expected adm-zip entries in npm-shrinkwrap.json").toBeGreaterThan(0);
    for (const { path, version } of installs) {
      expect(
        isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION),
        `${path}@${version} must be >= ${SECURE_ADM_ZIP_VERSION}`,
      ).toBe(true);
    }
  });

  it("passes generate-npm-shrinkwrap --check (metadata + adm-zip floors)", () => {
    const result = spawnSync("node", ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
