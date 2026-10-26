import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./pnpm-lock-package-versions.js";

const root = process.cwd();

const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";

const LOCKFILE_PINNED_PACKAGES: Array<{ name: string; floor: string }> = [
  { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
];

describe("Express stack security pins (path-to-regexp)", () => {
  it("declares a patched floor in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of LOCKFILE_PINNED_PACKAGES) {
      expect(packageJson.pnpm.overrides[name], `pnpm override for ${name}`).toBe(`>=${floor}`);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of LOCKFILE_PINNED_PACKAGES) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents path-to-regexp in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

    for (const { name, floor } of LOCKFILE_PINNED_PACKAGES) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version!, floor)).toBe(true);
    }
  });
});
