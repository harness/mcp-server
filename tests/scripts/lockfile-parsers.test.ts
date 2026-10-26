import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./lockfile-parsers.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

describe("lockfile-parsers", () => {
  it("parses unquoted pnpm lock package keys", () => {
    const lock = `
packages:
  adm-zip@0.6.1:
    resolution: {integrity: x}
  body-parser@2.4.0(express@5.2.1):
    resolution: {integrity: y}
`;
    expect(parsePnpmLockPackageVersions(lock, "adm-zip")).toEqual(["0.6.1"]);
    expect(parsePnpmLockPackageVersions(lock, "body-parser")).toEqual(["2.4.0"]);
  });

  it("parses quoted scoped pnpm lock package keys", () => {
    const lock = `
packages:
  '@hono/node-server@2.0.10':
    resolution: {integrity: x}
  '@hono/node-server@2.0.11(hono@4.13.11)':
    resolution: {integrity: y}
`;
    expect(parsePnpmLockPackageVersions(lock, "@hono/node-server")).toEqual(["2.0.10", "2.0.11"]);
  });

  it("returns an empty list when the package is absent from the lockfile", () => {
    const lock = "packages:\n  zod@4.6.6:\n    resolution: {}\n";
    expect(parsePnpmLockPackageVersions(lock, "missing-pkg")).toEqual([]);
  });

  it("reads npm-shrinkwrap package versions from the packages map", () => {
    const shrinkwrap = JSON.stringify({
      packages: {
        "node_modules/zod": { version: "4.6.6" },
        "node_modules/express-rate-limit": { version: "8.7.1" },
      },
    });
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "zod")).toBe("4.6.6");
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "express-rate-limit")).toBe("8.7.1");
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "not-listed")).toBeNull();
  });

  it("parses patched packages from the committed pnpm-lock.yaml and npm-shrinkwrap.json", () => {
    const lockText = readFileSync(join(REPO_ROOT, "pnpm-lock.yaml"), "utf8");
    const shrinkwrapText = readFileSync(join(REPO_ROOT, "npm-shrinkwrap.json"), "utf8");

    expect(parsePnpmLockPackageVersions(lockText, "zod").length).toBeGreaterThan(0);
    expect(parsePnpmLockPackageVersions(lockText, "@hono/node-server").length).toBeGreaterThan(0);
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrapText, "zod")).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
