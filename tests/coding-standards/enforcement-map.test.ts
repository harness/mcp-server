/**
 * Maps docs/coding-standards.md commit checklist items to automated guardrails.
 * Fails if a checklist rule loses its enforcing test file or key assertion pattern.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONSOLIDATED_MCP_TOOLS,
  CONSOLIDATED_MCP_TOOL_COUNT,
} from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");
const CODING_STANDARDS_DIR = join(REPO_ROOT, "tests/coding-standards");

type EnforcementEntry = {
  topic: string;
  testFiles: string[];
  mustMatch: RegExp;
};

const CHECKLIST_ENFORCEMENT: EnforcementEntry[] = [
  {
    topic: "no extra registerTool() beyond 11 handlers",
    testFiles: ["architecture.test.ts"],
    mustMatch: /only allows registerTool\(\) in the 11 harness handler files/,
  },
  {
    topic: "no console.log() in src/",
    testFiles: ["architecture.test.ts"],
    mustMatch: /never uses console\.log\(\) in src\//,
  },
  {
    topic: "global fetch() only in documented exceptions",
    testFiles: ["architecture.test.ts"],
    mustMatch: /only uses global fetch\(\) in documented exception files/,
  },
  {
    topic: "src/tools/ file organization",
    testFiles: ["file-organization.test.ts"],
    mustMatch: /src\/tools\/ contains only the 11 harness handlers/,
  },
  {
    topic: "toolset purity (forbidden imports)",
    testFiles: ["architecture.test.ts"],
    mustMatch: /toolset files do not import HarnessClient, McpServer, or Registry/,
  },
  {
    topic: "Zod v4 import path in handlers",
    testFiles: ["architecture.test.ts"],
    mustMatch: /zod\/v4/,
  },
  {
    topic: "registry scope and identifierFields",
    testFiles: ["registry-contract.test.ts"],
    mustMatch: /every resource declares identifierFields/,
  },
  {
    topic: "operationPolicy on every endpoint",
    testFiles: ["registry-contract.test.ts"],
    mustMatch: /every endpoint spec declares operationPolicy/,
  },
  {
    topic: "write tools use confirm + elicitation",
    testFiles: ["architecture.test.ts"],
    mustMatch: /write tool handlers declare confirm param and use elicitation/,
  },
  {
    topic: "error handling (toMcpError / errorResult)",
    testFiles: ["error-handling.test.ts"],
    mustMatch: /API-calling handlers import and use toMcpError/,
  },
  {
    topic: "pagination defaults on harness_list",
    testFiles: ["input-conventions.test.ts"],
    mustMatch: /pagination defaults page=0 and size=20/,
  },
  {
    topic: "docs stay on 11 tools and Zod v4",
    testFiles: ["docs-consistency.test.ts"],
    mustMatch: /documents 11 consolidated MCP tools/,
  },
  {
    topic: "docs reject legacy 10-tool and server.tool() wording",
    testFiles: ["docs-consistency.test.ts"],
    mustMatch: /does not regress to legacy 10-tool/,
  },
];

function readTestFile(name: string): string {
  const path = join(CODING_STANDARDS_DIR, name);
  expect(existsSync(path), `missing guardrail file tests/coding-standards/${name}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("Coding standards — enforcement map (commit checklist)", () => {
  for (const entry of CHECKLIST_ENFORCEMENT) {
    it(entry.topic, () => {
      for (const file of entry.testFiles) {
        const content = readTestFile(file);
        expect(content, `${file} should enforce: ${entry.topic}`).toMatch(entry.mustMatch);
      }
    });
  }

  it("SSOT tool list matches docs/coding-standards.md", () => {
    const doc = readFileSync(STANDARDS_DOC, "utf8");
    expect(doc).toMatch(new RegExp(`${CONSOLIDATED_MCP_TOOL_COUNT} consolidated tool handlers`));
    for (const tool of CONSOLIDATED_MCP_TOOLS) {
      expect(doc, `docs missing ${tool}`).toContain(tool);
    }
  });
});
