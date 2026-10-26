/**
 * Maps recent security / supply-chain fixes to regression guardrail tests.
 *
 * When bumping CVE floors, Docker bases, or postinstall patches, extend this map
 * and the referenced test files so `pnpm test` keeps catching accidental reverts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityRegressionEntry = {
  /** User-facing fix label (PR title or security theme) */
  fix: string;
  tests: string[];
};

const SECURITY_REGRESSION_GUARDS: SecurityRegressionEntry[] = [
  {
    fix: "Production image Debian apt refresh and OpenSSL floor (#1154)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    fix: "Transitive CVE dependency pins (body-parser, zod, fast-uri, ip-address, hono, vite)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts", "tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    fix: "adm-zip postinstall patch and onnxruntime nested override",
    tests: [
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/adm-zip-security-lib.test.ts",
    ],
  },
  {
    fix: "Service account list at account/org scope and aggregate flattening (#1152)",
    tests: [
      "tests/registry/access-control-service-account.test.ts",
      "tests/registry/extractors-service-account.test.ts",
      "tests/utils/url-parser.test.ts",
    ],
  },
];

describe("Security regression — enforcement map", () => {
  it("every security fix references at least one guardrail test file", () => {
    const missing = SECURITY_REGRESSION_GUARDS.filter((e) => e.tests.length === 0);
    expect(missing.map((e) => e.fix)).toEqual([]);
  });

  it("every referenced guardrail test file exists on disk", () => {
    const allTests = [...new Set(SECURITY_REGRESSION_GUARDS.flatMap((e) => e.tests))];
    const missing = allTests.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, `Missing security regression test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("CI runs the full vitest suite (includes security regression guards)", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm test");
  });
});
