import { describe, expect, it } from "vitest";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./lockfile-parse.js";

describe("lockfile-parse", () => {
  it("parses unscoped package versions from pnpm-lock.yaml fragments", () => {
    const sample = `
  qs@6.16.0:
    resolution: {integrity: sha512-abc}
  qs@6.15.2:
    resolution: {integrity: sha512-def}
`;
    expect(parsePnpmLockPackageVersions(sample, "qs").sort()).toEqual(["6.15.2", "6.16.0"]);
  });

  it("parses scoped package versions from pnpm-lock.yaml fragments", () => {
    const sample = `
  '@hono/node-server@2.0.12':
    resolution: {integrity: sha512-abc}
`;
    expect(parsePnpmLockPackageVersions(sample, "@hono/node-server")).toEqual(["2.0.12"]);
  });

  it("reads a package version from npm-shrinkwrap packages map", () => {
    const shrinkwrap = JSON.stringify({
      packages: {
        "node_modules/zod": { version: "4.6.7" },
      },
    });
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "zod")).toBe("4.6.7");
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "missing")).toBeNull();
  });
});
