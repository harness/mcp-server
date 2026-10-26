/**
 * Maps docs/coding-standards.md commit-checklist items to automated guardrails.
 *
 * When adding a new standards test, register it here so checklist coverage stays explicit.
 * Manual-only items are listed with `automated: false` for visibility in failure output.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

type ChecklistRule = {
  id: string;
  summary: string;
  automated: boolean;
  /** Relative paths under repo root; all must exist when automated is true. */
  guardFiles: string[];
};

/**
 * Subset of the commit checklist in docs/coding-standards.md — architecture rules only.
 * Build/typecheck/full test suite are enforced in CI via package scripts, not this map.
 */
const CHECKLIST_ENFORCEMENT: ChecklistRule[] = [
  {
    id: "no-new-register-tool",
    summary: "No new registerTool() / harness handler files beyond the fixed 11",
    automated: true,
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools-sync.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    id: "no-console-log",
    summary: "No console.log() in src/ (stdio JSON-RPC safety)",
    automated: true,
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "no-raw-fetch",
    summary: "No undocumented global fetch(); Harness API HTTP via HarnessClient",
    automated: true,
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "toolset-purity",
    summary: "Toolsets are pure data (no HarnessClient, Registry, MCP SDK, createLogger)",
    automated: true,
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "zod-describe-chaining",
    summary: "Zod v4: .describe() after .optional() / .default(); inputSchema params documented",
    automated: true,
    guardFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    id: "shared-extractors",
    summary: "Reuse extractors.ts; cap legacy inline responseExtractor in toolsets",
    automated: true,
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "scope-and-identifiers",
    summary: "Valid scope, identifierFields, and registry registration symmetry",
    automated: true,
    guardFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/scope-params.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    id: "operation-policy",
    summary: "operationPolicy on endpoints; delete risk destructive",
    automated: true,
    guardFiles: ["tests/registry/structural-validation.test.ts"],
  },
  {
    id: "write-confirmation",
    summary: "Write tools declare confirm + confirmViaElicitation",
    automated: true,
    guardFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    id: "error-handling",
    summary: "API handlers use errorResult() and throw toMcpError()",
    automated: true,
    guardFiles: ["tests/coding-standards/error-handling.test.ts"],
  },
  {
    id: "input-conventions",
    summary: "snake_case params; harness_list pagination defaults",
    automated: true,
    guardFiles: ["tests/coding-standards/input-conventions.test.ts"],
  },
  {
    id: "docs-consistency",
    summary: "README/AGENTS/CONTRIBUTING match 11-tool surface and Zod v4",
    automated: true,
    guardFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
  {
    id: "no-secrets-in-responses",
    summary: "Never expose secret values in tool output (metadata only)",
    automated: false,
    guardFiles: [],
  },
  {
    id: "pnpm-build-typecheck-test",
    summary: "pnpm build, typecheck, and full test suite pass",
    automated: false,
    guardFiles: [],
  },
];

describe("Coding standards — checklist enforcement map", () => {
  it("every automated checklist rule points at existing guard test files", () => {
    const missing: string[] = [];

    for (const rule of CHECKLIST_ENFORCEMENT) {
      if (!rule.automated) continue;
      for (const file of rule.guardFiles) {
        const full = join(REPO_ROOT, file);
        if (!existsSync(full)) {
          missing.push(`${rule.id}: missing ${file}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("documents manual-only checklist gaps", () => {
    const manual = CHECKLIST_ENFORCEMENT.filter((r) => !r.automated).map((r) => r.id);
    expect(manual).toContain("no-secrets-in-responses");
    expect(manual).toContain("pnpm-build-typecheck-test");
  });

  it("standards suite entrypoint includes structural validation", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: { "standards:check"?: string };
    };
    const cmd = pkg.scripts?.["standards:check"] ?? "";
    expect(cmd).toContain("tests/coding-standards");
    expect(cmd).toContain("structural-validation.test.ts");
  });
});
