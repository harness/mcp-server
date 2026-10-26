/**
 * Maps docs/coding-standards.md Commit Checklist bullets to automated guardrails.
 * Prevents adding checklist items without wiring enforcement (or documenting CI-only checks).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

/** Checklist lead phrases (must match **bold** text in docs/coding-standards.md). */
export const COMMIT_CHECKLIST_ENFORCEMENT: Record<
  string,
  { guardrails: readonly string[]; ciOnly?: boolean }
> = {
  "No new `server.registerTool()` calls": {
    guardrails: ["architecture.test.ts"],
  },
  "No `console.log()`": {
    guardrails: ["architecture.test.ts"],
  },
  "No direct `fetch()` calls": {
    guardrails: ["architecture.test.ts"],
  },
  "No new `harness-*.ts` handler files": {
    guardrails: ["architecture.test.ts", "file-organization.test.ts"],
  },
  "Toolset files are pure data": {
    guardrails: ["architecture.test.ts"],
  },
  "All Zod params have `.describe()` after `.optional()`/`.default()`": {
    guardrails: ["architecture.test.ts", "input-conventions.test.ts"],
  },
  "Response extractors are from `extractors.ts`": {
    guardrails: ["architecture.test.ts"],
  },
  'Scope is declared correctly': {
    guardrails: ["scope-params.test.ts", "toolset-scope.test.ts", "registry-contract.test.ts"],
  },
  "`identifierFields` are declared": {
    guardrails: ["registry-contract.test.ts", "registry-metadata.test.ts"],
  },
  "`operationPolicy` on every endpoint": {
    guardrails: ["registry-contract.test.ts"],
  },
  "Write operations require confirmation": {
    guardrails: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  "No secrets exposed": {
    guardrails: ["../utils/redact.test.ts"],
    ciOnly: true,
  },
  "`pnpm build` passes": {
    guardrails: [],
    ciOnly: true,
  },
  "`pnpm typecheck` passes": {
    guardrails: [],
    ciOnly: true,
  },
  "`pnpm test` passes": {
    guardrails: [],
    ciOnly: true,
  },
  "`pnpm standards:check` passes": {
    guardrails: ["enforcement-map.test.ts"],
  },
};

function extractCommitChecklistBoldLabels(markdown: string): string[] {
  const section = markdown.match(/## Commit Checklist[\s\S]*?(?=\n## )/);
  if (!section) return [];

  const labels: string[] = [];
  const lineRe = /^- \[ \] \*\*(.+?)\*\*/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(section[0]!)) !== null) {
    labels.push(match[1]!);
  }
  return labels;
}

describe("Coding standards — commit checklist enforcement map", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const checklistLabels = extractCommitChecklistBoldLabels(standards);

  it("docs commit checklist matches COMMIT_CHECKLIST_ENFORCEMENT keys exactly", () => {
    const mapped = Object.keys(COMMIT_CHECKLIST_ENFORCEMENT).sort();
    expect(checklistLabels.sort()).toEqual(mapped);
  });

  it("every non-CI-only guardrail file exists on disk", () => {
    const violations: string[] = [];

    for (const [item, { guardrails, ciOnly }] of Object.entries(COMMIT_CHECKLIST_ENFORCEMENT)) {
      if (ciOnly && guardrails.length === 0) continue;

      for (const file of guardrails) {
        const abs = file.startsWith("../")
          ? join(REPO_ROOT, "tests/coding-standards", file)
          : join(REPO_ROOT, "tests/coding-standards", file);
        if (!existsSync(abs)) {
          violations.push(`${item}: missing ${file}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("standards:check guardrail items reference tests under tests/coding-standards/", () => {
    const violations: string[] = [];

    for (const [item, { guardrails, ciOnly }] of Object.entries(COMMIT_CHECKLIST_ENFORCEMENT)) {
      if (ciOnly) continue;
      for (const file of guardrails) {
        if (file.startsWith("../")) {
          violations.push(`${item}: ${file} is outside standards:check — mark ciOnly or move guardrail`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
