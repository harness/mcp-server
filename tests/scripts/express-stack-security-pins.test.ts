import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./lockfile-parsers.js";

const root = process.cwd();

const SECURE_QS_VERSION = "6.16.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

/** Every copy pnpm installs under node_modules/.pnpm (transitive Express stack deps). */
function readPnpmInstalledVersions(packageName: string): string[] {
  const pnpmDir = join(root, "node_modules", ".pnpm");
  const versions: string[] = [];
  for (const entry of readdirSync(pnpmDir)) {
    if (!entry.startsWith(`${packageName}@`)) continue;
    const packageJsonPath = join(pnpmDir, entry, "node_modules", packageName, "package.json");
    try {
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
      if (typeof manifest.version === "string") versions.push(manifest.version);
    } catch {
      // ignore unreadable entries
    }
  }
  return versions;
}

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("Express stack security pins (qs, proxy-addr, path-to-regexp, express-rate-limit)", () => {
  const stackPackages: Array<{ name: string; floor: string }> = [
    { name: "qs", floor: SECURE_QS_VERSION },
    { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
    { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
    { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
  ];

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

    for (const { name, floor } of stackPackages) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });

  it("documents patched Express runtime deps in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

    for (const { name, floor } of stackPackages) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expectAtLeastFloor(version!, floor, name);
    }
  });

  it("links patched copies under node_modules/.pnpm after install", () => {
    for (const { name, floor } of stackPackages) {
      const versions = readPnpmInstalledVersions(name);
      expect(versions.length, `expected ${name} under node_modules/.pnpm`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });
});
