/**
 * Maps docs/coding-standards.md "Commit Checklist" bullets to automated guardrails.
 * Prevents adding checklist items without wiring enforcement (or marking CI/manual).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { existsSync } from "node:fs";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW = join(REPO_ROOT, ".github/workflows/ci.yml");

type ChecklistEntry = {
  /** Vitest guard files under tests/coding-standards/ or tests/ */
  enforcedBy: readonly string[];
  /** Checked in CI workflow but not duplicated in standards:check */
  ciCommand?: string;
  /** Documented expectation with no static guard (e.g. secret values in live API payloads) */
  manual?: string;
};

/**
 * Keys must match the bold lead text of each `- [ ] **` bullet in the Commit Checklist section.
 * Keep in sync with docs/coding-standards.md and enforcement-map.test.ts.
 */
const CHECKLIST_COVERAGE: Record<string, ChecklistEntry> = {
  "No new `server.registerTool()` calls": {
    enforcedBy: ["architecture.test.ts", "file-organization.test.ts"],
  },
  "No `console.log()`": {
    enforcedBy: ["architecture.test.ts"],
  },
  "No direct `fetch()` calls": {
    enforcedBy: ["architecture.test.ts"],
  },
  "No new `harness-*.ts` handler files": {
    enforcedBy: ["architecture.test.ts", "file-organization.test.ts"],
  },
  "Toolset files are pure data": {
    enforcedBy: ["architecture.test.ts"],
  },
  "All Zod params have `.describe()` after `.optional()`/`.default()`": {
    enforcedBy: ["architecture.test.ts", "input-conventions.test.ts"],
  },
  "Response extractors are from `extractors.ts`": {
    enforcedBy: ["architecture.test.ts"],
  },
  "Scope is declared correctly": {
    enforcedBy: ["registry-contract.test.ts", "scope-params.test.ts", "toolset-scope.test.ts"],
  },
  "`identifierFields` are declared": {
    enforcedBy: ["registry-contract.test.ts", "registry-metadata.test.ts"],
  },
  "`operationPolicy` on every endpoint": {
    enforcedBy: ["registry-contract.test.ts", "registry-metadata.test.ts"],
  },
  "Write operations require confirmation": {
    enforcedBy: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  "No secrets exposed": {
    enforcedBy: [],
    manual: "Live API response shapes — covered by src/utils/redact.ts and tests/utils/redact.test.ts",
  },
  "`pnpm build` passes": {
    enforcedBy: [],
    ciCommand: "pnpm build",
  },
  "`pnpm typecheck` passes": {
    enforcedBy: [],
    ciCommand: "pnpm typecheck",
  },
  "`pnpm test` passes": {
    enforcedBy: [],
    ciCommand: "pnpm test",
  },
  "`pnpm standards:check` passes": {
    enforcedBy: ["enforcement-map.test.ts"],
    ciCommand: "pnpm standards:check",
  },
};

function extractCommitChecklistBullets(markdown: string): string[] {
  const sectionStart = markdown.indexOf("## Commit Checklist");
  if (sectionStart === -1) {
    throw new Error("Missing ## Commit Checklist in docs/coding-standards.md");
  }
  const sectionEnd = markdown.indexOf("\n## ", sectionStart + 1);
  const section = sectionEnd === -1 ? markdown.slice(sectionStart) : markdown.slice(sectionStart, sectionEnd);

  const bullets: string[] = [];
  const bulletRe = /^- \[ \] \*\*(.+?)\*\*/gm;
  let match: RegExpExecArray | null;
  while ((match = bulletRe.exec(section)) !== null) {
    bullets.push(match[1]!);
  }
  return bullets;
}

describe("Coding standards — commit checklist coverage", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const bullets = extractCommitChecklistBullets(standards);

  it("parses every Commit Checklist bullet from docs/coding-standards.md", () => {
    expect(bullets.length).toBeGreaterThanOrEqual(15);
  });

  it("maps every checklist bullet to enforcement, CI, or a documented manual gap", () => {
    const missing = bullets.filter((b) => !(b in CHECKLIST_COVERAGE));
    expect(
      missing,
      `Add CHECKLIST_COVERAGE entries for:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("does not define stale checklist coverage keys", () => {
    const extra = Object.keys(CHECKLIST_COVERAGE).filter((k) => !bullets.includes(k));
    expect(extra, `Remove or fix checklist keys:\n${extra.join("\n")}`).toEqual([]);
  });

  it("referenced guardrail files exist on disk", () => {
    const violations: string[] = [];

    for (const [bullet, entry] of Object.entries(CHECKLIST_COVERAGE)) {
      for (const file of entry.enforcedBy) {
        const underGuardrails = join(REPO_ROOT, "tests/coding-standards", file);
        const underTests = join(REPO_ROOT, "tests", file);
        if (!existsSync(underGuardrails) && !existsSync(underTests)) {
          violations.push(`${bullet}: missing ${file}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("CI workflow runs build, typecheck, test, and standards:check", () => {
    const ci = readFileSync(CI_WORKFLOW, "utf8");
    const requiredCommands = new Set<string>();

    for (const entry of Object.values(CHECKLIST_COVERAGE)) {
      if (entry.ciCommand) requiredCommands.add(entry.ciCommand);
    }

    for (const cmd of requiredCommands) {
      expect(ci, `ci.yml should run ${cmd}`).toContain(cmd);
    }
  });
});
