/**
 * Guards security-focused regression tests added for dependency and image CVE fixes.
 * Prevents deleting pin/Dockerfile enforcement without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Vitest files that lock security floors (deps, HTTP stack, container image). */
export const SECURITY_REGRESSION_TEST_FILES = [
  "tests/docker/production-dockerfile.test.ts",
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/express-stack-security-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/scripts/pnpm-lock-package-versions.test.ts",
] as const;

/** Shared helpers consumed by security pin tests — must stay on disk. */
const SECURITY_REGRESSION_HELPER_FILES = [
  "tests/scripts/pnpm-lock-package-versions.ts",
  "scripts/adm-zip-security-lib.mjs",
  "scripts/ensure-secure-adm-zip.mjs",
  "scripts/ip-address-security-lib.mjs",
] as const;

const REQUIRED_PNPM_OVERRIDE_KEYS = [
  "body-parser",
  "zod",
  "fast-uri",
  "ip-address",
  "express-rate-limit",
  "adm-zip",
  "qs",
  "proxy-addr",
  "path-to-regexp",
] as const;

describe("Security regression — enforcement map", () => {
  it("every security regression test file exists", () => {
    for (const rel of SECURITY_REGRESSION_TEST_FILES) {
      expect(existsSync(join(REPO_ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("every security regression helper file exists", () => {
    for (const rel of SECURITY_REGRESSION_HELPER_FILES) {
      expect(existsSync(join(REPO_ROOT, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it("package.json pnpm overrides retain floors for pinned CVE packages", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      pnpm?: { overrides?: Record<string, string> };
    };
    const overrides = packageJson.pnpm?.overrides ?? {};
    const missing = REQUIRED_PNPM_OVERRIDE_KEYS.filter((key) => overrides[key] === undefined);
    expect(missing, `missing pnpm overrides: ${missing.join(", ")}`).toEqual([]);
  });
});
