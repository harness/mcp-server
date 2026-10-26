import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** pnpm overrides from the Oct 2026 security branch not covered by cve/http-framework pin suites. */
const ADDITIONAL_SECURITY_PACKAGES = [
  "picomatch",
  "path-to-regexp",
  "express-rate-limit",
  "nanoid",
  "esbuild",
  "postcss",
  "source-map-js",
  "sharp",
  "protobufjs",
  "@opentelemetry/core",
  "qs",
  "proxy-addr",
] as const;

function minimumFromOverride(override: string): string {
  const match = override.match(/^(?:>=|\^)([0-9]+\.[0-9]+\.[0-9]+)/);
  expect(match, `expected semver floor in override "${override}"`).not.toBeNull();
  return match![1];
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const quoted = packageName.includes("/")
    ? `'${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)'`
    : `${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)`;
  const pattern = new RegExp(`^\\s+${quoted}:`, "gm");
  const versions = new Set<string>();
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

describe("Additional pnpm security overrides (transitive CVE floors)", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    pnpm: { overrides: Record<string, string> };
  };
  const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
  const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

  const floors = ADDITIONAL_SECURITY_PACKAGES.map((name) => ({
    name,
    floor: minimumFromOverride(packageJson.pnpm.overrides[name]),
  }));

  it("declares patched floors in pnpm.overrides", () => {
    for (const { name, floor } of floors) {
      expect(packageJson.pnpm.overrides[name], `missing override for ${name}`).toBeDefined();
      expect(minimumFromOverride(packageJson.pnpm.overrides[name])).toBe(floor);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    for (const { name, floor } of floors) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents patched runtime copies in npm-shrinkwrap.json when present", () => {
    const shrinkwrapPackages = ["sharp", "protobufjs"] as const;
    for (const name of shrinkwrapPackages) {
      const floor = floors.find((entry) => entry.name === name)!.floor;
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
