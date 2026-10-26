import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

const SECURE_QS_VERSION = "6.16.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const unscopedPattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(unscopedPattern)) {
    versions.add(match[1]);
  }

  if (packageName.includes("/")) {
    const scopedPattern = new RegExp(
      `'${packageName.replace("/", "\\/")}@([0-9]+\\.[0-9]+\\.[0-9]+)':`,
      "g",
    );
    for (const match of lockfileText.matchAll(scopedPattern)) {
      versions.add(match[1]);
    }
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

function assertAllAtLeastFloor(versions: string[], floor: string, label: string): void {
  expect(versions.length, `expected ${label} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
  for (const version of versions) {
    expect(isSecureIpAddressVersion(version, floor)).toBe(true);
  }
}

function readPnpmNestedPackageVersion(nestedPackage: string, parentPackage: string): string {
  const pnpmDir = join(root, "node_modules", ".pnpm");
  const storeDir = readdirSync(pnpmDir).find((entry) => entry.startsWith(`${parentPackage}@`));
  expect(
    storeDir,
    `expected ${parentPackage} in node_modules/.pnpm after pnpm install`,
  ).toBeTruthy();

  const packageJsonPath = join(pnpmDir, storeDir!, "node_modules", nestedPackage, "package.json");
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(
    typeof manifest.version,
    `expected ${nestedPackage} under ${storeDir} to expose a version`,
  ).toBe("string");
  return manifest.version!;
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

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, "qs"), SECURE_QS_VERSION, "qs");
    assertAllAtLeastFloor(
      parsePnpmLockPackageVersions(lockText, "proxy-addr"),
      SECURE_PROXY_ADDR_VERSION,
      "proxy-addr",
    );
    assertAllAtLeastFloor(
      parsePnpmLockPackageVersions(lockText, "path-to-regexp"),
      SECURE_PATH_TO_REGEXP_VERSION,
      "path-to-regexp",
    );
    assertAllAtLeastFloor(
      parsePnpmLockPackageVersions(lockText, "express-rate-limit"),
      SECURE_EXPRESS_RATE_LIMIT_VERSION,
      "express-rate-limit",
    );
  });

  it("documents patched transitive Express deps in npm-shrinkwrap.json", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version!, floor)).toBe(true);
    }
  });

  it("links patched qs and proxy-addr copies used by express", () => {
    const qsVersion = readPnpmNestedPackageVersion("qs", "express");
    const proxyVersion = readPnpmNestedPackageVersion("proxy-addr", "express");
    expect(isSecureIpAddressVersion(qsVersion, SECURE_QS_VERSION)).toBe(true);
    expect(isSecureIpAddressVersion(proxyVersion, SECURE_PROXY_ADDR_VERSION)).toBe(true);
  });

  it("links a patched path-to-regexp copy used by express router", () => {
    const version = readPnpmNestedPackageVersion("path-to-regexp", "router");
    expect(isSecureIpAddressVersion(version, SECURE_PATH_TO_REGEXP_VERSION)).toBe(true);
  });
});
