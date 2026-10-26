import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const require = createRequire(import.meta.url);
const root = process.cwd();

const SECURE_QS_VERSION = "6.16.0";
const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const pattern = new RegExp(`^\\s+${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm");
  for (const match of lockfileText.matchAll(pattern)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function packageRootFromResolve(
  resolver: NodeRequire,
  packageName: string,
): string {
  let dir = dirname(resolver.resolve(packageName));
  for (let depth = 0; depth < 6; depth++) {
    const manifestPath = join(dir, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: string };
      if (manifest.name === packageName) {
        return dir;
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`could not locate ${packageName} package root from resolve()`);
}

function parseNpmShrinkwrapPackageVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

describe("Express stack security pins (qs, express-rate-limit)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.qs).toBe(`>=${SECURE_QS_VERSION}`);
    expect(packageJson.pnpm.overrides["express-rate-limit"]).toBe(`>=${SECURE_EXPRESS_RATE_LIMIT_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "qs", floor: SECURE_QS_VERSION },
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor), `${name}: ${version} < ${floor}`).toBe(true);
      }
    }
  });

  it("documents qs floor in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "qs");
    expect(version, "expected qs in npm-shrinkwrap.json").not.toBeNull();
    expect(isSecureIpAddressVersion(version!, SECURE_QS_VERSION)).toBe(true);
  });

  it("resolves patched qs from the express dependency graph", () => {
    const expressRequire = createRequire(require.resolve("express/package.json"));
    const packageDir = packageRootFromResolve(expressRequire, "qs");
    const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
      version?: string;
    };
    expect(typeof manifest.version, "expected qs to expose a version").toBe("string");
    expect(isSecureIpAddressVersion(manifest.version!, SECURE_QS_VERSION)).toBe(true);
  });

  it("resolves patched express-rate-limit from the MCP SDK dependency graph", () => {
    const sdkRequire = createRequire(require.resolve("@modelcontextprotocol/sdk/package.json"));
    const packageDir = packageRootFromResolve(sdkRequire, "express-rate-limit");
    const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
      version?: string;
    };
    expect(typeof manifest.version, "expected express-rate-limit to expose a version").toBe("string");
    expect(isSecureIpAddressVersion(manifest.version!, SECURE_EXPRESS_RATE_LIMIT_VERSION)).toBe(true);
  });
});
