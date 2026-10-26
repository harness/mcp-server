import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import { parsePnpmLockPackageVersions } from "./lockfile-parse.js";

const require = createRequire(import.meta.url);
const root = process.cwd();

const TRANSITIVE_PIN_FLOORS: Array<{ name: string; floor: string }> = [
  { name: "esbuild", floor: "0.28.1" },
  { name: "postcss", floor: "8.5.18" },
  { name: "protobufjs", floor: "8.6.0" },
  { name: "sharp", floor: "0.35.5" },
];

function readInstalledPackageVersion(packageName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

describe("transitive security pins (build and parser toolchain)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      expect(packageJson.pnpm.overrides[name]).toBe(`>=${floor}`);
    }
  });

  it("resolves patched transitive releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("links patched copies under node_modules when present in the install graph", () => {
    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      try {
        const version = readInstalledPackageVersion(name);
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      } catch {
        const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
        const versions = parsePnpmLockPackageVersions(lockText, name);
        expect(versions.length).toBeGreaterThan(0);
      }
    }
  });
});
