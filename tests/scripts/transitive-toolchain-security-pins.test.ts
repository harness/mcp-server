import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Vite / bundler transitive floors — regressions here re-open upstream CVE advisories. */
const SECURE_PICOMATCH_VERSION = "4.0.4";
const SECURE_NANOID_VERSION = "3.3.18";
const SECURE_ESBUILD_VERSION = "0.28.1";
const SECURE_POSTCSS_VERSION = "8.5.18";
const SECURE_SOURCE_MAP_JS_VERSION = "1.2.2";

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const pattern = new RegExp(`^\\s+${packageName}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function assertAllAtLeastFloor(versions: string[], floor: string, label: string): void {
  expect(versions.length, `expected ${label} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
  for (const version of versions) {
    expect(isSecureIpAddressVersion(version, floor)).toBe(true);
  }
}

describe("Transitive toolchain security pins (picomatch, nanoid, esbuild, postcss, source-map-js)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.picomatch).toBe(`>=${SECURE_PICOMATCH_VERSION}`);
    expect(packageJson.pnpm.overrides.nanoid).toBe(`^${SECURE_NANOID_VERSION}`);
    expect(packageJson.pnpm.overrides.esbuild).toBe(`>=${SECURE_ESBUILD_VERSION}`);
    expect(packageJson.pnpm.overrides.postcss).toBe(`>=${SECURE_POSTCSS_VERSION}`);
    expect(packageJson.pnpm.overrides["source-map-js"]).toBe(`>=${SECURE_SOURCE_MAP_JS_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "picomatch", floor: SECURE_PICOMATCH_VERSION },
      { name: "nanoid", floor: SECURE_NANOID_VERSION },
      { name: "esbuild", floor: SECURE_ESBUILD_VERSION },
      { name: "postcss", floor: SECURE_POSTCSS_VERSION },
      { name: "source-map-js", floor: SECURE_SOURCE_MAP_JS_VERSION },
    ];

    for (const { name, floor } of checks) {
      assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, name), floor, name);
    }
  });
});
