import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();

function listAdmZipShrinkwrapVersions(shrinkwrapText: string): Array<{ path: string; version: string }> {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const installs: Array<{ path: string; version: string }> = [];
  for (const [path, metadata] of Object.entries(shrinkwrap.packages ?? {})) {
    if (!path.endsWith("node_modules/adm-zip")) {
      continue;
    }
    if (typeof metadata?.version !== "string") {
      continue;
    }
    installs.push({ path, version: metadata.version });
  }
  return installs;
}

describe("npm-shrinkwrap.json (npm global install graph)", () => {
  it("passes generate-npm-shrinkwrap --check (metadata and adm-zip floors)", () => {
    const result = spawnSync("node", ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it("pins every documented adm-zip install to the secure release", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const installs = listAdmZipShrinkwrapVersions(shrinkwrapText);
    expect(installs.length, "expected at least one adm-zip entry in npm-shrinkwrap.json").toBeGreaterThan(
      0,
    );
    for (const { path, version } of installs) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION), `${path}@${version}`).toBe(true);
    }
  });
});
