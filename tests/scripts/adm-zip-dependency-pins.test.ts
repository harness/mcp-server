import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  listInsecureAdmZipInstalls,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

function readInstalledPackageVersion(packageName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

function parsePnpmLockAdmZipVersions(lockfileText: string): string[] {
  const versions = new Set<string>();
  for (const match of lockfileText.matchAll(/^\s+adm-zip@([0-9]+\.[0-9]+\.[0-9]+):/gm)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function parseNpmShrinkwrapAdmZipVersion(shrinkwrapText: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.["node_modules/adm-zip"]?.version;
  return typeof version === "string" ? version : null;
}

describe("adm-zip dependency pins (onnxruntime transitive CVEs)", () => {
  it("declares patched floors in npm and pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      overrides: { "onnxruntime-node": { "adm-zip": string } };
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.dependencies["adm-zip"]).toBe(`^${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]).toEqual({
      "adm-zip": SECURE_ADM_ZIP_VERSION,
    });
  });

  it("resolves only patched adm-zip releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockAdmZipVersions(lockText);
    expect(versions.length, "expected adm-zip entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }
    expect(lockText).toMatch(/onnxruntime-node@1\.[0-9]+\.[0-9]+:[\s\S]*?adm-zip: 0\.6\.1/);
  });

  it("documents a patched top-level adm-zip in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapAdmZipVersion(shrinkwrapText);
    expect(version, "expected adm-zip in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("links a patched adm-zip copy under node_modules after install", () => {
    const version = readInstalledPackageVersion("adm-zip");
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(listInsecureAdmZipInstalls(root)).toEqual([]);
  });
});
