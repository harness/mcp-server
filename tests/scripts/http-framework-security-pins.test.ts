/**
 * Regression guards for HTTP framework security bumps (#1144: Hono, Vite).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  meetsMinimum,
  parseMinimumOverride,
  pnpmLockResolvedVersions,
  shrinkwrapRootVersion,
} from "./security-version-floor.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("HTTP framework security pins — package.json", () => {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    pnpm: { overrides: Record<string, string> };
  };

  const overrides = packageJson.pnpm.overrides;

  it("keeps hono and @hono/node-server on patched releases", () => {
    const honoFloor = parseMinimumOverride(overrides.hono);
    expect(meetsMinimum("4.13.10", honoFloor)).toBe(false);
    expect(meetsMinimum("4.13.11", honoFloor)).toBe(true);

    const nodeServerFloor = parseMinimumOverride(overrides["@hono/node-server"]);
    expect(meetsMinimum("2.0.9", nodeServerFloor)).toBe(false);
    expect(meetsMinimum("2.0.10", nodeServerFloor)).toBe(true);

    expect(meetsMinimum(packageJson.dependencies.hono.replace(/^\^/, ""), honoFloor)).toBe(true);
    expect(
      meetsMinimum(packageJson.dependencies["@hono/node-server"].replace(/^\^/, ""), nodeServerFloor),
    ).toBe(true);
  });

  it("pins vite dev dependency and override on the patched 7.3.x line", () => {
    const viteOverrideFloor = parseMinimumOverride(overrides.vite);
    const viteDevFloor = parseMinimumOverride(packageJson.devDependencies.vite);
    expect(viteOverrideFloor).toBe(viteDevFloor);
    expect(meetsMinimum("7.3.6", viteOverrideFloor)).toBe(false);
    expect(meetsMinimum("7.3.7", viteOverrideFloor)).toBe(true);
  });
});

describe("HTTP framework security pins — lockfiles", () => {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    pnpm: { overrides: Record<string, string> };
  };
  const overrides = packageJson.pnpm.overrides;
  const pnpmLock = readFileSync(join(REPO_ROOT, "pnpm-lock.yaml"), "utf8");
  const shrinkwrap = JSON.parse(readFileSync(join(REPO_ROOT, "npm-shrinkwrap.json"), "utf8")) as {
    packages?: Record<string, { version?: string }>;
  };

  it("resolves hono and @hono/node-server at or above override floors in pnpm-lock.yaml", () => {
    const honoFloor = parseMinimumOverride(overrides.hono);
    const honoVersions = pnpmLockResolvedVersions(pnpmLock, "hono");
    expect(honoVersions.length).toBeGreaterThan(0);
    for (const version of honoVersions) {
      expect(meetsMinimum(version, honoFloor)).toBe(true);
    }

    const nodeServerFloor = parseMinimumOverride(overrides["@hono/node-server"]);
    for (const version of pnpmLockResolvedVersions(pnpmLock, "@hono/node-server")) {
      expect(meetsMinimum(version, nodeServerFloor)).toBe(true);
    }
  });

  it("resolves hono and @hono/node-server at or above override floors in npm-shrinkwrap.json", () => {
    const honoFloor = parseMinimumOverride(overrides.hono);
    const honoVersion = shrinkwrapRootVersion(shrinkwrap, "hono");
    expect(honoVersion).toBeDefined();
    expect(meetsMinimum(honoVersion!, honoFloor)).toBe(true);

    const nodeServerFloor = parseMinimumOverride(overrides["@hono/node-server"]);
    const nodeServerVersion = shrinkwrapRootVersion(shrinkwrap, "@hono/node-server");
    expect(nodeServerVersion).toBeDefined();
    expect(meetsMinimum(nodeServerVersion!, nodeServerFloor)).toBe(true);
  });
});
