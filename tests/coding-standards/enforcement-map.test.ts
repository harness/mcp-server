/**
 * Maps docs/coding-standards.md "Commit Checklist" items to automated guardrails.
 * If you add a checklist bullet, add a row here and implement the test (or document a CI step).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

type EnforcementRow = {
  /** Substring that must appear in the Commit Checklist section of docs/coding-standards.md */
  checklistMarker: string;
  /** Vitest files (relative to repo root) that enforce this rule */
  tests: string[];
};

const COMMIT_CHECKLIST_ENFORCEMENT: EnforcementRow[] = [
  {
    checklistMarker: "No new `server.registerTool()` calls",
    tests: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/consolidated-tools.test.ts"],
  },
  {
    checklistMarker: "No `console.log()`",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "No direct `fetch()` calls",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "No new `harness-*.ts` handler files",
    tests: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/file-organization.test.ts"],
  },
  {
    checklistMarker: "Toolset files are pure data",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "All Zod params have `.describe()`",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
      "tests/tools/zod-input-schema-descriptions.test.ts",
    ],
  },
  {
    checklistMarker: "Response extractors are from `extractors.ts`",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "Scope is declared correctly",
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
    ],
  },
  {
    checklistMarker: "`identifierFields` are declared",
    tests: ["tests/coding-standards/registry-contract.test.ts", "tests/coding-standards/registry-metadata.test.ts"],
  },
  {
    checklistMarker: "`operationPolicy` on every endpoint",
    tests: ["tests/coding-standards/registry-contract.test.ts", "tests/registry/structural-validation.test.ts"],
  },
  {
    checklistMarker: "Write operations require confirmation",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/error-handling.test.ts",
    ],
  },
  {
    checklistMarker: "No secrets exposed",
    tests: ["tests/utils/redact.test.ts"],
  },
  {
    checklistMarker: "`pnpm standards:check` passes",
    tests: ["tests/coding-standards/docs-consistency.test.ts", "tests/coding-standards/ci-enforcement.test.ts"],
  },
  {
    checklistMarker: "`pnpm build` passes",
    tests: ["tests/coding-standards/ci-enforcement.test.ts"],
  },
  {
    checklistMarker: "`pnpm typecheck` passes",
    tests: ["tests/coding-standards/ci-enforcement.test.ts"],
  },
  {
    checklistMarker: "`pnpm test` passes",
    tests: ["tests/coding-standards/ci-enforcement.test.ts"],
  },
];

function commitChecklistSection(markdown: string): string {
  const start = markdown.indexOf("## Commit Checklist");
  if (start === -1) {
    throw new Error("Missing ## Commit Checklist in docs/coding-standards.md");
  }
  const end = markdown.indexOf("\n## ", start + 1);
  return end === -1 ? markdown.slice(start) : markdown.slice(start, end);
}

describe("Coding standards — commit checklist enforcement map", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const checklist = commitChecklistSection(standards);

  it("every mapped checklist item is documented in docs/coding-standards.md", () => {
    const missing: string[] = [];
    for (const row of COMMIT_CHECKLIST_ENFORCEMENT) {
      if (!checklist.includes(row.checklistMarker)) {
        missing.push(row.checklistMarker);
      }
    }
    expect(missing, `Update enforcement map or restore checklist text:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every mapped rule points at existing guardrail test files", () => {
    const missing: string[] = [];
    for (const row of COMMIT_CHECKLIST_ENFORCEMENT) {
      for (const testFile of row.tests) {
        const full = join(REPO_ROOT, testFile);
        if (!existsSync(full)) {
          missing.push(`${row.checklistMarker} → missing ${testFile}`);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("documents at least one automated guard per major checklist theme", () => {
    expect(COMMIT_CHECKLIST_ENFORCEMENT.length).toBeGreaterThanOrEqual(10);
  });
});
