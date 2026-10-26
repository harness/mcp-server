/**
 * Maps docs/coding-standards.md commit-checklist items to enforcing vitest suites.
 * Update this when adding a new automated guardrail so checklist coverage stays complete.
 */
export type StandardsEnforcementRule = {
  /** Stable identifier for test failure messages. */
  id: string;
  /** Matches the bold lead text of a Commit Checklist bullet in docs/coding-standards.md. */
  checklistMatch: RegExp;
  /**
   * Test files that enforce the rule. Paths are repo-relative.
   * Files must exist; most are included in `pnpm standards:check`.
   */
  testFiles: readonly string[];
};

export const STANDARDS_ENFORCEMENT_RULES: readonly StandardsEnforcementRule[] = [
  {
    id: "fixed-register-tool-surface",
    checklistMatch: /No new `server\.registerTool\(\)` calls/,
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    id: "stderr-only-logging",
    checklistMatch: /No `console\.log\(\)`/,
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "harness-client-http-only",
    checklistMatch: /No direct `fetch\(\)` calls/,
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "fixed-harness-handlers",
    checklistMatch: /No new `harness-\*\.ts` handler files/,
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    id: "pure-data-toolsets",
    checklistMatch: /Toolset files are pure data/,
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "zod-describe-chaining",
    checklistMatch: /All Zod params have `\.describe\(\)` after/,
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
    ],
  },
  {
    id: "shared-response-extractors",
    checklistMatch: /Response extractors are from `extractors\.ts`/,
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "resource-scope",
    checklistMatch: /Scope is declared correctly/,
    testFiles: [
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    id: "identifier-fields",
    checklistMatch: /`identifierFields` are declared/,
    testFiles: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    id: "operation-policy",
    checklistMatch: /`operationPolicy` on every endpoint/,
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    id: "write-confirmation",
    checklistMatch: /Write operations require confirmation/,
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    id: "no-secret-values",
    checklistMatch: /No secrets exposed/,
    testFiles: [
      "tests/utils/redact.test.ts",
      "tests/client/harness-client.test.ts",
    ],
  },
];

/** Checklist bullets verified manually or via CI workflows (not mapped to a single rule file). */
export const MANUAL_COMMIT_CHECKLIST_MATCHES: readonly RegExp[] = [
  /`pnpm build` passes/,
  /`pnpm typecheck` passes/,
  /`pnpm test` passes/,
  /`pnpm standards:check` passes/,
];
