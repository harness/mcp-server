/**
 * Maps docs/coding-standards.md Commit Checklist items to automated guard tests.
 * Fails if a guard file is removed or renamed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

/** Checklist theme → vitest files that enforce it (under tests/). */
const CHECKLIST_GUARDS: Array<{ theme: string; guards: string[] }> = [
  {
    theme: "Fixed consolidated MCP tools (no extra registerTool / harness-*.ts handlers)",
    guards: [
      "coding-standards/architecture.test.ts",
      "coding-standards/consolidated-tools-sync.test.ts",
      "coding-standards/file-organization.test.ts",
    ],
  },
  {
    theme: "stderr-only logging (no console.log in src/)",
    guards: ["coding-standards/architecture.test.ts"],
  },
  {
    theme: "HarnessClient singleton and documented fetch() exceptions",
    guards: ["coding-standards/architecture.test.ts"],
  },
  {
    theme: "Pure-data toolsets (no HarnessClient / Registry / createLogger)",
    guards: ["coding-standards/architecture.test.ts"],
  },
  {
    theme: "Zod v4 import path and describe() chaining order",
    guards: [
      "coding-standards/architecture.test.ts",
      "tools/zod-input-schema-descriptions.test.ts",
    ],
  },
  {
    theme: "Shared response extractors (inline legacy caps)",
    guards: ["coding-standards/architecture.test.ts"],
  },
  {
    theme: "Scope, identifierFields, operationPolicy on registry resources",
    guards: [
      "coding-standards/registry-contract.test.ts",
      "coding-standards/registry-metadata.test.ts",
      "coding-standards/scope-params.test.ts",
      "coding-standards/toolset-scope.test.ts",
      "registry/structural-validation.test.ts",
    ],
  },
  {
    theme: "Write handlers use confirm + elicitation; dispatch tools use toMcpError",
    guards: [
      "coding-standards/architecture.test.ts",
      "coding-standards/error-handling.test.ts",
    ],
  },
  {
    theme: "Tool input snake_case and harness_list pagination defaults",
    guards: ["coding-standards/input-conventions.test.ts"],
  },
  {
    theme: "Documentation stays on 11-tool / Zod v4 architecture",
    guards: ["coding-standards/docs-consistency.test.ts"],
  },
];

describe("Coding standards — commit checklist enforcement map", () => {
  it("every mapped guard test file exists", () => {
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const { guards } of CHECKLIST_GUARDS) {
      for (const guard of guards) {
        if (seen.has(guard)) continue;
        seen.add(guard);
        const path = join(REPO_ROOT, "tests", guard);
        if (!existsSync(path)) {
          missing.push(`tests/${guard}`);
        }
      }
    }

    expect(missing, `Missing guard files:\n${missing.join("\n")}`).toEqual([]);
  });

  it("docs/coding-standards.md documents pnpm standards:check on the commit checklist", () => {
    const content = readFileSync(STANDARDS_PATH, "utf8");
    expect(content).toMatch(/pnpm standards:check/);
    expect(content).toMatch(/Commit Checklist/);
  });

  it("package.json description reflects the fixed consolidated tool count", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      description?: string;
    };
    expect(pkg.description).toMatch(new RegExp(`${CONSOLIDATED_TOOL_COUNT} MCP tools`));
  });

  it("covers every checklist theme with at least one guard file", () => {
    expect(CHECKLIST_GUARDS.length).toBeGreaterThanOrEqual(8);
    for (const { theme, guards } of CHECKLIST_GUARDS) {
      expect(guards.length, `${theme} has no guards`).toBeGreaterThan(0);
    }
  });
});
