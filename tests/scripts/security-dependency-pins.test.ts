/**
 * Guards pnpm overrides and lockfile resolutions for Express-stack and HTTP
 * dependencies patched on fix/security-alerts-oct26. Prevents accidental downgrade
 * when refreshing the lockfile.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSecureIpAddressVersion } from "../../scripts/ip-address-security-lib.mjs";

const root = process.cwd();

/** Minimum resolved versions aligned with package.json pnpm.overrides floors. */
const PINNED_PACKAGES: Readonly<Record<string, string>> = {
  qs: "6.16.0",
  "proxy-addr": "2.0.8",
  "path-to-regexp": "8.4.0",
  hono: "4.13.11",
  vite: "7.3.7",
  "body-parser": "2.4.0",
};

function parsePnpmLockPackageVersions(lockfileText: string, packageName: string): string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versions = new Set<string>();
  for (const match of lockfileText.matchAll(
    new RegExp(`^\\s+${escaped}@([0-9]+\\.[0-9]+\\.[0-9]+):`, "gm"),
  )) {
    versions.add(match[1]!);
  }
  return [...versions];
}

function parseShrinkwrapVersion(shrinkwrapText: string, packageName: string): string | null {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const version = shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
  return typeof version === "string" ? version : null;
}

function satisfiesMinimum(resolved: string, minimum: string): boolean {
  return isSecureIpAddressVersion(resolved, minimum);
}

describe("security dependency pins", () => {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    pnpm?: { overrides?: Record<string, string> };
  };
  const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
  const shrinkwrap = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");

  it("documents security floors in package.json pnpm.overrides", () => {
    const overrides = packageJson.pnpm?.overrides ?? {};
    for (const [name, minimum] of Object.entries(PINNED_PACKAGES)) {
      const override = overrides[name];
      expect(override, `missing pnpm override for ${name}`).toBeTruthy();
      const floor = override!.replace(/^>=/, "").replace(/^\^/, "");
      expect(satisfiesMinimum(floor, minimum), `${name} override ${override} below ${minimum}`).toBe(
        true,
      );
    }
  });

  it("resolves patched versions in pnpm-lock.yaml", () => {
    const violations: string[] = [];
    for (const [name, minimum] of Object.entries(PINNED_PACKAGES)) {
      const resolved = parsePnpmLockPackageVersions(lockfile, name);
      expect(resolved.length, `no ${name} entry in pnpm-lock.yaml`).toBeGreaterThan(0);
      for (const version of resolved) {
        if (!satisfiesMinimum(version, minimum)) {
          violations.push(`${name}@${version} < ${minimum}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("keeps production shrinkwrap on patched Express HTTP stack packages", () => {
    const productionPins = ["qs", "proxy-addr", "path-to-regexp", "hono"] as const;
    const violations: string[] = [];

    for (const name of productionPins) {
      const version = parseShrinkwrapVersion(shrinkwrap, name);
      if (!version) {
        violations.push(`${name}: missing from npm-shrinkwrap.json`);
        continue;
      }
      if (!satisfiesMinimum(version, PINNED_PACKAGES[name])) {
        violations.push(`${name}@${version} < ${PINNED_PACKAGES[name]}`);
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
