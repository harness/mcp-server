import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAtLeastSemverVersion,
  listSubMinimumPackageInstalls,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
  readPackageVersion,
  SECURE_HONO_VERSION,
  SECURE_VITE_VERSION,
} from "../../scripts/hono-vite-security-lib.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);

describe("hono-vite-security-lib", () => {
  it("compares semver patch levels for security floors", () => {
    expect(isAtLeastSemverVersion("4.13.10", SECURE_HONO_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("4.13.11", SECURE_HONO_VERSION)).toBe(true);
    expect(isAtLeastSemverVersion("4.13.13", SECURE_HONO_VERSION)).toBe(true);

    expect(isAtLeastSemverVersion("7.3.6", SECURE_VITE_VERSION)).toBe(false);
    expect(isAtLeastSemverVersion("7.3.7", SECURE_VITE_VERSION)).toBe(true);
    expect(isAtLeastSemverVersion("7.4.0", SECURE_VITE_VERSION)).toBe(true);
  });

  it("keeps pnpm overrides and lockfile on patched Hono and Vite releases", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.dependencies.hono).toBe(`^${SECURE_HONO_VERSION}`);
    expect(packageJson.devDependencies.vite).toBe(`^${SECURE_VITE_VERSION}`);
    expect(packageJson.pnpm.overrides.hono).toBe(`>=${SECURE_HONO_VERSION}`);
    expect(packageJson.pnpm.overrides.vite).toBe(`^${SECURE_VITE_VERSION}`);

    const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const honoVersions = parsePnpmLockPackageVersions(lockfile, "hono");
    const viteVersions = parsePnpmLockPackageVersions(lockfile, "vite");
    expect(honoVersions.length).toBeGreaterThan(0);
    expect(viteVersions.length).toBeGreaterThan(0);

    for (const version of honoVersions) {
      expect(isAtLeastSemverVersion(version, SECURE_HONO_VERSION)).toBe(true);
    }
    for (const version of viteVersions) {
      expect(isAtLeastSemverVersion(version, SECURE_VITE_VERSION)).toBe(true);
    }
  });

  it("keeps npm-shrinkwrap on a patched Hono release", () => {
    const shrinkwrap = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const honoVersion = parseNpmShrinkwrapPackageVersion(shrinkwrap, "hono");
    expect(honoVersion).not.toBeNull();
    expect(isAtLeastSemverVersion(honoVersion, SECURE_HONO_VERSION)).toBe(true);
  });

  it("flags vulnerable Hono and Vite installs under node_modules", () => {
    expect(listSubMinimumPackageInstalls(root, "hono", SECURE_HONO_VERSION)).toEqual([]);
    expect(listSubMinimumPackageInstalls(root, "vite", SECURE_VITE_VERSION)).toEqual([]);
  });

  it("loads the linked Hono runtime at or above the security floor", () => {
    const honoDir = join(root, "node_modules/hono");
    const version = readPackageVersion(honoDir);
    expect(version, "run pnpm install so node_modules/hono is present").not.toBeNull();
    expect(isAtLeastSemverVersion(version, SECURE_HONO_VERSION)).toBe(true);

    const hono = require(honoDir) as { Hono: new () => { get: (path: string, handler: () => string) => void } };
    expect(typeof hono.Hono).toBe("function");
  });
});
