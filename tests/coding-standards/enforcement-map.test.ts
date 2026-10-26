/**
 * Living index: docs/coding-standards.md commit checklist → guardrail test files.
 * Fails CI if a mapped test is renamed or removed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");

/** Subset of the commit checklist in docs/coding-standards.md with enforcing tests. */
const ENFORCEMENT_MAP: Array<{ rule: string; testFiles: string[] }> = [
  {
    rule: "Fixed consolidated MCP tools (no new harness handlers)",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools-sync.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    rule: "No console.log in src/; pure toolsets",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "HTTP via HarnessClient singleton; no raw fetch in tools/toolsets",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    rule: "Toolset purity and shared extractors",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    rule: "Zod v4, input conventions, registry metadata",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    rule: "Registry registration and resource contracts",
    testFiles: [
      "tests/coding-standards/registry-contract.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    rule: "Error handling and write confirmation elicitation",
    testFiles: [
      "tests/coding-standards/error-handling.test.ts",
      "tests/coding-standards/architecture.test.ts",
    ],
  },
  {
    rule: "Documentation drift (tool count, Zod v4, registerTool)",
    testFiles: ["tests/coding-standards/docs-consistency.test.ts"],
  },
];

describe("Coding standards — enforcement map", () => {
  for (const { rule, testFiles } of ENFORCEMENT_MAP) {
    it(rule, () => {
      for (const file of testFiles) {
        expect(existsSync(join(REPO_ROOT, file)), `missing guardrail test file: ${file}`).toBe(
          true,
        );
      }
    });
  }
});
