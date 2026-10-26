/**
 * Maps high-risk regression guard tests to the behavior they protect.
 * Fails when a guard file is removed or renamed without updating this map.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

const REGRESSION_GUARDS: Array<{ file: string; mustMatch: RegExp; risk: string }> = [
  {
    file: "tests/scripts/cve-dependency-pins.test.ts",
    mustMatch: /adm-zip/,
    risk: "transitive CVE dependency floors (body-parser, zod, adm-zip)",
  },
  {
    file: "tests/scripts/http-framework-security-pins.test.ts",
    mustMatch: /SECURE_HONO_VERSION/,
    risk: "HTTP framework CVE pins (hono, vite)",
  },
  {
    file: "tests/scripts/transitive-toolchain-security-pins.test.ts",
    mustMatch: /TRANSITIVE_PIN_FLOORS/,
    risk: "transitive toolchain CVE pins (picomatch, esbuild, postcss, nanoid)",
  },
  {
    file: "tests/scripts/adm-zip-security-lib.test.ts",
    mustMatch: /listInsecureAdmZipInstalls/,
    risk: "adm-zip traversal CVE postinstall enforcement",
  },
  {
    file: "tests/docker/production-dockerfile.test.ts",
    mustMatch: /ensure-secure-adm-zip/,
    risk: "Docker build/install order and Debian OpenSSL apt floors",
  },
  {
    file: "tests/registry/extractors-service-account.test.ts",
    mustMatch: /totalItems/,
    risk: "service account aggregate list pagination and flattening",
  },
  {
    file: "tests/registry/access-control-service-account.test.ts",
    mustMatch: /resource_scope.*account/,
    risk: "account/org scoped service account dispatch",
  },
];

describe("Regression guard enforcement map", () => {
  for (const guard of REGRESSION_GUARDS) {
    it(`keeps ${guard.file} covering ${guard.risk}`, () => {
      const path = join(REPO_ROOT, guard.file);
      expect(existsSync(path), `missing guard file ${guard.file}`).toBe(true);
      const source = readFileSync(path, "utf8");
      expect(source).toMatch(guard.mustMatch);
    });
  }
});
