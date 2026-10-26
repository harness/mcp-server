/**
 * Maps docs/coding-standards.md "Commit Checklist" items to automated guardrails.
 * Fails if a documented automated rule loses its enforcing test file (rename/delete drift).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type ChecklistEntry = {
  /** Short label matching docs/coding-standards.md Commit Checklist */
  checklist: string;
  /** Vitest files (relative to repo root) that enforce this rule */
  enforcedBy: string[];
  /** Items that remain manual review / runtime verification */
  manual?: boolean;
};

const COMMIT_CHECKLIST_ENFORCEMENT: ChecklistEntry[] = [
  {
    checklist: "No new server.registerTool() calls — only toolset definitions added/modified",
    enforcedBy: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No console.log() — only createLogger() for stderr output",
    enforcedBy: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No direct fetch() calls — Harness API HTTP via HarnessClient (documented exceptions)",
    enforcedBy: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No new harness-*.ts handler files — the 11 handlers are fixed",
    enforcedBy: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
    ],
  },
  {
    checklist: "Toolset files are pure data — no HarnessClient, McpServer, Registry, or createLogger",
    enforcedBy: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "Zod params use .describe() after .optional()/.default() (Zod v4 chaining)",
    enforcedBy: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
    ],
  },
  {
    checklist: "Response extractors are from extractors.ts — reuse shared extractors",
    enforcedBy: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: 'Scope is declared correctly — "project", "org", or "account"',
    enforcedBy: [
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "identifierFields are declared — required for harness_get dispatch",
    enforcedBy: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    checklist: "operationPolicy on every endpoint — risk + retryPolicy",
    enforcedBy: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "Write operations require confirmation — elicitation + confirm param",
    enforcedBy: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/error-handling.test.ts"],
  },
  {
    checklist: "No secrets exposed — only metadata, never values",
    manual: true,
    enforcedBy: [],
  },
  {
    checklist: "pnpm build passes — no type errors",
    manual: true,
    enforcedBy: [],
  },
  {
    checklist: "pnpm typecheck passes — strict mode",
    manual: true,
    enforcedBy: [],
  },
  {
    checklist: "pnpm test passes — no regressions",
    manual: true,
    enforcedBy: [],
  },
  {
    checklist: "pnpm standards:check passes — automated architecture guardrails",
    enforcedBy: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/docs-consistency.test.ts",
      "tests/coding-standards/file-organization.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
      "tests/coding-standards/error-handling.test.ts",
      "tests/coding-standards/enforcement-map.test.ts",
      "tests/coding-standards/security-regression-map.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
];

describe("Coding standards — commit checklist enforcement map", () => {
  it("every automated checklist item points at existing test files", () => {
    const missing: string[] = [];

    for (const entry of COMMIT_CHECKLIST_ENFORCEMENT) {
      if (entry.manual) continue;
      for (const file of entry.enforcedBy) {
        if (!existsSync(join(REPO_ROOT, file))) {
          missing.push(`${entry.checklist} → missing ${file}`);
        }
      }
      expect(
        entry.enforcedBy.length,
        `Automated checklist item must list enforcing tests: ${entry.checklist}`,
      ).toBeGreaterThan(0);
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("documents one entry per Commit Checklist rule in docs/coding-standards.md", () => {
    // Keep in sync when adding/removing checklist bullets in docs/coding-standards.md.
    expect(COMMIT_CHECKLIST_ENFORCEMENT).toHaveLength(16);
  });

  it("flags manual-only checklist items explicitly", () => {
    const manual = COMMIT_CHECKLIST_ENFORCEMENT.filter((e) => e.manual);
    expect(manual.map((e) => e.checklist)).toEqual([
      "No secrets exposed — only metadata, never values",
      "pnpm build passes — no type errors",
      "pnpm typecheck passes — strict mode",
      "pnpm test passes — no regressions",
    ]);
  });

  it("consolidated tool SSOT lives under tests/coding-standards/", () => {
    expect(existsSync(join(CODING_STANDARDS_DIR, "consolidated-tools.ts"))).toBe(true);
  });
});
