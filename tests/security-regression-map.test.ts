/**
 * Index of security-focused regression suites. Fails if a guard file is removed
 * without updating this map (complements coding-standards enforcement-map).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..");

const SECURITY_REGRESSION_TESTS: { area: string; relativePath: string }[] = [
  { area: "CVE pnpm overrides and lockfile floors", relativePath: "tests/scripts/cve-dependency-pins.test.ts" },
  { area: "ip-address NAT64 / ReDoS floor helper", relativePath: "tests/scripts/ip-address-security-lib.test.ts" },
  { area: "adm-zip traversal patch library", relativePath: "tests/scripts/adm-zip-security-lib.test.ts" },
  { area: "adm-zip postinstall wiring", relativePath: "tests/scripts/ensure-secure-adm-zip-postinstall.test.ts" },
  { area: "npm-shrinkwrap drift check", relativePath: "tests/scripts/npm-shrinkwrap-check.test.ts" },
  { area: "Dockerfile build-time security", relativePath: "tests/docker/dockerfile-build-security.test.ts" },
  { area: "service account list extractor shapes", relativePath: "tests/registry/extractors-service-account.test.ts" },
  { area: "service account multi-scope dispatch", relativePath: "tests/registry/access-control-service-account.test.ts" },
];

describe("Security regression map", () => {
  it("every indexed guard suite exists on disk", () => {
    const missing = SECURITY_REGRESSION_TESTS.filter(
      ({ relativePath }) => !existsSync(join(REPO_ROOT, relativePath)),
    );
    expect(missing, missing.map((m) => m.relativePath).join("\n")).toEqual([]);
  });
});
