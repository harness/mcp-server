/**
 * Ensures every item in docs/coding-standards.md Commit Checklist is tied to an
 * automated guardrail (see enforcement-map.test.ts ENFORCEMENT_MAP).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

/** Substrings from Commit Checklist bullets → enforcement-map `rule` labels */
const CHECKLIST_TO_ENFORCEMENT_RULE: Array<{ checklistSnippet: string; enforcementRule: string }> = [
  {
    checklistSnippet: "No new `server.registerTool()` calls",
    enforcementRule: "Fixed consolidated MCP tools (no extra registerTool handlers)",
  },
  {
    checklistSnippet: "No `console.log()`",
    enforcementRule: "No console.log in src (stdio JSON-RPC safety)",
  },
  {
    checklistSnippet: "No direct `fetch()` calls",
    enforcementRule: "No undocumented global fetch(); HarnessClient singleton",
  },
  {
    checklistSnippet: "No new `harness-*.ts` handler files",
    enforcementRule: "No new harness-*.ts handler files under src/tools/",
  },
  {
    checklistSnippet: "Toolset files are pure data",
    enforcementRule: "Toolset purity (no HarnessClient / Registry / createLogger)",
  },
  {
    checklistSnippet: "All Zod params have `.describe()`",
    enforcementRule: "Zod v4 import path and describe-after-optional chaining",
  },
  {
    checklistSnippet: "Response extractors are from `extractors.ts`",
    enforcementRule: "Shared response extractors (no new inline extractors in toolsets)",
  },
  {
    checklistSnippet: "Scope is declared correctly",
    enforcementRule: "Registry scope, identifierFields, operationPolicy",
  },
  {
    checklistSnippet: "`identifierFields` are declared",
    enforcementRule: "Registry scope, identifierFields, operationPolicy",
  },
  {
    checklistSnippet: "`operationPolicy` on every endpoint",
    enforcementRule: "Registry scope, identifierFields, operationPolicy",
  },
  {
    checklistSnippet: "Write operations require confirmation",
    enforcementRule: "Write tools use confirm + elicitation; dispatch tools use toMcpError",
  },
  {
    checklistSnippet: "No secrets exposed",
    enforcementRule: "Sensitive fields redacted in errors and formatted responses",
  },
  {
    checklistSnippet: "`pnpm standards:check` passes",
    enforcementRule: "Documentation drift (11 tools, Zod v4, standards:check)",
  },
];

function loadEnforcementRules(): Set<string> {
  const mapPath = join(import.meta.dirname, "enforcement-map.test.ts");
  const content = readFileSync(mapPath, "utf8");
  const rules = new Set<string>();
  const ruleRe = /rule:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(content)) !== null) {
    rules.add(match[1]!);
  }
  return rules;
}

describe("Coding standards — commit checklist coverage", () => {
  const standards = readFileSync(STANDARDS_PATH, "utf8");
  const enforcementRules = loadEnforcementRules();

  it("docs/coding-standards.md commit checklist items are documented", () => {
    const missing: string[] = [];
    for (const { checklistSnippet } of CHECKLIST_TO_ENFORCEMENT_RULE) {
      if (!standards.includes(checklistSnippet)) {
        missing.push(checklistSnippet);
      }
    }
    expect(missing, `Missing checklist items in docs:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every commit checklist item maps to an enforcement-map rule", () => {
    const unmapped: string[] = [];
    for (const { checklistSnippet, enforcementRule } of CHECKLIST_TO_ENFORCEMENT_RULE) {
      if (!enforcementRules.has(enforcementRule)) {
        unmapped.push(`${checklistSnippet} → missing rule "${enforcementRule}"`);
      }
    }
    expect(unmapped, unmapped.join("\n")).toEqual([]);
  });
});
