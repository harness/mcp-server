/**
 * Ensures every major docs/coding-standards.md rule has automated coverage.
 * Update this map when adding new guardrail tests.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

const RULE_TO_TEST_FILES: Record<string, readonly string[]> = {
  "§1 — fixed consolidated MCP tools (no new handlers)": [
    "architecture.test.ts",
    "file-organization.test.ts",
  ],
  "§2 — pure-data toolsets": ["architecture.test.ts"],
  "§3 — shared response extractors": ["architecture.test.ts"],
  "§4 — Harness scoping model": ["scope-params.test.ts", "toolset-scope.test.ts"],
  "§5 — identifierFields and registry metadata": [
    "registry-metadata.test.ts",
    "registry-contract.test.ts",
  ],
  "§6 — error handling pattern": ["error-handling.test.ts", "architecture.test.ts"],
  "§7 — stderr-only logging (no console.log)": ["architecture.test.ts"],
  "§8 — tool input schema conventions": [
    "input-conventions.test.ts",
    "registry-metadata.test.ts",
  ],
  "§9 — write confirmation / safety": ["architecture.test.ts", "registry-metadata.test.ts"],
  "§10 — singleton HarnessClient": ["architecture.test.ts"],
  "§11 — file organization": ["file-organization.test.ts"],
  "docs — coding-standards.md drift prevention": ["docs-consistency.test.ts"],
  "registry — structural validation": ["structural-validation.test.ts"],
};

const EXTRA_TEST_PATHS: Record<string, string> = {
  "structural-validation.test.ts": join(REPO_ROOT, "tests/registry/structural-validation.test.ts"),
};

describe("Coding standards — enforcement map", () => {
  it(`documents automated coverage for all major rules (${CONSOLIDATED_TOOL_COUNT} consolidated tools)`, () => {
    const missing: string[] = [];

    for (const [rule, files] of Object.entries(RULE_TO_TEST_FILES)) {
      for (const file of files) {
        const path = EXTRA_TEST_PATHS[file] ?? join(CODING_STANDARDS_DIR, file);
        if (!existsSync(path)) {
          missing.push(`${rule}: missing ${file}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("covers at least one test file per standards section", () => {
    expect(Object.keys(RULE_TO_TEST_FILES).length).toBeGreaterThanOrEqual(10);
  });
});
