/**
 * Maps docs/coding-standards.md commit-checklist bullets to automated guard tests.
 * commit-checklist-coverage.test.ts fails if a checklist item loses test coverage.
 */
export type ChecklistEnforcement = {
  /** Stable id matching the checklist theme */
  id: string;
  /** Short label from the commit checklist */
  summary: string;
  /** Substring that must appear in the matching docs/coding-standards.md checklist bullet */
  docBulletIncludes: string;
  /** Repo-relative vitest files that enforce this rule */
  testFiles: readonly string[];
  /** At least one `it(` / `test(` in those files must match */
  testNamePattern: RegExp;
};

export const COMMIT_CHECKLIST_ENFORCEMENT: readonly ChecklistEnforcement[] = [
  {
    id: "register-tool-surface",
    summary: "No new registerTool() outside fixed handler files",
    docBulletIncludes: "server.registerTool()",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /only allows registerTool\(\)/,
  },
  {
    id: "stderr-logging",
    summary: "No console.log() in src/",
    docBulletIncludes: "console.log()",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /never uses console\.log\(\)/,
  },
  {
    id: "fetch-via-client",
    summary: "No undocumented global fetch()",
    docBulletIncludes: "fetch()",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /only uses global fetch\(\) in documented exception files/,
  },
  {
    id: "fixed-harness-handlers",
    summary: "No new harness-*.ts handler files",
    docBulletIncludes: "harness-*.ts",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
    testNamePattern: /harness-.*handler files/,
  },
  {
    id: "pure-toolsets",
    summary: "Toolset files are pure data",
    docBulletIncludes: "Toolset files are pure data",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /toolset files do not import HarnessClient/,
  },
  {
    id: "zod-describe-chaining",
    summary: "Zod .describe() after .optional()/.default()",
    docBulletIncludes: ".describe()",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    testNamePattern: /\.describe\(\)/,
  },
  {
    id: "shared-extractors",
    summary: "No new inline responseExtractor in toolsets",
    docBulletIncludes: "extractors.ts",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    testNamePattern: /inline responseExtractor/,
  },
  {
    id: "resource-scope",
    summary: "Valid resource scope declarations",
    docBulletIncludes: "Scope is declared correctly",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
    testNamePattern: /scope/,
  },
  {
    id: "identifier-fields",
    summary: "identifierFields declared on every resource",
    docBulletIncludes: "identifierFields",
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
    testNamePattern: /identifierFields/,
  },
  {
    id: "operation-policy",
    summary: "operationPolicy on every endpoint",
    docBulletIncludes: "operationPolicy",
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
    testNamePattern: /operationPolicy/,
  },
  {
    id: "write-confirmation",
    summary: "Write handlers use elicitation / confirm",
    docBulletIncludes: "Write operations require confirmation",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    testNamePattern: /confirmViaElicitation/,
  },
  {
    id: "no-secret-values",
    summary: "Sensitive fields redacted; secret resource is metadata-only",
    docBulletIncludes: "No secrets exposed",
    testFiles: [
      "tests/utils/redact.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
    testNamePattern: /redact|secret metadata/i,
  },
  {
    id: "build-ci",
    summary: "pnpm build in CI",
    docBulletIncludes: "pnpm build",
    testFiles: [".github/workflows/ci.yml"],
    testNamePattern: /pnpm build/,
  },
  {
    id: "typecheck-ci",
    summary: "pnpm typecheck in CI",
    docBulletIncludes: "pnpm typecheck",
    testFiles: [".github/workflows/ci.yml"],
    testNamePattern: /pnpm typecheck/,
  },
  {
    id: "test-ci",
    summary: "pnpm test in CI",
    docBulletIncludes: "pnpm test",
    testFiles: [".github/workflows/ci.yml"],
    testNamePattern: /pnpm test/,
  },
  {
    id: "standards-check-script",
    summary: "pnpm standards:check in CI",
    docBulletIncludes: "pnpm standards:check",
    testFiles: [".github/workflows/ci.yml"],
    testNamePattern: /standards:check/,
  },
];
