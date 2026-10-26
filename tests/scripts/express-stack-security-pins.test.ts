import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import { parsePnpmLockPackageVersions } from "../../scripts/pnpm-lock-parse-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

const SECURE_QS_VERSION = "6.16.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function readInstalledPackageVersion(packageName: string): string {
  let packageJsonPath: string;
  try {
    packageJsonPath = require.resolve(`${packageName}/package.json`);
  } catch {
    const entry = require.resolve(packageName, { paths: [require.resolve("express")] });
    packageJsonPath = join(dirname(entry), "..", "package.json");
  }
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("Express stack transitive security pins (qs, proxy-addr, path-to-regexp, express-rate-limit)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.qs).toBe(`>=${SECURE_QS_VERSION}`);
    expect(packageJson.pnpm.overrides["proxy-addr"]).toBe(`>=${SECURE_PROXY_ADDR_VERSION}`);
    expect(packageJson.pnpm.overrides["path-to-regexp"]).toBe(`>=${SECURE_PATH_TO_REGEXP_VERSION}`);
    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(`>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
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

  it("links patched copies under node_modules after install", () => {
    const checks: Array<{ name: string; floor: string }> = [
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = readInstalledPackageVersion(name);
      expectAtLeastFloor(version, floor, name);
    }
  });
});
