/**
 * Ensures docs/coding-standards.md commit checklist items stay wired to automated
 * guardrails (or documented CI steps). Prevents checklist drift without tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW_PATH = join(REPO_ROOT, ".github/workflows/ci.yml");

/**
 * Keys must match the bold lead text of each bullet under "## Commit Checklist"
 * in docs/coding-standards.md (text inside **...**).
 */
const CHECKLIST_GUARD_FILES: Record<string, readonly string[]> = {
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
  "Toolset files are pure data": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/toolset-scope.test.ts",
  ],
  "All Zod params have `.describe()` after `.optional()`/`.default()`": [
    "tests/coding-standards/input-conventions.test.ts",
    "tests/coding-standards/architecture.test.ts",
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
  "`operationPolicy` on every endpoint": ["tests/coding-standards/registry-contract.test.ts"],
  "Write operations require confirmation": ["tests/coding-standards/architecture.test.ts"],
  "No secrets exposed": [
    "tests/utils/redact.test.ts",
    "tests/client/harness-client.test.ts",
  ],
};

const CHECKLIST_CI_COMMANDS: Record<string, string> = {
  "`pnpm build` passes": "pnpm build",
  "`pnpm typecheck` passes": "pnpm typecheck",
  "`pnpm test` passes": "pnpm test",
  "`pnpm standards:check` passes": "pnpm standards:check",
};

function extractCommitChecklistBullets(markdown: string): string[] {
  const sectionMatch = markdown.match(/## Commit Checklist\s+([\s\S]*?)\n---/);
  if (!sectionMatch) {
    throw new Error("Could not find ## Commit Checklist section in docs/coding-standards.md");
  }
  const section = sectionMatch[1]!;
  const bullets: string[] = [];
  const bulletRe = /- \[ \] \*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = bulletRe.exec(section)) !== null) {
    bullets.push(match[1]!);
  }
  return bullets;
}

function assertFilesExist(files: readonly string[]): void {
  const missing = files.filter((f) => !existsSync(join(REPO_ROOT, f)));
  expect(missing, `missing guard file(s):\n${missing.join("\n")}`).toEqual([]);
}

describe("Coding standards — commit checklist coverage", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const ciWorkflow = readFileSync(CI_WORKFLOW_PATH, "utf8");
  const docBullets = extractCommitChecklistBullets(standards);

  it("documents the expected number of commit checklist items", () => {
    expect(docBullets.length).toBeGreaterThanOrEqual(14);
  });

  it("maps every automated checklist bullet to on-disk guard tests", () => {
    for (const [bullet, files] of Object.entries(CHECKLIST_GUARD_FILES)) {
      expect(docBullets, `docs checklist missing bullet: ${bullet}`).toContain(bullet);
      expect(files.length).toBeGreaterThan(0);
      assertFilesExist(files);
    }
  });

  it("maps every checklist bullet to either guard tests or CI", () => {
    const covered = new Set([
      ...Object.keys(CHECKLIST_GUARD_FILES),
      ...Object.keys(CHECKLIST_CI_COMMANDS),
    ]);
    const uncovered = docBullets.filter((b) => !covered.has(b));
    expect(
      uncovered,
      `Commit checklist bullets without coverage mapping:\n${uncovered.join("\n")}`,
    ).toEqual([]);
  });

  it("runs build, test, typecheck, and standards:check in CI", () => {
    for (const [bullet, command] of Object.entries(CHECKLIST_CI_COMMANDS)) {
      expect(docBullets).toContain(bullet);
      expect(ciWorkflow, `CI missing ${command}`).toContain(command);
    }
  });
});
