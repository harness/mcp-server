/**
 * Maps docs/coding-standards.md commit-checklist bullets to automated guard tests.
 * commit-checklist-coverage.test.ts fails if a checklist item loses test coverage.
 */
export type ChecklistEnforcement = {
  /** Stable id matching the checklist theme */
  id: string;
  /** Short label from the commit checklist */
  summary: string;
  /** Repo-relative vitest files that enforce this rule */
  testFiles: readonly string[];
  /** At least one `it(` / `test(` in those files must match */
  testNamePattern: RegExp;
};

export const COMMIT_CHECKLIST_ENFORCEMENT: readonly ChecklistEnforcement[] = [
  {
    id: "register-tool-surface",
    summary: "No new registerTool() outside fixed handler files",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /only allows registerTool\(\)/,
  },
  {
    id: "stderr-logging",
    summary: "No console.log() in src/",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /never uses console\.log\(\)/,
  },
  {
    id: "fetch-via-client",
    summary: "No undocumented global fetch()",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /only uses global fetch\(\) in documented exception files/,
  },
  {
    id: "fixed-harness-handlers",
    summary: "No new harness-*.ts handler files",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
    testNamePattern: /harness-.*handler files/,
  },
  {
    id: "pure-toolsets",
    summary: "Toolset files are pure data",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /toolset files do not import HarnessClient/,
  },
  {
    id: "zod-describe-chaining",
    summary: "Zod .describe() after .optional()/.default()",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    testNamePattern: /\.describe\(\)/,
  },
  {
    id: "shared-extractors",
    summary: "No new inline responseExtractor in toolsets",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /inline responseExtractor/,
  },
  {
    id: "resource-scope",
    summary: "Valid resource scope declarations",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
    testNamePattern: /scope/,
  },
  {
    id: "identifier-fields",
    summary: "identifierFields declared on every resource",
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
    testNamePattern: /identifierFields/,
  },
  {
    id: "operation-policy",
    summary: "operationPolicy on every endpoint",
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
    testNamePattern: /operationPolicy/,
  },
  {
    id: "write-confirmation",
    summary: "Write handlers use elicitation / confirm",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    testNamePattern: /confirmViaElicitation/,
  },
  {
    id: "no-secret-values",
    summary: "Sensitive fields redacted; secret resource is metadata-only",
    testFiles: [
      "tests/utils/redact.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    testNamePattern: /redact|secret metadata/i,
  },
  {
    id: "standards-check-script",
    summary: "pnpm standards:check in CI",
    testFiles: [".github/workflows/ci.yml"],
    testNamePattern: /standards:check/,
  },
  {
    id: "build-typecheck-test-ci",
    summary: "pnpm build, test, and typecheck in CI",
    testFiles: [".github/workflows/ci.yml"],
    testNamePattern: /pnpm build/,
  },
];
