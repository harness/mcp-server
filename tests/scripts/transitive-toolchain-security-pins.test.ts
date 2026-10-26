import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
  parsePnpmLockPackageVersionsLoose,
  readInstalledPackageVersion,
} from "./lockfile-parse.js";

const root = process.cwd();

type Pin = { name: string; floor: string; loose?: boolean; shrinkwrap?: boolean; installed?: boolean };

/** Transitive toolchain pins from package.json pnpm.overrides (Vite/esbuild/postcss chain, matchers, OTel). */
const TRANSITIVE_PINS: Pin[] = [
  { name: "picomatch", floor: "4.0.4", loose: true },
  { name: "nanoid", floor: "3.3.18", loose: true },
  { name: "esbuild", floor: "0.28.1", loose: true },
  { name: "postcss", floor: "8.5.18", loose: true },
  { name: "source-map-js", floor: "1.2.2" },
  { name: "path-to-regexp", floor: "8.4.0", loose: true },
  { name: "sharp", floor: "0.35.5", loose: true },
  { name: "protobufjs", floor: "8.6.0", loose: true },
  { name: "@opentelemetry/core", floor: "2.8.0", loose: true },
];

const SECURE_VITEST_VERSION = "4.1.12";

describe("Transitive toolchain security pins (pnpm overrides + lockfile)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
      devDependencies: Record<string, string>;
    };

    for (const { name, floor } of TRANSITIVE_PINS) {
      const declared = packageJson.pnpm.overrides[name];
      expect(declared, `missing pnpm override for ${name}`).toBeTruthy();
      expect(declared).toMatch(new RegExp(floor.replace(/\./g, "\\.")));
    }

    expect(packageJson.devDependencies.vitest).toBe(`^${SECURE_VITEST_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor, loose } of TRANSITIVE_PINS) {
      const versions = loose
        ? parsePnpmLockPackageVersionsLoose(lockText, name)
        : parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }

    const vitestVersions = parsePnpmLockPackageVersionsLoose(lockText, "vitest");
    expect(vitestVersions.length).toBeGreaterThan(0);
    for (const version of vitestVersions) {
      expect(isSecureIpAddressVersion(version, SECURE_VITEST_VERSION)).toBe(true);
    }
  });

  it("links patched postcss and source-map-js under node_modules after install", () => {
    for (const name of ["postcss", "source-map-js"] as const) {
      const pin = TRANSITIVE_PINS.find((p) => p.name === name)!;
      const version = readInstalledPackageVersion(root, name);
      expect(isSecureIpAddressVersion(version, pin.floor)).toBe(true);
    }
  });
});
