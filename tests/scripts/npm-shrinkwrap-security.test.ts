import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();

describe("npm-shrinkwrap.json security regression", () => {
  it("passes generate-npm-shrinkwrap.mjs --check (root metadata and adm-zip tree)", () => {
    const result = spawnSync(process.execPath, ["scripts/generate-npm-shrinkwrap.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it("pins every transitive adm-zip copy in the shrinkwrap package map", () => {
    const shrinkwrap = JSON.parse(readFileSync(join(root, "npm-shrinkwrap.json"), "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };

    const admZipInstalls = Object.entries(shrinkwrap.packages ?? {}).filter(([path]) =>
      path.endsWith("node_modules/adm-zip"),
    );
    expect(admZipInstalls.length, "expected adm-zip entries in npm-shrinkwrap.json").toBeGreaterThan(0);

    for (const [path, metadata] of admZipInstalls) {
      expect(
        isSecureAdmZipVersion(metadata?.version, SECURE_ADM_ZIP_VERSION),
        `${path}@${metadata?.version ?? "missing"}`,
      ).toBe(true);
    }
  });
});
