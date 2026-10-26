/**
 * Maps docs/coding-standards.md commit checklist bullets to automated tests or CI.
 *
 * Fails when a new checklist item is added to the doc without updating this map,
 * so architecture rules do not rely on memory alone at PR time.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW_PATH = join(REPO_ROOT, ".github/workflows/ci.yml");

type ChecklistCoverage =
  | { kind: "automated"; tests: string[] }
  | { kind: "manual"; note: string }
  | { kind: "ci"; workflowSteps: string[] };

/**
 * Keys must appear verbatim in docs/coding-standards.md commit checklist bold labels.
 * Keep in sync with the "## Commit Checklist" section.
 */
const CHECKLIST_COVERAGE: Record<string, ChecklistCoverage> = {
  "No new `server.registerTool()` calls": {
    kind: "automated",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
    ],
  },
  "No `console.log()`": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "No direct `fetch()` calls": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "No new `harness-*.ts` handler files": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "Toolset files are pure data": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "All Zod params have `.describe()` after `.optional()`/`.default()`": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "Response extractors are from `extractors.ts`": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "Scope is declared correctly": {
    kind: "automated",
    tests: [
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  "`identifierFields` are declared": {
    kind: "automated",
    tests: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  "`operationPolicy` on every endpoint": {
    kind: "automated",
    tests: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  "Write operations require confirmation": {
    kind: "automated",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  "No secrets exposed": {
    kind: "manual",
    note: "PR review — API response shaping and redaction cannot be fully static-analyzed",
  },
  "`pnpm build` passes": {
    kind: "ci",
    workflowSteps: ["pnpm build"],
  },
  "`pnpm typecheck` passes": {
    kind: "ci",
    workflowSteps: ["pnpm typecheck"],
  },
  "`pnpm test` passes": {
    kind: "ci",
    workflowSteps: ["pnpm test"],
  },
  "`pnpm standards:check` passes": {
    kind: "ci",
    workflowSteps: ["pnpm standards:check"],
  },
};

function extractCommitChecklistLabels(markdown: string): string[] {
  const sectionStart = markdown.indexOf("## Commit Checklist");
  const sectionEnd = markdown.indexOf("## What NOT to Do", sectionStart);
  if (sectionStart === -1 || sectionEnd === -1) {
    throw new Error("Could not find Commit Checklist section in docs/coding-standards.md");
  }

  const section = markdown.slice(sectionStart, sectionEnd);
  const labels: string[] = [];
  const lineRe = /^\s*-\s*\[\s*\]\s*\*\*(.+?)\*\*\s*—/;

  for (const line of section.split("\n")) {
    const match = lineRe.exec(line);
    if (match) labels.push(match[1]!.trim());
  }
  return labels;
}

describe("Coding standards — commit checklist coverage", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const checklistLabels = extractCommitChecklistLabels(standards);

  it("documents every commit checklist item in CHECKLIST_COVERAGE", () => {
    expect(checklistLabels.length).toBeGreaterThan(0);

    const unmapped = checklistLabels.filter((label) => !(label in CHECKLIST_COVERAGE));
    const stale = Object.keys(CHECKLIST_COVERAGE).filter((key) => !checklistLabels.includes(key));

    expect(unmapped, `Add CHECKLIST_COVERAGE entries for:\n${unmapped.join("\n")}`).toEqual([]);
    expect(stale, `Remove stale CHECKLIST_COVERAGE keys:\n${stale.join("\n")}`).toEqual([]);
  });

  it("every automated checklist item references existing test files", () => {
    for (const [label, coverage] of Object.entries(CHECKLIST_COVERAGE)) {
      if (coverage.kind !== "automated") continue;

      expect(coverage.tests.length, label).toBeGreaterThan(0);
      for (const testPath of coverage.tests) {
        const full = join(REPO_ROOT, testPath);
        expect(existsSync(full), `${label}: missing ${testPath}`).toBe(true);
      }
    }
  });

  it("CI-gated checklist commands run in .github/workflows/ci.yml", () => {
    for (const [label, coverage] of Object.entries(CHECKLIST_COVERAGE)) {
      if (coverage.kind !== "ci") continue;

      for (const step of coverage.workflowSteps) {
        expect(ciWorkflow, `${label}: CI missing "${step}"`).toContain(step);
      }
    }
  });

  it("docs/coding-standards.md references this coverage test", () => {
    expect(standards).toContain("commit-checklist-coverage.test.ts");
  });
});
