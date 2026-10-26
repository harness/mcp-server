/**
 * Regression guards for transitive pnpm.overrides added during security hardening (#1154, #1157).
 * Direct deps are covered elsewhere; these packages often enter only via Express, OTel, or Vite trees.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

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
    versions.add(match[1]!);
  }

  const quotedScoped = new RegExp(
    `^\\s+'${escapeRegExp(packageName)}@([0-9]+\\.[0-9]+\\.[0-9]+)(?:\\([^)]*\\))?'?:`,
    "gm",
  );
  for (const match of lockfileText.matchAll(quotedScoped)) {
    versions.add(match[1]!);
  }

  return [...versions];
}

function floorFromOverride(override: string): string {
  const match = override.match(/>=?([0-9]+\.[0-9]+\.[0-9]+)/) ?? override.match(/\^([0-9]+\.[0-9]+\.[0-9]+)/);
  expect(match, `could not parse floor from override ${override}`).not.toBeNull();
  return match![1]!;
}

/** Mirrors package.json pnpm.overrides entries that only affect transitive installs. */
const TRANSITIVE_PIN_FLOORS: Record<string, string> = {
  "@opentelemetry/core": "2.8.0",
  "express-rate-limit": "8.2.2",
  picomatch: "4.0.4",
  "proxy-addr": "2.0.8",
  qs: "6.16.0",
  nanoid: "3.3.18",
  postcss: "8.5.18",
  "source-map-js": "1.2.2",
  sharp: "0.35.5",
  protobufjs: "8.6.0",
};

describe("transitive security pins (pnpm overrides → lockfile)", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    pnpm: { overrides: Record<string, string> };
  };
  const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

  it("declares patched floors for transitive-only overrides", () => {
    for (const [name, floor] of Object.entries(TRANSITIVE_PIN_FLOORS)) {
      const override = packageJson.pnpm.overrides[name];
      expect(override, `missing pnpm.overrides[${name}]`).toBeDefined();
      expect(floorFromOverride(override!)).toBe(floor);
    }
  });

  it("resolves only patched releases in pnpm-lock.yaml", () => {
    for (const [name, floor] of Object.entries(TRANSITIVE_PIN_FLOORS)) {
      const versions = parsePnpmLockPackageVersions(lockText, name);
      expect(versions.length, `expected ${name} entries in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of versions) {
        expect(isSecureIpAddressVersion(version, floor), `${name}@${version} < ${floor}`).toBe(true);
      }
    }
  });
});
