/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guardrails.
 *
 * When adding a new architecture rule, extend this map and the enforcing test file
 * so `pnpm standards:check` stays the single verification entrypoint.
 */

export type EnforcementEntry = {
  /** Short label matching the commit checklist in docs/coding-standards.md */
  checklist: string;
  /** false = verified manually (build/typecheck/test) or by review */
  automated: boolean;
  /** Vitest files that enforce this rule (relative to repo root) */
  tests: string[];
};

export const STANDARDS_ENFORCEMENT: EnforcementEntry[] = [
  {
    checklist: "No new server.registerTool() outside the 11 harness handlers",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools.test.ts",
      "tests/coding-standards/docs-consistency.test.ts",
    ],
  },
  {
    checklist: "No console.log() in src/ (stderr-only logging)",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No undocumented global fetch(); Harness API via HarnessClient",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "No new harness-*.ts handler files under src/tools/",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    checklist: "Toolset files are pure data (no client/MCP/registry/logger imports)",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "Zod v4 import path and describe-after-optional/default chaining",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/docs-consistency.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    checklist: "Shared response extractors (no new inline toolset extractors)",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "Resource scope and scope injection conventions",
    automated: true,
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "identifierFields declared on every resource",
    automated: true,
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "operationPolicy on every endpoint",
    automated: true,
    tests: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    checklist: "Write/execute operations require confirmation + elicitation",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    checklist: "Tool input snake_case and harness_list pagination defaults",
    automated: true,
    tests: ["tests/coding-standards/input-conventions.test.ts"],
  },
  {
    checklist: "Error handling uses toMcpError / errorResult",
    automated: true,
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/error-handling.test.ts",
    ],
  },
  {
    checklist: "Registry toolset registration matches ToolsetName union",
    automated: true,
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    checklist: "File organization (toolsets vs src/tools/)",
    automated: true,
    tests: ["tests/coding-standards/file-organization.test.ts"],
  },
  {
    checklist: "Documentation stays on 11-tool / Zod v4 / registerTool model",
    automated: true,
    tests: ["tests/coding-standards/docs-consistency.test.ts"],
  },
  {
    checklist: "pnpm standards:check guardrails entrypoint and CI wiring",
    automated: true,
    tests: [
      "tests/coding-standards/enforcement-map.test.ts",
      "tests/coding-standards/commit-checklist-coverage.test.ts",
    ],
  },
  {
    checklist: "Production Docker image applies Debian security refresh and OpenSSL floor",
    automated: true,
    tests: ["tests/docker/production-dockerfile.test.ts"],
  },
  {
    checklist: "Direct dependency CVE floors (body-parser, zod, fast-uri, ip-address)",
    automated: true,
    tests: [
      "tests/scripts/cve-dependency-pins.test.ts",
      "tests/scripts/ip-address-security-lib.test.ts",
    ],
  },
  {
    checklist: "adm-zip postinstall patch and lockfile pins (CVE-2026-39244 / CVE-2026-76845)",
    automated: true,
    tests: [
      "tests/scripts/adm-zip-dependency-pins.test.ts",
      "tests/scripts/adm-zip-security-lib.test.ts",
    ],
  },
  {
    checklist: "HTTP framework security pins (hono, @hono/node-server, vite)",
    automated: true,
    tests: ["tests/scripts/http-framework-security-pins.test.ts"],
  },
  {
    checklist: "Transitive build/parser toolchain security pins",
    automated: true,
    tests: ["tests/scripts/transitive-security-pins.test.ts"],
  },
  {
    checklist: "Service account list flattening and multi-scope registry contract",
    automated: true,
    tests: [
      "tests/registry/access-control-service-account.test.ts",
      "tests/registry/extractors-service-account.test.ts",
    ],
  },
  {
    checklist: "pnpm build passes",
    automated: false,
    tests: [],
  },
  {
    checklist: "pnpm typecheck passes",
    automated: false,
    tests: [],
  },
  {
    checklist: "pnpm test passes",
    automated: false,
    tests: [],
  },
  {
    checklist: "No secrets exposed in tool responses (redactSensitiveFields)",
    automated: true,
    tests: ["tests/coding-standards/security-redaction.test.ts"],
  },
];

/**
 * Each docs/coding-standards.md Commit Checklist bullet must map to at least one
 * STANDARDS_ENFORCEMENT entry (by distinctive substring).
 */
export const DOC_COMMIT_CHECKLIST_COVERAGE: ReadonlyArray<{
  docSubstring: string;
  enforcementSubstring: string;
}> = [
  { docSubstring: "server.registerTool", enforcementSubstring: "registerTool" },
  { docSubstring: "console.log", enforcementSubstring: "console.log" },
  { docSubstring: "fetch()", enforcementSubstring: "fetch" },
  { docSubstring: "harness-*.ts", enforcementSubstring: "harness-*.ts" },
  { docSubstring: "Toolset files are pure data", enforcementSubstring: "Toolset files are pure data" },
  { docSubstring: ".describe()", enforcementSubstring: "Zod" },
  { docSubstring: "extractors.ts", enforcementSubstring: "extractors" },
  { docSubstring: "Scope is declared correctly", enforcementSubstring: "scope" },
  { docSubstring: "identifierFields", enforcementSubstring: "identifierFields" },
  { docSubstring: "operationPolicy", enforcementSubstring: "operationPolicy" },
  { docSubstring: "Write operations require confirmation", enforcementSubstring: "confirmation" },
  { docSubstring: "No secrets exposed", enforcementSubstring: "secrets" },
  { docSubstring: "pnpm build", enforcementSubstring: "pnpm build" },
  { docSubstring: "pnpm typecheck", enforcementSubstring: "pnpm typecheck" },
  { docSubstring: "pnpm test", enforcementSubstring: "pnpm test" },
  { docSubstring: "pnpm standards:check", enforcementSubstring: "standards:check" },
];
