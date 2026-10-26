/**
 * Ensures every pnpm security override stays backed by a regression test file.
 * Add a row here when introducing a new override floor in package.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();

type OverrideCoverage = {
  packageName: string;
  testFile: string;
  /** Stable substring that must remain in the enforcing test (usually the package id). */
  needle: string;
};

const OVERRIDE_COVERAGE: OverrideCoverage[] = [
  { packageName: "picomatch", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "picomatch" },
  { packageName: "hono", testFile: "tests/scripts/http-framework-security-pins.test.ts", needle: "hono" },
  { packageName: "path-to-regexp", testFile: "tests/scripts/express-stack-security-pins.test.ts", needle: "path-to-regexp" },
  { packageName: "@hono/node-server", testFile: "tests/scripts/http-framework-security-pins.test.ts", needle: "@hono/node-server" },
  { packageName: "express-rate-limit", testFile: "tests/scripts/cve-dependency-pins.test.ts", needle: "express-rate-limit" },
  { packageName: "ip-address", testFile: "tests/scripts/cve-dependency-pins.test.ts", needle: "ip-address" },
  { packageName: "vite", testFile: "tests/scripts/http-framework-security-pins.test.ts", needle: "vite" },
  { packageName: "nanoid", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "nanoid" },
  { packageName: "esbuild", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "esbuild" },
  { packageName: "postcss", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "postcss" },
  { packageName: "fast-uri", testFile: "tests/scripts/cve-dependency-pins.test.ts", needle: "fast-uri" },
  { packageName: "source-map-js", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "source-map-js" },
  { packageName: "body-parser", testFile: "tests/scripts/cve-dependency-pins.test.ts", needle: "body-parser" },
  { packageName: "zod", testFile: "tests/scripts/cve-dependency-pins.test.ts", needle: "zod" },
  { packageName: "sharp", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "sharp" },
  { packageName: "protobufjs", testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts", needle: "protobufjs" },
  { packageName: "adm-zip", testFile: "tests/scripts/cve-dependency-pins.test.ts", needle: "adm-zip" },
  {
    packageName: "@opentelemetry/core",
    testFile: "tests/scripts/transitive-toolchain-security-pins.test.ts",
    needle: "@opentelemetry/core",
  },
  { packageName: "qs", testFile: "tests/scripts/express-stack-security-pins.test.ts", needle: "qs" },
  { packageName: "proxy-addr", testFile: "tests/scripts/express-stack-security-pins.test.ts", needle: "proxy-addr" },
];

describe("Security regression map — pnpm override coverage", () => {
  it("maps every pnpm.overrides entry to a living regression test", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      pnpm: { overrides: Record<string, string> };
    };
    const overrideKeys = Object.keys(packageJson.pnpm.overrides).sort();
    const mappedKeys = [...new Set(OVERRIDE_COVERAGE.map((entry) => entry.packageName))].sort();

    expect(mappedKeys).toEqual(overrideKeys);

    const missing: string[] = [];
    for (const entry of OVERRIDE_COVERAGE) {
      const path = join(REPO_ROOT, entry.testFile);
      if (!existsSync(path)) {
        missing.push(`${entry.packageName}: missing ${entry.testFile}`);
        continue;
      }
      const content = readFileSync(path, "utf8");
      if (!content.includes(entry.needle)) {
        missing.push(`${entry.packageName}: ${entry.testFile} missing needle "${entry.needle}"`);
      }
    }

    expect(missing).toEqual([]);
  });
});
