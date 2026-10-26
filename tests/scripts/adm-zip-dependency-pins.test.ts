import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./pnpm-lock-package-versions.js";

const root = process.cwd();
const require = createRequire(import.meta.url);

function readInstalledAdmZipVersion(): string {
  const packageJsonPath = require.resolve("adm-zip/package.json", { paths: [root] });
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, "expected adm-zip package.json version").toBe("string");
  return manifest.version!;
}

describe("adm-zip dependency pins (GHSA / onnxruntime nested copy)", () => {
  it("wires postinstall and dual override paths in package.json", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: { postinstall?: string };
      dependencies: Record<string, string>;
      overrides: Record<string, Record<string, string>>;
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.dependencies["adm-zip"]).toBe(`^${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]).toEqual({ "adm-zip": SECURE_ADM_ZIP_VERSION });
  });

  it("resolves patched adm-zip releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "adm-zip");
    expect(versions.length, "expected adm-zip entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }
  });

  it("documents patched adm-zip in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "adm-zip");
    expect(version, "expected adm-zip in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureAdmZipVersion(version!, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("links a patched hoisted adm-zip under node_modules after install", () => {
    const version = readInstalledAdmZipVersion();
    expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
  });
});
