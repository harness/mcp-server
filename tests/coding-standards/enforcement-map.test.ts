/**
 * Ensures architecture guardrail tests stay wired and aligned with docs/coding-standards.md.
 * Prevents removing or renaming enforcement tests without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const GUARDRAILS_DIR = join(REPO_ROOT, "tests/coding-standards");

/** Vitest files that implement automated checks for docs/coding-standards.md. */
const ENFORCEMENT_TEST_FILES = [
  "architecture.test.ts",
  "consolidated-tools.ts",
  "docs-consistency.test.ts",
  "enforcement-map.test.ts",
  "error-handling.test.ts",
  "file-organization.test.ts",
  "input-conventions.test.ts",
  "registry-contract.test.ts",
  "registry-metadata.test.ts",
  "scope-params.test.ts",
  "toolset-helpers.ts",
  "toolset-scope.test.ts",
] as const;

/** Human-readable mapping from standards topics to guard files (documentation for contributors). */
const STANDARDS_TOPIC_COVERAGE: Record<string, readonly string[]> = {
  "§1 fixed MCP tool surface": ["architecture.test.ts", "file-organization.test.ts", "consolidated-tools.ts"],
  "§2 pure-data toolsets": ["architecture.test.ts", "toolset-helpers.ts"],
  "§3 shared response extractors": ["architecture.test.ts"],
  "§4 scoping model": ["scope-params.test.ts", "toolset-scope.test.ts", "registry-contract.test.ts"],
  "§5 identifierFields / metadata": ["registry-contract.test.ts", "registry-metadata.test.ts"],
  "§6 error handling": ["error-handling.test.ts", "architecture.test.ts"],
  "§7 stderr-only logging": ["architecture.test.ts"],
  "§8 input schema conventions": ["input-conventions.test.ts", "registry-metadata.test.ts", "architecture.test.ts"],
  "§9 write confirmation / elicitation": ["architecture.test.ts", "registry-metadata.test.ts"],
  "§10 singleton HTTP client": ["architecture.test.ts"],
  "§11 file organization": ["file-organization.test.ts"],
  "docs drift (11 tools, Zod v4)": ["docs-consistency.test.ts"],
};

describe("Coding standards — enforcement map", () => {
  it("lists every guardrail file under tests/coding-standards/", () => {
    const onDisk = readdirSync(GUARDRAILS_DIR)
      .filter((name) => name.endsWith(".ts"))
      .sort();
    expect(onDisk).toEqual([...ENFORCEMENT_TEST_FILES].sort());
  });

  it("every mapped enforcement test file exists on disk", () => {
    for (const file of ENFORCEMENT_TEST_FILES) {
      expect(existsSync(join(GUARDRAILS_DIR, file)), `missing ${file}`).toBe(true);
    }
  });

  it("topic coverage references only known enforcement files", () => {
    const known = new Set(ENFORCEMENT_TEST_FILES);
    const violations: string[] = [];

    for (const [topic, files] of Object.entries(STANDARDS_TOPIC_COVERAGE)) {
      for (const file of files) {
        if (!known.has(file)) {
          violations.push(`${topic}: unknown file ${file}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("consolidated tool count matches architecture constants", () => {
    expect(CONSOLIDATED_MCP_TOOLS).toHaveLength(11);
    expect(CONSOLIDATED_MCP_TOOLS).toContain("harness_schema");
  });
});
