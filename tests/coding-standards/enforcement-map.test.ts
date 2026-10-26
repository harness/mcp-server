/**
 * Traceability map: docs/coding-standards.md rules → automated guardrail tests.
 * When adding a new architecture rule, add a test under tests/coding-standards/
 * (or structural-validation) and register it here.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Commit checklist / architecture rules from docs/coding-standards.md */
const RULE_TO_TEST_FILES: Record<string, string[]> = {
  "fixed-consolidated-mcp-tools": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/consolidated-tools.test.ts",
    "tests/coding-standards/consolidated-tools.ts",
  ],
  "toolset-pure-data": ["tests/coding-standards/architecture.test.ts"],
  "shared-response-extractors": ["tests/coding-standards/architecture.test.ts"],
  "harness-scoping-model": [
    "tests/coding-standards/toolset-scope.test.ts",
    "tests/coding-standards/scope-params.test.ts",
  ],
  "identifier-fields-and-metadata": ["tests/coding-standards/registry-metadata.test.ts"],
  "registry-endpoint-contracts": ["tests/coding-standards/registry-contract.test.ts"],
  "error-handling-pattern": ["tests/coding-standards/error-handling.test.ts"],
  "stderr-only-logging": ["tests/coding-standards/architecture.test.ts"],
  "tool-input-schema-conventions": [
    "tests/coding-standards/input-conventions.test.ts",
    "tests/coding-standards/registry-metadata.test.ts",
  ],
  "write-confirmation-and-elicitation": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/registry-metadata.test.ts",
  ],
  "singleton-http-client": ["tests/coding-standards/architecture.test.ts"],
  "file-organization": ["tests/coding-standards/file-organization.test.ts"],
  "documentation-consistency": ["tests/coding-standards/docs-consistency.test.ts"],
  "registry-structural-validation": ["tests/registry/structural-validation.test.ts"],
};

describe("Coding standards — enforcement map", () => {
  it("every documented rule has on-disk guardrail tests", () => {
    const missing: string[] = [];

    for (const [rule, files] of Object.entries(RULE_TO_TEST_FILES)) {
      for (const file of files) {
        const full = join(REPO_ROOT, file);
        if (!existsSync(full)) {
          missing.push(`${rule}: missing ${file}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("pnpm standards:check runs the coding-standards and structural-validation suites", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = pkg.scripts?.["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("structural-validation.test.ts");
  });

  it("CI workflow invokes pnpm standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("pnpm standards:check");
  });

  it("maps each rule to at least one guardrail test file", () => {
    const guardrailPrefix = /^tests\/(coding-standards|registry)\//;
    for (const [rule, files] of Object.entries(RULE_TO_TEST_FILES)) {
      const hasGuardrail = files.some((f) => guardrailPrefix.test(f) && f.endsWith(".test.ts"));
      expect(hasGuardrail, `${rule} has no .test.ts guardrail`).toBe(true);
    }
    const testFiles = Object.values(RULE_TO_TEST_FILES)
      .flat()
      .filter((f) => f.endsWith(".test.ts"));
    expect(new Set(testFiles).size).toBeGreaterThanOrEqual(10);
  });
});
