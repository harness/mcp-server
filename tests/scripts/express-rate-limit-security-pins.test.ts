import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSecureIpAddressVersion,
  parsePnpmLockIpAddressVersions,
} from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Floor from package.json pnpm.overrides (CVE / dependency alignment). */
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function readPnpmExpressRateLimitVersion(): string {
  const pnpmDir = join(root, "node_modules", ".pnpm");
  const storeDir = readdirSync(pnpmDir).find((name) => name.startsWith("express-rate-limit@"));
  expect(storeDir, "expected express-rate-limit in the pnpm virtual store").toBeTruthy();
  const manifest = JSON.parse(
    readFileSync(join(pnpmDir, storeDir!, "node_modules", "express-rate-limit", "package.json"), "utf8"),
  ) as { version?: string };
  expect(typeof manifest.version).toBe("string");
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

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

describe("express-rate-limit security pin", () => {
  it("declares a patched floor in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(
      `>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`,
    );
  });

  it("resolves a patched express-rate-limit release in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "express-rate-limit");
    expect(versions.length, "expected express-rate-limit entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
    }
  });

  it("materializes a patched express-rate-limit copy in the pnpm virtual store after install", () => {
    const version = readPnpmExpressRateLimitVersion();
    expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
  });

  it("documents a patched express-rate-limit release in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "express-rate-limit");
    expect(version, "expected express-rate-limit in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
  });

  it("keeps express-rate-limit's transitive ip-address on the NAT64 / ReDoS floor", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const ipVersions = parsePnpmLockIpAddressVersions(lockText);
    expect(ipVersions.length).toBeGreaterThan(0);
    for (const version of ipVersions) {
      expect(isSecureIpAddressVersion(version, "10.7.4")).toBe(true);
    }
  });
});
