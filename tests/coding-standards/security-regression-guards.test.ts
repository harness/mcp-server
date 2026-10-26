/**
 * Maps security regression guard tests to the production artifacts they protect.
 * Fails when a guard file is removed or stops referencing its protected surface.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityGuard = {
  label: string;
  testPath: string;
  anchors: string[];
};

const SECURITY_GUARDS: SecurityGuard[] = [
  {
    label: "CVE dependency pins",
    testPath: "tests/scripts/cve-dependency-pins.test.ts",
    anchors: ["package.json", "pnpm-lock.yaml", "npm-shrinkwrap.json", "ip-address"],
  },
  {
    label: "HTTP framework pins",
    testPath: "tests/scripts/http-framework-security-pins.test.ts",
    anchors: ["hono", "pnpm-lock.yaml", "npm-shrinkwrap.json"],
  },
  {
    label: "adm-zip pins",
    testPath: "tests/scripts/adm-zip-dependency-pins.test.ts",
    anchors: ["ensure-secure-adm-zip.mjs", "onnxruntime-node", "adm-zip"],
  },
  {
    label: "ip-address security lib",
    testPath: "tests/scripts/ip-address-security-lib.test.ts",
    anchors: ["ip-address-security-lib.mjs", "SECURE_IP_ADDRESS_VERSION"],
  },
  {
    label: "adm-zip security lib",
    testPath: "tests/scripts/adm-zip-security-lib.test.ts",
    anchors: ["adm-zip-security-lib.mjs", "SECURE_ADM_ZIP_VERSION"],
  },
  {
    label: "production Dockerfile Debian/OpenSSL",
    testPath: "tests/docker/production-dockerfile.test.ts",
    anchors: ["DEBIAN_SECURITY_REFRESH", "libssl3", "Dockerfile"],
  },
  {
    label: "Dockerfile adm-zip postinstall",
    testPath: "tests/docker/dockerfile-adm-zip-postinstall.test.ts",
    anchors: ["ensure-secure-adm-zip.mjs", "pnpm install", "Dockerfile"],
  },
  {
    label: "pnpm lock version parser",
    testPath: "tests/scripts/pnpm-lock-package-versions.test.ts",
    anchors: ["parsePnpmLockPackageVersions", "parseNpmShrinkwrapPackageVersion"],
  },
  {
    label: "service account list extractor",
    testPath: "tests/registry/extractors-service-account.test.ts",
    anchors: ["serviceAccountListExtract", "totalItems"],
  },
];

describe("Coding standards — security regression guards", () => {
  for (const guard of SECURITY_GUARDS) {
    it(`${guard.label}: guard test exists and still anchors protected behavior`, () => {
      const absolute = join(REPO_ROOT, guard.testPath);
      expect(existsSync(absolute), `missing security guard: ${guard.testPath}`).toBe(true);

      const source = readFileSync(absolute, "utf8");
      for (const anchor of guard.anchors) {
        expect(source, `${guard.testPath} must reference ${anchor}`).toContain(anchor);
      }
    });
  }
});
