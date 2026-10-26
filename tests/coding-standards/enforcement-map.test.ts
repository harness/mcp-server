/**
 * Maps docs/coding-standards.md rules to the Vitest files that enforce them.
 * Fails if a guardrail file is removed/renamed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

/** Rule label → enforcing test module(s) under tests/coding-standards/. */
const RULE_ENFORCEMENT: Record<string, string[]> = {
  "§1 Never add new MCP tool handlers": ["architecture.test.ts"],
  "§2 Toolset definitions are pure data": ["architecture.test.ts"],
  "§3 Shared response extractors": ["architecture.test.ts"],
  "§4 Harness scoping model": ["scope-params.test.ts", "toolset-scope.test.ts", "registry-contract.test.ts"],
  "§5 Identifier fields and deep links": ["registry-contract.test.ts", "registry-metadata.test.ts"],
  "§6 Error handling pattern": ["error-handling.test.ts", "architecture.test.ts"],
  "§7 Logging rules": ["architecture.test.ts"],
  "§8 Tool input schema standards": ["input-conventions.test.ts", "registry-metadata.test.ts", "architecture.test.ts"],
  "§9 Safety and security": ["registry-metadata.test.ts", "architecture.test.ts"],
  "§10 Error handling principles": ["error-handling.test.ts"],
  "§11 HTTP client singleton": ["architecture.test.ts"],
  "§12 File organization": ["file-organization.test.ts", "architecture.test.ts"],
  "Documentation drift (11 tools, Zod v4)": ["docs-consistency.test.ts", "consolidated-tools.ts"],
};

/** Also enforced outside this directory (wired via pnpm standards:check). */
const EXTERNAL_ENFORCEMENT = [
  "tests/registry/structural-validation.test.ts",
] as const;

describe("Coding standards — enforcement map", () => {
  it("every mapped guardrail test file exists", () => {
    const missing: string[] = [];

    for (const files of Object.values(RULE_ENFORCEMENT)) {
      for (const file of files) {
        const full = join(STANDARDS_DIR, file);
        if (!existsSync(full)) {
          missing.push(file);
        }
      }
    }

    for (const rel of EXTERNAL_ENFORCEMENT) {
      if (!existsSync(join(REPO_ROOT, rel))) {
        missing.push(rel);
      }
    }

    expect(missing, `Missing enforcement files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("docs/coding-standards.md headings for mapped rules are present", () => {
    const content = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    const requiredHeadings = [
      "### 1. Never Add New MCP Tool Handlers",
      "### 2. Toolset Definitions Are Pure Data",
      "### 3. Use Shared Response Extractors",
      "### 4. Follow the Harness Scoping Model",
      "### 5. Identifier Fields and Deep Links",
      "### 6. Error Handling Pattern",
      "### 7. Logging Rules (CRITICAL)",
      "### 8. Tool Input Schema Standards",
      "### 9. Safety and Security Rules",
      "### 10. Error Handling Principles",
      "### 11. HTTP Client Is Singleton",
      "### 12. File Organization Rules",
    ];

    for (const heading of requiredHeadings) {
      expect(content, `missing ${heading}`).toContain(heading);
    }
  });
});
