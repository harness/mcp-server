/**
 * Maps docs/coding-standards.md commit-checklist rules to automated guardrails.
 * Fails if a guardrail test file is removed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Human-readable rule label → vitest file (repo-relative). */
const ENFORCEMENT_MAP: ReadonlyArray<{ rule: string; testFile: string }> = [
  {
    rule: "Fixed consolidated MCP tools (no extra registerTool / harness-*.ts handlers)",
    testFile: "tests/coding-standards/architecture.test.ts",
  },
  {
    rule: "stderr-only logging, singleton HarnessClient, fetch() exceptions",
    testFile: "tests/coding-standards/architecture.test.ts",
  },
  {
    rule: "Pure-data toolsets (no HarnessClient / Registry / createLogger)",
    testFile: "tests/coding-standards/architecture.test.ts",
  },
  {
    rule: "Toolset registration ↔ ToolsetName union",
    testFile: "tests/coding-standards/architecture.test.ts",
  },
  {
    rule: "Write handlers: confirm + elicitation; dispatch handlers: toMcpError / errorResult",
    testFile: "tests/coding-standards/architecture.test.ts",
  },
  {
    rule: "Zod v4 imports and registerTool (not server.tool)",
    testFile: "tests/coding-standards/architecture.test.ts",
  },
  {
    rule: "src/tools/ file organization",
    testFile: "tests/coding-standards/file-organization.test.ts",
  },
  {
    rule: "Pagination defaults and snake_case input params",
    testFile: "tests/coding-standards/input-conventions.test.ts",
  },
  {
    rule: "Registry metadata (identifierFields, deep links, scope params)",
    testFile: "tests/coding-standards/registry-metadata.test.ts",
  },
  {
    rule: "Registry dispatch contract",
    testFile: "tests/coding-standards/registry-contract.test.ts",
  },
  {
    rule: "Scope param injection rules",
    testFile: "tests/coding-standards/scope-params.test.ts",
  },
  {
    rule: "Toolset scope declarations",
    testFile: "tests/coding-standards/toolset-scope.test.ts",
  },
  {
    rule: "Error handling patterns in handlers",
    testFile: "tests/coding-standards/error-handling.test.ts",
  },
  {
    rule: "Docs aligned with 11-tool / Zod v4 model",
    testFile: "tests/coding-standards/docs-consistency.test.ts",
  },
  {
    rule: "Structural validation (operationPolicy, bodySchema, paths)",
    testFile: "tests/registry/structural-validation.test.ts",
  },
];

describe("Coding standards — enforcement map", () => {
  it("documents a guardrail test file for each automated checklist area", () => {
    expect(ENFORCEMENT_MAP.length).toBeGreaterThanOrEqual(10);
  });

  it("every mapped guardrail test file exists on disk", () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const { testFile } of ENFORCEMENT_MAP) {
      if (seen.has(testFile)) continue;
      seen.add(testFile);
      if (!existsSync(join(REPO_ROOT, testFile))) {
        missing.push(testFile);
      }
    }

    expect(missing, `Missing guardrail tests:\n${missing.join("\n")}`).toEqual([]);
  });
});
