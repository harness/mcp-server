import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);

/** Transitive overrides from the Oct 2026 security patch (not covered by CVE/HTTP/Express suites). */
const TRANSITIVE_PIN_FLOORS: ReadonlyArray<{ name: string; override: string; floor: string }> = [
  { name: "picomatch", override: ">=4.0.4", floor: "4.0.4" },
  { name: "express-rate-limit", override: ">=8.2.2", floor: "8.2.2" },
  { name: "nanoid", override: "^3.3.18", floor: "3.3.18" },
  { name: "esbuild", override: ">=0.28.1", floor: "0.28.1" },
  { name: "postcss", override: ">=8.5.18", floor: "8.5.18" },
  { name: "source-map-js", override: ">=1.2.2", floor: "1.2.2" },
  { name: "sharp", override: ">=0.35.5", floor: "0.35.5" },
  { name: "protobufjs", override: ">=8.6.0", floor: "8.6.0" },
  { name: "@opentelemetry/core", override: ">=2.8.0", floor: "2.8.0" },
  { name: "qs", override: ">=6.16.0", floor: "6.16.0" },
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const versions = new Set<string>();

  const unquoted = new RegExp(
    `^\\s+${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(unquoted)) {
    versions.add(match[1]);
  }

  const quotedScoped = new RegExp(
    `^\\s+'${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?'?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(quotedScoped)) {
    versions.add(match[1]);
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

function readResolvedVersion(fromPackageJson: string, packageName: string): string {
  const parentRequire = createRequire(require.resolve(fromPackageJson));
  const packageJsonPath = parentRequire.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  expect(typeof manifest.version, `expected ${packageName} to expose a version in package.json`).toBe(
    "string",
  );
  return manifest.version!;
}

describe("Transitive security pins (toolchain, telemetry, Express stack)", () => {
  it("declares patched floors in pnpm overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const { name, override } of TRANSITIVE_PIN_FLOORS) {
      expect(packageJson.pnpm.overrides[name], name).toBe(override);
    }
  });

  it("resolves patched transitive releases in pnpm-lock.yaml", () => {
    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

    for (const { name, floor } of TRANSITIVE_PIN_FLOORS) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor), `${name}@${version} < ${floor}`).toBe(true);
      }
    }
  });

  it("documents global-install floors in npm-shrinkwrap.json where packaged", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const shrinkwrapChecks: Array<{ name: string; floor: string }> = [
      { name: "express-rate-limit", floor: "8.2.2" },
      { name: "protobufjs", floor: "8.6.0" },
      { name: "qs", floor: "6.16.0" },
      { name: "sharp", floor: "0.35.5" },
    ];

    for (const { name, floor } of shrinkwrapChecks) {
      const version = parseNpmShrinkwrapPackageVersion(shrinkwrapText, name);
      expect(version, `expected ${name} in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureIpAddressVersion(version, floor)).toBe(true);
    }
  });

  it("links patched copies on primary dependency chains after install", () => {
    const chainChecks: Array<{ name: string; floor: string; from: string }> = [
      { name: "qs", floor: "6.16.0", from: "express/package.json" },
      { name: "esbuild", floor: "0.28.1", from: "vite/package.json" },
      { name: "postcss", floor: "8.5.18", from: "vite/package.json" },
      { name: "picomatch", floor: "4.0.4", from: "vite/package.json" },
      { name: "nanoid", floor: "3.3.18", from: "vite/package.json" },
      { name: "source-map-js", floor: "1.2.2", from: "vite/package.json" },
      { name: "@opentelemetry/core", floor: "2.8.0", from: "@opentelemetry/sdk-trace-node/package.json" },
    ];

    for (const { name, floor, from } of chainChecks) {
      const version = readResolvedVersion(from, name);
      expect(isSecureIpAddressVersion(version, floor), `${name}@${version} < ${floor}`).toBe(true);
    }
  });
});
