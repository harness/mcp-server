/**
 * Ensures every automated commit-checklist rule points at real vitest guard files.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MANUAL_COMMIT_CHECKLIST_MATCHES,
  STANDARDS_ENFORCEMENT_RULES,
} from "./enforcement-map.js";

const REPO_ROOT = join(import.meta.dirname, "../..");
const STANDARDS_DOC = join(REPO_ROOT, "docs/coding-standards.md");

function extractCommitChecklistBullets(markdown: string): string[] {
  const sectionStart = markdown.indexOf("## Commit Checklist");
  expect(sectionStart, "docs/coding-standards.md missing ## Commit Checklist").toBeGreaterThan(-1);
  const section = markdown.slice(sectionStart);
  const sectionEnd = section.indexOf("\n## ");
  const body = sectionEnd === -1 ? section : section.slice(0, sectionEnd);

  const bullets: string[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ] **")) {
      bullets.push(trimmed);
    }
  }
  return bullets;
}

describe("Coding standards — enforcement map", () => {
  it("maps every automated checklist bullet to at least one enforcing test file", () => {
    const bullets = extractCommitChecklistBullets(readFileSync(STANDARDS_DOC, "utf8"));
    expect(bullets.length).toBeGreaterThan(0);

    const unmatched: string[] = [];
    for (const bullet of bullets) {
      const manual = MANUAL_COMMIT_CHECKLIST_MATCHES.some((re) => re.test(bullet));
      if (manual) continue;

      const rule = STANDARDS_ENFORCEMENT_RULES.find((r) => r.checklistMatch.test(bullet));
      if (!rule) {
        unmatched.push(bullet);
      }
    }

    expect(
      unmatched,
      `Add a STANDARDS_ENFORCEMENT_RULES entry (or MANUAL_COMMIT_CHECKLIST_MATCHES) for:\n${unmatched.join("\n")}`,
    ).toEqual([]);
  });

  it("each enforcement rule references existing test files", () => {
    const missing: string[] = [];

    for (const rule of STANDARDS_ENFORCEMENT_RULES) {
      for (const relativePath of rule.testFiles) {
        const absolute = join(REPO_ROOT, relativePath);
        if (!existsSync(absolute)) {
          missing.push(`${rule.id}: ${relativePath}`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("uses unique rule ids and non-overlapping checklist matchers", () => {
    const ids = STANDARDS_ENFORCEMENT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);

    const bullets = extractCommitChecklistBullets(readFileSync(STANDARDS_DOC, "utf8"));
    const automatedBullets = bullets.filter(
      (b) => !MANUAL_COMMIT_CHECKLIST_MATCHES.some((re) => re.test(b)),
    );

    for (const bullet of automatedBullets) {
      const matches = STANDARDS_ENFORCEMENT_RULES.filter((r) => r.checklistMatch.test(bullet));
      expect(
        matches.length,
        `expected exactly one enforcement rule for checklist bullet: ${bullet}`,
      ).toBe(1);
    }
  });
});
