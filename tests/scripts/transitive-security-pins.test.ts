import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const escaped = packageName.replace("/", "\\/");
  const pattern = new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

describe("transitive HTTP stack security pins (express-rate-limit, proxy-addr)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(`>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`);
    expect(packageJson.pnpm.overrides["proxy-addr"]).toBe(`>=${SECURE_PROXY_ADDR_VERSION}`);
  });

  it("resolves express-rate-limit and proxy-addr to patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const pinnedPackages: Array<{ name: string; floor: string }> = [
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
    ];

    for (const { name, floor } of pinnedPackages) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor), `${name}@${version} below ${floor}`).toBe(true);
      }
    }
  });
});
