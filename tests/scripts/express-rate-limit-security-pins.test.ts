import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();
const requireFromExpress = createRequire(
  createRequire(import.meta.url).resolve("express/package.json"),
);

const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function readInstalledPackageVersion(packageName: string): string {
  let dir = dirname(requireFromExpress.resolve(packageName));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = join(dir, "..");
    expect(parent !== dir, `expected ${packageName} package.json on module resolution path`).toBe(true);
    dir = parent;
  }
  const packageJsonPath = join(dir, "package.json");
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

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

describe("express-rate-limit security pin (transitive ip-address consumer)", () => {
  it("declares a patched floor in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(
      `>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`,
    );
  });

  it("resolves patched express-rate-limit releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lockText, "express-rate-limit");
    expect(versions.length, "expected express-rate-limit entries in pnpm-lock.yaml").toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
    }
  });

  it("documents a patched express-rate-limit in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "express-rate-limit");
    expect(version, "expected express-rate-limit in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
  });

  it("links a patched copy under node_modules after install", () => {
    const version = readInstalledPackageVersion("express-rate-limit");
    expect(isSecureIpAddressVersion(version, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
  });
});
