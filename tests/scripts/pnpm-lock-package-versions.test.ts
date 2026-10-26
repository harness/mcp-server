import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  escapeRegExp,
  parsePnpmLockPackageVersions,
  readInstalledPackageVersion,
} from "./pnpm-lock-package-versions.js";

describe("parsePnpmLockPackageVersions", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("escapes regex metacharacters used in lockfile package keys", () => {
    expect(escapeRegExp("1.2.3")).toBe("1\\.2\\.3");
    expect(escapeRegExp("pkg+meta")).toBe("pkg\\+meta");
  });

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

  it("reads transitive packages from the pnpm virtual store", () => {
    const version = readInstalledPackageVersion(process.cwd(), "express-rate-limit");
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reads versions from .pnpm when the package is not linked at node_modules root", () => {
    const packageRoot = mkdtempSync(join(tmpdir(), "pnpm-lock-versions-"));
    tempDirs.push(packageRoot);
    const nested = join(
      packageRoot,
      "node_modules/.pnpm/transitive-only@9.8.7/node_modules/transitive-only",
    );
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, "package.json"), JSON.stringify({ name: "transitive-only", version: "9.8.7" }));

    expect(readInstalledPackageVersion(packageRoot, "transitive-only")).toBe("9.8.7");
  });
});
