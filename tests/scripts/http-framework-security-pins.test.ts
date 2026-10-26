import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./pnpm-lock-package-versions.js";

const root = process.cwd();

const SECURE_HONO_VERSION = "4.13.11";
const SECURE_HONO_NODE_SERVER_VERSION = "2.0.10";
const SECURE_VITE_VERSION = "7.3.7";

function readInstalledPackageVersion(packageName: string): string {
  const packageJsonPath = join(root, "node_modules", packageName, "package.json");
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("HTTP framework security pins (hono, @hono/node-server, vite)", () => {
  it("declares patched floors in package.json and pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      pnpm: { overrides: Record<string, string> };
    };

    expect(packageJson.dependencies.hono).toBe(`^${SECURE_HONO_VERSION}`);
    expect(packageJson.dependencies["@hono/node-server"]).toBe(`^${SECURE_HONO_NODE_SERVER_VERSION}`);
    expect(packageJson.devDependencies.vite).toBe(`^${SECURE_VITE_VERSION}`);

    expect(packageJson.pnpm.overrides.hono).toBe(`>=${SECURE_HONO_VERSION}`);
    expect(packageJson.pnpm.overrides["@hono/node-server"]).toBe(`>=${SECURE_HONO_NODE_SERVER_VERSION}`);
    expect(packageJson.pnpm.overrides.vite).toBe(`^${SECURE_VITE_VERSION}`);
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "hono", floor: SECURE_HONO_VERSION },
      { name: "@hono/node-server", floor: SECURE_HONO_NODE_SERVER_VERSION },
      { name: "vite", floor: SECURE_VITE_VERSION },
    ];

    for (const { name, floor } of checks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });

  it("links patched copies under node_modules after install", () => {
    const checks: Array<{ name: string; floor: string }> = [
      { name: "hono", floor: SECURE_HONO_VERSION },
      { name: "@hono/node-server", floor: SECURE_HONO_NODE_SERVER_VERSION },
      { name: "vite", floor: SECURE_VITE_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = readInstalledPackageVersion(name);
      expectAtLeastFloor(version, floor, name);
    }
  });

  it("documents patched HTTP runtime deps in npm-shrinkwrap.json for global npm installs", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const checks: Array<{ name: string; floor: string }> = [
      { name: "hono", floor: SECURE_HONO_VERSION },
      { name: "@hono/node-server", floor: SECURE_HONO_NODE_SERVER_VERSION },
    ];

    for (const { name, floor } of checks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expectAtLeastFloor(version!, floor, name);
    }
  });
});
