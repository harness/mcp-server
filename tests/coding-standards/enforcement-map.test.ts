/**
 * Documents which automated tests enforce each commit-checklist item in
 * docs/coding-standards.md — prevents checklist drift without guardrails.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CONSOLIDATED_MCP_TOOL_COUNT } from "./consolidated-tools.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const CODING_STANDARDS_DIR = join(import.meta.dirname, ".");

/** Commit checklist bullets in docs/coding-standards.md → test files that enforce them. */
const CHECKLIST_ENFORCEMENT: Record<string, string[]> = {
  "No new server.registerTool()": ["architecture.test.ts"],
  "No console.log()": ["architecture.test.ts"],
  "No direct fetch()": ["architecture.test.ts"],
  "No new harness-*.ts handler files": ["architecture.test.ts", "file-organization.test.ts"],
  "Toolset files are pure data": ["architecture.test.ts"],
  "Zod params .describe() chaining": ["architecture.test.ts", "registry-metadata.test.ts"],
  "Response extractors from extractors.ts": ["architecture.test.ts"],
  "Scope declared correctly": ["toolset-scope.test.ts", "structural-validation.test.ts"],
  "identifierFields declared": ["registry-metadata.test.ts", "structural-validation.test.ts"],
  "operationPolicy on every endpoint": ["structural-validation.test.ts"],
  "Write operations require confirmation": ["architecture.test.ts", "registry-metadata.test.ts"],
  "pnpm standards:check": ["docs-consistency.test.ts"],
};

describe("Coding standards — enforcement map", () => {
  it("documents 11 consolidated MCP tools in the shared module", () => {
    expect(CONSOLIDATED_MCP_TOOL_COUNT).toBe(11);
  });

  it("every mapped guardrail test file exists under tests/coding-standards/ or tests/registry/", () => {
    const missing: string[] = [];

    for (const files of Object.values(CHECKLIST_ENFORCEMENT)) {
      for (const file of files) {
        const underCoding = join(CODING_STANDARDS_DIR, file);
        const underRegistry = join(REPO_ROOT, "tests/registry", file);
        if (!existsSync(underCoding) && !existsSync(underRegistry)) {
          missing.push(file);
        }
      }
    }

    expect(missing, `Missing enforcement test files: ${missing.join(", ")}`).toEqual([]);
  });

  it("docs/coding-standards.md commit checklist still references standards:check", () => {
    const content = readFileSync(join(REPO_ROOT, "docs/coding-standards.md"), "utf8");
    expect(content).toContain("pnpm standards:check");
    expect(content).toMatch(/11 consolidated tool handlers/);
  });
});
