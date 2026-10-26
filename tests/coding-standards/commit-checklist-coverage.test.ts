/**
 * Every bullet in docs/coding-standards.md "## Commit Checklist" must map to
 * automated guard tests or CI workflow enforcement — prevents doc-only checklist drift.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

/**
 * Bold label text from each `- [ ] **...**` line in the Commit Checklist section
 * → guard test files (or CI workflow) that enforce it.
 */
const COMMIT_CHECKLIST_COVERAGE: Record<string, string[]> = {
  "No new `server.registerTool()` calls": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/consolidated-tools.test.ts",
  ],
  "No `console.log()`": ["tests/coding-standards/architecture.test.ts"],
  "No direct `fetch()` calls": ["tests/coding-standards/architecture.test.ts"],
  "No new `harness-*.ts` handler files": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/file-organization.test.ts",
  ],
  "Toolset files are pure data": ["tests/coding-standards/architecture.test.ts"],
  "All Zod params have `.describe()` after `.optional()`/`.default()`": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/input-conventions.test.ts",
    "tests/coding-standards/registry-metadata.test.ts",
  ],
  "Response extractors are from `extractors.ts`": [
    "tests/coding-standards/architecture.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "Scope is declared correctly": [
    "tests/coding-standards/scope-params.test.ts",
    "tests/coding-standards/toolset-scope.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "`identifierFields` are declared": [
    "tests/coding-standards/registry-metadata.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "`operationPolicy` on every endpoint": ["tests/registry/structural-validation.test.ts"],
  "Write operations require confirmation": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/registry-metadata.test.ts",
  ],
  "No secrets exposed": ["tests/utils/redact.test.ts", "tests/utils/body-preview.test.ts"],
  "`pnpm build` passes": [".github/workflows/ci.yml"],
  "`pnpm typecheck` passes": [".github/workflows/ci.yml"],
  "`pnpm test` passes": [".github/workflows/ci.yml"],
  "`pnpm standards:check` passes": [
    "tests/coding-standards/docs-consistency.test.ts",
    ".github/workflows/ci.yml",
  ],
};

function extractCommitChecklistLabels(markdown: string): string[] {
  const start = markdown.indexOf("## Commit Checklist");
  const end = markdown.indexOf("## What NOT to Do");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const section = markdown.slice(start, end);
  const labels: string[] = [];

  for (const line of section.split("\n")) {
    if (!line.startsWith("- [ ]")) continue;
    const match = line.match(/- \[ \] \*\*(.+)\*\*/);
    if (match?.[1]) {
      labels.push(match[1]);
    }
  }

  return labels;
}

describe("Coding standards — commit checklist coverage", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const docLabels = extractCommitChecklistLabels(standards);

  it("docs/coding-standards.md Commit Checklist lists every mapped label", () => {
    const mapped = Object.keys(COMMIT_CHECKLIST_COVERAGE).sort();
    expect(docLabels.sort()).toEqual(mapped);
  });

  it("each Commit Checklist item points at existing guard files or CI", () => {
    const missing: string[] = [];

    for (const [label, guardFiles] of Object.entries(COMMIT_CHECKLIST_COVERAGE)) {
      for (const rel of guardFiles) {
        if (!existsSync(join(REPO_ROOT, rel))) {
          missing.push(`${label}: ${rel}`);
        }
      }
    }

    expect(missing, `Missing coverage targets:\n${missing.join("\n")}`).toEqual([]);
  });

  it("CI workflow enforces pnpm build, test, typecheck, and standards:check", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    for (const cmd of ["pnpm build", "pnpm test", "pnpm typecheck", "pnpm standards:check"]) {
      expect(ci, `ci.yml missing ${cmd}`).toContain(cmd);
    }
  });
});
