/**
 * Maps docs/coding-standards.md commit-checklist bullets to enforcing vitest files.
 * Update this map when adding new guardrails or checklist items.
 */
export type StandardsEnforcementEntry = {
  /** Unique id for tests and error messages. */
  id: string;
  /** Substring that must appear in the Commit Checklist section of docs/coding-standards.md. */
  checklistSubstring: string;
  /** Vitest files that enforce this rule (paths relative to repo root). */
  enforcingTestFiles: string[];
  /** Checked in CI workflow instead of (or in addition to) a dedicated vitest file. */
  ciWorkflowSteps?: string[];
};

/** Architecture rules from docs/coding-standards.md — Commit Checklist section. */
export const STANDARDS_ENFORCEMENT_MAP: StandardsEnforcementEntry[] = [
  {
    id: "no-extra-register-tool",
    checklistSubstring: "No new `server.registerTool()` calls",
    enforcingTestFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
    ],
  },
  {
    id: "no-console-log",
    checklistSubstring: "No `console.log()`",
    enforcingTestFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "no-raw-fetch",
    checklistSubstring: "No direct `fetch()` calls",
    enforcingTestFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "fixed-harness-handlers",
    checklistSubstring: "No new `harness-*.ts` handler files",
    enforcingTestFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    id: "toolset-pure-data",
    checklistSubstring: "Toolset files are pure data",
    enforcingTestFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    id: "zod-describe-chaining",
    checklistSubstring: "All Zod params have `.describe()`",
    enforcingTestFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/scope-params.test.ts",
    ],
  },
  {
    id: "shared-extractors",
    checklistSubstring: "Response extractors are from `extractors.ts`",
    enforcingTestFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "resource-scope",
    checklistSubstring: "Scope is declared correctly",
    enforcingTestFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    id: "identifier-fields",
    checklistSubstring: "`identifierFields` are declared",
    enforcingTestFiles: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    id: "operation-policy",
    checklistSubstring: "`operationPolicy` on every endpoint",
    enforcingTestFiles: ["tests/coding-standards/registry-contract.test.ts"],
  },
  {
    id: "write-confirmation",
    checklistSubstring: "Write operations require confirmation",
    enforcingTestFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    id: "no-secrets-exposed",
    checklistSubstring: "No secrets exposed",
    enforcingTestFiles: [
      "tests/utils/redact.test.ts",
      "tests/utils/body-preview.test.ts",
      "tests/tools/tool-handlers.test.ts",
    ],
  },
  {
    id: "pnpm-build",
    checklistSubstring: "`pnpm build` passes",
    enforcingTestFiles: [],
    ciWorkflowSteps: ["pnpm build"],
  },
  {
    id: "pnpm-typecheck",
    checklistSubstring: "`pnpm typecheck` passes",
    enforcingTestFiles: [],
    ciWorkflowSteps: ["pnpm typecheck"],
  },
  {
    id: "pnpm-test",
    checklistSubstring: "`pnpm test` passes",
    enforcingTestFiles: [],
    ciWorkflowSteps: ["pnpm test"],
  },
  {
    id: "pnpm-standards-check",
    checklistSubstring: "`pnpm standards:check` passes",
    enforcingTestFiles: ["tests/coding-standards/enforcement-map.test.ts"],
    ciWorkflowSteps: ["pnpm standards:check"],
  },
];
