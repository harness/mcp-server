/**
 * Inventory of security regression vitest guards. Prevents deleting or
 * orphaning CVE / lockfile / Docker checks during refactors.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Regression suites that must stay in the default vitest run (not e2e-only). */
export const SECURITY_REGRESSION_TEST_FILES = [
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/scripts/lockfile-parse.test.ts",
  "tests/docker/production-dockerfile.test.ts",
] as const;

/** pnpm.overrides keys that back the CVE pin suites above. */
const REQUIRED_PNPM_OVERRIDE_KEYS = [
  "adm-zip",
  "body-parser",
  "express-rate-limit",
  "fast-uri",
  "hono",
  "@hono/node-server",
  "ip-address",
  "path-to-regexp",
  "proxy-addr",
  "qs",
  "vite",
  "zod",
] as const;

describe("Coding standards — security regression map", () => {
  it("keeps every documented security regression test file in the repo", () => {
    for (const relativePath of SECURITY_REGRESSION_TEST_FILES) {
      const absolute = join(REPO_ROOT, relativePath);
      expect(existsSync(absolute), `missing security regression test: ${relativePath}`).toBe(true);
    }
  });

  it("declares patched dependency floors in pnpm.overrides", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };

    for (const key of REQUIRED_PNPM_OVERRIDE_KEYS) {
      const floor = packageJson.pnpm.overrides[key];
      expect(floor, `missing pnpm override for ${key}`).toBeTruthy();
      expect(floor).toMatch(/^>=|^[\^~]/);
    }
  });

  it("runs adm-zip postinstall and ships security scripts in the npm package", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      files: string[];
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });
});
