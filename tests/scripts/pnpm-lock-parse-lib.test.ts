import { describe, expect, it } from "vitest";
import {
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "../../scripts/pnpm-lock-parse-lib.mjs";

describe("pnpm-lock-parse-lib", () => {
  it("parses unquoted keys with optional peer suffixes", () => {
    const sample = `
  body-parser@2.3.0:
    resolution: {integrity: old}
  body-parser@2.4.0(peer):
    resolution: {integrity: patched}
`;
    expect(parsePnpmLockPackageVersions(sample, "body-parser").sort()).toEqual(["2.3.0", "2.4.0"]);
  });

  it("parses quoted scoped package keys", () => {
    const sample = `
  '@hono/node-server@2.0.10':
    resolution: {integrity: patched}
  '@hono/node-server@2.0.9(typescript@5.7.3)':
    resolution: {integrity: old}
`;
    expect(parsePnpmLockPackageVersions(sample, "@hono/node-server").sort()).toEqual(
      ["2.0.9", "2.0.10"].sort(),
    );
  });

  it("reads shrinkwrap versions from packages, dependencies, or legacy paths", () => {
    const packagesOnly = JSON.stringify({
      packages: { "node_modules/zod": { version: "4.6.6" } },
    });
    expect(parseNpmShrinkwrapPackageVersion(packagesOnly, "zod")).toBe("4.6.6");

    const dependenciesOnly = JSON.stringify({
      dependencies: { "fast-uri": { version: "4.2.3" } },
    });
    expect(parseNpmShrinkwrapPackageVersion(dependenciesOnly, "fast-uri")).toBe("4.2.3");

    const legacy = JSON.stringify({
      "node_modules/body-parser": { version: "2.4.0" },
    });
    expect(parseNpmShrinkwrapPackageVersion(legacy, "body-parser")).toBe("2.4.0");

    expect(parseNpmShrinkwrapPackageVersion('{"packages":{}}', "missing")).toBeNull();
  });

  it("does not treat longer package names as a versioned lock entry", () => {
    const sample = `
  body-parser@2.4.0:
    resolution: {integrity: patched}
  body-parser-xml@2.0.0:
    resolution: {integrity: other}
`;
    expect(parsePnpmLockPackageVersions(sample, "body-parser")).toEqual(["2.4.0"]);
  });

  it("returns an empty list when the package is absent from the lockfile", () => {
    expect(parsePnpmLockPackageVersions("lockfileVersion: '9.0'\n", "not-installed")).toEqual([]);
  });
});
