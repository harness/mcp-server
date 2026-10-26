import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parsePnpmLockPackageVersions,
  parseSemverTriple,
} from "./security-version-floor.js";

describe("security-version-floor helpers", () => {
  it("parses leading semver triple and ignores pre-release/build suffixes", () => {
    expect(parseSemverTriple("4.6.6")).toEqual([4, 6, 6]);
    expect(parseSemverTriple("4.6.6-beta.1")).toEqual([4, 6, 6]);
    expect(parseSemverTriple(" 10.7.4+build ")).toEqual([10, 7, 4]);
    expect(parseSemverTriple("not-semver")).toBeNull();
    expect(parseSemverTriple("")).toBeNull();
  });

  it("compares versions against a patch-level security floor", () => {
    expect(meetsVersionFloor("4.6.5", "4.6.6")).toBe(false);
    expect(meetsVersionFloor("4.6.6", "4.6.6")).toBe(true);
    expect(meetsVersionFloor("4.6.7", "4.6.6")).toBe(true);
    expect(meetsVersionFloor("5.0.0", "4.6.6")).toBe(true);
    expect(meetsVersionFloor("3.9.9", "4.6.6")).toBe(false);
    expect(meetsVersionFloor("4.5.99", "4.6.6")).toBe(false);
  });

  it("treats invalid versions as below the floor", () => {
    expect(meetsVersionFloor("", "4.6.6")).toBe(false);
    expect(meetsVersionFloor("v4.6.6", "4.6.6")).toBe(false);
    expect(meetsVersionFloor("4.6.6", "bad-floor")).toBe(false);
  });

  it("collects package versions from pnpm lockfile package keys", () => {
    const sample = `
packages:
  /zod@4.6.6:
    resolution: {integrity: x}
  zod@4.6.5:
    resolution: {integrity: y}
`;
    expect(parsePnpmLockPackageVersions(sample, "zod")).toEqual(["4.6.6", "4.6.5"]);
    expect(parsePnpmLockPackageVersions(sample, "missing-pkg")).toEqual([]);
  });
});
