import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);

const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";

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

function readExpressTransitiveVersion(packageName: string): string {
  const expressRequire = createRequire(require.resolve("express/package.json"));
  const packageJsonPath = expressRequire.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

describe("Express transitive security pins (proxy-addr, path-to-regexp)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides["proxy-addr"]).toBe(`>=${SECURE_PROXY_ADDR_VERSION}`);
    expect(packageJson.pnpm.overrides["path-to-regexp"]).toBe(`>=${SECURE_PATH_TO_REGEXP_VERSION}`);
  });

  it("resolves patched transitive releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents proxy-addr in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "proxy-addr");
    expect(version, "expected proxy-addr in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureIpAddressVersion(version, SECURE_PROXY_ADDR_VERSION)).toBe(true);
  });

  it("links a patched proxy-addr copy on the Express dependency chain after install", () => {
    const version = readExpressTransitiveVersion("proxy-addr");
    expect(isSecureIpAddressVersion(version, SECURE_PROXY_ADDR_VERSION)).toBe(true);
  });
});
