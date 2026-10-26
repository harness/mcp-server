import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

const SECURE_QS_VERSION = "6.16.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function readInstalledPackageVersion(packageName: string): string {
  let dir = dirname(require.resolve(packageName));
  while (dir !== dirname(dir)) {
    const packageJsonPath = join(dir, "package.json");
    if (existsSync(packageJsonPath)) {
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === packageName && typeof manifest.version === "string") {
        return manifest.version;
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`could not resolve installed version for ${packageName}`);
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const pattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

const EXPRESS_STACK_PINS: Array<{ name: string; floor: string }> = [
  { name: "qs", floor: SECURE_QS_VERSION },
  { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
  { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
  { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
];

describe("Express stack security pins (qs, proxy-addr, path-to-regexp, express-rate-limit)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of EXPRESS_STACK_PINS) {
      expect(packageJson.pnpm.overrides[name]).toBe(`>=${floor}`);
    }
  });

  it("resolves patched Express transitive deps in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of EXPRESS_STACK_PINS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents patched Express stack deps in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

    for (const { name, floor } of EXPRESS_STACK_PINS) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });

  it("links patched copies under node_modules after install", () => {
    for (const { name, floor } of EXPRESS_STACK_PINS) {
      const version = readInstalledPackageVersion(name);
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
