import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

const SECURE_HONO_VERSION = "4.13.11";
const SECURE_HONO_NODE_SERVER_VERSION = "2.0.10";
const SECURE_VITE_VERSION = "7.3.7";

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();
  const escaped = packageName.replace("/", "\\/");
  const patterns = [
    new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm"),
    new RegExp(`^\\s+'${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+)':`, "gm"),
  ];
  for (const pattern of patterns) {
    for (const match of lockfileText.matchAll(pattern)) {
      versions.add(match[1]);
    }
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

describe("HTTP framework security pins (hono, @hono/node-server, vite)", () => {
  it("declares patched floors in pnpm overrides and direct dependencies", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.pnpm.overrides.hono).toBe(`>=${SECURE_HONO_VERSION}`);
    expect(packageJson.pnpm.overrides["@hono/node-server"]).toBe(`>=${SECURE_HONO_NODE_SERVER_VERSION}`);
    expect(packageJson.pnpm.overrides.vite).toBe(`^${SECURE_VITE_VERSION}`);
    expect(packageJson.dependencies.hono).toBe(`^${SECURE_HONO_VERSION}`);
    expect(packageJson.dependencies["@hono/node-server"]).toBe(`^${SECURE_HONO_NODE_SERVER_VERSION}`);
    expect(packageJson.devDependencies.vite).toBe(`^${SECURE_VITE_VERSION}`);
  });

  it("resolves hono, @hono/node-server, and vite to patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const pinnedPackages: Array<{ name: string; floor: string }> = [
      { name: "hono", floor: SECURE_HONO_VERSION },
      { name: "@hono/node-server", floor: SECURE_HONO_NODE_SERVER_VERSION },
      { name: "vite", floor: SECURE_VITE_VERSION },
    ];

    for (const { name, floor } of pinnedPackages) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor), `${name}@${version} below ${floor}`).toBe(true);
      }
    }
  });

  it("documents patched runtime HTTP deps in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const shrinkwrapChecks: Array<{ name: string; floor: string }> = [
      { name: "hono", floor: SECURE_HONO_VERSION },
      { name: "@hono/node-server", floor: SECURE_HONO_NODE_SERVER_VERSION },
    ];

    for (const { name, floor } of shrinkwrapChecks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `missing ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version, floor), `${name}@${version} below ${floor}`).toBe(true);
    }
  });
});
