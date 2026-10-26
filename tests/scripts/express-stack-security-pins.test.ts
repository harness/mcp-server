import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Express / rate-limit transitive floors enforced via pnpm overrides. */
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";
const SECURE_QS_VERSION = "6.16.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";

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

describe("Express stack security pins (path-to-regexp, express-rate-limit, qs, proxy-addr)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides["path-to-regexp"]).toBe(`>=${SECURE_PATH_TO_REGEXP_VERSION}`);
    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(`>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`);
    expect(packageJson.pnpm.overrides.qs).toBe(`>=${SECURE_QS_VERSION}`);
    expect(packageJson.pnpm.overrides["proxy-addr"]).toBe(`>=${SECURE_PROXY_ADDR_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
    ];

    for (const { name, floor } of checks) {
      assertAllAtLeastFloor(parsePnpmLockPackageVersions(lockText, name), floor, name);
    }
  });
});
