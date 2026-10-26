/**
 * Guards fast-uri override and lock/shrinkwrap resolution (CVE regression on transitive copies).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureAdmZipVersion } from "../../scripts/adm-zip-security-lib.mjs";

const root = process.cwd();
const FAST_URI_FLOOR = "4.2.3";

function readPackageJson() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    pnpm?: { overrides?: Record<string, string> };
  };
}

function parsePnpmLockFastUriVersions(lockfileText: string): string[] {
  const versions = new Set<string>();
  for (const match of lockfileText.matchAll(/fast-uri@(\d+\.\d+\.\d+):/g)) {
    versions.add(match[1]);
  }
  return [...versions];
}

describe("fast-uri security pins", () => {
  it("keeps pnpm override at the patched floor", () => {
    const pkg = readPackageJson();
    expect(pkg.pnpm?.overrides?.["fast-uri"]).toBe(`>=${FAST_URI_FLOOR}`);
  });

  it("resolves fast-uri in pnpm-lock at or above the floor", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockFastUriVersions(lockText);
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isSecureAdmZipVersion(version, FAST_URI_FLOOR)).toBe(true);
    }
  });

  it("resolves fast-uri in npm-shrinkwrap at or above the floor", () => {
    const shrinkwrap = JSON.parse(readFileSync(join(root, "npm-shrinkwrap.json"), "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };
    const resolved = shrinkwrap.packages?.["node_modules/fast-uri"]?.version;
    expect(resolved).toBeTruthy();
    expect(isSecureAdmZipVersion(resolved, FAST_URI_FLOOR)).toBe(true);
  });
});
