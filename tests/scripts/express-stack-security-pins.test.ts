import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

const EXPRESS_STACK_PIN_FLOORS: Array<{ name: string; floor: string }> = [
  { name: "express-rate-limit", floor: "8.2.2" },
  { name: "path-to-regexp", floor: "8.4.0" },
  { name: "proxy-addr", floor: "2.0.8" },
  { name: "qs", floor: "6.16.0" },
];

function readInstalledPackageVersion(packageName: string): string {
  const entry = require.resolve(packageName);
  let dir = dirname(entry);
  for (let depth = 0; depth < 12; depth += 1) {
    const packageJsonPath = join(dir, "package.json");
    try {
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === packageName && typeof manifest.version === "string") {
        return manifest.version;
      }
    } catch {
      // walk up from nested dist/ paths
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(`could not resolve ${packageName} version from node_modules`);
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

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

describe("Express HTTP stack security pins (rate limit, routing, trust proxy, query parsing)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of EXPRESS_STACK_PIN_FLOORS) {
      expect(packageJson.pnpm.overrides[name]).toBe(`>=${floor}`);
    }
  });

  it("resolves patched Express stack releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of EXPRESS_STACK_PIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents patched runtime Express deps in npm-shrinkwrap.json", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

    for (const { name, floor } of EXPRESS_STACK_PIN_FLOORS) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });

  it("links patched copies under node_modules after install", () => {
    for (const { name, floor } of EXPRESS_STACK_PIN_FLOORS) {
      const version = readInstalledPackageVersion(name);
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
