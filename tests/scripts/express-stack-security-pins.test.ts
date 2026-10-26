import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./pnpm-lock-package-versions.js";

const root = process.cwd();
const require = createRequire(import.meta.url);

const SECURE_EXPRESS_RATE_LIMIT_VERSION = "8.2.2";
const SECURE_PATH_TO_REGEXP_VERSION = "8.4.0";
const SECURE_PROXY_ADDR_VERSION = "2.0.8";
const SECURE_QS_VERSION = "6.16.0";

/** Version loaded when Express resolves a nested dependency (proxy-addr, qs, path-to-regexp). */
function readExpressNestedDependencyVersion(dependencyName: string): string {
  const expressEntry = require.resolve("express", { paths: [root] });
  const expressRequire = createRequire(expressEntry);
  const entry = expressRequire.resolve(dependencyName);
  let dir = dirname(entry);
  while (true) {
    const manifestPath = join(dir, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === dependencyName && typeof manifest.version === "string") {
        return manifest.version;
      }
    }
    const parent = dirname(dir);
    expect(parent !== dir, `could not find package root for ${dependencyName}`).toBe(true);
    dir = parent;
  }
}

/** express-rate-limit is only linked under pnpm's virtual store (no top-level hoist). */
function readPnpmVirtualStorePackageVersion(packageName: string): string {
  const pnpmDir = join(root, "node_modules", ".pnpm");
  const prefix = `${packageName}@`;
  const storeDirs = readdirSync(pnpmDir).filter((name) => name.startsWith(prefix));
  expect(storeDirs.length, `expected ${packageName} under node_modules/.pnpm`).toBeGreaterThan(0);

  for (const storeDir of storeDirs) {
    const manifestPath = join(pnpmDir, storeDir, "node_modules", packageName, "package.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
    if (typeof manifest.version === "string") {
      return manifest.version;
    }
  }

  throw new Error(`no package.json for ${packageName} in pnpm virtual store`);
}

function expectAtLeastFloor(version: string, floor: string, label: string): void {
  expect(isSecureIpAddressVersion(version, floor), `${label}: ${version} < ${floor}`).toBe(true);
}

describe("Express stack security pins (express-rate-limit, path-to-regexp, proxy-addr, qs)", () => {
  const overrideChecks: Array<{ name: string; floor: string }> = [
    { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
    { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
    { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
    { name: "qs", floor: SECURE_QS_VERSION },
  ];

  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, floor } of overrideChecks) {
      expect(packageJson.pnpm.overrides[name]).toBe(`>=${floor}`);
    }
  });

  it("resolves patched releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of overrideChecks) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expectAtLeastFloor(version, floor, name);
      }
    }
  });

  it("documents patched Express transitive deps in npm-shrinkwrap.json", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const shrinkwrapChecks: Array<{ name: string; floor: string }> = [
      { name: "express-rate-limit", floor: SECURE_EXPRESS_RATE_LIMIT_VERSION },
      { name: "path-to-regexp", floor: SECURE_PATH_TO_REGEXP_VERSION },
      { name: "proxy-addr", floor: SECURE_PROXY_ADDR_VERSION },
    ];

    for (const { name, floor } of shrinkwrapChecks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expectAtLeastFloor(version!, floor, name);
    }
  });

  it("links patched copies under node_modules after install", () => {
    expectAtLeastFloor(
      readPnpmVirtualStorePackageVersion("express-rate-limit"),
      SECURE_EXPRESS_RATE_LIMIT_VERSION,
      "express-rate-limit",
    );
    expectAtLeastFloor(
      readExpressNestedDependencyVersion("path-to-regexp"),
      SECURE_PATH_TO_REGEXP_VERSION,
      "path-to-regexp",
    );
    expectAtLeastFloor(
      readExpressNestedDependencyVersion("proxy-addr"),
      SECURE_PROXY_ADDR_VERSION,
      "proxy-addr",
    );
    expectAtLeastFloor(readExpressNestedDependencyVersion("qs"), SECURE_QS_VERSION, "qs");
  });
});
