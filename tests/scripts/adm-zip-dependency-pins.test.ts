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

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

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
  const pattern = /^\s+adm-zip@([0-9]+\.[0-9]+\.[0-9]+):/gm;
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]!);
  }
  return [...versions];
}

describe("adm-zip dependency pins (CVE-2026-39244 / CVE-2026-76845)", () => {
  it("declares patched floors in package.json, pnpm overrides, and npm parent override", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      overrides: Record<string, Record<string, string>>;
      pnpm: { overrides: Record<string, string> };
      scripts: Record<string, string>;
      files: string[];
    };

    expect(packageJson.dependencies["adm-zip"]).toBe(`^${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]).toEqual({ "adm-zip": SECURE_ADM_ZIP_VERSION });
    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("documents a patched adm-zip release in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "adm-zip");
    expect(version, "expected adm-zip in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("links only patched adm-zip copies under node_modules after install", () => {
    expect(listInsecureAdmZipInstalls(root)).toEqual([]);

    const version = readInstalledPackageVersion("adm-zip");
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("resolves only patched adm-zip releases in pnpm-lock.yaml (including onnxruntime transitive)", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockAdmZipVersions(lockText);
    expect(versions.length, "expected adm-zip entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION), `adm-zip@${version}`).toBe(
        true,
      );
    }
  });
});
