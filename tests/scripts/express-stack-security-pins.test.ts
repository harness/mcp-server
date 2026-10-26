import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import { parsePnpmLockPackageVersions } from "./pnpm-lock-package-versions.js";

const root = process.cwd();

const SECURE_QS_VERSION = "6.16.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

function readPnpmStorePackageVersion(packageName: string, lockText: string): string {
  const versions = parsePnpmLockPackageVersions(lockText, packageName);
  expect(versions.length, `expected ${packageName} in pnpm-lock.yaml`).toBeGreaterThan(0);

  const pnpmDir = join(root, "node_modules", ".pnpm");
  const storeEntries = existsSync(pnpmDir) ? readdirSync(pnpmDir) : [];

  for (const version of versions) {
    const storePrefixes = [
      `${packageName}@${version}`,
      ...storeEntries.filter(
        (entry) => entry.startsWith(`${packageName}@${version}_`) || entry.startsWith(`${packageName}@${version}(`),
      ),
    ];

    for (const storePrefix of storePrefixes) {
      const installDir = join(pnpmDir, storePrefix, "node_modules", packageName);
      const packageJsonPath = join(installDir, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
      if (typeof manifest.version === "string") {
        return manifest.version;
      }
    }
  }

  throw new Error(`no pnpm virtual-store install found for ${packageName}`);
}

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("Express stack security pins (qs, proxy-addr, path-to-regexp, express-rate-limit)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.qs).toBe(`>=${SECURE_QS_VERSION}`);
    expect(packageJson.pnpm.overrides["proxy-addr"]).toBe(`>=${SECURE_PROXY_ADDR_VERSION}`);
    expect(packageJson.pnpm.overrides["path-to-regexp"]).toBe(`>=${SECURE_PATH_TO_REGEXP_VERSION}`);
    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(
      `>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`,
    );
  });

  it("resolves patched transitive Express deps in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });

  it("materializes patched copies in the pnpm virtual store after install", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = readPnpmStorePackageVersion(name, lockText);
      expectAtLeastFloor(version, floor, name);
    }
  });

  it("documents patched Express-related deps in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expectAtLeastFloor(version!, floor, name);
    }
  });
});
