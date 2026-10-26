/**
 * Ensures architecture guardrail tests stay wired and aligned with docs/coding-standards.md.
 * Prevents removing or renaming enforcement tests without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOLS } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const GUARDRAILS_DIR = join(REPO_ROOT, "tests/coding-standards");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW_PATH = join(REPO_ROOT, ".github/workflows/ci.yml");

/** Vitest files that implement automated checks for docs/coding-standards.md. */
const ENFORCEMENT_TEST_FILES = [
  "architecture.test.ts",
  "consolidated-tools.test.ts",
  "consolidated-tools.ts",
  "docs-consistency.test.ts",
  "enforcement-map.test.ts",
  "error-handling.test.ts",
  "error-sanitization.test.ts",
  "file-organization.test.ts",
  "input-conventions.test.ts",
  "registry-contract.test.ts",
  "registry-metadata.test.ts",
  "scope-params.test.ts",
  "security-regression-map.test.ts",
  "toolset-scope.test.ts",
] as const;

/** Human-readable mapping from standards topics to guard files (documentation for contributors). */
const STANDARDS_TOPIC_COVERAGE: Record<string, readonly string[]> = {
  "§1 fixed MCP tool surface": [
    "architecture.test.ts",
    "file-organization.test.ts",
    "consolidated-tools.ts",
    "consolidated-tools.test.ts",
  ],
  "§2 pure-data toolsets": ["architecture.test.ts"],
  "§3 shared response extractors": ["architecture.test.ts"],
  "§4 scoping model": ["scope-params.test.ts", "toolset-scope.test.ts", "registry-contract.test.ts"],
  "§5 identifierFields / metadata": ["registry-contract.test.ts", "registry-metadata.test.ts"],
  "§6 error handling": ["error-handling.test.ts", "architecture.test.ts"],
  "§7 stderr-only logging": ["architecture.test.ts"],
  "§8 input schema conventions": [
    "input-conventions.test.ts",
    "registry-metadata.test.ts",
    "architecture.test.ts",
  ],
  "§9 write confirmation / elicitation": ["architecture.test.ts", "registry-metadata.test.ts"],
  "§9 secrets / safe error and log surfaces": ["error-sanitization.test.ts"],
  "§10 HTTP client singleton / fetch exceptions": ["architecture.test.ts"],
  "§11 file organization": ["file-organization.test.ts"],
  "docs drift (11 tools, Zod v4)": ["docs-consistency.test.ts"],
  "security regression (deps, HTTP, image)": ["security-regression-map.test.ts"],
};

/**
 * Maps docs/coding-standards.md Commit Checklist bullets to guardrail test files.
 * Build/typecheck/test are enforced in CI — see commitChecklistCiCoverage test.
 */
const COMMIT_CHECKLIST_GUARDS: Record<string, readonly string[]> = {
  "No new `server.registerTool()` calls": ["architecture.test.ts"],
  "No `console.log()`": ["architecture.test.ts"],
  "No direct `fetch()` calls": ["architecture.test.ts"],
  "No new `harness-*.ts` handler files": ["architecture.test.ts"],
  "Toolset files are pure data": ["architecture.test.ts"],
  "All Zod params have `.describe()`": ["architecture.test.ts", "input-conventions.test.ts"],
  "Response extractors are from `extractors.ts`": ["architecture.test.ts"],
  "Scope is declared correctly": ["scope-params.test.ts", "toolset-scope.test.ts"],
  "`identifierFields` are declared": ["registry-metadata.test.ts", "registry-contract.test.ts"],
  "`operationPolicy` on every endpoint": ["registry-contract.test.ts"],
  "Write operations require confirmation": ["architecture.test.ts"],
  "No secrets exposed": ["error-sanitization.test.ts"],
  "`pnpm standards:check` passes": ["enforcement-map.test.ts"],
};

const COMMIT_CHECKLIST_CI_COMMANDS = ["pnpm build", "pnpm typecheck", "pnpm test"] as const;

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

  it("commit checklist bullets in docs map to automated guardrail tests", () => {
    const standards = readFileSync(STANDARDS_PATH, "utf8");
    const known = new Set(ENFORCEMENT_TEST_FILES);
    const violations: string[] = [];

    for (const [bullet, files] of Object.entries(COMMIT_CHECKLIST_GUARDS)) {
      if (!standards.includes(bullet)) {
        violations.push(`docs/coding-standards.md missing checklist bullet: ${bullet}`);
      }
      for (const file of files) {
        if (!known.has(file)) {
          violations.push(`${bullet}: unknown guard file ${file}`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("commit checklist build/typecheck/test commands run in CI", () => {
    const standards = readFileSync(STANDARDS_PATH, "utf8");
    const ci = readFileSync(CI_WORKFLOW_PATH, "utf8");

    for (const cmd of COMMIT_CHECKLIST_CI_COMMANDS) {
      expect(standards, `docs missing ${cmd} checklist item`).toContain(cmd);
      expect(ci, `.github/workflows/ci.yml missing ${cmd}`).toContain(cmd);
    }
    expect(ci).toContain("pnpm standards:check");
  });
});
