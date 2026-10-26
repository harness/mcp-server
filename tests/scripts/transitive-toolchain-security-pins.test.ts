import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

const PINNED_TOOLCHAIN_FLOORS: Array<{ name: string; floor: string }> = [
  { name: "picomatch", floor: "4.0.4" },
  { name: "nanoid", floor: "3.3.18" },
  { name: "esbuild", floor: "0.28.1" },
  { name: "postcss", floor: "8.5.18" },
  { name: "source-map-js", floor: "1.2.2" },
];

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
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

describe("Transitive toolchain security pins (Vite / PostCSS / esbuild chain)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of PINNED_TOOLCHAIN_FLOORS) {
      const override = packageJson.pnpm.overrides[name];
      expect(override).toMatch(new RegExp(`>=${floor.replaceAll(".", "\\.")}|\\^${floor}`));
    }
  });

  it("resolves patched transitive releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of PINNED_TOOLCHAIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("documents patched toolchain deps in npm-shrinkwrap.json when present", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

    for (const { name, floor } of PINNED_TOOLCHAIN_FLOORS) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      if (version === null) {
        continue;
      }
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });
});
