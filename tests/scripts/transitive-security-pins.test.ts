import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

const SECURE_NANOID_VERSION = "3.3.18";
const SECURE_ESBUILD_VERSION = "0.28.1";
const SECURE_POSTCSS_VERSION = "8.5.18";
const SECURE_SOURCE_MAP_JS_VERSION = "1.2.2";
const SECURE_SHARP_VERSION = "0.35.5";
const SECURE_PROTOBUFJS_VERSION = "8.6.0";
const SECURE_ADM_ZIP_VERSION = "0.6.1";
const SECURE_OTEL_CORE_VERSION = "2.8.0";
const SECURE_VITEST_VERSION = "4.1.12";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const escaped = escapeRegExp(packageName);
  const patterns = [
    new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm"),
    new RegExp(`['"]${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)['"]?:`, "gm"),
  ];
  for (const pattern of patterns) {
    for (const match of lockfileText.matchAll(pattern)) {
      versions.add(match[1]);
    }
  }
  return [...versions];
}

function readInstalledPackageVersion(packageName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

describe("transitive security pins (vite toolchain, sharp, protobufjs, adm-zip, otel)", () => {
  it("declares patched floors in pnpm overrides from the Oct 2026 security sweep", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
      devDependencies: Record<string, string>;
    };

    expect(packageJson.pnpm.overrides.nanoid).toBe(`^${SECURE_NANOID_VERSION}`);
    expect(packageJson.pnpm.overrides.esbuild).toBe(`>=${SECURE_ESBUILD_VERSION}`);
    expect(packageJson.pnpm.overrides.postcss).toBe(`>=${SECURE_POSTCSS_VERSION}`);
    expect(packageJson.pnpm.overrides["source-map-js"]).toBe(`>=${SECURE_SOURCE_MAP_JS_VERSION}`);
    expect(packageJson.pnpm.overrides.sharp).toBe(`>=${SECURE_SHARP_VERSION}`);
    expect(packageJson.pnpm.overrides.protobufjs).toBe(`>=${SECURE_PROTOBUFJS_VERSION}`);
    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.pnpm.overrides["@opentelemetry/core"]).toBe(`>=${SECURE_OTEL_CORE_VERSION}`);
    expect(packageJson.devDependencies.vitest).toBe(`^${SECURE_VITEST_VERSION}`);
  });

  it("resolves patched transitive releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "nanoid", floor: SECURE_NANOID_VERSION },
      { name: "esbuild", floor: SECURE_ESBUILD_VERSION },
      { name: "postcss", floor: SECURE_POSTCSS_VERSION },
      { name: "source-map-js", floor: SECURE_SOURCE_MAP_JS_VERSION },
      { name: "sharp", floor: SECURE_SHARP_VERSION },
      { name: "protobufjs", floor: SECURE_PROTOBUFJS_VERSION },
      { name: "@opentelemetry/core", floor: SECURE_OTEL_CORE_VERSION },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("keeps Express HTTP stack transitive pins on patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "path-to-regexp", floor: "8.4.0" },
      { name: "express-rate-limit", floor: "8.2.2" },
      { name: "picomatch", floor: "4.0.4" },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("links patched dev-toolchain copies under node_modules after install", () => {
    const checks: Array<{ name: string; floor: string }> = [
      { name: "nanoid", floor: SECURE_NANOID_VERSION },
      { name: "esbuild", floor: SECURE_ESBUILD_VERSION },
      { name: "postcss", floor: SECURE_POSTCSS_VERSION },
      { name: "source-map-js", floor: SECURE_SOURCE_MAP_JS_VERSION },
      { name: "adm-zip", floor: SECURE_ADM_ZIP_VERSION },
      { name: "vitest", floor: SECURE_VITEST_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = readInstalledPackageVersion(name);
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
