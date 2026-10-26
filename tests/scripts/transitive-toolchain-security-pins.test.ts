import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Transitive toolchain floors from package.json pnpm.overrides (Oct 2026 security batch). */
const TRANSITIVE_PIN_FLOORS: Array<{ name: string; floor: string }> = [
  { name: "picomatch", floor: "4.0.4" },
  { name: "path-to-regexp", floor: "8.4.0" },
  { name: "express-rate-limit", floor: "8.2.2" },
  { name: "nanoid", floor: "3.3.18" },
  { name: "esbuild", floor: "0.28.1" },
  { name: "postcss", floor: "8.5.18" },
  { name: "source-map-js", floor: "1.2.2" },
  { name: "sharp", floor: "0.35.5" },
  { name: "protobufjs", floor: "8.6.0" },
  { name: "qs", floor: "6.16.0" },
  { name: "proxy-addr", floor: "2.0.8" },
  { name: "@opentelemetry/core", floor: "2.8.0" },
];

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

describe("Transitive toolchain security pins (lockfile floors)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      const override = packageJson.pnpm.overrides[name];
      expect(override, `expected pnpm override for ${name}`).toBeDefined();
      expect(override).toMatch(new RegExp(floor.replace(/\./g, "\\.")));
    }
  });

  it("resolves only patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });
});
