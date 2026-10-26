/**
 * Maps docs/coding-standards.md commit checklist items to automated guardrails.
 * Fails if a checklist-backed test file is removed without updating this map.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type ChecklistEnforcement = {
  /** Human-readable checklist line from docs/coding-standards.md */
  checklist: string;
  /** Test file(s) that enforce it (repo-relative) */
  testFiles: string[];
  /** Substring that must appear in at least one test file (sanity check) */
  mustContain: string;
};

const ENFORCEMENT_MAP: ChecklistEnforcement[] = [
  {
    checklist: "No new registerTool() outside fixed harness handlers",
    testFiles: ["tests/coding-standards/architecture.test.ts", "tests/coding-standards/consolidated-tools.test.ts"],
    mustContain: "registerTool",
  },
  {
    checklist: "No console.log() in src/",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "console.log",
  },
  {
    checklist: "No undocumented global fetch()",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "global fetch",
  },
  {
    checklist: "No new harness-*.ts handler files",
    testFiles: [
      "tests/coding-standards/architecture.test.ts",
      "tests/coding-standards/file-organization.test.ts",
    ],
    mustContain: "harness-",
  },
  {
    checklist: "Toolset files are pure data",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "toolset purity",
  },
  {
    checklist: "Zod v4 import and describe-after-optional chaining",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "zod/v4",
  },
  {
    checklist: "Shared response extractors (no new inline extractors)",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "inline responseExtractor",
  },
  {
    checklist: "Scope declared on resources",
    testFiles: ["tests/coding-standards/toolset-scope.test.ts", "tests/coding-standards/scope-params.test.ts"],
    mustContain: "scope",
  },
  {
    checklist: "identifierFields and operationPolicy on endpoints",
    testFiles: ["tests/coding-standards/registry-contract.test.ts"],
    mustContain: "identifierFields",
  },
  {
    checklist: "Write handlers use confirm + elicitation",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "confirmViaElicitation",
  },
  {
    checklist: "ToolsetName union matches ALL_TOOLSETS",
    testFiles: ["tests/coding-standards/architecture.test.ts"],
    mustContain: "ToolsetName",
  },
  {
    checklist: "snake_case params and pagination defaults",
    testFiles: ["tests/coding-standards/input-conventions.test.ts"],
    mustContain: "snake_case",
  },
  {
    checklist: "Error handling uses toMcpError / errorResult",
    testFiles: ["tests/coding-standards/error-handling.test.ts"],
    mustContain: "toMcpError",
  },
  {
    checklist: "Docs stay on 11-tool / Zod v4 model",
    testFiles: ["tests/coding-standards/docs-consistency.test.ts"],
    mustContain: "consolidated tool handlers",
  },
  {
    checklist: "Registry structural validation",
    testFiles: ["tests/registry/structural-validation.test.ts"],
    mustContain: "structural validation",
  },
];

describe("Coding standards — enforcement map", () => {
  it("every commit checklist guardrail has on-disk test coverage", () => {
    const missing: string[] = [];

    for (const entry of ENFORCEMENT_MAP) {
      let foundContent = false;
      for (const file of entry.testFiles) {
        const full = join(REPO_ROOT, file);
        if (!existsSync(full)) {
          missing.push(`${entry.checklist}: missing file ${file}`);
          continue;
        }
        const content = readFileSync(full, "utf8");
        if (content.includes(entry.mustContain)) {
          foundContent = true;
        }
      }
      if (!foundContent) {
        missing.push(
          `${entry.checklist}: none of ${entry.testFiles.join(", ")} contain "${entry.mustContain}"`,
        );
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("standards suite includes every coding-standards test module", () => {
    const expectedModules = [
      "architecture.test.ts",
      "consolidated-tools.test.ts",
      "docs-consistency.test.ts",
      "enforcement-map.test.ts",
      "error-handling.test.ts",
      "file-organization.test.ts",
      "input-conventions.test.ts",
      "registry-contract.test.ts",
      "registry-metadata.test.ts",
      "scope-params.test.ts",
      "toolset-scope.test.ts",
    ];

    for (const module of expectedModules) {
      expect(
        existsSync(join(CODING_STANDARDS_DIR, module)),
        `missing tests/coding-standards/${module}`,
      ).toBe(true);
    }
  });
});
