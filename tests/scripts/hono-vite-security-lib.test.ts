import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SECURE_HONO_NODE_SERVER_VERSION,
  SECURE_HONO_VERSION,
  SECURE_VITE_VERSION,
  isAtLeastSemverVersion,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
  readPnpmOverrideFloors,
} from "../../scripts/hono-vite-security-lib.mjs";

const root = process.cwd();

describe("hono-vite-security-lib", () => {
  it("compares semver patch levels for security floors", () => {
    expect(isAtLeastSemverVersion("4.13.10", SECURE_HONO_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("4.13.11", SECURE_HONO_VERSION)).toBe(true);
    expect(isAtLeastSemverVersion("4.13.13", SECURE_HONO_VERSION)).toBe(true);

    expect(isAtLeastSemverVersion("7.3.6", SECURE_VITE_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("7.3.7", SECURE_VITE_VERSION)).toBe(true);
    expect(isAtLeastSemverVersion("7.4.0", SECURE_VITE_VERSION)).toBe(true);

    expect(isAtLeastSemverVersion("2.0.9", SECURE_HONO_NODE_SERVER_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("2.0.10", SECURE_HONO_NODE_SERVER_VERSION)).toBe(true);
  });

  it("treats missing or invalid versions as below the floor", () => {
    expect(isAtLeastSemverVersion(null, SECURE_HONO_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("", SECURE_VITE_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("not-a-version", SECURE_HONO_VERSION)).toBe(false);
  });

  it("keeps pnpm overrides and lockfile on patched Hono and Vite releases", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const floors = readPnpmOverrideFloors(packageJson);

    expect(floors.honoOverride).toBe(`>=${SECURE_HONO_VERSION}`);
    expect(floors.viteOverride).toBe(`^${SECURE_VITE_VERSION}`);
    expect(floors.honoNodeServerOverride).toBe(`>=${SECURE_HONO_NODE_SERVER_VERSION}`);
    expect(packageJson.dependencies.hono).toBe(`^${SECURE_HONO_VERSION}`);

    const lockText = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    for (const version of parsePnpmLockPackageVersions(lockText, "hono")) {
      expect(isAtLeastSemverVersion(version, SECURE_HONO_VERSION)).toBe(true);
    }
    for (const version of parsePnpmLockPackageVersions(lockText, "vite")) {
      expect(isAtLeastSemverVersion(version, SECURE_VITE_VERSION)).toBe(true);
    }
    for (const version of parsePnpmLockPackageVersions(lockText, "@hono/node-server")) {
      expect(isAtLeastSemverVersion(version, SECURE_HONO_NODE_SERVER_VERSION)).toBe(true);
    }
  });

  it("keeps npm-shrinkwrap production Hono on a patched release", () => {
    const shrinkwrapText = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const honoVersion = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "hono");
    const nodeServerVersion = parseNpmShrinkwrapPackageVersion(shrinkwrapText, "@hono/node-server");

    expect(honoVersion).not.toBeNull();
    expect(isAtLeastSemverVersion(honoVersion, SECURE_HONO_VERSION)).toBe(true);
    expect(nodeServerVersion).not.toBeNull();
    expect(isAtLeastSemverVersion(nodeServerVersion, SECURE_HONO_NODE_SERVER_VERSION)).toBe(true);
  });
});
