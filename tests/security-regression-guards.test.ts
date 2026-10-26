import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/** Maps production/security artifacts to regression tests that must stay in sync. */
const SECURITY_REGRESSION_GUARDS: Array<{
  artifact: string;
  tests: Array<{ path: string; sourceHint: string }>;
}> = [
  {
    artifact: "package.json",
    tests: [
      { path: "tests/scripts/cve-dependency-pins.test.ts", sourceHint: "pnpm overrides" },
      { path: "tests/scripts/adm-zip-dependency-pins.test.ts", sourceHint: "pnpm overrides" },
    ],
  },
  {
    artifact: "pnpm-lock.yaml",
    tests: [
      { path: "tests/scripts/cve-dependency-pins.test.ts", sourceHint: "pnpm-lock.yaml" },
      { path: "tests/scripts/adm-zip-dependency-pins.test.ts", sourceHint: "pnpm-lock.yaml" },
    ],
  },
  {
    artifact: "npm-shrinkwrap.json",
    tests: [
      { path: "tests/scripts/cve-dependency-pins.test.ts", sourceHint: "npm-shrinkwrap.json" },
      { path: "tests/scripts/adm-zip-dependency-pins.test.ts", sourceHint: "npm-shrinkwrap.json" },
    ],
  },
  {
    artifact: "Dockerfile",
    tests: [{ path: "tests/docker/production-dockerfile.test.ts", sourceHint: "production Dockerfile" }],
  },
  {
    artifact: "scripts/ip-address-security-lib.mjs",
    tests: [{ path: "tests/scripts/ip-address-security-lib.test.ts", sourceHint: "ip-address-security-lib" }],
  },
  {
    artifact: "scripts/adm-zip-security-lib.mjs",
    tests: [
      { path: "tests/scripts/adm-zip-security-lib.test.ts", sourceHint: "adm-zip-security-lib" },
      { path: "tests/scripts/adm-zip-dependency-pins.test.ts", sourceHint: "adm-zip-security-lib" },
    ],
  },
  {
    artifact: "scripts/ensure-secure-adm-zip.mjs",
    tests: [{ path: "tests/scripts/adm-zip-security-lib.test.ts", sourceHint: "ensure-secure-adm-zip" }],
  },
  {
    artifact: "src/registry/extractors.ts",
    tests: [{ path: "tests/registry/extractors-service-account.test.ts", sourceHint: "serviceAccountListExtract" }],
  },
];

describe("security regression guard map", () => {
  it("keeps a regression test for every listed security artifact", () => {
    for (const guard of SECURITY_REGRESSION_GUARDS) {
      expect(existsSync(join(root, guard.artifact)), `missing artifact ${guard.artifact}`).toBe(true);
      for (const { path: testPath, sourceHint } of guard.tests) {
        const absolute = join(root, testPath);
        expect(existsSync(absolute), `missing guard test ${testPath} for ${guard.artifact}`).toBe(true);
        const source = readFileSync(absolute, "utf8");
        expect(
          source.includes(sourceHint),
          `${testPath} should mention "${sourceHint}" while guarding ${guard.artifact}`,
        ).toBe(true);
      }
    }
  });
});
