/**
 * Index of security / supply-chain regression suites (Docker, CVE pins, adm-zip, RBAC extractors).
 * Paths in STANDARDS_CHECK_PATHS must stay wired in package.json `standards:check`.
 */
export const STANDARDS_CHECK_PATHS = [
  "tests/docker/production-dockerfile.test.ts",
  "tests/scripts/cve-dependency-pins.test.ts",
  "tests/scripts/ensure-secure-adm-zip-postinstall.test.ts",
] as const;

/** Additional suites exercised by `pnpm test` — listed so CI drift is visible. */
export const FULL_TEST_SECURITY_PATHS = [
  "tests/scripts/adm-zip-security-lib.test.ts",
  "tests/scripts/ip-address-security-lib.test.ts",
  "tests/registry/extractors-service-account.test.ts",
  "tests/registry/access-control-service-account.test.ts",
] as const;

export const SECURITY_REGRESSION_SUITES: Array<{
  topic: string;
  tests: readonly string[];
}> = [
  {
    topic: "Production Docker image (Trivy / Debian OpenSSL floors)",
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    topic: "CVE dependency pin floors (lockfile + shrinkwrap)",
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
  },
  {
    topic: "adm-zip postinstall wiring and patch library",
    tests: [
      "tests/scripts/ensure-secure-adm-zip-postinstall.test.ts",
      "tests/scripts/adm-zip-security-lib.test.ts",
    ],
  },
  {
    topic: "ip-address transitive patch for npm consumers",
    tests: ["tests/scripts/ip-address-security-lib.test.ts"],
  },
  {
    topic: "Service account aggregate flattening and multi-scope list",
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
];
