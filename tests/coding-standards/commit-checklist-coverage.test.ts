/**
 * Maps docs/coding-standards.md Commit Checklist bullets to automated guardrails.
 * Fails CI when a new checklist item is added without wiring tests or marking manualOnly.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

type ChecklistEntry = {
  /** Substring that must appear in the Commit Checklist section */
  checklistMarker: string;
  /** Vitest files that enforce this item (empty when manualOnly) */
  tests: string[];
  /** Human review / CI scripts — not statically enforceable in src */
  manualOnly?: boolean;
};

/**
 * Keep in sync with ## Commit Checklist in docs/coding-standards.md.
 * When you add a checklist bullet, add a row here.
 */
const CHECKLIST_COVERAGE: ChecklistEntry[] = [
  {
    checklistMarker: "No new `server.registerTool()` calls",
    tests: ["tests/coding-standards/architecture.test.ts"],
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
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "Toolset files are pure data",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "All Zod params have `.describe()`",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
    ],
  },
  {
    checklistMarker: "Response extractors are from `extractors.ts`",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklistMarker: "Scope is declared correctly",
    tests: [
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    checklistMarker: "`identifierFields` are declared",
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    checklistMarker: "`operationPolicy` on every endpoint",
    tests: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    checklistMarker: "Write operations require confirmation",
    tests: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/error-handling.test.ts"],
  },
  {
    checklistMarker: "No secrets exposed",
    tests: [],
    manualOnly: true,
  },
  {
    checklistMarker: "`pnpm build` passes",
    tests: [],
    manualOnly: true,
  },
  {
    checklistMarker: "`pnpm typecheck` passes",
    tests: [],
    manualOnly: true,
  },
  {
    checklistMarker: "`pnpm test` passes",
    tests: [],
    manualOnly: true,
  },
  {
    checklistMarker: "`pnpm standards:check` passes",
    tests: ["tests/coding-standards/enforcement-map.test.ts"],
  },
];

function extractCommitChecklistSection(markdown: string): string {
  const start = markdown.indexOf("## Commit Checklist");
  if (start === -1) {
    throw new Error("Missing ## Commit Checklist in docs/coding-standards.md");
  }
  const end = markdown.indexOf("\n## ", start + 1);
  return end === -1 ? markdown.slice(start) : markdown.slice(start, end);
}

describe("Coding standards — commit checklist coverage", () => {
  const checklistSection = extractCommitChecklistSection(readFileSync(STANDARDS_PATH, "utf8"));

  it("every mapped checklist marker appears in docs/coding-standards.md Commit Checklist", () => {
    const missing = CHECKLIST_COVERAGE.filter(
      ({ checklistMarker }) => !checklistSection.includes(checklistMarker),
    ).map(({ checklistMarker }) => checklistMarker);

    expect(missing, `Update CHECKLIST_COVERAGE or restore checklist copy:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("every automated checklist item references existing guardrail test files", () => {
    const violations: string[] = [];

    for (const { checklistMarker, tests, manualOnly } of CHECKLIST_COVERAGE) {
      if (manualOnly) continue;
      if (tests.length === 0) {
        violations.push(`${checklistMarker}: no tests listed (set manualOnly or add guardrails)`);
        continue;
      }
      for (const testPath of tests) {
        if (!existsSync(join(REPO_ROOT, testPath))) {
          violations.push(`${checklistMarker}: missing ${testPath}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("documents at least one manual-only checklist item (secrets in API responses)", () => {
    const manual = CHECKLIST_COVERAGE.filter((e) => e.manualOnly);
    expect(manual.some((e) => e.checklistMarker.includes("No secrets exposed"))).toBe(true);
  });
});
