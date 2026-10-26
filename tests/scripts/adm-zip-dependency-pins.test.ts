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

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const pattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function parseNpmShrinkwrapAdmZipVersions(shrinkwrapText: string): Array<{ path: string; version: string }> {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const installs: Array<{ path: string; version: string }> = [];
  for (const [path, metadata] of Object.entries(shrinkwrap.packages ?? {})) {
    if (!path.endsWith("node_modules/adm-zip")) {
      continue;
    }
    if (typeof metadata.version === "string") {
      installs.push({ path, version: metadata.version });
    }
  }
  return installs;
}

describe("adm-zip dependency pins (CVE-2026-39244 / CVE-2026-76845)", () => {
  it("declares patched floors in pnpm overrides and npm parent override for onnxruntime-node", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
      dependencies: Record<string, string>;
      overrides: Record<string, Record<string, string>>;
      scripts: Record<string, string>;
      files: string[];
    };

    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.dependencies["adm-zip"]).toBe(`^${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]?.["adm-zip"]).toBe(SECURE_ADM_ZIP_VERSION);
    expect(packageJson.scripts.postinstall).toContain("ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toContain("scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toContain("scripts/adm-zip-security-lib.mjs");
  });

  it("resolves only patched adm-zip releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "adm-zip");
    expect(versions.length, "expected adm-zip entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }

    expect(lockText).toMatch(/onnxruntime-node@1\.30\.0:[\s\S]*adm-zip: 0\.6\.1/);
  });

  it("documents secure adm-zip installs in npm-shrinkwrap.json for global npm consumers", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const installs = parseNpmShrinkwrapAdmZipVersions(shrinkwrapText);
    expect(installs.length, "shrinkwrap must pin at least one adm-zip install").toBeGreaterThan(0);
    for (const { path, version } of installs) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION), path).toBe(true);
    }
  });

  it("links a patched hoisted adm-zip under node_modules after install", () => {
    const version = readInstalledPackageVersion("adm-zip");
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("has no insecure adm-zip copies anywhere under node_modules after install", () => {
    const insecure = listInsecureAdmZipInstalls(root);
    expect(insecure, insecure.map((entry) => `${entry.path}@${entry.version}`).join(", ")).toEqual(
      [],
    );
  });
});
