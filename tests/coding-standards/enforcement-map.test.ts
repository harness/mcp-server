/**
 * Validates STANDARDS_ENFORCEMENT_MAP and keeps it aligned with docs/coding-standards.md.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { STANDARDS_ENFORCEMENT_MAP } from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");
const CI_WORKFLOW = join(REPO_ROOT, ".github/workflows/ci.yml");

function extractCommitChecklistSection(markdown: string): string {
  const start = markdown.indexOf("## Commit Checklist");
  expect(start, "docs/coding-standards.md missing ## Commit Checklist").toBeGreaterThanOrEqual(0);
  const end = markdown.indexOf("\n## ", start + 1);
  return end === -1 ? markdown.slice(start) : markdown.slice(start, end);
}

describe("Coding standards — enforcement map", () => {
  const checklistSection = readFileSync(STANDARDS_DOC, "utf8");
  const checklistBody = extractCommitChecklistSection(checklistSection);
  const ciWorkflow = readFileSync(CI_WORKFLOW, "utf8");

  it("every map entry references an existing enforcing test file or CI step", () => {
    for (const entry of STANDARDS_ENFORCEMENT_MAP) {
      const hasTests = entry.enforcingTestFiles.length > 0;
      const hasCi = (entry.ciWorkflowSteps?.length ?? 0) > 0;
      expect(hasTests || hasCi, `${entry.id}: must list enforcingTestFiles or ciWorkflowSteps`).toBe(
        true,
      );

      for (const relativePath of entry.enforcingTestFiles) {
        const absolute = join(REPO_ROOT, relativePath);
        expect(existsSync(absolute), `${entry.id}: missing ${relativePath}`).toBe(true);
      }

      for (const step of entry.ciWorkflowSteps ?? []) {
        expect(ciWorkflow, `${entry.id}: CI missing ${step}`).toContain(step);
      }
    }
  });

  it("maps every Commit Checklist bullet in docs/coding-standards.md", () => {
    const bullets = checklistBody
      .split("\n")
      .filter((line) => line.startsWith("- [ ] **"))
      .map((line) => line.replace(/^- \[ \] \*\*/, "").replace(/\*\*.*$/, "").trim());

    expect(bullets.length).toBeGreaterThan(0);

    const unmatched: string[] = [];
    for (const bullet of bullets) {
      const matched = STANDARDS_ENFORCEMENT_MAP.some((entry) =>
        bullet.includes(entry.checklistSubstring) ||
        entry.checklistSubstring.includes(bullet.slice(0, 20)),
      );
      if (!matched) {
        unmatched.push(bullet);
      }
    }

    expect(
      unmatched,
      `Commit checklist bullets without enforcement-map coverage — update enforcement-map.ts:\n${unmatched.join("\n")}`,
    ).toEqual([]);
  });

  it("each map entry checklistSubstring appears in the Commit Checklist section", () => {
    const missing: string[] = [];
    for (const entry of STANDARDS_ENFORCEMENT_MAP) {
      if (!checklistBody.includes(entry.checklistSubstring)) {
        missing.push(`${entry.id}: "${entry.checklistSubstring}"`);
      }
    }

    expect(
      missing,
      `Stale enforcement-map checklistSubstring values:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("uses unique enforcement map ids", () => {
    const ids = STANDARDS_ENFORCEMENT_MAP.map((e) => e.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
