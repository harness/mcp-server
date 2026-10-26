/**
 * Maps docs/coding-standards.md rules and commit checklist items to automated tests
 * so guardrails cannot silently disappear when files are renamed or deleted.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");

type EnforcementEntry = {
  rule: string;
  docSection: string;
  testFiles: string[];
};

/** Every automated rule in docs/coding-standards.md should appear here. */
export const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    rule: "Fixed consolidated MCP tools (no new registerTool handlers)",
    docSection: "§1",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Toolset definitions are pure data",
    docSection: "§2",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Shared response extractors (no new inline extractors)",
    docSection: "§3",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Harness scoping model on ResourceDefinition",
    docSection: "§4",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    rule: "identifierFields and registry metadata",
    docSection: "§5",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    rule: "Error handling (toMcpError / errorResult)",
    docSection: "§6",
    testFiles: [
      "tests/coding-standards/error-handling.test.ts",
      "tests/coding-standards/architecture.test.ts",
    ],
  },
  {
    rule: "Logging — no console.log in src/",
    docSection: "§7",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Tool input schema conventions (snake_case, pagination)",
    docSection: "§8",
    testFiles: [
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/scope-params.test.ts",
    ],
  },
  {
    rule: "Write safety (confirm + elicitation)",
    docSection: "§9",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    rule: "Singleton HarnessClient and controlled fetch()",
    docSection: "§10",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "File organization under src/tools/",
    docSection: "§11",
    testFiles: ["tests/coding-standards/file-organization.test.ts"],
  },
  {
    rule: "Documentation matches enforced architecture",
    docSection: "intro",
    testFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
];

/** Documented in coding-standards.md but not fully automatable. */
export const MANUAL_ONLY_STANDARDS = [
  "Never expose secret values in tool responses — only metadata",
  "Never auto-run pipelines without presenting execution plan to the user",
  "Rate limiting behavior under load (RateLimiter integration)",
] as const;

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

function fileHasTests(relativePath: string): boolean {
  const full = join(REPO_ROOT, relativePath);
  const content = readFileSync(full, "utf8");
  return /\bit\s*\(/.test(content) || /\bdescribe\s*\(/.test(content);
}

describe("Coding standards — enforcement map", () => {
  it(`maps every major docs/coding-standards.md rule to at least one test file`, () => {
    expect(ENFORCEMENT_MAP.length).toBeGreaterThanOrEqual(10);
  });

  it("every mapped test file exists and contains vitest cases", () => {
    const violations: string[] = [];

    for (const entry of ENFORCEMENT_MAP) {
      for (const testFile of entry.testFiles) {
        const full = join(REPO_ROOT, testFile);
        if (!existsSync(full)) {
          violations.push(`${entry.docSection} ${entry.rule}: missing ${testFile}`);
          continue;
        }
        if (!fileHasTests(testFile)) {
          violations.push(`${entry.docSection} ${entry.rule}: ${testFile} has no it()/describe()`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("consolidated tool count in SSOT matches docs (11 tools)", () => {
    const doc = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    expect(CONSOLIDATED_MCP_TOOL_COUNT).toBe(11);
    expect(doc).toMatch(/11 consolidated tool handlers/);
  });

  it("documents manual-only standards for reviewers", () => {
    expect(MANUAL_ONLY_STANDARDS.length).toBeGreaterThan(0);
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
