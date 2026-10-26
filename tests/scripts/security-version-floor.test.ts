import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parsePnpmLockPackageVersions,
  parseSemverTriple,
} from "./security-version-floor.js";

describe("security-version-floor helpers", () => {
  it("parses semver triples and ignores trailing labels", () => {
    expect(parseSemverTriple("4.13.11")).toEqual([4, 13, 11]);
    expect(parseSemverTriple(" 7.3.7-beta.1 ")).toEqual([7, 3, 7]);
    expect(parseSemverTriple("not-semver")).toBeNull();
  });

  it("compares patch levels against a floor", () => {
    expect(meetsVersionFloor("4.13.10", "4.13.11")).toBe(false);
    expect(meetsVersionFloor("4.13.11", "4.13.11")).toBe(true);
    expect(meetsVersionFloor("4.14.0", "4.13.11")).toBe(true);
    expect(meetsVersionFloor("3.9.99", "4.13.11")).toBe(false);
  });

  it("collects scoped and unscoped package versions from pnpm lock snippets", () => {
    const lock = `
packages:
  hono@4.13.11:
    resolution: {integrity: sha512-example}
  /@hono/node-server@2.0.10:
    resolution: {integrity: sha512-example}
  adm-zip@0.6.1:
    resolution: {integrity: sha512-example}
`;
    expect(parsePnpmLockPackageVersions(lock, "hono")).toEqual(["4.13.11"]);
    expect(parsePnpmLockPackageVersions(lock, "@hono/node-server")).toEqual(["2.0.10"]);
    expect(parsePnpmLockPackageVersions(lock, "adm-zip")).toEqual(["0.6.1"]);
  });
});
