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
  {
    file: "tests/scripts/transitive-toolchain-security-pins.test.ts",
    mustMatch: /SECURE_PICOMATCH_VERSION/,
    risk: "Vite/bundler transitive CVE pins (picomatch, esbuild, postcss, nanoid)",
  },
  {
    file: "tests/scripts/express-stack-security-pins.test.ts",
    mustMatch: /SECURE_PATH_TO_REGEXP_VERSION/,
    risk: "Express middleware CVE pins (path-to-regexp, qs, proxy-addr)",
  },
  {
    file: "tests/scripts/npm-shrinkwrap-guardrails.test.ts",
    mustMatch: /generate-npm-shrinkwrap/,
    risk: "npm-shrinkwrap metadata drift and adm-zip floors for global npm installs",
  },
  {
    file: "tests/scripts/security-regression-map.test.ts",
    mustMatch: /SECURITY_REGRESSION_MAP/,
    risk: "security artifact to guardrail wiring",
  },
  {
    file: "tests/prompts/access-control-audit.test.ts",
    mustMatch: /resource_scope="account"/,
    risk: "access-control audit prompt account-level service account guidance",
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
