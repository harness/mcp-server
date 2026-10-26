/**
 * Traceability from docs/coding-standards.md rules to enforcing Vitest suites.
 * Prevents accidental removal of guardrails when refactoring tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type EnforcementTarget = {
  /** Human-readable rule label (matches docs/coding-standards.md sections). */
  rule: string;
  testFile: string;
  describeSnippet: string;
};

const ENFORCEMENT_TARGETS: EnforcementTarget[] = [
  {
    rule: "§1 Fixed consolidated MCP tool handlers",
    testFile: "architecture.test.ts",
    describeSnippet: "Coding standards — MCP tool handlers",
  },
  {
    rule: "§1 Consolidated tools manifest ↔ handler files",
    testFile: "consolidated-tools-sync.test.ts",
    describeSnippet: "Coding standards — consolidated tools manifest",
  },
  {
    rule: "§2 Pure-data toolset definitions",
    testFile: "architecture.test.ts",
    describeSnippet: "Coding standards — toolset purity",
  },
  {
    rule: "§3 Shared response extractors",
    testFile: "architecture.test.ts",
    describeSnippet: "does not add new inline responseExtractor functions in toolsets",
  },
  {
    rule: "§4 Harness scoping model",
    testFile: "toolset-scope.test.ts",
    describeSnippet: "Coding standards — toolset scope injection",
  },
  {
    rule: "§5 identifierFields and registry metadata",
    testFile: "registry-metadata.test.ts",
    describeSnippet: "Coding standards — registry metadata",
  },
  {
    rule: "§6 Error handling pattern",
    testFile: "error-handling.test.ts",
    describeSnippet: "Coding standards — error handling pattern",
  },
  {
    rule: "§7 Logging (no console.log / stderr-only)",
    testFile: "architecture.test.ts",
    describeSnippet: "Coding standards — logging and HTTP",
  },
  {
    rule: "§8 Tool input schema conventions",
    testFile: "input-conventions.test.ts",
    describeSnippet: "Coding standards — tool input conventions",
  },
  {
    rule: "§9 Write safety (confirm + elicitation)",
    testFile: "registry-metadata.test.ts",
    describeSnippet: "Coding standards — write handler safety",
  },
  {
    rule: "§11 Singleton HarnessClient and fetch exceptions",
    testFile: "architecture.test.ts",
    describeSnippet: "instantiates HarnessClient only in src/index.ts",
  },
  {
    rule: "§11 File organization (src/tools fixed)",
    testFile: "file-organization.test.ts",
    describeSnippet: "Coding standards — file organization",
  },
  {
    rule: "Registry ALL_TOOLSETS ↔ ToolsetName union",
    testFile: "architecture.test.ts",
    describeSnippet: "Coding standards — registry registration",
  },
  {
    rule: "Resource contract (scope, operationPolicy, extractors)",
    testFile: "registry-contract.test.ts",
    describeSnippet: "Coding standards — registry resource contract",
  },
  {
    rule: "Scope params on dispatch handlers",
    testFile: "scope-params.test.ts",
    describeSnippet: "Coding standards — scope params on dispatch handlers",
  },
  {
    rule: "Docs ↔ enforced tool count and Zod v4",
    testFile: "docs-consistency.test.ts",
    describeSnippet: "Coding standards — documentation consistency",
  },
  {
    rule: "Structural validation across all toolsets",
    testFile: "../registry/structural-validation.test.ts",
    describeSnippet: "Toolset structural validation",
  },
  {
    rule: "Automated enforcement map traceability",
    testFile: "enforcement-map.test.ts",
    describeSnippet: "Coding standards — enforcement map",
  },
];

function readTestFile(relPath: string): string {
  const full = join(CODING_STANDARDS_DIR, relPath);
  const resolved = relPath.startsWith("../")
    ? join(REPO_ROOT, "tests", relPath.replace(/^\.\.\//, ""))
    : full;
  return readFileSync(resolved, "utf8");
}

describe("Coding standards — enforcement map", () => {
  it("every documented architecture rule has an enforcing test target on disk", () => {
    const missing: string[] = [];

    for (const { rule, testFile, describeSnippet } of ENFORCEMENT_TARGETS) {
      const resolved = testFile.startsWith("../")
        ? join(REPO_ROOT, "tests", testFile.replace(/^\.\.\//, ""))
        : join(CODING_STANDARDS_DIR, testFile);

      if (!existsSync(resolved)) {
        missing.push(`${rule}: missing file ${testFile}`);
        continue;
      }

      const content = readTestFile(testFile);
      if (!content.includes(describeSnippet)) {
        missing.push(`${rule}: ${testFile} missing snippet "${describeSnippet}"`);
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("pnpm standards:check includes every tests/coding-standards/*.test.ts file", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const script = pkg.scripts?.["standards:check"] ?? "";

    const testFiles = readdirSync(CODING_STANDARDS_DIR)
      .filter((f) => f.endsWith(".test.ts"))
      .sort();

    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("structural-validation.test.ts");

    expect(script).toMatch(/tests\/coding-standards/);

    const localTargets = new Set(
      ENFORCEMENT_TARGETS.filter((t) => !t.testFile.startsWith("../")).map((t) => t.testFile),
    );
    for (const file of localTargets) {
      expect(testFiles, `missing coding-standards test file ${file}`).toContain(file);
    }

    const unmapped = testFiles.filter((file) => !localTargets.has(file));
    expect(unmapped, `add ENFORCEMENT_TARGETS for: ${unmapped.join(", ")}`).toEqual([]);
  });
});
