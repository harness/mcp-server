/**
 * Maps docs/coding-standards.md "Commit Checklist" bullets to automated guardrails.
 * Fails when a checklist rule loses its enforcing test (rename/delete detection).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type EnforcementEntry = {
  checklist: string;
  paths: string[];
  needle: string | RegExp;
};

function readRepo(path: string): string {
  const full = path.startsWith("tests/") ? join(REPO_ROOT, path) : join(STANDARDS_DIR, path);
  expect(existsSync(full), `missing guardrail file: ${path}`).toBe(true);
  return readFileSync(full, "utf8");
}

const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    checklist: "No new registerTool() outside fixed harness handlers",
    paths: ["architecture.test.ts"],
    needle: "only allows registerTool() in the",
  },
  {
    checklist: "No console.log() in src/",
    paths: ["architecture.test.ts"],
    needle: "never uses console.log() in src/",
  },
  {
    checklist: "No undocumented global fetch()",
    paths: ["architecture.test.ts"],
    needle: "only uses global fetch() in documented exception files",
  },
  {
    checklist: "No new harness-*.ts handler files",
    paths: ["architecture.test.ts"],
    needle: "does not add new harness-*.ts handler files",
  },
  {
    checklist: "src/tools/ limited to fixed handlers and shared helpers",
    paths: ["file-organization.test.ts"],
    needle: "ALLOWED_TOOLS_ROOT_FILES",
  },
  {
    checklist: "Toolset files are pure data (forbidden imports)",
    paths: ["architecture.test.ts"],
    needle: "do not import HarnessClient, McpServer, or Registry",
  },
  {
    checklist: "Zod v4 import path in tool handlers",
    paths: ["architecture.test.ts"],
    needle: 'use import * as z from "zod/v4"',
  },
  {
    checklist: "inputSchema properties chain .describe()",
    paths: ["registry-metadata.test.ts"],
    needle: "every harness handler inputSchema property chains .describe()",
  },
  {
    checklist: "Shared response extractors (no new inline extractors)",
    paths: ["architecture.test.ts"],
    needle: "does not add new inline responseExtractor",
  },
  {
    checklist: "Scope model and scope param injection",
    paths: ["toolset-scope.test.ts", "scope-params.test.ts"],
    needle: "scope",
  },
  {
    checklist: "identifierFields on every resource",
    paths: ["registry-contract.test.ts"],
    needle: "every resource declares identifierFields",
  },
  {
    checklist: "operationPolicy on every endpoint",
    paths: ["registry-contract.test.ts"],
    needle: "every endpoint spec declares operationPolicy",
  },
  {
    checklist: "Write handlers use confirm + elicitation",
    paths: ["architecture.test.ts"],
    needle: "write tool handlers declare confirm param",
  },
  {
    checklist: "Error handling: toMcpError + errorResult",
    paths: ["error-handling.test.ts"],
    needle: "API-calling handlers import and use toMcpError",
  },
  {
    checklist: "ToolsetName union matches ALL_TOOLSETS",
    paths: ["architecture.test.ts"],
    needle: "ALL_TOOLSET_NAMES matches the ToolsetName union",
  },
  {
    checklist: "Docs cannot regress to outdated 10-tool / Zod v3 copy",
    paths: ["docs-consistency.test.ts"],
    needle: "does not regress to outdated architecture copy",
  },
  {
    checklist: "Registry structural validation (operationPolicy contract)",
    paths: ["tests/registry/structural-validation.test.ts"],
    needle: "operationPolicy contract",
  },
];

describe("Coding standards — commit checklist enforcement map", () => {
  it("docs/coding-standards.md documents pnpm standards:check for the checklist", () => {
    const docs = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    expect(docs).toContain("pnpm standards:check");
    expect(docs).toContain("## Commit Checklist");
  });

  for (const entry of ENFORCEMENT_MAP) {
    it(entry.checklist, () => {
      for (const path of entry.paths) {
        const content = readRepo(path);
        if (typeof entry.needle === "string") {
          expect(content, path).toContain(entry.needle);
        } else {
          expect(content, path).toMatch(entry.needle);
        }
      }
    });
  }
});
