import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

/** Remaining Oct 2026 pnpm.overrides not covered by CVE / HTTP / transitive pin suites. */
const ADDITIONAL_PIN_FLOORS: Array<{ name: string; floor: string; override: string }> = [
  { name: "picomatch", floor: "4.0.4", override: ">=4.0.4" },
  { name: "path-to-regexp", floor: "8.4.0", override: ">=8.4.0" },
  { name: "nanoid", floor: "3.3.18", override: "^3.3.18" },
  { name: "source-map-js", floor: "1.2.2", override: ">=1.2.2" },
  { name: "@opentelemetry/core", floor: "2.8.0", override: ">=2.8.0" },
];

function readInstalledPackageVersion(packageName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const escaped = packageName.replace("/", "\\/");
  const pattern = new RegExp(`^\\s+['"]?${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

describe("additional pnpm security pins (parser, routing, and OTel toolchain)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, override } of ADDITIONAL_PIN_FLOORS) {
      expect(packageJson.pnpm.overrides[name]).toBe(override);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of ADDITIONAL_PIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("links patched copies under node_modules when present in the install graph", () => {
    for (const { name, floor } of ADDITIONAL_PIN_FLOORS) {
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
