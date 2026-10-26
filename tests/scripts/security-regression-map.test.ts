/**
 * Maps security-sensitive production artifacts to the Vitest guardrails that
 * enforce them. Fails CI if a fix lands without a corresponding regression test.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityRegressionEntry = {
  /** Human label for CI failure messages */
  label: string;
  /** Repo paths that implement the security control */
  artifacts: string[];
  /** Vitest files that guard this behavior */
  tests: string[];
  /** Substring that must appear in at least one guard test */
  signal: string;
};

const SECURITY_REGRESSION_MAP: SecurityRegressionEntry[] = [
  {
    label: "Production Dockerfile Debian refresh, OpenSSL floor, ONNX runtime libs",
    artifacts: ["Dockerfile"],
    tests: ["tests/docker/production-dockerfile.test.ts"],
    signal: "DEBIAN_SECURITY_REFRESH",
  },
  {
    label: "CVE dependency pins (pnpm overrides, lockfile, node_modules)",
    artifacts: ["package.json", "pnpm-lock.yaml"],
    tests: ["tests/scripts/cve-dependency-pins.test.ts"],
    signal: "SECURE_IP_ADDRESS_VERSION",
  },
  {
    label: "HTTP framework security pins (hono, vite, @hono/node-server)",
    artifacts: ["package.json", "pnpm-lock.yaml"],
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
    signal: "SECURE_HONO_VERSION",
  },
  {
    label: "ip-address NAT64 / zone-identifier ReDoS floor",
    artifacts: ["scripts/ip-address-security-lib.mjs"],
    tests: ["tests/scripts/ip-address-security-lib.test.ts"],
    signal: "listInsecureIpAddressInstalls",
  },
  {
    label: "adm-zip CVE patch library and postinstall fallback",
    artifacts: ["scripts/adm-zip-security-lib.mjs", "scripts/ensure-secure-adm-zip.mjs"],
    tests: [
      "tests/scripts/adm-zip-security-lib.test.ts",
      "tests/scripts/adm-zip-postinstall.test.ts",
    ],
    signal: "ensureSecureAdmZip",
  },
  {
    label: "npm-shrinkwrap tree for global npm installs",
    artifacts: ["npm-shrinkwrap.json", "scripts/generate-npm-shrinkwrap.mjs"],
    tests: ["tests/scripts/npm-shrinkwrap-guardrails.test.ts"],
    signal: "generate-npm-shrinkwrap.mjs",
  },
  {
    label: "npm pack consumer path (verify-npm-adm-zip CI helper)",
    artifacts: ["scripts/verify-npm-adm-zip.mjs"],
    tests: ["tests/scripts/npm-publish-security-artifacts.test.ts"],
    signal: "verify-npm-adm-zip.mjs",
  },
  {
    label: "Service account aggregate list extractors and multi-scope dispatch",
    artifacts: ["src/registry/extractors.ts", "src/registry/toolsets/access-control.ts"],
    tests: [
      "tests/registry/extractors-service-account.test.ts",
      "tests/registry/access-control-service-account.test.ts",
    ],
    signal: "serviceAccountListExtract",
  },
];

describe("Security regression map", () => {
  it("every mapped security artifact exists on disk", () => {
    const missing: string[] = [];
    for (const { label, artifacts } of SECURITY_REGRESSION_MAP) {
      for (const artifact of artifacts) {
        const path = join(REPO_ROOT, artifact);
        if (!existsSync(path)) {
          missing.push(`${label}: ${artifact}`);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("every mapped guardrail test file exists on disk", () => {
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const { tests } of SECURITY_REGRESSION_MAP) {
      for (const testPath of tests) {
        if (seen.has(testPath)) continue;
        seen.add(testPath);
        if (!existsSync(join(REPO_ROOT, testPath))) {
          missing.push(testPath);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("every security control has a detectable signal in its guard tests", () => {
    const violations: string[] = [];
    for (const { label, tests, signal } of SECURITY_REGRESSION_MAP) {
      const found = tests.some((testPath) =>
        readFileSync(join(REPO_ROOT, testPath), "utf8").includes(signal),
      );
      if (!found) {
        violations.push(`${label}: signal "${signal}" not found in ${tests.join(", ")}`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
