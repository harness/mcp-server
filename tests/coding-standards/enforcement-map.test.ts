/**
 * Living map from docs/coding-standards.md rules to automated guardrail tests.
 *
 * When you add a new architecture rule or a new file under tests/coding-standards/,
 * update STANDARDS_ENFORCEMENT_MAP and implement the corresponding tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

/**
 * Rule topics (aligned with docs/coding-standards.md) → enforcing test files.
 * consolidated-tools.ts is the tool-name SSOT imported by other tests, not a Vitest file.
 */
export const STANDARDS_ENFORCEMENT_MAP: Record<string, readonly string[]> = {
  "§1 Fixed consolidated MCP tools (no new handlers)": [
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/file-organization.test.ts",
    "tests/coding-standards/consolidated-tools.ts",
  ],
  "§2 Pure-data toolsets": ["tests/coding-standards/architecture.test.ts"],
  "§3 Shared response extractors": ["tests/coding-standards/architecture.test.ts"],
  "§4 Harness scoping model": [
    "tests/coding-standards/toolset-scope.test.ts",
    "tests/coding-standards/scope-params.test.ts",
  ],
  "§5 Identifier fields and handler metadata": [
    "tests/coding-standards/registry-contract.test.ts",
    "tests/coding-standards/registry-metadata.test.ts",
    "tests/registry/structural-validation.test.ts",
  ],
  "§6 Error handling pattern": ["tests/coding-standards/error-handling.test.ts"],
  "§7 Logging (stderr only, no console.log in src/)": ["tests/coding-standards/architecture.test.ts"],
  "§8 Tool input schema conventions": [
    "tests/coding-standards/input-conventions.test.ts",
    "tests/coding-standards/architecture.test.ts",
    "tests/coding-standards/scope-params.test.ts",
  ],
  "§9 Write confirmation and elicitation": ["tests/coding-standards/architecture.test.ts"],
  "§10 HTTP client singleton and fetch allowlist": ["tests/coding-standards/architecture.test.ts"],
  "§11 File organization": ["tests/coding-standards/file-organization.test.ts"],
  "Documentation consistency (11 tools, Zod v4)": ["tests/coding-standards/docs-consistency.test.ts"],
};

const ALL_MAPPED_PATHS = [
  ...new Set(Object.values(STANDARDS_ENFORCEMENT_MAP).flat()),
];

describe("Coding standards — enforcement map", () => {
  it("every mapped guardrail file exists on disk", () => {
    const missing: string[] = [];
    for (const file of ALL_MAPPED_PATHS) {
      if (!existsSync(join(REPO_ROOT, file))) {
        missing.push(file);
      }
    }
    expect(missing, `Missing enforcement files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every tests/coding-standards/*.test.ts file is listed in the enforcement map", () => {
    const testFiles = readdirSync(CODING_STANDARDS_DIR).filter((f) => f.endsWith(".test.ts"));
    const unmapped: string[] = [];

    for (const name of testFiles) {
      const rel = `tests/coding-standards/${name}`;
      if (rel === "tests/coding-standards/enforcement-map.test.ts") continue;
      if (!ALL_MAPPED_PATHS.includes(rel)) {
        unmapped.push(rel);
      }
    }

    expect(
      unmapped,
      `Add these files to STANDARDS_ENFORCEMENT_MAP in enforcement-map.test.ts:\n${unmapped.join("\n")}`,
    ).toEqual([]);
  });

  it("structural-validation is part of standards:check coverage", () => {
    expect(ALL_MAPPED_PATHS).toContain("tests/registry/structural-validation.test.ts");
  });
});
