import { describe, expect, it } from "vitest";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
  parsePnpmLockPackageVersionsLoose,
} from "./lockfile-parse.js";

describe("lockfile-parse helpers", () => {
  it("parses unscoped pnpm lock package lines", () => {
    const lock = `
  body-parser@2.4.0:
    resolution: {integrity: sha512-abc}
  zod@4.6.6:
    resolution: {integrity: sha512-def}
`;
    expect(parsePnpmLockPackageVersions(lock, "body-parser")).toEqual(["2.4.0"]);
    expect(parsePnpmLockPackageVersions(lock, "zod")).toEqual(["4.6.6"]);
    expect(parsePnpmLockPackageVersions(lock, "missing")).toEqual([]);
  });

  it("parses scoped pnpm lock package lines", () => {
    const lock = `
  '@hono/node-server@2.0.10':
    resolution: {integrity: sha512-ghi}
`;
    expect(parsePnpmLockPackageVersions(lock, "@hono/node-server")).toEqual(["2.0.10"]);
  });

  it("parses importer dependency spec lines with peer suffixes", () => {
    const lock = `
      express-rate-limit: 8.3.2(express@5.2.1)
  express-rate-limit@8.3.2(express@5.2.1):
    resolution: {integrity: sha512-jkl}
`;
    expect(parsePnpmLockPackageVersionsLoose(lock, "express-rate-limit")).toEqual(["8.3.2"]);
  });

  it("reads npm-shrinkwrap node_modules package versions", () => {
    const shrinkwrap = JSON.stringify({
      packages: {
        "node_modules/ip-address": { version: "10.7.4" },
        "node_modules/@hono/node-server": { version: "2.0.10" },
      },
    });
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "ip-address")).toBe("10.7.4");
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "@hono/node-server")).toBe("2.0.10");
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "missing")).toBeNull();
  });

  it("returns null when shrinkwrap JSON has no packages map", () => {
    expect(parseNpmShrinkwrapPackageVersion("{}", "zod")).toBeNull();
  });
});
