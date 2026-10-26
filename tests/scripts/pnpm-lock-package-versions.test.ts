import { describe, expect, it } from "vitest";
import { parsePnpmLockPackageVersions } from "./pnpm-lock-package-versions.js";

describe("parsePnpmLockPackageVersions", () => {
  it("reads unquoted package keys", () => {
    const lock = `
packages:
  body-parser@2.4.0:
    resolution: {integrity: sha512-example}
`;
    expect(parsePnpmLockPackageVersions(lock, "body-parser")).toEqual(["2.4.0"]);
  });

  it("reads quoted scoped package keys", () => {
    const lock = `
packages:
  '@hono/node-server@2.0.10':
    resolution: {integrity: sha512-example}
`;
    expect(parsePnpmLockPackageVersions(lock, "@hono/node-server")).toEqual(["2.0.10"]);
  });

  it("ignores peer-dependency suffixes on the package key", () => {
    const lock = `
packages:
  express-rate-limit@8.3.2(express@5.2.1):
    resolution: {integrity: sha512-example}
  '@modelcontextprotocol/sdk@1.32.1(zod@4.6.7)':
    resolution: {integrity: sha512-example}
`;
    expect(parsePnpmLockPackageVersions(lock, "express-rate-limit")).toEqual(["8.3.2"]);
    expect(parsePnpmLockPackageVersions(lock, "@modelcontextprotocol/sdk")).toEqual(["1.32.1"]);
  });

  it("collects every distinct version when the lockfile lists multiple keys", () => {
    const lock = `
packages:
  zod@4.6.6:
    resolution: {integrity: sha512-a}
  zod@4.6.7:
    resolution: {integrity: sha512-b}
`;
    expect(parsePnpmLockPackageVersions(lock, "zod").sort()).toEqual(["4.6.6", "4.6.7"]);
  });
});
