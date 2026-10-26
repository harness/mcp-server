/**
 * Maps security-sensitive repo artifacts to regression tests.
 * Prevents removing or orphaning guard tests when dependency/container pins change.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityGuard = {
  label: string;
  artifacts: string[];
  tests: string[];
};

const SECURITY_GUARDS: SecurityGuard[] = [
  {
    label: "production container / Debian OpenSSL",
    artifacts: ["Dockerfile"],
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    label: "adm-zip postinstall and security lib",
    artifacts: [
      "scripts/adm-zip-security-lib.mjs",
      "scripts/ensure-secure-adm-zip.mjs",
      "package.json",
      "npm-shrinkwrap.json",
    ],
    tests: [
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/docker/production-dockerfile.test.ts",
    ],
  },
  {
    label: "ip-address semver helper",
    artifacts: ["scripts/ip-address-security-lib.mjs"],
    tests: [
      "tests/scripts/ip-address-security-lib.test.ts",
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/express-rate-limit-security-pins.test.ts",
      "tests/scripts/http-framework-security-pins.test.ts",
    ],
  },
  {
    label: "HTTP framework dependency pins",
    artifacts: ["package.json", "pnpm-lock.yaml"],
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    label: "express-rate-limit dependency pin",
    artifacts: ["package.json", "pnpm-lock.yaml", "npm-shrinkwrap.json"],
    tests: ["tests/scripts/express-rate-limit-security-pins.test.ts"],
  },
  {
    label: "CVE floors (body-parser, zod, fast-uri, ip-address, adm-zip)",
    artifacts: ["package.json", "pnpm-lock.yaml", "npm-shrinkwrap.json"],
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
  },
  {
    label: "service account multi-scope list extractors",
    artifacts: ["src/registry/extractors.ts", "src/registry/toolsets/access-control.ts"],
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
  },
];

function repoPath(relative: string): string {
  return join(REPO_ROOT, relative);
}

describe("Coding standards — security regression guard coverage", () => {
  for (const guard of SECURITY_GUARDS) {
    it(`keeps tests for ${guard.label}`, () => {
      for (const artifact of guard.artifacts) {
        expect(existsSync(repoPath(artifact)), `missing artifact ${artifact}`).toBe(true);
      }
      for (const testFile of guard.tests) {
        expect(existsSync(repoPath(testFile)), `missing guard test ${testFile}`).toBe(true);
      }
    });
  }

  it("ships adm-zip postinstall scripts in the npm package and wires postinstall", () => {
    const packageJson = JSON.parse(readFileSync(repoPath("package.json"), "utf8")) as {
      files?: string[];
      scripts?: Record<string, string>;
    };

    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
        "npm-shrinkwrap.json",
      ]),
    );
    expect(packageJson.scripts?.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
  });
});
