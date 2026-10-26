import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parseNpmShrinkwrapPackageVersions,
  parsePnpmLockPackageVersions,
  parseSemverTriple,
} from "./security-version-floor.js";

describe("security-version-floor helpers", () => {
  it("parses leading semver triples and ignores pre-release suffixes", () => {
    expect(parseSemverTriple("4.2.3")).toEqual([4, 2, 3]);
    expect(parseSemverTriple("4.2.3-beta.1")).toEqual([4, 2, 3]);
    expect(parseSemverTriple("not-a-version")).toBeNull();
  });

  it("compares major, minor, and patch for floors", () => {
    expect(meetsVersionFloor("4.2.2", "4.2.3")).toBe(false);
    expect(meetsVersionFloor("4.2.3", "4.2.3")).toBe(true);
    expect(meetsVersionFloor("4.3.0", "4.2.3")).toBe(true);
    expect(meetsVersionFloor("5.0.0", "4.2.3")).toBe(true);
  });

  it("collects scoped package versions from the pnpm lockfile packages section", () => {
    const sample = `
packages:
  /fast-uri@4.2.3:
    resolution: {integrity: sha512-example}
  /@hono/node-server@2.0.10:
    resolution: {integrity: sha512-example}
`;
    expect(parsePnpmLockPackageVersions(sample, "fast-uri")).toEqual(["4.2.3"]);
    expect(parsePnpmLockPackageVersions(sample, "@hono/node-server")).toEqual(["2.0.10"]);
  });

  it("collects package versions from npm-shrinkwrap node_modules paths", () => {
    const sample = JSON.stringify({
      packages: {
        "node_modules/fast-uri": { version: "4.2.3" },
        "node_modules/onnxruntime-node/node_modules/adm-zip": { version: "0.6.1" },
        "node_modules/adm-zip": { version: "0.6.1" },
      },
    });
    expect(parseNpmShrinkwrapPackageVersions(sample, "fast-uri")).toEqual(["4.2.3"]);
    expect(parseNpmShrinkwrapPackageVersions(sample, "adm-zip")).toEqual(["0.6.1", "0.6.1"]);
  });
});
