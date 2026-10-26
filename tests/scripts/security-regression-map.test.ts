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

/** Every vitest file that guards a security or supply-chain regression in this repo. */
const SECURITY_REGRESSION_TEST_FILES = [
  "tests/docker/production-dockerfile.test.ts",
  "tests/registry/access-control-service-account.test.ts",
  "tests/registry/extractors-service-account.test.ts",
  "tests/scripts/adm-zip-dependency-pins.test.ts",
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/http-framework-security-pins.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/utils/url-parser.test.ts",
] as const;

type SecurityRegressionEntry = {
  /** User-facing fix label (PR title or security theme) */
  fix: string;
  tests: readonly string[];
};

const SECURITY_REGRESSION_GUARDS: SecurityRegressionEntry[] = [
  {
    fix: "Production image Debian apt refresh and OpenSSL floor (#1154)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    fix: "Transitive CVE dependency pins (body-parser, zod, fast-uri, ip-address)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts", "tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    fix: "HTTP framework security pins (hono, @hono/node-server, vite)",
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    fix: "adm-zip postinstall patch and onnxruntime nested override",
    tests: [
      "tests/scripts/adm-zip-dependency-pins.test.ts",
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
  it("lists every dedicated security regression test file", () => {
    const mapped = new Set(SECURITY_REGRESSION_GUARDS.flatMap((entry) => entry.tests));
    const unmapped = SECURITY_REGRESSION_TEST_FILES.filter((path) => !mapped.has(path));
    expect(unmapped, `add map entry for:\n${unmapped.join("\n")}`).toEqual([]);
  });

  it("topic map references only known security regression test files", () => {
    const known = new Set<string>(SECURITY_REGRESSION_TEST_FILES);
    const unknown = SECURITY_REGRESSION_GUARDS.flatMap((entry) =>
      entry.tests.filter((path) => !known.has(path)),
    );
    expect(unknown, `unknown paths:\n${unknown.join("\n")}`).toEqual([]);
  });

  it("every security fix references at least one guardrail test file", () => {
    const missing = SECURITY_REGRESSION_GUARDS.filter((entry) => entry.tests.length === 0);
    expect(missing.map((entry) => entry.fix)).toEqual([]);
  });

  it("every referenced guardrail test file exists on disk", () => {
    const allTests = [...new Set(SECURITY_REGRESSION_GUARDS.flatMap((entry) => entry.tests))];
    const missing = allTests.filter((path) => !existsSync(join(REPO_ROOT, path)));
    expect(missing, `Missing security regression test files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("CI runs the full vitest suite (includes security regression guards)", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm test");
  });
});
