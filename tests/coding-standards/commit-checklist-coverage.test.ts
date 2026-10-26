/**
 * Ensures docs/coding-standards.md anti-patterns and architecture rules stay
 * covered by pnpm standards:check (not only human review).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STANDARDS_ENFORCEMENT_MAP } from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");

describe("Coding standards — commit checklist automation", () => {
  it("documents pnpm standards:check as the guardrail entrypoint", () => {
    const content = readFileSync(STANDARDS_DOC, "utf8");
    expect(content).toContain("pnpm standards:check");
    expect(content).toMatch(/11 consolidated tool handlers/);
    expect(content).toMatch(/Zod v4/);
  });

  it("covers the full commit checklist via STANDARDS_ENFORCEMENT_MAP", () => {
    const checklistStart = readFileSync(STANDARDS_DOC, "utf8").indexOf("## Commit Checklist");
    const checklistEnd = readFileSync(STANDARDS_DOC, "utf8").indexOf("\n## What NOT to Do");
    const checklist = readFileSync(STANDARDS_DOC, "utf8").slice(checklistStart, checklistEnd);
    const bulletCount = checklist.split("\n").filter((l) => l.startsWith("- [ ] **")).length;

    expect(STANDARDS_ENFORCEMENT_MAP.length).toBe(bulletCount);
  });

  it("does not regress to outdated 10-tool or server.tool() documentation", () => {
    const content = readFileSync(STANDARDS_DOC, "utf8");
    expect(content).not.toMatch(/10 consolidated tool handlers/);
    expect(content).not.toMatch(/\bserver\.tool\(\)/);
    expect(content).not.toMatch(/\|\s*Schema validation\s*\|\s*Zod v3\s*\|/);
  });
});
