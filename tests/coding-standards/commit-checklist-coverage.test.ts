/**
 * Ensures every item in docs/coding-standards.md "Commit Checklist" has an
 * automated guard (or is enforced in CI). Prevents checklist drift without tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW = join(REPO_ROOT, ".github/workflows/ci.yml");

/** Substrings that must appear in a checklist bullet (docs/coding-standards.md). */
const DOC_CHECKLIST_MARKERS = [
  "No new `registerTool()` outside the 11 consolidated handler files",
  "No `console.log()`",
  "No direct `fetch()` calls",
  "No new `harness-*.ts` handler files",
  "Toolset files are pure data",
  "All Zod params have `.describe()`",
  "Response extractors are from `extractors.ts`",
  "Scope is declared correctly",
  "`identifierFields` are declared",
  "`operationPolicy` on every endpoint",
  "Write operations require confirmation",
  "No secrets exposed",
  "`pnpm build` passes",
  "`pnpm typecheck` passes",
  "`pnpm test` passes",
  "`pnpm standards:check` passes",
] as const;

type ChecklistCoverage = {
  marker: (typeof DOC_CHECKLIST_MARKERS)[number];
  guardFiles: string[];
};

/**
 * Maps each commit-checklist bullet to one or more test files (repo-relative paths).
 * Manual-only items must still point at CI workflow enforcement.
 */
const CHECKLIST_COVERAGE: ChecklistCoverage[] = [
  {
    marker: "No new `registerTool()` outside the 11 consolidated handler files",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools-sync.test.ts",
    ],
  },
  {
    marker: "No `console.log()`",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    marker: "No direct `fetch()` calls",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    marker: "No new `harness-*.ts` handler files",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    marker: "Toolset files are pure data",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    marker: "All Zod params have `.describe()`",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    marker: "Response extractors are from `extractors.ts`",
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    marker: "Scope is declared correctly",
    guardFiles: [
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/registry-contract.test.ts",
    ],
  },
  {
    marker: "`identifierFields` are declared",
    guardFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    marker: "`operationPolicy` on every endpoint",
    guardFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    marker: "Write operations require confirmation",
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    marker: "No secrets exposed",
    guardFiles: [
      "tests/utils/redact.test.ts",
      "tests/utils/body-preview.test.ts",
      "tests/tools/tool-handlers.test.ts",
    ],
  },
  {
    marker: "`pnpm build` passes",
    guardFiles: [".github/workflows/ci.yml"],
  },
  {
    marker: "`pnpm typecheck` passes",
    guardFiles: [".github/workflows/ci.yml"],
  },
  {
    marker: "`pnpm test` passes",
    guardFiles: [".github/workflows/ci.yml"],
  },
  {
    marker: "`pnpm standards:check` passes",
    guardFiles: [
      "tests/coding-standards/enforcement-map.test.ts",
      ".github/workflows/ci.yml",
    ],
  },
];

function extractChecklistSection(content: string): string {
  const start = content.indexOf("## Commit Checklist");
  expect(start, "docs/coding-standards.md missing Commit Checklist section").toBeGreaterThanOrEqual(0);
  const end = content.indexOf("## What NOT to Do", start);
  expect(end, "docs/coding-standards.md missing What NOT to Do section").toBeGreaterThan(start);
  return content.slice(start, end);
}

describe("Coding standards — commit checklist coverage", () => {
  const standardsContent = readFileSync(STANDARDS_DOC, "utf8");
  const checklistSection = extractChecklistSection(standardsContent);

  it("docs/coding-standards.md commit checklist includes every mapped marker", () => {
    const missing: string[] = [];
    for (const marker of DOC_CHECKLIST_MARKERS) {
      if (!checklistSection.includes(marker)) {
        missing.push(marker);
      }
    }
    expect(missing, `Update DOC_CHECKLIST_MARKERS or restore checklist text:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("every checklist marker has at least one guard file on disk", () => {
    const missingGuards: string[] = [];

    for (const { marker, guardFiles } of CHECKLIST_COVERAGE) {
      for (const file of guardFiles) {
        const full = join(REPO_ROOT, file);
        if (!existsSync(full)) {
          missingGuards.push(`${marker}: missing ${file}`);
        }
      }
    }

    expect(missingGuards, missingGuards.join("\n")).toEqual([]);
  });

  it("maps one coverage entry per commit checklist marker", () => {
    expect(CHECKLIST_COVERAGE.map((c) => c.marker).sort()).toEqual([...DOC_CHECKLIST_MARKERS].sort());
  });

  it("CI workflow runs build, test, typecheck, and standards:check", () => {
    const workflow = readFileSync(CI_WORKFLOW, "utf8");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm standards:check");
  });
});
