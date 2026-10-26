import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_QS_VERSION = "6.16.0";

function readInstalledPackageVersion(packageName: string): string {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    expect(typeof manifest.version).toBe("string");
    return manifest.version!;
  } catch {
    let dir = dirname(require.resolve(packageName));
    while (dir.length > 1) {
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
      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
    throw new Error(`Could not resolve installed version for ${packageName}`);
  }
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

describe("Express HTTP stack security pins (rate limit and transitive CVE floors)", () => {
  it("declares express-rate-limit floor in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(`>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`);
  });

  it("resolves patched express-rate-limit in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "express-rate-limit");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
    }
  });

  it("documents patched express-rate-limit in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "express-rate-limit");
    expect(version).not.toBeNull();
    expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
  });

  it("links patched Express HTTP dependencies under node_modules after install", () => {
    const checks: Array<{ name: string; floor: string }> = [
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "qs", floor: SECURE_QS_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = readInstalledPackageVersion(name);
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
