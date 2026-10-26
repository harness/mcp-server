/**
 * Maps recent security fixes (dependency pins, container base image, postinstall
 * guards) to the Vitest files that must fail if those protections regress.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityRegressionEntry = {
  /** Human label for the fix or advisory class */
  area: string;
  /** Vitest files that guard this area (relative to repo root) */
  tests: string[];
};

const SECURITY_REGRESSION_GUARDS: SecurityRegressionEntry[] = [
  {
    area: "adm-zip postinstall hardening and lockfile pins",
    tests: [
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/docker/production-dockerfile.test.ts",
    ],
  },
  {
    area: "Debian OpenSSL / libpcre2 production image gates (Trivy)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    area: "body-parser, zod, fast-uri, ip-address dependency floors",
    tests: [
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/http-framework-security-pins.test.ts",
      "tests/scripts/ip-address-security-lib.test.ts",
    ],
  },
  {
    area: "service account aggregate list flattening (account/org scope lists)",
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
];

describe("Security regression guard map", () => {
  it("every mapped area references at least one guardrail test file", () => {
    const missing = SECURITY_REGRESSION_GUARDS.filter((entry) => entry.tests.length === 0);
    expect(missing.map((entry) => entry.area)).toEqual([]);
  });

  it("every referenced guardrail test file exists on disk", () => {
    const allTests = [...new Set(SECURITY_REGRESSION_GUARDS.flatMap((entry) => entry.tests))];
    const missing = allTests.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, `Missing security guard test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("postinstall still runs adm-zip hardening before dependency trees are trusted", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.postinstall).toContain("ensure-secure-adm-zip.mjs");
  });

  it("CI runs the full Vitest suite (includes security guard tests)", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/pnpm test/);
  });
});
