/**
 * Maps docs/coding-standards.md rules to automated guardrail tests.
 *
 * Used by enforcement-map.test.ts so contributors can see which standards are
 * enforced in CI (`pnpm standards:check`) vs. require manual review.
 *
 * When adding a new guardrail test, update this map in the same PR.
 */
export type StandardsEnforcementEntry = {
  /** Short id for failures / docs cross-reference */
  id: string;
  /** Section in docs/coding-standards.md */
  docSection: string;
  /** Relative paths under tests/ that enforce the rule */
  enforcedBy: readonly string[];
  /** Human note when enforcement is partial or review-only */
  note?: string;
};

/** Rules enforced by vitest under tests/coding-standards/ and structural-validation. */
export const AUTOMATED_STANDARDS: readonly StandardsEnforcementEntry[] = [
  {
    id: "fixed-consolidated-mcp-tools",
    docSection: "§1 — Never add new MCP tool handlers",
    enforcedBy: [
      "coding-standards/architecture.test.ts",
      "coding-standards/consolidated-tools-sync.test.ts",
      "coding-standards/file-organization.test.ts",
    ],
  },
  {
    id: "toolset-pure-data",
    docSection: "§2 — Toolset definitions are pure data",
    enforcedBy: ["coding-standards/architecture.test.ts", "coding-standards/toolset-scope.test.ts"],
  },
  {
    id: "shared-response-extractors",
    docSection: "§3 — Use shared response extractors",
    enforcedBy: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "harness-scoping-model",
    docSection: "§4 — Follow the Harness scoping model",
    enforcedBy: [
      "coding-standards/registry-contract.test.ts",
      "coding-standards/scope-params.test.ts",
      "coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    id: "identifier-fields-and-metadata",
    docSection: "§5 — Identifier fields and deep links",
    enforcedBy: [
      "coding-standards/registry-contract.test.ts",
      "coding-standards/registry-metadata.test.ts",
      "registry/structural-validation.test.ts",
    ],
  },
  {
    id: "error-handling-pattern",
    docSection: "§6 — Error handling pattern",
    enforcedBy: ["coding-standards/error-handling.test.ts", "coding-standards/architecture.test.ts"],
  },
  {
    id: "stderr-only-logging",
    docSection: "§7 — Logging rules (no stdout)",
    enforcedBy: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "tool-input-schema-standards",
    docSection: "§8 — Tool input schema standards",
    enforcedBy: [
      "coding-standards/input-conventions.test.ts",
      "coding-standards/registry-metadata.test.ts",
      "coding-standards/scope-params.test.ts",
      "coding-standards/architecture.test.ts",
    ],
  },
  {
    id: "write-confirmation-elicitation",
    docSection: "§9 — Write safety (confirm + elicitation)",
    enforcedBy: [
      "coding-standards/architecture.test.ts",
      "coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    id: "singleton-http-client",
    docSection: "§10 — HTTP client is singleton",
    enforcedBy: ["coding-standards/architecture.test.ts"],
  },
  {
    id: "file-organization",
    docSection: "§11 — File organization rules",
    enforcedBy: ["coding-standards/file-organization.test.ts"],
  },
  {
    id: "docs-and-stack-consistency",
    docSection: "Architecture overview + tech stack (11 tools, Zod v4, registerTool)",
    enforcedBy: ["coding-standards/docs-consistency.test.ts"],
  },
  {
    id: "registry-structural-validation",
    docSection: "Resource registry correctness (paths, bodySchema, policies)",
    enforcedBy: ["registry/structural-validation.test.ts"],
  },
];

/**
 * Standards documented in docs/coding-standards.md that are not fully automatable.
 * PR reviewers should verify these when touching relevant code.
 */
export const MANUAL_REVIEW_STANDARDS: readonly StandardsEnforcementEntry[] = [
  {
    id: "no-secret-values-in-tool-output",
    docSection: "§9 — Never expose secret values (metadata only)",
    enforcedBy: [],
    note: "Review handler formatters and extractors when adding secret-adjacent resources.",
  },
  {
    id: "pipeline-execution-user-consent",
    docSection: "§9 — Present execution plan before auto-running pipelines",
    enforcedBy: [],
    note: "Agent workflow + harness_execute elicitation; not statically provable.",
  },
  {
    id: "deep-link-templates",
    docSection: "§5 — deepLinkTemplate when possible",
    enforcedBy: [],
    note: "Optional per resource; structural tests do not require every type to have a deep link.",
  },
];
