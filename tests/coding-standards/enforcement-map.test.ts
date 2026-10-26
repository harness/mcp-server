/**
 * Maps docs/coding-standards.md commit checklist items to guardrail tests.
 * Prevents removing enforcement without updating the checklist documentation.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

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
