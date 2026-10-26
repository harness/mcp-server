import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
  parseSemverTriple,
} from "./security-version-floor.js";

describe("security-version-floor helpers", () => {
  describe("parseSemverTriple", () => {
    it("parses leading major.minor.patch and ignores pre-release suffix", () => {
      expect(parseSemverTriple("4.13.11")).toEqual([4, 13, 11]);
      expect(parseSemverTriple("  1.2.3-beta.1  ")).toEqual([1, 2, 3]);
    });

    it("returns null for non-semver strings", () => {
      expect(parseSemverTriple("")).toBeNull();
      expect(parseSemverTriple("v4")).toBeNull();
      expect(parseSemverTriple("not-a-version")).toBeNull();
    });
  });

  describe("meetsVersionFloor", () => {
    it("compares patch within the same major.minor line", () => {
      expect(meetsVersionFloor("4.6.6", "4.6.5")).toBe(true);
      expect(meetsVersionFloor("4.6.5", "4.6.6")).toBe(false);
      expect(meetsVersionFloor("4.6.6", "4.6.6")).toBe(true);
    });

    it("compares minor and major when they differ", () => {
      expect(meetsVersionFloor("5.0.0", "4.99.99")).toBe(true);
      expect(meetsVersionFloor("4.12.0", "4.13.0")).toBe(false);
      expect(meetsVersionFloor("4.13.11", "4.13.10")).toBe(true);
    });

    it("returns false when either side is not a semver triple", () => {
      expect(meetsVersionFloor("bad", "1.0.0")).toBe(false);
      expect(meetsVersionFloor("1.0.0", "")).toBe(false);
    });
  });

  describe("parsePnpmLockPackageVersions", () => {
    it("collects versions for unscoped and scoped package keys", () => {
      const lock = `
packages:
  /hono@4.13.11:
    resolution: {integrity: x}
  /@hono/node-server@2.0.10:
    resolution: {integrity: y}
  hono@4.12.0:
    resolution: {integrity: z}
`;
      expect(parsePnpmLockPackageVersions(lock, "hono").sort()).toEqual(["4.12.0", "4.13.11"]);
      expect(parsePnpmLockPackageVersions(lock, "@hono/node-server")).toEqual(["2.0.10"]);
    });
  });

  describe("parseNpmShrinkwrapPackageVersion", () => {
    it("reads from packages and legacy dependencies shapes", () => {
      const modern = JSON.stringify({
        packages: { "node_modules/express-rate-limit": { version: "8.7.1" } },
      });
      expect(parseNpmShrinkwrapPackageVersion(modern, "express-rate-limit")).toBe("8.7.1");

      const legacy = JSON.stringify({
        dependencies: { "express-rate-limit": { version: "8.2.2" } },
      });
      expect(parseNpmShrinkwrapPackageVersion(legacy, "express-rate-limit")).toBe("8.2.2");
    });

    it("returns null when the package is absent", () => {
      expect(parseNpmShrinkwrapPackageVersion("{}", "missing")).toBeNull();
    });
  });
});
