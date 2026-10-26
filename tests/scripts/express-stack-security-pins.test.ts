import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Transitive Express middleware floors from the Oct 2026 security branch. */
const EXPRESS_STACK_PACKAGES = [
  { name: "qs", floor: "6.16.0", requiredOnDisk: true },
  { name: "proxy-addr", floor: "2.0.8", requiredOnDisk: true },
  { name: "path-to-regexp", floor: "8.4.0", requiredOnDisk: true },
  /** Override-only until a runtime dep pulls it into the install graph. */
  { name: "express-rate-limit", floor: "8.2.2", requiredOnDisk: false },
] as const;

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  const versions = new Set<string>();
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

describe("Express middleware stack security pins", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    pnpm: { overrides: Record<string, string> };
    dependencies: Record<string, string>;
  };
  const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

  it("declares patched floors in pnpm overrides for Express middleware deps", () => {
    for (const { name, floor } of EXPRESS_STACK_PACKAGES) {
      expect(packageJson.pnpm.overrides[name]).toBe(`>=${floor}`);
    }
    expect(packageJson.dependencies.express).toBeDefined();
  });

  it("resolves patched middleware releases in pnpm-lock.yaml", () => {
    for (const { name, floor } of EXPRESS_STACK_PACKAGES) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });

  it("links patched middleware copies under node_modules when pulled by the install graph", () => {
    for (const { name, floor, requiredOnDisk } of EXPRESS_STACK_PACKAGES) {
      const linkedVersions = parsePnpmLockPackageVersions(lockText, name);
      expect(linkedVersions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);

      const installedVersions = linkedVersions
        .map((linkedVersion) => {
          const packageJsonPath = join(
            root,
            "node_modules",
            ".pnpm",
            `${name}@${linkedVersion}`,
            "node_modules",
            name,
            "package.json",
          );
          try {
            const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
            return typeof manifest.version === "string" ? manifest.version : null;
          } catch {
            return null;
          }
        })
        .filter((version): version is string => version !== null);

      if (requiredOnDisk) {
        expect(
          installedVersions.length,
          `expected at least one on-disk ${name} install under node_modules/.pnpm`,
        ).toBeGreaterThan(0);
      }
      for (const version of installedVersions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });
});
