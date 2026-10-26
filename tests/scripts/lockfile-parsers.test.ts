import { describe, expect, it } from "vitest";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./lockfile-parsers.js";

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
});
