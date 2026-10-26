/**
 * Ensures docs/coding-standards.md Commit Checklist stays wired to STANDARDS_ENFORCEMENT.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOC_COMMIT_CHECKLIST_COVERAGE,
  STANDARDS_ENFORCEMENT,
} from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_PATH = join(REPO_ROOT, "docs/coding-standards.md");

function extractCommitChecklistBullets(markdown: string): string[] {
  const sectionStart = markdown.indexOf("## Commit Checklist");
  const sectionEnd = markdown.indexOf("## What NOT to Do", sectionStart);
  if (sectionStart === -1 || sectionEnd === -1) {
    throw new Error("Could not find Commit Checklist section in docs/coding-standards.md");
  }

  const section = markdown.slice(sectionStart, sectionEnd);
  const bullets: string[] = [];
  const lineRe = /^- \[ \] \*\*(.+?)\*\*/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(section)) !== null) {
    bullets.push(match[1]!);
  }
  return bullets;
}

describe("Coding standards — commit checklist coverage", () => {
  const standardsDoc = readFileSync(STANDARDS_PATH, "utf8");
  const docBullets = extractCommitChecklistBullets(standardsDoc);
  const enforcementLabels = STANDARDS_ENFORCEMENT.map((e) => e.checklist);

  it("docs Commit Checklist bullet count matches DOC_COMMIT_CHECKLIST_COVERAGE", () => {
    expect(docBullets).toHaveLength(DOC_COMMIT_CHECKLIST_COVERAGE.length);
  });

  it("every docs Commit Checklist bullet is listed in DOC_COMMIT_CHECKLIST_COVERAGE", () => {
    const missing: string[] = [];
    for (const bullet of docBullets) {
      const covered = DOC_COMMIT_CHECKLIST_COVERAGE.some((row) => bullet.includes(row.docSubstring));
      if (!covered) {
        missing.push(bullet);
      }
    }
    expect(
      missing,
      `Add DOC_COMMIT_CHECKLIST_COVERAGE rows for new checklist bullets:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("every DOC_COMMIT_CHECKLIST_COVERAGE row maps to a STANDARDS_ENFORCEMENT entry", () => {
    const missing: string[] = [];
    for (const { docSubstring, enforcementSubstring } of DOC_COMMIT_CHECKLIST_COVERAGE) {
      const hasDoc = docBullets.some((b) => b.includes(docSubstring));
      if (!hasDoc) {
        missing.push(`doc missing bullet containing: ${docSubstring}`);
        continue;
      }
      const hasEnforcement = enforcementLabels.some((label) =>
        label.toLowerCase().includes(enforcementSubstring.toLowerCase()),
      );
      if (!hasEnforcement) {
        missing.push(
          `no STANDARDS_ENFORCEMENT.checklist contains "${enforcementSubstring}" (for doc "${docSubstring}")`,
        );
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});
