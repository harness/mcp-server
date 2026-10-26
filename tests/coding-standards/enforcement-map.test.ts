/**
 * Traceability from docs/coding-standards.md to enforcing Vitest suites.
 * - Architecture rules (§1–§11) → primary guardrail tests
 * - Commit checklist items → automated or manual enforcement map
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
    rule: "§1 Consolidated tool list SSOT",
    testFile: "consolidated-tools.test.ts",
    describeSnippet: "Coding standards — consolidated MCP tool list",
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
    rule: "Security regression test inventory",
    testFile: "security-regression-map.test.ts",
    describeSnippet: "Coding standards — security regression map",
  },
  {
    rule: "Commit checklist enforcement map",
    testFile: "enforcement-map.test.ts",
    describeSnippet: "Coding standards — commit checklist enforcement map",
  },
  {
    rule: "Architecture rule enforcement map",
    testFile: "enforcement-map.test.ts",
    describeSnippet: "Coding standards — architecture rule enforcement map",
  },
  {
    rule: "Structural validation across all toolsets",
    testFile: "../registry/structural-validation.test.ts",
    describeSnippet: "Toolset structural validation",
  },
];

type AutomatedEnforcement = {
  kind: "automated";
  /** Vitest files run by `pnpm standards:check` (or full test for build gates). */
  tests: readonly string[];
  /** Optional substring that must remain in the primary test file. */
  anchor?: string;
};

type ManualEnforcement = {
  kind: "manual";
  reason: string;
};

export const COMMIT_CHECKLIST_ENFORCEMENT: Record<
  string,
  AutomatedEnforcement | ManualEnforcement
> = {
  "No new `server.registerTool()` calls": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
    anchor: "only allows registerTool() in the 11 harness handler files",
  },
  "No `console.log()`": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
    anchor: "never uses console.log() in src/",
  },
  "No direct `fetch()` calls": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
    anchor: "only uses global fetch() in documented exception files",
  },
  "No new `harness-*.ts` handler files": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
    anchor: "does not add new harness-*.ts handler files",
  },
  "Toolset files are pure data": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
    anchor: "toolset files do not import HarnessClient, McpServer, or Registry",
  },
  "All Zod params have `.describe()` after `.optional()`/`.default()`": {
    kind: "automated",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    anchor: "tool handlers use .describe() after .optional()",
  },
  "Response extractors are from `extractors.ts`": {
    kind: "automated",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
    anchor: "does not add new inline responseExtractor functions in toolsets",
  },
  "Scope is declared correctly": {
    kind: "automated",
    tests: [
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
    ],
  },
  "`identifierFields` are declared": {
    kind: "automated",
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
    anchor: "every resource declares identifierFields",
  },
  "`operationPolicy` on every endpoint": {
    kind: "automated",
    tests: ["tests/coding-standards/registry-contract.test.ts"],
    anchor: "every endpoint spec declares operationPolicy",
  },
  "Write operations require confirmation": {
    kind: "automated",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    anchor: "confirmViaElicitation",
  },
  "No secrets exposed": {
    kind: "manual",
    reason: "Requires human review of extractors and handler formatting — not statically enforceable.",
  },
  "`pnpm build` passes": {
    kind: "automated",
    tests: [".github/workflows/ci.yml"],
    anchor: "pnpm build",
  },
  "`pnpm typecheck` passes": {
    kind: "automated",
    tests: [".github/workflows/ci.yml"],
    anchor: "pnpm typecheck",
  },
  "`pnpm test` passes": {
    kind: "automated",
    tests: [".github/workflows/ci.yml"],
    anchor: "pnpm test",
  },
  "`pnpm standards:check` passes": {
    kind: "automated",
    tests: [".github/workflows/ci.yml"],
    anchor: "pnpm standards:check",
  },
};

function readTestFile(relPath: string): string {
  const full = join(CODING_STANDARDS_DIR, relPath);
  const resolved = relPath.startsWith("../")
    ? join(REPO_ROOT, "tests", relPath.replace(/^\.\.\//, ""))
    : full;
  return readFileSync(resolved, "utf8");
}

describe("Coding standards — architecture rule enforcement map", () => {
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

    const mappedFiles = new Set(
      ENFORCEMENT_TARGETS.filter((t) => !t.testFile.startsWith("../")).map((t) => t.testFile),
    );
    for (const file of mappedFiles) {
      expect(testFiles, `missing coding-standards test file ${file}`).toContain(file);
    }

    const unmapped = testFiles.filter((file) => !mappedFiles.has(file));
    expect(unmapped, `add ENFORCEMENT_TARGETS for: ${unmapped.join(", ")}`).toEqual([]);
  });
});

describe("Coding standards — commit checklist enforcement map", () => {
  it("documents every commit checklist guardrail from docs/coding-standards.md", () => {
    const standards = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    const checklistSection = standards.slice(standards.indexOf("## Commit Checklist"));
    const checklistItems = [...checklistSection.matchAll(/^- \[ \] \*\*([^*]+)\*\*/gm)].map(
      (m) => m[1]!.trim(),
    );

    for (const item of checklistItems) {
      expect(
        COMMIT_CHECKLIST_ENFORCEMENT[item],
        `missing enforcement map entry for checklist item: ${item}`,
      ).toBeDefined();
    }
  });

  it("keeps automated enforcement tests present and anchored", () => {
    for (const [item, entry] of Object.entries(COMMIT_CHECKLIST_ENFORCEMENT)) {
      if (entry.kind === "manual") continue;

      for (const testPath of entry.tests) {
        const absolute = join(REPO_ROOT, testPath);
        expect(existsSync(absolute), `${item}: missing ${testPath}`).toBe(true);

        if (entry.anchor && testPath === entry.tests[0]) {
          const content = readFileSync(absolute, "utf8");
          expect(content, `${item}: anchor missing in ${testPath}`).toContain(entry.anchor);
        }
      }
    }
  });
});
