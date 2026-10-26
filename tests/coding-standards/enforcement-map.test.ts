/**
 * Maps docs/coding-standards.md commit-checklist items to automated guardrails.
 * Fails when a checklist rule loses test coverage or the doc drops a mapped phrase.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type EnforcementEntry = {
  /** Substring that must appear in the Commit Checklist section of coding-standards.md */
  checklistPhrase: string;
  /** Test modules (basename) that enforce the rule */
  testBasenames: string[];
};

const ENFORCEMENT_MAP: EnforcementEntry[] = [
  {
    checklistPhrase: "No new `server.registerTool()` calls",
    testBasenames: ["architecture.test.ts"],
  },
  {
    checklistPhrase: "No `console.log()`",
    testBasenames: ["architecture.test.ts"],
  },
  {
    checklistPhrase: "No direct `fetch()` calls",
    testBasenames: ["architecture.test.ts"],
  },
  {
    checklistPhrase: "No new `harness-*.ts` handler files",
    testBasenames: ["architecture.test.ts", "file-organization.test.ts"],
  },
  {
    checklistPhrase: "Toolset files are pure data",
    testBasenames: ["architecture.test.ts"],
  },
  {
    checklistPhrase: "All Zod params have `.describe()`",
    testBasenames: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  {
    checklistPhrase: "Response extractors are from `extractors.ts`",
    testBasenames: ["architecture.test.ts"],
  },
  {
    checklistPhrase: "Scope is declared correctly",
    testBasenames: ["registry-contract.test.ts", "toolset-scope.test.ts"],
  },
  {
    checklistPhrase: "`identifierFields` are declared",
    testBasenames: ["registry-contract.test.ts"],
  },
  {
    checklistPhrase: "`operationPolicy` on every endpoint",
    testBasenames: ["registry-contract.test.ts"],
  },
  {
    checklistPhrase: "Write operations require confirmation",
    testBasenames: ["architecture.test.ts", "registry-metadata.test.ts"],
  },
  {
    checklistPhrase: "No secrets exposed",
    testBasenames: ["secrets-redaction-guard.test.ts"],
  },
  {
    checklistPhrase: "`pnpm standards:check` passes",
    testBasenames: [
      "docs-consistency.test.ts",
      "enforcement-map.test.ts",
      "consolidated-tools-sync.test.ts",
      "security-regression-map.test.ts",
    ],
  },
];


describe("Coding standards — enforcement map", () => {
  const standardsContent = readFileSync(STANDARDS_DOC, "utf8");
  const checklistStart = standardsContent.indexOf("## Commit Checklist");
  expect(checklistStart, "docs/coding-standards.md must have a Commit Checklist section").toBeGreaterThanOrEqual(0);
  const checklistSection = standardsContent.slice(checklistStart);

  it("every mapped checklist item is documented in docs/coding-standards.md", () => {
    const missing: string[] = [];
    for (const { checklistPhrase } of ENFORCEMENT_MAP) {
      if (!checklistSection.includes(checklistPhrase)) {
        missing.push(checklistPhrase);
      }
    }
    expect(missing, `Missing checklist phrases:\n${missing.join("\n")}`).toEqual([]);
  });

  it("every mapped rule has at least one existing test module", () => {
    const missing: string[] = [];
    for (const { checklistPhrase, testBasenames } of ENFORCEMENT_MAP) {
      for (const basename of testBasenames) {
        const path = join(CODING_STANDARDS_DIR, basename);
        if (!existsSync(path)) {
          missing.push(`${checklistPhrase} → missing ${basename}`);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("structural registry invariants run under standards:check", () => {
    const structural = join(REPO_ROOT, "tests/registry/structural-validation.test.ts");
    expect(existsSync(structural)).toBe(true);
  });
});
