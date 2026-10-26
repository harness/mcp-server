/**
 * Maps docs/coding-standards.md commit checklist items to automated guard tests.
 * When adding a new architecture rule, extend this map and the linked test file.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

type ArchitectureGuard = {
  /** Commit checklist or architecture rule label from docs/coding-standards.md */
  label: string;
  tests: string[];
};

/**
 * Manual-only items (secret values in API responses) are intentionally omitted.
 * CI runs build, typecheck, test, and standards:check via .github/workflows/ci.yml.
 */
const ARCHITECTURE_GUARDS: ArchitectureGuard[] = [
  {
    label: "fixed consolidated MCP tool surface (no extra registerTool / harness handlers)",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/consolidated-tools-sync.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
  },
  {
    label: "stderr-only logging (no console.log in src/)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "Harness API HTTP via HarnessClient singleton (no stray fetch / client instances)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "pure-data toolsets (no HarnessClient, Registry, MCP SDK, createLogger)",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
    ],
  },
  {
    label: "shared response extractors (no new inline extractors in toolsets)",
    tests: ["tests/coding-standards/architecture.test.ts"],
  },
  {
    label: "registry registration (ALL_TOOLSETS ↔ ToolsetName union)",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/registry/structural-validation.test.ts",
    ],
  },
  {
    label: "scope model and scope params on dispatch handlers",
    tests: [
      "tests/coding-standards/scope-params.test.ts",
      "tests/coding-standards/toolset-scope.test.ts",
      "tests/coding-standards/registry-contract.test.ts",
    ],
  },
  {
    label: "identifierFields, deep links, and operationPolicy on endpoints",
    tests: [
      "tests/coding-standards/registry-metadata.test.ts",
      "tests/coding-standards/registry-contract.test.ts",
    ],
  },
  {
    label: "tool input conventions (snake_case, pagination defaults, Zod v4 describe order)",
    tests: [
      "tests/coding-standards/input-conventions.test.ts",
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    label: "error handling (toMcpError, errorResult, HarnessApiError mapping)",
    tests: ["tests/coding-standards/error-handling.test.ts"],
  },
  {
    label: "write safety (confirm param + confirmViaElicitation)",
    tests: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/registry-metadata.test.ts",
    ],
  },
  {
    label: "documentation stays aligned with enforced constants (11 tools, Zod v4)",
    tests: ["tests/coding-standards/docs-consistency.test.ts"],
  },
];

function repoPath(relative: string): string {
  return join(REPO_ROOT, relative);
}

describe("Coding standards — architecture enforcement map", () => {
  for (const guard of ARCHITECTURE_GUARDS) {
    it(`keeps automated tests for ${guard.label}`, () => {
      for (const testFile of guard.tests) {
        expect(existsSync(repoPath(testFile)), `missing guard test ${testFile}`).toBe(true);
      }
    });
  }

  it("pnpm standards:check includes coding-standards and structural-validation suites", () => {
    const packageJson = JSON.parse(readFileSync(repoPath("package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    const script = packageJson.scripts?.["standards:check"] ?? "";
    expect(script).toContain("tests/coding-standards");
    expect(script).toContain("tests/registry/structural-validation.test.ts");
  });
});
