/**
 * Maps docs/coding-standards.md commit checklist items to automated guards.
 *
 * When adding a new architecture rule to the docs, add or extend a test file here
 * so `pnpm standards:check` fails if the guard is removed without updating docs.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW = join(REPO_ROOT, ".github/workflows/ci.yml");

type ChecklistGuard = {
  /** Human-readable rule label (matches docs/coding-standards.md commit checklist). */
  rule: string;
  testFiles: string[];
};

const CHECKLIST_GUARDS: ChecklistGuard[] = [
  {
    rule: "Fixed consolidated MCP tool handlers (no new registerTool sites)",
    testFiles: ["architecture.test.ts", "consolidated-tools-sync.test.ts", "file-organization.test.ts"],
  },
  {
    rule: "No console.log() in src/ (stdio JSON-RPC safety)",
    testFiles: ["architecture.test.ts"],
  },
  {
    rule: "No undocumented global fetch(); HarnessClient singleton",
    testFiles: ["architecture.test.ts"],
  },
  {
    rule: "No new harness-*.ts handler files under src/tools/",
    testFiles: ["architecture.test.ts", "file-organization.test.ts"],
  },
  {
    rule: "Toolset files are pure data (forbidden imports, ToolsetDefinition export)",
    testFiles: ["architecture.test.ts"],
  },
  {
    rule: "Zod v4 import path and describe-after-optional chaining",
    testFiles: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  {
    rule: "Shared response extractors (no new inline extractors in toolsets)",
    testFiles: ["architecture.test.ts"],
  },
  {
    rule: "Scope model and optional org_id/project_id on dispatch handlers",
    testFiles: ["scope-params.test.ts", "toolset-scope.test.ts", "registry-contract.test.ts"],
  },
  {
    rule: "identifierFields, operationPolicy, and structural endpoint specs",
    testFiles: ["registry-contract.test.ts", "../registry/structural-validation.test.ts"],
  },
  {
    rule: "Write tools use confirm + confirmViaElicitation",
    testFiles: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  {
    rule: "Error handling uses errorResult and toMcpError",
    testFiles: ["error-handling.test.ts", "architecture.test.ts"],
  },
  {
    rule: "Tool input snake_case and harness_list pagination defaults",
    testFiles: ["input-conventions.test.ts"],
  },
  {
    rule: "ALL_TOOLSETS registered and ToolsetName union in sync",
    testFiles: ["architecture.test.ts", "consolidated-tools-sync.test.ts"],
  },
  {
    rule: "Documentation matches live tool count and Zod v4",
    testFiles: ["docs-consistency.test.ts"],
  },
];

describe("Coding standards — enforcement map", () => {
  it("every mapped guard file exists on disk", () => {
    const missing: string[] = [];

    for (const { rule, testFiles } of CHECKLIST_GUARDS) {
      for (const file of testFiles) {
        const full = file.startsWith("../")
          ? join(STANDARDS_DIR, file)
          : join(STANDARDS_DIR, file);
        if (!existsSync(full)) {
          missing.push(`${rule}: missing ${file}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("docs/coding-standards.md documents pnpm standards:check in the commit checklist", () => {
    const content = readFileSync(STANDARDS_DOC, "utf8");
    expect(content).toContain("pnpm standards:check");
    expect(content).toMatch(/Commit Checklist/);
  });

  it("CI workflow runs pnpm standards:check", () => {
    const workflow = readFileSync(CI_WORKFLOW, "utf8");
    expect(workflow).toContain("pnpm standards:check");
  });

  it("maps at least one automated guard per major checklist category", () => {
    expect(CHECKLIST_GUARDS.length).toBeGreaterThanOrEqual(12);
  });
});
