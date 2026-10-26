import { describe, expect, it } from "vitest";
import { parseNpmShrinkwrapPackageVersion, parsePnpmLockPackageVersions } from "./lockfile-parse.js";

describe("lockfile-parse helpers", () => {
  it("collects pnpm lock versions for scoped and unscoped package keys", () => {
    const lock = `
  hono@4.13.11:
    resolution: {integrity: sha512-abc}
  '@hono/node-server@2.0.10':
    resolution: {integrity: sha512-def}
  qs@6.16.0:
    resolution: {integrity: sha512-ghi}
`;
    expect(parsePnpmLockPackageVersions(lock, "hono")).toEqual(["4.13.11"]);
    expect(parsePnpmLockPackageVersions(lock, "@hono/node-server")).toEqual(["2.0.10"]);
    expect(parsePnpmLockPackageVersions(lock, "qs")).toEqual(["6.16.0"]);
  });

  it("reads npm-shrinkwrap package versions from the packages map", () => {
    const shrinkwrap = JSON.stringify({
      packages: {
        "node_modules/qs": { version: "6.16.0" },
      },
    });
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "qs")).toBe("6.16.0");
    expect(parseNpmShrinkwrapPackageVersion(shrinkwrap, "missing")).toBeNull();
  });
});
