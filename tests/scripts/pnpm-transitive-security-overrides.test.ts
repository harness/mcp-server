import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import { parsePnpmLockPackageVersions, parsePnpmLockPackageVersionsLoose } from "./lockfile-parse.js";

const root = process.cwd();

/** pnpm overrides without a dedicated guard module elsewhere in tests/scripts/. */
export const TRANSITIVE_SECURITY_OVERRIDES: Record<string, string> = {
  picomatch: "4.0.4",
  "path-to-regexp": "8.4.0",
  nanoid: "3.3.18",
  esbuild: "0.28.1",
  postcss: "8.5.18",
  "source-map-js": "1.2.2",
  sharp: "0.35.5",
  protobufjs: "8.6.0",
  "@opentelemetry/core": "2.8.0",
};

function parseOverrideFloor(specifier: string): string {
  const match = specifier.match(/([0-9]+\.[0-9]+\.[0-9]+)/);
  if (!match) {
    throw new Error(`expected numeric floor in override ${specifier}`);
  }
  return match[1]!;
}

describe("pnpm transitive security overrides (lockfile floors)", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    pnpm: { overrides: Record<string, string> };
  };
  const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

  it("keeps documented floors aligned with package.json pnpm.overrides", () => {
    for (const [name, floor] of Object.entries(TRANSITIVE_SECURITY_OVERRIDES)) {
      const configured = packageJson.pnpm.overrides[name];
      expect(configured, `expected pnpm override for ${name}`).toBeTruthy();
      expect(parseOverrideFloor(configured!)).toBe(floor);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml for each transitive override", () => {
    const loosePackages = new Set(["sharp", "protobufjs"]);

    for (const [name, floor] of Object.entries(TRANSITIVE_SECURITY_OVERRIDES)) {
      const versions = loosePackages.has(name)
        ? parsePnpmLockPackageVersionsLoose(lockText, name)
        : parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor)).toBe(true);
      }
    }
  });
});
