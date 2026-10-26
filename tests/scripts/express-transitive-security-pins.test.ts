import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

const EXPRESS_TRANSITIVE_PINS: Array<{ name: string; floor: string }> = [
  { name: "path-to-regexp", floor: "8.4.0" },
  { name: "proxy-addr", floor: "2.0.8" },
  { name: "qs", floor: "6.16.0" },
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

describe("Express transitive security pins (path-to-regexp, proxy-addr, qs)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of EXPRESS_TRANSITIVE_PINS) {
      expect(packageJson.pnpm.overrides[name]).toBe(`>=${floor}`);
    }
  });

  it("resolves patched transitive releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of EXPRESS_TRANSITIVE_PINS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });
});
