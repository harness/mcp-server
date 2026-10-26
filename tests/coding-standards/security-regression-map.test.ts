/**
 * Living index: package.json pnpm.overrides CVE floors → enforcing regression tests.
 *
 * When you add or bump a security override, extend SECURITY_PIN_COVERAGE and the
 * referenced pin suite so CI fails if a floor ships without a guard.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

type SecurityPinEntry = {
  packageName: string;
  tests: string[];
};

/**
 * Every key in package.json `pnpm.overrides` must appear here exactly once.
 * Test paths are relative to the repo root.
 */
export const SECURITY_PIN_COVERAGE: SecurityPinEntry[] = [
  { packageName: "picomatch", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "hono", tests: ["tests/scripts/http-framework-security-pins.test.ts"] },
  { packageName: "path-to-regexp", tests: ["tests/scripts/express-stack-security-pins.test.ts"] },
  { packageName: "@hono/node-server", tests: ["tests/scripts/http-framework-security-pins.test.ts"] },
  { packageName: "express-rate-limit", tests: ["tests/scripts/cve-dependency-pins.test.ts"] },
  { packageName: "ip-address", tests: ["tests/scripts/cve-dependency-pins.test.ts", "tests/scripts/ip-address-security-lib.test.ts"] },
  { packageName: "vite", tests: ["tests/scripts/http-framework-security-pins.test.ts"] },
  { packageName: "nanoid", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "esbuild", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "postcss", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "fast-uri", tests: ["tests/scripts/cve-dependency-pins.test.ts"] },
  { packageName: "source-map-js", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "body-parser", tests: ["tests/scripts/cve-dependency-pins.test.ts"] },
  { packageName: "zod", tests: ["tests/scripts/cve-dependency-pins.test.ts"] },
  { packageName: "sharp", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "protobufjs", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "adm-zip", tests: ["tests/scripts/cve-dependency-pins.test.ts", "tests/scripts/adm-zip-supply-chain.test.ts", "tests/scripts/adm-zip-security-lib.test.ts"] },
  { packageName: "@opentelemetry/core", tests: ["tests/scripts/transitive-toolchain-security-pins.test.ts"] },
  { packageName: "qs", tests: ["tests/scripts/cve-dependency-pins.test.ts"] },
  { packageName: "proxy-addr", tests: ["tests/scripts/cve-dependency-pins.test.ts"] },
];

function readPackageOverrideKeys(): string[] {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    pnpm: { overrides: Record<string, string> };
  };
  return Object.keys(packageJson.pnpm.overrides).sort();
}

describe("Security regression — pnpm override coverage map", () => {
  it("maps every pnpm.overrides entry to at least one pin regression test file", () => {
    const overrideKeys = readPackageOverrideKeys();
    const mappedKeys = SECURITY_PIN_COVERAGE.map((entry) => entry.packageName).sort();

    expect(mappedKeys).toEqual(overrideKeys);

    for (const entry of SECURITY_PIN_COVERAGE) {
      expect(entry.tests.length, entry.packageName).toBeGreaterThan(0);
      for (const testPath of entry.tests) {
        const full = join(REPO_ROOT, testPath);
        expect(existsSync(full), `missing pin test for ${entry.packageName}: ${testPath}`).toBe(true);
        const source = readFileSync(full, "utf8");
        expect(
          source.includes(entry.packageName),
          `${testPath} should reference override package ${entry.packageName}`,
        ).toBe(true);
      }
    }
  });

  it("lists high-risk Express transitive pins explicitly (qs, proxy-addr, path-to-regexp)", () => {
    const expressStackPackages = new Set(
      SECURITY_PIN_COVERAGE.filter((entry) =>
        entry.tests.includes("tests/scripts/express-stack-security-pins.test.ts"),
      ).map((entry) => entry.packageName),
    );
    expect(expressStackPackages.has("path-to-regexp")).toBe(true);

    const cvePackages = new Set(
      SECURITY_PIN_COVERAGE.filter((entry) =>
        entry.tests.includes("tests/scripts/cve-dependency-pins.test.ts"),
      ).map((entry) => entry.packageName),
    );
    expect(cvePackages.has("qs")).toBe(true);
    expect(cvePackages.has("proxy-addr")).toBe(true);
  });
});
