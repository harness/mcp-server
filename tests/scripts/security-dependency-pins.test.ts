/**
 * Regression guard for security-critical pnpm.overrides floors.
 *
 * PR #748 raised minimums for hono, fast-uri, and ip-address to patch
 * known advisories. This test ensures both lockfiles resolve versions at
 * or above the declared override floors so a future downgrade cannot slip
 * through unnoticed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

interface VersionParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

function parseVersion(version: string): VersionParts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    throw new Error(`Invalid semver: ${!a ? left : right}`);
  }
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function satisfiesMinimum(actual: string, minimum: string): boolean {
  return compareVersions(actual, minimum) >= 0;
}

function parseMinimumOverride(range: string): string | null {
  const gte = /^>=\s*(.+)$/.exec(range.trim());
  return gte ? gte[1]!.trim() : null;
}

function collectPnpmResolvedVersions(lockfileText: string): Map<string, string> {
  const versions = new Map<string, string>();
  const patterns = [
    /^\s{2}'((?:@[^']+\/)?[^']+)@(\d+\.\d+\.\d+[^']*)':/gm,
    /^\s{2}((?:@[^@\s/]+\/)?[^@\s/]+)@(\d+\.\d+\.\d+[^:\s]*):/gm,
  ];

  for (const pattern of patterns) {
    for (const match of lockfileText.matchAll(pattern)) {
      const name = match[1]!;
      const version = match[2]!;
      if (!parseVersion(version)) continue;
      const existing = versions.get(name);
      if (!existing || compareVersions(version, existing) > 0) {
        versions.set(name, version);
      }
    }
  }
  return versions;
}

function collectNpmShrinkwrapVersions(shrinkwrap: {
  packages?: Record<string, { version?: string }>;
}): Map<string, string> {
  const versions = new Map<string, string>();
  for (const [key, meta] of Object.entries(shrinkwrap.packages ?? {})) {
    if (!key.startsWith("node_modules/") || !meta.version) continue;
    const name = key.slice("node_modules/".length);
    versions.set(name, meta.version);
  }
  return versions;
}

describe("security dependency pins", () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    pnpm?: { overrides?: Record<string, string> };
  };
  const overrides = pkg.pnpm?.overrides ?? {};
  const minimumFloors = Object.fromEntries(
    Object.entries(overrides)
      .map(([name, range]) => [name, parseMinimumOverride(range)] as const)
      .filter((entry): entry is [string, string] => entry[1] !== null),
  );

  const pnpmVersions = collectPnpmResolvedVersions(
    readFileSync(join(REPO_ROOT, "pnpm-lock.yaml"), "utf8"),
  );
  const shrinkwrapVersions = collectNpmShrinkwrapVersions(
    JSON.parse(readFileSync(join(REPO_ROOT, "npm-shrinkwrap.json"), "utf8")),
  );

  const pr748Floors = {
    hono: minimumFloors.hono,
    "fast-uri": minimumFloors["fast-uri"],
    "ip-address": minimumFloors["ip-address"],
  };

  it("documents the PR #748 advisory floors in package.json overrides", () => {
    expect(pr748Floors.hono).toBe("4.12.34");
    expect(pr748Floors["fast-uri"]).toBe("4.1.2");
    expect(pr748Floors["ip-address"]).toBe("10.3.1");
  });

  it.each(Object.entries(pr748Floors))(
    "pnpm-lock.yaml resolves %s at or above >=%s",
    (name, minimum) => {
      const resolved = pnpmVersions.get(name);
      expect(resolved, `missing ${name} in pnpm-lock.yaml`).toBeTruthy();
      expect(
        satisfiesMinimum(resolved!, minimum),
        `${name} resolved to ${resolved}, expected >= ${minimum}`,
      ).toBe(true);
    },
  );

  it.each(Object.entries(pr748Floors))(
    "npm-shrinkwrap.json resolves %s at or above >=%s",
    (name, minimum) => {
      const resolved = shrinkwrapVersions.get(name);
      expect(resolved, `missing ${name} in npm-shrinkwrap.json`).toBeTruthy();
      expect(
        satisfiesMinimum(resolved!, minimum),
        `${name} resolved to ${resolved}, expected >= ${minimum}`,
      ).toBe(true);
    },
  );
});
