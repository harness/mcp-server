/**
 * Ensures every security guard test file is registered in security-regression-guards.ts
 * and that the map does not list duplicate test files across artifacts.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECURITY_REGRESSION_GUARDS } from "./security-regression-guards.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

const META_GUARD_TESTS = new Set([
  "tests/scripts/security-regression-guards.test.ts",
  "tests/scripts/security-regression-map.test.ts",
]);

function mappedGuardTests(): Set<string> {
  const mapped = new Set<string>();
  for (const row of SECURITY_REGRESSION_GUARDS) {
    for (const testFile of row.tests) {
      mapped.add(testFile);
    }
  }
  return mapped;
}

function discoverScriptGuardTests(): string[] {
  const scriptsDir = join(REPO_ROOT, "tests/scripts");
  return readdirSync(scriptsDir)
    .filter((name) => {
      if (!name.endsWith(".test.ts")) {
        return false;
      }
      return (
        name.includes("security") ||
        name.endsWith("-pins.test.ts") ||
        name === "npm-adm-zip-consumer-wiring.test.ts"
      );
    })
    .map((name) => `tests/scripts/${name}`);
}

describe("security regression guards — reverse coverage map", () => {
  it("registers every scripts/ dependency-pin and security guard test", () => {
    const mapped = mappedGuardTests();
    const unmapped: string[] = [];

    for (const testFile of discoverScriptGuardTests()) {
      if (META_GUARD_TESTS.has(testFile)) {
        continue;
      }
      if (!mapped.has(testFile)) {
        unmapped.push(testFile);
      }
    }

    expect(
      unmapped,
      `Add a row to tests/scripts/security-regression-guards.ts for:\n${unmapped.join("\n")}`,
    ).toEqual([]);
  });

  it("registers registry service-account guard tests from the Oct 2026 scope fix", () => {
    const mapped = mappedGuardTests();
    expect(mapped.has("tests/registry/extractors-service-account.test.ts")).toBe(true);
    expect(mapped.has("tests/registry/access-control-service-account.test.ts")).toBe(true);
  });

  it("lists each guard test file under exactly one artifact", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const row of SECURITY_REGRESSION_GUARDS) {
      for (const testFile of row.tests) {
        if (seen.has(testFile)) {
          duplicates.push(`${testFile} mapped by both "${seen.get(testFile)}" and "${row.artifact}"`);
        } else {
          seen.set(testFile, row.artifact);
        }
      }
    }
    expect(duplicates, duplicates.join("\n")).toEqual([]);
  });
});
